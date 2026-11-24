using DespatchWeb.Interceptors;
using Microsoft.Data.Sqlite;

namespace DespatchWeb.Tests.Interceptors;

public class SlowSqlCommandInterceptorTests
{
    private readonly List<SlowSqlEvent> _events = [];
    private readonly SlowSqlCommandInterceptor _interceptor;

    public SlowSqlCommandInterceptorTests()
    {
        _interceptor = new SlowSqlCommandInterceptor(
            TimeSpan.FromMilliseconds(500), TimeSpan.FromSeconds(5), _events.Add);
    }

    private static SqliteCommand Command(string text) => new(text);

    [Fact]
    public void Observe_FasterThanThreshold_LogsNothing()
    {
        _interceptor.Observe(Command("-- PodSearch - Page Keys\n\nSELECT 1"), TimeSpan.FromMilliseconds(499), failed: false);

        Assert.Empty(_events);
    }

    [Fact]
    public void Observe_SlowCommand_LogsTagAndDurationWithoutSql()
    {
        _interceptor.Observe(Command("-- PodSearch - Page Keys\r\n\r\nSELECT 1"), TimeSpan.FromMilliseconds(1234), failed: false);

        var e = Assert.Single(_events);
        Assert.Equal("PodSearch - Page Keys", e.Tag);
        Assert.Equal(1234, e.DurationMs);
        Assert.False(e.Failed);
        Assert.Null(e.Sql);
    }

    [Fact]
    public void Observe_VerySlowCommand_IncludesSqlWithoutTheTagComment()
    {
        _interceptor.Observe(Command("-- Tag\n\nSELECT * FROM tucJob"), TimeSpan.FromSeconds(6), failed: false);

        Assert.Equal("SELECT * FROM tucJob", Assert.Single(_events).Sql);
    }

    [Fact]
    public void Observe_SlowFailure_IncludesSqlAndMarksFailed()
    {
        _interceptor.Observe(Command("SELECT 1"), TimeSpan.FromSeconds(30), failed: true);

        var e = Assert.Single(_events);
        Assert.True(e.Failed);
        Assert.Equal("untagged", e.Tag);
        Assert.Equal("SELECT 1", e.Sql);
    }

    [Fact]
    public void Observe_SlowCancellation_IsReportedAsCancelled()
    {
        _interceptor.Observe(Command("-- PodSearch - Page Keys\nSELECT 1"), TimeSpan.FromSeconds(12), failed: true, cancelled: true);

        var e = Assert.Single(_events);
        Assert.True(e.Cancelled);
        Assert.Equal("PodSearch - Page Keys", e.Tag);
    }

    [Fact]
    public void Observe_FastCancellation_IsNotReported()
    {
        _interceptor.Observe(Command("SELECT 1"), TimeSpan.FromMilliseconds(80), failed: true, cancelled: true);

        Assert.Empty(_events);
    }

    [Fact]
    public void Observe_LongSql_IsTruncated()
    {
        _interceptor.Observe(Command("SELECT '" + new string('x', 5000) + "'"), TimeSpan.FromSeconds(10), failed: false);

        Assert.True(Assert.Single(_events).Sql!.Length < 2100);
    }

    [Theory]
    [InlineData("-- A\n-- B\nSELECT 1", "A")]
    [InlineData("\n\n-- Spaced tag  \nSELECT 1", "Spaced tag")]
    [InlineData("SELECT 1", "untagged")]
    [InlineData("", "untagged")]
    public void ExtractTag_ReadsTheFirstCommentLine(string text, string expected) =>
        Assert.Equal(expected, SlowSqlCommandInterceptor.ExtractTag(text));
}
