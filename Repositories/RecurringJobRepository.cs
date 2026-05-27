using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Extensions;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DespatchWeb.Repositories;

public class RecurringJobRepository(
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantInfoService infoService,
    ITenantClock clock,
    IClearListEnvelopeService clearListEnvelopeService)
    : BaseJobRepository(contextFactory, infoService, clock, clearListEnvelopeService), IRecurringJobRepository
{
    private readonly ITenantInfoService _infoService = infoService;
    private readonly ITenantClock _clock = clock;

    // Column length limits — should match database column definitions
    private const int MaxRefALength = 20;
    private const int MaxRefBLength = 15;
    private const int MaxOurRefLength = 20;
    private const int MaxContactLength = 100;
    private const int MaxTrackingLength = 100;
    private const int MaxCustomNameLength = 100;
    private const int MaxConNoteLength = 100;

    /// <summary>
    /// SQL Server minimum date — values at or below this are treated as "no date" and skipped during timezone conversion.
    /// </summary>
    private static readonly DateTimeOffset SqlMinDate = new(1753, 1, 2, 0, 0, 0, TimeSpan.Zero);

    public async Task<PaginatedResponse<PrebookListViewModel>> GetRecurringJobsListAsync(
        RecurringJobQueryRequest request)
    {
        var isUsTenant = _infoService.IsUsTenant();
        var query = BuildRecurringJobQuery(request, isUsTenant);

        var totalCount = await query.CountAsync();

        if (totalCount == 0)
        {
            return new PaginatedResponse<PrebookListViewModel>
            {
                Items = [],
                Total = 0,
                Page = request.Page,
                Pages = 0
            };
        }

        query = ApplyRecurringJobSort(query, request.Order, request.OrderDirection, applyDefaultSort: false);

        var items = await query
            .Skip((request.Page - 1) * request.Limit)
            .Take(request.Limit)
            .Select(JobMappings.ToPrebookListViewModel)
            .ToListAsync();

        ApplyPrebookTimezoneConversion(items);

        return new PaginatedResponse<PrebookListViewModel>
        {
            Items = items,
            Total = totalCount,
            Page = request.Page,
            Pages = (int)Math.Ceiling((double)totalCount / request.Limit)
        };
    }

    public async Task<JobGroupViewModel> GetRecurringJobByIdAsync(int jobId)
    {
        var effectiveJobId = await Context.GetEffectiveJobBookingIdAsync(jobId);

        var allJobsInGroup = await Context.TucJobBookings
            .Where(j => j.UcbkId == effectiveJobId || j.BookingParentId == effectiveJobId)
            .Select(JobMappings.JobRecurringMapping)
            .TagWith($"GetRecurringJob - Complete Booking Group {effectiveJobId}")
            .ToListAsync();

        var mainJob = allJobsInGroup.FirstOrDefault(j => j.Id == jobId);
        ArgumentNullException.ThrowIfNull(mainJob);

        var relatedJobs = allJobsInGroup.Where(j => j.Id != jobId).ToList();

        return new JobGroupViewModel
        {
            Job = mainJob,
            RelatedJobs = relatedJobs
        };
    }

    public async Task UpdateRecurringJobAsync(int jobId, JobProperty property, string value)
    {
        try
        {
            var noteText = property switch
            {
                // Simple single-field updates (no note)
                JobProperty.Items or JobProperty.SpeedID or JobProperty.ClientID or
                    JobProperty.Pedal or JobProperty.Attention or JobProperty.Reprice or
                    JobProperty.Truck or JobProperty.Van or JobProperty.VanOK or
                    JobProperty.RefA or JobProperty.RefB or JobProperty.OurRef or
                    JobProperty.DGClass or JobProperty.Direct or
                    JobProperty.TrackingMobile or JobProperty.TrackingEmail or
                    JobProperty.Amount or JobProperty.AcceptedJobTypeID or
                    JobProperty.DeliverBy or JobProperty.BookedTime or
                    JobProperty.StopDate or JobProperty.RestartDate or
                    JobProperty.CourierId or JobProperty.InactiveBy or
                    JobProperty.RouteId or
                    JobProperty.AgentId or JobProperty.NpAgentId
                    => await UpdateSimplePropertyAsync(jobId, property, value),

                // Parent + children updates (no note)
                JobProperty.Time or JobProperty.Date or JobProperty.Weight or
                    JobProperty.CustomJobName or JobProperty.ConNote
                    => await UpdatePropertyWithChildrenAsync(jobId, property, value),

                // Contact fields: parent + first/last child
                JobProperty.FromContactName or JobProperty.FromContactPhone or
                    JobProperty.ToContactName or JobProperty.ToContactPhone
                    => await UpdateContactPropertyAsync(jobId, property, value),

                // Updates that create an audit note
                JobProperty.Size or JobProperty.DGDocumentation or
                    JobProperty.TrackingMethod or JobProperty.Frequency or
                    JobProperty.HolidayDelivery or JobProperty.DaysOfWeek or
                    JobProperty.Active
                    => await UpdatePropertyWithNoteAsync(jobId, property, value),

                _ => throw new ArgumentOutOfRangeException(nameof(property), property, null)
            };

            if (!string.IsNullOrEmpty(noteText))
            {
                await CreateNewRecurringJobNote(jobId, noteText, false);
            }
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(RecurringJobRepository),
                    nameof(UpdateRecurringJobAsync)));
            throw;
        }
    }

    public async Task<IReadOnlyList<TucNoteViewModel>> GetRecurringNotesByJobIdAsync(int jobBookingId)
    {
        var effectivePrebookId = await Context.GetEffectiveJobBookingIdAsync(jobBookingId);
        var tenantTimeZone = _infoService.GetTenantTimeZone();

        var notes = await Context.TucNotes
            .Where(n => n.JobBookingId == effectivePrebookId)
            .OrderByDescending(n => n.CreatedDate)
            .Select(NoteMappings.ActiveNoteMap)
            .ToListAsync();

        UpdateNoteDate(notes, tenantTimeZone);
        return notes;
    }

    public async Task SaveRecurringJobNote(TucNoteViewModel note)
    {
        ArgumentNullException.ThrowIfNull(note);
        if (!note.JobBookingId.HasValue)
        {
            throw new ArgumentNullException(nameof(note));
        }

        if (note.NoteId == 0)
        {
            await CreateNewRecurringJobNote(note.JobBookingId.Value, note.NoteText, note.IsImportant,
                (NoteType)note.NoteTypeId);
        }
        else
        {
            await UpdateRecurringJobNote(note.NoteId, note.NoteText, note.IsImportant, (NoteType)note.NoteTypeId);
        }
    }

    public async Task UpdateBookingDeliveryAddressAsync(UpdateAddressRequest request)
    {
        try
        {
            var address = request.Address;

            // Get the last child job ID (for delivery address)
            var lastChildId = await Context.TucJobBookings
                .Where(child => child.BookingParentId == request.JobId)
                .OrderByDescending(child => child.UcbkId)
                .Select(child => (int?)child.UcbkId)
                .FirstOrDefaultAsync();

            // Update parent job and last child job (if exists)
            var idsToUpdate = new List<int> { request.JobId };
            if (lastChildId.HasValue)
            {
                idsToUpdate.Add(lastChildId.Value);
            }

            var rowsAffected = await Context.TucJobBookings
                .Where(jb => idsToUpdate.Contains(jb.UcbkId))
                .ExecuteUpdateAsync(s => s
                    .SetProperty(jb => jb.DeliveryLatitude, address.Latitude)
                    .SetProperty(jb => jb.DeliveryLongitude, address.Longitude)
                    .SetProperty(jb => jb.DeliveryAddressLine1, address.AddressLine1)
                    .SetProperty(jb => jb.DeliveryAddressLine2, address.AddressLine2)
                    .SetProperty(jb => jb.DeliveryAddressLine3, address.AddressLine3)
                    .SetProperty(jb => jb.DeliveryAddressLine4, address.AddressLine4)
                    .SetProperty(jb => jb.DeliveryAddressLine5, address.AddressLine5)
                    .SetProperty(jb => jb.DeliveryAddressLine6, address.AddressLine6)
                    .SetProperty(jb => jb.DeliveryAddressLine7, address.AddressLine7)
                    .SetProperty(jb => jb.DeliveryAddressLine8, address.AddressLine8));

            if (rowsAffected == 0)
            {
                throw new ArgumentException($"Job with ID {request.JobId} not found", nameof(request));
            }
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(RecurringJobRepository),
                    nameof(UpdateBookingDeliveryAddressAsync)));
            throw;
        }
    }

    public async Task UpdateBookingPickupAddressAsync(UpdateAddressRequest request)
    {
        try
        {
            var address = request.Address;

            // Get the first child job ID (for pickup address)
            var firstChildId = await Context.TucJobBookings
                .Where(child => child.BookingParentId == request.JobId)
                .OrderBy(child => child.UcbkId)
                .Select(child => (int?)child.UcbkId)
                .FirstOrDefaultAsync();

            // Update parent job and first child job (if exists)
            var idsToUpdate = new List<int> { request.JobId };
            if (firstChildId.HasValue)
            {
                idsToUpdate.Add(firstChildId.Value);
            }

            var rowsAffected = await Context.TucJobBookings
                .Where(jb => idsToUpdate.Contains(jb.UcbkId))
                .ExecuteUpdateAsync(s => s
                    .SetProperty(jb => jb.PickUpLatitude, address.Latitude)
                    .SetProperty(jb => jb.PickUpLongitude, address.Longitude)
                    .SetProperty(jb => jb.PickupAddressLine1, address.AddressLine1)
                    .SetProperty(jb => jb.PickupAddressLine2, address.AddressLine2)
                    .SetProperty(jb => jb.PickupAddressLine3, address.AddressLine3)
                    .SetProperty(jb => jb.PickupAddressLine4, address.AddressLine4)
                    .SetProperty(jb => jb.PickupAddressLine5, address.AddressLine5)
                    .SetProperty(jb => jb.PickupAddressLine6, address.AddressLine6)
                    .SetProperty(jb => jb.PickupAddressLine7, address.AddressLine7)
                    .SetProperty(jb => jb.PickupAddressLine8, address.AddressLine8));

            if (rowsAffected == 0)
            {
                throw new ArgumentException($"Job with ID {request.JobId} not found", nameof(request));
            }
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(RecurringJobRepository),
                    nameof(UpdateBookingPickupAddressAsync)));
            throw;
        }
    }

    public async Task<IReadOnlyList<PrebookListViewModel>> GetAllRecurringJobsForExportAsync(RecurringJobQueryRequest request)
    {
        var isUsTenant = _infoService.IsUsTenant();
        var query = BuildRecurringJobQuery(request, isUsTenant);

        query = ApplyRecurringJobSort(query, request.Order, request.OrderDirection, applyDefaultSort: true);

        // Cap export to prevent unbounded result sets
        const int maxExportRows = 10_000;
        var items = await query
            .Take(maxExportRows)
            .Select(JobMappings.ToPrebookListViewModel)
            .ToListAsync();

        if (items.Count == 0)
        {
            return items;
        }

        ApplyPrebookTimezoneConversion(items);

        return items;
    }

    private async Task<string> UpdateSimplePropertyAsync(int jobId, JobProperty property, string value)
    {
        switch (property)
        {
            case JobProperty.Items:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.Quantity, ParseValue<short>(value, property)));
                break;

            case JobProperty.SpeedID:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId && j.UcbkDone != true)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkSpeed, ParseValue<int>(value, property)));
                break;

            case JobProperty.ClientID:
                var clientId = ParseValue<int>(value, property);
                var code = await Context.TucClients
                    .Where(c => c.UcclId == clientId)
                    .Select(c => c.UcclCode)
                    .FirstOrDefaultAsync();

                await Context.TucJobBookings.Where(j =>
                        j.UcbkId == jobId || j.BookingParentId == jobId || j.ParentId == jobId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(j => j.UcbkClientId, clientId)
                        .SetProperty(j => j.UcbkClientCode, code));
                break;

            case JobProperty.RouteId:
                // Recurring Route assignment cascades through the booking
                // tree the same way ClientID does — parent + children +
                // grandchildren all flip in one ExecuteUpdate. Empty
                // string or "0" clears the assignment (the operator picks
                // "None" in the dropdown to remove a booking from a
                // route). uspPrebookSet reads tucJobBooking.RouteId on
                // the next nightly run to stamp the right courier from
                // Dispatch_RouteRoster onto the materialised tucJob rows.
                int? routeIdValue = string.IsNullOrWhiteSpace(value) || value == "0"
                    ? null
                    : ParseValue<int>(value, property);

                await Context.TucJobBookings.Where(j =>
                        j.UcbkId == jobId || j.BookingParentId == jobId || j.ParentId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.RouteId, routeIdValue));
                break;

            case JobProperty.Pedal:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkCbd, ParseValue<bool>(value, property)));
                break;

            case JobProperty.Attention:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkAttention, ParseValue<bool>(value, property)));
                break;

            case JobProperty.Reprice:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.Reprice, ParseValue<bool>(value, property)));
                break;

            case JobProperty.Truck:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(j => j.Truck, ParseValue<bool>(value, property))
                        .SetProperty(j => j.UcbkVan, false));
                break;

            case JobProperty.Van:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(j => j.UcbkVan, ParseValue<bool>(value, property))
                        .SetProperty(j => j.Truck, false));
                break;

            case JobProperty.VanOK:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.VanOk, ParseValue<bool>(value, property)));
                break;

            case JobProperty.RefA:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkClientRefa, Truncate(value, MaxRefALength)));
                break;

            case JobProperty.RefB:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkClientRefb, Truncate(value, MaxRefBLength)));
                break;

            case JobProperty.OurRef:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkOurRef, Truncate(value, MaxOurRefLength)));
                break;

            case JobProperty.DGClass:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.Dgclass, ParseValue<int>(value, property)));
                break;

            case JobProperty.Direct:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.Direct, ParseValue<bool>(value, property)));
                break;

            case JobProperty.TrackingMobile:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.TrackingMobile, Truncate(value, MaxTrackingLength)));
                break;

            case JobProperty.TrackingEmail:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.TrackingEmail, Truncate(value, MaxTrackingLength)));
                break;

            case JobProperty.Amount:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkAmount, ParseValue<decimal>(value, property)));
                break;

            case JobProperty.AcceptedJobTypeID:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s =>
                        s.SetProperty(j => j.AcceptedJobTypeId, ParseValue<short>(value, property)));
                break;

            case JobProperty.DeliverBy:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s =>
                        s.SetProperty(j => j.DeliverByTime, ParseValue<DateTimeOffset>(value, property).DateTime));
                break;

            case JobProperty.BookedTime:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s =>
                        s.SetProperty(j => j.UcbkDate, ParseValue<DateTimeOffset>(value, property).DateTime));
                break;

            case JobProperty.StopDate:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s =>
                        s.SetProperty(j => j.StopDate, ParseValue<DateTimeOffset>(value, property).DateTime));
                break;

            case JobProperty.RestartDate:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s =>
                        s.SetProperty(j => j.RestartDate, ParseValue<DateTimeOffset>(value, property).DateTime));
                break;

            case JobProperty.CourierId:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.CourierId, ParseValue<int>(value, property)));
                break;

            case JobProperty.InactiveBy:
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkInActiveBy, ParseValue<int>(value, property)));
                break;

            case JobProperty.AgentId:
                // Single-row write — mirrors the CourierId pattern above.
                // Empty / "0" clears the assignment (operator picks "None" to
                // remove an agent).
                //
                // DESIGN NOTE (2026-05-26): RunViewer's matching path also
                // stamps tucJob.UcjbStatus / UcjbDispDate / UcjbDispTime
                // (per Steve's HANDOVER-ASSIGN-BACKEND §A). That stamp DOES
                // NOT belong here — at the booking-template layer the
                // dispatch lifecycle is meaningless (the template is intent,
                // not a dispatched job). The lifecycle stamp happens when
                // the Monitor materialises the booking into tucJob via
                // UTL_stpJobBooking_InsertJob / _InsertSchedule, which now
                // also carry AgentId + NpAgentId across thanks to migrations
                // 20260526160000/_160100. So the cascade only writes the
                // booking-side column; the Monitor handles the rest.
                int? agentIdValue = string.IsNullOrWhiteSpace(value) || value == "0"
                    ? null
                    : ParseValue<int>(value, property);

                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.AgentId, agentIdValue));
                break;

            case JobProperty.NpAgentId:
                // Network Partner branch writes BOTH AgentId AND NpAgentId
                // to the same UcagId — the NP IS an agent, same TucAgent row.
                // Mirrors the materialised-job convention. Unassigning clears
                // both columns together so the row doesn't end up with an
                // agent stuck on it after the NP is removed.
                //
                // Same DESIGN NOTE as JobProperty.AgentId above re: no
                // lifecycle stamp at the booking layer.
                int? npAgentIdValue = string.IsNullOrWhiteSpace(value) || value == "0"
                    ? null
                    : ParseValue<int>(value, property);

                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(j => j.AgentId, npAgentIdValue)
                        .SetProperty(j => j.NpAgentId, npAgentIdValue));
                break;

            default:
                throw new ArgumentOutOfRangeException(nameof(property), property, null);
        }

        return null;
    }

    private async Task<string> UpdatePropertyWithChildrenAsync(int jobId, JobProperty property, string value)
    {
        var parentAndChildren = Context.TucJobBookings.Where(j => j.UcbkId == jobId || j.BookingParentId == jobId);

        switch (property)
        {
            case JobProperty.Time:
                await parentAndChildren.ExecuteUpdateAsync(s =>
                    s.SetProperty(j => j.UcbkTime, ParseValue<DateTimeOffset>(value, property).DateTime));
                break;

            case JobProperty.Date:
                await parentAndChildren.ExecuteUpdateAsync(s =>
                    s.SetProperty(j => j.UcbkDate, ParseValue<DateTimeOffset>(value, property).DateTime));
                break;

            case JobProperty.Weight:
                await parentAndChildren.ExecuteUpdateAsync(s =>
                    s.SetProperty(j => j.UcbkWeight, ParseValue<short>(value, property)));
                break;

            case JobProperty.CustomJobName:
                await parentAndChildren.ExecuteUpdateAsync(s =>
                    s.SetProperty(j => j.CustomJobName, Truncate(value, MaxCustomNameLength)));
                break;

            case JobProperty.ConNote:
                await parentAndChildren.ExecuteUpdateAsync(s =>
                    s.SetProperty(j => j.Connote, Truncate(value, MaxConNoteLength)));
                break;
        }

        return null;
    }

    private async Task<string> UpdateContactPropertyAsync(int jobId, JobProperty property, string value)
    {
        var truncated = Truncate(value, MaxContactLength);

        switch (property)
        {
            case JobProperty.FromContactName:
            {
                var firstChildId = await GetFirstChildIdAsync(jobId);
                var ids = BuildIdList(jobId, firstChildId);
                await Context.TucJobBookings.Where(j => ids.Contains(j.UcbkId))
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.PickupFromContact, truncated));
                break;
            }
            case JobProperty.FromContactPhone:
            {
                var firstChildId = await GetFirstChildIdAsync(jobId);
                var ids = BuildIdList(jobId, firstChildId);
                await Context.TucJobBookings.Where(j => ids.Contains(j.UcbkId))
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.PickupFromPhone, truncated));
                break;
            }
            case JobProperty.ToContactName:
            {
                var lastChildId = await GetLastChildIdAsync(jobId);
                var ids = BuildIdList(jobId, lastChildId);
                await Context.TucJobBookings.Where(j => ids.Contains(j.UcbkId))
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.DeliverToContact, truncated));
                break;
            }
            case JobProperty.ToContactPhone:
            {
                var lastChildId = await GetLastChildIdAsync(jobId);
                var ids = BuildIdList(jobId, lastChildId);
                await Context.TucJobBookings.Where(j => ids.Contains(j.UcbkId))
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.DeliverToPhone, truncated));
                break;
            }
        }

        return null;
    }

    private async Task<string> UpdatePropertyWithNoteAsync(int jobId, JobProperty property, string value)
    {
        switch (property)
        {
            case JobProperty.Size:
            {
                var size = ParseValue<int>(value, property);
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkSize, size));
                return $"Changed Size to {size}";
            }
            case JobProperty.DGDocumentation:
            {
                var dgDoc = ParseValue<bool>(value, property);
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.Dgdocument, dgDoc));
                return $"Changed DGDocumentation to {(dgDoc ? "Yes" : "No")}";
            }
            case JobProperty.TrackingMethod:
            {
                var trackingMethodId = ParseValue<int>(value, property);
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.TrackingMethod, trackingMethodId));
                return $"Changed Tracking Method to {GetTrackingName(trackingMethodId)}";
            }
            case JobProperty.Frequency:
            {
                var frequency = ParseValue<int>(value, property);
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkFrequency, frequency));
                return $"Frequency of recurring job set to: {((Frequency)frequency).ToDisplayString()}";
            }
            case JobProperty.HolidayDelivery:
            {
                var holidayOption = ParseValue<int>(value, property);
                await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.HolidayDeliveryOption, holidayOption));
                return
                    $"Holiday Delivery Option set to: {((HolidayDeliveryOptions)holidayOption).ToDisplayString()}";
            }
            case JobProperty.DaysOfWeek:
            {
                var dayEnum = (DaysOfWeek)ParseValue<int>(value, property);
                var daysInt = (int)dayEnum;
                var daysString = dayEnum.ToBinaryString();

                var effectiveBookingId = await Context.GetEffectiveJobBookingIdAsync(jobId);

                await Context.TucJobBookings
                    .Where(j => j.UcbkId == effectiveBookingId || j.BookingParentId == effectiveBookingId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(j => j.UcbkDaysInt, daysInt)
                        .SetProperty(j => j.UcbkDays, daysString));

                return $"Days of recurring jobs set to: {dayEnum.ToDisplayString()}";
            }
            case JobProperty.Active:
            {
                var isActive = ParseValue<bool>(value, property);
                var staffId = _infoService.GetStaffId();
                var currentTenantTime = _clock.TenantNow;

                if (isActive)
                {
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkActive, true));
                }
                else
                {
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s => s
                            .SetProperty(j => j.UcbkActive, false)
                            .SetProperty(j => j.UcbkInActiveBy, staffId)
                            .SetProperty(j => j.UcbkInActiveDate, currentTenantTime));
                }

                return $"Changed Active to {(isActive ? "Yes" : "No")}";
            }
            default:
                throw new ArgumentOutOfRangeException(nameof(property), property, null);
        }
    }

    private Task<int?> GetFirstChildIdAsync(int parentJobId) =>
        Context.TucJobBookings
            .Where(c => c.BookingParentId == parentJobId)
            .OrderBy(c => c.UcbkId)
            .Select(c => (int?)c.UcbkId)
            .FirstOrDefaultAsync();

    private Task<int?> GetLastChildIdAsync(int parentJobId) =>
        Context.TucJobBookings
            .Where(c => c.BookingParentId == parentJobId)
            .OrderByDescending(c => c.UcbkId)
            .Select(c => (int?)c.UcbkId)
            .FirstOrDefaultAsync();

    private static List<int> BuildIdList(int parentId, int? childId)
    {
        var ids = new List<int> { parentId };
        if (childId.HasValue)
        {
            ids.Add(childId.Value);
        }

        return ids;
    }

    private void ApplyPrebookTimezoneConversion(List<PrebookListViewModel> items)
    {
        var tenantTimeZone = _infoService.GetTenantTimeZone();

        foreach (var item in items)
        {
            if (item.Booked > SqlMinDate)
            {
                item.Booked = TimeZoneHelper.SetDateTimeWithTimeZone(item.Booked.DateTime, tenantTimeZone);
            }

            if (item.NextDueTime.HasValue && item.NextDueTime.Value > SqlMinDate)
            {
                item.NextDueTime =
                    TimeZoneHelper.SetDateTimeWithTimeZone(item.NextDueTime.Value.DateTime, tenantTimeZone);
            }
        }
    }

    private static T ParseValue<T>(string value, JobProperty property) where T : IParsable<T>
    {
        if (T.TryParse(value, null, out var result))
        {
            return result;
        }

        throw new ArgumentException($"Invalid value '{value}' for property {property}. Expected type: {typeof(T).Name}.", nameof(value));
    }

    private static string Truncate(string value, int maxLength) =>
        string.IsNullOrEmpty(value) ? value : value[..Math.Min(value.Length, maxLength)];

    private IQueryable<TucJobBooking> BuildRecurringJobQuery(RecurringJobQueryRequest request, bool isUsTenant)
    {
        var query = Context.TucJobBookings
            .Where(j => j.UcbkActive == request.Active && j.UcbkOneOff != true);

        // US tenants: exclude child jobs (only show parent jobs)
        if (isUsTenant)
        {
            query = query.Where(j => !j.BookingParentId.HasValue || j.BookingParentId == j.UcbkId);
        }

        if (!string.IsNullOrWhiteSpace(request.SearchText))
        {
            var searchPattern = $"%{request.SearchText}%";
            query = query.Where(j =>
                // Job identifiers
                EF.Functions.Like(j.UcbkJobNumber, searchPattern) ||
                EF.Functions.Like(j.CustomJobName, searchPattern) ||
                EF.Functions.Like(j.Barcode, searchPattern) ||
                // Client fields
                EF.Functions.Like(j.UcbkClientCode, searchPattern) ||
                EF.Functions.Like(j.UcbkClient.UcclName, searchPattern) ||
                // References
                EF.Functions.Like(j.UcbkClientRefa, searchPattern) ||
                EF.Functions.Like(j.UcbkClientRefb, searchPattern) ||
                EF.Functions.Like(j.UcbkOurRef, searchPattern) ||
                EF.Functions.Like(j.Connote, searchPattern) ||
                // Contact fields
                EF.Functions.Like(j.PickupFromContact, searchPattern) ||
                EF.Functions.Like(j.DeliverToContact, searchPattern) ||
                EF.Functions.Like(j.PickupFromPhone, searchPattern) ||
                EF.Functions.Like(j.DeliverToPhone, searchPattern) ||
                // Courier
                EF.Functions.Like(j.Courier.UccrName, searchPattern) ||
                EF.Functions.Like(j.Courier.Code, searchPattern) ||
                // Run/Schedule
                EF.Functions.Like(j.RunName, searchPattern) ||
                EF.Functions.Like(j.ScheduleName, searchPattern) ||
                // Pickup address
                EF.Functions.Like(j.PickupAddressLine1, searchPattern) ||
                EF.Functions.Like(j.PickupAddressLine2, searchPattern) ||
                EF.Functions.Like(j.PickupAddressLine3, searchPattern) ||
                EF.Functions.Like(j.PickupAddressLine4, searchPattern) ||
                EF.Functions.Like(j.PickupAddressLine5, searchPattern) ||
                EF.Functions.Like(j.PickupAddressLine6, searchPattern) ||
                EF.Functions.Like(j.PickupAddressLine7, searchPattern) ||
                EF.Functions.Like(j.PickupAddressLine8, searchPattern) ||
                // Delivery address
                EF.Functions.Like(j.DeliveryAddressLine1, searchPattern) ||
                EF.Functions.Like(j.DeliveryAddressLine2, searchPattern) ||
                EF.Functions.Like(j.DeliveryAddressLine3, searchPattern) ||
                EF.Functions.Like(j.DeliveryAddressLine4, searchPattern) ||
                EF.Functions.Like(j.DeliveryAddressLine5, searchPattern) ||
                EF.Functions.Like(j.DeliveryAddressLine6, searchPattern) ||
                EF.Functions.Like(j.DeliveryAddressLine7, searchPattern) ||
                EF.Functions.Like(j.DeliveryAddressLine8, searchPattern)
            );
        }

        // Apply Speed filter
        if (request.SpeedId.HasValue)
        {
            query = query.Where(j => j.UcbkSpeed == request.SpeedId.Value);
        }

        // Apply Courier filter
        if (request.CourierId.HasValue)
        {
            query = query.Where(j => j.CourierId == request.CourierId.Value);
        }

        // Apply Days of Week filter (bitwise match - job must run on at least one of the selected days)
        if (request.DaysOfWeek is > 0)
        {
            query = query.Where(j => (j.UcbkDaysInt & request.DaysOfWeek.Value) != 0);
        }

        // Apply Recurring Route filter
        if (request.RouteId.HasValue)
        {
            query = query.Where(j => j.RouteId == request.RouteId.Value);
        }

        return query;
    }

    private static IQueryable<TucJobBooking> ApplyRecurringJobSort(
        IQueryable<TucJobBooking> query,
        string order,
        string direction,
        bool applyDefaultSort)
    {
        var isDescending = direction == "desc";
        return order switch
        {
            "booked" => isDescending
                ? query.OrderByDescending(j => j.UcbkDate).ThenByDescending(j => j.UcbkTime)
                : query.OrderBy(j => j.UcbkDate).ThenBy(j => j.UcbkTime),
            "speed" => isDescending
                ? query.OrderByDescending(j => j.UcbkSpeed)
                : query.OrderBy(j => j.UcbkSpeed),
            "client" => isDescending
                ? query.OrderByDescending(j => j.UcbkClientId)
                : query.OrderBy(j => j.UcbkClientId),
            "from" => isDescending
                ? query.OrderByDescending(j => j.PickupAddressLine6)
                : query.OrderBy(j => j.PickupAddressLine6),
            "to" => isDescending
                ? query.OrderByDescending(j => j.DeliveryAddressLine6)
                : query.OrderBy(j => j.DeliveryAddressLine6),
            "courier" => isDescending
                ? query.OrderByDescending(j => j.CourierId)
                : query.OrderBy(j => j.CourierId),
            "customJobName" => isDescending
                ? query.OrderByDescending(j => j.CustomJobName)
                : query.OrderBy(j => j.CustomJobName),
            "nextDueTime" => isDescending
                ? query.OrderByDescending(j => j.UcbkNextDue)
                : query.OrderBy(j => j.UcbkNextDue),
            _ => applyDefaultSort
                ? query.OrderByDescending(j => j.UcbkDate).ThenByDescending(j => j.UcbkTime)
                : query
        };
    }
}