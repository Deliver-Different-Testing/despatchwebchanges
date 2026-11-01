#nullable enable
using System.Text;
using System.Text.Json;
using Anthropic.Models.Beta.Messages;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;

namespace DespatchWeb.Services.AutoMate.Tools;

/// <summary>Resolves a job id or job number argument to a job id.</summary>
internal static class JobReference
{
    public static readonly Dictionary<string, JsonElement> Properties = new()
    {
        ["job_id"] = ToolSchema.Prop("integer", "The job's id"),
        ["job_number"] = ToolSchema.Prop("string", "The job number shown to users, when the id isn't known")
    };

    public static async Task<(int? JobId, string? Error)> ResolveAsync(JsonElement input, IJobQueryRepository jobs)
    {
        var args = new ToolArgs(input);
        var jobId = args.Int("job_id");
        var jobNumber = args.String("job_number")?.Trim();

        if (args.Error is not null)
        {
            return (null, args.Error);
        }

        if (jobId is > 0)
        {
            return (jobId, null);
        }

        if (string.IsNullOrEmpty(jobNumber))
        {
            return (null, "Give either 'job_id' or 'job_number'.");
        }

        var resolved = await jobs.GetJobIdByNumberAsync(jobNumber);
        return resolved is null ? (null, $"No job has the number {jobNumber}.") : (resolved, null);
    }
}

public sealed class GetJobTool(
    IJobQueryRepository jobs,
    INoteRepository notes,
    ITaskRepository tasks,
    AutoMateAudience audience) : IAutoMateTool
{
    private static readonly BetaTool Tool = new()
    {
        Name = "get_job",
        Description = "Look up one job (live or archived): status, client, driver, addresses, schedule, flags and the problem signals Auto-mate's briefings use. Give job_id or job_number.",
        InputSchema = new InputSchema { Properties = JobReference.Properties }
    };

    public BetaTool Definition => Tool;

    public bool StaffOnly => true;

    public async Task<string> ExecuteAsync(JsonElement input, CancellationToken ct)
    {
        if (!audience.IsStaff)
        {
            return ToolOutput.Error(ToolOutput.StaffOnlyMessage);
        }

        var (jobId, error) = await JobReference.ResolveAsync(input, jobs);
        if (jobId is not { } id)
        {
            return ToolOutput.Error(error!);
        }

        JobViewModel? job;
        try
        {
            job = await jobs.GetJobWithoutMarkingReadAsync(id);
        }
        catch (KeyNotFoundException)
        {
            job = null;
        }

        if (job is null)
        {
            return ToolOutput.Error($"No job {id} was found.");
        }

        var jobNotes = await notes.GetNotesByJobIdAsync(id);
        var events = await tasks.GetAllTasksAsync(new TaskTableFiltersRequest { JobId = id, ShowCompleted = true });
        var signals = AiJobSignalCalculator.Compute(job, jobNotes ?? [], events ?? [], DateTimeOffset.UtcNow);

        var sb = new StringBuilder($"Job id {id}\n");
        AiJobPromptFormatter.AppendSignalLines(sb, signals);
        AiJobPromptFormatter.AppendJobDetails(sb, job);
        return sb.ToString();
    }
}

public sealed class GetJobActivityTool(
    IJobQueryRepository jobs,
    INoteRepository notes,
    ITaskRepository tasks,
    IDeliveryJourneyService journey,
    AutoMateAudience audience) : IAutoMateTool
{
    private static readonly BetaTool Tool = new()
    {
        Name = "get_job_activity",
        Description = "A job's notes, events/tasks and status history, oldest first. Use it to explain what has happened on a job or what is outstanding. Give job_id or job_number.",
        InputSchema = new InputSchema { Properties = JobReference.Properties }
    };

    public BetaTool Definition => Tool;

    public bool StaffOnly => true;

    public async Task<string> ExecuteAsync(JsonElement input, CancellationToken ct)
    {
        if (!audience.IsStaff)
        {
            return ToolOutput.Error(ToolOutput.StaffOnlyMessage);
        }

        var (jobId, error) = await JobReference.ResolveAsync(input, jobs);
        if (jobId is not { } id)
        {
            return ToolOutput.Error(error!);
        }

        var jobNotes = await notes.GetNotesByJobIdAsync(id);
        var events = await tasks.GetAllTasksAsync(new TaskTableFiltersRequest { JobId = id, ShowCompleted = true });
        var history = await journey.GetStatusHistoryForJobAsync(id);

        if (jobNotes.Count == 0 && events.Count == 0 && history.Count == 0)
        {
            return $"Job {id} has no notes, events or status history.";
        }

        var sb = new StringBuilder($"Job id {id}\n");
        if (history.Count > 0)
        {
            sb.AppendLine("--- Status history ---");
            foreach (var entry in history)
            {
                sb.AppendLine($"[{entry.ActionTime:yyyy-MM-dd HH:mm}] {entry.Status}");
            }

            sb.AppendLine();
        }

        AiJobPromptFormatter.AppendNotes(sb, jobNotes);
        AiJobPromptFormatter.AppendEvents(sb, events);
        return sb.ToString();
    }
}

