using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using Microsoft.Extensions.Options;

namespace DespatchWeb.Services;

public sealed class AiSummarizationService(
    IAiClientService aiClient,
    INoteRepository noteRepository,
    ITaskRepository taskRepository,
    IJobQueryRepository jobRepository,
    ICourierRepository courierRepository,
    ITenantInfoService tenantInfo,
    IOptions<AnthropicSettings> settings) : IAiSummarizationService
{
    private const string EmitSummaryToolName = "emit_summary";
    private const int MaxNotesInPrompt = 25;
    private const int MaxEventsInPrompt = 25;

    private static readonly JsonSerializerOptions ToolJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase, allowIntegerValues: false) }
    };

    /// <summary>
    /// JSON Schema for the emit_summary tool. The four structured summaries
    /// all return this shape; the prompt tells the model how to populate it
    /// for the specific summary type.
    /// </summary>
    private const string EmitSummarySchema = """
    {
      "type": "object",
      "properties": {
        "verdict": {
          "type": "string",
          "description": "One-sentence headline the reader sees first. ≤120 chars. Lead with the most urgent fact and an optional severity emoji (🚨 ⚠️ ✅)."
        },
        "severity": {
          "type": "string",
          "enum": ["Ok", "Info", "Caution", "Urgent", "Critical"],
          "description": "Overall severity. MUST be ≥ the highest severity tag in the SIGNAL lines."
        },
        "keyFacts": {
          "type": "array",
          "items": { "type": "string", "maxLength": 25 },
          "maxItems": 6,
          "description": "At-a-glance chips. Each chip is a single short value. Omit chips for missing data."
        },
        "attention": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "headline": { "type": "string", "description": "Problem stated with concrete numbers/times/names." },
              "action":   { "type": "string", "description": "Specific next action. MUST start with an imperative verb (Call, Reassign, Update, Cancel, Escalate, etc.)." },
              "severity": { "type": "string", "enum": ["Ok", "Info", "Caution", "Urgent", "Critical"] }
            },
            "required": ["headline", "action", "severity"]
          },
          "description": "Items needing dispatcher action. Most urgent first. Empty array if nothing needs attention."
        },
        "timeline": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "label":  { "type": "string", "description": "Milestone name (e.g. 'Booked', 'Dispatched', 'Picked up', 'Delivery')." },
              "detail": { "type": "string", "description": "Computed delta, NOT an absolute timestamp (e.g. '4h ago', 'on time', 'overdue 2h')." },
              "status": { "type": "string", "enum": ["Ok", "Pending", "Warning", "Late"] }
            },
            "required": ["label", "detail", "status"]
          },
          "description": "Chronological milestones with computed deltas. Empty array if not applicable."
        },
        "highlights": {
          "type": "array",
          "items": { "type": "string" },
          "maxItems": 4,
          "description": "Optional notable observations. Skip if nothing useful."
        }
      },
      "required": ["verdict", "severity", "keyFacts", "attention", "timeline", "highlights"]
    }
    """;

    private string RegionContext => tenantInfo.IsUsTenant()
        ? "a US-based courier dispatch company"
        : "a New Zealand courier dispatch company";

    private string CurrencyExample => tenantInfo.IsUsTenant() ? "$145" : "$145 NZD";

    private string SummarizationSystemPrompt =>
        $"""
         You are a logistics data summarizer for {RegionContext}.
         Provide concise, actionable summaries. Write in clear, professional language suitable for busy dispatchers.

         Format rules:
         - Use **bold** to highlight key information (job numbers, statuses, names)
         - Use bullet points for multiple items
         - Focus on: current status, key issues, timeline of important events, and pending actions
         - Keep to 2-4 sentences unless bullet points are needed
         """;

    private string JobBriefingSystemPrompt =>
        $"""
         You are a logistics job briefing assistant for {RegionContext}.
         Your audience is a busy dispatcher who has FIVE SECONDS to decide what to do next on this job.
         You MUST call the tool `{EmitSummaryToolName}` to return your output. Do not write prose outside the tool call.

         How to fill each field of `{EmitSummaryToolName}`:

         VERDICT — One sentence the reader sees first. Lead with the most urgent fact and a severity emoji (🚨 ⚠️ ✅).
           Examples: "🚨 Overdue for delivery by 2h — courier assigned, no recent update", "✅ On track — picked up 10m ago", "⚠️ No courier assigned and pickup due in 20m".

         SEVERITY — Map to the highest SIGNAL severity in the user message; never lower it.
           Critical = deadline missed >1h or money/safety at risk.
           Urgent   = deadline missed <1h or will be missed within the hour.
           Caution  = problem worth knowing about, not yet urgent.
           Info     = informational only.
           Ok       = healthy / complete.

         KEY FACTS — ≤6 chips, each ≤25 chars. Recommended order: Client • Speed • From→To • Charge • Courier • Ref.
           Use "→" between origin and destination. Use the local currency format (e.g. {CurrencyExample}).
           Omit a chip when its data is missing — do NOT write "Unknown" or "-".

         ATTENTION — Things the dispatcher must DO. Each item:
           - headline = the problem, with concrete numbers/times/names
           - action = imperative verb + WHO/WHAT. Banned vague phrasing: "review", "look into", "investigate".
           - severity = matches the underlying signal
           Order most urgent first. Empty list when nothing needs action.

         TIMELINE — ≤4 milestones, oldest first. Each:
           - label = "Booked" / "Dispatched" / "Picked up" / "Delivery" (use the actual milestone name from data)
           - detail = COMPUTED DELTA (e.g. "4h ago", "30m later", "on time", "overdue 2h") — never an absolute timestamp
           - status: Ok = on plan, Pending = upcoming, Warning = at risk, Late = missed
           Skip milestones that haven't happened and aren't due soon.

         HIGHLIGHTS — Optional. ≤4 short bullets summarising the most useful observations from notes/events
           (e.g. "Customer requested call before delivery", "Tail-lift unavailable at PU"). Skip if nothing notable.

         Rules:
         - SIGNAL: lines in the user message are the source of truth for numbers. Trust them.
         - Do not invent facts. If a field isn't present in the data, do not mention it.
         - Phone numbers and emails are already redacted as [PHONE] and [EMAIL] — keep them that way.
         - If the job is healthy or completed cleanly: verdict ≈ "✅ Delivered — no action needed", severity = Ok, attention = [].
         """;

    private string TaskBriefingSystemPrompt =>
        $"""
         You are a dispatch shift-briefing assistant for {RegionContext}.
         Your audience: a dispatcher arriving for their shift. They want to know in FIVE SECONDS how their queue looks.
         You MUST call the tool `{EmitSummaryToolName}`.

         VERDICT — One sentence describing the SHIFT POSTURE.
           Examples: "🚨 Heavy load: 12 open tasks, 5 overdue", "✅ Light morning: 3 tasks, all due later".

         SEVERITY — Map from SIGNAL severities. Critical/Urgent only if there are overdue items.

         KEY FACTS — ≤4 chips: e.g. "12 open", "5 overdue", "4 due today", "3 upcoming".

         ATTENTION — TOP 3 PRIORITIES the dispatcher should action first. Each:
           - headline = specific Job # and the problem ("Job J12345 — pickup overdue 45m")
           - action = imperative ("Reassign", "Call courier", "Escalate", "Cancel")
           - severity = matches signal
           Limit to 3 items. Order by urgency.

         TIMELINE — return [] (empty array).

         HIGHLIGHTS — ≤3 patterns worth noting (e.g. "Most overdue are 3rd-party deliveries", "Smith has 4 open tasks").

         Rules: same as the job briefing — trust SIGNAL lines, no fabrication, no banned phrasing.
         """;

    private string OperationsSystemPrompt =>
        $"""
         You are a dispatch operations health analyst for {RegionContext}.
         Audience: the ops lead. They want a one-line read on whether the fleet is healthy right now.
         You MUST call `{EmitSummaryToolName}`.

         VERDICT — One sentence health summary ("✅ Operations running normally with N active jobs", "⚠️ Inactive count unusually high").
         SEVERITY — Critical only if something demands immediate intervention.
         KEY FACTS — ≤4 chips: "X active", "Y inactive", "Z completed", "Total N".
         ATTENTION — anomalies a human should decide about. Concrete numbers + actions ("Investigate why inactive count is 35% of active"). Empty if normal.
         TIMELINE — return [].
         HIGHLIGHTS — comparative observations vs the typical pattern, time-of-day context.

         Rules: same.
         """;

    private string ComplianceSystemPrompt =>
        $"""
         You are a fleet compliance risk briefing assistant for {RegionContext}.
         Audience: a fleet manager. They want to know which drivers to chase TODAY.
         You MUST call `{EmitSummaryToolName}`.

         VERDICT — Risk level + headline number ("🚨 12 drivers with expired compliance items", "✅ Fleet compliant").
         SEVERITY — Critical if any expired; Urgent if ≥1 expires within 7 days; Caution if ≥1 within 30 days; Ok otherwise.
         KEY FACTS — chips: "X expired", "Y expiring ≤7d", "Z expiring ≤30d".
         ATTENTION — one bullet per at-risk item, most critical first (top 8).
           Each headline: driver name + item type + how long expired/until expiry.
           Each action: "Suspend until renewed" / "Email reminder" / "Block dispatch" etc.
         TIMELINE — return [].
         HIGHLIGHTS — patterns ("3 drivers have multiple expired items", "All expiries are in the same compliance category").

         Rules: same.
         """;

    // ---------------------------------------------------------------------
    //  Markdown summaries (notes / events) — unchanged contract
    // ---------------------------------------------------------------------

    public async Task<AiSummaryResponse> SummarizeJobNotesAsync(int jobId, CancellationToken ct = default)
    {
        var notes = await noteRepository.GetNotesByJobIdAsync(jobId);

        if (notes == null || notes.Count == 0)
        {
            return new AiSummaryResponse
            {
                Summary = "No notes found for this job.",
                Usage = new AiUsageInfo()
            };
        }

        var sb = new StringBuilder();
        sb.AppendLine("Summarize the following job notes:");
        sb.AppendLine();
        AppendNotes(sb, notes);

        var response = await aiClient.SendMessageAsync(
            SummarizationSystemPrompt,
            [new AiMessage { Role = "user", Content = sb.ToString() }],
            settings.Value.MaxTokensPerSummary,
            enableCaching: true,
            ct: ct);

        return new AiSummaryResponse
        {
            Summary = response.TextContent ?? "Unable to generate summary.",
            Usage = new AiUsageInfo
            {
                InputTokens = response.InputTokens,
                OutputTokens = response.OutputTokens
            }
        };
    }

    public async Task<AiSummaryResponse> SummarizeJobEventsAsync(int jobId, CancellationToken ct = default)
    {
        var filters = new TaskTableFiltersRequest { JobId = jobId, ShowCompleted = true };
        var events = await taskRepository.GetAllTasksAsync(filters);

        if (events == null || events.Count == 0)
        {
            return new AiSummaryResponse
            {
                Summary = "No events found for this job.",
                Usage = new AiUsageInfo()
            };
        }

        var sb = new StringBuilder();
        sb.AppendLine("Summarize the following job event history:");
        sb.AppendLine();
        AppendEvents(sb, events);

        var response = await aiClient.SendMessageAsync(
            SummarizationSystemPrompt,
            [new AiMessage { Role = "user", Content = sb.ToString() }],
            settings.Value.MaxTokensPerSummary,
            enableCaching: true,
            ct: ct);

        return new AiSummaryResponse
        {
            Summary = response.TextContent ?? "Unable to generate summary.",
            Usage = new AiUsageInfo
            {
                InputTokens = response.InputTokens,
                OutputTokens = response.OutputTokens
            }
        };
    }

    // ---------------------------------------------------------------------
    //  Structured summaries
    // ---------------------------------------------------------------------

    public async Task<StructuredSummaryResponse> SummarizeJobAsync(int jobId, CancellationToken ct = default)
    {
        var job = await jobRepository.GetSingleJobById(jobId);
        var notes = await noteRepository.GetNotesByJobIdAsync(jobId);
        var eventFilters = new TaskTableFiltersRequest { JobId = jobId, ShowCompleted = true };
        var events = await taskRepository.GetAllTasksAsync(eventFilters);

        if (job == null)
        {
            return EmptyResponse("Job not found.", SummarySeverity.Info);
        }

        var now = DateTimeOffset.UtcNow;
        var signals = AiJobSignalCalculator.Compute(job, notes ?? [], events ?? [], now);

        var sb = new StringBuilder();
        sb.AppendLine($"Generate a job briefing for Job **{job.JobNo}**. Current time: {now:yyyy-MM-dd HH:mm} UTC.");
        sb.AppendLine();

        AppendSignalLines(sb, signals);
        AppendJobDetails(sb, job);
        AppendNotes(sb, notes);
        AppendEvents(sb, events);

        var structured = await SendStructuredRequestAsync(JobBriefingSystemPrompt, sb.ToString(), ct);
        return ClampSeverity(structured, signals.MaxSeverity);
    }

    public async Task<StructuredSummaryResponse> SummarizeTaskDashboardAsync(CancellationToken ct = default)
    {
        var filters = new TaskTableFiltersRequest { ShowCompleted = false };
        var tasks = await taskRepository.GetAllTasksAsync(filters);

        var now = DateTimeOffset.UtcNow;

        if (tasks == null || tasks.Count == 0)
        {
            return new StructuredSummaryResponse
            {
                Verdict = "✅ No open tasks — the queue is clear.",
                Severity = SummarySeverity.Ok,
                KeyFacts = ["0 open"],
                Attention = [],
                Timeline = [],
                Highlights = []
            };
        }

        var ordered = tasks.OrderBy(t => t.DueDate).ToList();
        var overdue = ordered.Where(t => !t.Closed && t.DueDate < now).ToList();
        var dueToday = ordered.Where(t => !t.Closed && t.DueDate >= now && t.DueDate.Date == now.Date).ToList();
        var upcoming = ordered.Where(t => !t.Closed && t.DueDate.Date > now.Date).ToList();

        var signals = new JobSignals
        {
            Items = BuildTaskDashboardSignals(overdue.Count, dueToday.Count, upcoming.Count, ordered.Count)
        };

        var sb = new StringBuilder();
        sb.AppendLine($"Generate a task dashboard briefing. Current time: {now:yyyy-MM-dd HH:mm} UTC.");
        sb.AppendLine($"Open tasks: {ordered.Count}. Overdue: {overdue.Count}. Due today: {dueToday.Count}. Upcoming: {upcoming.Count}.");
        sb.AppendLine();

        AppendSignalLines(sb, signals);

        sb.AppendLine("--- Open tasks (oldest due first) ---");
        foreach (var task in ordered.Take(40))
        {
            var status = task.DueDate < now ? "OVERDUE" : "OPEN";
            var sanitized = AiDataSanitizer.Sanitize(task.Description ?? task.Title);
            var assignee = task.Assignee?.Text ?? "Unassigned";
            sb.AppendLine($"[{task.DueDate:yyyy-MM-dd HH:mm}] Job #{task.JobNumber} - {task.EventType} - {sanitized} [{status}] Assigned: {assignee}");
        }
        if (ordered.Count > 40)
        {
            sb.AppendLine($"... and {ordered.Count - 40} more tasks omitted.");
        }

        var structured = await SendStructuredRequestAsync(TaskBriefingSystemPrompt, sb.ToString(), ct);
        return ClampSeverity(structured, signals.MaxSeverity);
    }

    public async Task<StructuredSummaryResponse> SummarizeOperationsAsync(CancellationToken ct = default)
    {
        var stats = await jobRepository.GetOverviewStatsAsync();

        var now = DateTimeOffset.UtcNow;
        var sb = new StringBuilder();
        sb.AppendLine($"Generate an operations health briefing. Current time: {now:yyyy-MM-dd HH:mm} UTC.");
        sb.AppendLine();
        sb.AppendLine($"Active jobs:    {stats.Active}");
        sb.AppendLine($"Inactive jobs:  {stats.Inactive}");
        sb.AppendLine($"Completed jobs: {stats.Completed}");
        sb.AppendLine($"Total jobs:     {stats.Active + stats.Inactive + stats.Completed}");

        var signals = new JobSignals { Items = BuildOperationsSignals(stats) };
        sb.AppendLine();
        AppendSignalLines(sb, signals);

        var structured = await SendStructuredRequestAsync(OperationsSystemPrompt, sb.ToString(), ct);
        return ClampSeverity(structured, signals.MaxSeverity);
    }

    public async Task<StructuredSummaryResponse> SummarizeComplianceAsync(CancellationToken ct = default)
    {
        var request = new CourierComplianceFilterRequest();
        var items = await courierRepository.GetCourierComplianceForExportAsync(request);

        if (items is not { Count: > 0 })
        {
            return new StructuredSummaryResponse
            {
                Verdict = "✅ No compliance records found.",
                Severity = SummarySeverity.Ok,
                KeyFacts = ["0 records"],
                Attention = [],
                Timeline = [],
                Highlights = []
            };
        }

        var now = DateTimeOffset.UtcNow;
        var weekCutoff = now.AddDays(7);
        var monthCutoff = now.AddDays(30);
        var expired = new List<CourierComplianceViewModel>();
        var expiringWeek = new List<CourierComplianceViewModel>();
        var expiringMonth = new List<CourierComplianceViewModel>();

        foreach (var i in items)
        {
            if (!i.ExpiryDate.HasValue)
            {
                continue;
            }

            if (i.ExpiryDate.Value < now)
            {
                expired.Add(i);
            }
            else if (i.ExpiryDate.Value < weekCutoff)
            {
                expiringWeek.Add(i);
            }
            else if (i.ExpiryDate.Value < monthCutoff)
            {
                expiringMonth.Add(i);
            }
        }

        var signals = new JobSignals
        {
            Items = BuildComplianceSignals(expired.Count, expiringWeek.Count, expiringMonth.Count)
        };

        var sb = new StringBuilder();
        sb.AppendLine($"Generate a compliance risk briefing. Current date: {now:yyyy-MM-dd}.");
        sb.AppendLine($"Total records: {items.Count}. Expired: {expired.Count}. ≤7d: {expiringWeek.Count}. ≤30d: {expiringMonth.Count}.");
        sb.AppendLine();

        AppendSignalLines(sb, signals);

        if (expired.Count > 0)
        {
            sb.AppendLine("--- EXPIRED items ---");
            foreach (var item in expired.Take(20))
            {
                sb.AppendLine($"  - {item.Name} ({item.Code}): {item.ComplianceType} expired {item.ExpiryDate:yyyy-MM-dd}");
            }
            if (expired.Count > 20)
            {
                sb.AppendLine($"  ... and {expired.Count - 20} more");
            }

            sb.AppendLine();
        }

        if (expiringWeek.Count > 0)
        {
            sb.AppendLine("--- Expiring within 7 days ---");
            foreach (var item in expiringWeek.Take(10))
            {
                sb.AppendLine($"  - {item.Name} ({item.Code}): {item.ComplianceType} expires {item.ExpiryDate:yyyy-MM-dd}");
            }
            if (expiringWeek.Count > 10)
            {
                sb.AppendLine($"  ... and {expiringWeek.Count - 10} more");
            }

            sb.AppendLine();
        }

        if (expiringMonth.Count > 0)
        {
            sb.AppendLine($"--- Expiring within 30 days: {expiringMonth.Count} item(s) ---");
        }

        var structured = await SendStructuredRequestAsync(ComplianceSystemPrompt, sb.ToString(), ct);
        return ClampSeverity(structured, signals.MaxSeverity);
    }

    // ---------------------------------------------------------------------
    //  Helpers
    // ---------------------------------------------------------------------

    private async Task<StructuredSummaryResponse> SendStructuredRequestAsync(
        string systemPrompt,
        string userMessage,
        CancellationToken ct)
    {
        var tools = new List<AiToolDefinition>
        {
            new()
            {
                Name = EmitSummaryToolName,
                Description = "Emit the structured summary that will be rendered as the dispatcher's briefing card.",
                InputSchemaJson = EmitSummarySchema
            }
        };

        var response = await aiClient.SendMessageAsync(
            systemPrompt,
            [new AiMessage { Role = "user", Content = userMessage }],
            settings.Value.MaxTokensPerSummary,
            tools,
            forceToolName: EmitSummaryToolName,
            enableCaching: true,
            ct: ct);

        var usage = new AiUsageInfo
        {
            InputTokens = response.InputTokens,
            OutputTokens = response.OutputTokens
        };

        var toolCall = response.ToolCalls.FirstOrDefault(t => t.ToolName == EmitSummaryToolName);
        if (toolCall == null || string.IsNullOrWhiteSpace(toolCall.ArgumentsJson))
        {
            return EmptyResponse("Unable to generate summary.", SummarySeverity.Info) with { Usage = usage };
        }

        try
        {
            var parsed = JsonSerializer.Deserialize<StructuredSummaryResponse>(
                toolCall.ArgumentsJson, ToolJsonOptions);
            if (parsed == null)
            {
                return EmptyResponse("Unable to parse AI summary.", SummarySeverity.Info) with { Usage = usage };
            }
            return parsed with { Usage = usage };
        }
        catch (JsonException)
        {
            return EmptyResponse("Unable to parse AI summary.", SummarySeverity.Info) with { Usage = usage };
        }
    }

    private static StructuredSummaryResponse EmptyResponse(string verdict, SummarySeverity severity) =>
        new()
        {
            Verdict = verdict,
            Severity = severity,
            KeyFacts = [],
            Attention = [],
            Timeline = [],
            Highlights = []
        };

    private static StructuredSummaryResponse ClampSeverity(StructuredSummaryResponse response, SummarySeverity floor)
    {
        if (response.Severity >= floor)
        {
            return response;
        }

        return response with { Severity = floor };
    }

    private static void AppendSignalLines(StringBuilder sb, JobSignals signals)
    {
        if (signals.Items.Count == 0)
        {
            sb.AppendLine("SIGNAL [OK]: no problem signals detected");
            sb.AppendLine();
            return;
        }
        foreach (var line in signals.Lines)
        {
            sb.AppendLine(line);
        }
        sb.AppendLine();
    }

    private static void AppendNotes(StringBuilder sb, IReadOnlyList<TucNoteViewModel> notes)
    {
        if (notes is not { Count: > 0 })
        {
            return;
        }

        sb.AppendLine($"--- Notes ({notes.Count}{(notes.Count > MaxNotesInPrompt ? ", most recent first" : "")}) ---");
        var ordered = notes.OrderByDescending(n => n.CreatedDate).Take(MaxNotesInPrompt).ToList();
        foreach (var note in ordered.OrderBy(n => n.CreatedDate))
        {
            var sanitized = AiDataSanitizer.Sanitize(note.NoteText ?? string.Empty);
            var important = note.IsImportant ? " IMPORTANT" : string.Empty;
            sb.AppendLine($"[{note.CreatedDate:yyyy-MM-dd HH:mm}] ({note.NoteTypeName}{important}) by {note.CreatedByName}: {sanitized}");
        }
        if (notes.Count > MaxNotesInPrompt)
        {
            sb.AppendLine($"... ({notes.Count - MaxNotesInPrompt} older notes omitted)");
        }
        sb.AppendLine();
    }

    private static void AppendEvents(StringBuilder sb, IReadOnlyList<TaskViewModel> events)
    {
        if (events is not { Count: > 0 })
        {
            return;
        }

        sb.AppendLine($"--- Events / tasks ({events.Count}) ---");
        var ordered = events.OrderByDescending(e => e.DueDate).Take(MaxEventsInPrompt).ToList();
        foreach (var evt in ordered.OrderBy(e => e.DueDate))
        {
            var status = evt.Closed ? "CLOSED" : "OPEN";
            var sanitized = AiDataSanitizer.Sanitize(evt.Description ?? evt.Title ?? string.Empty);
            sb.AppendLine($"[{evt.DueDate:yyyy-MM-dd HH:mm}] {evt.EventType} - {sanitized} [{status}]");
        }
        if (events.Count > MaxEventsInPrompt)
        {
            sb.AppendLine($"... ({events.Count - MaxEventsInPrompt} older events omitted)");
        }
        sb.AppendLine();
    }

    private static void AppendJobDetails(StringBuilder sb, JobViewModel job)
    {
        sb.AppendLine("--- Job details ---");
        sb.AppendLine($"Job No: {job.JobNo}");
        sb.AppendLine($"Status: {job.Status ?? job.StatusName ?? "?"}");
        if (!string.IsNullOrWhiteSpace(job.SpeedName))
        {
            sb.AppendLine($"Speed: {job.SpeedName}");
        }

        if (!string.IsNullOrWhiteSpace(job.ClientName))
        {
            sb.AppendLine($"Client: {job.ClientName}");
        }
        else if (!string.IsNullOrWhiteSpace(job.Client))
        {
            sb.AppendLine($"Client: {job.Client}");
        }

        if (!string.IsNullOrWhiteSpace(job.Courier))
        {
            sb.AppendLine($"Courier: {job.Courier}");
        }
        else if (!string.IsNullOrWhiteSpace(job.AssignedCourier?.Text))
        {
            sb.AppendLine($"Courier: {job.AssignedCourier.Text}");
        }

        if (!string.IsNullOrWhiteSpace(job.PartnerTenantName))
        {
            sb.AppendLine($"Partner tenant: {job.PartnerTenantName}");
        }

        // Booleans of interest
        var flags = new List<string>();
        if (job.Done == true)
        {
            flags.Add("done");
        }

        if (job.Void == true)
        {
            flags.Add("void");
        }

        if (job.IsArchived)
        {
            flags.Add("archived");
        }

        if (job.Reprice == true)
        {
            flags.Add("reprice");
        }

        if (job.Locked == true)
        {
            flags.Add("locked");
        }

        if (job.Attention == true)
        {
            flags.Add("attention");
        }

        if (job.IsBulkJob)
        {
            flags.Add("bulk");
        }

        if (job.PreBook == true)
        {
            flags.Add("recurring");
        }

        if (job.IsPartnerJob)
        {
            flags.Add("partner");
        }

        if (job.Direct == true)
        {
            flags.Add("direct");
        }

        if (job.Truck == true)
        {
            flags.Add("truck");
        }

        if (job.Van)
        {
            flags.Add("van");
        }

        if (job.TailLiftPu)
        {
            flags.Add("tail-lift PU");
        }

        if (job.TailLiftDo)
        {
            flags.Add("tail-lift DO");
        }

        if (job.DeliverToPrivateRes)
        {
            flags.Add("private residence");
        }

        if (flags.Count > 0)
        {
            sb.AppendLine("Flags: " + string.Join(", ", flags));
        }

        // Addresses
        var fromAddr = AiDataSanitizer.Sanitize(job.PickupAddress?.FullAddress ?? job.From ?? "");
        var toAddr = AiDataSanitizer.Sanitize(job.DeliveryAddress?.FullAddress ?? job.ToAddress ?? "");
        if (!string.IsNullOrWhiteSpace(fromAddr))
        {
            sb.AppendLine($"From: {fromAddr}");
        }

        if (!string.IsNullOrWhiteSpace(toAddr))
        {
            sb.AppendLine($"To:   {toAddr}");
        }

        if (!string.IsNullOrWhiteSpace(job.PickUpTimeZone?.Text))
        {
            sb.AppendLine($"Pickup TZ: {job.PickUpTimeZone.Text}");
        }

        if (!string.IsNullOrWhiteSpace(job.DeliveryTimeZone?.Text))
        {
            sb.AppendLine($"Delivery TZ: {job.DeliveryTimeZone.Text}");
        }

        if (job.Distance > 0)
        {
            sb.AppendLine($"Distance: {job.Distance:N1}");
        }

        // Contacts (sanitised)
        if (!string.IsNullOrWhiteSpace(job.FromContactName))
        {
            sb.AppendLine($"PU contact: {job.FromContactName}");
        }

        if (!string.IsNullOrWhiteSpace(job.FromContactNumber))
        {
            sb.AppendLine($"PU phone: {AiDataSanitizer.Sanitize(job.FromContactNumber)}");
        }

        if (!string.IsNullOrWhiteSpace(job.DeliverToContact))
        {
            sb.AppendLine($"DO contact: {job.DeliverToContact}");
        }

        if (!string.IsNullOrWhiteSpace(job.ToContactPhone))
        {
            sb.AppendLine($"DO phone: {AiDataSanitizer.Sanitize(job.ToContactPhone)}");
        }

        // Schedule
        if (job.Booked.HasValue)
        {
            sb.AppendLine($"Booked:        {job.Booked:yyyy-MM-dd HH:mm}");
        }

        if (job.CreatedDate.HasValue)
        {
            sb.AppendLine($"Created:       {job.CreatedDate:yyyy-MM-dd HH:mm}");
        }

        if (job.DispatchTime.HasValue)
        {
            sb.AppendLine($"Dispatched:    {job.DispatchTime:yyyy-MM-dd HH:mm}");
        }

        if (job.PuTime.HasValue)
        {
            sb.AppendLine($"PU scheduled:  {job.PuTime:yyyy-MM-dd HH:mm}");
        }

        if (job.PickupArrivalTime.HasValue)
        {
            sb.AppendLine($"PU arrived:    {job.PickupArrivalTime:yyyy-MM-dd HH:mm}");
        }

        if (job.DeliverByTime.HasValue)
        {
            sb.AppendLine($"Deliver by:    {job.DeliverByTime:yyyy-MM-dd HH:mm}");
        }

        if (job.DeliveryArrivalTime.HasValue)
        {
            sb.AppendLine($"DO arrived:    {job.DeliveryArrivalTime:yyyy-MM-dd HH:mm}");
        }

        if (job.CompletedTime.HasValue)
        {
            sb.AppendLine($"Completed:     {job.CompletedTime:yyyy-MM-dd HH:mm}");
        }

        if (job.FollowupTime.HasValue)
        {
            sb.AppendLine($"Follow-up:     {job.FollowupTime:yyyy-MM-dd HH:mm}");
        }

        // Parcel
        if (job.Size?.Text is { Length: > 0 } size)
        {
            sb.AppendLine($"Size: {size}");
        }

        if (job.Weight is > 0)
        {
            sb.AppendLine($"Weight: {job.Weight}");
        }

        if (job.Items > 0)
        {
            sb.AppendLine($"Items: {job.Items}");
        }

        if (job.ParcelDimensions is { Count: > 0 } pd)
        {
            sb.AppendLine($"Parcel dimension rows: {pd.Count}");
        }

        if (job.DgClass is > 0)
        {
            sb.AppendLine($"DG class: {job.DgClass}");
        }

        if (job.DgDocumentation == true)
        {
            sb.AppendLine("DG documentation: yes");
        }

        if (!string.IsNullOrWhiteSpace(job.SigNotRequired))
        {
            sb.AppendLine($"Leave/sig: {job.SigNotRequired}");
        }

        if (!string.IsNullOrWhiteSpace(job.Barcode))
        {
            sb.AppendLine($"Barcode: {job.Barcode}");
        }

        // Pallets
        if (job.PalletInfo is { Count: > 0 } pallets)
        {
            var totalQty = pallets.Sum(p => p.Quantity);
            var totalWeight = pallets.Sum(p => p.Weight);
            sb.AppendLine($"Pallets: {pallets.Count} row(s), total qty {totalQty}, total weight {totalWeight.ToString("N1", CultureInfo.InvariantCulture)}");
        }

        // References / pricing
        if (!string.IsNullOrWhiteSpace(job.RefA))
        {
            sb.AppendLine($"Ref A: {job.RefA}");
        }

        if (!string.IsNullOrWhiteSpace(job.RefB))
        {
            sb.AppendLine($"Ref B: {job.RefB}");
        }

        if (!string.IsNullOrWhiteSpace(job.OurRef))
        {
            sb.AppendLine($"Our Ref: {job.OurRef}");
        }

        if (!string.IsNullOrWhiteSpace(job.ConNote))
        {
            sb.AppendLine($"Con Note: {job.ConNote}");
        }

        if (!string.IsNullOrWhiteSpace(job.CustomJobName))
        {
            sb.AppendLine($"Custom name: {job.CustomJobName}");
        }

        if (job.Charge.HasValue)
        {
            sb.AppendLine($"Charge: {job.Charge.Value.ToString("N2", CultureInfo.InvariantCulture)}");
        }

        // Flight
        if (job.IsFlightAssigned && job.AssignedFlight != null)
        {
            sb.AppendLine($"Flight: {job.AssignedFlight.FlightNumber}");
            if (job.AssignedFlight.ExpectedDeparture.HasValue)
            {
                sb.AppendLine($"  expected departure: {job.AssignedFlight.ExpectedDeparture:yyyy-MM-dd HH:mm}");
            }

            if (job.AssignedFlight.ExpectedArrival.HasValue)
            {
                sb.AppendLine($"  expected arrival:   {job.AssignedFlight.ExpectedArrival:yyyy-MM-dd HH:mm}");
            }

            if (job.AssignedFlight.FlightSegments?.Count > 0)
            {
                sb.AppendLine($"  segments: {job.AssignedFlight.FlightSegments.Count}");
            }
        }

        // Agent
        if (job.IsAgentAssigned && job.AssignedAgent != null)
        {
            sb.AppendLine($"Agent: {job.AssignedAgent.AgentName}");
        }

        sb.AppendLine();
    }

    private static List<JobSignal> BuildTaskDashboardSignals(int overdue, int dueToday, int upcoming, int total)
    {
        var signals = new List<JobSignal>();
        if (overdue == 0 && dueToday == 0)
        {
            signals.Add(new JobSignal(SummarySeverity.Ok, $"{total} open task(s); none overdue or due today"));
            return signals;
        }
        if (overdue > 0)
        {
            var severity = overdue >= 5 ? SummarySeverity.Critical
                : overdue >= 2 ? SummarySeverity.Urgent
                : SummarySeverity.Caution;
            signals.Add(new JobSignal(severity, $"{overdue} task(s) overdue across all open jobs"));
        }
        if (dueToday > 0)
        {
            signals.Add(new JobSignal(SummarySeverity.Caution, $"{dueToday} task(s) due today"));
        }
        if (upcoming > 0)
        {
            signals.Add(new JobSignal(SummarySeverity.Info, $"{upcoming} task(s) upcoming"));
        }
        return signals;
    }

    private static List<JobSignal> BuildOperationsSignals(OverviewStatsViewModel stats)
    {
        var signals = new List<JobSignal>();
        var total = stats.Active + stats.Inactive + stats.Completed;
        if (total == 0)
        {
            signals.Add(new JobSignal(SummarySeverity.Info, "no jobs in the system right now"));
            return signals;
        }
        if (stats.Active > 0 && stats.Inactive > stats.Active)
        {
            signals.Add(new JobSignal(SummarySeverity.Urgent,
                $"inactive ({stats.Inactive}) exceeds active ({stats.Active}) — investigate stuck jobs"));
        }
        else if (stats.Active > 0 && stats.Inactive * 2 > stats.Active)
        {
            signals.Add(new JobSignal(SummarySeverity.Caution,
                $"inactive ({stats.Inactive}) is more than half of active ({stats.Active})"));
        }
        else
        {
            signals.Add(new JobSignal(SummarySeverity.Ok,
                $"{stats.Active} active, {stats.Inactive} inactive, {stats.Completed} completed"));
        }
        return signals;
    }

    private static List<JobSignal> BuildComplianceSignals(int expired, int week, int month)
    {
        var signals = new List<JobSignal>();
        if (expired > 0)
        {
            signals.Add(new JobSignal(SummarySeverity.Critical,
                $"{expired} compliance item(s) EXPIRED — drivers should be blocked from dispatch"));
        }
        if (week > 0)
        {
            signals.Add(new JobSignal(SummarySeverity.Urgent,
                $"{week} compliance item(s) expire within 7 days"));
        }
        if (month > 0)
        {
            signals.Add(new JobSignal(SummarySeverity.Caution,
                $"{month} compliance item(s) expire within 30 days"));
        }
        if (signals.Count == 0)
        {
            signals.Add(new JobSignal(SummarySeverity.Ok, "no expiring or expired compliance items"));
        }
        return signals;
    }
}
