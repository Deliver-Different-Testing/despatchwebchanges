using System.Text;
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
    IJobRepository jobRepository,
    ICourierRepository courierRepository,
    ITenantInfoService tenantInfo,
    IOptions<AnthropicSettings> settings) : IAiSummarizationService
{
    private string RegionContext => tenantInfo.IsUsTenant()
        ? "a US-based courier dispatch company"
        : "a New Zealand courier dispatch company";

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

    private string TaskBriefingSystemPrompt =>
        $"""
        You are a dispatch operations briefing assistant for {RegionContext}.
        Summarize today's task dashboard for a dispatcher starting their shift.
        Write in clear, professional language suitable for busy dispatchers.

        Structure your response with these markdown sections:
        - Start with a **Shift Summary** line (e.g. "**Shift Summary:** X open tasks, Y overdue")
        - **Overdue** — list overdue items with **bold job numbers**, most urgent first
        - **Due Today** — brief count or list of today's tasks
        - **Upcoming** — brief note on future tasks
        - **Suggested Priority** — 2-3 bullet points recommending what to tackle first

        Skip any section that has no relevant data. Keep each section concise.
        """;

    private string JobSummarySystemPrompt =>
        $"""
        You are a logistics job summarizer for {RegionContext}.
        Produce a structured summary with the most important information first.
        Write in clear, professional language suitable for busy dispatchers.

        Format your response using these markdown sections (skip any section with no relevant data):

        **Status** — One line: current job status and courier assignment.
        **Issues** — Bullet points for any problems, complaints, delays, or flags. Most urgent first.
        **Actions** — Bullet points for open follow-ups or pending tasks that need attention.
        **Timeline** — Brief chronological narrative of key milestones (booked, dispatched, picked up, delivered).
        **Notes** — Any other notable staff comments or observations.

        Rules:
        - Use **bold** for job numbers, courier names, statuses, and key details
        - Keep each section concise (1-3 bullet points max)
        - If the job is straightforward with no issues, keep the entire summary to 2-3 lines
        """;

    private string OperationsSystemPrompt =>
        $"""
        You are a dispatch operations analyst for {RegionContext}.
        Interpret the overview statistics and flag anomalies.
        Write in clear, professional language suitable for busy dispatchers.

        Format rules:
        - Start with a **one-line health summary** (e.g. "**Operations running normally** with X active jobs")
        - Use **bold** for key metrics and numbers
        - Compare active/inactive/completed counts, note if inactive jobs are unusually high
        - If action is needed, add a **Recommended Actions** line with bold action items
        - Include the current time context when assessing whether numbers are normal
        - Keep it concise — 2-4 sentences plus action items if needed
        """;

    private string ComplianceSystemPrompt =>
        $"""
        You are a fleet compliance risk analyst for {RegionContext}.
        Summarize the compliance status of the driver fleet.
        Write in clear, professional language suitable for busy dispatchers.

        Format rules:
        - Use severity labels: **CRITICAL** (expired), **URGENT** (expiring within 7 days), **WARNING** (expiring within 30 days)
        - Use **bold** for driver names and compliance item types
        - List items as bullet points grouped by severity, most critical first
        - Flag any drivers with multiple expired items explicitly
        - End with a **Recommended Actions** line summarizing what to do first
        - Keep it concise — skip severity groups that have no items
        """;

    private string LateAlertSystemPrompt =>
        $"""
        You are a dispatch late-alert analyst for {RegionContext}.
        Analyze a late-flagged job and provide a situation assessment.
        Write in clear, professional language suitable for busy dispatchers.

        Structure your response as:
        - **Situation** — How late the job is and remaining SLA window, with key times in **bold**
        - **Recommendation** — A decisive action: **Monitor**, **Contact Courier**, **Reassign**, or **Escalate**

        Be brief (2-3 sentences total). Consider pickup/delivery times and minutes remaining.
        """;

    private string CourierSuggestionSystemPrompt =>
        $"""
        You are a courier assignment advisor for {RegionContext}.
        Given a job's details and available couriers with their workload,
        rank the top 3-5 best couriers for this job.
        Write in clear, professional language suitable for busy dispatchers.

        Format rules:
        - Start with a **Top Pick** summary line (e.g. "**Top Pick:** **John Smith** — lowest workload, good vehicle match")
        - Then a numbered list with **bold courier names** and brief reasoning for each
        - Consider: current job count (prefer lower), vehicle type match, driver status, and availability
        - Keep each entry to one sentence
        """;

    public async Task<AiSummaryResponse> SummarizeJobNotesAsync(int jobId, CancellationToken ct = default)
    {
        var notes = await noteRepository.GetNotesByJobIdAsync(jobId);

        if (notes == null || notes.Count == 0)
            return new AiSummaryResponse
            {
                Summary = "No notes found for this job.",
                Usage = new AiUsageInfo()
            };

        var sb = new StringBuilder();
        sb.AppendLine("Summarize the following job notes:");
        sb.AppendLine();

        foreach (var note in notes.OrderBy(n => n.CreatedDate))
        {
            var sanitized = AiDataSanitizer.Sanitize(note.NoteText);
            sb.AppendLine($"[{note.CreatedDate:yyyy-MM-dd HH:mm}] ({note.NoteTypeName}) by {note.CreatedByName}: {sanitized}");
        }

        var messages = new List<AiMessage>
        {
            new() { Role = "user", Content = sb.ToString() }
        };

        var response = await aiClient.SendMessageAsync(
            SummarizationSystemPrompt,
            messages,
            settings.Value.MaxTokensPerSummary,
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
            return new AiSummaryResponse
            {
                Summary = "No events found for this job.",
                Usage = new AiUsageInfo()
            };

        var sb = new StringBuilder();
        sb.AppendLine("Summarize the following job event history:");
        sb.AppendLine();

        foreach (var evt in events.OrderBy(e => e.DueDate))
        {
            var status = evt.Closed ? "CLOSED" : "OPEN";
            var sanitized = AiDataSanitizer.Sanitize(evt.Description ?? evt.Title);
            sb.AppendLine($"[{evt.DueDate:yyyy-MM-dd HH:mm}] {evt.EventType} - {sanitized} [{status}]");
        }

        var messages = new List<AiMessage>
        {
            new() { Role = "user", Content = sb.ToString() }
        };

        var response = await aiClient.SendMessageAsync(
            SummarizationSystemPrompt,
            messages,
            settings.Value.MaxTokensPerSummary,
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

    public async Task<AiSummaryResponse> SummarizeTaskDashboardAsync(CancellationToken ct = default)
    {
        var filters = new TaskTableFiltersRequest { ShowCompleted = false };
        var tasks = await taskRepository.GetAllTasksAsync(filters);

        if (tasks == null || tasks.Count == 0)
            return new AiSummaryResponse
            {
                Summary = "No open tasks found. The task dashboard is clear.",
                Usage = new AiUsageInfo()
            };

        var now = DateTimeOffset.UtcNow;
        var sb = new StringBuilder();
        sb.AppendLine($"Summarize the following task dashboard. Current time: {now:yyyy-MM-dd HH:mm} UTC.");
        sb.AppendLine($"Total open tasks: {tasks.Count}");
        sb.AppendLine();

        var ordered = tasks.OrderBy(t => t.DueDate).ToList();
        var overdueCount = 0;
        var dueTodayCount = 0;
        var upcomingCount = 0;
        foreach (var task in ordered)
        {
            if (task.Closed) continue;
            if (task.DueDate < now) overdueCount++;
            else if (task.DueDate.Date == now.Date) dueTodayCount++;
            else upcomingCount++;
        }

        sb.AppendLine($"Overdue: {overdueCount}, Due today: {dueTodayCount}, Upcoming: {upcomingCount}");
        sb.AppendLine();

        foreach (var task in ordered)
        {
            var status = task.Closed ? "CLOSED" : task.DueDate < now ? "OVERDUE" : "OPEN";
            var sanitized = AiDataSanitizer.Sanitize(task.Description ?? task.Title);
            var assignee = task.Assignee?.Text ?? "Unassigned";
            sb.AppendLine($"[{task.DueDate:yyyy-MM-dd HH:mm}] Job #{task.JobNumber} - {task.EventType} - {sanitized} [{status}] Assigned: {assignee}");
        }

        return await SendSummarizationRequestAsync(TaskBriefingSystemPrompt, sb.ToString(), ct);
    }

    public async Task<AiSummaryResponse> SummarizeJobAsync(int jobId, CancellationToken ct = default)
    {
        var job = await jobRepository.GetSingleJobById(jobId);
        var notes = await noteRepository.GetNotesByJobIdAsync(jobId);
        var eventFilters = new TaskTableFiltersRequest { JobId = jobId, ShowCompleted = true };
        var events = await taskRepository.GetAllTasksAsync(eventFilters);

        var sb = new StringBuilder();
        sb.AppendLine($"Create a combined chronological summary for Job #{job?.JobNo ?? jobId.ToString()}:");
        sb.AppendLine();

        if (job != null)
        {
            sb.AppendLine("--- Job Details ---");
            sb.AppendLine($"Job Number: {job.JobNo}");
            sb.AppendLine($"Status: {job.Status}");
            sb.AppendLine($"Speed: {job.SpeedName}");
            if (job.Booked.HasValue) sb.AppendLine($"Booked: {job.Booked:yyyy-MM-dd HH:mm}");
            if (job.DispatchTime.HasValue) sb.AppendLine($"Dispatched: {job.DispatchTime:yyyy-MM-dd HH:mm}");
            if (job.PuTime.HasValue) sb.AppendLine($"Picked up: {job.PuTime:yyyy-MM-dd HH:mm}");
            if (job.CompletedTime.HasValue) sb.AppendLine($"Completed: {job.CompletedTime:yyyy-MM-dd HH:mm}");
            sb.AppendLine($"From: {AiDataSanitizer.Sanitize(job.From ?? "")}");
            sb.AppendLine($"To: {AiDataSanitizer.Sanitize(job.ToAddress ?? "")}");
            if (!string.IsNullOrEmpty(job.Courier)) sb.AppendLine($"Courier: {job.Courier}");
            sb.AppendLine();
        }

        if (notes is { Count: > 0 })
        {
            sb.AppendLine("--- Notes ---");
            foreach (var note in notes.OrderBy(n => n.CreatedDate))
            {
                var sanitized = AiDataSanitizer.Sanitize(note.NoteText);
                sb.AppendLine($"[{note.CreatedDate:yyyy-MM-dd HH:mm}] ({note.NoteTypeName}) by {note.CreatedByName}: {sanitized}");
            }
            sb.AppendLine();
        }

        if (events is { Count: > 0 })
        {
            sb.AppendLine("--- Events ---");
            foreach (var evt in events.OrderBy(e => e.DueDate))
            {
                var status = evt.Closed ? "CLOSED" : "OPEN";
                var sanitized = AiDataSanitizer.Sanitize(evt.Description ?? evt.Title);
                sb.AppendLine($"[{evt.DueDate:yyyy-MM-dd HH:mm}] {evt.EventType} - {sanitized} [{status}]");
            }
        }

        if (job == null && (notes == null || notes.Count == 0) && (events == null || events.Count == 0))
            return new AiSummaryResponse
            {
                Summary = "No data found for this job.",
                Usage = new AiUsageInfo()
            };

        return await SendSummarizationRequestAsync(JobSummarySystemPrompt, sb.ToString(), ct);
    }

    public async Task<AiSummaryResponse> SummarizeOperationsAsync(CancellationToken ct = default)
    {
        var stats = await jobRepository.GetOverviewStatsAsync();

        var now = DateTimeOffset.UtcNow;
        var sb = new StringBuilder();
        sb.AppendLine($"Analyze the following dispatch operations overview. Current time: {now:yyyy-MM-dd HH:mm} UTC.");
        sb.AppendLine();
        sb.AppendLine($"Active jobs: {stats.Active}");
        sb.AppendLine($"Inactive jobs: {stats.Inactive}");
        sb.AppendLine($"Completed jobs: {stats.Completed}");
        sb.AppendLine($"Total: {stats.Active + stats.Inactive + stats.Completed}");

        return await SendSummarizationRequestAsync(OperationsSystemPrompt, sb.ToString(), ct);
    }

    public async Task<AiSummaryResponse> SummarizeComplianceAsync(CancellationToken ct = default)
    {
        var request = new CourierComplianceFilterRequest();
        var items = await courierRepository.GetCourierComplianceForExportAsync(request);

        if (items == null || items.Count == 0)
            return new AiSummaryResponse
            {
                Summary = "No compliance records found.",
                Usage = new AiUsageInfo()
            };

        var now = DateTimeOffset.UtcNow;
        var weekCutoff = now.AddDays(7);
        var monthCutoff = now.AddDays(30);
        var expired = new List<CourierComplianceViewModel>();
        var expiringWeek = new List<CourierComplianceViewModel>();
        var expiringMonth = new List<CourierComplianceViewModel>();
        foreach (var i in items)
        {
            if (!i.ExpiryDate.HasValue) continue;
            if (i.ExpiryDate.Value < now) expired.Add(i);
            else if (i.ExpiryDate.Value < weekCutoff) expiringWeek.Add(i);
            else if (i.ExpiryDate.Value < monthCutoff) expiringMonth.Add(i);
        }

        var sb = new StringBuilder();
        sb.AppendLine($"Analyze the following driver compliance data. Current date: {now:yyyy-MM-dd}.");
        sb.AppendLine($"Total records: {items.Count}");
        sb.AppendLine($"Expired: {expired.Count}, Expiring within 7 days: {expiringWeek.Count}, Expiring within 30 days: {expiringMonth.Count}");
        sb.AppendLine();

        if (expired.Count > 0)
        {
            sb.AppendLine("EXPIRED items:");
            foreach (var item in expired.Take(20)) sb.AppendLine($"  - {item.Name} ({item.Code}): {item.ComplianceType} expired {item.ExpiryDate:yyyy-MM-dd}");
            if (expired.Count > 20) sb.AppendLine($"  ... and {expired.Count - 20} more");
            sb.AppendLine();
        }

        if (expiringWeek.Count <= 0)
            return await SendSummarizationRequestAsync(ComplianceSystemPrompt, sb.ToString(), ct);
        
        sb.AppendLine("Expiring within 7 DAYS:");
        foreach (var item in expiringWeek.Take(10))
            sb.AppendLine($"  - {item.Name} ({item.Code}): {item.ComplianceType} expires {item.ExpiryDate:yyyy-MM-dd}");
        if (expiringWeek.Count > 10) sb.AppendLine($"  ... and {expiringWeek.Count - 10} more");

        return await SendSummarizationRequestAsync(ComplianceSystemPrompt, sb.ToString(), ct);
    }

    public async Task<AiSummaryResponse> AnalyzeLateAlertAsync(int jobId, CancellationToken ct = default)
    {
        var lateInfo = await jobRepository.GetJobForLateCallAsync(jobId);

        if (lateInfo == null)
            return new AiSummaryResponse
            {
                Summary = "No late alert data found for this job.",
                Usage = new AiUsageInfo()
            };

        var eventFilters = new TaskTableFiltersRequest { JobId = jobId, ShowCompleted = true };
        var events = await taskRepository.GetAllTasksAsync(eventFilters);

        var sb = new StringBuilder();
        sb.AppendLine($"Analyze this late alert for Job #{jobId}:");
        sb.AppendLine($"Job time: {lateInfo.JobTime:yyyy-MM-dd HH:mm}");
        sb.AppendLine($"Booked speed: {lateInfo.BookedSpeed}");
        sb.AppendLine($"Notified speed: {lateInfo.NotifiedSpeed}");
        sb.AppendLine($"Minutes remaining: {lateInfo.MinutesRemaining}");
        sb.AppendLine($"Pickup time allowed: {lateInfo.PickupTime} mins");
        sb.AppendLine($"Delivery time allowed: {lateInfo.DeliveryTime} mins");
        sb.AppendLine($"Late pickup alert threshold: {lateInfo.AlertLatePickup} mins");
        sb.AppendLine($"Late delivery alert threshold: {lateInfo.AlertLateDelivery} mins");

        if (events is not { Count: > 0 })
            return await SendSummarizationRequestAsync(LateAlertSystemPrompt, sb.ToString(), ct);
        
        sb.AppendLine();
        sb.AppendLine("Recent events:");
        foreach (var evt in events.OrderByDescending(e => e.DueDate).Take(5))
        {
            var sanitized = AiDataSanitizer.Sanitize(evt.Description ?? evt.Title);
            sb.AppendLine($"  [{evt.DueDate:HH:mm}] {evt.EventType} - {sanitized}");
        }

        return await SendSummarizationRequestAsync(LateAlertSystemPrompt, sb.ToString(), ct);
    }

    public async Task<AiCourierSuggestionResponse> SuggestCouriersAsync(int jobId, CancellationToken ct = default)
    {
        var job = await jobRepository.GetSingleJobById(jobId);
        if (job == null)
            return new AiCourierSuggestionResponse
            {
                Summary = "Job not found.",
                Usage = new AiUsageInfo()
            };

        var potentialCouriers = await courierRepository.GetPotentialCouriersAsync(jobId);
        var driverOverview = await courierRepository.GetDriverWorkOverviewAsync();

        var sb = new StringBuilder();
        sb.AppendLine($"Suggest the best couriers for Job #{job.JobNo}:");
        sb.AppendLine($"Speed: {job.SpeedName}");
        sb.AppendLine($"Pickup: {AiDataSanitizer.Sanitize(job.From ?? "")}");
        sb.AppendLine($"Delivery: {AiDataSanitizer.Sanitize(job.ToAddress ?? "")}");
        if (job.Weight.HasValue) sb.AppendLine($"Weight: {job.Weight}kg");
        sb.AppendLine();

        if (potentialCouriers is { Count: > 0 })
        {
            sb.AppendLine("Potential couriers (from system matching):");
            foreach (var c in potentialCouriers.Take(10)) sb.AppendLine($"  - {c.FirstName} ({c.Code}): {c.Reason}");
            sb.AppendLine();
        }

        if (driverOverview is { Count: > 0 })
        {
            sb.AppendLine("Driver workload overview:");
            foreach (var d in driverOverview.Take(15)) sb.AppendLine($"  - {d.Name}: {d.VehicleType}, {d.JobCount} active jobs, Status: {d.DriverStatusText}");
        }

        if ((potentialCouriers == null || potentialCouriers.Count == 0) && (driverOverview == null || driverOverview.Count == 0))
            return new AiCourierSuggestionResponse
            {
                Summary = "No courier data available for suggestions.",
                Usage = new AiUsageInfo()
            };

        var summaryResult = await SendSummarizationRequestAsync(CourierSuggestionSystemPrompt, sb.ToString(), ct);

        var courierList = (potentialCouriers ?? [])
            .Take(10)
            .Select(c => new SuggestedCourier
            {
                CourierId = c.CourierId,
                Code = c.Code,
                FirstName = c.FirstName
            })
            .ToList();

        return new AiCourierSuggestionResponse
        {
            Summary = summaryResult.Summary,
            Usage = summaryResult.Usage,
            Couriers = courierList
        };
    }

    private async Task<AiSummaryResponse> SendSummarizationRequestAsync(string systemPrompt, string userMessage, CancellationToken ct)
    {
        var messages = new List<AiMessage>
        {
            new() { Role = "user", Content = userMessage }
        };

        var response = await aiClient.SendMessageAsync(
            systemPrompt,
            messages,
            settings.Value.MaxTokensPerSummary,
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
}
