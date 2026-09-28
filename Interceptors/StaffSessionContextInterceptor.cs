using System.Data;
using System.Data.Common;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Serilog;

namespace DespatchWeb.Interceptors;

/// <summary>
/// Stamps the acting staff id into SQL session context on every connection open,
/// so the JobDeliveryJourney triggers can record who made each change.
///
/// This has to run per-open rather than per-request: SqlClient issues
/// sp_reset_connection when a connection is taken from the pool, which clears
/// session context. A SaveChanges interceptor would also miss the cases that
/// matter most — job edits go through ExecuteUpdateAsync and stored procedures,
/// which fire the triggers without ever calling SaveChanges.
/// </summary>
public class StaffSessionContextInterceptor(IHttpContextAccessor contextAccessor) : DbConnectionInterceptor
{
    private const string StaffIdClaimType = "StaffID";
    private const string SessionContextKey = "StaffID";

    public override void ConnectionOpened(DbConnection connection, ConnectionEndEventData eventData)
    {
        if (!ShouldStamp(connection, out var staffId))
        {
            return;
        }

        try
        {
            using var command = connection.CreateCommand();
            ApplyTo(command, staffId);
            Execute(command);
        }
        catch (Exception ex)
        {
            LogFailure(ex, staffId);
        }
    }

    public override async Task ConnectionOpenedAsync(
        DbConnection connection,
        ConnectionEndEventData eventData,
        CancellationToken cancellationToken = default)
    {
        if (!ShouldStamp(connection, out var staffId))
        {
            return;
        }

        try
        {
            await using var command = connection.CreateCommand();
            ApplyTo(command, staffId);
            await ExecuteAsync(command, cancellationToken);
        }
        catch (Exception ex)
        {
            LogFailure(ex, staffId);
        }
    }

    protected virtual void Execute(DbCommand command) => command.ExecuteNonQuery();

    protected virtual Task ExecuteAsync(DbCommand command, CancellationToken cancellationToken) =>
        command.ExecuteNonQueryAsync(cancellationToken);

    private bool ShouldStamp(DbConnection connection, out int staffId)
    {
        staffId = 0;
        return connection is SqlConnection
               && TryResolveStaffId(contextAccessor.HttpContext, out staffId);
    }

    /// <summary>
    /// Reads the acting staff id from the request's claims. Returns false for
    /// background work (no HttpContext) and for absent, unparseable or
    /// non-positive claims — a zero would fail FK_JobDeliveryJourney_Staff,
    /// since tucStaff has no ucstID = 0.
    /// </summary>
    internal static bool TryResolveStaffId(HttpContext httpContext, out int staffId)
    {
        staffId = 0;

        var claim = httpContext?.User.Claims.FirstOrDefault(c => c.Type == StaffIdClaimType)?.Value;

        if (!int.TryParse(claim, out var parsed) || parsed <= 0)
        {
            return false;
        }

        staffId = parsed;
        return true;
    }

    /// <summary>
    /// Builds the sp_set_session_context call. Deliberately does not pass
    /// @read_only — a pooled session can be stamped more than once, and a
    /// read-only value would make the second attempt raise an error instead of
    /// harmlessly overwriting.
    /// </summary>
    internal static void ApplyTo(DbCommand command, int staffId)
    {
        command.CommandText = "EXEC sys.sp_set_session_context @key, @value";

        var key = command.CreateParameter();
        key.ParameterName = "@key";
        key.DbType = DbType.String;
        key.Value = SessionContextKey;
        command.Parameters.Add(key);

        var value = command.CreateParameter();
        value.ParameterName = "@value";
        value.DbType = DbType.Int32;
        value.Value = staffId;
        command.Parameters.Add(value);
    }

    private static void LogFailure(Exception ex, int staffId) =>
        Log.Warning(
            ex,
            "Could not stamp acting staff id {StaffId} into SQL session context; delivery-journey rows written on this connection will be unattributed",
            staffId);
}
