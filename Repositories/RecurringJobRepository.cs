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
            .Where(j => j.UcbkActive == request.Active 
                        && !j.UcbkOneOff == false
                        && (j.ParentId == null || j.ParentId == j.UcbkId));
        
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
            .AsNoTracking()
            .ToListAsync();

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
        try
        {
            var result = await Context.TucJobBookings
                .AsNoTracking()
                .Where(j => j.UcbkId == jobId)
                .Select(j => new JobGroupViewModel
                {
                    Job = JobMappings.JobRecurringMapping.Compile()(j),
                    RelatedJobs = j.InverseBookingParent
                        .Select(JobMappings.JobRecurringMapping.Compile())
                        .ToList()
                })
                .FirstOrDefaultAsync();

            ArgumentNullException.ThrowIfNull(result);

            return result;
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}", 
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository), nameof(GetRecurringJobByIdAsync)));
            throw;
        }
    }

    public async Task UpdateRecurringJobAsync(int jobId, JobProperty property, string value)
    {
        var job = await Context.TucJobBookings
            .Where(j => j.UcbkId == jobId)
            .Include(j => j.TucJobNationwides)
            .Include(j => j.UcbkClient)
            .Include(j => j.BookingParent)
            .ThenInclude(j => j.InverseBookingParent)
            .Include(j => j.UcbkSpeedNavigation)
            .Include(j => j.InverseBookingParent)
            .FirstOrDefaultAsync();

        ArgumentNullException.ThrowIfNull(job);

        var staffId = _infoService.GetStaffId();
        var currentTenantTime = _infoService.GetCurrentTenantTime();

        var noteText = string.Empty;
        // Update the correct field prop
        switch (property)
        {
            case JobProperty.Time:
                var timeValue = DateTimeOffset.Parse(value).DateTime;
                job.UcbkTime = timeValue;

                // Update child jobs
                if (job.InverseBookingParent != null && job.InverseBookingParent.Count != 0)
                {
                    foreach (var childJob in job.InverseBookingParent)
                        childJob.UcbkTime = timeValue;
                }

                break;
            case JobProperty.Date:
                var dateValue = DateTimeOffset.Parse(value).DateTime;
                job.UcbkDate = dateValue;

                // Update child jobs
                if (job.InverseBookingParent != null && job.InverseBookingParent.Count != 0)
                {
                    foreach (var childJob in job.InverseBookingParent)
                        childJob.UcbkDate = dateValue;
                }

                break;
            case JobProperty.Size:
                job.UcbkSize = int.Parse(value);
                noteText = $"Changed Size to {job.UcbkSize}";
                break;
            case JobProperty.Items:
                job.Quantity = short.Parse(value);
                break;
            case JobProperty.SpeedID:
            case JobProperty.AcceptedJobTypeID when !job.UcbkDone ?? false:
                job.UcbkSpeed = int.Parse(value);
                break;
            case JobProperty.Weight:
                var weight = short.Parse(value);
                job.UcbkWeight = weight;

                // Update child jobs
                if (job.InverseBookingParent != null && job.InverseBookingParent.Count != 0)
                {
                    foreach (var childJob in job.InverseBookingParent)
                        childJob.UcbkWeight = weight;
                }

                break;
            case JobProperty.ClientCode:
                job.UcbkClientCode = value[..Math.Min(value.Length, 5)];
                break;
            case JobProperty.Pedal:
                job.UcbkCbd = bool.Parse(value);
                break;
            case JobProperty.Attention:
                job.UcbkAttention = bool.Parse(value);
                break;
            case JobProperty.Reprice:
                job.Reprice = bool.Parse(value);
                break;
            case JobProperty.Truck:
                job.Truck = bool.Parse(value);
                job.UcbkVan = false; // Set van to false when truck is selected
                break;
            case JobProperty.Van:
                job.UcbkVan = bool.Parse(value);
                job.Truck = false; // Set truck to false when a van is selected
                break;
            case JobProperty.VanOK:
                job.VanOk = bool.Parse(value);
                break;
            case JobProperty.RefA:
                job.UcbkClientRefa = value[..Math.Min(value.Length, 20)];
                break;
            case JobProperty.RefB:
                job.UcbkClientRefb = value[..Math.Min(value.Length, 15)];
                break;
            case JobProperty.OurRef:
                job.UcbkOurRef = value[..Math.Min(value.Length, 20)];
                break;
            case JobProperty.FromContactName:
                job.PickupFromContact = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.ToContactName:
                job.DeliverToContact = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.FromContactPhone:
                job.PickupFromPhone = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.ToContactPhone:
                job.DeliverToPhone = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.DGClass:
                job.Dgclass = int.Parse(value);
                break;
            case JobProperty.DGDocumentation:
                var dgDoc = bool.Parse(value);
                job.Dgdocument = dgDoc;
                noteText = $"Changed DGDocumentation to {(dgDoc ? "Yes" : "No")}";
                break;
            case JobProperty.TrackingMethod:
                var trackingMethodId = int.Parse(value);
                job.TrackingMethod = trackingMethodId;
                noteText = $"Changed Tracking Method to {GetTrackingName(trackingMethodId)}";
                break;
            case JobProperty.Direct:
                job.Direct = bool.Parse(value);
                break;
            case JobProperty.TrackingMobile:
                job.TrackingMobile = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.TrackingEmail:
                job.TrackingEmail = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.Amount:
                job.UcbkAmount = decimal.Parse(value);
                break;
            case JobProperty.AcceptedJobTypeID:
                job.AcceptedJobTypeId = short.Parse(value);
                break;
            case JobProperty.DeliverBy:
                job.DeliverByTime = DateTimeOffset.Parse(value).DateTime;
                break;
            case JobProperty.BookedTime:
                job.UcbkDate = DateTimeOffset.Parse(value).DateTime;
                break;
            case JobProperty.DaysOfWeek:
                var dayEnum = (DaysOfWeek)int.Parse(value);
                job.UcbkDaysInt = (int)dayEnum;

                // Update child jobs
                if (job.InverseBookingParent != null && job.InverseBookingParent.Count != 0)
                {
                    foreach (var childJob in job.InverseBookingParent)
                        childJob.UcbkDaysInt = (int)dayEnum;
                }

                noteText = $"Days of recurring jobs set to: {dayEnum.ToDisplayString()}";
                break;
            case JobProperty.Frequency:
                job.UcbkFrequency = int.Parse(value);
                var frequencyEnum = (Frequency)job.UcbkFrequency;
                noteText = $"Frequency of recurring job set to: {frequencyEnum.ToDisplayString()}";
                break;
            case JobProperty.HolidayDelivery:
                job.HolidayDeliveryOption = int.Parse(value);
                var holidayEnum = (HolidayDeliveryOptions)job.HolidayDeliveryOption;
                noteText = $"Holiday Delivery Option set to: {holidayEnum.ToDisplayString()}";
                break;
            case JobProperty.Active:
                var isActive = bool.Parse(value);

                switch (isActive)
                {
                    case true:
                        SetRecurringJobStatus(job, true);
                        break;
                    case false:
                        SetRecurringJobStatus(job, false, staffId, currentTenantTime);
                        break;
                }

                noteText = $"Changed Active to {(isActive ? "Yes" : "No")}";
                break;
            case JobProperty.CustomJobName:
                job.CustomJobName = value[..Math.Min(value.Length, 100)];
                break;
            case JobProperty.StopDate:
                job.StopDate = DateTimeOffset.Parse(value).DateTime;
                break;
            case JobProperty.CourierId:
                job.CourierId = int.Parse(value);
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(property), property, null);
        }

        await Context.SaveChangesAsync();

        if (!string.IsNullOrEmpty(noteText))
            await CreateNewRecurringJobNote(jobId, noteText, false);
    }

    private static void SetRecurringJobStatus(TucJobBooking jobBooked, bool isActive, int? staffId = null,
        DateTime? currentTenantTime = null)
    {
        jobBooked.UcbkActive = isActive;
        jobBooked.UcbkInActiveBy = isActive ? null : staffId;
        jobBooked.UcbkInActiveDate = isActive ? null : currentTenantTime;
    }

    public async Task<List<TucNoteViewModel>> GetRecurringNotesByJobIdAsync(int jobId)
    {
        var effectivePrebookId = await GetJobBookingRelationshipInfoAsync(jobId);

        return await Context.TucNotes
            .Include(n => n.NoteType)
            .Include(n => n.CreatedByNavigation)
            .Include(n => n.UpdatedByNavigation)
            .Where(n => n.JobBookingId == effectivePrebookId)
            .AsNoTracking()
            .Select(n => new TucNoteViewModel(n))
            .ToListAsync();
    }

    public async Task SaveRecurringJobNote(TucNoteViewModel note)
    {
        ArgumentNullException.ThrowIfNull(note);
        ArgumentNullException.ThrowIfNull(note.JobId);

        if (note.NoteId == 0)
            await CreateNewRecurringJobNote(note.JobId.Value, note.NoteText, note.IsImportant,
                (NoteType)note.NoteTypeId);
        else
            await UpdateRecurringJobNote(note.NoteId, note.NoteText, note.IsImportant, (NoteType)note.NoteTypeId);
    }

    public async Task UpdateBookingDeliveryAddressAsync(UpdateAddressRequest request)
    {
        try
        {
            var address = request.Address;

            // Single query that updates parent and last child (if exists)
            var rowsAffected = await Context.TucJobBookings
                .Where(jb => jb.UcbkId == request.JobId || 
                             jb.UcbkId == Context.TucJobBookings
                                 .Where(child => child.ParentId == request.JobId)
                                 .OrderByDescending(child => child.UcbkId)
                                 .Select(child => child.UcbkId)
                                 .FirstOrDefault())
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

            // Single query that updates parent and first child (if exists)
            var rowsAffected = await Context.TucJobBookings
                .Where(jb => jb.UcbkId == request.JobId || 
                             jb.UcbkId == Context.TucJobBookings
                                 .Where(child => child.ParentId == request.JobId)
                                 .OrderBy(child => child.UcbkDate)
                                 .Select(child => child.UcbkId)
                                 .FirstOrDefault())
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