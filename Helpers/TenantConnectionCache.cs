using Microsoft.Data.SqlClient;
using Serilog;

namespace DespatchWeb.Helpers;

/// <summary>
/// Owns the per-tenant connection-string cache key, and guarantees the resulting
/// connection uses THIS application's SQL credentials.
///
/// Background: despatchweb, clientmanager, dfrntdrive_configurator and
/// routed-operations all used to read *and write* a single shared cache entry
/// ("{tenantId}-ClientManager-Connection") in the same Redis instance, each
/// appending its own SQLCredentials. Whichever app a user opened last therefore
/// decided which SQL login every other app connected as. On 2026-08-25 that
/// surfaced on Despatch-Medical-Prod as "The EXECUTE permission was denied on
/// the object 'UTL_stpJob_Insert_JobNumber'" - despatchweb was running as the
/// ClientManager login, which holds no rights to that procedure.
///
/// Each app now owns its own key. <see cref="LegacyKey"/> is a transitional read
/// fallback so sessions already cached under the shared key keep working during
/// the rollout, and <see cref="ApplyOwnCredentials"/> makes that fallback safe by
/// re-stamping our credentials over whatever the entry happens to carry. The
/// fallback is removed once every app and tenant has been deployed.
/// </summary>
public static class TenantConnectionCache
{
    private const string AppName = "DespatchWeb";

    /// <summary>This application's own cache key for a tenant.</summary>
    public static string Key(string tenantId) => $"{tenantId}-{AppName}-Connection";

    /// <summary>The shared key used before each app owned its own. Read-only, transitional.</summary>
    public static string LegacyKey(string tenantId) => $"{tenantId}-ClientManager-Connection";

    /// <summary>
    /// Re-stamps this application's SQLCredentials over whatever credentials the
    /// cached connection string carries. A no-op when they already match, which is
    /// the normal case once rollout completes.
    /// </summary>
    public static string ApplyOwnCredentials(string connectionString) =>
        ApplyOwnCredentials(connectionString, Environment.GetEnvironmentVariable("SQLCredentials"));

    /// <summary>Overload taking the credentials explicitly, for testing.</summary>
    public static string ApplyOwnCredentials(string connectionString, string credentials)
    {
        if (string.IsNullOrWhiteSpace(connectionString) || string.IsNullOrWhiteSpace(credentials))
        {
            return connectionString;
        }

        try
        {
            var builder = new SqlConnectionStringBuilder(connectionString);

            // SqlConnectionStringBuilder drops content it cannot parse rather than
            // throwing, so rewriting an unrecognisable value would silently lose the
            // server and database. Leave anything without a server alone.
            if (string.IsNullOrEmpty(builder.DataSource))
            {
                Log.Warning("Cached connection string has no server; leaving credentials untouched");
                return connectionString;
            }

            var ours = new SqlConnectionStringBuilder(credentials);

            // Assigning through the builder normalises the uid/UID/User ID and
            // pwd/Password synonyms the various apps use in their env vars.
            if (!string.IsNullOrEmpty(ours.UserID))
            {
                builder.UserID = ours.UserID;
            }

            if (!string.IsNullOrEmpty(ours.Password))
            {
                builder.Password = ours.Password;
            }

            return builder.ConnectionString;
        }
        catch (ArgumentException ex)
        {
            // A malformed cached entry or env var must not take the app down; the
            // connection attempt below will fail loudly enough on its own.
            Log.Warning(ex, "Could not re-stamp SQL credentials onto the cached connection string");
            return connectionString;
        }
    }
}
