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
using Serilog;

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
          "maxLength": 120,
          "description": "Single-sentence headline rendered first and largest on the card."
        },
        "severity": {
          "type": "string",
          "enum": ["Ok", "Info", "Caution", "Urgent", "Critical"],
          "description": "Overall severity, which colours the whole card. Ok=healthy, Info=informational, Caution=worth knowing, Urgent=acting within the hour, Critical=immediate."
        },
        "keyFacts": {
          "type": "array",
          "items": { "type": "string", "maxLength": 25 },
          "maxItems": 6,
          "description": "At-a-glance chips rendered in a fixed-width row; one short value each, no label prefix."
        },
        "attention": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "headline": { "type": "string", "description": "The problem." },
              "action":   { "type": "string", "description": "The next step, phrased as an instruction." },
              "severity": { "type": "string", "enum": ["Ok", "Info", "Caution", "Urgent", "Critical"] }
            },
            "required": ["headline", "action", "severity"]
          },
          "description": "Items needing dispatcher action, most urgent first. Empty array if nothing needs attention."
        },
        "timeline": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "label":  { "type": "string", "description": "Milestone name." },
              "detail": { "type": "string", "description": "Elapsed or remaining time relative to now (e.g. '4h ago', 'on time', 'overdue 2h'), never an absolute timestamp." },
              "status": { "type": "string", "enum": ["Ok", "Pending", "Warning", "Late"], "description": "Ok=on plan, Pending=upcoming, Warning=at risk, Late=missed." }
            },
            "required": ["label", "detail", "status"]
          },
          "maxItems": 4,
          "description": "Chronological milestones, oldest first. Empty array if not applicable."
        },
        "highlights": {
          "type": "array",
          "items": { "type": "string" },
          "maxItems": 4,
          "description": "Notable observations that did not warrant an attention item. Empty array if nothing is notable."
        }
      },
      "required": ["verdict", "severity", "keyFacts", "attention", "timeline", "highlights"]
    }
    """;

    private string RegionContext => tenantInfo.IsUsTenant()
        ? "a US-based courier dispatch company"
        : "a New Zealand courier dispatch company";

    private string CurrencyExample => tenantInfo.IsUsTenant() ? "$145" : "$145 NZD";

    /// <summary>
    /// Rules every structured briefing needs. Each briefing is its own independent
    /// request, so a prompt that only says "rules: same as the job briefing" is
    /// referring to text the model never sees — this block has to be concatenated in.
    /// </summary>
    private const string SharedBriefingRules =
        """
        Shared rules:
        - The SIGNAL: lines in the user message are computed by the application and are the
          source of truth for every count, deadline and elapsed time. Trust them over your
          own reading of the raw data beneath them.
        - Never state a fact the data does not contain, and never soften one it does.
        - Omit anything whose data is missing rather than writing "Unknown" or "-".
        - Phone numbers and emails arrive already redacted as [PHONE] and [EMAIL]. Leave
          the placeholders exactly as they are.
        - Every action is an imperative verb plus who or what it applies to, concrete
          enough for the dispatcher to carry out without reopening the job.
        """;

    private string JobBriefingSystemPrompt =>
        $"""
         You are a logistics job briefing assistant for {RegionContext}.
         Your audience is a busy dispatcher who has FIVE SECONDS to decide what to do
         next on this job.

         How to choose the content of each field:

         VERDICT — Lead with the most urgent fact and a severity emoji (🚨 ⚠️ ✅).
           Examples: "🚨 Overdue for delivery by 2h — courier assigned, no recent update",
           "✅ On track — picked up 10m ago", "⚠️ No courier assigned and pickup due in 20m".

         SEVERITY — Match the highest SIGNAL severity in the user message; never lower it.
           Critical = deadline missed >1h or money/safety at risk.
           Urgent   = deadline missed <1h or will be missed within the hour.
           Caution  = problem worth knowing about, not yet urgent.
           Info     = informational only.
           Ok       = healthy / complete.

         KEY FACTS — Pick the chips that matter most, in this order where the data exists:
           Client • Speed • From→To • Charge • Courier • Ref.
           Use "→" between origin and destination, and the local currency format
           (e.g. {CurrencyExample}).

         ATTENTION — Things the dispatcher must DO, most urgent first. Give each item a
           headline carrying the concrete number, time or name, and an action they can
           execute as written. Leave empty when nothing needs doing.

         TIMELINE — Milestones oldest first, labelled with the actual milestone name from
           the data ("Booked", "Dispatched", "Picked up", "Delivery"). Skip milestones that
           have not happened and are not due soon.

         HIGHLIGHTS — The most useful observations from the notes and events
           (e.g. "Customer requested call before delivery", "Tail-lift unavailable at PU").
           Skip when nothing is notable.

         If the job is healthy or completed cleanly: verdict ≈ "✅ Delivered — no action
         needed", severity = Ok, attention = [].

         {SharedBriefingRules}
         """;

    private string TaskBriefingSystemPrompt =>
        $"""
         You are a dispatch shift-briefing assistant for {RegionContext}.
         Your audience: a dispatcher arriving for their shift. They want to know in FIVE
         SECONDS how their queue looks.

         VERDICT — One sentence describing the SHIFT POSTURE.
           Examples: "🚨 Heavy load: 12 open tasks, 5 overdue", "✅ Light morning: 3 tasks,
           all due later".

         SEVERITY — Match the highest SIGNAL severity. Critical or Urgent only when
           something is already overdue.

         KEY FACTS — The queue counts, e.g. "12 open", "5 overdue", "4 due today".

         ATTENTION — The three things to action first, ordered by urgency. Each headline
           names the specific job ("Job J12345 — pickup overdue 45m").

         TIMELINE — Return an empty array; a queue has no single chronology.

         HIGHLIGHTS — Patterns across the queue (e.g. "Most overdue are 3rd-party
           deliveries", "Smith has 4 open tasks").

         {SharedBriefingRules}
         """;

    private string OperationsSystemPrompt =>
        $"""
         You are a dispatch operations health analyst for {RegionContext}.
         Audience: the ops lead. They want a one-line read on whether the fleet is healthy
         right now.

         VERDICT — One sentence on overall health ("✅ Operations running normally with N
           active jobs", "⚠️ Inactive count unusually high").

         SEVERITY — Critical only when something demands immediate intervention.

         KEY FACTS — The headline counts: "X active", "Y inactive", "Z completed",
           "Total N".

         ATTENTION — Anomalies a human should decide about, each with the number that
           makes it an anomaly and the action to take ("Audit the 35% of jobs sitting
           inactive for stuck dispatches"). Empty when the numbers look normal.

         TIMELINE — Return an empty array.

         HIGHLIGHTS — How this compares with the typical pattern, and time-of-day context.

         {SharedBriefingRules}
         """;

    private string ComplianceSystemPrompt =>
        $"""
         You are a fleet compliance risk briefing assistant for {RegionContext}.
         Audience: a fleet manager. They want to know which drivers to chase TODAY.

         VERDICT — Risk level plus the headline number ("🚨 12 drivers with expired
           compliance items", "✅ Fleet compliant").

         SEVERITY — Critical if anything is expired; Urgent if anything expires within
           7 days; Caution if anything expires within 30 days; Ok otherwise.

         KEY FACTS — "X expired", "Y expiring ≤7d", "Z expiring ≤30d".

         ATTENTION — One item per at-risk record, most critical first, up to eight. Each
           headline gives the driver name, the item type, and how long it has been expired
           or how long until it expires. Each action is the control to apply
           ("Suspend until renewed", "Email reminder", "Block dispatch").

         TIMELINE — Return an empty array.

         HIGHLIGHTS — Patterns ("3 drivers have multiple expired items", "All expiries are
           in the same compliance category").

         {SharedBriefingRules}
         """;

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
                Description =
                    "Returns the dispatcher briefing card for the data in this request. The card renders as "
                    + "a coloured headline (verdict + severity), a row of short fact chips, a list of items "
                    + "needing action, a milestone timeline, and closing observations. This is the only way to "
                    + "return a result; there is no prose channel. Populate every field, using an empty array "
                    + "for any list that does not apply to this briefing type rather than omitting it. "
                    + "Severity drives the card's colour and the dispatcher's triage order, so it must not sit "
                    + "below the highest severity present in the request's SIGNAL lines.",
                InputSchemaJson = EmitSummarySchema
            }
        };

        var response = await aiClient.SendMessageAsync(
            AiTaskClass.Judgment,
            systemPrompt,
            [new AiMessage { Role = "user", Content = userMessage }],
            settings.Value.Judgment.MaxTokens,
            tools,
            forceToolName: EmitSummaryToolName,
            enableCaching: true,
            cacheResponse: true,
            ct: ct);

        var usage = AiUsageInfo.From(response);

        if (response.WasTruncated)
        {
            Log.Warning("AI summary hit the {MaxTokens}-token ceiling before finishing the tool call",
                settings.Value.Judgment.MaxTokens);
            return EmptyResponse("Summary was cut short — try again.", SummarySeverity.Info) with { Usage = usage };
        }

        if (response.WasRefused)
        {
            Log.Warning("AI summary declined by the model ({Category})", response.RefusalCategory ?? "unspecified");
            return EmptyResponse("Unable to generate summary.", SummarySeverity.Info) with { Usage = usage };
        }

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
        switch (overdue)
        {
            case 0 when dueToday == 0:
                signals.Add(new JobSignal(SummarySeverity.Ok, $"{total} open task(s); none overdue or due today"));
                return signals;
            case > 0:
            {
                var severity = overdue >= 5 ? SummarySeverity.Critical
                    : overdue >= 2 ? SummarySeverity.Urgent
                    : SummarySeverity.Caution;
                signals.Add(new JobSignal(severity, $"{overdue} task(s) overdue across all open jobs"));
                break;
            }
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
