using System.Collections;
using System.Globalization;
using DespatchWeb.EntityClasses;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DespatchWeb.Filters;

public enum ScopedRecord
{
    Job,
    BulkJob,

    /// <summary>A job id that may also be a parent bulk job's id (legs released from bulk keep it as ParentId).</summary>
    JobOrBulkJob,
    Courier,
    Client,

    /// <summary>A client the caller may book for: any active client for a network partner.</summary>
    BookableClient
}

/// <summary>
/// Refuses (404) a write or read whose client-supplied ids name a record outside the caller's
/// scope. Many endpoints write straight to unfiltered tables, procs or S3 by id, so the EF scope
/// filters never see them. Each path is an action argument (<c>jobId</c>) or one of its properties
/// (<c>request.JobIds</c>) holding an int, a list of ints or a comma-separated string. Unscoped
/// callers (staff, DF admin) skip the lookups.
/// </summary>
[AttributeUsage(AttributeTargets.Method, AllowMultiple = true, Inherited = true)]
public sealed class RequireScopeAttribute(ScopedRecord record, params string[] idPaths) : Attribute, IAsyncActionFilter
{
    public ScopedRecord Record { get; } = record;
    public IReadOnlyList<string> IdPaths { get; } = idPaths;

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var factory = context.HttpContext.RequestServices.GetRequiredService<IDbContextFactory<DespatchContext>>();
        await using var db = await factory.CreateDbContextAsync(context.HttpContext.RequestAborted);

        if (!db.CurrentBypassFilters)
        {
            foreach (var id in IdPaths.SelectMany(path => ReadIds(context.ActionArguments, path)).Distinct())
            {
                if (await IsVisibleAsync(db, id))
                {
                    continue;
                }

                Log.Warning("RequireScope deny: {Record} {Id} is outside the caller's scope for {Method} {Path}",
                    Record, id, context.HttpContext.Request.Method, context.HttpContext.Request.Path);
                context.Result = new NotFoundObjectResult(NotFoundMessage);
                return;
            }
        }

        await next();
    }

    // The same wording whether the record is missing or someone else's, so it confirms nothing.
    private string NotFoundMessage => Record switch
    {
        ScopedRecord.BulkJob => "Bulk job not found. Refresh the list and try again.",
        ScopedRecord.Courier => "Courier not found. Refresh the list and try again.",
        ScopedRecord.Client or ScopedRecord.BookableClient => "Client not found. Refresh the list and try again.",
        _ => "Job not found. Refresh the list and try again."
    };

    private Task<bool> IsVisibleAsync(DespatchContext db, int id) => Record switch
    {
        ScopedRecord.Job => db.IsJobVisibleAsync(id),
        ScopedRecord.BulkJob => db.TblBulkJobs.AnyAsync(b => b.BulkJobId == id),
        ScopedRecord.JobOrBulkJob => IsJobOrBulkJobVisibleAsync(db, id),
        ScopedRecord.Courier => db.TucCouriers.AnyAsync(c => c.UccrId == id),
        ScopedRecord.Client => db.IsClientVisibleAsync(id),
        ScopedRecord.BookableClient => db.IsClientBookableAsync(id),
        _ => throw new ArgumentOutOfRangeException(nameof(Record))
    };

    private static async Task<bool> IsJobOrBulkJobVisibleAsync(DespatchContext db, int id) =>
        await db.IsJobVisibleAsync(id) || await db.TblBulkJobs.AnyAsync(b => b.BulkJobId == id);

    internal static IEnumerable<int> ReadIds(IDictionary<string, object> arguments, string path)
    {
        var parts = path.Split('.');
        if (!arguments.TryGetValue(parts[0], out var value))
        {
            return [];
        }

        foreach (var property in parts.Skip(1))
        {
            value = value?.GetType().GetProperty(property)?.GetValue(value);
        }

        return value switch
        {
            null => [],
            int single => [single],
            string csv => csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(s => int.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id) ? id : 0),
            IEnumerable<int> many => many,
            IEnumerable items => items.OfType<int>(),
            _ => []
        };
    }
}
