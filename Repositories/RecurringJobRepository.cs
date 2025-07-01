using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

public class RecurringJobRepository(IDbContextFactory<DespatchContext> contextFactory, ITenantInfoService infoService)
    : BaseJobRepository(contextFactory, infoService), IRecurringJobRepository
{
    public async Task<JobViewModel> GetRecurringJobById(int jobId)
    {
        var jobRecurringViewModel = await Context.TucJobBookings
            .Where(j => j.UcbkId == jobId)
            .Select(JobMappings.JobRecurringMapping)
            .AsNoTracking()
            .FirstOrDefaultAsync();

        jobRecurringViewModel.RelatedJobs = Context.TucJobBookings.Where(x => x.ParentId == jobRecurringViewModel.Id || (x.ParentId == null && x.UcbkId == jobRecurringViewModel.Id))
            .Select(p => new Suggestion
            {
                Id = p.UcbkId,
                Text = p.UcbkJobNumber,
            }).ToList();

        return jobRecurringViewModel;
    }

    public async Task<Tuple<int, List<JobViewModel>>> PreBookSearchAsync(
        int? courierId,
        string wild,
        string job,
        DateTime fromDate,
        DateTime toDate,
        int? clientId,
        int pageIndex,
        int pageSize
    )
    {
        var clientSet = clientId.HasValue;
        var courierSet = courierId.HasValue;
        var jobParam = $"%{job}%";
        var wildParam = $"%{wild}%";
        var jobsQuery =
            from x in Context.TucJobBookings
            join c in Context.TblCouriers on x.CourierId equals c.CourierId into courierJoin
            from co in courierJoin.DefaultIfEmpty()
            join y in Context.TucSuburbs on x.UcbkFrom equals y.UcsuId into fromJoin
            from yo in fromJoin.DefaultIfEmpty()
            join z in Context.TucSuburbs on x.UcbkTo equals z.UcsuId into toJoin
            from zo in toJoin.DefaultIfEmpty()
            join t in Context.TucJobTypes on (int)x.UcbkSpeed equals t.UcjtId into speedJoin
            from to in speedJoin.DefaultIfEmpty()
            where
                x.UcbkNextDue >= fromDate
                && x.UcbkNextDue <= toDate
                && (!clientSet || x.UcbkClientId == clientId)
                && (!courierSet || x.CourierId == courierId)
                && (job == string.Empty || EF.Functions.Like(x.UcbkJobNumber.ToLower(), jobParam))
                && (
                    wild == string.Empty
                    || EF.Functions.Like(
                        x.UcbkFromAddr
                        + " "
                        + x.PickupFromContact
                        + " "
                        + yo.UcsuName
                        + " "
                        + x.UcbkToAddr
                        + " "
                        + x.DeliverToContact
                        + " "
                        + zo.UcsuName
                        + " "
                        + (x.UcbkClientRefa ?? string.Empty)
                        + " "
                        + (x.UcbkClientRefa ?? string.Empty)
                        + " "
                        + (x.UcbkOurRef ?? string.Empty)
                        + " "
                        + x.UcbkJobNumber.ToLower(),
                        wildParam
                    )
                )
            select new JobViewModel
            {
                Id = x.UcbkId,
                Time = x.UcbkTime,
                ClientId = x.UcbkClientId,
                Client = x.UcbkClientCode,
                From = yo.UcsuName,
                To = zo.UcsuName,
                JobNo = x.UcbkJobNumber,
                FromAddress = x.UcbkFromAddr,
                ToAddress = x.UcbkToAddr,
                Courier = co.Code,
                Speed = to.ShortName,
                PickUpLatitude = x.PickUpLatitude,
                PickUpLongitude = x.PickUpLongitude,
                DeliveryLatitude = x.DeliveryLatitude,
                DeliveryLongitude = x.DeliveryLongitude,
                BookedDate = x.UcbkNextDue,
                FollowupTime = x.UcbkTime,
                PreBook = true
            };
        var stopwatch = new Stopwatch();
        stopwatch.Start();
        var total = await jobsQuery.CountAsync();
        stopwatch.Stop();
        Console.WriteLine(stopwatch.ElapsedMilliseconds);
        stopwatch.Reset();
        stopwatch.Start();
        var jobs = await jobsQuery
            .OrderBy(a => a.BookedDate)
            .ThenBy(v => v.Time)
            .Skip((pageIndex - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
        stopwatch.Stop();
        Console.WriteLine(stopwatch.ElapsedMilliseconds);
        stopwatch.Reset();
        stopwatch.Start();
        var jobList = jobs.Select(j => new JobViewModel
            {
                Id = j.Id,
                Booked = j.BookedDate.HasValue && j.Time.HasValue
                    ? new DateTime(
                        j.BookedDate.Value.Year,
                        j.BookedDate.Value.Month,
                        j.BookedDate.Value.Day,
                        j.Time.Value.Hour,
                        j.Time.Value.Minute,
                        j.Time.Value.Second
                    )
                    : null,
                Client = j.Client,
                FromAddress = j.FromAddress,
                ToAddress = j.ToAddress,
                JobNo = j.JobNo,
                ClientId = j.ClientId,
                Courier = j.Courier,
                Speed = j.Speed
            })
            .ToList();
        stopwatch.Stop();
        Console.WriteLine(stopwatch.ElapsedMilliseconds);
        return Tuple.Create(total, jobList);
    }

    public async Task<List<PrebookListViewModel>> PreBookJobListAsync(bool active)
    {
        var prebooks = await Context
            .TucJobBookings
            .Where(j => j.UcbkOneOff == false && (j.ParentId == null || j.ParentId == j.UcbkId) && j.UcbkActive == active)
            .OrderBy(j => j.UcbkDate)
            .ThenBy(j => j.UcbkTime)
            .ThenBy(j => j.UcbkJobNumber)
            .Select(j => new PrebookListViewModel
            {
                Id = j.UcbkId,
                Booked = DateTime.Parse(
                    j.UcbkNextDue.Value.ToString("yyyy-MM-dd")
                    + " "
                    + j.UcbkTime.Value.ToString("HH:mm:ss")
                ),
                Client = j.UcbkClientCode,
                FromAddress = j.UcbkFromAddr,
                ToAddress = j.UcbkToAddr,
                JobNo = j.UcbkJobNumber,
                ClientId = j.UcbkClientId,
                Courier = j.Courier.Code,
                Speed = j.UcbkSpeedNavigation.UcjtName,
                PickupAddress = new AddressViewModel
                {
                    AddressLine1 = j.PickupAddressLine1,
                    AddressLine2 = j.PickupAddressLine2,
                    AddressLine3 = j.PickupAddressLine3,
                    AddressLine4 = j.PickupAddressLine4,
                    AddressLine5 = j.PickupAddressLine5,
                    AddressLine6 = j.PickupAddressLine6,
                    AddressLine7 = j.PickupAddressLine7,
                    AddressLine8 = j.PickupAddressLine8,
                    Latitude = j.PickUpLatitude,
                    Longitude = j.PickUpLongitude
                },
                DeliveryAddress = new AddressViewModel
                {
                    AddressLine1 = j.DeliveryAddressLine1,
                    AddressLine2 = j.DeliveryAddressLine2,
                    AddressLine3 = j.DeliveryAddressLine3,
                    AddressLine4 = j.DeliveryAddressLine4,
                    AddressLine5 = j.DeliveryAddressLine5,
                    AddressLine6 = j.DeliveryAddressLine6,
                    AddressLine7 = j.DeliveryAddressLine7,
                    AddressLine8 = j.DeliveryAddressLine8,
                    Latitude = j.DeliveryLatitude,
                    Longitude = j.DeliveryLongitude
                }
            })
            .AsNoTracking()
            .ToListAsync();

        return prebooks;
    }

    public async Task<PrebookListViewModel> GetPrebookJobById(int jobBookingId)
    {
        var prebook = await Context
            .TucJobBookings
            .Where(j => j.UcbkId == jobBookingId)
            .Select(j => new PrebookListViewModel
            {
                Id = j.UcbkId,
                Booked = DateTime.Parse(
                    j.UcbkNextDue.Value.ToString("yyyy-MM-dd")
                    + " "
                    + j.UcbkTime.Value.ToString("HH:mm:ss")
                ),
                Client = j.UcbkClientCode,
                FromAddress = j.UcbkFromAddr,
                ToAddress = j.UcbkToAddr,
                JobNo = j.UcbkJobNumber,
                ClientId = j.UcbkClientId,
                Courier = j.Courier.Code,
                Speed = j.UcbkSpeedNavigation.UcjtName,
                PickupAddress = new AddressViewModel
                {
                    AddressLine1 = j.PickupAddressLine1,
                    AddressLine2 = j.PickupAddressLine2,
                    AddressLine3 = j.PickupAddressLine3,
                    AddressLine4 = j.PickupAddressLine4,
                    AddressLine5 = j.PickupAddressLine5,
                    AddressLine6 = j.PickupAddressLine6,
                    AddressLine7 = j.PickupAddressLine7,
                    AddressLine8 = j.PickupAddressLine8,
                    Latitude = j.PickUpLatitude,
                    Longitude = j.PickUpLongitude
                },
                DeliveryAddress = new AddressViewModel
                {
                    AddressLine1 = j.DeliveryAddressLine1,
                    AddressLine2 = j.DeliveryAddressLine2,
                    AddressLine3 = j.DeliveryAddressLine3,
                    AddressLine4 = j.DeliveryAddressLine4,
                    AddressLine5 = j.DeliveryAddressLine5,
                    AddressLine6 = j.DeliveryAddressLine6,
                    AddressLine7 = j.DeliveryAddressLine7,
                    AddressLine8 = j.DeliveryAddressLine8,
                    Latitude = j.DeliveryLatitude,
                    Longitude = j.DeliveryLongitude
                }
            })
            .AsNoTracking()
            .FirstOrDefaultAsync();

        return prebook;
    }

    public async Task UpdateTucJobRecurring(int jobId, JobProperty property, string value)
        {
            var job = await Context
                .TucJobBookings.Where(j => j.UcbkId == jobId)
                .Include(j => j.TucJobNationwides)
                .Include(j => j.UcbkClient)
                .Include(j => j.BookingParent)
                .ThenInclude(j => j.InverseBookingParent)
                .Include(j => j.UcbkSpeedNavigation).Include(tucJobBooking => tucJobBooking.InverseBookingParent)
                .FirstOrDefaultAsync();

            ArgumentNullException.ThrowIfNull(job);

            var updateNote = string.Empty;

            // Update the correct field prop
            switch (property)
            {
                case JobProperty.AirportOnly:
                    var airportOnly = bool.Parse(value);
                    job.TucJobNationwides.First().UcnwAirportOnly = airportOnly;
                    updateNote = $"Changed AirportOnly to {(airportOnly ? "Yes" : "No")}";
                    break;
                case JobProperty.Time:
                    job.UcbkTime = DateTime.Parse(value);
                    break;
                case JobProperty.Date:
                    job.UcbkDate = DateTime.Parse(value);
                    break;
                case JobProperty.Size:
                    job.UcbkSize = int.Parse(value);
                    updateNote = $"Changed Size to {job.UcbkSize}";
                    break;
                case JobProperty.Items:
                    job.Quantity = short.Parse(value);
                    break;
                case JobProperty.SpeedID:
                    job.UcbkSpeed = short.Parse(value);
                    updateNote = $"Changed Speed to {job.UcbkSpeedNavigation?.UcjtName}";
                    break;
                case JobProperty.AcceptedJobTypeID when !job.UcbkDone ?? false:
                    job.UcbkSpeed = short.Parse(value);
                    break;
                case JobProperty.Weight:
                    var weight = short.Parse(value);

                    // Update parent job if it exists
                    if (job.ParentId != null)
                    {
                        job.BookingParent.UcbkWeight = weight;

                        // Update all other child jobs of the parent
                        if (job.BookingParent.InverseBookingParent.Count != 0)
                        {
                            foreach (var siblingJob in job.BookingParent.InverseBookingParent)
                                siblingJob.UcbkWeight = weight;
                        }
                    }
                    // If no parent, update this job and its children
                    else
                    {
                        // Update current job
                        job.UcbkWeight = weight;

                        // Update child jobs
                        if (job.InverseBookingParent != null && job.InverseBookingParent.Count != 0)
                        {
                            foreach (var childJob in job.InverseBookingParent)
                                childJob.UcbkWeight = weight;
                        }
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
                    job.Truck = false; // Set truck to false when van is selected
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
                    updateNote = $"Changed DGDocumentation to {(dgDoc ? "Yes" : "No")}";
                    break;
                case JobProperty.TrackingMethod:
                    var trackingMethodId = int.Parse(value);
                    job.TrackingMethod = trackingMethodId;
                    updateNote = $"Changed Tracking Method to {GetTrackingName(trackingMethodId)}";
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
                    job.DeliverByTime = DateTime.Parse(value);
                    break;
                case JobProperty.BookedTime:
                    job.UcbkDate = DateTime.Parse(value);
                    break;
                case JobProperty.DaysOfWeek:
                    job.UcbkDaysInt = int.Parse(value);
                    var daysEnum = (DaysOfWeek)job.UcbkDaysInt;
                    updateNote = $"Days of recurring jobs set to: {daysEnum.ToDisplayString()}";
                    break;
                case JobProperty.Frequency:
                    job.UcbkFrequency = int.Parse(value);
                    var frequencyEnum = (Frequency)job.UcbkFrequency;
                    updateNote = $"Frequency of recurring job set to: {frequencyEnum.ToDisplayString()}";
                    break;
                case JobProperty.HolidayDelivery:
                    job.HolidayDeliveryOption = int.Parse(value);
                    var holidayEnum = (HolidayDeliveryOptions)job.HolidayDeliveryOption;
                    updateNote = $"Holiday Delivery Option set to: {holidayEnum.ToDisplayString()}";
                    break;
                default:
                    throw new ArgumentOutOfRangeException(nameof(property), property, null);
            }

            Context.TucJobBookings.Update(job);
            await Context.SaveChangesAsync();

            if (!string.IsNullOrEmpty(updateNote))
                await SaveNoteAsync(jobId, updateNote, false, true);
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
}
