using System.Data.Common;
using System.Security.Claims;
using DespatchWeb.Interceptors;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.Sqlite;
using NSubstitute;

namespace DespatchWeb.Tests.Interceptors;

/// <summary>
/// Unit tests for StaffSessionContextInterceptor — the hook that stamps the
/// acting staff id into SQL session context so the JobDeliveryJourney triggers
/// can attribute each change. No SQL Server instance is required: claim
/// resolution and command construction are tested through their own seams.
/// </summary>
public sealed class StaffSessionContextInterceptorTests
{
    private readonly IHttpContextAccessor _contextAccessor = Substitute.For<IHttpContextAccessor>();

    private StaffSessionContextInterceptor CreateInterceptor() => new(_contextAccessor);

    private static HttpContext ContextWithClaims(params (string type, string value)[] claims)
    {
        var identity = new ClaimsIdentity(claims.Select(c => new Claim(c.type, c.value)), "TestAuth");
        return new DefaultHttpContext { User = new ClaimsPrincipal(identity) };
    }

    [Fact]
    public void TryResolveStaffId_WithPositiveClaim_ReturnsTrueAndId()
    {
        var resolved = StaffSessionContextInterceptor.TryResolveStaffId(
            ContextWithClaims(("StaffID", "42")), out var staffId);

        Assert.True(resolved);
        Assert.Equal(42, staffId);
    }

    [Fact]
    public void TryResolveStaffId_WithNoHttpContext_ReturnsFalse()
    {
        // Background/scheduled work has no request — attribution is simply skipped.
        Assert.False(StaffSessionContextInterceptor.TryResolveStaffId(null, out var staffId));
        Assert.Equal(0, staffId);
    }

    [Fact]
    public void TryResolveStaffId_WithMissingClaim_ReturnsFalse()
    {
        Assert.False(StaffSessionContextInterceptor.TryResolveStaffId(
            ContextWithClaims(("CurrentTenantID", "7")), out _));
    }

    [Theory]
    [InlineData("0")]
    [InlineData("-1")]
    [InlineData("abc")]
    [InlineData("")]
    public void TryResolveStaffId_WithNonPositiveOrUnparseableClaim_ReturnsFalse(string claimValue)
    {
        // A zero would fail FK_JobDeliveryJourney_Staff (there is no ucstID = 0),
        // so it must be treated as "unknown", not written through.
        Assert.False(StaffSessionContextInterceptor.TryResolveStaffId(
            ContextWithClaims(("StaffID", claimValue)), out var staffId));
        Assert.Equal(0, staffId);
    }

    [Fact]
    public void ApplyTo_BuildsSpSetSessionContextCommand()
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        using var command = connection.CreateCommand();

        StaffSessionContextInterceptor.ApplyTo(command, 42);

        Assert.Contains("sp_set_session_context", command.CommandText);
        var key = Assert.Single(command.Parameters.Cast<DbParameter>(), p => p.ParameterName == "@key");
        var value = Assert.Single(command.Parameters.Cast<DbParameter>(), p => p.ParameterName == "@value");
        Assert.Equal("StaffID", key.Value);
        Assert.Equal(42, value.Value);
    }

    [Fact]
    public void ApplyTo_DoesNotMarkTheValueReadOnly()
    {
        // @read_only = 1 would make a second set on the same pooled session raise
        // an error instead of harmlessly overwriting.
        using var connection = new SqliteConnection("Data Source=:memory:");
        using var command = connection.CreateCommand();

        StaffSessionContextInterceptor.ApplyTo(command, 42);

        Assert.DoesNotContain("read_only", command.CommandText);
        Assert.DoesNotContain(command.Parameters.Cast<DbParameter>(), p => p.ParameterName.Contains("read_only"));
    }

    [Fact]
    public void ConnectionOpened_WithNonSqlServerConnection_DoesNothing()
    {
        // This is the guarantee that the SQLite-backed repository suite cannot
        // regress: the interceptor is a no-op on any non-SqlConnection.
        _contextAccessor.HttpContext.Returns(ContextWithClaims(("StaffID", "42")));
        var interceptor = new RecordingInterceptor(_contextAccessor);
        using var connection = new SqliteConnection("Data Source=:memory:");
        connection.Open();

        interceptor.ConnectionOpened(connection, null!);

        Assert.Equal(0, interceptor.ExecuteCount);
    }

    [Fact]
    public void ConnectionOpened_WithoutStaffId_ExecutesNothing()
    {
        _contextAccessor.HttpContext.Returns(ContextWithClaims());
        var interceptor = new RecordingInterceptor(_contextAccessor);

        interceptor.ConnectionOpened(new Microsoft.Data.SqlClient.SqlConnection(), null!);

        Assert.Equal(0, interceptor.ExecuteCount);
    }

    [Fact]
    public void ConnectionOpened_WhenExecutionFails_SwallowsTheException()
    {
        // Losing attribution is acceptable; failing the request is not.
        _contextAccessor.HttpContext.Returns(ContextWithClaims(("StaffID", "42")));
        var interceptor = new ThrowingInterceptor(_contextAccessor);

        interceptor.ConnectionOpened(new Microsoft.Data.SqlClient.SqlConnection(), null!);

        Assert.Equal(1, interceptor.ExecuteCount);
    }

    [Fact]
    public async Task ConnectionOpenedAsync_WhenExecutionFails_SwallowsTheException()
    {
        _contextAccessor.HttpContext.Returns(ContextWithClaims(("StaffID", "42")));
        var interceptor = new ThrowingInterceptor(_contextAccessor);

        await interceptor.ConnectionOpenedAsync(
            new Microsoft.Data.SqlClient.SqlConnection(), null!, TestContext.Current.CancellationToken);

        Assert.Equal(1, interceptor.ExecuteCount);
    }

    private class RecordingInterceptor(IHttpContextAccessor accessor)
        : StaffSessionContextInterceptor(accessor)
    {
        public int ExecuteCount { get; private set; }

        protected void Record() => ExecuteCount++;

        protected override void Execute(DbCommand command) => Record();

        protected override Task ExecuteAsync(DbCommand command, CancellationToken cancellationToken)
        {
            Record();
            return Task.CompletedTask;
        }
    }

    private sealed class ThrowingInterceptor(IHttpContextAccessor accessor) : RecordingInterceptor(accessor)
    {
        protected override void Execute(DbCommand command)
        {
            Record();
            throw new InvalidOperationException("session context unavailable");
        }

        protected override Task ExecuteAsync(DbCommand command, CancellationToken cancellationToken)
        {
            Record();
            throw new InvalidOperationException("session context unavailable");
        }
    }
}
