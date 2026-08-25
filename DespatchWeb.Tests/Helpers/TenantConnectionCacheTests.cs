using DespatchWeb.Helpers;

namespace DespatchWeb.Tests.Helpers;

/// <summary>
/// Unit tests for TenantConnectionCache.
///
/// The behaviour under test is the fix for the 2026-08-25 Medical incident: four
/// apps shared one Redis cache entry for the tenant connection string, each writing
/// it with its own SQLCredentials, so despatchweb could end up connecting as the
/// ClientManager login and be denied EXECUTE on UTL_stpJob_Insert_JobNumber.
/// </summary>
public class TenantConnectionCacheTests
{
    private const string Base =
        "server=sql.example.com,1433;database=Despatch-Medical-Prod;TrustServerCertificate=True;";

    [Fact]
    public void Key_IsNamespacedToThisApp()
    {
        Assert.Equal("8-DespatchWeb-Connection", TenantConnectionCache.Key("8"));
    }

    [Fact]
    public void LegacyKey_IsTheOldSharedKey()
    {
        Assert.Equal("8-ClientManager-Connection", TenantConnectionCache.LegacyKey("8"));
    }

    [Fact]
    public void Key_AndLegacyKey_DoNotCollide()
    {
        Assert.NotEqual(TenantConnectionCache.Key("8"), TenantConnectionCache.LegacyKey("8"));
    }

    [Fact]
    public void ApplyOwnCredentials_OverridesAnotherAppsLogin()
    {
        // The exact shape that broke Medical: clientmanager seeded the shared entry.
        var poisoned = Base + "UID=ClientManager;pwd=someothersecret";

        var result = TenantConnectionCache.ApplyOwnCredentials(
            poisoned, "uid=DespatchWeb;pwd=ourssecret");

        var builder = new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(result);
        Assert.Equal("DespatchWeb", builder.UserID);
        Assert.Equal("ourssecret", builder.Password);
        Assert.Equal("Despatch-Medical-Prod", builder.InitialCatalog);
    }

    [Fact]
    public void ApplyOwnCredentials_IsANoOpWhenCredentialsAlreadyOurs()
    {
        var already = Base + "uid=DespatchWeb;pwd=ourssecret";

        var result = TenantConnectionCache.ApplyOwnCredentials(
            already, "uid=DespatchWeb;pwd=ourssecret");

        var builder = new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(result);
        Assert.Equal("DespatchWeb", builder.UserID);
        Assert.Equal("ourssecret", builder.Password);
    }

    [Fact]
    public void ApplyOwnCredentials_PreservesTheServerAndDatabase()
    {
        var result = TenantConnectionCache.ApplyOwnCredentials(
            Base + "UID=ClientManager;pwd=x", "uid=DespatchWeb;pwd=y");

        var builder = new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(result);
        Assert.Equal("sql.example.com,1433", builder.DataSource);
        Assert.True(builder.TrustServerCertificate);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void ApplyOwnCredentials_ReturnsInputWhenCredentialsMissing(string? credentials)
    {
        var input = Base + "uid=Whoever;pwd=x";

        Assert.Equal(input, TenantConnectionCache.ApplyOwnCredentials(input, credentials));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void ApplyOwnCredentials_ReturnsInputWhenConnectionStringMissing(string? connectionString)
    {
        Assert.Equal(connectionString,
            TenantConnectionCache.ApplyOwnCredentials(connectionString, "uid=DespatchWeb;pwd=y"));
    }

    [Fact]
    public void ApplyOwnCredentials_LeavesAnUnrecognisableConnectionStringUntouched()
    {
        // SqlConnectionStringBuilder drops what it cannot parse instead of throwing,
        // so rewriting this would return credentials with no server or database.
        const string unrecognisable = "this is not a connection string===;;;";

        Assert.Equal(unrecognisable,
            TenantConnectionCache.ApplyOwnCredentials(unrecognisable, "uid=DespatchWeb;pwd=y"));
    }

    [Fact]
    public void ApplyOwnCredentials_NeverReturnsAConnectionStringWithoutAServer()
    {
        var result = TenantConnectionCache.ApplyOwnCredentials(
            Base + "UID=ClientManager;pwd=x", "uid=DespatchWeb;pwd=y");

        var builder = new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(result);
        Assert.NotEmpty(builder.DataSource);
        Assert.NotEmpty(builder.InitialCatalog);
    }
}