public sealed class SearchJobsTool(IJobQueryRepository jobs, ITenantClock clock, AutoMateAudience audience) : IAutoMateTool
{
    private const int MaxRows = 10;
    private const int DefaultDays = 7;

    private static readonly BetaTool Tool = new()
    {
        Name = "search_jobs",
        Description = $"Search live and archived jobs by booking date (default: the last {DefaultDays} days), optionally narrowed by job number, free text (reference, address, contact), client id or driver id. Returns at most {MaxRows} jobs, newest first, with the total that matched.",
        InputSchema = new InputSchema
        {
            Properties = new Dictionary<string, JsonElement>
            {
                ["job_number"] = ToolSchema.Prop("string", "A job number, or the start of one"),
                ["text"] = ToolSchema.Prop("string", "Free text matched against references, addresses and contacts"),
                ["client_id"] = ToolSchema.Prop("integer", "Only jobs for this client (find the id with find_client)"),
                ["courier_id"] = ToolSchema.Prop("integer", "Only jobs for this driver"),
                ["from_date"] = ToolSchema.Prop("string", "First booking date to include, YYYY-MM-DD"),
                ["to_date"] = ToolSchema.Prop("string", "Last booking date to include, YYYY-MM-DD")
            }
        }
    };

    public BetaTool Definition => Tool;

    public bool StaffOnly => true;

    public async Task<string> ExecuteAsync(JsonElement input, CancellationToken ct)
    {
        if (!audience.IsStaff)
        {
            return ToolOutput.Error(ToolOutput.StaffOnlyMessage);
        }

        var args = new ToolArgs(input);
        var jobNumber = args.String("job_number");
        var text = args.String("text");
        var clientId = args.Int("client_id");
        var courierId = args.Int("courier_id");
        var to = args.Date("to_date") ?? clock.TenantToday;
        var from = args.Date("from_date") ?? to.AddDays(-DefaultDays);

        if (args.Error is not null)
        {
            return ToolOutput.Error(args.Error);
        }

        if (from > to)
        {
            return ToolOutput.Error("'from_date' must be on or before 'to_date'.");
        }

        var result = await jobs.PodSearchAsync(new PodSearchRequest
        {
            Job = jobNumber,
            Wild = text,
            ClientIds = clientId is { } c ? [c] : null,
            CourierIds = courierId is { } d ? [d] : null,
            FromDate = new DateTimeOffset(from, TimeSpan.Zero),
            ToDate = new DateTimeOffset(to, TimeSpan.Zero),
            PageSize = MaxRows,
            SortColumn = "date",
            SortDirection = "desc"
        }, ct);

        if (result.Jobs is not { Count: > 0 })
        {
            return $"No jobs matched between {from:yyyy-MM-dd} and {to:yyyy-MM-dd}.";
        }

        var sb = new StringBuilder($"{result.TotalCount} job(s) matched between {from:yyyy-MM-dd} and {to:yyyy-MM-dd}; showing {result.Jobs.Count}.\n");
        foreach (var job in result.Jobs)
        {
            var route = AiDataSanitizer.SanitizeUntrusted($"{job.PickupAddress?.FullAddress ?? job.From} → {job.DeliveryAddress?.FullAddress ?? job.ToAddress}");
            sb.Append($"- id {job.Id}, job {job.JobNo}: {job.Status ?? job.StatusName ?? "?"}")
                .Append($", client {AiDataSanitizer.SanitizeUntrusted(job.ClientName ?? job.Client ?? "?")}")
                .Append($", driver {job.Courier ?? job.AssignedCourier?.Text ?? "unassigned"}")
                .Append($", booked {job.Booked:yyyy-MM-dd HH:mm}")
                .Append(job.CompletedTime is { } done ? $", completed {done:yyyy-MM-dd HH:mm}" : string.Empty)
                .Append(job.IsArchived ? ", archived" : string.Empty)
                .Append($", {route}")
                .Append('\n');
        }

        return sb.ToString();
    }
}
