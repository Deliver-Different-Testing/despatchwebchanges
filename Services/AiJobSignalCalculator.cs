using DespatchWeb.Models;
using DespatchWeb.Models.Response;

namespace DespatchWeb.Services;

public sealed record JobSignal(SummarySeverity Severity, string Line);

public sealed class JobSignals
{
    public List<JobSignal> Items { get; init; } = [];

    public SummarySeverity MaxSeverity =>
        Items.Count == 0 ? SummarySeverity.Ok : Items.Max(s => s.Severity);

    public IEnumerable<string> Lines =>
        Items.Select(s => $"SIGNAL [{s.Severity.ToString().ToUpper()}]: {s.Line}");
}

/// <summary>
/// Pure-function heuristic signal calculator. Pre-computes the salient
/// "what's wrong with this job" flags so the LLM can focus on phrasing and
/// prioritising rather than doing date arithmetic. Each signal carries a
/// minimum severity that the LLM is instructed to respect.
/// </summary>
public static class AiJobSignalCalculator
{
    public static JobSignals Compute(
        JobViewModel job,
        IReadOnlyList<TucNoteViewModel> notes,
        IReadOnlyList<TaskViewModel> events,
        DateTimeOffset now)
    {
        var signals = new List<JobSignal>();

        if (job == null)
        {
            return new JobSignals { Items = signals };
        }

        var isComplete = job.Done == true || job.CompletedTime.HasValue;
        var isVoid = job.Void == true;
        var isArchived = job.IsArchived;

        if (isVoid)
        {
            signals.Add(new JobSignal(SummarySeverity.Info,
                "job is VOIDED — no further action expected"));
        }

        if (isArchived)
        {
            signals.Add(new JobSignal(SummarySeverity.Info,
                "job is archived — fields are read-only"));
        }

        if (job.Locked == true)
        {
            signals.Add(new JobSignal(SummarySeverity.Info, "job is locked"));
        }

        if (job.Attention == true)
        {
            signals.Add(new JobSignal(SummarySeverity.Urgent,
                "dispatcher manually flagged this job for ATTENTION"));
        }

        if (job.Reprice == true)
        {
            signals.Add(new JobSignal(SummarySeverity.Caution,
                "job flagged for REPRICE — pricing needs review"));
        }

        // Lateness only matters while the job is still in flight
        if (!isComplete && !isVoid)
        {
            if (job.DeliverByTime.HasValue && job.DeliverByTime.Value < now.DateTime)
            {
                var minsLate = (int)(now.DateTime - job.DeliverByTime.Value).TotalMinutes;
                var severity = minsLate >= 60 ? SummarySeverity.Critical : SummarySeverity.Urgent;
                signals.Add(new JobSignal(severity,
                    $"delivery overdue by {FormatMinutes(minsLate)} (deadline was {job.DeliverByTime:yyyy-MM-dd HH:mm})"));
            }

            if (job.PuTime.HasValue
                && !job.PickupArrivalTime.HasValue
                && job.PuTime.Value < now.DateTime)
            {
                var minsLate = (int)(now.DateTime - job.PuTime.Value).TotalMinutes;
                var severity = minsLate >= 60 ? SummarySeverity.Urgent : SummarySeverity.Caution;
                signals.Add(new JobSignal(severity,
                    $"pickup overdue by {FormatMinutes(minsLate)} (scheduled {job.PuTime:yyyy-MM-dd HH:mm})"));
            }

            if (job.FollowupTime.HasValue && job.FollowupTime.Value < now.DateTime)
            {
                signals.Add(new JobSignal(SummarySeverity.Caution,
                    $"follow-up scheduled {job.FollowupTime:yyyy-MM-dd HH:mm} is past due"));
            }
        }

        // Missing data
        var hasCourier = !string.IsNullOrWhiteSpace(job.Courier)
                         || !string.IsNullOrWhiteSpace(job.AssignedCourier?.Text);
        if (!hasCourier && !isComplete && !isVoid)
        {
            // More urgent if we're already past the scheduled pickup
            var pastPickup = job.PuTime.HasValue && job.PuTime.Value < now.DateTime;
            var severity = pastPickup ? SummarySeverity.Urgent : SummarySeverity.Caution;
            signals.Add(new JobSignal(severity,
                pastPickup
                    ? "no courier assigned and pickup is overdue"
                    : "no courier assigned yet"));
        }

        var hasPickupAddress = !string.IsNullOrWhiteSpace(job.From)
                               || !string.IsNullOrWhiteSpace(job.PickupAddress?.FullAddress);
        if (!hasPickupAddress)
        {
            signals.Add(new JobSignal(SummarySeverity.Urgent,
                "pickup address is missing"));
        }

        var hasDeliveryAddress = !string.IsNullOrWhiteSpace(job.ToAddress)
                                 || !string.IsNullOrWhiteSpace(job.DeliveryAddress?.FullAddress);
        if (!hasDeliveryAddress)
        {
            signals.Add(new JobSignal(SummarySeverity.Urgent,
                "delivery address is missing"));
        }

        if (string.IsNullOrWhiteSpace(job.FromContactName) && string.IsNullOrWhiteSpace(job.DeliverToContact))
        {
            signals.Add(new JobSignal(SummarySeverity.Caution,
                "no pickup or delivery contact recorded"));
        }

        // Completion / POD signals
        if (isComplete && (job.PodPhoto == null || job.PodPhoto.Length == 0)
            && string.IsNullOrWhiteSpace(job.PodName))
        {
            signals.Add(new JobSignal(SummarySeverity.Caution,
                "job marked complete but no POD photo or signature captured"));
        }

        // Open tasks
        var openTasks = events?.Where(e => !e.Closed).ToList() ?? [];
        if (openTasks.Count > 0)
        {
            var overdue = openTasks.Count(t => t.DueDate < now);
            if (overdue > 0)
            {
                var severity = overdue >= 3 ? SummarySeverity.Urgent : SummarySeverity.Caution;
                signals.Add(new JobSignal(severity,
                    $"{overdue} open task(s) on this job are overdue"));
            }
            else
            {
                signals.Add(new JobSignal(SummarySeverity.Info,
                    $"{openTasks.Count} open task(s) on this job"));
            }
        }

        // Important / recent notes
        var importantUnreadNotes = notes?
            .Where(n => n.IsImportant)
            .OrderByDescending(n => n.CreatedDate)
            .Take(3)
            .ToList() ?? [];
        if (importantUnreadNotes.Count > 0)
        {
            signals.Add(new JobSignal(SummarySeverity.Caution,
                $"{importantUnreadNotes.Count} note(s) marked IMPORTANT on this job"));
        }

        // Flight delays
        if (job.IsFlightAssigned && job.AssignedFlight?.ExpectedArrival is { } expectedArrival
            && expectedArrival < now && !isComplete)
        {
            signals.Add(new JobSignal(SummarySeverity.Urgent,
                $"flight {job.AssignedFlight.FlightNumber} expected arrival {expectedArrival:yyyy-MM-dd HH:mm} has passed but job is not complete"));
        }

        // Partner job — informational so the LLM can mention the workflow
        if (job.IsPartnerJob)
        {
            var partnerName = string.IsNullOrWhiteSpace(job.PartnerTenantName) ? "partner tenant" : job.PartnerTenantName;
            signals.Add(new JobSignal(SummarySeverity.Info,
                $"partner job — counterparty is {partnerName}"));
        }

        if (job.IsBulkJob)
        {
            signals.Add(new JobSignal(SummarySeverity.Info, "bulk job — changes affect multiple records"));
        }

        if (job.PreBook == true)
        {
            signals.Add(new JobSignal(SummarySeverity.Info, "recurring/pre-booked job"));
        }

        return new JobSignals { Items = signals };
    }

    private static string FormatMinutes(int minutes)
    {
        if (minutes < 60) return $"{minutes}m";
        var hours = minutes / 60;
        var mins = minutes % 60;
        return mins == 0 ? $"{hours}h" : $"{hours}h {mins}m";
    }
}
