#nullable enable
using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Serilog;

namespace DespatchWeb.Interceptors;

/// <summary>
/// Logs SQL commands that run longer than a threshold, or fail, naming them by their <c>TagWith</c> tag. There is no
/// access to the production database (no Query Store, no plans), so this is how slow queries are found there.
/// Parameter values are never logged; the SQL text is only included for very slow or failed commands, truncated.
/// </summary>
public sealed class SlowSqlCommandInterceptor : DbCommandInterceptor
{
    public static readonly SlowSqlCommandInterceptor Instance = new(
        TimeSpan.FromMilliseconds(500), TimeSpan.FromSeconds(5), DefaultSink);

    private const int MaxSqlLength = 2000;

    private readonly TimeSpan _threshold;
    private readonly TimeSpan _includeSqlThreshold;
    private readonly Action<SlowSqlEvent> _sink;

    internal SlowSqlCommandInterceptor(TimeSpan threshold, TimeSpan includeSqlThreshold, Action<SlowSqlEvent> sink)
    {
        _threshold = threshold;
        _includeSqlThreshold = includeSqlThreshold;
        _sink = sink;
    }

    public override DbDataReader ReaderExecuted(DbCommand command, CommandExecutedEventData eventData, DbDataReader result)
    {
        Observe(command, eventData.Duration, failed: false);
        return result;
    }

    public override ValueTask<DbDataReader> ReaderExecutedAsync(DbCommand command, CommandExecutedEventData eventData,
        DbDataReader result, CancellationToken cancellationToken = default)
    {
        Observe(command, eventData.Duration, failed: false);
        return ValueTask.FromResult(result);
    }

    public override object? ScalarExecuted(DbCommand command, CommandExecutedEventData eventData, object? result)
    {
        Observe(command, eventData.Duration, failed: false);
        return result;
    }

    public override ValueTask<object?> ScalarExecutedAsync(DbCommand command, CommandExecutedEventData eventData,
        object? result, CancellationToken cancellationToken = default)
    {
        Observe(command, eventData.Duration, failed: false);
        return ValueTask.FromResult(result);
    }

    public override int NonQueryExecuted(DbCommand command, CommandExecutedEventData eventData, int result)
    {
        Observe(command, eventData.Duration, failed: false);
        return result;
    }

    public override ValueTask<int> NonQueryExecutedAsync(DbCommand command, CommandExecutedEventData eventData,
        int result, CancellationToken cancellationToken = default)
    {
        Observe(command, eventData.Duration, failed: false);
        return ValueTask.FromResult(result);
    }

    public override void CommandCanceled(DbCommand command, CommandEndEventData eventData) =>
        Observe(command, eventData.Duration, failed: true, cancelled: true);

    public override Task CommandCanceledAsync(DbCommand command, CommandEndEventData eventData,
        CancellationToken cancellationToken = default)
    {
        Observe(command, eventData.Duration, failed: true, cancelled: true);
        return Task.CompletedTask;
    }

    public override void CommandFailed(DbCommand command, CommandErrorEventData eventData) =>
        Observe(command, eventData.Duration, failed: true);

    public override Task CommandFailedAsync(DbCommand command, CommandErrorEventData eventData,
        CancellationToken cancellationToken = default)
    {
        Observe(command, eventData.Duration, failed: true);
        return Task.CompletedTask;
    }

    internal void Observe(DbCommand command, TimeSpan duration, bool failed, bool cancelled = false)
    {
        // Failures and cancellations go through the same threshold, so timeouts and abandoned slow queries are
        // reported while fast failures (constraint violations and the like) are left to their callers.
        if (duration < _threshold) return;

        var text = command.CommandText ?? string.Empty;
        var includeSql = failed || duration >= _includeSqlThreshold;
        _sink(new SlowSqlEvent(
            ExtractTag(text),
            (long)duration.TotalMilliseconds,
            failed,
            cancelled,
            includeSql ? Truncate(StripTags(text)) : null));
    }

    /// <summary>The first <c>TagWith</c> comment EF writes at the top of the command, or "untagged".</summary>
    internal static string ExtractTag(string commandText)
    {
        using var reader = new StringReader(commandText);
        while (reader.ReadLine() is { } line)
        {
            var trimmed = line.Trim();
            if (trimmed.Length == 0) continue;
            return trimmed.StartsWith("--", StringComparison.Ordinal) ? trimmed[2..].Trim() : "untagged";
        }

        return "untagged";
    }

    private static string StripTags(string commandText)
    {
        var lines = commandText.Split('\n');
        var start = 0;
        while (start < lines.Length &&
               (lines[start].Trim().Length == 0 || lines[start].TrimStart().StartsWith("--", StringComparison.Ordinal)))
        {
            start++;
        }

        return string.Join('\n', lines[start..]).Trim();
    }

    private static string Truncate(string sql) => sql.Length <= MaxSqlLength ? sql : sql[..MaxSqlLength] + " …";

    private static void DefaultSink(SlowSqlEvent e)
    {
        var outcome = e.Cancelled ? "cancelled" : e.Failed ? "failed" : "completed";
        if (e.Sql is null)
        {
            Log.Warning("Slow SQL {SqlTag} {SqlOutcome} after {SqlDurationMs}ms", e.Tag, outcome, e.DurationMs);
        }
        else
        {
            Log.Warning("Slow SQL {SqlTag} {SqlOutcome} after {SqlDurationMs}ms {SqlText}",
                e.Tag, outcome, e.DurationMs, e.Sql);
        }
    }
}

internal sealed record SlowSqlEvent(string Tag, long DurationMs, bool Failed, bool Cancelled, string? Sql);
