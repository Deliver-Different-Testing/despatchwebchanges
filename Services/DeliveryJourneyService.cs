using System.Globalization;
using System.Text.RegularExpressions;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Extensions;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Services;

/// <summary>
/// Service for building delivery journey timelines showing all events, notes, messages, and status changes for a job.
/// </summary>
public sealed partial class DeliveryJourneyService(
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantInfoService infoService) : IDeliveryJourneyService
{
    /// <summary>
    /// Retrieves the complete delivery journey timeline for a job, including tasks, notes, messages, and status updates.
    /// Queries are executed in parallel for performance.
    /// </summary>
    /// <param name="jobId">The job ID to get the journey for.</param>
    /// <returns>A chronologically sorted list of journey events.</returns>
    public async Task<IReadOnlyList<DeliveryJourneyViewModel>> GetDeliveryJourneyForJobAsync(int jobId)
    {
        await using var mainContext = await contextFactory.CreateDbContextAsync();
        await using var tasksContext = await contextFactory.CreateDbContextAsync();
        await using var messagesContext = await contextFactory.CreateDbContextAsync();
        await using var notesContext = await contextFactory.CreateDbContextAsync();
        await using var statusContext = await contextFactory.CreateDbContextAsync();

        var isLiveJob = await mainContext.IsLiveJobAsync(jobId);

        var tasksTask = GetTasksAsync(tasksContext, jobId);
        var messagesTask = GetMessagesAsync(messagesContext, jobId);
        var notesTask = GetNotesAsync(notesContext, jobId, isLiveJob);
        var statusUpdatesTask = GetStatusUpdatesAsync(statusContext, jobId, isLiveJob);

        await Task.WhenAll(tasksTask, messagesTask, notesTask, statusUpdatesTask);

        return (await tasksTask)
            .Concat(await messagesTask)
            .Concat(await notesTask)
            .Concat(await statusUpdatesTask)
            .OrderByDescending(x => x.Date)
            .ToList();
    }

    /// <summary>
    /// Retrieves task/event records associated with a job, including audit history.
    /// </summary>
    private async Task<IReadOnlyList<DeliveryJourneyViewModel>> GetTasksAsync(DespatchContext context, int jobId)
    {
        var timezone = infoService.GetTenantTimeZone();

        var eventDtos = await context.TucEvents
            .Where(e => e.UcevJobId == jobId)
            .Select(e => new DeliveryJourneyDto
            {
                EventId = e.UcevId,
                Description = e.UcevDescription,
                Date = e.UcevDate,
                Time = e.UcevTime,
                Closed = e.UcevClosed,
                Despatcher = e.UcevDespatcher,
                AssignedToFirstName = e.UcevStaffIdinNavigation != null ? e.UcevStaffIdinNavigation.UcstFirstName : null,
                AssignedToLastName = e.UcevStaffIdinNavigation != null ? e.UcevStaffIdinNavigation.UcstLastName : null,
                CompletedByFirstName = e.UcevStaffIdoutNavigation != null ? e.UcevStaffIdoutNavigation.UcstFirstName : null,
                CompletedByLastName = e.UcevStaffIdoutNavigation != null ? e.UcevStaffIdoutNavigation.UcstLastName : null,
                Audits = e.TucEventAudits
                    .OrderByDescending(a => a.UceaChangedAt)
                    .Select(a => new EventAuditDto
                    {
                        ChangeType = a.UceaChangeType,
                        ColumnName = a.UceaColumnName,
                        StaffFirstName = a.UceaStaff != null ? a.UceaStaff.UcstFirstName : null,
                        StaffLastName = a.UceaStaff != null ? a.UceaStaff.UcstLastName : null,
                        ChangedAt = a.UceaChangedAt
                    })
                    .ToList()
            })
            .TagWith("DeliveryJourney - Tasks")
            .ToListAsync();

        return eventDtos.Select(dto => new DeliveryJourneyViewModel
        {
            Id = Guid.NewGuid(),
            JobId = jobId,
            Title = dto.Description,
            Icon = "task",
            Date = TimeZoneHelper.SetDateTimeWithTimeZone(
                (dto.Date ?? DateTime.MinValue).CombineWithTime(dto.Time),
                timezone),
            Tags = new[]
                {
                    "Task",
                    dto.Closed ? "Completed" : "In Progress",
                    $"Created by {dto.Despatcher}",
                    !string.IsNullOrEmpty(dto.AssignedToFirstName)
                        ? $"Assigned to {dto.AssignedToFirstName} {dto.AssignedToLastName}"
                        : null,
                    !string.IsNullOrEmpty(dto.CompletedByFirstName)
                        ? $"Completed by {dto.CompletedByFirstName} {dto.CompletedByLastName}"
                        : null
                }
                .Concat(dto.Audits.Select(a =>
                    $"{a.ChangeType}: {a.ColumnName} changed by {a.StaffFirstName ?? "Unknown"} {a.StaffLastName ?? string.Empty} at {infoService.ConvertUtcToTenantTimeZone(a.ChangedAt):g}"))
                .Where(tag => !string.IsNullOrWhiteSpace(tag))
                .ToList()
        }).ToList();
    }

    /// <summary>
    /// Retrieves notes for a job from live or archived tables based on job status.
    /// </summary>
    private async Task<IReadOnlyList<DeliveryJourneyViewModel>> GetNotesAsync(
        DespatchContext context,
        int jobId,
        bool isLiveJob)
    {
        var isUsCustomer = infoService.IsUsTenant();
        var dateFormat = isUsCustomer ? "MM/dd/yyyy HH:mm" : "dd/MM/yyyy HH:mm";

        var historyQuery = isLiveJob
            ? context.TucNoteHistories
                .Where(h => h.Note != null && h.Note.JobId == jobId)
            : context.TucNoteHistories
                .Where(h => h.ArchiveNoteId != null &&
                    context.TucNoteArchives.Any(a => a.NoteId == h.ArchiveNoteId && a.JobId == jobId));

        var histories = await historyQuery
            .OrderBy(h => h.EditedAtUtc)
            .Select(h => new
            {
                h.NoteHistoryId,
                h.EditedAtUtc,
                h.OldNoteText,
                h.NewNoteText,
                EditedByFirstName = context.TucStaffs.Where(s => s.UcstId == h.EditedBy).Select(s => s.UcstFirstName).FirstOrDefault(),
                EditedByLastName = context.TucStaffs.Where(s => s.UcstId == h.EditedBy).Select(s => s.UcstLastName).FirstOrDefault()
            })
            .TagWith(isLiveJob ? "DeliveryJourney - Live Note Histories" : "DeliveryJourney - Archived Note Histories")
            .ToListAsync();

        return histories.Select(h =>
        {
            var editedByName = !string.IsNullOrEmpty(h.EditedByFirstName)
                ? $"{h.EditedByFirstName} {h.EditedByLastName}"
                : "System";
            var editDate = infoService.ConvertUtcToTenantTimeZone(h.EditedAtUtc);

            return new DeliveryJourneyViewModel
            {
                Id = Guid.NewGuid(),
                JobId = jobId,
                Title = string.IsNullOrEmpty(h.OldNoteText)
                    ? $"Note added by {editedByName}"
                    : $"Note edited by {editedByName}",
                Icon = "sticky_note_2",
                Description = h.NewNoteText,
                Date = editDate,
                Tags = new[]
                {
                    "Note",
                    $"Edited by {editedByName} on {editDate.ToString(dateFormat)}",
                    !string.IsNullOrEmpty(h.OldNoteText)
                        ? $"Previous: {h.OldNoteText}"
                        : null
                }.Where(tag => !string.IsNullOrWhiteSpace(tag)).ToList()
            };
        }).ToList();
    }

    /// <summary>
    /// Retrieves manual messages associated with a job including direct messages, emails, and SMS.
    /// </summary>
    private async Task<IReadOnlyList<DeliveryJourneyViewModel>> GetMessagesAsync(DespatchContext context, int jobId)
    {
        var timezone = infoService.GetTenantTimeZone();

        var messageTemps = await context.TucManualMessages
            .Where(m => m.JobId == jobId)
            .Select(m => new ManualMessageDto
            {
                MessageId = m.UcmmId,
                Subject = m.Subject,
                UcmmDate = m.UcmmDate,
                UcmmMessage = m.UcmmMessage,
                UcmmSendToCourierId = m.UcmmSendToCourierId,
                UcmmSendToStaffId = m.UcmmSendToStaffId,
                SendToEmailAddress = m.SendToEmailAddress,
                SendToMobile = m.SendToMobile,
                TimeRead = m.TimeRead,
                SendToCourierName = m.UcmmSendToCourier != null ? m.UcmmSendToCourier.UccrName : null,
                SendToCourierSurname = m.UcmmSendToCourier != null ? m.UcmmSendToCourier.UccrSurname : null,
                SendToStaffFirstName = m.UcmmSendToStaff != null ? m.UcmmSendToStaff.UcstFirstName : null,
                SendToStaffLastName = m.UcmmSendToStaff != null ? m.UcmmSendToStaff.UcstLastName : null,
                SendFromCourierName = m.UcmmSendFromCourier != null ? m.UcmmSendFromCourier.UccrName : null,
                SendFromCourierSurname = m.UcmmSendFromCourier != null ? m.UcmmSendFromCourier.UccrSurname : null,
                SendFromStaffFirstName = m.UcmmSendFromStaff != null ? m.UcmmSendFromStaff.UcstFirstName : null,
                SendFromStaffLastName = m.UcmmSendFromStaff != null ? m.UcmmSendFromStaff.UcstLastName : null
            })
            .TagWith("DeliveryJourney - Messages")
            .ToListAsync();

        return messageTemps.Select(m => new DeliveryJourneyViewModel
        {
            Id = Guid.NewGuid(),
            JobId = jobId,
            Title = m.Subject,
            Date = TimeZoneHelper.SetDateTimeWithTimeZone(m.UcmmDate, timezone),
            Description = m.UcmmMessage,
            Icon = "sms",
            Tags = new List<string>()
                .Concat(m.UcmmSendToCourierId.HasValue || m.UcmmSendToStaffId.HasValue
                    ? new[]
                    {
                        "Direct Message",
                        !string.IsNullOrEmpty(m.SendToCourierName)
                            ? $"{m.SendToCourierName}, {m.SendToCourierSurname}"
                            : null,
                        !string.IsNullOrEmpty(m.SendToStaffFirstName)
                            ? $"{m.SendToStaffFirstName}, {m.SendToStaffLastName}"
                            : null,
                        !string.IsNullOrEmpty(m.SendFromCourierName)
                            ? $"{m.SendFromCourierName}, {m.SendFromCourierSurname}"
                            : null,
                        !string.IsNullOrEmpty(m.SendFromStaffFirstName)
                            ? $"{m.SendFromStaffFirstName}, {m.SendFromStaffLastName}"
                            : null,
                        m.TimeRead.HasValue ? $"Read at {m.TimeRead?.ToString("g")}" : null
                    }
                    : Array.Empty<string>())
                .Concat(!string.IsNullOrEmpty(m.SendToEmailAddress)
                    ? new[]
                    {
                        "Email",
                        $"Sent to {m.SendToEmailAddress}",
                        !string.IsNullOrEmpty(m.SendFromCourierName)
                            ? $"{m.SendFromCourierName}, {m.SendFromCourierSurname}"
                            : null,
                        !string.IsNullOrEmpty(m.SendFromStaffFirstName)
                            ? $"{m.SendFromStaffFirstName}, {m.SendFromStaffLastName}"
                            : null
                    }
                    : Array.Empty<string>())
                .Concat(!string.IsNullOrEmpty(m.SendToMobile)
                    ? new[]
                    {
                        "SMS",
                        $"Sent to {m.SendToMobile}",
                        !string.IsNullOrEmpty(m.SendFromCourierName)
                            ? $"{m.SendFromCourierName}, {m.SendFromCourierSurname}"
                            : null,
                        !string.IsNullOrEmpty(m.SendFromStaffFirstName)
                            ? $"{m.SendFromStaffFirstName}, {m.SendFromStaffLastName}"
                            : null
                    }
                    : Array.Empty<string>())
                .Where(tag => !string.IsNullOrWhiteSpace(tag))
                .ToList()
        }).ToList();
    }

    /// <summary>
    /// Retrieves status updates for a job from live or archived tables, including courier, agent, and field changes.
    /// </summary>
    private async Task<IReadOnlyList<DeliveryJourneyViewModel>> GetStatusUpdatesAsync(
        DespatchContext context,
        int jobId,
        bool isLiveJob)
    {
        if (isLiveJob)
        {
            var statusUpdateTemps = await context.JobDeliveryJourneys
                .Where(s => s.JobId == jobId && s.ChangeType != nameof(DeliveryJourneyChangeType.InternalStatus))
                .Select(s => new JobDeliveryJourneyDto
                {
                    Id = s.JourneyId,
                    UpdatedAt = s.UpdatedAt,
                    ChangeType = s.ChangeType,
                    Comments = s.Comments,
                    FieldName = s.FieldName,
                    OldValue = s.OldValue,
                    NewValue = s.NewValue,
                    StaffFirstName = s.Staff.UcstFirstName,
                    StaffLastName = s.Staff.UcstLastName,
                    CourierName = s.Courier.UccrName,
                    CourierSurname = s.Courier.UccrSurname,
                    FlightNumber = s.Flight.UcnwFlightNo,
                    NewAgentName = s.NewAgent.UcagName,
                    OldAgentName = s.OldAgent.UcagName,
                    NewJobStatusName = s.NewJobStatus.UcjsName,
                    OldJobStatusName = s.OldJobStatus.UcjsName,
                    NewCourierName = s.NewCourier != null ? s.NewCourier.UccrName + " " + s.NewCourier.UccrSurname : null,
                    OldCourierName = s.OldCourier != null ? s.OldCourier.UccrName + " " + s.OldCourier.UccrSurname : null
                })
                .TagWith("DeliveryJourney - Live Status Updates")
                .ToListAsync();

            var currentBreakdownTotal = await context.PricingBreakdowns
                .Where(p => p.JobId == jobId)
                .TagWith("DeliveryJourney - Live PricingBreakdown Total")
                .SumAsync(p => p.ChargeAmount);

            return MapStatusUpdatesToViewModels(statusUpdateTemps, jobId, currentBreakdownTotal);
        }

        var archivedStatusUpdateTemps = await context.JobDeliveryJourneyArchives
            .Where(s => s.JobId == jobId && s.ChangeType != nameof(DeliveryJourneyChangeType.InternalStatus))
            .Select(s => new JobDeliveryJourneyArchiveDto
            {
                Id = s.JourneyId,
                UpdatedAt = s.UpdatedAt,
                ChangeType = s.ChangeType,
                Comments = s.Comments,
                FieldName = s.FieldName,
                OldValue = s.OldValue,
                NewValue = s.NewValue,
                UpdatedByType = s.UpdatedByType,
                StaffFirstName = s.Staff.UcstFirstName,
                StaffLastName = s.Staff.UcstLastName,
                CourierName = s.Courier.UccrName,
                CourierSurname = s.Courier.UccrSurname,
                FlightNumber = s.Flight.UcnwFlightNo,
                NewAgentName = s.NewAgent.UcagName,
                OldAgentName = s.OldAgent.UcagName,
                NewJobStatusName = s.NewJobStatus.UcjsName,
                OldJobStatusName = s.OldJobStatus.UcjsName,
                NewCourierName = s.NewCourier != null ? s.NewCourier.UccrName + " " + s.NewCourier.UccrSurname : null,
                OldCourierName = s.OldCourier != null ? s.OldCourier.UccrName + " " + s.OldCourier.UccrSurname : null
            })
            .TagWith("DeliveryJourney - Archived Status Updates")
            .ToListAsync();

        var currentArchivedBreakdownTotal = await context.PricingBreakdownArchives
            .Where(p => p.JobId == jobId)
            .TagWith("DeliveryJourney - Archived PricingBreakdown Total")
            .SumAsync(p => p.ChargeAmount);

        return MapArchivedStatusUpdatesToViewModels(archivedStatusUpdateTemps, jobId, currentArchivedBreakdownTotal);
    }

    /// <summary>
    /// Maps live status update DTOs to view models, grouping by timestamp.
    /// Computes a running grand total for pricing events by rolling back the
    /// current breakdown total via each pricing group's delta in reverse chrono order.
    /// </summary>
    private List<DeliveryJourneyViewModel> MapStatusUpdatesToViewModels(
        List<JobDeliveryJourneyDto> journeyTemps,
        int jobId,
        decimal currentBreakdownTotal)
    {
        var orderedGroups = journeyTemps
            .GroupBy(s => s.UpdatedAt)
            .OrderByDescending(g => g.Key)
            .ToList();

        var grandTotalByTimestamp = new Dictionary<DateTime, decimal>();
        var runningTotal = currentBreakdownTotal;
        foreach (var group in orderedGroups)
        {
            var pricingRows = group
                .Where(s => s.ChangeType == nameof(DeliveryJourneyChangeType.JobUpdate)
                            && !string.IsNullOrEmpty(s.FieldName)
                            && s.FieldName.StartsWith("Pricing", StringComparison.Ordinal))
                .ToList();

            if (pricingRows.Count == 0)
            {
                continue;
            }

            grandTotalByTimestamp[group.Key] = runningTotal;
            var groupDelta = pricingRows.Sum(r => ParseDecimal(r.NewValue) - ParseDecimal(r.OldValue));
            runningTotal -= groupDelta;
        }

        return orderedGroups
            .Select(group => new DeliveryJourneyViewModel
            {
                Id = Guid.NewGuid(),
                JobId = jobId,
                Date = infoService.ConvertUtcToTenantTimeZone(group.Key),
                Title = GetTitle(group.First()),
                Description = GetDescription(group.ToList()),
                Icon = GetIcon(group.First().ChangeType, group.First().FieldName),
                Tags = BuildTags(group).ToList(),
                GrandTotalAfter = grandTotalByTimestamp.TryGetValue(group.Key, out var total) ? total : null
            })
            .ToList();
    }

    /// <summary>
    /// Maps archived status update DTOs to view models, grouping by timestamp.
    /// Computes a running grand total for pricing events by rolling back the
    /// current breakdown total via each pricing group's delta in reverse chrono order.
    /// </summary>
    private List<DeliveryJourneyViewModel> MapArchivedStatusUpdatesToViewModels(
        List<JobDeliveryJourneyArchiveDto> dtoList,
        int jobId,
        decimal currentBreakdownTotal)
    {
        var orderedGroups = dtoList
            .GroupBy(s => s.UpdatedAt)
            .OrderByDescending(g => g.Key)
            .ToList();

        var grandTotalByTimestamp = new Dictionary<DateTime, decimal>();
        var runningTotal = currentBreakdownTotal;
        foreach (var group in orderedGroups)
        {
            var pricingRows = group
                .Where(s => s.ChangeType == nameof(DeliveryJourneyChangeType.JobUpdate)
                            && !string.IsNullOrEmpty(s.FieldName)
                            && s.FieldName.StartsWith("Pricing", StringComparison.Ordinal))
                .ToList();

            if (pricingRows.Count == 0)
            {
                continue;
            }

            grandTotalByTimestamp[group.Key] = runningTotal;
            var groupDelta = pricingRows.Sum(r => ParseDecimal(r.NewValue) - ParseDecimal(r.OldValue));
            runningTotal -= groupDelta;
        }

        return orderedGroups
            .Select(group => new DeliveryJourneyViewModel
            {
                Id = Guid.NewGuid(),
                JobId = jobId,
                Date = infoService.ConvertUtcToTenantTimeZone(group.Key),
                Title = GetTitle(group.First()),
                Description = GetDescription(group.ToList()),
                Icon = GetIcon(group.First().ChangeType, group.First().FieldName),
                Tags = BuildTags(group).ToList(),
                GrandTotalAfter = grandTotalByTimestamp.TryGetValue(group.Key, out var total) ? total : null
            })
            .ToList();
    }

    /// <summary>
    /// Parses a string value as a decimal. Returns 0 if the value is null, empty, or unparseable.
    /// Used to compute deltas across PricingBreakdown audit rows where values may occasionally be missing or malformed.
    /// </summary>
    internal static decimal ParseDecimal(string value) =>
        decimal.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var d) ? d : 0m;

    /// <summary>
    /// Builds tag strings from live status update DTOs for display in the journey timeline.
    /// </summary>
    private static IEnumerable<string> BuildTags(IGrouping<DateTime, JobDeliveryJourneyDto> group) =>
        group.SelectMany(s => new[]
            {
                !string.IsNullOrEmpty(s.StaffFirstName) ? $"By {s.StaffFirstName} {s.StaffLastName}" : null,
                !string.IsNullOrEmpty(s.CourierName) ? $"By {s.CourierName} {s.CourierSurname}" : null,
                !string.IsNullOrEmpty(s.FlightNumber) ? $"Flight: {s.FlightNumber}" : null,
                BuildAgentTag(s.OldAgentName, s.NewAgentName),
                BuildCourierTag(s.OldCourierName, s.NewCourierName),
                BuildStatusTag(s.OldJobStatusName, s.NewJobStatusName),
                BuildFieldTag(s.FieldName, s.OldValue, s.NewValue)
            })
            .Where(tag => !string.IsNullOrWhiteSpace(tag))
            .Distinct();

    /// <summary>
    /// Builds tag strings from archived status update DTOs for display in the journey timeline.
    /// </summary>
    private static IEnumerable<string> BuildTags(IGrouping<DateTime, JobDeliveryJourneyArchiveDto> group) =>
        group.SelectMany(s => new[]
            {
                !string.IsNullOrEmpty(s.StaffFirstName) ? $"By {s.StaffFirstName} {s.StaffLastName}" : null,
                !string.IsNullOrEmpty(s.CourierName) ? $"By {s.CourierName} {s.CourierSurname}" : null,
                !string.IsNullOrEmpty(s.FlightNumber) ? $"Flight: {s.FlightNumber}" : null,
                BuildAgentTag(s.OldAgentName, s.NewAgentName),
                BuildCourierTag(s.OldCourierName, s.NewCourierName),
                BuildStatusTag(s.OldJobStatusName, s.NewJobStatusName),
                BuildFieldTag(s.FieldName, s.OldValue, s.NewValue)
            })
            .Where(tag => !string.IsNullOrWhiteSpace(tag))
            .Distinct();

    /// <summary>
    /// Builds a display tag for agent assignment changes.
    /// </summary>
    private static string BuildAgentTag(string oldAgent, string newAgent)
    {
        if (!string.IsNullOrEmpty(newAgent) && !string.IsNullOrEmpty(oldAgent))
        {
            return $"Agent: {oldAgent} → {newAgent}";
        }

        if (!string.IsNullOrEmpty(newAgent))
        {
            return $"Agent: {newAgent}";
        }

        return !string.IsNullOrEmpty(oldAgent) ? $"Removed Agent: {oldAgent}" : null;
    }

    /// <summary>
    /// Builds a display tag for courier assignment changes.
    /// </summary>
    private static string BuildCourierTag(string oldCourier, string newCourier)
    {
        if (!string.IsNullOrEmpty(newCourier) && !string.IsNullOrEmpty(oldCourier))
        {
            return $"Courier: {oldCourier} → {newCourier}";
        }

        if (!string.IsNullOrEmpty(newCourier))
        {
            return $"Courier: {newCourier}";
        }

        return !string.IsNullOrEmpty(oldCourier) ? $"Removed Courier: {oldCourier}" : null;
    }

    /// <summary>
    /// Builds a display tag for job status changes.
    /// </summary>
    private static string BuildStatusTag(string oldStatus, string newStatus)
    {
        if (!string.IsNullOrEmpty(newStatus) && !string.IsNullOrEmpty(oldStatus))
        {
            return $"Status: {oldStatus} → {newStatus}";
        }

        return !string.IsNullOrEmpty(newStatus) ? $"Status: {newStatus}" : null;
    }

    /// <summary>
    /// Builds a display tag for generic field value changes.
    /// </summary>
    private static string BuildFieldTag(string fieldName, string oldValue, string newValue)
    {
        if (string.IsNullOrEmpty(fieldName))
        {
            return null;
        }

        var formattedName = FormatFieldName(fieldName);
        if (!string.IsNullOrEmpty(oldValue) && !string.IsNullOrEmpty(newValue))
        {
            return
                $"{formattedName}: {FormatFieldValue(fieldName, oldValue)} → {FormatFieldValue(fieldName, newValue)}";
        }

        if (!string.IsNullOrEmpty(newValue))
        {
            return $"{formattedName}: {FormatFieldValue(fieldName, newValue)}";
        }

        return !string.IsNullOrEmpty(oldValue)
            ? $"{formattedName}: {FormatFieldValue(fieldName, oldValue)} → (cleared)"
            : null;
    }

    /// <summary>
    /// Gets a human-readable title for a live status update based on change type.
    /// </summary>
    private static string GetTitle(JobDeliveryJourneyDto dto) =>
        dto.ChangeType switch
        {
            nameof(DeliveryJourneyChangeType.JobStatus) => !string.IsNullOrEmpty(dto.NewJobStatusName)
                ? $"Status Changed to {dto.NewJobStatusName}"
                : "Status Changed",
            nameof(DeliveryJourneyChangeType.CourierAssignment) => !string.IsNullOrEmpty(dto.NewCourierName)
                ? $"Assigned to {dto.NewCourierName}"
                : !string.IsNullOrEmpty(dto.OldCourierName)
                    ? $"Unassigned from {dto.OldCourierName}"
                    : "Courier Assignment Changed",
            nameof(DeliveryJourneyChangeType.AgentAssignment) => !string.IsNullOrEmpty(dto.NewAgentName)
                ? $"Assigned to Agent {dto.NewAgentName}"
                : !string.IsNullOrEmpty(dto.OldAgentName)
                    ? $"Unassigned from Agent {dto.OldAgentName}"
                    : "Agent Assignment Changed",
            nameof(DeliveryJourneyChangeType.FlightAssignment) => !string.IsNullOrEmpty(dto.FlightNumber)
                ? $"Flight {dto.FlightNumber} Assigned"
                : "Flight Assignment Changed",
            nameof(DeliveryJourneyChangeType.JobUpdate) => !string.IsNullOrEmpty(dto.FieldName)
                ? $"{FormatFieldName(dto.FieldName)} Updated"
                : "Job Updated",
            _ => "Job Updated"
        };

    /// <summary>
    /// Gets a human-readable title for an archived status update based on change type.
    /// </summary>
    private static string GetTitle(JobDeliveryJourneyArchiveDto dto) =>
        dto.ChangeType switch
        {
            nameof(DeliveryJourneyChangeType.JobStatus) => !string.IsNullOrEmpty(dto.NewJobStatusName)
                ? $"Status Changed to {dto.NewJobStatusName}"
                : "Status Changed",
            nameof(DeliveryJourneyChangeType.CourierAssignment) => !string.IsNullOrEmpty(dto.NewCourierName)
                ? $"Assigned to {dto.NewCourierName}"
                : !string.IsNullOrEmpty(dto.OldCourierName)
                    ? $"Unassigned from {dto.OldCourierName}"
                    : "Courier Assignment Changed",
            nameof(DeliveryJourneyChangeType.AgentAssignment) => !string.IsNullOrEmpty(dto.NewAgentName)
                ? $"Assigned to Agent {dto.NewAgentName}"
                : !string.IsNullOrEmpty(dto.OldAgentName)
                    ? $"Unassigned from Agent {dto.OldAgentName}"
                    : "Agent Assignment Changed",
            nameof(DeliveryJourneyChangeType.FlightAssignment) => !string.IsNullOrEmpty(dto.FlightNumber)
                ? $"Flight {dto.FlightNumber} Assigned"
                : "Flight Assignment Changed",
            nameof(DeliveryJourneyChangeType.JobUpdate) => !string.IsNullOrEmpty(dto.FieldName)
                ? $"{FormatFieldName(dto.FieldName)} Updated"
                : "Job Updated",
            _ => "Job Updated"
        };

    /// <summary>
    /// Builds a detailed description from a list of live status updates.
    /// </summary>
    internal static string GetDescription(List<JobDeliveryJourneyDto> updates)
    {
        var descriptions = new List<string>();

        foreach (var dto in updates)
        {
            if (!string.IsNullOrEmpty(dto.OldJobStatusName) && !string.IsNullOrEmpty(dto.NewJobStatusName))
            {
                descriptions.Add($"Status: {dto.OldJobStatusName} → {dto.NewJobStatusName}");
            }

            if (!string.IsNullOrEmpty(dto.OldCourierName) && !string.IsNullOrEmpty(dto.NewCourierName))
            {
                descriptions.Add($"Courier: {dto.OldCourierName} → {dto.NewCourierName}");
            }
            else if (!string.IsNullOrEmpty(dto.NewCourierName))
            {
                descriptions.Add($"Assigned to courier: {dto.NewCourierName}");
            }
            else if (!string.IsNullOrEmpty(dto.OldCourierName))
            {
                descriptions.Add($"Removed from courier: {dto.OldCourierName}");
            }

            if (!string.IsNullOrEmpty(dto.OldAgentName) && !string.IsNullOrEmpty(dto.NewAgentName))
            {
                descriptions.Add($"Agent: {dto.OldAgentName} → {dto.NewAgentName}");
            }
            else if (!string.IsNullOrEmpty(dto.NewAgentName))
            {
                descriptions.Add($"Assigned to agent: {dto.NewAgentName}");
            }
            else if (!string.IsNullOrEmpty(dto.OldAgentName))
            {
                descriptions.Add($"Removed from agent: {dto.OldAgentName}");
            }

            if (!string.IsNullOrEmpty(dto.FieldName))
            {
                var fieldDesc = FormatFieldName(dto.FieldName);
                if (!string.IsNullOrEmpty(dto.OldValue) && !string.IsNullOrEmpty(dto.NewValue))
                {
                    descriptions.Add($"{fieldDesc}: {dto.OldValue} → {dto.NewValue}");
                }
                else if (!string.IsNullOrEmpty(dto.NewValue))
                {
                    descriptions.Add($"{fieldDesc} set to: {dto.NewValue}");
                }
                else if (!string.IsNullOrEmpty(dto.OldValue))
                {
                    descriptions.Add($"{fieldDesc} cleared (was: {dto.OldValue})");
                }
            }

            if (!string.IsNullOrEmpty(dto.Comments))
            {
                descriptions.Add(dto.Comments);
            }
        }

        return string.Join("; ", descriptions.Distinct());
    }

    /// <summary>
    /// Builds a detailed description from a list of archived status updates.
    /// </summary>
    internal static string GetDescription(List<JobDeliveryJourneyArchiveDto> updates)
    {
        var descriptions = new List<string>();

        foreach (var dto in updates)
        {
            if (!string.IsNullOrEmpty(dto.OldJobStatusName) && !string.IsNullOrEmpty(dto.NewJobStatusName))
            {
                descriptions.Add($"Status: {dto.OldJobStatusName} → {dto.NewJobStatusName}");
            }

            if (!string.IsNullOrEmpty(dto.OldCourierName) && !string.IsNullOrEmpty(dto.NewCourierName))
            {
                descriptions.Add($"Courier: {dto.OldCourierName} → {dto.NewCourierName}");
            }
            else if (!string.IsNullOrEmpty(dto.NewCourierName))
            {
                descriptions.Add($"Assigned to courier: {dto.NewCourierName}");
            }
            else if (!string.IsNullOrEmpty(dto.OldCourierName))
            {
                descriptions.Add($"Removed from courier: {dto.OldCourierName}");
            }

            if (!string.IsNullOrEmpty(dto.OldAgentName) && !string.IsNullOrEmpty(dto.NewAgentName))
            {
                descriptions.Add($"Agent: {dto.OldAgentName} → {dto.NewAgentName}");
            }
            else if (!string.IsNullOrEmpty(dto.NewAgentName))
            {
                descriptions.Add($"Assigned to agent: {dto.NewAgentName}");
            }
            else if (!string.IsNullOrEmpty(dto.OldAgentName))
            {
                descriptions.Add($"Removed from agent: {dto.OldAgentName}");
            }

            if (!string.IsNullOrEmpty(dto.FieldName))
            {
                var fieldDesc = FormatFieldName(dto.FieldName);
                if (!string.IsNullOrEmpty(dto.OldValue) && !string.IsNullOrEmpty(dto.NewValue))
                {
                    descriptions.Add($"{fieldDesc}: {dto.OldValue} → {dto.NewValue}");
                }
                else if (!string.IsNullOrEmpty(dto.NewValue))
                {
                    descriptions.Add($"{fieldDesc} set to: {dto.NewValue}");
                }
                else if (!string.IsNullOrEmpty(dto.OldValue))
                {
                    descriptions.Add($"{fieldDesc} cleared (was: {dto.OldValue})");
                }
            }

            if (!string.IsNullOrEmpty(dto.Comments))
            {
                descriptions.Add(dto.Comments);
            }
        }

        return string.Join("; ", descriptions.Distinct());
    }

    /// <summary>
    /// Gets a Material Design icon name based on the change type and field.
    /// </summary>
    private static string GetIcon(string changeType, string fieldName = null) =>
        changeType switch
        {
            nameof(DeliveryJourneyChangeType.JobStatus) => "published_with_changes",
            nameof(DeliveryJourneyChangeType.InternalStatus) => "swap_horiz",
            nameof(DeliveryJourneyChangeType.CourierAssignment) => "local_shipping",
            nameof(DeliveryJourneyChangeType.AgentAssignment) => "support_agent",
            nameof(DeliveryJourneyChangeType.FlightAssignment) => "flight",
            nameof(DeliveryJourneyChangeType.JobUpdate) => GetIconForFieldName(fieldName),
            _ => "update"
        };

    /// <summary>
    /// Gets a specific Material Design icon based on field name.
    /// </summary>
    internal static string GetIconForFieldName(string fieldName)
    {
        if (string.IsNullOrEmpty(fieldName))
        {
            return "edit_note";
        }

        return fieldName switch
        {
            "ucjbJobDone" => "check_circle",
            "ucjbVoid" => "cancel",
            "ucjbAttention" => "warning",
            "ucjbLocked" => "lock",
            "PickUpTime" or "ucjbDispTime" or "OutForDelivery" => "schedule",
            "RequiredDeliveryTime" or "DeliverByTime" or "ucjbComplTime" => "event",
            "FollowupTime" => "notifications",
            "ucjbFromAddr" or "ucjbFrom" or "PickupAddressLine1" or "PickupAddressLine2"
                or "PickupAddressLine3" or "PickupAddressLine4" => "location_on",
            "ucjbToAddr" or "ucjbTo" or "DeliveryAddressLine1" or "DeliveryAddressLine2"
                or "DeliveryAddressLine3" or "DeliveryAddressLine4" => "pin_drop",
            "ucjbContact" or "ucjbContactPhone" or "PickupFromContact" or "PickupFromPhone"
                or "DeliverToContact" or "DeliverToPhone" => "contact_phone",
            "ucjbWeight" => "scale",
            "ucjbQty" => "inventory_2",
            "ucjbSize" or "Cubic" => "straighten",
            "ucjbKm" => "route",
            "ucjbSpeed" or "ucjbType" => "speed",
            "ucjbAmount" or "FuelSurchargeAmount" or "PPDAmount" or "PickupAmount"
                or "DropoffAmount" or "NWAmount" or "RawAmount" or "RebateAmt" => "payments",
            "CourierPayment" or "CourierFuel" or "CourierBonus" => "account_balance_wallet",
            "ucjbClientRefa" or "ucjbClientRefb" or "ucjbClientRefc" or "ucjbOurRef" => "tag",
            "Connote" or "Barcode" or "GSSConnote" => "qr_code_2",
            "ucjbNotes" or "ClientNotes" or "InternalNotes" => "notes",
            "ucjbPODName" or "PickUpName" => "draw",
            "ucjbVan" => "airport_shuttle",
            "Truck" => "local_shipping",
            "ucjbReturn" => "undo",
            "RuralDelivery" => "landscape",
            "SaturdayDelivery" => "calendar_month",
            "DGClass" => "report_problem",
            "Direct" => "straight",
            "ucjbClientID" => "business",
            "ucjbOpID" or "ucjbDispID" => "person",
            "DepotId" => "warehouse",
            "FromAirportId" or "ToAirportId" => "flight",
            "ParentID" or "BulkParentID" => "account_tree",
            "PricingBreakdown" => "paid",
            _ when fieldName.StartsWith("Pricing") => "attach_money",
            _ => "edit_note"
        };
    }

    /// <summary>
    /// Converts a database field name to a human-readable display name.
    /// </summary>
    internal static string FormatFieldName(string fieldName)
    {
        if (string.IsNullOrEmpty(fieldName))
        {
            return fieldName;
        }

        return fieldName switch
        {
            "ucjbStatus" => "Status",
            "InternalStatus" => "Internal Status",
            "ucjbCourierID" => "Courier",
            "AgentID" => "Agent",
            "ucjbJobDone" => "Job Completed",
            "ucjbVoid" => "Voided",
            "ucjbAttention" => "Attention Flag",
            "ucjbLocked" => "Locked",
            "PickUpTime" => "Pickup Time",
            "RequiredDeliveryTime" => "Required Delivery Time",
            "DeliverByTime" => "Deliver By Time",
            "ucjbComplTime" => "Completion Time",
            "ucjbDispTime" => "Dispatch Time",
            "OutForDelivery" => "Out For Delivery",
            "FollowupTime" => "Followup Time",
            "ucjbDate" => "Job Date",
            "ucjbTime" => "Job Time",
            "ucjbFromAddr" => "Pickup Address",
            "ucjbToAddr" => "Delivery Address",
            "PickupAddressLine1" => "Pickup Address Line 1",
            "PickupAddressLine2" => "Pickup Address Line 2",
            "PickupAddressLine3" => "Pickup Address Line 3",
            "PickupAddressLine4" => "Pickup Address Line 4",
            "DeliveryAddressLine1" => "Delivery Address Line 1",
            "DeliveryAddressLine2" => "Delivery Address Line 2",
            "DeliveryAddressLine3" => "Delivery Address Line 3",
            "DeliveryAddressLine4" => "Delivery Address Line 4",
            "ucjbFrom" => "Pickup Location",
            "ucjbTo" => "Delivery Location",
            "ucjbContact" => "Contact Name",
            "ucjbContactPhone" => "Contact Phone",
            "PickupFromContact" => "Pickup Contact",
            "PickupFromPhone" => "Pickup Phone",
            "DeliverToContact" => "Delivery Contact",
            "DeliverToPhone" => "Delivery Phone",
            "ucjbWeight" => "Weight",
            "ucjbQty" => "Quantity",
            "ucjbSize" => "Size",
            "Cubic" => "Cubic Volume",
            "ucjbKm" => "Distance (km)",
            "ucjbSpeed" => "Service Level",
            "ucjbType" => "Job Type",
            "ucjbChargeType" => "Charge Type",
            "ucjbAmount" => "Amount",
            "FuelSurchargeAmount" => "Fuel Surcharge",
            "PPDAmount" => "PPD Amount",
            "PickupAmount" => "Pickup Amount",
            "DropoffAmount" => "Dropoff Amount",
            "CourierPayment" => "Courier Payment",
            "CourierFuel" => "Courier Fuel",
            "CourierBonus" => "Courier Bonus",
            "NWAmount" => "Nationwide Amount",
            "RawAmount" => "Raw Amount",
            "RebateAmt" => "Rebate Amount",
            "GSTRate" => "GST Rate",
            "ucjbClientRefa" => "Client Ref A",
            "ucjbClientRefb" => "Client Ref B",
            "ucjbClientRefc" => "Client Ref C",
            "ucjbOurRef" => "Our Reference",
            "Connote" => "Connote",
            "Barcode" => "Barcode",
            "GSSConnote" => "GSS Connote",
            "ucjbNumber" => "Job Number",
            "ucjbNotes" => "Job Notes",
            "ClientNotes" => "Client Notes",
            "InternalNotes" => "Internal Notes",
            "ucjbPODName" => "POD Name",
            "PickUpName" => "Pickup Signed By",
            "ucjbVan" => "Van Required",
            "Truck" => "Truck Required",
            "ucjbReturn" => "Return Job",
            "RuralDelivery" => "Rural Delivery",
            "SaturdayDelivery" => "Saturday Delivery",
            "DGClass" => "Dangerous Goods Class",
            "Direct" => "Direct Delivery",
            "ucjbCBD" => "CBD",
            "ucjbClientID" => "Client",
            "ucjbOpID" => "Operator",
            "ucjbDispID" => "Dispatcher",
            "DepotId" => "Depot",
            "FromAirportId" => "From Airport",
            "ToAirportId" => "To Airport",
            "ParentID" => "Parent Job",
            "BulkParentID" => "Bulk Parent",
            "PricingBreakdown" => "Pricing",
            _ => fieldName.StartsWith("Pricing") ? fieldName : ConvertToTitleCase(fieldName)
        };
    }

    /// <summary>
    /// Converts a camelCase or PascalCase field name to title case with spaces.
    /// </summary>
    internal static string ConvertToTitleCase(string fieldName)
    {
        var cleanName = fieldName;
        if (cleanName.StartsWith("ucjb", StringComparison.OrdinalIgnoreCase))
        {
            cleanName = cleanName[4..];
        }

        var result = TitleCaseRegex().Replace(cleanName, " $1");
        return char.ToUpper(result[0]) + result[1..];
    }

    /// <summary>
    /// Formats a field value for display, applying appropriate formatting based on field type (currency, boolean, etc.).
    /// </summary>
    internal static string FormatFieldValue(string fieldName, string value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return value;
        }

        if (value.Equals("True", StringComparison.OrdinalIgnoreCase) ||
            value.Equals("False", StringComparison.OrdinalIgnoreCase))
        {
            return value.Equals("True", StringComparison.OrdinalIgnoreCase) ? "Yes" : "No";
        }

        switch (fieldName)
        {
            case "ucjbAmount" or "FuelSurchargeAmount" or "PPDAmount" or "PickupAmount"
                or "DropoffAmount" or "CourierPayment" or "CourierFuel" or "CourierBonus"
                or "NWAmount" or "RawAmount" or "RebateAmt" or "PickupRawAmount" or "DropoffRawAmount"
                or "NWRawAmount" or "RawBaseAmount" or "GSSAmount" or "PPDExclusiveAmount"
                when decimal.TryParse(value, out var amount):
                return amount.ToString("C2");
            case "ucjbWeight" when decimal.TryParse(value, out var weight):
                return $"{weight:F2} kg";
            case "ucjbKm" or "TotalDistance" when decimal.TryParse(value, out var distance):
                return $"{distance:F1} km";
        }

        if (value.Length > 50)
        {
            return value[..47] + "...";
        }

        return value;
    }

    [GeneratedRegex("(\\B[A-Z])")]
    private static partial Regex TitleCaseRegex();
}