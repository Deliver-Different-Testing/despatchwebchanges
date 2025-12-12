using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
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
    IClearListEnvelopeService clearListEnvelopeService)
    : BaseJobRepository(contextFactory, infoService, clearListEnvelopeService), IRecurringJobRepository
{
    private readonly ITenantInfoService _infoService = infoService;

    public async Task<PaginatedResponse<PrebookListViewModel>> GetRecurringJobsListAsync(
        RecurringJobQueryRequest request)
    {
        var isUsTenant = _infoService.IsUsTenant();

        var query = Context.TucJobBookings
            .AsNoTracking()
            .Where(j => j.UcbkActive == request.Active && j.UcbkOneOff == false);

        // US tenants: exclude child jobs (only show parent jobs)
        if (isUsTenant) query = query.Where(j => !j.ParentId.HasValue);

        if (!string.IsNullOrWhiteSpace(request.SearchText))
        {
            var searchPattern = $"%{request.SearchText}%";
            query = query.Where(j =>
                EF.Functions.Like(j.UcbkJobNumber, searchPattern) ||
                EF.Functions.Like(j.CustomJobName, searchPattern) ||
                EF.Functions.Like(j.Barcode, searchPattern) ||
                EF.Functions.Like(j.DeliveryAddressLine1, searchPattern) ||
                EF.Functions.Like(j.DeliveryAddressLine2, searchPattern) ||
                EF.Functions.Like(j.DeliveryAddressLine3, searchPattern) ||
                EF.Functions.Like(j.DeliveryAddressLine4, searchPattern) ||
                EF.Functions.Like(j.DeliveryAddressLine5, searchPattern) ||
                EF.Functions.Like(j.DeliveryAddressLine6, searchPattern) ||
                EF.Functions.Like(j.DeliveryAddressLine7, searchPattern) ||
                EF.Functions.Like(j.DeliveryAddressLine8, searchPattern) ||
                EF.Functions.Like(j.PickupAddressLine1, searchPattern) ||
                EF.Functions.Like(j.PickupAddressLine2, searchPattern) ||
                EF.Functions.Like(j.PickupAddressLine3, searchPattern) ||
                EF.Functions.Like(j.PickupAddressLine4, searchPattern) ||
                EF.Functions.Like(j.PickupAddressLine5, searchPattern) ||
                EF.Functions.Like(j.PickupAddressLine6, searchPattern) ||
                EF.Functions.Like(j.PickupAddressLine7, searchPattern) ||
                EF.Functions.Like(j.PickupAddressLine8, searchPattern)
            );
        }

        var totalCount = await query.CountAsync();

        var isDescending = request.OrderDirection == "desc";
        query = request.Order switch
        {
            "booked" => isDescending
                ? query.OrderByDescending(j => j.UcbkDate)
                    .ThenByDescending(j => j.UcbkTime)
                : query.OrderBy(j => j.UcbkDate)
                    .ThenBy(j => j.UcbkTime),
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
            _ => query
        };

        var items = await query
            .Skip((request.Page - 1) * request.Limit)
            .Take(request.Limit)
            .Select(JobMappings.ToPrebookListViewModel)
            .ToListAsync();

        // Early return if no records
        if (items.Count == 0)
            return new PaginatedResponse<PrebookListViewModel>
            {
                Items = [],
                Total = 0,
                Page = request.Page,
                Pages = request.Limit
            };

        var tenantTimeZone = _infoService.GetTenantTimeZone();
        foreach (var item in items)
        {
            // Only apply timezone if Booked has a meaningful value
            if (item.Booked != default(DateTime) && item.Booked > DateTime.MinValue)
                item.Booked = TimeZoneHelper.SetDateTimeWithTimeZone(item.Booked, tenantTimeZone);

            // NextDueTime already has null-check but also check for default/MinValue
            if (item.NextDueTime.HasValue && item.NextDueTime.Value > DateTime.MinValue)
                item.NextDueTime = TimeZoneHelper.SetDateTimeWithTimeZone(item.NextDueTime.Value, tenantTimeZone);
        }

        return new PaginatedResponse<PrebookListViewModel>
        {
            Items = items,
            Total = totalCount,
            Page = request.Page,
            Pages = request.Limit
        };
    }

    public async Task<JobGroupViewModel> GetRecurringJobByIdAsync(int jobId)
    {
        var effectiveJobId = await Context.GetEffectiveJobBookingIdAsync(jobId);

        var allJobsInGroup = await Context.TucJobBookings
            .AsNoTracking()
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
            string noteText;

            switch (property)
            {
                // Simple single-field updates using ExecuteUpdateAsync (most efficient - no entity loading)
                case JobProperty.Items:
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.Quantity, short.Parse(value)));
                    return;

                case JobProperty.SpeedID:
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId && j.UcbkDone != true)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkSpeed, int.Parse(value)));
                    return;

                case JobProperty.ClientID:
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkClientId, int.Parse(value)));
                    return;

                case JobProperty.ClientCode:
                    var clientCode = value[..Math.Min(value.Length, 5)];
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s =>
                            s.SetProperty(j => j.UcbkClientCode, clientCode));
                    return;

                case JobProperty.Pedal:
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkCbd, bool.Parse(value)));
                    return;

                case JobProperty.Attention:
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkAttention, bool.Parse(value)));
                    return;

                case JobProperty.Reprice:
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.Reprice, bool.Parse(value)));
                    return;

                case JobProperty.Truck:
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s => s
                            .SetProperty(j => j.Truck, bool.Parse(value))
                            .SetProperty(j => j.UcbkVan, false));
                    return;

                case JobProperty.Van:
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s => s
                            .SetProperty(j => j.UcbkVan, bool.Parse(value))
                            .SetProperty(j => j.Truck, false));
                    return;

                case JobProperty.VanOK:
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.VanOk, bool.Parse(value)));
                    return;

                case JobProperty.RefA:
                    var refA = value[..Math.Min(value.Length, 20)];
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s =>
                            s.SetProperty(j => j.UcbkClientRefa, refA));
                    return;

                case JobProperty.RefB:
                    var refB = value[..Math.Min(value.Length, 15)];
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s =>
                            s.SetProperty(j => j.UcbkClientRefb, refB));
                    return;

                case JobProperty.OurRef:
                    var ourRef = value[..Math.Min(value.Length, 20)];
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkOurRef, ourRef));
                    return;

                case JobProperty.DGClass:
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.Dgclass, int.Parse(value)));
                    return;

                case JobProperty.Direct:
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.Direct, bool.Parse(value)));
                    return;

                case JobProperty.TrackingMobile:
                    var trackingMobile = value[..Math.Min(value.Length, 100)];
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s =>
                            s.SetProperty(j => j.TrackingMobile, trackingMobile));
                    return;

                case JobProperty.TrackingEmail:
                    var trackingEmail = value[..Math.Min(value.Length, 100)];
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s =>
                            s.SetProperty(j => j.TrackingEmail, trackingEmail));
                    return;

                case JobProperty.Amount:
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkAmount, decimal.Parse(value)));
                    return;

                case JobProperty.AcceptedJobTypeID:
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.AcceptedJobTypeId, short.Parse(value)));
                    return;

                case JobProperty.DeliverBy:
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s =>
                            s.SetProperty(j => j.DeliverByTime, DateTimeOffset.Parse(value).DateTime));
                    return;

                case JobProperty.BookedTime:
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkDate, DateTimeOffset.Parse(value).DateTime));
                    return;

                case JobProperty.StopDate:
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.StopDate, DateTimeOffset.Parse(value).DateTime));
                    return;

                case JobProperty.RestartDate:
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s =>
                            s.SetProperty(j => j.RestartDate, DateTimeOffset.Parse(value).DateTime));
                    return;

                case JobProperty.CourierId:
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.CourierId, int.Parse(value)));
                    return;

                case JobProperty.InactiveBy:
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkInActiveBy, int.Parse(value)));
                    return;

                // Updates that need to update parent + all children in one query
                case JobProperty.Time:
                    var timeValue = DateTimeOffset.Parse(value).DateTime;
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId || j.BookingParentId == jobId)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkTime, timeValue));
                    return;

                case JobProperty.Date:
                    var dateValue = DateTimeOffset.Parse(value).DateTime;
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId || j.BookingParentId == jobId)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkDate, dateValue));
                    return;

                case JobProperty.Weight:
                    var weight = short.Parse(value);
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId || j.BookingParentId == jobId)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkWeight, weight));
                    return;

                case JobProperty.CustomJobName:
                    var customName = value[..Math.Min(value.Length, 100)];
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId || j.BookingParentId == jobId)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.CustomJobName, customName));
                    return;    
                
                case JobProperty.ConNote:
                    var conNote = value[..Math.Min(value.Length, 100)];
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.Connote, conNote));
                    return;

                // Contact fields: update parent + first/last child
                case JobProperty.FromContactName:
                    var fromContact = value[..Math.Min(value.Length, 100)];
                    var firstChildIdForContact = await Context.TucJobBookings
                        .Where(c => c.BookingParentId == jobId).OrderBy(c => c.UcbkId)
                        .Select(c => c.UcbkId).FirstOrDefaultAsync();
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId || j.UcbkId == firstChildIdForContact)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.PickupFromContact, fromContact));
                    return;

                case JobProperty.FromContactPhone:
                    var fromPhone = value[..Math.Min(value.Length, 100)];
                    var firstChildIdForPhone = await Context.TucJobBookings
                        .Where(c => c.BookingParentId == jobId).OrderBy(c => c.UcbkId)
                        .Select(c => c.UcbkId).FirstOrDefaultAsync();
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId || j.UcbkId == firstChildIdForPhone)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.PickupFromPhone, fromPhone));
                    return;

                case JobProperty.ToContactName:
                    var toContact = value[..Math.Min(value.Length, 100)];
                    var lastChildIdForContact = await Context.TucJobBookings
                        .Where(c => c.BookingParentId == jobId).OrderByDescending(c => c.UcbkId)
                        .Select(c => c.UcbkId).FirstOrDefaultAsync();
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId || j.UcbkId == lastChildIdForContact)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.DeliverToContact, toContact));
                    return;

                case JobProperty.ToContactPhone:
                    var toPhone = value[..Math.Min(value.Length, 100)];
                    var lastChildIdForPhone = await Context.TucJobBookings
                        .Where(c => c.BookingParentId == jobId).OrderByDescending(c => c.UcbkId)
                        .Select(c => c.UcbkId).FirstOrDefaultAsync();
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId || j.UcbkId == lastChildIdForPhone)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.DeliverToPhone, toPhone));
                    return;

                // Updates with notes - use ExecuteUpdateAsync then create a note
                case JobProperty.Size:
                    var size = int.Parse(value);
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkSize, size));
                    noteText = $"Changed Size to {size}";
                    break;

                case JobProperty.DGDocumentation:
                    var dgDoc = bool.Parse(value);
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.Dgdocument, dgDoc));
                    noteText = $"Changed DGDocumentation to {(dgDoc ? "Yes" : "No")}";
                    break;

                case JobProperty.TrackingMethod:
                    var trackingMethodId = int.Parse(value);
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.TrackingMethod, trackingMethodId));
                    noteText = $"Changed Tracking Method to {GetTrackingName(trackingMethodId)}";
                    break;

                case JobProperty.Frequency:
                    var frequency = int.Parse(value);
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkFrequency, frequency));
                    noteText = $"Frequency of recurring job set to: {((Frequency)frequency).ToDisplayString()}";
                    break;

                case JobProperty.HolidayDelivery:
                    var holidayOption = int.Parse(value);
                    await Context.TucJobBookings.Where(j => j.UcbkId == jobId)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.HolidayDeliveryOption, holidayOption));
                    noteText =
                        $"Holiday Delivery Option set to: {((HolidayDeliveryOptions)holidayOption).ToDisplayString()}";
                    break;

                // DaysOfWeek: updates parent + all children, also handles child->parent propagation
                case JobProperty.DaysOfWeek:
                    var dayEnum = (DaysOfWeek)int.Parse(value);
                    var daysInt = (int)dayEnum;

                    // Get parent ID if this is a child's job
                    var effectiveBookingId = await Context.GetEffectiveJobBookingIdAsync(jobId);

                    // Update this job, its children, and if it's a child, also parent and siblings
                    await Context.TucJobBookings
                        .Where(j => j.UcbkId == effectiveBookingId || j.BookingParentId == effectiveBookingId)
                        .ExecuteUpdateAsync(s => s.SetProperty(j => j.UcbkDaysInt, daysInt));

                    noteText = $"Days of recurring jobs set to: {dayEnum.ToDisplayString()}";
                    break;

                // Active: needs multiple fields and conditional logic
                case JobProperty.Active:
                    var isActive = bool.Parse(value);
                    var staffId = _infoService.GetStaffId();
                    var currentTenantTime = _infoService.GetCurrentTenantTime();

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

                    noteText = $"Changed Active to {(isActive ? "Yes" : "No")}";
                    break;

                default:
                    throw new ArgumentOutOfRangeException(nameof(property), property, null);
            }

            if (!string.IsNullOrEmpty(noteText))
                await CreateNewRecurringJobNote(jobId, noteText, false);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}", 
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(RecurringJobRepository), nameof(UpdateRecurringJobAsync)));
            throw;
        }
    }

    public async Task<List<TucNoteViewModel>> GetRecurringNotesByJobIdAsync(int jobBookingId)
    {
        var effectivePrebookId = await Context.GetEffectiveJobBookingIdAsync(jobBookingId);
        var tenantTimeZone = _infoService.GetTenantTimeZone();

        var notes = await Context.TucNotes
            .Where(n => n.JobBookingId == effectivePrebookId)
            .AsNoTracking()
            .Select(NoteMappings.ActiveNoteMap)
            .ToListAsync();

        UpdateNoteDate(notes, tenantTimeZone);
        return notes;
    }

    public async Task SaveRecurringJobNote(TucNoteViewModel note)
    {
        ArgumentNullException.ThrowIfNull(note);
        ArgumentNullException.ThrowIfNull(note.JobBookingId);

        if (note.NoteId == 0)
            await CreateNewRecurringJobNote(note.JobBookingId.Value, note.NoteText, note.IsImportant,
                (NoteType)note.NoteTypeId);
        else
            await UpdateRecurringJobNote(note.NoteId, note.NoteText, note.IsImportant, (NoteType)note.NoteTypeId);
    }

    public async Task UpdateBookingDeliveryAddressAsync(UpdateAddressRequest request)
    {
        try
        {
            var address = request.Address;

            // Get the last child job ID (for delivery address)
            var lastChildId = await Context.TucJobBookings
                .AsNoTracking()
                .Where(child => child.BookingParentId == request.JobId)
                .OrderByDescending(child => child.UcbkId)
                .Select(child => child.UcbkId)
                .FirstOrDefaultAsync();

            // Update parent job and last child job (if exists)
            var rowsAffected = await Context.TucJobBookings
                .Where(jb => jb.UcbkId == request.JobId || jb.UcbkId == lastChildId)
                .ExecuteUpdateAsync(setters => setters
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
                throw new ArgumentException($"Job with ID {request.JobId} not found", nameof(request.JobId));
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(JobRepository),
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
                .AsNoTracking()
                .Where(child => child.BookingParentId == request.JobId)
                .OrderBy(child => child.UcbkId)
                .Select(child => child.UcbkId)
                .FirstOrDefaultAsync();

            // Update parent job and first child job (if exists)
            var rowsAffected = await Context.TucJobBookings
                .Where(jb => jb.UcbkId == request.JobId || jb.UcbkId == firstChildId)
                .ExecuteUpdateAsync(setters => setters
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
                throw new ArgumentException($"Job with ID {request.JobId} not found", nameof(request.JobId));
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(JobRepository),
                    nameof(UpdateBookingPickupAddressAsync)));
            throw;
        }
    }
}