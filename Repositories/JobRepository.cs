using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using DespatchWeb.Constants;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using Microsoft.EntityFrameworkCore;
using Serilog;
using CourierLocation = DespatchWeb.Models.Response.CourierLocation;

namespace DespatchWeb.Repositories;

public partial class JobRepository(
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantInfoService infoService,
    IClearListEnvelopeService clearListEnvelopeService)
    : BaseJobRepository(contextFactory, infoService, clearListEnvelopeService), IJobRepository
{
    private readonly ITenantInfoService _infoService = infoService;

    public async Task<List<Suggestion>> RelatedJobsAsync(int parentId, int clientId)
    {
        return await Context.TucJobs
            .AsNoTracking()
            .Where(j => (j.ParentId == parentId || j.ParentId == null) && j.UcjbClientId == clientId)
            .OrderBy(j => j.UcjbDate)
            .ThenBy(j => j.UcjbTime)
            .Select(j => new Suggestion { Id = j.UcjbId, Text = j.UcjbNumber })
            .ToListAsync();
    }

    /* Bulk Job Detail*/
    public async Task<JobViewModel> GetBulkJobDetailAsync(int bulkJobId)
    {
        try
        {
            var bulkJob = await Context.TblBulkJobs
                .AsNoTracking()
                .Where(j => j.BulkJobId == bulkJobId)
                .Select(JobMappings.BulkJobMapping)
                .FirstOrDefaultAsync();

            return bulkJob;
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository), nameof(GetBulkJobDetailAsync)));
            throw;
        }
    }

    public async Task<DispatchJobViewModel> GetBulkDispatchJobDetailAsync(int bulkJobId)
    {
        var isUsCustomer = _infoService.IsUsTenant();

        var bulkJob = await (
                from j in Context.TblBulkJobs
                join c in Context.TblCouriers on j.CourierId equals c.CourierId into courierJoin
                from courier in courierJoin.DefaultIfEmpty()
                join t in Context.TucJobTypes on j.Speed equals t.UcjtId into speedJoin
                from speed in speedJoin.DefaultIfEmpty()
                join s in Context.TucJobStatuses on j.JobStatus equals s.UcjsId into statusJoin
                from status in statusJoin.DefaultIfEmpty()
                join rt in Context.TucJobReadTrackers on j.JobId equals rt.JobId into rtJoin
                from readTracker in rtJoin.DefaultIfEmpty()
                join vs in Context.VehicleSizes on j.Size equals vs.VehicleSizeId into vsJoin
                from vehicleSize in vsJoin.DefaultIfEmpty()
                join cl in Context.TucClients on j.ClientId equals cl.UcclId into clientJoin
                from client in clientJoin.DefaultIfEmpty()
                where j.BulkJobId == bulkJobId
                select new DispatchJobViewModel
                {
                    Id = j.BulkJobId,
                    HasBeenRead = readTracker != null && readTracker.HasBeenRead,
                    IsParentOrSingle = !j.ParentId.HasValue || j.ParentId == j.JobId,
                    ParentId = j.ParentId,

                    IsFlightJob = speed != null
                                  && speed.GroupingId == (isUsCustomer
                                      ? (int)SpeedGrouping.Flight
                                      : (int)UrgentSpeedGrouping.Flight),
                    IsAgentJob = speed != null
                                 && speed.GroupingId == (isUsCustomer
                                     ? (int)SpeedGrouping.Agent
                                     : (int)UrgentSpeedGrouping.NationwideAgent),

                    Vehicle = vehicleSize != null
                        ? new Suggestion
                        {
                            Id = vehicleSize.VehicleSizeId,
                            Text = vehicleSize.VehicleName
                        }
                        : null,

                    Time = j.BookTime,
                    ClientId = j.ClientId,
                    Client = j.ClientCode,
                    ClientName = client != null ? client.UcclName : string.Empty,
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
                        Latitude = !string.IsNullOrEmpty(j.PickUpLatitude)
                            ? decimal.Parse(j.PickUpLatitude)
                            : null,
                        Longitude = !string.IsNullOrEmpty(j.PickUpLongitude)
                            ? decimal.Parse(j.PickUpLongitude)
                            : null
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
                        Latitude = !string.IsNullOrEmpty(j.DeliveryLatitude)
                            ? decimal.Parse(j.DeliveryLatitude)
                            : null,
                        Longitude = !string.IsNullOrEmpty(j.DeliveryLongitude)
                            ? decimal.Parse(j.DeliveryLongitude)
                            : null
                    },
                    JobNo = j.JobNumber,
                    Courier = courier != null ? courier.Code : null,
                    StatusId = j.JobStatus,
                    Status = status != null ? status.UcjsCode : null,
                    Speed = speed != null ? speed.ShortName : null,
                    SpeedId = j.Speed,
                    Booked = new DateTime(
                        j.BookDate.Year,
                        j.BookDate.Month,
                        j.BookDate.Day,
                        j.BookTime.Hour,
                        j.BookTime.Minute,
                        j.BookTime.Second
                    ),
                    IsBulkJob = true
                })
            .AsNoTracking()
            .FirstOrDefaultAsync();

        return bulkJob;
    }

    public async Task<JobSearchResult> BulkSearchAsync(PodSearchRequest data)
    {
        var isUsCustomer = _infoService.IsUsTenant();
        var jobSearch = (data.Job ?? string.Empty).ToLower();
        var wildSearch = (data.Wild ?? string.Empty).ToLower();

        // Build the base query
        var query = from j in Context.TblBulkJobs
            join c in Context.TblCouriers on j.CourierId equals c.CourierId into courierJoin
            from courier in courierJoin.DefaultIfEmpty()
            join t in Context.TucJobTypes on j.Speed equals t.UcjtId into speedJoin
            from speed in speedJoin.DefaultIfEmpty()
            join s in Context.TucJobStatuses on j.JobStatus equals s.UcjsId into statusJoin
            from status in statusJoin.DefaultIfEmpty()
            join rt in Context.TucJobReadTrackers on j.JobId equals rt.JobId into rtJoin
            from readTracker in rtJoin.DefaultIfEmpty()
            join vs in Context.VehicleSizes on j.Size equals vs.VehicleSizeId into vsJoin
            from vehicleSize in vsJoin.DefaultIfEmpty()
            join cl in Context.TucClients on j.ClientId equals cl.UcclId into clientJoin
            from client in clientJoin.DefaultIfEmpty()
            where
                j.BookDate.Date >= data.FromDate.Date
                && j.BookDate.Date <= data.ToDate.Date
                && (!data.ClientSet || j.ClientId == data.ClientId)
                && (!data.CourierSet || j.CourierId == data.CourierId)
                && (!data.JobSet || EF.Functions.Like(j.JobNumber.ToLower(), jobSearch))
                && (
                    !data.WildSet
                    || EF.Functions.Like(
                        (j.FromAddress ?? string.Empty)
                        + " "
                        + (j.Contact ?? string.Empty)
                        + " "
                        + (j.FromSuburb ?? string.Empty)
                        + " "
                        + (j.ToAddress ?? string.Empty)
                        + " "
                        + (j.DeliverToContact ?? string.Empty)
                        + " "
                        + (j.ToSuburb ?? string.Empty)
                        + " "
                        + (j.ClientRefa ?? string.Empty)
                        + " "
                        + (j.ClientRefb ?? string.Empty)
                        + " "
                        + (j.OurRef ?? string.Empty)
                        + " "
                        + j.JobNumber.ToLower() 
                        + " " 
                        + j.Barcode.ToLower(),
                        wildSearch
                    )
                )
            orderby j.BookDate, j.BookTime, j.JobId, j.BulkJobId
            select new DispatchJobViewModel
            {
                Id = j.BulkJobId,
                HasBeenRead = readTracker != null && readTracker.HasBeenRead,
                IsParentOrSingle = !j.ParentId.HasValue || j.ParentId == j.JobId,
                ParentId = j.ParentId,

                IsFlightJob = speed != null
                              && speed.GroupingId == (isUsCustomer
                                  ? (int)SpeedGrouping.Flight
                                  : (int)UrgentSpeedGrouping.Flight),
                IsAgentJob = speed != null
                             && speed.GroupingId == (isUsCustomer
                                 ? (int)SpeedGrouping.Agent
                                 : (int)UrgentSpeedGrouping.NationwideAgent),

                Vehicle = vehicleSize != null
                    ? new Suggestion
                    {
                        Id = vehicleSize.VehicleSizeId,
                        Text = vehicleSize.VehicleName
                    }
                    : null,

                Time = j.BookTime,
                ClientId = j.ClientId,
                Client = j.ClientCode,
                ClientName = client != null ? client.UcclName : string.Empty,
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
                    Latitude = !string.IsNullOrEmpty(j.PickUpLatitude)
                        ? decimal.Parse(j.PickUpLatitude)
                        : null,
                    Longitude = !string.IsNullOrEmpty(j.PickUpLongitude)
                        ? decimal.Parse(j.PickUpLongitude)
                        : null
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
                    Latitude = !string.IsNullOrEmpty(j.DeliveryLatitude)
                        ? decimal.Parse(j.DeliveryLatitude)
                        : null,
                    Longitude = !string.IsNullOrEmpty(j.DeliveryLongitude)
                        ? decimal.Parse(j.DeliveryLongitude)
                        : null
                },
                JobNo = j.JobNumber,
                Courier = courier != null ? courier.Code : null,
                StatusId = j.JobStatus,
                Status = status != null ? status.UcjsCode : null,
                Speed = speed != null ? speed.ShortName : null,
                SpeedId = j.Speed,
                Booked = new DateTime(
                    j.BookDate.Year,
                    j.BookDate.Month,
                    j.BookDate.Day,
                    j.BookTime.Hour,
                    j.BookTime.Minute,
                    j.BookTime.Second
                ),
                IsBulkJob = true
            };

        // Get a total count before pagination
        var totalCount = await query.CountAsync();

        // Apply pagination
        var page = data.Page ?? 0;
        var pageSize = data.PageSize ?? 50;

        var bulkJobs = await query
            .AsNoTracking()
            .Skip(page * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var hasMore = (page + 1) * pageSize < totalCount;

        return new JobSearchResult
        {
            Jobs = bulkJobs,
            TotalCount = totalCount,
            HasMore = hasMore
        };
    }

    public async Task<JobSearchResult> PodSearchAsync(PodSearchRequest data)
    {
        try
        {
            var isUsCustomer = _infoService.IsUsTenant();
            var jobSearch = $"%{data.Job}%";
            var wildSearch = $"%{data.Wild}%";

            var query =
                from j in Context.TblJobs
                join c in Context.TucCouriers on j.CourierId equals c.UccrId into courierJoin
                from co in courierJoin.DefaultIfEmpty()
                join y in Context.TucSuburbs on j.FromSuburbId equals y.UcsuId into fromJoin
                from fs in fromJoin.DefaultIfEmpty()
                join z in Context.TucSuburbs on j.ToSuburbId equals z.UcsuId into toJoin
                from ts in toJoin.DefaultIfEmpty()
                join t in Context.TucJobTypes on j.Speed equals t.UcjtId into speedJoin
                from speed in speedJoin.DefaultIfEmpty()
                join s in Context.TucJobStatuses on j.Status equals s.UcjsId into statusJoin
                from status in statusJoin.DefaultIfEmpty()
                join nw in Context.TucJobNationwides on j.JobId equals nw.UcnwJobId into nationwideJoin
                from nationwide in nationwideJoin.DefaultIfEmpty()
                join rt in Context.TucJobReadTrackers on j.JobId equals rt.JobId into rtJoin
                from readTracker in rtJoin.DefaultIfEmpty()
                join vs in Context.VehicleSizes on j.Size equals vs.VehicleSizeId into vsJoin
                from vehicleSize in vsJoin.DefaultIfEmpty()
                join cl in Context.TucClients on j.ClientId equals cl.UcclId into clientJoin
                from client in clientJoin.DefaultIfEmpty()
                where
                    j.Date.HasValue && j.Date.Value.Date >= data.FromDate.Date
                                    && j.Date.HasValue && j.Date.Value.Date <= data.ToDate.Date
                                    && (!data.ClientSet || j.ClientId == data.ClientId)
                                    && (!data.CourierSet || j.CourierId == data.CourierId)
                                    && (!data.JobSet || EF.Functions.Like(j.Number.ToLower(), jobSearch))
                                    && (
                                        !data.WildSet
                                        || Context.TucJobNationwides
                                            .Where(nw => nw.UcnwJobId == j.JobId)
                                            .Any(nw => EF.Functions.Like(
                                                (nw.UcnwFlightNo ?? string.Empty)
                                                + " "
                                                + (nw.AircraftName ?? string.Empty)
                                                + " "
                                                + (nw.CarrierFsCode ?? string.Empty)
                                                + " "
                                                + (nw.DepartureAirportName ?? string.Empty)
                                                + " "
                                                + (nw.ArrivalAirportName ?? string.Empty),
                                                wildSearch))
                                        || EF.Functions.Like(
                                            (j.FromAddress ?? string.Empty)
                                            + " "
                                            + (j.PickupFromContact ?? string.Empty)
                                            + " "
                                            + (fs.UcsuName ?? string.Empty)
                                            + " "
                                            + (j.ToAddress ?? string.Empty)
                                            + " "
                                            + (j.DeliverToContact ?? string.Empty)
                                            + " "
                                            + (ts.UcsuName ?? string.Empty)
                                            + " "
                                            + (j.ClientReferenceA ?? string.Empty)
                                            + " "
                                            + (j.ClientReferenceB ?? string.Empty)
                                            + " "
                                            + (j.OurRef ?? string.Empty)
                                            + " "
                                            + j.Number.ToLower()
                                            + " " 
                                            + j.Barcode.ToLower(),
                                            wildSearch
                                        )
                                    )
                orderby j.Date, j.Time, j.JobId
                select new DispatchJobViewModel
                {
                    Id = j.JobId,
                    HasBeenRead = readTracker != null && readTracker.HasBeenRead,
                    IsParentOrSingle = !j.ParentId.HasValue || j.ParentId == j.JobId,
                    ParentId = j.ParentId,

                    IsFlightJob = speed != null
                                  && speed.GroupingId == (isUsCustomer
                                      ? (int)SpeedGrouping.Flight
                                      : (int)UrgentSpeedGrouping.Flight),
                    IsAgentJob = speed != null
                                 && speed.GroupingId == (isUsCustomer
                                     ? (int)SpeedGrouping.Agent
                                     : (int)UrgentSpeedGrouping.NationwideAgent),

                    Vehicle = vehicleSize != null
                        ? new Suggestion
                        {
                            Id = vehicleSize.VehicleSizeId,
                            Text = vehicleSize.VehicleName
                        }
                        : null,
                    Time = j.Time,
                    ClientId = j.ClientId,
                    Client = j.ClientCode,
                    ClientName = client != null ? client.UcclName : string.Empty,

                    From = fs != null ? fs.UcsuName : null,
                    ToSuburbId = j.ToSuburbId,
                    JobNo = j.Number,
                    ToAddress = j.ToAddress,
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
                    },
                    Courier = co != null ? co.Code : null,
                    StatusId = j.Status,
                    Status = status != null ? status.UcjsCode : null,
                    Speed = speed != null ? speed.ShortName : null,
                    SpeedId = j.Speed,
                    PreBook = false,
                    PickUpLatitude = j.PickUpLatitude,
                    PickUpLongitude = j.PickUpLongitude,
                    DeliveryLatitude = j.DeliveryLatitude,
                    DeliveryLongitude = j.DeliveryLongitude,
                    Booked = j.Date.HasValue
                        ? new DateTime(
                            j.Date.Value.Year,
                            j.Date.Value.Month,
                            j.Date.Value.Day,
                            j.Time.HasValue ? j.Time.Value.Hour : 0,
                            j.Time.HasValue ? j.Time.Value.Minute : 0,
                            j.Time.HasValue ? j.Time.Value.Second : 0
                        )
                        : DateTime.MinValue,
                    IsArchived = j.Archived ?? false,
                    Locked = j.Locked.HasValue ? j.Locked != 0 : null,
                    ToAirportId = j.ToAirportId,
                    FromAirportId = j.FromAirportId
                };

            var totalCount = await query.CountAsync();

            // Apply pagination
            var page = data.Page ?? 0;
            var pageSize = data.PageSize ?? 50;

            var jobSearchResults = await query
                .AsNoTracking()
                .Skip(page * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return new JobSearchResult
            {
                Jobs = jobSearchResults,
                TotalCount = totalCount,
                HasMore = (page + 1) * pageSize < totalCount
            };
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository), nameof(PodSearchAsync)));
            throw;
        }
    }

    public async Task UpdateManualPriceAsync(List<JobManualPriceModel> data)
    {
        // Normalize all nullable values to 0 at the beginning
        foreach (var item in data)
        {
            item.Amount ??= 0;
            item.Ppd ??= 0;
            item.Fuel ??= 0;
            item.CourierPayment ??= 0;
            item.CourierFuel ??= 0;
            item.CourierBonus ??= 0;
        }

        // Validation logic remains the same
        if (
            data.Any(d =>
                d.Id <= 0
                || (
                    d.Amount > 0
                    && (
                        d.Ppd < 0
                        || d.Fuel < 0
                        || d.CourierPayment < 0
                        || d.CourierFuel < 0
                        || d.CourierBonus < 0
                        || d.Amount < d.Ppd + d.Fuel
                        || d.Amount < d.CourierPayment + d.CourierFuel + d.CourierBonus
                    )
                )
                || (
                    d.Amount < 0
                    && (
                        d.Ppd > 0
                        || d.Fuel > 0
                        || d.CourierPayment > 0
                        || d.CourierFuel > 0
                        || d.CourierBonus > 0
                        || d.Amount > d.Ppd + d.Fuel
                        || d.Amount > d.CourierPayment + d.CourierFuel + d.CourierBonus
                    )
                )
            )
        )
            throw new ArgumentException(
                "Invalid Values. Please check whether the Total is less than all other amounts");

        var jobIds = data.Select(j => j.Id).Distinct().ToList();

        if (jobIds.Count == 0)
            return;

        var idData = await Context
            .TblJobs.Where(j =>
                jobIds.Contains(j.JobId)
                || (j.ParentId.HasValue && jobIds.Contains(j.ParentId.Value))
            )
            .Select(j => new { j.JobId, ParentId = j.ParentId ?? j.JobId })
            .ToListAsync();

        var ids = idData
            .Select(j => j.JobId)
            .Concat(idData.Select(j => j.ParentId))
            .Distinct()
            .ToList();

        var dbData = await Context
            .TucJobs.Where(j =>
                (ids.Contains(j.UcjbId) || (j.ParentId.HasValue && ids.Contains(j.ParentId.Value)))
                && j.UcjbLocked != true
            )
            .ToListAsync();

        var dbDataArchive = await Context
            .TucJobArchives.Where(j =>
                (ids.Contains(j.UcjbId) || (j.ParentId.HasValue && ids.Contains(j.ParentId.Value)))
                && (j.UcjbLocked != 1 || !j.UcjbInvoiceNo.HasValue)
            )
            .ToListAsync();

        // Update job status
        await UpdateJobStatusesAsync(data, dbData, dbDataArchive);

        // Log counts for diagnostics
        Log.Information("Processing {DbDataCount} active jobs and {Count} archived jobs", dbData.Count,
            dbDataArchive.Count);
        // Keep track of jobs with changed prices
        var jobsWithChangedPrices = new HashSet<int>();
        var processedJobIds = new HashSet<int>();

        // Process individual jobs and save in batches
        foreach (var d in data)
        {
            var match =
                (dynamic)dbData.FirstOrDefault(j => j.UcjbId == d.Id)
                ?? dbDataArchive.FirstOrDefault(j => j.UcjbId == d.Id);

            if (match == null)
            {
                Log.Warning("Job with ID {DId} not found in database", d.Id);
                continue; // Skip this job instead of throwing an exception
            }

            try
            {
                // Check if the price is actually changing
                if (d.Amount.HasValue && d.Ppd.HasValue && d.Fuel.HasValue && d.CourierPayment.HasValue &&
                    d.CourierFuel.HasValue && d.CourierBonus.HasValue)
                {
                    bool priceChanged = Math.Round(match.UcjbAmount ?? 0, 4) != Math.Round(d.Amount.Value, 4) ||
                                        Math.Round(match.FuelSurchargeAmount ?? 0, 4) != Math.Round(d.Fuel.Value, 4) ||
                                        Math.Round(match.PpdexclusiveAmount ?? 0, 4) != Math.Round(d.Ppd.Value, 4);

                    if (priceChanged)
                    {
                        // Apply updates cautiously
                        match.UcjbAmount = Math.Round(d.Amount.Value, 4, MidpointRounding.AwayFromZero);
                        match.FuelSurchargeAmount = Math.Round(d.Fuel.Value, 4, MidpointRounding.AwayFromZero);
                        match.PpdexclusiveAmount = Math.Round(d.Ppd.Value, 4, MidpointRounding.AwayFromZero);
                        match.RawBaseAmount = match.UcjbAmount - match.FuelSurchargeAmount - match.PpdexclusiveAmount;
                        // Mark this job for a pricing breakdown update
                        jobsWithChangedPrices.Add(d.Id);
                        Log.Information("Job {DId} has price change - updating", d.Id);
                    }
                    else
                    {
                        Log.Information("Job {DId} price unchanged - skipping pricing breakdown update", d.Id);
                    }
                }

                // Always update these fields, regardless of price change
                match.CourierPercentage = null;
                match.CourierPayment = Math.Round(d.CourierPayment.Value, 4, MidpointRounding.AwayFromZero);
                match.CourierFuel = Math.Round(d.CourierFuel.Value, 4, MidpointRounding.AwayFromZero);
                match.CourierBonus = Math.Round(d.CourierBonus.Value, 4, MidpointRounding.AwayFromZero);

                processedJobIds.Add(d.Id);

                // Save changes for this specific job immediately
            }
            catch (Exception ex)
            {
                Log.Error("Error updating job {DId}: {ExMessage}", d.Id, ex.Message);
            }
        }

        // Process parent jobs separately
        var parentJobs = dbData
            .Select(j => new
            {
                j.UcjbId,
                ParentId = j.ParentId ?? j.UcjbId,
                UcjbAmount = j.UcjbAmount ?? 0m,
                j.FuelSurchargeAmount,
                PpdexclusiveAmount = j.PpdexclusiveAmount ?? 0m
            })
            .Concat(
                dbDataArchive.Select(j => new
                {
                    j.UcjbId,
                    ParentId = j.ParentId ?? j.UcjbId,
                    UcjbAmount = j.UcjbAmount ?? 0m,
                    j.FuelSurchargeAmount,
                    PpdexclusiveAmount = j.PpdexclusiveAmount ?? 0m
                })
            )
            .GroupBy(j => j.ParentId)
            .Where(x => x.Count() > 1)
            .ToList();

        foreach (var x in parentJobs)
        {
            try
            {
                var parentJob =
                    (dynamic)dbData.FirstOrDefault(j => j.UcjbId == x.Key)
                    ?? dbDataArchive.First(j => j.UcjbId == x.Key);

                var childJobs = x.Where(j => j.UcjbId != parentJob.UcjbId).ToList();

                if (childJobs.Count == 0)
                    continue;

                var totalAmount = childJobs.Sum(j => j.UcjbAmount);
                var totalFuel = childJobs.Sum(j => j.FuelSurchargeAmount);
                var totalPpd = childJobs.Sum(j => j.PpdexclusiveAmount);

                // Check if parent job's price is actually changing
                bool parentPriceChanged = Math.Round(parentJob.UcjbAmount ?? 0, 4) != Math.Round(totalAmount, 4) ||
                                          Math.Round(parentJob.FuelSurchargeAmount ?? 0, 4) !=
                                          Math.Round(totalFuel, 4) ||
                                          Math.Round(parentJob.PpdexclusiveAmount ?? 0, 4) != Math.Round(totalPpd, 4);

                if (parentPriceChanged)
                {
                    parentJob.UcjbAmount = totalAmount;
                    parentJob.FuelSurchargeAmount = totalFuel;
                    parentJob.PpdexclusiveAmount = totalPpd;
                    parentJob.RawBaseAmount = totalAmount - totalFuel - totalPpd;

                    // Mark this parent job for a pricing breakdown update
                    jobsWithChangedPrices.Add(x.Key);
                    Log.Information("Parent job {XKey} has price change - updating", x.Key);
                }
                else
                {
                    Log.Information("Parent job {XKey} price unchanged - skipping pricing breakdown update", x.Key);
                }

                processedJobIds.Add(x.Key);
            }
            catch (Exception ex)
            {
                Log.Error("Error processing parent job {XKey}: {ExMessage}", x.Key, ex.Message);
            }
        }

        // Only update pricing breakdowns for jobs with changed prices
        if (jobsWithChangedPrices.Count != 0)
        {
            // Get existing pricing breakdowns just for jobs with changed prices
            var existingBreakdowns = await Context.PricingBreakdowns
                .Where(pb =>
                    jobsWithChangedPrices.Contains(pb.JobId ?? 0) ||
                    jobsWithChangedPrices.Contains(pb.PrebookJobId ?? 0))
                .ToListAsync();

            if (existingBreakdowns.Count != 0)
            {
                Log.Information(
                    "Removing {ExistingBreakdownsCount} existing pricing breakdowns for {Count} jobs with changed prices",
                    existingBreakdowns.Count, jobsWithChangedPrices.Count);
                Context.PricingBreakdowns.RemoveRange(existingBreakdowns);
            }

            // Create new pricing breakdowns for jobs with changed prices
            foreach (var jobId in jobsWithChangedPrices)
            {
                var jobFromDb = dbData.FirstOrDefault(j => j.UcjbId == jobId);
                var jobFromArchive = dbDataArchive.FirstOrDefault(j => j.UcjbId == jobId);

                decimal amount;
                int? childId;

                if (jobFromDb != null)
                {
                    amount = jobFromDb.UcjbAmount ?? 0;
                    childId = jobFromDb.ParentId; // Get the ParentId as ChildId
                }
                else if (jobFromArchive != null)
                {
                    amount = jobFromArchive.UcjbAmount ?? 0;
                    childId = jobFromArchive.ParentId; // Get the ParentId as ChildId
                }
                else
                {
                    continue; // Skip if job not found
                }

                var newBreakdown = new PricingBreakdown
                {
                    JobId = jobId,
                    PrebookJobId = null,
                    ChildJobId = childId,
                    ChargeName = "Manually Rated",
                    ChargeAmount = amount,
                    Total = null,
                    Included = null,
                    Charged = null
                };

                await Context.PricingBreakdowns.AddAsync(newBreakdown);
                Log.Information("Added new pricing breakdown for job {JobId} with amount {Amount}", jobId, amount);
            }
        }
        else
        {
            Log.Information("No jobs with changed prices - skipping pricing breakdown updates");
        }

        // Finally, update all jobs to locked state
        foreach (var d in dbData.Where(j => processedJobIds.Contains(j.UcjbId))) d.UcjbLocked = true;

        foreach (var d in dbDataArchive.Where(j => processedJobIds.Contains(j.UcjbId))) d.UcjbLocked = 1;

        try
        {
            // Save all changes at once
            var changesCount = await Context.SaveChangesAsync();
            Log.Information("Successfully saved {ChangesCount} changes", changesCount);
        }
        catch (DbUpdateException ex)
        {
            Log.Error("Error saving changes: {ExMessage}", ex.Message);
            if (ex.InnerException != null)
                Log.Error("Inner exception: {InnerExceptionMessage}", ex.InnerException.Message);

            throw;
        }
    }

    private async Task UpdateJobStatusesAsync(List<JobManualPriceModel> data, List<TucJob> dbData,
        List<TucJobArchive> dbDataArchive)
    {
        var statusNames = data.Where(d => !string.IsNullOrWhiteSpace(d.StatusName))
            .Select(d => d.StatusName)
            .Distinct()
            .ToList();

        if (statusNames.Count == 0)
        {
            Log.Information("No status updates requested");
            return;
        }

        var statusLookup = await Context.TucJobStatuses
            .AsNoTracking()
            .Where(s => statusNames.Contains(s.UcjsName))
            .ToDictionaryAsync(s => s.UcjsName, s => s.UcjsId);

        // Update statuses for each job
        foreach (var d in data.Where(d => !string.IsNullOrWhiteSpace(d.StatusName)))
        {
            var match = (dynamic)dbData.FirstOrDefault(j => j.UcjbId == d.Id)
                        ?? dbDataArchive.FirstOrDefault(j => j.UcjbId == d.Id);

            if (match == null)
            {
                Log.Warning("Job with ID {DId} not found for status update", d.Id);
                continue;
            }

            if (statusLookup.TryGetValue(d.StatusName, out var statusId))
            {
                match.UcjbStatus = statusId;
                Log.Information("Job {DId} status updated to {StatusName} (ID: {StatusId})",
                    d.Id, d.StatusName, statusId);
            }
            else
            {
                Log.Warning("Status name '{StatusName}' not found in database for job {DId}",
                    d.StatusName, d.Id);
            }
        }
    }

    public async Task<List<JobDownloadModel>> PodSearchDownloadAsync(
        int? courierId,
        string wild,
        string job,
        DateTime fromDate,
        DateTime toDate,
        int? clientId
    )
    {
        var clientSet = clientId.HasValue;
        var courierSet = courierId.HasValue;
        var jobParam = $"%{job}%";
        var wildParam = $"%{wild}%";

        var jobsQuery =
            from x in Context.TblJobs
            join y in Context.TucSuburbs on x.FromSuburbId equals y.UcsuId into fromJoin
            from yo in fromJoin.DefaultIfEmpty()
            join z in Context.TucSuburbs on x.ToSuburbId equals z.UcsuId into toJoin
            from zo in toJoin.DefaultIfEmpty()
            join nw in Context.TucJobNationwides on x.JobId equals nw.UcnwJobId into nationwideJoin
            from nationwide in nationwideJoin.DefaultIfEmpty()
            where
                x.Date >= fromDate
                && x.Date <= toDate
                && (!clientSet || x.ClientId == clientId)
                && (!courierSet || x.CourierId == courierId)
                && (job == string.Empty || EF.Functions.Like(x.Number.ToLower(), jobParam))
                && (
                    wild == string.Empty
                    || EF.Functions.Like(nationwide.UcnwConNote, wildParam)
                    || EF.Functions.Like(
                        x.FromAddress
                        + Space
                        + x.PickupFromContact
                        + Space
                        + yo.UcsuName
                        + Space
                        + x.ToAddress
                        + Space
                        + x.DeliverToContact
                        + Space
                        + zo.UcsuName
                        + Space
                        + (x.ClientReferenceA ?? string.Empty)
                        + Space
                        + (x.ClientReferenceB ?? string.Empty)
                        + Space
                        + (x.OurRef ?? string.Empty)
                        + Space
                        + x.Number.ToLower(),
                        wildParam
                    )
                )
            select new { x.JobId, x.ParentId };

        var jobIds = await jobsQuery.ToListAsync();

        var ids = jobIds.Select(j => j.JobId).ToList();

        var parentIds = jobIds
            .Where(j => j.ParentId.HasValue)
            .Select(j => j.ParentId.Value)
            .ToList();

        if (parentIds.Count != 0)
            ids.AddRange(parentIds);

        ids = ids.Distinct().ToList();

        if (ids.Count == 0)
            return [];

        var query =
            from j in Context.TblJobs
            join c in Context.TucClients on j.ClientId equals c.UcclId into clientJoin
            from client in clientJoin.DefaultIfEmpty()
            join s in Context.TucJobStatuses on j.Status equals s.UcjsId into statusJoin
            from status in statusJoin.DefaultIfEmpty()
            join nj in Context.TucJobNationwides on j.JobId equals nj.UcnwJobId into nationwideJoin
            from nationwide in nationwideJoin.DefaultIfEmpty()
            join a in Context.TucAgents on j.AgentId equals a.UcagId into agentJoin
            from agent in agentJoin.DefaultIfEmpty()
            join inv in Context.TucInvoiceNos on j.InvoiceNo equals inv.UcinId into invoiceJoin
            from invoice in invoiceJoin.DefaultIfEmpty()
            join lic in Context.TucClientContacts on j.LoggedInContactId equals lic.UcctId into licJoin
            from lic in licJoin.DefaultIfEmpty()
            where ids.Contains(j.JobId) || (j.ParentId.HasValue && ids.Contains(j.ParentId.Value))
            orderby j.Number
            select new JobDownloadModel
            {
                Id = j.JobId,
                ParentId = j.ParentId,
                JobNumber = j.Number,
                CustomerName = client.UcclName,
                BookDate = DateTime.Parse(
                    $"{j.Date.Value:yyyy-MM-dd} {j.Time.Value:HH:mm:ss}"
                ),
                PickedUpDate = j.PickUpTime,
                DeliveredDate = j.CompletedTime,
                Amount = j.Amount,
                Fuel = j.FuelSurchargeAmount,
                Ppd = j.Ppdexclusiveamount,
                AgentAirlineName = nationwide != null ? nationwide.UcnwAirlineName : agent.UcagName,
                AWB = nationwide != null ? nationwide.UcnwFlightNo : null,
                CourierPayment = j.CourierPayment,
                CourierFuel = j.CourierFuel,
                CourierBonus = j.CourierBonus,
                Quantity = j.Quantity,
                Weight = j.Weight,
                Size = j.Size,
                StatusName = status.UcjsName,
                PickupAddressLine1 = j.PickupAddressLine1,
                PickupAddressLine2 = j.PickupAddressLine2,
                PickupAddressLine3 = j.PickupAddressLine3,
                PickupAddressLine4 = j.PickupAddressLine4,
                PickupAddressLine5 = j.PickupAddressLine5,
                PickupAddressLine6 = j.PickupAddressLine6,
                PickupAddressLine7 = j.PickupAddressLine7,
                PickupAddressLine8 = j.PickupAddressLine8,
                DeliveryAddressLine1 = j.DeliveryAddressLine1,
                DeliveryAddressLine2 = j.DeliveryAddressLine2,
                DeliveryAddressLine3 = j.DeliveryAddressLine3,
                DeliveryAddressLine4 = j.DeliveryAddressLine4,
                DeliveryAddressLine5 = j.DeliveryAddressLine5,
                DeliveryAddressLine6 = j.DeliveryAddressLine6,
                DeliveryAddressLine7 = j.DeliveryAddressLine7,
                DeliveryAddressLine8 = j.DeliveryAddressLine8,
                ClientReferenceA = j.ClientReferenceA,
                ClientReferenceB = j.ClientReferenceB,
                ClientReferenceC = j.ClientReferenceC,
                InvoiceNumber = j.InvoiceNo,
                InvoiceDate = invoice.Created,
                IsArchived = j.Archived ?? false,
                LoggedInContact = lic.UcctFirstname + Space + lic.UcctSurname,
                RawBaseAmount = j.RawBaseAmount
            };

        var result = await query.ToListAsync();

        //Return single jobs and child jobs only, ignore parent of child jobs
        return result
            .Where(j =>
                j.Id != (j.ParentId ?? j.Id) || !result.Any(x => x.Id != j.Id && x.ParentId == j.Id)
            )
            .ToList();
    }


    public async Task<JobSearchResult> CurrentJobListAsync(int courierId, bool done, int page, int pageSize)
    {
        var isUsCustomer = _infoService.IsUsTenant();

        var query = Context.TucJobs
            .AsNoTracking()
            .Where(j => j.UcjbCourierId != null && j.UcjbCourierId == courierId
                                                && j.UcjbJobDone == done);
        
        // Get a total count before pagination
        var totalCount = await query.CountAsync();

        var mapItems = await query
            .AsNoTracking()
            .Select(JobMappings.ToDispatchMapItem)
            .ToListAsync();

        // Apply pagination
        var jobs = await query
            .Skip(page * pageSize)
            .Take(pageSize)
            .Select(JobMappings.JobDispatchMapping(isUsCustomer))
            .ToListAsync();

        var hasMore = (page + 1) * pageSize < totalCount;

        return new JobSearchResult
        {
            Jobs = jobs,
            TotalCount = totalCount,
            HasMore = hasMore,
            MapItems = mapItems
        };
    }

    public async Task<JobSearchResult> JobListAsync(
        JobQueryParams queryParams,
        bool isInternal,
        bool isUsTenant,
        string clientIds,
        List<int> selectedViewIds,
        int? selectedClearListId = null)
    {
        return await DespatchQryWithPagination(
            AppPage.Dispatch,
            queryParams,
            isInternal,
            isUsTenant,
            clientIds,
            selectedViewIds,
            null,
            selectedClearListId
        );
    }

    public async Task DispatchSelectedJobsAsync(int courierId, List<int> jobIds)
    {
        var staffId = _infoService.GetStaffId();
        var jobIdsString = string.Join(",", jobIds);
        await Context.Procedures.DESWEB_stpJob_AutoDespatchSelectedJobsAsync(jobIdsString, courierId, staffId, (int)InternalJobStatus.AwaitingPod);

        foreach (var jobId in jobIds) await Context.Procedures.DES_stpJob_AutoDespatchChildJobsAsync(jobId, (int)InternalJobStatus.AwaitingPod);
    }

    public async Task SwapPodAsync(string job1, string job2) =>
        await Context.Procedures.DESWEB_qdfSwapPODAsync(job1, job2);

    public async Task ReDispatchSelectedJobsAsync(int courierId, List<int> jobIds)
    {
        foreach (var jobId in jobIds) await Context.Procedures.uspRestoreJobAsync(jobId);
        await DispatchSelectedJobsAsync(courierId, jobIds);
    }

    public async Task ReSendSelectedJobsAsync(string jobIds)
    {
        if (string.IsNullOrWhiteSpace(jobIds))
            return;

        var jobIdArray = jobIds.Split(',', StringSplitOptions.RemoveEmptyEntries);
        var validJobIds = jobIdArray.Where(id => int.TryParse(id.Trim(), out _));

        foreach (var jobIdString in validJobIds)
        {
            var jobId = int.Parse(jobIdString.Trim());
            await Context.Procedures.uspReDespatchJobAsync(jobId);
        }
    }

    public async Task ReAssignSelectedJobsAsync(string jobIds)
    {
        if (string.IsNullOrWhiteSpace(jobIds))
            return;

        var jobIdArray = jobIds.Split(',', StringSplitOptions.RemoveEmptyEntries);
        var validJobIds = jobIdArray.Where(id => int.TryParse(id.Trim(), out _));

        foreach (var jobIdString in validJobIds)
        {
            var jobId = int.Parse(jobIdString.Trim());
            await Context.Procedures.uspReassignJobAsync(jobId);
        }
    }

    public async Task SetFirstJobAsync(int jobId, int courierId) =>
        await Context.Procedures.DES_stpJob_AutoDespatchSelectedJobs_FSCourierIDAsync(jobId, courierId);

    public async Task UpdatePodDetailsAsync(UpdatePodDetailsRequest data)
    {
        // Find if a job is in active or archive table
        var activeJob = await Context.TucJobs.FirstOrDefaultAsync(j => j.UcjbId == data.JobId);
        var isArchived = activeJob == null;
        int? parentId;

        // Determine parent ID based on job location
        if (isArchived)
        {
            var archivedJob = await Context.TucJobArchives.FirstOrDefaultAsync(j => j.UcjbId == data.JobId);
            if (archivedJob == null)
            {
                // Job isn't found in either table
                return;
            }

            parentId = archivedJob.ParentId;
        }
        else
        {
            parentId = activeJob.ParentId;
        }

        // Check for uncompleted sibling jobs (child jobs with same parent)
        var hasUncompletedSiblings = await Context.TucJobs
            .AnyAsync(j => (j.ParentId == parentId || j.ParentId == null) &&
                           j.UcjbId != data.JobId &&
                           j.UcjbId != parentId &&
                           j.UcjbJobDone == false &&
                           j.UcjbVoid == false);

        // Update job record with completion details
        await UpdateJobCompletionDetailsAsync(
            data.JobId,
            data.JobStatus,
            data.PodName,
            data.PodTime,
            isArchived);

        // Update a parent job if all siblings are complete
        if (!hasUncompletedSiblings && parentId != null)
        {
            await UpdateParentJobCompletionDetailsAsync(
                parentId.Value,
                data.JobStatus,
                data.PodName,
                data.PodTime,
                isArchived);
        }

        await Context.SaveChangesAsync();
    }

    private async Task UpdateJobCompletionDetailsAsync(
        int jobId,
        int jobStatus,
        string podName,
        string podTime,
        bool isArchived)
    {
        if (isArchived)
        {
            var archivedJob = await Context.TucJobArchives
                .FirstOrDefaultAsync(j => j.UcjbId == jobId && j.UcjbJobDone == false);

            if (archivedJob != null)
            {
                archivedJob.UcjbJobDone = true;
                archivedJob.UcjbStatus = jobStatus;
                archivedJob.UcjbPodname ??= podName;
                archivedJob.UcjbComplTime ??= DateTime.Parse(podTime);
                archivedJob.InternalStatus = (int)InternalJobStatus.Reprice;
            }
        }
        else
        {
            var activeJob = await Context.TucJobs
                .FirstOrDefaultAsync(j => j.UcjbId == jobId && j.UcjbJobDone == false);

            if (activeJob != null)
            {
                activeJob.UcjbJobDone = true;
                activeJob.UcjbStatus = jobStatus;
                activeJob.UcjbPodname ??= podName;
                activeJob.UcjbComplTime ??= DateTime.Parse(podTime);
                activeJob.InternalStatus = (int)InternalJobStatus.Reprice;
            }
        }
    }

    private async Task UpdateParentJobCompletionDetailsAsync(
        int parentId,
        int jobStatus,
        string podName,
        string podTime,
        bool isArchived)
    {
        if (isArchived)
        {
            var parentJob = await Context.TucJobArchives
                .FirstOrDefaultAsync(j => j.UcjbId == parentId &&
                                          j.UcjbJobDone == false &&
                                          j.UcjbSpeed != 79);

            if (parentJob != null)
            {
                parentJob.UcjbJobDone = true;
                parentJob.UcjbStatus = jobStatus;
                parentJob.UcjbPodname ??= podName;
                parentJob.UcjbComplTime ??= DateTime.Parse(podTime);
            }
        }
        else
        {
            var parentJob = await Context.TucJobs
                .FirstOrDefaultAsync(j => j.UcjbId == parentId &&
                                          j.UcjbJobDone == false &&
                                          j.UcjbSpeed != 79);

            if (parentJob != null)
            {
                parentJob.UcjbJobDone = true;
                parentJob.UcjbStatus = jobStatus;
                parentJob.UcjbPodname ??= podName;
                parentJob.UcjbComplTime ??= DateTime.Parse(podTime);
            }
        }
    }

    public async Task ReSendAllJobsAsync(int courierId) =>
        await Context.Procedures.uspReDespatchJobByCourierIDAsync(courierId);

    public async Task<int> MaxAutoLatePickupAlertAsync()
    {
        var maxAutoLatePickupAlert = new OutputParameter<int?>();
        await Context.Procedures.GEN_qdfSetting_GetMaxAutoLatePickupAlertAsync(maxAutoLatePickupAlert);
        return maxAutoLatePickupAlert.Value ?? 0;
    }

    public async Task<int> MaxAutoLateDeliveryAlertAsync()
    {
        var maxAutoLateDeliveryAlert = new OutputParameter<int?>();
        await Context.Procedures.GEN_qdfSetting_GetMaxAutoLateDeliveryAlertAsync(maxAutoLateDeliveryAlert);
        return maxAutoLateDeliveryAlert.Value ?? 0;
    }

    public async Task<decimal> PpdExclusiveAmountAsync(int clientId, decimal amount) =>
        await CalculateAmountAsync(clientId, amount);

    public async Task ResetLateEventAsync(int jobId, int lateEventType)
    {
        switch (lateEventType)
        {
            case (int)LateEventType.Pickup:
                await Context.TucJobs
                    .Where(j => j.UcjbId == jobId)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(j => j.LatePickupNotificationHasBeenSent, false));
                break;
            case (int)LateEventType.Delivery:
                await Context.TucJobs
                    .Where(j => j.UcjbId == jobId)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(j => j.LateDeliveryNotificationHasBeenSent, false));
                break;
        }
    }

    public async Task LatePickupAsync(
        int jobId,
        string bookedSpeed,
        string notifiedSpeed,
        int late,
        bool calculationRequired
    )
    {
        var currentDate = _infoService.GetCurrentTenantTime();

        var time = await Context.TucJobTypes
            .Where(jt => jt.ShortName == bookedSpeed || jt.ShortName == notifiedSpeed)
            .MaxAsync(jt => jt.PickupTime);

        // Get job information
        var job = await Context.TucJobs.FirstOrDefaultAsync(j => j.UcjbId == jobId);
        ArgumentNullException.ThrowIfNull(job);

        if (!job.UcjbTime.HasValue) return;

        var jobDateTime = job.UcjbDate.Add(job.UcjbTime.Value.TimeOfDay);
        var windowValue = job.UcjbLatePick ?? time;

        if (!windowValue.HasValue) return;

        var dueMins = (jobDateTime.AddMinutes((double)windowValue) - currentDate).TotalMinutes;
        var latePick = job.UcjbLatePick;

        if (calculationRequired)
        {
            var pickupEtaValue = late;
            late = (int)(pickupEtaValue - (int)dueMins + windowValue);
            if (latePick.GetValueOrDefault(0) == late) return;
        }

        var minsOver = late - time;
        await SaveNoteAsync(jobId: jobId, noteText: $"Late Pickup: {minsOver} mins over ETA");

        // Update job
        job.UcjbStatus = (int)JobStatus.LatePickup;
        job.UcjbLatePick = late;
        job.LatePickupNotificationHasBeenSent = false;

        await Context.SaveChangesAsync();
    }

    public async Task LateDeliveryAsync(
        int jobId,
        string bookedSpeed,
        string notifiedSpeed,
        int late,
        bool calculationRequired
    )
    {
        var currentDate = _infoService.GetCurrentTenantTime();

        // Get the maximum delivery time for the specified speeds
        var time = await Context.TucJobTypes
            .Where(predicate: jt => jt.ShortName == bookedSpeed || jt.ShortName == notifiedSpeed)
            .MaxAsync(selector: jt => jt.DeliveryTime);

        // Get job information
        var job = Context.TucJobs.FirstOrDefault(predicate: j => j.UcjbId == jobId);
        ArgumentNullException.ThrowIfNull(argument: job);

        if (!job.UcjbTime.HasValue) return;

        // Calculate DueMins, LateDel, and Window
        var jobDateTime = job.UcjbDate.Add(value: job.UcjbTime.Value.TimeOfDay);
        var windowValue = job.UcjbLateDel ?? time;

        if (!windowValue.HasValue) return;

        var dueMins = (jobDateTime.AddMinutes(value: (double)windowValue) - currentDate).TotalMinutes;
        var lateDel = job.UcjbLateDel;

        // Perform calculation if required
        if (calculationRequired)
        {
            var deliveryEtaValue = late;
            late = (int)(deliveryEtaValue - (int)dueMins + windowValue);

            // Return if lateDel is already equal to late
            if (lateDel.GetValueOrDefault(defaultValue: 0) == late) return;
        }

        // Format delivery time
        var minsOver = late - time;

        await SaveNoteAsync(jobId: jobId, noteText: $"Late Delivery: {minsOver} mins over ETA");

        // Update job
        job.UcjbStatus = (int)JobStatus.LateDelivery;
        job.UcjbLateDel = late;
        job.LateDeliveryNotificationHasBeenSent = false;

        await Context.SaveChangesAsync();
    }

    public async Task RestoreSplitJobsAsync(List<int> jobIds)
    {
        if (jobIds == null || jobIds.Count == 0)
            return;

        foreach (var jobId in jobIds) await Context.Procedures.DES_stpJob_SplitJobRestoreAsync(jobId);
    }

    public async Task RestoreJobsAsync(List<int> jobIds)
    {
        if (jobIds == null || jobIds.Count == 0)
            return;

        foreach (var jobId in jobIds) await Context.Procedures.uspRestoreJobAsync(jobId);
    }

    public async Task VoidJobAsync(VoidJobRequest data)
    {
        try
        {
            List<int> jobsToVoid;

            if (data.VoidSingleJobOnly)
                jobsToVoid = [data.JobId];
            else
                jobsToVoid = await GetAllRelatedJobIdsIncludingParentAsync(data.JobId);

            // Add Notes
            foreach (var id in jobsToVoid) await SaveNoteAsync(id, data.VoidReason);

            var courierMapping = await Context.TblJobs
                .Where(jt => jobsToVoid.Contains(jt.JobId) && jt.CourierId.HasValue)
                .Select(jt => jt.CourierId)
                .Distinct()
                .ToListAsync();

            await Context.TucJobs
                .Where(j => jobsToVoid.Contains(j.UcjbId))
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(j => j.UcjbStatus, (int)JobStatus.Void)
                    .SetProperty(j => j.UcjbVoid, true));

            foreach (var courierId in courierMapping)
                await Context.Procedures.UTL_stpCourier_ResetClearListAreaOrderAsync(courierId);

            // Close tasks based on the voiding scope
            await CloseTasksByJobIdAsync(data.JobId, data.VoidSingleJobOnly);

            await Context.SaveChangesAsync();
        }
        catch (Exception e)
        {
            Log.Error(e, "Error voiding job {JobId} (SingleOnly: {VoidSingleJobOnly})", data.JobId,
                data.VoidSingleJobOnly);
            throw;
        }
    }

    public async Task VoidBulkJobAsync(VoidBulkJobRequest data)
    {
        try
        {
            List<int> jobsToVoid;

            if (data.VoidSingleJobOnly)
                jobsToVoid = [data.BulkJobId];
            else
                jobsToVoid = await GetAllRelatedBulkJobIdsIncludingParentAsync(data.BulkJobId);

            // Add Notes
            foreach (var bulkId in jobsToVoid) await SaveBulkNoteAsync(bulkId, data.VoidReason);

            var courierMapping = await Context.TblBulkJobs
                .Where(jt => jobsToVoid.Contains(jt.BulkJobId) && jt.CourierId.HasValue)
                .Select(jt => jt.CourierId)
                .Distinct()
                .ToListAsync();

            await Context.TblBulkJobs
                .Where(j => jobsToVoid.Contains(j.BulkJobId))
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(j => j.JobStatus, (int)JobStatus.Void)
                    .SetProperty(j => j.Void, true));

            foreach (var courierId in courierMapping)
                await Context.Procedures.UTL_stpCourier_ResetClearListAreaOrderAsync(courierId);

            // Close tasks based on the voiding scope
            await CloseBulkTasksByBulkJobIdAsync(data.BulkJobId, data.VoidSingleJobOnly);

            await Context.SaveChangesAsync();
        }
        catch (Exception e)
        {
            Log.Error(e, "Error voiding job {JobId} (SingleOnly: {VoidSingleJobOnly})", data.BulkJobId,
                data.VoidSingleJobOnly);
            throw;
        }
    }

    private async Task<List<int>> GetAllRelatedJobIdsIncludingParentAsync(int jobId)
    {
        List<int> relatedJobIds;

        // Close tasks for all related jobs (original behavior)
        var parentId = await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => j.ParentId)
            .FirstOrDefaultAsync();

        if (parentId.HasValue)
        {
            relatedJobIds = await Context.TucJobs
                .Where(j => j.UcjbId == jobId)
                .SelectMany(x => x.Parent.InverseParent)
                .Select(j => j.UcjbId)
                .ToListAsync();

            // Add parentId
            relatedJobIds.Add(parentId.Value);
        }
        else
        {
            relatedJobIds = await Context.TucJobs
                .Where(j => j.UcjbId == jobId)
                .SelectMany(x => x.InverseParent)
                .Select(j => j.UcjbId)
                .ToListAsync();

            // Add this jobId
            relatedJobIds.Add(jobId);
        }

        return relatedJobIds;
    }

    private async Task<List<int>> GetAllRelatedBulkJobIdsIncludingParentAsync(int bulkJobId)
    {
        List<int> relatedBulkJobIds;

        // Close tasks for all related jobs (original behavior)
        var parentId = await Context.TblBulkJobs
            .Where(j => j.BulkJobId == bulkJobId)
            .Select(j => j.BulkParentId)
            .FirstOrDefaultAsync();

        if (parentId.HasValue)
        {
            relatedBulkJobIds = await Context.TblBulkJobs
                .Where(j => j.BulkJobId == bulkJobId)
                .SelectMany(x => x.Parent.InverseParent)
                .Select(j => j.BulkJobId)
                .ToListAsync();

            // Add parentId
            relatedBulkJobIds.Add(parentId.Value);
        }
        else
        {
            relatedBulkJobIds = await Context.TblBulkJobs
                .Where(j => j.BulkJobId == bulkJobId)
                .SelectMany(x => x.InverseParent)
                .Select(j => j.BulkJobId)
                .ToListAsync();

            // Add this jobId
            relatedBulkJobIds.Add(bulkJobId);
        }

        return relatedBulkJobIds;
    }

    public async Task SplitJobAsync(int jobId, string user) =>
        await Context.Procedures.DES_stpJob_SplitJobAsync(jobId, false, user);

    public async Task<string> UnSplitJobAsync(int jobId)
    {
        var message = new OutputParameter<string>();
        var returnValue = new OutputParameter<int>();

        await Context.Procedures.DES_stpJob_UnSplitAsync(jobId, message, returnValue);
        return message.Value;
    }

    public async Task UpdateSplitJobAddressAsync(
        int jobId,
        int toSuburbId,
        string address,
        decimal deliveryLat,
        decimal deliveryLng
    )
    {
        await Context.Procedures.DESWEB_stpUpdateSplitJobMeetingAddressAsync(
            jobId,
            toSuburbId,
            address,
            deliveryLat,
            deliveryLng
        );
    }

    public async Task ReRateSplitJobAsync(int jobId) =>
        await Context.Procedures.DES_stpJob_SplitJob_ReRateAsync(jobId, false);

    public async Task FinishSplitJobProcessAsync(int jobId, string despatcher)
    {
        await Context.Procedures.DES_stpJob_ColsolidateMarsInformationAsync(
            jobId,
            false,
            despatcher,
            null
        );

        await UpdateJobDisplayInDespatchAsync(jobId);
    }

    private async Task UpdateJobDisplayInDespatchAsync(int jobId)
    {
        await Context.TucJobs
            .Where(j => j.RootParentId == jobId)
            .ExecuteUpdateAsync(j => j.SetProperty(x => x.DisplayInDespatch, true));
    }


    public async Task<List<SuburbLookup>> GetSuburbsAsync()
    {
        return await Context.TucSuburbs
            .AsNoTracking()
            .Select(x => new SuburbLookup
            {
                Id = x.UcsuId,
                Text = x.UcsuName,
                Alias = x.GoogleSuburbAlias
            })
            .ToListAsync();
    }

    public async Task<List<Suggestion>> GetSpeedsAsync()
    {
        return await Context.DesQryAllJobTypes
            .AsNoTracking()
            .Select(x => new Suggestion { Id = x.JobTypeId, Text = x.Name })
            .ToListAsync();
    }

    public async Task<List<Suggestion>> GetContactsByClientIdAsync(int clientId)
    {
        var contacts = await Context.UtlQryContactLookups
            .AsNoTracking()
            .Join(
                Context.TblClientContacts,
                s => s.ContactId,
                cc => cc.ContactId,
                (s, cc) => new { s, cc }
            )
            .Where(x => x.cc.ClientId == clientId && x.s.Active)
            .Select(x => new Suggestion { Id = x.s.ContactId, Text = x.s.UcctFirstname + Space + x.s.UcctSurname })
            .Distinct()
            .ToListAsync();

        return contacts;
    }

    public async Task<List<Lookup>> LeaveParcelLocationsAsync()
    {
        return await Context.TblJobLeaveNotHomes
            .AsNoTracking()
            .OrderBy(l => l.Sequence)
            .Select(x => new Lookup { Id = x.LeaveNotHomeId, Text = x.Name })
            .ToListAsync();
    }

    public async Task<List<UndeliverableLocation>> UndeliverableLocationsAsync()
    {
        return await Context.TblUndeliverableLocations
            .AsNoTracking()
            .OrderBy(u => u.Name)
            .Select(x => new UndeliverableLocation
            {
                Id = x.UndeliverableLocationId,
                Text = x.Name,
                JobStatusId = x.JobTypeId
            })
            .ToListAsync();
    }

    public async Task<List<InternalStatus>> GetInternalStatusListAsync()
    {
        return await Context
            .TucJobInternalStatuses
            .AsNoTracking()
            .Where(x => x.Tcis != (int)InternalJobStatus.OvernightCp
                        && x.Tcis != (int)InternalJobStatus.ActionRequired)
            .OrderBy(u => u.Tcis)
            .Select(x => new InternalStatus
            {
                Id = x.Tcis,
                Text = x.TcisName,
                DefaultSchedule = x.DefaultSchedule,
                DefaultMins = x.DefaultMinutes
            })
            .ToListAsync();
    }

    public async Task<List<Suggestion>> GetStatusListAsync()
    {
        return await Context.TucJobStatuses
            .AsNoTracking()
            .OrderBy(s => s.UcjsName)
            .Select(s => new Suggestion { Id = s.UcjsId, Text = s.UcjsName })
            .ToListAsync();
    }

    public async Task<List<Suggestion>> EventTypeListAsync()
    {
        return await Context.TucEventTypes
            .AsNoTracking()
            .Where(u => u.UcetGroup == "CS" || u.UcetGroup == "GE")
            .OrderBy(u => u.UcetName)
            .Select(x => new Suggestion { Id = x.UcetId, Text = x.UcetName })
            .ToListAsync();
    }

    public async Task<List<ChargeViewModel>> GetJobPriceBreakdownAsync(int jobId, bool isPrebook)
    {
        int effectivePrebookId;
        if (isPrebook)
        {
            effectivePrebookId = await GetJobBookingRelationshipInfoAsync(jobId);
            return await Context.PricingBreakdowns
                .AsNoTracking()
                .Where(p => p.PrebookJobId == effectivePrebookId)
                .Select(p => new ChargeViewModel
                {
                    ChargeId = p.PricingBreakdownId,
                    Amount = p.ChargeAmount,
                    Name = p.ChargeName,
                    JobId = p.JobId,
                    PrebookJobId = p.PrebookJobId,
                    CostAmount = p.CostAmount
                })
                .ToListAsync();
        }

        var effectiveJobId = await GetJobRelationshipInfoAsync(jobId);
        var pricingBreakdowns = await Context.PricingBreakdowns
            .AsNoTracking()
            .Where(p => p.JobId == effectiveJobId)
            .Select(p => new ChargeViewModel
            {
                ChargeId = p.PricingBreakdownId,
                Amount = p.ChargeAmount,
                Name = p.ChargeName,
                JobId = p.JobId,
                PrebookJobId = p.PrebookJobId,
                CostAmount = p.CostAmount,
                ChildJobId = p.ChildJobId
            })
            .ToListAsync();

        return pricingBreakdowns;
    }

    public async Task<int> AddJobPriceBreakdownAsync(ChargeViewModel viewModel)
    {
        try
        {
            if (viewModel.ChildJobId is null && viewModel.PrebookJobId is null)
                return 0;

            var isPrebook = viewModel.PrebookJobId.HasValue;

            int effectiveJobId;
            if (!isPrebook) effectiveJobId = await GetJobRelationshipInfoAsync(viewModel.ChildJobId ?? 0);
            else effectiveJobId = await GetJobBookingRelationshipInfoAsync(viewModel.PrebookJobId ?? 0);

            var item = new PricingBreakdown
            {
                ChargeAmount = viewModel.Amount,
                ChargeName = viewModel.Name,
                JobId = !isPrebook ? effectiveJobId : null,
                PrebookJobId = isPrebook ? effectiveJobId : null,
                CostAmount = viewModel.CostAmount,
                ChildJobId = viewModel.ChildJobId
            };

            var note = $"Added price component: {viewModel.Name} for ${viewModel.Amount:F2}";
            switch (isPrebook)
            {
                case true:
                    await SetPrebookJobAsManuallyPriceAsync(viewModel.PrebookJobId.Value, note);
                    break;
                default:
                    if (viewModel.ChildJobId != null)
                        await SetJobAsManuallyPriceAsync(viewModel.ChildJobId.Value, note);
                    break;
            }

            await Context.PricingBreakdowns.AddAsync(item);
            await Context.SaveChangesAsync();

            return item.PricingBreakdownId;
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository),
                    nameof(AddJobPriceBreakdownAsync)));
            throw;
        }
    }

    public async Task UpdateJobPriceBreakdownAsync(ChargeViewModel viewModel)
    {
        if (viewModel.JobId is null && viewModel.PrebookJobId is null) return;

        var rowsAffected = await Context.PricingBreakdowns
            .Where(p => p.PricingBreakdownId == viewModel.ChargeId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(p => p.ChargeAmount, viewModel.Amount)
                .SetProperty(p => p.ChargeName, viewModel.Name)
                .SetProperty(p => p.CostAmount, viewModel.CostAmount));

        if (rowsAffected == 0) return;

        var note = $"Updated price breakdown: {viewModel.Name} charge amount changed to {viewModel.Amount:C}";

        if (viewModel.PrebookJobId != null)
            await SetPrebookJobAsManuallyPriceAsync(viewModel.PrebookJobId.Value, note);
        else if (viewModel.JobId != null) await SetJobAsManuallyPriceAsync(viewModel.JobId.Value, note);
    }

    public async Task DeleteJobPriceBreakdownAsync(int chargeId)
    {
        var breakdown = await Context.PricingBreakdowns
            .FirstOrDefaultAsync(p => p.PricingBreakdownId == chargeId);
        if (breakdown == null) return;

        var note = $"Deleted {chargeId} - {breakdown.ChargeName} - {breakdown.ChargeAmount}";

        var isPrebook = breakdown.PrebookJobId.HasValue;
        switch (isPrebook)
        {
            case true:
                if (breakdown.PrebookJobId != null)
                    await SetPrebookJobAsManuallyPriceAsync(breakdown.PrebookJobId.Value, note);
                break;
            default:
                if (breakdown.JobId != null) await SetJobAsManuallyPriceAsync(breakdown.JobId.Value, note);
                break;
        }

        Context.PricingBreakdowns.Remove(breakdown);
        await Context.SaveChangesAsync();
    }

    private async Task SetJobAsManuallyPriceAsync(int jobId, string note)
    {
        await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(j => j.RatedManually, true));

        await SaveNoteAsync(jobId, note);
    }

    private async Task SetPrebookJobAsManuallyPriceAsync(int prebookJobId, string note)
    {
        await Context.TucJobBookings
            .Where(j => j.UcbkId == prebookJobId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(j => j.RatedManually, true));

        await CreateNewRecurringJobNote(prebookJobId, note, false);
    }

    public async Task VoidPrebookJobAsync(int jobId)
    {
        var staffInfo = await _infoService.GetStaffInfoAsync();
        await Context.Procedures.DESWEB_stpVoidPrebookJobAsync(jobId, staffInfo.Text, staffInfo.Id);
    }

    public async Task UpdateDeliveryAddressAsync(UpdateAddressRequest request)
    {
        try
        {
            var address = request.Address;

            var rowsAffected = await Context.TucJobs
                .Where(j => j.UcjbId == request.JobId)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(j => j.DeliveryLatitude, address.Latitude)
                    .SetProperty(j => j.DeliveryLongitude, address.Longitude)
                    .SetProperty(j => j.DeliveryAddressLine1, address.AddressLine1)
                    .SetProperty(j => j.DeliveryAddressLine2, address.AddressLine2)
                    .SetProperty(j => j.DeliveryAddressLine3, address.AddressLine3)
                    .SetProperty(j => j.DeliveryAddressLine4, address.AddressLine4)
                    .SetProperty(j => j.DeliveryAddressLine5, address.AddressLine5)
                    .SetProperty(j => j.DeliveryAddressLine6, address.AddressLine6)
                    .SetProperty(j => j.DeliveryAddressLine7, address.AddressLine7));

            if (rowsAffected == 0)
                throw new ArgumentException($"Job with ID {request.JobId} not found", nameof(request.JobId));
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(JobRepository),
                    nameof(UpdateDeliveryAddressAsync)));
            throw;
        }
    }

    public async Task UpdatePickupAddressAsync(UpdateAddressRequest request)
    {
        try
        {
            var address = request.Address;

            var rowsAffected = await Context.TucJobs
                .Where(j => j.UcjbId == request.JobId)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(j => j.PickUpLatitude, address.Latitude)
                    .SetProperty(j => j.PickUpLongitude, address.Longitude)
                    .SetProperty(j => j.PickupAddressLine1, address.AddressLine1)
                    .SetProperty(j => j.PickupAddressLine2, address.AddressLine2)
                    .SetProperty(j => j.PickupAddressLine3, address.AddressLine3)
                    .SetProperty(j => j.PickupAddressLine4, address.AddressLine4)
                    .SetProperty(j => j.PickupAddressLine5, address.AddressLine5)
                    .SetProperty(j => j.PickupAddressLine6, address.AddressLine6)
                    .SetProperty(j => j.PickupAddressLine7, address.AddressLine7));

            if (rowsAffected == 0)
                throw new ArgumentException($"Job with ID {request.JobId} not found", nameof(request.JobId));
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(JobRepository),
                    nameof(UpdatePickupAddressAsync)));
            throw;
        }
    }

    public async Task UpdateJobAsync(
        int jobId,
        JobProperty field,
        string value
    )
    {
        try
        {
            // Update either active or archived job
            var isActiveJob = Context.TucJobs.Any(j => j.UcjbId == jobId);
            if (isActiveJob)
            {
                await UpdateTucJobAsync(jobId, field, value);
                return;
            }

            // Job will be archived
            await UpdateTucJobArchiveAsync(jobId, field, value);
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured updating Job {jobId}", jobId);
            throw;
        }
    }

    public async Task UpdateBulkJobAsync(
        int bulkJobId,
        string field,
        string value,
        decimal? rate)
    {
        var staffInfo = await _infoService.GetStaffInfoAsync();

        await Context.Procedures.DESWEB_stpUpdateBulkJobAsync(
            bulkJobId,
            field,
            value,
            rate,
            staffInfo.Text,
            staffInfo.Id
        );
    }

    public async Task<int> QuickAddJobAsync(JobCreateViewModel request)
    {
        try
        {
            var now = _infoService.GetCurrentTenantTime();
            var staffInfo = await _infoService.GetStaffInfoAsync();

            // Generate request number
            var jobNumber = await GenerateJobNumberAsync(staffInfo.Id, request.SpeedId);
            var speed = await GetSpeedSuggestionBySpeedIdAsync(request.SpeedId);

            var jobInput = new CreateMinimalTucJobInputModel
            {
                JobNumber = jobNumber,
                FromAddress = request.PickUpAddress,
                ToAddress = request.DeliveryAddress,
                BookedBy = staffInfo.Text,
                ClientId = request.ClientId,
                AgentCourierId = null,
                Speed = speed.Text,
                SpeedId = speed.Id,
                Amount = request.Charge,
                Reference = request.RefA,
                ReferenceB = request.RefB,
                Notes = request.JobNotes,
                TenantCurrentTime = now,
                LoggedInContactId = staffInfo.Id,

                // Additional properties specific to QuickAdd
                FromContactName = request.FromContactName,
                ToContactName = request.DeliverToContact,
                PickupNotes = request.PickupNotes,
                DeliveryNotes = request.DeliveryNotes,
                PickUpLatitude = request.PickUpAddress?.Latitude,
                PickUpLongitude = request.PickUpAddress?.Longitude,
                DeliveryLatitude = request.DeliveryAddress?.Latitude,
                DeliveryLongitude = request.DeliveryAddress?.Longitude,
                Pickup = request.Date.DateTime,

                // Set other properties as needed
                Hold = false
            };

            // Call the reusable function
            var result = await CreateMinimalTucJobAsync(jobInput);
            if (!result.Success) throw new Exception($"Failed to create quick add job: {result.Message}");
            return result.JobId ?? throw new Exception("Failed to get job id from quick add job");
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository), nameof(QuickAddJobAsync)));
            throw;
        }
    }


    private async Task<CreateMinimalTucJobResponse> CreateMinimalTucJobAsync(CreateMinimalTucJobInputModel data,
        CancellationToken cancellationToken = default)
    {
        // Output parameters
        var jobIdParam = new OutputParameter<int?>();
        var messageParam = new OutputParameter<string>();
        var returnValueParam = new OutputParameter<int>();

        try
        {
            await Context.Procedures.DD_stpJob_InsertExceleratorAsync(
                bookedBy: data.BookedBy,
                fromAddress: data.FromAddress?.FullAddress,
                fromStreet: data.FromAddress != null
                    ? (data.FromAddress.AddressLine3 + " " + data.FromAddress.AddressLine4).Trim()
                    : null,
                fromBuilding: data.FromAddress?.AddressLine2,
                fromCompany: data.FromAddress?.AddressLine1,
                fromCity: data.FromAddress?.AddressLine5,
                fromState: data.FromAddress?.AddressLine6,
                fromZipCode: data.FromAddress != null ? SafeParseZipCode(data.FromAddress.AddressLine7) : null,
                speed: data.Speed,
                speedID: data.SpeedId,
                toAddress: data.ToAddress?.FullAddress,
                toStreet: data.ToAddress != null
                    ? (data.ToAddress.AddressLine3 + " " + data.ToAddress.AddressLine4).Trim()
                    : null,
                toBuilding: data.ToAddress?.AddressLine2,
                toCompany: data.ToAddress?.AddressLine1,
                toCity: data.ToAddress?.AddressLine5,
                toState: data.ToAddress?.AddressLine6,
                toZipCode: data.ToAddress != null ? SafeParseZipCode(data.ToAddress.AddressLine7) : null,
                toAddressType: data.ToAddressType,
                referenceA: data.Reference,
                referenceB: data.ReferenceB,
                vehicleSizeID: data.VehicleSizeId,
                totalWeight: null,
                totalDistance: null,
                @return: null,
                courierNotes: data.Notes,
                clientNotes: data.Notes,
                pickupNotes: data.PickupNotes,
                deliveryNotes: data.DeliveryNotes,
                fromContactName: data.FromContactName,
                fromPhoneNumber: data.FromPhoneNumber,
                toContactName: data.ToContactName,
                toPhoneNumber: data.ToPhoneNumber,
                type: data.Type,
                pickUpFrom: null,
                quantity: null,
                leaveNotHome: null,
                jobNotificationType: data.JobNotificationType,
                jobNotificationEmail: data.JobNotificationEmail,
                jobNotificationMobile: data.JobNotificationMobile,
                toAddressCode: data.ToAddressCode,
                fromAddressCode: data.FromAddressCode,
                clientID: data.ClientId,
                time: data.TenantCurrentTime,
                hold: data.Hold,
                fixedAmount: data.Amount,
                jobID: jobIdParam, // OUTPUT parameter
                agentAmount: data.AgentAmount,
                agentCourierID: data.AgentCourierId,
                fuelSurchargeAmount: data.FuelSurchargeAmount,
                ourRef: data.OurRef,
                message: messageParam, // OUTPUT parameter
                pickUpLatitude: SafeDecimalToString(data.PickUpLatitude),
                pickUpLongitude: SafeDecimalToString(data.PickUpLongitude),
                deliveryLatitude: SafeDecimalToString(data.DeliveryLatitude),
                deliveryLongitude: SafeDecimalToString(data.DeliveryLongitude),
                pickup: null,
                dropoff: null,
                privateRes: data.PrivateRes,
                truckStartTime: data.TruckStartTime,
                truckHours: null,
                jobNumber: data.JobNumber,
                storageState: null,
                deliveryState: null,
                sourceId: (int)JobSource.DespatchWeb,
                totalPallets: data.TotalPallets,
                extraStopOffs: null,
                dryIceWeight: data.DryIceWeight,
                cubic: data.Cubic,
                waitTime: null,
                dGClass: data.DgClass,
                dGDocs: data.DgClass.HasValue,
                loggedInContactId: data.LoggedInContactId,
                additionalServiceIds: data.AdditionalServiceIds,
                deliverByDateTime: data.DeliverByDateTime,
                pickupTimeZone: data.PickupTimeZone,
                deliverByTimeZone: data.DeliverByTimeZone,
                recurringName: data.RecurringName,
                recurringDays: data.RecurringDays,
                recurringFrequency: data.RecurringFrequency,
                recurringHoliday: null,
                recurringInitialDays: data.RecurringInitialDays,
                tenantCurrentTime: data.TenantCurrentTime,
                dimensionsType: null,
                cubicList: data.CubicList,
                weightList: data.WeightList,
                barcodeList: data.BarcodeList,
                returnValue: returnValueParam, // OUTPUT parameter
                cancellationToken: cancellationToken
            );

            var success = returnValueParam.Value == 0 || jobIdParam.Value.HasValue;
            return new CreateMinimalTucJobResponse
            {
                Success = success,
                JobId = jobIdParam.Value,
                Message = messageParam.Value
            };

            // Helper method to safely convert decimal to string
            string SafeDecimalToString(decimal? value) => value?.ToString();

            int? SafeParseZipCode(string zipCode)
            {
                if (string.IsNullOrWhiteSpace(zipCode) || !int.TryParse(zipCode, out int result))
                    return null;
                return result;
            }
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(JobRepository),
                    nameof(CreateMinimalTucJobAsync)));
            return new CreateMinimalTucJobResponse
            {
                Success = false,
                Message = ex.Message
            };
        }
    }

    public async Task<string> GetStaffNameAsync(int staffId) => await Context.TucStaffs
        .AsNoTracking()
        .Where(s => s.UcstId == staffId)
        .Select(s => s.UcstFirstName + " " + s.UcstLastName)
        .FirstOrDefaultAsync();

    private async Task<Suggestion> GetSpeedSuggestionBySpeedIdAsync(int speedId)
    {
        var speed = await Context.TucJobTypes
            .AsNoTracking()
            .Where(s => s.UcjtId == speedId)
            .Select(s => new Suggestion
            {
                Id = s.UcjtId,
                Text = s.UcjtName
            })
            .FirstOrDefaultAsync();

        return speed;
    }

    private async Task<Suggestion> GetDefaultSpeedType() => await Context.TucJobTypes
        .AsNoTracking()
        .Select(t => new Suggestion
        {
            Id = t.UcjtId,
            Text = t.SystemName
        })
        .FirstOrDefaultAsync();

    public async Task AddInterCourierChargeAsync(InterCourierChargeViewModel viewModel)
    {
        try
        {
            var staffId = _infoService.GetStaffId();
            var currentTime = _infoService.GetCurrentTenantTime();

            var note = $"From # {viewModel.FromCourierId} To # {viewModel.ToCourierId}";

            var fromJobNumber = await GenerateJobNumberAsync(staffId, (int)JobServiceType.AllServices);
            var toJobNumber = await GenerateJobNumberAsync(staffId, (int)JobServiceType.AllServices);

            var address = new AddressViewModel("Inter-Courier Charge", string.Empty, string.Empty, string.Empty,
                string.Empty, string.Empty, string.Empty, string.Empty);

            var staffName = await GetStaffNameAsync(staffId);
            var speed = await GetDefaultSpeedType();

            var fromJobResult = await CreateMinimalTucJobAsync(
                new CreateMinimalTucJobInputModel
                {
                    JobNumber = fromJobNumber,
                    FromAddress = address,
                    ToAddress = address,
                    BookedBy = staffName,
                    ClientId = viewModel.ClientId,
                    AgentCourierId = viewModel.FromCourierId,
                    Speed = speed.Text,
                    SpeedId = speed.Id,
                    Amount = viewModel.Amount,
                    Reference = $"To # {viewModel.ToCourierId}",
                    ReferenceB = "ICC",
                    Notes = note,
                    TenantCurrentTime = currentTime,
                    LoggedInContactId = staffId
                }
            );

            if (!fromJobResult.Success) throw new Exception($"Failed to create FROM job: {fromJobResult.Message}");

            var toJobResult = await CreateMinimalTucJobAsync(
                new CreateMinimalTucJobInputModel
                {
                    JobNumber = toJobNumber,
                    FromAddress = address,
                    ToAddress = address,
                    BookedBy = staffName,
                    ClientId = viewModel.ClientId,
                    AgentCourierId = viewModel.ToCourierId,
                    Speed = speed.Text,
                    SpeedId = speed.Id,
                    Amount = viewModel.Amount,
                    Reference = $"From # {viewModel.FromCourierId}",
                    ReferenceB = string.Empty,
                    Notes = note,
                    TenantCurrentTime = currentTime,
                    LoggedInContactId = staffId
                }
            );

            if (!toJobResult.Success) throw new Exception($"Failed to create TO job: {toJobResult.Message}");
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository),
                    nameof(AddInterCourierChargeAsync)));
            throw;
        }
    }

    public async Task<bool> HasClientItemsAvailableAsync(int clientId, int speedId)
    {
        return await Context
            .TblClientAvailableSpeeds.Where(cas =>
                cas.ClientId == clientId && cas.SpeedId == speedId
            )
            .SelectMany(cas =>
                cas.TblClientAvailableSpeedItems.Where(casi => casi.Active)
                    .Select(casi => casi.ClientItem)
            )
            .AnyAsync();
    }

    public async Task<PaginatedResponse<ClientItemsViewModel>> GetClientItemsBySpeedAsync(
        int clientId,
        int speedId,
        int jobId
    )
    {
        var job = await GetJobInfo(jobId);
        var clientItemIds = GetClientItemIds(job?.ClientItemIds);
        var clientItemsQuery = BuildClientItemsQuery(clientId, speedId, clientItemIds);
        return await CreatePagedList(clientItemsQuery);
    }

    public async Task AddClientsItemToJobAsync(
        int jobId,
        List<int> clientItemIds,
        decimal totalCost
    )
    {
        var clientItemsString =
            clientItemIds is null || clientItemIds.Count == 0
                ? string.Empty
                : string.Join(",", clientItemIds);

        await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(j => j.ClientItemIds, clientItemsString)
                .SetProperty(j => j.UcjbAmount, totalCost));
    }

    public async Task<IList<OpenJobResponse>> GetOpenJobsAsync(OpenJobsRequest parameters)
    {
        try
        {
            var query = Context.TucJobs.Where(j =>
                j.UcjbStatus != (int)JobStatus.Completed && j.UcjbStatus != (int)JobStatus.Rejected &&
                j.UcjbStatus != (int)JobStatus.Void
            );

            // Apply date range filter
            if (parameters.StartDate.HasValue)
                query = query.Where(j => j.UcjbDate >= parameters.StartDate);
            if (parameters.EndDate.HasValue)
                query = query.Where(j => j.UcjbDate <= parameters.EndDate);

            // Apply region filter if provided
            if (parameters.Regions.Count > 0)
            {
                query = query.Where(j =>
                    j.TblBulkJobs.Any(b => parameters.Regions.Contains(b.Region.BulkRegionId))
                );
            }

            // Apply speed filter if provided
            if (parameters.Speeds.Count > 0)
            {
                query = query.Where(j => parameters.Speeds.Contains(j.UcjbSpeedNavigation.UcjtId));
            }

            // Order
            query = query.OrderBy(j => j.PickUpTime.Value);

            var openJobs = await query
                .AsNoTracking()
                .Select(j => new OpenJobResponse
                {
                    JobId = j.UcjbId,
                    Reference = j.UcjbNumber,
                    Status = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsName : null,
                    PickupTime = j.PickUpTime ?? DateTime.Today,
                    PickupName = j.PickupFromContact,
                    PickupAddress = AddressFormatter.FormatWithCityStateZip(
                        new AddressFormatter.Address(
                            j.PickupAddressLine1,
                            j.PickupAddressLine2,
                            j.PickupAddressLine3,
                            j.PickupAddressLine4,
                            j.PickupAddressLine5,
                            j.PickupAddressLine6,
                            j.PickupAddressLine7,
                            j.PickupAddressLine8
                        )
                    ),
                    DeliveryTime = CalculateDeliveryTime(j),
                    DeliveryName = j.DeliverToContact,
                    DeliveryAddress = AddressFormatter.FormatWithCityStateZip(
                        new AddressFormatter.Address(
                            j.DeliveryAddressLine1,
                            j.DeliveryAddressLine2,
                            j.DeliveryAddressLine3,
                            j.DeliveryAddressLine4,
                            j.DeliveryAddressLine5,
                            j.DeliveryAddressLine6,
                            j.DeliveryAddressLine7,
                            j.DeliveryAddressLine8
                        )
                    ),
                    DriverName = j.UcjbCourier != null ? j.UcjbCourier.UccrName : null,
                    CompletedToday = j.UcjbCourier != null
                        ? j.UcjbCourier.TucJobUcjbCouriers.Count(dj =>
                            dj.UcjbStatus == (int)JobStatus.Completed
                            && dj.UcjbComplTime.HasValue
                            && dj.UcjbComplTime.Value.Date == DateTime.Today
                        )
                        : 0,
                    LastCompleted = j.UcjbCourier != null
                        ? j.UcjbCourier.TucJobUcjbCouriers.Where(dj =>
                                dj.UcjbStatus == (int)JobStatus.Completed && dj.UcjbComplTime.HasValue
                            )
                            .OrderByDescending(dj => dj.UcjbComplTime)
                            .Select(dj => dj.UcjbComplTime)
                            .FirstOrDefault()
                        : null,
                    Quantity = j.UcjbQty ?? 0,
                    PackageType = j.AcceptedJobType != null ? j.AcceptedJobType.UcjtName : null,
                    Mileage = j.TotalDistance ?? 0
                })
                .ToListAsync();

            return openJobs;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting open jobs");
            throw;
        }
    }

    private static DateTime CalculateDeliveryTime(TucJob job)
    {
        try
        {
            if (job.RequiredDeliveryTime.HasValue) return job.RequiredDeliveryTime.Value;
            if (job.DeliverByTime.HasValue) return job.DeliverByTime.Value;

            ArgumentNullException.ThrowIfNull(job.UcjbSpeedNavigation);
            ArgumentNullException.ThrowIfNull(job.UcjbSpeedNavigation.DeliveryTime);

            var dateToUse = job.PickUpTime ?? new DateTime(job.UcjbDate.Year,
                job.UcjbDate.Month,
                job.UcjbDate.Day,
                job.UcjbTime?.Hour ?? 0,
                job.UcjbTime?.Minute ?? 0,
                job.UcjbTime?.Second ?? 0);

            var deliverTime = dateToUse.AddMinutes(job.UcjbSpeedNavigation.DeliveryTime.Value);
            return deliverTime;
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository), nameof(CalculateDeliveryTime)));
            return DateTime.MinValue;
        }
    }

    private async Task<JobInfo> GetJobInfo(int jobId)
    {
        return await Context
            .TucJobs.Where(j => j.UcjbId == jobId)
            .Select(j => new JobInfo { ClientItemIds = j.ClientItemIds, IsVan = j.UcjbSize == 3 })
            .FirstOrDefaultAsync();
    }

    private static IEnumerable<int> GetClientItemIds(string clientItemIdsString)
    {
        if (string.IsNullOrEmpty(clientItemIdsString))
            return [];

        return clientItemIdsString
            .Split(',')
            .Where(s => !string.IsNullOrEmpty(s))
            .Select(int.Parse);
    }

    private IQueryable<ClientItemsViewModel> BuildClientItemsQuery(
        int clientId,
        int speedId,
        IEnumerable<int> clientItemIds
    )
    {
        return Context
            .TblClientAvailableSpeeds.Where(cas =>
                cas.ClientId == clientId && cas.SpeedId == speedId
            )
            .SelectMany(cas =>
                cas.TblClientAvailableSpeedItems.Where(casi => casi.Active)
                    .Select(casi => new ClientItemsViewModel
                    {
                        ItemId = casi.ClientItem.ItemId,
                        ClientId = casi.ClientItem.ClientId,
                        Name = casi.ClientItem.Name,
                        Description = casi.ClientItem.Description,
                        PerItem = casi.ClientItem.PerItem,
                        Rate = casi.ClientItem.Rate,
                        VehicleSizeId = casi.ClientItem.VehicleSizeId,
                        Selected = clientItemIds.Contains(casi.ClientItem.ItemId)
                    })
            );
    }

    private static async Task<PaginatedResponse<ClientItemsViewModel>> CreatePagedList(
        IQueryable<ClientItemsViewModel> query
    )
    {
        var count = await query.CountAsync();
        var items = await query.ToListAsync();

        return new PaginatedResponse<ClientItemsViewModel> { Items = items, Total = count };
    }

    private async Task<decimal> CalculateAmountAsync(int clientId, decimal amount)
    {
        var outputParam = new OutputParameter<decimal?>();
        await Context.Procedures.UTL_stpPPD_ExclusiveAmountAsync(clientId, amount, outputParam);

        return outputParam.Value ?? 0m;
    }

    private async Task<string> GenerateJobNumberAsync(
        int staffId,
        int jobTypeId,
        CancellationToken cancellationToken = default
    )
    {
        var jobNumberOutput = new OutputParameter<string>();
        var returnValue = new OutputParameter<int>();

        await Context.Procedures.NET_stpJob_Insert_JobNumberAsync(
            staffId,
            jobTypeId,
            jobNumberOutput,
            returnValue,
            cancellationToken
        );

        return jobNumberOutput.Value;
    }

    public async Task<JobLateCallDto> GetJobForLateCallAsync(int jobId)
    {
        var job = await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(JobMappings.JobLateCallMapping)
            .FirstOrDefaultAsync();

        return job;
    }

    public async Task<List<TimeZoneSuggestion>> GetTimeZoneOptions()
    {
        var timeZones = await Context.TimeZones
            .AsNoTracking()
            .Select(t => new TimeZoneSuggestion
            {
                Id = t.Id,
                Text = $"{t.DisplayName} ({t.Code})",
                TimeZoneIana = t.Name
            })
            .OrderBy(tz => tz.TimeZoneIana)
            .ToListAsync();

        return timeZones;
    }

    public async Task<List<DeliveryJourneyViewModel>> GetDeliveryJourneyForJobAsync(int jobId)
    {
        var isLiveJob = await Context.TucJobs.AnyAsync(j => j.UcjbId == jobId);

        var events = await GetEventsForDeliveryJourneyAsync(jobId);
        var messages = await GetMessagesForDeliveryJourneyAsync(jobId);
        var notes = await GetNotesForDeliveryJourneyAsync(jobId, isLiveJob);
        var statusUpdates = await GetStatusUpdatesForDeliveryJourneyAsync(jobId, isLiveJob);

        return events
            .Concat(messages)
            .Concat(notes)
            .Concat(statusUpdates)
            .OrderByDescending(x => x.Date)
            .ToList();
    }

    private async Task<List<DeliveryJourneyViewModel>> GetEventsForDeliveryJourneyAsync(int jobId)
    {
        var timezone = _infoService.GetTenantTimeZone();
        var eventsTempList = await Context.TucEvents
            .AsNoTracking()
            .Where(e => e.UcevJobId == jobId)
            .Include(e => e.UcevStaffIdinNavigation)
            .Include(e => e.UcevStaffIdoutNavigation)
            .ToListAsync();

        var events = eventsTempList.Select(e => new DeliveryJourneyViewModel
        {
            Id = Guid.NewGuid(),
            JobId = jobId,
            Title = e.UcevDescription,
            Icon = "task",
            Tags = new[]
            {
                "Task",
                e.UcevClosed ? "Completed" : "In Progress",
                $"Created by {e.UcevDespatcher}",
                e.UcevStaffIdinNavigation != null
                    ? $"Assigned to {e.UcevStaffIdinNavigation.UcstFirstName} {e.UcevStaffIdinNavigation.UcstLastName}"
                    : null,
                e.UcevStaffIdoutNavigation != null
                    ? $"Completed by {e.UcevStaffIdoutNavigation.UcstFirstName} {e.UcevStaffIdoutNavigation.UcstLastName}"
                    : null
            }.Where(tag => !string.IsNullOrWhiteSpace(tag)).ToList(),
            Date = TimeZoneHelper.SetDateTimeWithTimeZone(e.UcevDate ?? DateTime.MinValue, timezone)
        }).ToList();

        return events;
    }

    private async Task<List<DeliveryJourneyViewModel>> GetNotesForDeliveryJourneyAsync(int jobId, bool isLiveJob)
    {
        var timezone = _infoService.GetTenantTimeZone();
        List<DeliveryJourneyViewModel> notes;

        if (isLiveJob)
        {
            // Get notes from the live job table
            var notesTempList = await Context.TucNotes
                .AsNoTracking()
                .Where(n => n.JobId == jobId)
                .Include(n => n.CreatedByNavigation)
                .Include(n => n.UpdatedByNavigation)
                .ToListAsync();

            notes = notesTempList.Select(n => new DeliveryJourneyViewModel
            {
                Id = Guid.NewGuid(),
                JobId = jobId,
                Title = n.CreatedByNavigation != null
                    ? $"Note added by {n.CreatedByNavigation.UcstFirstName} {n.CreatedByNavigation.UcstLastName}"
                    : "Note added by System",
                Icon = "sticky_note_2",
                Description = n.NoteText,
                Date = TimeZoneHelper.SetDateTimeWithTimeZone(n.UpdatedDate ?? n.CreatedDate, timezone),
                Tags = new[]
                {
                    "Note",
                    n.CreatedByNavigation != null
                        ? $"Created by {n.CreatedByNavigation.UcstFirstName} {n.CreatedByNavigation.UcstLastName} on {n.CreatedDate:dd/MM/yyyy HH:mm}"
                        : null,
                    n.UpdatedByNavigation != null && n.UpdatedDate.HasValue
                        ? $"Updated by {n.UpdatedByNavigation.UcstFirstName} {n.UpdatedByNavigation.UcstLastName} on {n.UpdatedDate.Value:dd/MM/yyyy HH:mm}"
                        : null
                }.Where(tag => !string.IsNullOrWhiteSpace(tag)).ToList()
            }).ToList();
        }
        else
        {
            // Get notes from the archived job table
            var archivedNotesTempList = await Context.TucNoteArchives
                .AsNoTracking()
                .Where(n => n.JobId == jobId)
                .ToListAsync();

            notes = archivedNotesTempList.Select(n => new DeliveryJourneyViewModel
            {
                Id = Guid.NewGuid(),
                JobId = jobId,
                Title = "Note added by System",
                Icon = "sticky_note_2",
                Description = n.NoteText,
                Date = TimeZoneHelper.SetDateTimeWithTimeZone(n.UpdatedDate ?? n.CreatedDate ?? DateTime.MinValue,
                    timezone),
                Tags = new[]
                {
                    "Note",
                    n.CreatedDate.HasValue
                        ? $"Created on {n.CreatedDate.Value:dd/MM/yyyy HH:mm}"
                        : null,
                    n.UpdatedDate.HasValue
                        ? $"Updated on {n.UpdatedDate.Value:dd/MM/yyyy HH:mm}"
                        : null
                }.Where(tag => !string.IsNullOrWhiteSpace(tag)).ToList()
            }).ToList();
        }

        return notes;
    }

    private async Task<List<DeliveryJourneyViewModel>> GetMessagesForDeliveryJourneyAsync(int jobId)
    {
        var timezone = _infoService.GetTenantTimeZone();
        var messagesTempList = await Context.TucManualMessages
            .AsNoTracking()
            .Where(m => m.JobId == jobId)
            .Include(m => m.UcmmSendFromStaff)
            .Include(m => m.UcmmSendToStaff)
            .Include(m => m.UcmmSendToCourier)
            .Include(m => m.UcmmSendFromCourier)
            .ToListAsync();

        var messages = messagesTempList.Select(m => new DeliveryJourneyViewModel
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
                        m.UcmmSendToCourier != null
                            ? $"{m.UcmmSendToCourier.UccrName}, {m.UcmmSendToCourier.UccrSurname}"
                            : null,
                        m.UcmmSendToStaff != null
                            ? $"{m.UcmmSendToStaff.UcstFirstName}, {m.UcmmSendToStaff.UcstLastName}"
                            : null,
                        m.UcmmSendFromCourier != null
                            ? $"{m.UcmmSendFromCourier.UccrName}, {m.UcmmSendFromCourier.UccrSurname}"
                            : null,
                        m.UcmmSendFromStaff != null
                            ? $"{m.UcmmSendFromStaff.UcstFirstName}, {m.UcmmSendFromStaff.UcstLastName}"
                            : null,
                        m.TimeRead.HasValue ? $"Read at {m.TimeRead?.ToString("g")}" : null
                    }
                    : Array.Empty<string>())
                .Concat(!string.IsNullOrEmpty(m.SendToEmailAddress)
                    ? new[]
                    {
                        "Email",
                        $"Sent to {m.SendToEmailAddress}",
                        m.UcmmSendFromCourier != null
                            ? $"{m.UcmmSendFromCourier.UccrName}, {m.UcmmSendFromCourier.UccrSurname}"
                            : null,
                        m.UcmmSendFromStaff != null
                            ? $"{m.UcmmSendFromStaff.UcstFirstName}, {m.UcmmSendFromStaff.UcstLastName}"
                            : null
                    }
                    : Array.Empty<string>())
                .Concat(!string.IsNullOrEmpty(m.SendToMobile)
                    ? new[]
                    {
                        "SMS",
                        $"Sent to {m.SendToMobile}",
                        m.UcmmSendFromCourier != null
                            ? $"{m.UcmmSendFromCourier.UccrName}, {m.UcmmSendFromCourier.UccrSurname}"
                            : null,
                        m.UcmmSendFromStaff != null
                            ? $"{m.UcmmSendFromStaff.UcstFirstName}, {m.UcmmSendFromStaff.UcstLastName}"
                            : null
                    }
                    : Array.Empty<string>())
                .Where(tag => !string.IsNullOrWhiteSpace(tag))
                .ToList()
        }).ToList();

        return messages;
    }

    private async Task<List<DeliveryJourneyViewModel>> GetStatusUpdatesForDeliveryJourneyAsync(int jobId,
        bool isLiveJob)
    {
        var timezone = _infoService.GetTenantTimeZone();
        List<DeliveryJourneyViewModel> statusUpdates;

        if (isLiveJob)
        {
            // Get status updates from the live job table
            var statusUpdatesTempList = await Context.JobDeliveryJourneys
                .Where(j => j.JobId == jobId
                            && j.ChangeType != nameof(DeliveryJourneyChangeType.InternalStatus))
                .AsNoTracking()
                .Include(s => s.NewJobStatus)
                .Include(s => s.OldJobStatus)
                .Include(s => s.Staff)
                .Include(s => s.Courier)
                .Include(s => s.Flight)
                .Include(s => s.NewAgent)
                .Include(s => s.OldAgent)
                .ToListAsync();

            statusUpdates = statusUpdatesTempList
                .GroupBy(s => s.UpdatedAt) // Group by datetime
                .Select(group => new DeliveryJourneyViewModel
                {
                    Id = Guid.NewGuid(),
                    JobId = jobId,
                    Date = TimeZoneHelper.SetDateTimeWithTimeZone(group.Key, timezone),
                    Title = "Status Changed",
                    Description = string.Join("; ",
                        group.Select(s => s.Comments).Where(c => !string.IsNullOrWhiteSpace(c))),
                    Icon = "update",
                    Tags = group.SelectMany(s => new[]
                        {
                            s.ChangeType,
                            $"Updated on {s.UpdatedAt:dd/MM/yyyy HH:mm}",
                            s.Staff != null ? $"Updated by {s.Staff.UcstFirstName} {s.Staff.UcstLastName}" : null,
                            s.Courier != null ? $"Updated by {s.Courier.UccrName}, {s.Courier.UccrSurname}" : null,
                            s.Flight != null ? $"Flight {s.Flight.UcnwFlightNo} assigned" : null,
                            s.NewAgent != null && s.OldAgent != null
                                ? $"Reassigned from Agent {s.OldAgent.UcagName} to {s.NewAgent.UcagName}"
                                : null,
                            s.NewAgent != null && s.OldAgent == null
                                ? $"Assigned to Agent {s.NewAgent.UcagName}"
                                : null,
                            s.NewAgent == null && s.OldAgent != null
                                ? $"Unassigned from Agent {s.OldAgent.UcagName}"
                                : null,
                            s.FieldName != null ? $"Field {s.FieldName} updated" : null,
                            s.FieldName != null && s.OldValue != null ? $"Old value: {s.OldValue}" : null,
                            s.FieldName != null && s.NewValue != null ? $"New value: {s.NewValue}" : null,
                            s.NewJobStatus != null && s.OldJobStatus != null
                                ? $"Status changed from {s.OldJobStatus.UcjsName} to {s.NewJobStatus?.UcjsName}"
                                : null
                        })
                        .Where(tag => !string.IsNullOrWhiteSpace(tag))
                        .Distinct()
                        .ToList()
                })
                .ToList();
        }
        else
        {
            // Get status updates from the archived job table
            var archivedStatusUpdatesTempList = await Context.JobDeliveryJourneyArchives
                .AsNoTracking()
                .Where(j => j.JobId == jobId && j.ChangeType != nameof(DeliveryJourneyChangeType.InternalStatus))
                .ToListAsync();

            statusUpdates = archivedStatusUpdatesTempList
                .GroupBy(s => s.UpdatedAt) // Group by datetime
                .Select(group => new DeliveryJourneyViewModel
                {
                    Id = Guid.NewGuid(),
                    JobId = jobId,
                    Date = TimeZoneHelper.SetDateTimeWithTimeZone(group.Key, timezone),
                    Title = "Status Changed",
                    Description = string.Join("; ", group
                        .Select(s => s.OldJobStatusId != null && s.NewJobStatusId != null
                            ? $"Status changed from status ID {s.OldJobStatusId} to {s.NewJobStatusId}"
                            : null)
                        .Where(d => !string.IsNullOrWhiteSpace(d))),
                    Icon = "update",
                    Tags = group.SelectMany(s => new[]
                        {
                            s.ChangeType,
                            $"Updated on {s.UpdatedAt:dd/MM/yyyy HH:mm}",
                            s.UpdatedByType != null ? $"Updated by {s.UpdatedByType}" : null,
                            s.FlightId != null ? $"Flight ID {s.FlightId} assigned" : null,
                            s.NewAgentId != null && s.OldAgentId != null
                                ? $"Reassigned from Agent ID {s.OldAgentId} to {s.NewAgentId}"
                                : null,
                            s.NewAgentId != null && s.OldAgentId == null
                                ? $"Assigned to Agent ID {s.NewAgentId}"
                                : null,
                            s.FieldName != null ? $"Field {s.FieldName} updated" : null,
                            s.FieldName != null && s.OldValue != null ? $"Old value: {s.OldValue}" : null,
                            s.FieldName != null && s.NewValue != null ? $"New value: {s.NewValue}" : null,
                            s.Comments != null ? $"Comments: {s.Comments}" : null,
                            s.OldJobStatusId != null && s.NewJobStatusId != null
                                ? $"Status changed from status ID {s.OldJobStatusId} to {s.NewJobStatusId}"
                                : null
                        })
                        .Where(tag => !string.IsNullOrWhiteSpace(tag))
                        .Distinct()
                        .ToList()
                })
                .ToList();
        }

        return statusUpdates;
    }

    private async Task CloseTasksByJobIdAsync(int jobId, bool closeSingleJobTasksOnly = false)
    {
        List<int> jobIds;

        if (closeSingleJobTasksOnly)
            jobIds = [jobId];
        else
            jobIds = await GetAllRelatedJobIdsIncludingParentAsync(jobId);

        await Context.TucEvents
            .Where(t => jobIds.Contains(t.UcevJobId.Value) && !t.UcevClosed)
            .ExecuteUpdateAsync(setters => setters.SetProperty(e => e.UcevClosed, true));
    }

    private async Task CloseBulkTasksByBulkJobIdAsync(int bulkJobId, bool closeSingleJobTasksOnly = false)
    {
        var now = _infoService.GetCurrentTenantTime();
        var staffId = _infoService.GetStaffId();
        var staffName = await GetStaffNameAsync(staffId);

        List<int> jobIds;

        if (closeSingleJobTasksOnly)
            jobIds = [bulkJobId];
        else
            jobIds = await GetAllRelatedBulkJobIdsIncludingParentAsync(bulkJobId);

        await Context.TblBulkEvents
            .Where(t => jobIds.Contains(t.BulkJobId.Value) && !t.ClosedDate.HasValue)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(e => e.ClosedDate, now)
                .SetProperty(e => e.ClosedByName, staffName));
    }

    public async Task BulkUpdateReadStatusAsync(BulkReadUpdateRequestModel data)
    {
        var jobIds = data.JobIds;
        if (jobIds == null || jobIds.Count == 0) return;

        var currentTenantTime = _infoService.GetCurrentTenantTime();
        var staffId = _infoService.GetStaffId();

        // Use ExecuteUpdate for existing records - single SQL statement, no entity tracking
        await Context.TucJobReadTrackers
            .Where(t => jobIds.Contains(t.JobId))
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(t => t.HasBeenRead, data.ShouldMarkAsRead)
                .SetProperty(t => t.ReadTimestamp, currentTenantTime)
                .SetProperty(t => t.ReadByStaffId, staffId));

        // Get job IDs that already have trackers to exclude from insert
        var existingJobIds = await Context.TucJobReadTrackers
            .Where(t => jobIds.Contains(t.JobId))
            .Select(t => t.JobId)
            .ToListAsync();

        var newJobIds = jobIds.Except(existingJobIds).ToList();

        // Bulk insert new records if any
        if (newJobIds.Count != 0)
        {
            var newTrackers = newJobIds.Select(jobId => new TucJobReadTracker
            {
                JobId = jobId,
                HasBeenRead = true,
                ReadTimestamp = currentTenantTime,
                ReadByStaffId = staffId
            });

            Context.AddRange(newTrackers);
            await Context.SaveChangesAsync();
        }
    }

    public async Task<bool> JobNumberExistsAsync(string jobNumber) =>
        await Context.TucJobs.AnyAsync(j => j.UcjbNumber == jobNumber);

    public async Task<decimal> GetNationwideServiceRawPriceAsync(int? clientId, int? fromSuburbId,
        int? toSuburbId, int? speed, int? size, float? weight, int? quantity, int? type)
    {
        var result = await Context.TucJobs
            .Select(j => DespatchContext.UTL_fncS_GetNationwideService_RawPrice(
                clientId,
                fromSuburbId,
                toSuburbId,
                speed,
                size,
                weight,
                quantity,
                type))
            .FirstOrDefaultAsync();

        return result ?? 0m;
    }

    public async Task<DispatchJobViewModel> GetDispatchJobDetailAsync(int jobId)
    {
        var isUsCustomer = _infoService.IsUsTenant();

        return await Context.TucJobs
            .AsNoTracking()
            .Where(j => j.UcjbId == jobId)
            .Select(JobMappings.JobDispatchMapping(isUsCustomer))
            .FirstOrDefaultAsync();
    }

    public async Task AddNewTucNoteTypeAsync(NoteTypeViewModel noteType)
    {
        var newType = new TucNoteType
        {
            IsActive = true,
            IsPublic = noteType.IsPublic,
            NoteTypeName = noteType.Text,
            Description = noteType.Description
        };

        await Context.TucNoteTypes.AddAsync(newType);
        await Context.SaveChangesAsync();
    }

    public async Task<bool> IsJobParentAsync(int jobId)
    {
        var jobInfo = await Context.TucJobs
            .AsNoTracking()
            .Where(j => j.UcjbId == jobId)
            .Select(j => new { HasParent = j.ParentId.HasValue })
            .FirstOrDefaultAsync();

        if (jobInfo != null)
            return jobInfo.HasParent;

        var bookingInfo = await Context.TucJobBookings
            .AsNoTracking()
            .Where(j => j.UcbkId == jobId)
            .Select(j => new { HasParent = j.ParentId.HasValue })
            .FirstOrDefaultAsync();

        return bookingInfo?.HasParent ?? false;
    }

    public async Task<bool> IsBulkJobParent(int bulkJobId)
    {
        var isParent = await Context.TblBulkJobs
            .Where(j => j.BulkJobId == bulkJobId)
            .Select(j => j.ParentId.HasValue || j.BulkParentId.HasValue)
            .FirstOrDefaultAsync();

        return isParent;
    }

    public async Task<List<NoteTypeViewModel>> GetNoteTypesAsync()
    {
        var noteTypes = await Context.TucNoteTypes
            .Where(x => x.IsActive)
            .Select(x => new NoteTypeViewModel
            {
                Id = x.NoteTypeId,
                Text = x.NoteTypeName,
                IsPublic = x.IsPublic
            })
            .AsNoTracking()
            .ToListAsync();

        return noteTypes;
    }

    public async Task UpdatePackagesForJobAsync(int jobId, List<ParcelDimensions> parcels)
    {
        if (parcels == null || parcels.Count == 0) return;

        try
        {
            var effectiveJobId = await GetJobRelationshipInfoAsync(jobId);
            var childJobId = await IsStopJob(jobId) ? jobId : (int?)null;

            // Process existing and new parcels separately
            var newParcels = new List<TucJobItem>();
            var existingParcelsToUpdate = new List<ParcelDimensions>();

            // Get the maximum existing ItemId for this job
            var maxItemId = await Context.TucJobItems
                .Where(i => i.JobId == effectiveJobId)
                .MaxAsync(i => (int?)i.ItemId) ?? 0;

            // Get next ItemId for new parcels
            var nextItemId = maxItemId + 1;

            foreach (var parcel in parcels)
            {
                if (parcel.ItemId == null)
                {
                    var newItem = new TucJobItem
                    {
                        JobId = effectiveJobId,
                        ChildJobId = childJobId,
                        Height = parcel.Height ?? 0,
                        Length = parcel.Length ?? 0,
                        Depth = parcel.Depth ?? 0,
                        Notes = parcel.ItemName,
                        Barcode = parcel.Barcode,
                        ItemId = nextItemId++ // Increment for each new item
                    };

                    newParcels.Add(newItem);
                }
                else
                {
                    existingParcelsToUpdate.Add(parcel);
                }
            }

            // Add new parcels
            if (newParcels.Count > 0)
            {
                await Context.TucJobItems.AddRangeAsync(newParcels);
                await Context.SaveChangesAsync();
            }

            // Update existing items using ExecuteUpdateAsync
            foreach (var parcel in existingParcelsToUpdate)
            {
                await Context.TucJobItems
                    .Where(i => i.ItemId == parcel.ItemId!.Value)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(i => i.Height, parcel.Height ?? 0)
                        .SetProperty(i => i.Length, parcel.Length ?? 0)
                        .SetProperty(i => i.Depth, parcel.Depth ?? 0)
                        .SetProperty(i => i.Barcode, parcel.Barcode)
                        .SetProperty(i => i.Notes, parcel.ItemName));
            }
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(BaseJobRepository),
                    nameof(UpdatePackagesForJobAsync)));
            throw;
        }
    }

    public async Task UpdatePackagesForBulkJobAsync(int bulkJobId, List<ParcelDimensions> parcels)
    {
        if (parcels == null || parcels.Count == 0) return;

        try
        {
            var effectiveJobId = await GetBulkJobRelationshipInfoAsync(bulkJobId);

            // Process existing and new parcels separately
            var newParcels = new List<TblBulkJobItem>();
            var existingParcelsToUpdate = new List<ParcelDimensions>();

            // Get the maximum existing ItemId for this job
            var maxItemId = await Context.TblBulkJobItems
                .Where(i => i.JobId == effectiveJobId)
                .MaxAsync(i => (int?)i.ItemId) ?? 0;

            // Get next ItemId for new parcels
            var nextItemId = maxItemId + 1;

            foreach (var parcel in parcels)
            {
                if (parcel.ItemId == null)
                {
                    var newItem = new TblBulkJobItem
                    {
                        JobId = effectiveJobId,
                        ChildJobId = null,
                        Height = parcel.Height ?? 0,
                        Length = parcel.Length ?? 0,
                        Depth = parcel.Depth ?? 0,
                        Notes = parcel.ItemName,
                        Barcode = parcel.Barcode,
                        ItemId = nextItemId++ // Increment for each new item
                    };

                    newParcels.Add(newItem);
                }
                else
                {
                    existingParcelsToUpdate.Add(parcel);
                }
            }

            // Add new parcels
            if (newParcels.Count > 0)
            {
                await Context.TblBulkJobItems.AddRangeAsync(newParcels);
                await Context.SaveChangesAsync();
            }

            // Update existing items using ExecuteUpdateAsync
            foreach (var parcel in existingParcelsToUpdate)
            {
                await Context.TblBulkJobItems
                    .Where(i => i.ItemId == parcel.ItemId!.Value)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(i => i.Height, parcel.Height ?? 0)
                        .SetProperty(i => i.Length, parcel.Length ?? 0)
                        .SetProperty(i => i.Depth, parcel.Depth ?? 0)
                        .SetProperty(i => i.Barcode, parcel.Barcode)
                        .SetProperty(i => i.Notes, parcel.ItemName));
            }
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(BaseJobRepository),
                    nameof(UpdatePackagesForJobAsync)));
            throw;
        }
    }

    private async Task<bool> IsStopJob(int jobId)
    {
        var jobNumber = await Context.TucJobs
            .AsNoTracking()
            .Where(j => j.UcjbId == jobId)
            .Select(j => j.UcjbNumber)
            .FirstOrDefaultAsync();

        ArgumentNullException.ThrowIfNull(jobNumber);
        return char.IsLetter(jobNumber.Last());
    }


    public async Task AddPackagesToJobAsync(int effectiveJobId, List<TucJobItem> items)
    {
        var existingCount = await GetJobItemCount(effectiveJobId);

        for (var i = 0; i < items.Count; i++) items[i].ItemId = existingCount + i + 1;

        await Context.TucJobItems.AddRangeAsync(items);
        await Context.SaveChangesAsync();
    }

    private async Task<int> GetJobItemCount(int effectiveJobId) =>
        await Context.TucJobItems.Where(i => i.JobId == effectiveJobId).CountAsync();

    public async Task<List<MegaMapResponse>> GetJobsForMegaMapAsync()
    {
        var isUsCustomer = _infoService.IsUsTenant();

        // Get active jobs to display on a map
        var jobs = await Context.TucJobs
            .AsNoTracking()
            .Where(j =>
                j.UcjbStatus.HasValue
                && JobStatusGroups.Active.Contains(j.UcjbStatus.Value)
                && !j.UcjbVoid
            )
            .Select(j => new MegaMapResponse
            {
                JobId = j.UcjbId,
                JobNumber = j.UcjbNumber,
                JobStatus = j.UcjbStatus != null ? j.UcjbStatusNavigation.UcjsName : "New",
                EstimatedDelivery =
                    j.UcjbSpeedNavigation.GroupingId ==
                    (isUsCustomer ? (int)SpeedGrouping.Flight : (int)UrgentSpeedGrouping.Flight)
                    && j.TucJobNationwides.Count != 0
                        ? j.TucJobNationwides.FirstOrDefault().UcnwEta.Value
                        : j
                            .UcjbDate.Date.Add(j.UcjbTime.Value.TimeOfDay)
                            .AddMinutes(j.UcjbSpeedNavigation.Minutes ?? 180),
                IsFlightJob = j.UcjbSpeedNavigation.GroupingId ==
                              (isUsCustomer ? (int)SpeedGrouping.Flight : (int)UrgentSpeedGrouping.Flight),
                PickupLocation = new AddressViewModel
                {
                    Latitude = j.PickUpLatitude ?? 0,
                    Longitude = j.PickUpLongitude ?? 0,
                    AddressLine1 = j.PickupAddressLine1,
                    AddressLine2 = j.PickupAddressLine2,
                    AddressLine3 = j.PickupAddressLine3,
                    AddressLine4 = j.PickupAddressLine4,
                    AddressLine5 = j.PickupAddressLine5,
                    AddressLine6 = j.PickupAddressLine6,
                    AddressLine7 = j.PickupAddressLine7,
                    AddressLine8 = j.PickupAddressLine8
                },
                DeliveryLocation = new AddressViewModel
                {
                    Latitude = j.DeliveryLatitude ?? 0,
                    Longitude = j.DeliveryLongitude ?? 0,
                    AddressLine1 = j.DeliveryAddressLine1,
                    AddressLine2 = j.DeliveryAddressLine2,
                    AddressLine3 = j.DeliveryAddressLine3,
                    AddressLine4 = j.DeliveryAddressLine4,
                    AddressLine5 = j.DeliveryAddressLine5,
                    AddressLine6 = j.DeliveryAddressLine6,
                    AddressLine7 = j.DeliveryAddressLine7,
                    AddressLine8 = j.DeliveryAddressLine8
                },
                CourierLocation = j.UcjbCourierId.HasValue
                    ? new CourierLocation
                    {
                        CourierId = j.UcjbCourier.UccrId,
                        CourierName =
                            $"{j.UcjbCourier.UccrName} {j.UcjbCourier.UccrSurname}".Trim(),
                        Coordinates = j.UcjbCourier.CourierGpsid.HasValue
                            ? new Coordinates
                            {
                                Lat = (decimal)j.UcjbCourier.CourierGps.Latitude,
                                Lng = (decimal)j.UcjbCourier.CourierGps.Longitude
                            }
                            : null
                    }
                    : null,
                FlightInfo =
                    j.UcjbSpeedNavigation.GroupingId ==
                    (isUsCustomer ? (int)SpeedGrouping.Flight : (int)UrgentSpeedGrouping.Flight)
                        ? j
                            .TucJobNationwides.Select(n => new AssignedFlight
                            {
                                FlightNumber = n.UcnwFlightNo,
                                ExpectedArrival = n.UcnwEta,
                                ExpectedDeparture = n.UcnwEtd
                            })
                            .FirstOrDefault()
                        : null
            })
            .ToListAsync();

        return jobs;
    }

    private async Task MarkJobAsReadAsync(int jobId)
    {
        var alreadyOpened = await Context.TucJobReadTrackers.AnyAsync(x => x.JobId == jobId);
        if (alreadyOpened) return;

        var isLiveJob = await Context.TucJobs.AnyAsync(j => j.UcjbId == jobId);
        if (!isLiveJob) return;

        var staffId = _infoService.GetStaffId();
        var currentTenantTime = _infoService.GetCurrentTenantTime();

        var readTracker = new TucJobReadTracker
        {
            JobId = jobId,
            HasBeenRead = true,
            ReadByStaffId = staffId,
            ReadTimestamp = currentTenantTime
        };

        await Context.TucJobReadTrackers.AddAsync(readTracker);
        await Context.SaveChangesAsync();
    }

    public async Task UpdateJobNoteAsync(int jobId, string note)
    {
        try
        {
            Log.Information("Starting note update for job {JobId}", jobId);

            var rowsAffected = await Context.TucJobs
                .Where(j => j.UcjbId == jobId)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(j => j.UcjbNotes, note));

            if (rowsAffected == 0)
            {
                Log.Warning("Job {JobId} not found", jobId);
                throw new KeyNotFoundException($"Job with ID {jobId} not found");
            }

            Log.Information(
                "Successfully updated note for job {JobId}. New note length: {NewLength}",
                jobId,
                note?.Length ?? 0
            );
        }
        catch (KeyNotFoundException ex)
        {
            Log.Error(ex, "Job not found when updating note for job {JobId}", jobId);
            throw;
        }
        catch (DbUpdateException ex)
        {
            Log.Error(ex, "Database error occurred while updating note for job {JobId}", jobId);
            throw;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Unexpected error updating note for job {JobId}", jobId);
            throw;
        }
    }

    public async Task<JobViewModel> GetJobByIdAsync(int jobId)
    {
        try
        {
            // Mark the job as ready
            await MarkJobAsReadAsync(jobId);

            // Check for a live job first
            var isLiveJob = await Context.TucJobs.AnyAsync(j => j.UcjbId == jobId);
            if (isLiveJob)
            {
                var liveJob = await Context.TucJobs
                    .Where(j => j.UcjbId == jobId)
                    .Select(JobMappings.JobMapping)
                    .AsNoTracking()
                    .FirstOrDefaultAsync();

                if (liveJob.AssignedFlight == null || liveJob.AssignedFlight.FlightSegments.Count == 0) return liveJob;

                liveJob.AssignedFlight.ExpectedArrival = liveJob.AssignedFlight.ExpectedArrival.HasValue
                    ? TimeZoneHelper.SetDateTimeWithTimeZone(liveJob.AssignedFlight.ExpectedArrival.Value,
                        liveJob.AssignedFlight.ArrivalTimeZone)
                    : null;
                liveJob.AssignedFlight.ExpectedDeparture = liveJob.AssignedFlight.ExpectedDeparture.HasValue
                    ? TimeZoneHelper.SetDateTimeWithTimeZone(liveJob.AssignedFlight.ExpectedDeparture.Value,
                        liveJob.AssignedFlight.DepartureTimeZone)
                    : null;

                foreach (var segment in liveJob.AssignedFlight.FlightSegments)
                {
                    segment.ArrivalTime =
                        TimeZoneHelper.SetDateTimeWithTimeZone(segment.ArrivalTime, segment.ArrivalAirportTimeZone);
                    segment.DepartureTime =
                        TimeZoneHelper.SetDateTimeWithTimeZone(segment.DepartureTime, segment.DepartureAirportTimeZone);
                }

                return liveJob;
            }

            // Check for an archived job
            var archivedJob = await Context.TucJobArchives
                .Where(j => j.UcjbId == jobId)
                .Select(JobMappings.JobArchiveMapping)
                .AsNoTracking()
                .FirstOrDefaultAsync();
            ArgumentNullException.ThrowIfNull(archivedJob);

            return archivedJob;
        }
        catch (Exception e)
        {
            Log.Error(e, "Error occurred getting job {JobId}. Please see exception.", jobId);
            throw;
        }
    }

    public async Task<List<AddressWithAgent>> GetClosestAirportsAsync(
        decimal latitude,
        decimal longitude
    )
    {
        try
        {
            var latRad = (double)latitude / 57.3;

            var closestAirports = await Context
                .TblAirports.Where(a => a.Active)
                .Select(a => new AddressWithAgent
                {
                    AirportId = a.AirportId,
                    AirportCode = a.AirportCode,
                    StreetAddress = a.StreetAddress,
                    City = a.Name,
                    AgentId = a.AgentId ?? 0,
                    Latitude = a.Latitude,
                    Longitude = a.Longitude,
                    Distance = (decimal)
                        Math.Sqrt(
                            Math.Pow(110.574 * ((double)latitude - (double)a.Latitude), 2)
                            + Math.Pow(
                                110.574
                                * ((double)a.Longitude - (double)longitude)
                                * Math.Cos(latRad),
                                2
                            )
                        )
                })
                .OrderBy(a => a.Distance)
                .Take(3)
                .AsNoTracking()
                .ToListAsync();

            return closestAirports;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(JobRepository),
                    nameof(GetClosestAirportsAsync)));
            throw;
        }
    }

    public async Task<TucJobType> GetJobTypeByIdAsync(int speedId)
    {
        var jobType = await Context.TucJobTypes
            .AsNoTracking()
            .Include(s => s.Grouping)
            .FirstOrDefaultAsync(x => x.UcjtId == speedId);

        return jobType ?? throw new KeyNotFoundException($"Job type with ID {speedId} not found");
    }

    public async Task<OverviewStatsViewModel> GetOverviewStatsAsync()
    {
        var baseQuery = Context.TucJobs.Where(j => j.InverseParent.Count != 0);

        var stats = await baseQuery
            .GroupBy(j => true) // Group all records together
            .Select(g => new OverviewStatsViewModel
            {
                Active = g.Count(j =>
                    j.UcjbStatus.HasValue
                    && JobStatusGroups.Active.Contains(j.UcjbStatus.Value)
                    && !j.UcjbVoid
                ),
                Completed = g.Count(j =>
                    j.UcjbStatus.HasValue
                    && JobStatusGroups.Completed.Contains(j.UcjbStatus.Value)
                    && !j.UcjbVoid
                ),
                Inactive = g.Count(j => j.UcjbVoid)
            })
            .FirstOrDefaultAsync();

        return stats
               ?? new OverviewStatsViewModel
               {
                   Active = 0,
                   Inactive = 0,
                   Completed = 0
               };
    }

    public async Task UpdateJobReadStatusAsync(int jobId, bool hasBeenRead)
    {
        var staffId = _infoService.GetStaffId();
        var currentTenantTime = _infoService.GetCurrentTenantTime();

        var rowsAffected = await Context.TucJobReadTrackers
            .Where(x => x.JobId == jobId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.HasBeenRead, hasBeenRead)
                .SetProperty(x => x.ReadByStaffId, staffId)
                .SetProperty(x => x.ReadTimestamp, currentTenantTime));

        if (rowsAffected == 0)
        {
            // Record doesn't exist, create a new one
            var data = new TucJobReadTracker
            {
                JobId = jobId,
                HasBeenRead = hasBeenRead,
                ReadByStaffId = staffId,
                ReadTimestamp = currentTenantTime
            };

            await Context.AddAsync(data);
            await Context.SaveChangesAsync();
        }
    }

    public async Task<List<ScanDetailResult>> ScanList(DateTimeOffset? runDate, string scan)
    {
        runDate ??= _infoService.GetCurrentTenantTime();
        var cutoffDate = runDate.Value.AddDays(-3);

        var query = from bs in Context.TblBulkScans
            where bs.ScanDateTime > cutoffDate && bs.Scan == scan
            select new
            {
                bs.BulkScanId,
                Courier = Context.TucCouriers.FirstOrDefault(c => c.UccrId == bs.CourierId),
                bs.ScanDateTime,
                bs.ScanType,
                bs.CourierId,
                bs.ToCourierId,
                bs.RunName,
                TransferTo = bs.ToCourier,
                RunViewerTransferTo = Context.TucCouriers
                    .FirstOrDefault(c => bs.CourierId == 999
                                         && c.UccrId == bs.ToCourierId
                                         && c.Active)
            };

        var results = await query
            .AsNoTracking()
            .OrderBy(s => s.ScanDateTime)
            .Select(s => new ScanDetailResult
            {
                BulkScanId = s.BulkScanId,
                ScanDateTime = s.ScanDateTime,
                ScanDetail = GetScanDetail(s.ScanType),
                Courier = GetCourierDescription(s.ScanType, s.Courier, s.TransferTo, s.RunViewerTransferTo, s.RunName)
            })
            .ToListAsync();

        return results;
    }

    private static string GetScanDetail(int scanType)
    {
        return scanType switch
        {
            (int)ScanType.Sort or (int)ScanType.AlternateSort => "Sort",
            (int)ScanType.Run => "Run",
            (int)ScanType.InvalidRun => "InvalidRun",
            (int)ScanType.Transit => "Transit",
            (int)ScanType.InwardsDepot => "InwardsDepot",
            (int)ScanType.Pickup => "Pickup",
            (int)ScanType.InvalidPickup => "InvalidPickup",
            (int)ScanType.Transfer => "Transfer",
            _ => null
        };
    }

    private static string GetCourierDescription(int scanType,
        TucCourier courier, TucCourier transferTo,
        TucCourier runViewerTransferTo, string runName)
    {
        return scanType switch
        {
            (int)ScanType.Transfer when courier.UccrId == 999 =>
                $"Ops (Run Viewer){(runViewerTransferTo != null ? $" to {runViewerTransferTo.Code} {runViewerTransferTo.UccrName} {runViewerTransferTo.UccrSurname}" : string.Empty)}",

            (int)ScanType.Transfer =>
                $"{courier.Code} {courier.UccrName} {courier.UccrSurname}{(transferTo != null ? $" to {transferTo.Code} {transferTo.UccrName} {transferTo.UccrSurname}" : string.Empty)}",

            (int)ScanType.InvalidRun =>
                $"{courier?.Code} {courier?.UccrName} - Run {runName?.ToUpper() ?? string.Empty}",

            (int)ScanType.InwardsDepot => $"{courier?.Code} {courier?.UccrName} {runName ?? string.Empty}",

            _ => $"{courier?.Code} {courier?.UccrName}"
        };
    }

    public async Task<bool> ValidatePodSwapAsync(string jobNumber)
    {
        var today = _infoService.GetCurrentTenantTime();

        var isValid = await Context.TblJobs
            .AsNoTracking()
            .Where(j => j.Number == jobNumber)
            .Where(j => j.Date.HasValue && j.Date.Value.Date == today.Date)
            .AnyAsync();

        return isValid;
    }
}