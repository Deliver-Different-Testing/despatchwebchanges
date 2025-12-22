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
using Microsoft.AspNetCore.Mvc;
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
    private static readonly DateTime SqlMinDateTime = new(1753, 1, 1);
    private readonly IDbContextFactory<DespatchContext> _contextFactory = contextFactory;
    private readonly ITenantInfoService _infoService = infoService;


    /// <summary>
    /// Retrieves a bulk job and its related family jobs (parent and siblings).
    /// </summary>
    /// <param name="bulkJobId">The bulk job ID to retrieve.</param>
    /// <returns>View model containing the main job and related jobs in the family.</returns>
    public async Task<JobGroupViewModel> GetBulkJobDetailAsync(int bulkJobId)
    {
        try
        {
            // Get the main job's parent ID first
            var parentIdQuery = await Context.TblBulkJobs
                .AsNoTracking()
                .Where(j => j.BulkJobId == bulkJobId)
                .Select(j => j.ParentId ?? j.BulkJobId)
                .FirstOrDefaultAsync();

            if (parentIdQuery == 0)
            {
                return new JobGroupViewModel
                {
                    Job = null,
                    RelatedJobs = []
                };
            }

            var familyRootId = parentIdQuery;

            var allJobs = await Context.TblBulkJobs
                .AsNoTracking()
                .Where(j => j.BulkJobId == familyRootId || j.ParentId == familyRootId)
                .Select(JobMappings.BulkJobMapping)
                .TagWith($"GetBulkJobDetail - Family {familyRootId}")
                .ToListAsync();

            var mainBulkJob = allJobs.FirstOrDefault(j => j.Id == bulkJobId);
            var relatedJobs = allJobs.Where(j => j.Id != bulkJobId).ToList();

            return new JobGroupViewModel
            {
                Job = mainBulkJob,
                RelatedJobs = relatedJobs
            };
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository), nameof(GetBulkJobDetailAsync)));
            throw;
        }
    }

    /// <summary>
    /// Retrieves detailed dispatch information for a bulk job including addresses, speed, and status.
    /// </summary>
    /// <param name="bulkJobId">The bulk job ID to retrieve.</param>
    /// <returns>Dispatch job view model with full job details.</returns>
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

    /// <summary>
    /// Searches bulk jobs with filtering by date, client, courier, speed, and wildcard text.
    /// </summary>
    /// <param name="data">Search parameters including date range, filters, and pagination.</param>
    /// <returns>Paginated search results with bulk job details.</returns>
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
                && (!data.ClientSet || data.ClientIds.Contains(j.ClientId))
                && (!data.CourierSet || (j.CourierId.HasValue && data.CourierIds.Contains(j.CourierId.Value)))
                && (!data.SpeedSet || data.SpeedIds.Contains(j.Speed))
                && (!data.JobSet || EF.Functions.Like(j.JobNumber.ToLower(), $"%{jobSearch}%"))
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

        var allResults = await query
            .AsNoTracking()
            .ToListAsync();

        var distinctResults = allResults
            .Distinct(new DispatchJobViewModelComparer())
            .ToList();

        var totalCount = distinctResults.Count;

        // Apply pagination in memory
        var page = data.Page ?? 0;
        var pageSize = data.PageSize ?? 50;

        var bulkJobs = distinctResults
            .Skip(page * pageSize)
            .Take(pageSize)
            .ToList();

        foreach (var bulkJob in bulkJobs) bulkJob.AngularId = Guid.NewGuid();

        var hasMore = (page + 1) * pageSize < totalCount;

        return new JobSearchResult
        {
            Jobs = bulkJobs,
            TotalCount = totalCount,
            HasMore = hasMore
        };
    }

    /// <summary>
    /// Searches both live and archived jobs with filtering and sorting.
    /// Queries both tables in parallel for improved performance.
    /// </summary>
    /// <param name="data">Search parameters including date range, filters, sorting, and pagination.</param>
    /// <returns>Paginated search results combining live and archived jobs.</returns>
    public async Task<JobSearchResult> PodSearchAsync(PodSearchRequest data)
    {
        try
        {
            var isUsCustomer = _infoService.IsUsTenant();
            var now = _infoService.GetCurrentTenantTime();

            var fromDate = data.FromDate.Date;
            var toDate = data.ToDate.Date;
            var page = data.Page ?? 0;
            var pageSize = data.PageSize ?? 50;

            var jobSearch = $"%{data.Job ?? string.Empty}%";
            var wildSearch = $"%{data.Wild ?? string.Empty}%";

            await using var liveJobsContext = await _contextFactory.CreateDbContextAsync();
            await using var archivedJobsContext = await _contextFactory.CreateDbContextAsync();

            var liveJobsQuery = liveJobsContext.TucJobs
                .AsNoTracking()
                .Where(j =>
                    j.UcjbDate.Date >= fromDate
                    && j.UcjbDate.Date <= toDate
                    && (!data.ClientSet || (j.UcjbClientId.HasValue && data.ClientIds.Contains(j.UcjbClientId.Value)))
                    && (!data.CourierSet ||
                        (j.UcjbCourierId.HasValue && data.CourierIds.Contains(j.UcjbCourierId.Value)))
                    && (!data.SpeedSet || (j.UcjbSpeed.HasValue && data.SpeedIds.Contains(j.UcjbSpeed.Value)))
                    && (!data.JobSet || EF.Functions.Like(j.UcjbNumber, jobSearch))
                );

            var archivedJobsQuery = archivedJobsContext.TucJobArchives
                .AsNoTracking()
                .Where(j =>
                    j.UcjbDate.HasValue
                    && j.UcjbDate.Value.Date >= fromDate
                    && j.UcjbDate.Value.Date <= toDate
                    && (!data.ClientSet || (j.UcjbClientId.HasValue && data.ClientIds.Contains(j.UcjbClientId.Value)))
                    && (!data.CourierSet ||
                        (j.UcjbCourierId.HasValue && data.CourierIds.Contains(j.UcjbCourierId.Value)))
                    && (!data.SpeedSet || (j.UcjbSpeed.HasValue && data.SpeedIds.Contains(j.UcjbSpeed.Value)))
                    && (!data.JobSet || EF.Functions.Like(j.UcjbNumber, jobSearch))
                );

            if (data.WildSet)
            {
                liveJobsQuery = liveJobsQuery.Where(j =>
                    j.TucJobNationwides.Any(nw => EF.Functions.Like(
                        (nw.UcnwFlightNo ?? string.Empty) + " " +
                        (nw.AircraftName ?? string.Empty) + " " +
                        (nw.CarrierFsCode ?? string.Empty) + " " +
                        (nw.DepartureAirportName ?? string.Empty) + " " +
                        (nw.ArrivalAirportName ?? string.Empty),
                        wildSearch))
                    ||
                    EF.Functions.Like(
                        (j.UcjbFromAddr ?? string.Empty) + " " +
                        (j.PickupFromContact ?? string.Empty) + " " +
                        (j.UcjbFromNavigation.UcsuName ?? string.Empty) + " " +
                        (j.UcjbToAddr ?? string.Empty) + " " +
                        (j.DeliverToContact ?? string.Empty) + " " +
                        (j.UcjbToNavigation.UcsuName ?? string.Empty) + " " +
                        (j.UcjbClientRefa ?? string.Empty) + " " +
                        (j.UcjbClientRefb ?? string.Empty) + " " +
                        (j.UcjbOurRef ?? string.Empty) + " " +
                        j.UcjbNumber + " " +
                        (j.Barcode ?? string.Empty) + " " +
                        (j.CustomJobName ?? string.Empty),
                        wildSearch
                    )
                );

                archivedJobsQuery = archivedJobsQuery.Where(j =>
                    EF.Functions.Like(
                        (j.UcjbFromAddr ?? string.Empty) + " " +
                        (j.PickUpFromContact ?? string.Empty) + " " +
                        (j.UcjbToAddr ?? string.Empty) + " " +
                        (j.DeliverToContact ?? string.Empty) + " " +
                        (j.UcjbClientRefa ?? string.Empty) + " " +
                        (j.UcjbClientRefb ?? string.Empty) + " " +
                        (j.UcjbOurRef ?? string.Empty) + " " +
                        j.UcjbNumber + " " +
                        (j.Barcode ?? string.Empty) + " " +
                        (j.CustomJobName ?? string.Empty),
                        wildSearch
                    )
                );
            }

            // Get counts and data in parallel for better performance
            var liveCountTask = liveJobsQuery
                .TagWith("PodSearch - Live Count")
                .CountAsync();

            var archivedCountTask = archivedJobsQuery
                .TagWith("PodSearch - Archived Count")
                .CountAsync();

            // Wait for counts
            await Task.WhenAll(liveCountTask, archivedCountTask);

            var liveCount = await liveCountTask;
            var archivedCount = await archivedCountTask;
            var totalCount = liveCount + archivedCount;

            if (totalCount == 0)
                return new JobSearchResult
                {
                    Jobs = [],
                    TotalCount = 0,
                    HasMore = false
                };

            // Determine sort direction
            var sortDescending = string.Equals(data.SortDirection, "desc", StringComparison.OrdinalIgnoreCase);
            var sortColumn = data.SortColumn?.ToLowerInvariant();

            // Apply database-level sorting based on sort column
            // For columns that can be sorted at DB level, apply appropriate ordering
            var liveJobsOrdered = ApplyLiveJobSorting(liveJobsQuery, sortColumn, sortDescending);
            var archivedJobsOrdered = ApplyArchivedJobSorting(archivedJobsQuery, sortColumn, sortDescending);

            // Get data in parallel - fetch more when sorting to ensure we have enough records
            var fetchSize = pageSize * 3; // Fetch extra to handle pagination across both sources

            var liveJobsTask = liveJobsOrdered
                .Take(fetchSize)
                .Select(JobMappings.PodSearchMapping(isUsCustomer))
                .TagWith("PodSearch - Live Jobs")
                .ToListAsync();

            var archivedJobsTask = archivedJobsOrdered
                .Take(fetchSize)
                .Select(JobMappings.PodSearchArchivedMapping(isUsCustomer))
                .TagWith("PodSearch - Archived Jobs")
                .ToListAsync();

            // Wait for both queries
            await Task.WhenAll(liveJobsTask, archivedJobsTask);

            var liveJobs = await liveJobsTask;
            var archivedJobs = await archivedJobsTask;

            // Apply sorting to combined results
            var sortedJobs = ApplyDispatchJobSorting(liveJobs.Concat(archivedJobs), sortColumn, sortDescending);

            var allJobs = sortedJobs
                .Skip(page * pageSize)
                .Take(pageSize)
                .ToList();

            if (allJobs.Count == 0)
            {
                return new JobSearchResult
                {
                    Jobs = [],
                    TotalCount = totalCount,
                    HasMore = false
                };
            }

            var (economySpeedId, ecoDeliveryTime) = await GetEconomySpeedAndDeliveryTimeAsync();

            foreach (var job in allJobs)
            {
                job.AngularId = Guid.NewGuid();
                job.Remain = CalculateRemainTime(job, now, economySpeedId, ecoDeliveryTime);
            }

            return new JobSearchResult
            {
                Jobs = allJobs,
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

    /// <summary>
    /// Updates pricing fields (amount, PPD, fuel, courier payment) for multiple jobs manually.
    /// Handles both active and archived jobs, updates parent job totals, and manages pricing breakdowns.
    /// </summary>
    /// <param name="data">List of job pricing updates to apply.</param>
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

        // Run TucJobs and TucJobArchives queries in parallel with separate contexts
        await using var activeJobsContext = CreateNewContext();
        await using var archivedJobsContext = CreateNewContext();

        var dbDataTask = activeJobsContext
            .TucJobs.Where(j =>
                (ids.Contains(j.UcjbId) || (j.ParentId.HasValue && ids.Contains(j.ParentId.Value)))
                && j.UcjbLocked != true
            )
            .ToListAsync();

        var dbDataArchiveTask = archivedJobsContext
            .TucJobArchives.Where(j =>
                (ids.Contains(j.UcjbId) || (j.ParentId.HasValue && ids.Contains(j.ParentId.Value)))
                && (j.UcjbLocked != 1 || !j.UcjbInvoiceNo.HasValue)
            )
            .ToListAsync();

        await Task.WhenAll(dbDataTask, dbDataArchiveTask);

        var dbData = await dbDataTask;
        var dbDataArchive = await dbDataArchiveTask;

        // Update job status
        await UpdateJobStatusesAsync(data, dbData, dbDataArchive);

        // Update job couriers
        await UpdateJobCouriersAsync(data, dbData, dbDataArchive);

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

                // Check if a parent job's price is actually changing
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
            // Separate jobs by their source table (active vs. archived)
            var activeJobIds = jobsWithChangedPrices.Where(id => dbData.Any(j => j.UcjbId == id)).ToList();
            var archivedJobIds = jobsWithChangedPrices
                .Where(id => dbDataArchive.Any(j => j.UcjbId == id) && dbData.All(j => j.UcjbId != id)).ToList();

            // Handle active jobs - use the PricingBreakdowns table
            if (activeJobIds.Count != 0)
            {
                var existingBreakdowns = await Context.PricingBreakdowns
                    .Where(pb =>
                        activeJobIds.Contains(pb.JobId ?? 0) ||
                        activeJobIds.Contains(pb.PrebookJobId ?? 0))
                    .ToListAsync();

                if (existingBreakdowns.Count != 0)
                {
                    Log.Information(
                        "Removing {ExistingBreakdownsCount} existing pricing breakdowns for {Count} active jobs with changed prices",
                        existingBreakdowns.Count, activeJobIds.Count);
                    Context.PricingBreakdowns.RemoveRange(existingBreakdowns);
                }

                foreach (var jobId in activeJobIds)
                {
                    var jobFromDb = dbData.FirstOrDefault(j => j.UcjbId == jobId);
                    if (jobFromDb == null) continue;

                    var newBreakdown = new PricingBreakdown
                    {
                        JobId = jobId,
                        PrebookJobId = null,
                        ChildJobId = jobFromDb.ParentId,
                        ChargeName = "Manually Rated",
                        ChargeAmount = jobFromDb.UcjbAmount ?? 0,
                        Total = null,
                        Included = null,
                        Charged = null
                    };

                    await Context.PricingBreakdowns.AddAsync(newBreakdown);
                    Log.Information("Added new pricing breakdown for active job {JobId} with amount {Amount}", jobId,
                        jobFromDb.UcjbAmount ?? 0);
                }
            }

            // Handle archived jobs - use PricingBreakdownArchives table
            if (archivedJobIds.Count != 0)
            {
                var existingArchiveBreakdowns = await Context.PricingBreakdownArchives
                    .Where(pb =>
                        archivedJobIds.Contains(pb.JobId ?? 0) ||
                        archivedJobIds.Contains(pb.PrebookJobId ?? 0))
                    .ToListAsync();

                if (existingArchiveBreakdowns.Count != 0)
                {
                    Log.Information(
                        "Removing {ExistingBreakdownsCount} existing pricing breakdown archives for {Count} archived jobs with changed prices",
                        existingArchiveBreakdowns.Count, archivedJobIds.Count);
                    Context.PricingBreakdownArchives.RemoveRange(existingArchiveBreakdowns);
                }

                foreach (var jobId in archivedJobIds)
                {
                    var jobFromArchive = dbDataArchive.FirstOrDefault(j => j.UcjbId == jobId);
                    if (jobFromArchive == null) continue;

                    var newArchiveBreakdown = new PricingBreakdownArchive
                    {
                        JobId = jobId,
                        PrebookJobId = null,
                        ChargeName = "Manually Rated",
                        ChargeAmount = jobFromArchive.UcjbAmount ?? 0,
                        Total = null,
                        Included = null,
                        Charged = null
                    };

                    await Context.PricingBreakdownArchives.AddAsync(newArchiveBreakdown);
                    Log.Information("Added new pricing breakdown archive for archived job {JobId} with amount {Amount}",
                        jobId, jobFromArchive.UcjbAmount ?? 0);
                }
            }
        }
        else
        {
            Log.Information("No jobs with changed prices - skipping pricing breakdown updates");
        }

        // Finally, update all jobs to the locked state
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

    /// <summary>
    /// Retrieves job data for CSV/Excel download with full details including addresses, pricing, and courier info.
    /// Uses optimized single query with scalar subqueries for pricing breakdowns.
    /// </summary>
    /// <param name="courierIds">Optional filter by courier IDs.</param>
    /// <param name="speedIds">Optional filter by speed IDs.</param>
    /// <param name="wild">Wildcard search text.</param>
    /// <param name="job">Job number search text.</param>
    /// <param name="fromDate">Start date filter.</param>
    /// <param name="toDate">End date filter.</param>
    /// <param name="clientIds">Optional filter by client IDs.</param>
    /// <returns>List of job models formatted for download export.</returns>
    public async Task<List<JobDownloadModel>> PodSearchDownloadAsync(
        List<int> courierIds,
        List<int> speedIds,
        string wild,
        string job,
        DateTime fromDate,
        DateTime toDate,
        List<int> clientIds
    )
    {
        var clientSet = clientIds is { Count: > 0 };
        var courierSet = courierIds is { Count: > 0 };
        var speedSet = speedIds is { Count: > 0 };
        var jobParam = $"%{job}%";
        var wildParam = $"%{wild}%";

        // Subquery for matching job IDs based on all filter criteria
        var matchingJobIds = Context.TblJobs
            .AsNoTracking()
            .Where(j =>
                j.Date >= fromDate
                && j.Date <= toDate
                && (!clientSet || (j.ClientId.HasValue && clientIds.Contains(j.ClientId.Value)))
                && (!courierSet || (j.CourierId.HasValue && courierIds.Contains(j.CourierId.Value)))
                && (!speedSet || (j.Speed.HasValue && speedIds.Contains(j.Speed.Value)))
                && (job == string.Empty || EF.Functions.Like(j.Number!.ToLower(), jobParam))
                && (wild == string.Empty
                    // Nationwide fields search
                    || Context.TucJobNationwides
                        .Where(nw => nw.UcnwJobId == j.JobId)
                        .Any(nw => EF.Functions.Like(
                            (nw.UcnwFlightNo ?? string.Empty)
                            + Space + (nw.AircraftName ?? string.Empty)
                            + Space + (nw.CarrierFsCode ?? string.Empty)
                            + Space + (nw.DepartureAirportName ?? string.Empty)
                            + Space + (nw.ArrivalAirportName ?? string.Empty),
                            wildParam))
                    // Job and suburb fields search using scalar subqueries
                    || EF.Functions.Like(
                        (j.FromAddress ?? string.Empty)
                        + Space + (j.PickupFromContact ?? string.Empty)
                        + Space + (Context.TucSuburbs
                            .Where(s => s.UcsuId == j.FromSuburbId)
                            .Select(s => s.UcsuName).FirstOrDefault() ?? string.Empty)
                        + Space + (j.ToAddress ?? string.Empty)
                        + Space + (j.DeliverToContact ?? string.Empty)
                        + Space + (Context.TucSuburbs
                            .Where(s => s.UcsuId == j.ToSuburbId)
                            .Select(s => s.UcsuName).FirstOrDefault() ?? string.Empty)
                        + Space + (j.ClientReferenceA ?? string.Empty)
                        + Space + (j.ClientReferenceB ?? string.Empty)
                        + Space + (j.OurRef ?? string.Empty)
                        + Space + (j.Number ?? string.Empty).ToLower()
                        + Space + (j.Barcode ?? string.Empty).ToLower(),
                        wildParam)))
            .Select(j => j.JobId);

        // Get parent IDs for matched child jobs (to include them in results)
        var parentIds = Context.TblJobs
            .AsNoTracking()
            .Where(j => matchingJobIds.Contains(j.JobId) && j.ParentId.HasValue)
            .Select(j => j.ParentId!.Value);

        // Combined set of all job IDs to fetch (matched + their parents)
        var allJobIds = matchingJobIds.Union(parentIds);

        // Single combined query with all joins - executes as one SQL statement
        var query =
            from j in Context.TblJobs.AsNoTracking()
            where allJobIds.Contains(j.JobId)
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
            from loggedInContact in licJoin.DefaultIfEmpty()
            join co in Context.TucCouriers on j.CourierId equals co.UccrId into courierJoin
            from courier in courierJoin.DefaultIfEmpty()
            // Use scalar subqueries for pricing - EF Core translates to efficient SQL
            let jobPricingSum = Context.PricingBreakdowns
                .Where(pb => pb.JobId == j.JobId)
                .Sum(pb => (decimal?)pb.ChargeAmount)
            let parentPricingSum = j.ParentId.HasValue
                ? Context.PricingBreakdowns
                    .Where(pb => pb.JobId == j.ParentId)
                    .Sum(pb => (decimal?)pb.ChargeAmount)
                : null
            orderby j.Number
            select new JobDownloadModel
            {
                Id = j.JobId,
                ParentId = j.ParentId,
                JobNumber = j.Number,
                CustomerName = client != null ? client.UcclName : null,
                BookDate = j.Date.HasValue
                    ? j.Date.Value.CombineWithTime(j.Time)
                    : default,
                PickedUpDate = j.PickUpTime,
                DeliveredDate = j.CompletedTime,
                Amount = parentPricingSum ?? jobPricingSum ?? j.Amount,
                Fuel = j.FuelSurchargeAmount,
                Ppd = j.Ppdexclusiveamount,
                AgentAirlineName = nationwide != null
                    ? nationwide.UcnwAirlineName
                    : agent != null
                        ? agent.UcagName
                        : null,
                AWB = nationwide != null ? nationwide.UcnwFlightNo : null,
                CourierPayment = j.CourierPayment,
                CourierFuel = j.CourierFuel,
                CourierBonus = j.CourierBonus,
                Quantity = j.Quantity,
                Weight = j.Weight,
                Size = j.Size,
                StatusName = status != null ? status.UcjsName : null,
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
                InvoiceDate = invoice != null ? invoice.Created : null,
                IsArchived = j.Archived ?? false,
                LoggedInContact = loggedInContact != null
                    ? loggedInContact.UcctFirstname + Space + loggedInContact.UcctSurname
                    : null,
                RawBaseAmount = j.RawBaseAmount,
                CourierCode = courier != null ? courier.Code : null
            };

        var result = await query.ToListAsync();

        // Return single jobs and child jobs only, ignore parent of child jobs
        // Build HashSet of parent IDs for O(1) lookup instead of O(n) Any()
        var parentIdsWithChildren = new HashSet<int>(
            result.Where(j => j.ParentId.HasValue && j.ParentId != j.Id)
                  .Select(j => j.ParentId!.Value));

        return result
            .Where(j =>
                j.Id != (j.ParentId ?? j.Id) || !parentIdsWithChildren.Contains(j.Id))
            .ToList();
    }

    /// <summary>
    /// Retrieves performance and spend report data for a client by calling a stored procedure.
    /// </summary>
    /// <param name="request">Request containing client ID and date range.</param>
    /// <returns>List of performance metrics including delivery times, charges, and courier info.</returns>
    public async Task<List<PerformanceSpendReportModel>> GetClientJobsReportDataAsync(
        [FromQuery] ClientJobsReportRequest request)
    {
        try
        {
            var results = await Context.Procedures.REP_qryPerformance_Summary_PerformanceSpendAsync(
                request.ClientId ?? 0,
                request.StartDate.Date,
                request.EndDate.Date
            );

            return results.Select(r => new PerformanceSpendReportModel
            {
                JobNumber = r.JobNumber,
                ucjbType = r.ucjbType,
                Date = r.Date?.ToString("yyyy-MM-dd"),
                Booked = r.Booked?.ToString("yyyy-MM-dd HH:mm:ss"),
                BookedBy = r.BookedBy,
                PickedUpTime = r.Pickeduptime?.ToString("yyyy-MM-dd HH:mm:ss"),
                Delivered = r.Delivered?.ToString("yyyy-MM-dd HH:mm:ss"),
                TotalTime = r.TotalTime?.ToString(),
                DeliveryMins = r.DeliveryMins?.ToString(),
                PODName = r.PODName,
                Booker = r.Booker,
                AchievedSpeed = r.AchievedSpeed,
                From = r.From,
                FromPostcode = r.FromPostcode,
                To = r.To,
                ToPostcode = r.ToPostcode,
                ucjbFromAddr = r.ucjbFromAddr,
                Address = r.Address,
                Courier = r.Courier?.ToString(),
                LatePickup = r.LatePickup?.ToString(),
                LateDelivery = r.LateDelivery?.ToString(),
                ucclLegalName = r.ucclLegalName,
                ucjbSpeed = r.ucjbSpeed?.ToString(),
                Notes = r.Notes,
                ChargeExclGST = r.ChargeExclGST?.ToString("F2"),
                RefA = r.RefA,
                RefB = r.RefB,
                UrgentRef = r.UrgentRef,
                Weight = r.Weight?.ToString(),
                Vehicle = r.Vehicle,
                Quantity = r.Quantity?.ToString(),
                ucjbYear = r.ucjbYear?.ToString(),
                ucjbMonth = r.ucjbMonth?.ToString(),
                Code = r.Code,
                uccrName = r.uccrName,
                ucjbInvoiceNo = r.ucjbInvoiceNo?.ToString(),
                ucjbLocked = r.ucjbLocked?.ToString(),
                ucjbClientID = r.ucjbClientID?.ToString(),
                ucclNote = r.ucclNote,
                Minutes = r.Minutes?.ToString()
            }).ToList();
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository),
                    nameof(GetClientJobsReportDataAsync)));
            throw;
        }
    }

    /// <summary>
    /// Retrieves current active (non-completed, non-void) jobs for a specific courier.
    /// </summary>
    /// <param name="courierId">The courier ID to filter by.</param>
    /// <param name="startDate">Start of date range.</param>
    /// <param name="endDate">End of date range.</param>
    /// <returns>Search result with jobs and map items for the courier.</returns>
    public async Task<JobSearchResult> CurrentJobListAsync(int courierId,
        DateTimeOffset startDate,
        DateTimeOffset endDate)
    {
        var isUsCustomer = _infoService.IsUsTenant();
        var start = startDate.DateTime;
        var end = endDate.DateTime;

        var query = Context.TucJobs
            .AsNoTracking()
            .Where(j => j.UcjbCourierId == courierId
                        && !j.UcjbJobDone && !j.UcjbVoid
                        && j.UcjbStatus != (int)JobStatus.Void
                        && j.UcjbStatus != (int)JobStatus.Completed
                        && j.UcjbDate >= start
                        && j.UcjbDate <= end);

        // Fetch economy settings in parallel with the main query
        var economyTask = GetEconomySpeedAndDeliveryTimeAsync();

        // Single query to get both jobs and map items data
        var jobs = await query
            .Select(JobMappings.JobDispatchMapping(isUsCustomer))
            .ToListAsync();

        var totalCount = jobs.Count;

        // Build map items from jobs (avoids the second query)
        var mapItems = jobs.Select(j => new DispatchMapItem
        {
            JobId = j.Id,
            JobNo = j.JobNo,
            PickupAddress = j.PickupAddress,
            DeliveryAddress = j.DeliveryAddress,
            AssignedCourier = j.AssignedCourier
        }).ToList();

        // Calculate remaining time for each job
        var (economySpeedId, ecoDeliveryTime) = await economyTask;
        var now = _infoService.GetCurrentTenantTime();
        foreach (var job in jobs)
        {
            job.AngularId = Guid.NewGuid();
            job.Remain = CalculateRemainTime(job, now, economySpeedId, ecoDeliveryTime);
        }

        return new JobSearchResult
        {
            Jobs = jobs,
            TotalCount = totalCount,
            HasMore = false,
            MapItems = mapItems
        };
    }

    /// <summary>
    /// Retrieves paginated job list for the dispatch page with full filtering support.
    /// </summary>
    /// <param name="queryParams">Query parameters including pagination, filters, and sorting.</param>
    /// <param name="isInternal">Whether the user is internal staff.</param>
    /// <param name="isUsTenant">Whether this is a US tenant.</param>
    /// <param name="clientIds">Comma-separated list of client IDs to filter by.</param>
    /// <param name="selectedViewIds">List of view IDs to filter by.</param>
    /// <param name="selectedClearListId">Optional clear list ID to filter by.</param>
    /// <returns>Paginated job search results.</returns>
    public async Task<JobSearchResult> JobListAsync(
        JobQueryParams queryParams,
        bool isInternal,
        bool isUsTenant,
        string clientIds,
        List<int> selectedViewIds,
        int? selectedClearListId = null)
    {
        return await DespatchQry(
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

    /// <summary>
    /// Swaps POD (proof of delivery) data between two jobs.
    /// </summary>
    public async Task SwapPodAsync(string job1,
        string job2) =>
        await Context.Procedures.DESWEB_qdfSwapPODAsync(job1, job2);

    /// <summary>
    /// Restores selected jobs back to dispatch status.
    /// </summary>
    /// <param name="jobIds">List of job IDs to redispatch.</param>
    public async Task ReDispatchSelectedJobsAsync(List<int> jobIds)
    {
        try
        {
            foreach (var jobId in jobIds) await Context.Procedures.uspRestoreJobAsync(jobId);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository),
                    nameof(ReDispatchSelectedJobsAsync)));
            throw;
        }
    }

    /// <summary>
    /// Re-sends selected jobs to the courier device.
    /// </summary>
    /// <param name="jobIds">Comma-separated list of job IDs to resend.</param>
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

    /// <summary>
    /// Re-assigns selected jobs to auto-dispatch for courier reassignment.
    /// </summary>
    /// <param name="jobIds">Comma-separated list of job IDs to reassign.</param>
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

    /// <summary>
    /// Sets a job as the first priority job for a courier.
    /// </summary>
    public async Task SetFirstJobAsync(int jobId,
        int courierId) =>
        await Context.Procedures.DES_stpJob_AutoDespatchSelectedJobs_FSCourierIDAsync(jobId, courierId);

    /// <summary>
    /// Updates POD (proof of delivery) details including name, time, and status for a job and its related jobs.
    /// </summary>
    /// <param name="data">POD update request with job ID and POD details.</param>
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

        // Check for uncompleted sibling jobs (child jobs with the same parent)
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

    /// <summary>
    /// Re-sends all jobs assigned to a courier to their device.
    /// </summary>
    public async Task ReSendAllJobsAsync(int courierId) =>
        await Context.Procedures.uspReDespatchJobByCourierIDAsync(courierId);

    /// <summary>
    /// Gets the maximum auto late pickup alert threshold from system settings.
    /// </summary>
    public async Task<int> MaxAutoLatePickupAlertAsync()
    {
        var maxAutoLatePickupAlert = new OutputParameter<int?>();
        await Context.Procedures.GEN_qdfSetting_GetMaxAutoLatePickupAlertAsync(maxAutoLatePickupAlert);
        return maxAutoLatePickupAlert.Value ?? 0;
    }

    /// <summary>
    /// Gets the maximum auto late delivery alert threshold from system settings.
    /// </summary>
    public async Task<int> MaxAutoLateDeliveryAlertAsync()
    {
        var maxAutoLateDeliveryAlert = new OutputParameter<int?>();
        await Context.Procedures.GEN_qdfSetting_GetMaxAutoLateDeliveryAlertAsync(maxAutoLateDeliveryAlert);
        return maxAutoLateDeliveryAlert.Value ?? 0;
    }

    /// <summary>
    /// Calculates the PPD (Pre-Paid Discount) exclusive amount for a client.
    /// </summary>
    public async Task<decimal> PpdExclusiveAmountAsync(int clientId,
        decimal amount) =>
        await CalculateAmountAsync(clientId, amount);

    /// <summary>
    /// Resets the late notification flag for a job's pickup or delivery event.
    /// </summary>
    /// <param name="jobId">The job ID.</param>
    /// <param name="lateEventType">The type of late event (Pickup or Delivery).</param>
    public async Task ResetLateEventAsync(int jobId,
        int lateEventType)
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

    /// <summary>
    /// Marks a job as late for pickup and updates the late pickup time.
    /// </summary>
    /// <param name="jobId">The job ID.</param>
    /// <param name="bookedSpeed">The booked speed short name.</param>
    /// <param name="notifiedSpeed">The notified speed short name.</param>
    /// <param name="late">The late time in minutes.</param>
    /// <param name="calculationRequired">Whether to calculate the late time based on ETA.</param>
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

    /// <summary>
    /// Marks a job as late for delivery and updates the late delivery time.
    /// </summary>
    /// <param name="jobId">The job ID.</param>
    /// <param name="bookedSpeed">The booked speed short name.</param>
    /// <param name="notifiedSpeed">The notified speed short name.</param>
    /// <param name="late">The late time in minutes.</param>
    /// <param name="calculationRequired">Whether to calculate the late time based on ETA.</param>
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
        var job = await Context.TucJobs.FirstOrDefaultAsync(j => j.UcjbId == jobId);
        ArgumentNullException.ThrowIfNull(job);

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

    /// <summary>
    /// Restores split jobs back to their original state.
    /// </summary>
    /// <param name="jobIds">List of job IDs to restore.</param>
    public async Task RestoreSplitJobsAsync(List<int> jobIds)
    {
        if (jobIds == null || jobIds.Count == 0)
            return;

        foreach (var jobId in jobIds) await Context.Procedures.DES_stpJob_SplitJobRestoreAsync(jobId);
    }

    /// <summary>
    /// Restores voided or completed jobs back to active dispatch status.
    /// </summary>
    /// <param name="jobIds">List of job IDs to restore.</param>
    public async Task RestoreJobsAsync(List<int> jobIds)
    {
        try
        {
            if (jobIds == null || jobIds.Count == 0)
                return;

            foreach (var jobId in jobIds) await Context.Procedures.uspRestoreJobAsync(jobId);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository), nameof(RestoreJobsAsync)));
            throw;
        }
    }

    /// <summary>
    /// Voids a job and optionally its related jobs, clearing all pricing fields and closing tasks.
    /// </summary>
    /// <param name="data">Void request containing job ID, reason, and options for voiding related jobs.</param>
    public async Task VoidJobAsync(VoidJobRequest data)
    {
        try
        {
            // Use selected job IDs if provided, otherwise fall back to legacy behavior
            var jobsToVoid = data.SelectedJobIds is { Count: > 0 }
                ? data.SelectedJobIds
                : data.VoidSingleJobOnly
                    ? [data.JobId]
                    : await GetAllRelatedJobIdsIncludingParentAsync(data.JobId);

            if (jobsToVoid.Count == 0) return;

            // Get courier IDs before voiding
            var courierIds = await Context.TucJobs
                .AsNoTracking()
                .Where(jt => jobsToVoid.Contains(jt.UcjbId) && jt.UcjbCourierId.HasValue)
                .Select(jt => jt.UcjbCourierId!.Value)
                .Distinct()
                .TagWith($"VoidJob - Get Courier IDs for {jobsToVoid.Count} jobs")
                .ToListAsync();

            // Execute a void operation and clear all pricing fields
            await Context.TucJobs
                .Where(j => jobsToVoid.Contains(j.UcjbId))
                .TagWith($"VoidJob - Update {jobsToVoid.Count} jobs")
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(j => j.UcjbStatus, (int)JobStatus.Void)
                    .SetProperty(j => j.UcjbVoid, true)
                    .SetProperty(j => j.UcjbAmount, 0)
                    .SetProperty(j => j.FuelSurchargeAmount, 0m)
                    .SetProperty(j => j.Ppdamount, 0)
                    .SetProperty(j => j.PpdexclusiveAmount, 0)
                    .SetProperty(j => j.PickupAmount, 0)
                    .SetProperty(j => j.DropoffAmount, 0)
                    .SetProperty(j => j.Nwamount, 0)
                    .SetProperty(j => j.Gssamount, 0)
                    .SetProperty(j => j.RawAmount, 0)
                    .SetProperty(j => j.PickupRawAmount, 0)
                    .SetProperty(j => j.DropoffRawAmount, 0)
                    .SetProperty(j => j.NwrawAmount, 0)
                    .SetProperty(j => j.RawBaseAmount, 0));

            // Clear pricing breakdowns for voided jobs
            await Context.PricingBreakdowns
                .Where(p => (p.JobId.HasValue && jobsToVoid.Contains(p.JobId.Value)) ||
                            (p.ChildJobId.HasValue && jobsToVoid.Contains(p.ChildJobId.Value)))
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(p => p.ChargeAmount, 0m)
                    .SetProperty(p => p.Total, 0)
                    .SetProperty(p => p.Included, 0)
                    .SetProperty(p => p.Charged, 0)
                    .SetProperty(p => p.CostAmount, 0));

            // Update courier statuses
            if (courierIds.Count > 0) await UpdateClearListAreaOrderStatus(courierIds);

            // Close tasks
            await CloseTasksByJobIdsAsync(jobsToVoid);
            await SaveNoteToMultipleJobsAsync(jobsToVoid, data.VoidReason);

            await Context.SaveChangesAsync();
        }
        catch (Exception e)
        {
            Log.Error(e, "Error voiding job {JobId} (SingleOnly: {VoidSingleJobOnly})",
                data.JobId, data.VoidSingleJobOnly);
            throw;
        }
    }

    /// <summary>
    /// Voids a bulk job and optionally its related jobs, updating courier statuses and closing tasks.
    /// </summary>
    /// <param name="data">Void request containing bulk job ID, reason, and options for voiding related jobs.</param>
    public async Task VoidBulkJobAsync(VoidBulkJobRequest data)
    {
        try
        {
            // Use selected job IDs if provided, otherwise fall back to legacy behavior
            var jobsToVoid = data.SelectedJobIds is { Count: > 0 }
                ? data.SelectedJobIds
                : data.VoidSingleJobOnly
                    ? [data.BulkJobId]
                    : await GetAllRelatedBulkJobIdsIncludingParentAsync(data.BulkJobId);

            // Combined query: void jobs and get distinct courier IDs in parallel
            await Context.TblBulkJobs
                .Where(j => jobsToVoid.Contains(j.BulkJobId))
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(j => j.JobStatus, (int)JobStatus.Void)
                    .SetProperty(j => j.Void, true));

            var courierIds = await Context.TblBulkJobs
                .Where(jt => jobsToVoid.Contains(jt.BulkJobId) && jt.CourierId.HasValue)
                .Select(jt => jt.CourierId.Value)
                .Distinct()
                .ToListAsync();

            // Update courier statuses in parallel
            await UpdateClearListAreaOrderStatus(courierIds);

            // Close tasks and add notes
            await CloseAllBulkJobTasksAsync(jobsToVoid);
            await SaveMultipleBulkNotesAsync(jobsToVoid, data.VoidReason);
        }
        catch (Exception e)
        {
            Log.Error(e, "Error voiding job {JobId} (SingleOnly: {VoidSingleJobOnly})",
                data.BulkJobId, data.VoidSingleJobOnly);
            throw;
        }
    }

    /// <summary>
    /// Splits a job into multiple child jobs for separate delivery handling.
    /// </summary>
    /// <param name="jobId">The job ID to split.</param>
    /// <param name="user">The username performing the split.</param>
    public async Task SplitJobAsync(int jobId,
        string user)
    {
        try
        {
            Log.Information("Splitting job {JobId} by user {User}", jobId, user);
            await Context.Procedures.DES_stpJob_SplitJobAsync(jobId, false, user);
        }
        catch (Exception e)
        {
            Log.Error(e, "Error splitting job {JobId}", jobId);
            throw;
        }
    }

    /// <summary>
    /// Reverses a job split, merging child jobs back into the parent.
    /// </summary>
    /// <param name="jobId">The job ID to unsplit.</param>
    /// <returns>Status message from the unsplit operation.</returns>
    public async Task<string> UnSplitJobAsync(int jobId)
    {
        var message = new OutputParameter<string>();
        var returnValue = new OutputParameter<int>();

        await Context.Procedures.DES_stpJob_UnSplitAsync(jobId, message, returnValue);
        return message.Value;
    }

    /// <summary>
    /// Updates the meeting address for a split job handoff point.
    /// </summary>
    /// <param name="jobId">The split job ID.</param>
    /// <param name="toSuburbId">The destination suburb ID.</param>
    /// <param name="address">The meeting address.</param>
    /// <param name="deliveryLat">Meeting point latitude.</param>
    /// <param name="deliveryLng">Meeting point longitude.</param>
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

    /// <summary>
    /// Re-rates a split job after address changes.
    /// </summary>
    public async Task ReRateSplitJobAsync(int jobId) =>
        await Context.Procedures.DES_stpJob_SplitJob_ReRateAsync(jobId, false);

    /// <summary>
    /// Completes the split job process by consolidating information and updating dispatch display.
    /// </summary>
    /// <param name="jobId">The split job ID.</param>
    /// <param name="despatcher">The dispatcher username.</param>
    public async Task FinishSplitJobProcessAsync(int jobId,
        string despatcher)
    {
        await Context.Procedures.DES_stpJob_ColsolidateMarsInformationAsync(
            jobId,
            false,
            despatcher,
            null
        );

        await UpdateJobDisplayInDespatchAsync(jobId);
    }

    /// <summary>
    /// Retrieves all suburbs for lookup/autocomplete functionality.
    /// </summary>
    public async Task<List<SuburbLookup>> GetSuburbsAsync()
    {
        return await Context.TucSuburbs
            .AsNoTracking()
            .Select(s => new SuburbLookup
            {
                Id = s.UcsuId,
                Text = s.UcsuName,
                Alias = s.GoogleSuburbAlias
            })
            .ToListAsync();
    }

    /// <summary>
    /// Retrieves all available job speeds/types.
    /// </summary>
    public async Task<List<Suggestion>> GetSpeedsAsync()
    {
        return await Context.DesQryAllJobTypes
            .AsNoTracking()
            .Select(x => new Suggestion { Id = x.JobTypeId, Text = x.Name })
            .ToListAsync();
    }

    /// <summary>
    /// Searches job speeds/types by name.
    /// </summary>
    /// <param name="searchTerm">The search term to filter speeds by.</param>
    public async Task<List<Suggestion>> GetSpeedsBySearchTermAsync(string searchTerm)
    {
        return await Context.DesQryAllJobTypes
            .AsNoTracking()
            .Where(jt => EF.Functions.Like(jt.Name, $"%{searchTerm}%"))
            .Select(jt => new Suggestion { Id = jt.JobTypeId, Text = jt.Name })
            .ToListAsync();
    }

    /// <summary>
    /// Retrieves active contacts for a specific client.
    /// </summary>
    /// <param name="clientId">The client ID to get contacts for.</param>
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

    /// <summary>
    /// Retrieves available locations where parcels can be left if recipient not home.
    /// </summary>
    public async Task<List<Lookup>> LeaveParcelLocationsAsync()
    {
        return await Context.TblJobLeaveNotHomes
            .AsNoTracking()
            .OrderBy(l => l.Sequence)
            .Select(x => new Lookup { Id = x.LeaveNotHomeId, Text = x.Name })
            .ToListAsync();
    }

    /// <summary>
    /// Retrieves available undeliverable location options (e.g., wrong address, refused).
    /// </summary>
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

    /// <summary>
    /// Retrieves available internal job statuses for dispatch workflow.
    /// </summary>
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

    /// <summary>
    /// Retrieves all available job statuses.
    /// </summary>
    public async Task<List<Suggestion>> GetStatusListAsync()
    {
        return await Context.TucJobStatuses
            .AsNoTracking()
            .OrderBy(s => s.UcjsName)
            .Select(s => new Suggestion { Id = s.UcjsId, Text = s.UcjsName })
            .ToListAsync();
    }

    /// <summary>
    /// Retrieves event types for customer service and general events.
    /// </summary>
    public async Task<List<Suggestion>> EventTypeListAsync()
    {
        return await Context.TucEventTypes
            .AsNoTracking()
            .Where(u => u.UcetGroup == "CS" || u.UcetGroup == "GE")
            .OrderBy(u => u.UcetName)
            .Select(x => new Suggestion { Id = x.UcetId, Text = x.UcetName })
            .ToListAsync();
    }

    /// <summary>
    /// Retrieves pricing breakdown components for a job or prebook job.
    /// </summary>
    /// <param name="jobId">The job or prebook job ID.</param>
    /// <param name="isPrebook">True if querying a prebook job.</param>
    /// <returns>List of charge components making up the total price.</returns>
    public async Task<List<ChargeViewModel>> GetJobPriceBreakdownAsync(int jobId,
        bool isPrebook)
    {
        int effectivePrebookId;
        if (isPrebook)
        {
            effectivePrebookId = await Context.GetEffectiveJobBookingIdAsync(jobId);
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

        var effectiveJobId = await Context.GetEffectiveJobIdAsync(jobId);
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

    /// <summary>
    /// Adds a new pricing breakdown component to a job or prebook job.
    /// </summary>
    /// <param name="viewModel">The charge details to add.</param>
    /// <returns>The ID of the newly created pricing breakdown record.</returns>
    public async Task<int> AddJobPriceBreakdownAsync(ChargeViewModel viewModel)
    {
        try
        {
            if (viewModel.ChildJobId is null && viewModel.PrebookJobId is null)
                return 0;

            var isPrebook = viewModel.PrebookJobId.HasValue;

            int effectiveJobId;
            if (!isPrebook && viewModel.ChildJobId.HasValue)
                effectiveJobId = await Context.GetEffectiveJobIdAsync(viewModel.ChildJobId.Value);
            else effectiveJobId = await Context.GetEffectiveJobBookingIdAsync(viewModel.PrebookJobId ?? 0);

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

    /// <summary>
    /// Updates an existing pricing breakdown component.
    /// </summary>
    /// <param name="viewModel">The updated charge details.</param>
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

    /// <summary>
    /// Deletes a pricing breakdown component from a job.
    /// </summary>
    /// <param name="chargeId">The pricing breakdown ID to delete.</param>
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

    /// <summary>
    /// Voids a prebook/recurring job.
    /// </summary>
    /// <param name="jobId">The prebook job ID to void.</param>
    public async Task VoidPrebookJobAsync(int jobId)
    {
        var staffInfo = await _infoService.GetStaffInfoAsync();
        await Context.Procedures.DESWEB_stpVoidPrebookJobAsync(jobId, staffInfo.Text, staffInfo.Id);
    }


    /// <summary>
    /// Updates the delivery address for a job (active or archived).
    /// </summary>
    /// <param name="request">Request containing job ID and new address details.</param>
    public async Task UpdateDeliveryAddressAsync(UpdateAddressRequest request)
    {
        try
        {
            var address = request.Address;
            var isArchived = await IsJobArchived(request.JobId);

            // Combine all address lines for device sync field
            var fullAddress = CombineAddressLines(address);

            // Update archive record if JobId is found
            if (isArchived)
            {
                await Context.TucJobArchives
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
                        .SetProperty(j => j.DeliveryAddressLine7, address.AddressLine7)
                        .SetProperty(j => j.UcjbToAddr, fullAddress));

                return;
            }

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
                    .SetProperty(j => j.DeliveryAddressLine7, address.AddressLine7)
                    .SetProperty(j => j.UcjbToAddr, fullAddress));

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

    /// <summary>
    /// Updates the pickup address for a job (active or archived).
    /// </summary>
    /// <param name="request">Request containing job ID and new address details.</param>
    public async Task UpdatePickupAddressAsync(UpdateAddressRequest request)
    {
        try
        {
            var address = request.Address;
            var isArchived = await IsJobArchived(request.JobId);

            // Combine all address lines for device sync field
            var fullAddress = CombineAddressLines(address);

            if (isArchived)
            {
                await Context.TucJobArchives
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
                        .SetProperty(j => j.PickupAddressLine7, address.AddressLine7)
                        .SetProperty(j => j.UcjbFromAddr, fullAddress));

                return;
            }

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
                    .SetProperty(j => j.PickupAddressLine7, address.AddressLine7)
                    .SetProperty(j => j.UcjbFromAddr, fullAddress));

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

    /// <summary>
    /// Updates a single property on a job (active or archived).
    /// </summary>
    /// <param name="jobId">The job ID to update.</param>
    /// <param name="field">The property to update.</param>
    /// <param name="value">The new value.</param>
    public async Task UpdateJobAsync(
        int jobId,
        JobProperty field,
        string value
    )
    {
        try
        {
            var isArchived = await IsJobArchived(jobId);
            if (isArchived)
            {
                await UpdateTucJobArchiveAsync(jobId, field, value);
                return;
            }

            // Job will be active
            await UpdateTucJobAsync(jobId, field, value);
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured updating Job {jobId}", jobId);
            throw;
        }
    }

    /// <summary>
    /// Releases a bulk job for dispatch, creating the associated run and TUC jobs.
    /// </summary>
    /// <param name="bulkJobId">The bulk job ID to release.</param>
    public async Task ReleaseBulkJobByIdAsync(int bulkJobId)
    {
        await using var transaction = await Context.Database.BeginTransactionAsync();

        try
        {
            var currentTenantTime = _infoService.GetCurrentTenantTime();
            var releaseNote = $"Bulk Job Released Manually at {currentTenantTime:dd/MM/yyyy HH:mm}\r\n";

            // Update book date and notes in a single query
            var updatedCount = await Context.TblBulkJobs
                .Where(b => b.BulkJobId == bulkJobId || b.ParentId == bulkJobId)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(b => b.BookDate, currentTenantTime)
                    .SetProperty(b => b.Notes, b => releaseNote + (b.Notes ?? string.Empty)));

            if (updatedCount == 0)
            {
                await transaction.CommitAsync();
                return; // No bulk jobs to process
            }

            // Get bulk job info and existing run name in a single query
            var bulkJobInfo = await Context.TblBulkJobs
                .Where(b => (b.BulkJobId == bulkJobId || b.ParentId == bulkJobId) && b.Done == false)
                .Select(b => new
                {
                    b.BulkJobId,
                    b.ClientCode,
                    ExistingRunName = Context.TblBulkJobRuns
                        .Where(jr => jr.BulkJobId == b.BulkJobId)
                        .Join(Context.TblBulkRuns,
                            jr => jr.RunId,
                            r => r.Id,
                            (jr, r) => r.Name)
                        .FirstOrDefault()
                })
                .FirstOrDefaultAsync();

            if (bulkJobInfo == null)
            {
                await transaction.CommitAsync();
                return;
            }

            var runName = bulkJobInfo.ExistingRunName;

            // Create a run if it doesn't exist
            if (string.IsNullOrEmpty(runName))
            {
                runName = bulkJobInfo.ClientCode + currentTenantTime.ToString("HHmm");

                var newRun = new TblBulkRun
                {
                    Name = runName,
                    Mins = null,
                    Kms = null,
                    CourierId = null,
                    Status = 0,
                    Revenue = null,
                    Payout = null,
                    CourierPercentage = null,
                    GoogleRouteResponse = null,
                    Created = currentTenantTime,
                    LastModified = currentTenantTime
                };

                await Context.TblBulkRuns.AddAsync(newRun);
                await Context.SaveChangesAsync();

                // Get all bulk job IDs in a single query
                var bulkJobIds = await Context.TblBulkJobs
                    .Where(b => b.Done == false && (b.BulkJobId == bulkJobId || b.ParentId == bulkJobId))
                    .Select(b => b.BulkJobId)
                    .ToListAsync();

                // Bulk insert job-run relationships
                var jobRuns = bulkJobIds.Select(bjId => new TblBulkJobRun
                {
                    RunId = newRun.Id,
                    BulkJobId = bjId,
                    PickRunOrder = null
                }).ToList();

                await Context.TblBulkJobRuns.AddRangeAsync(jobRuns);
                await Context.SaveChangesAsync();
            }

            // Get bulk jobs to create
            var bulkJobsToCreate = await Context.TblBulkJobs
                .Where(b => b.Done == false && (b.BulkJobId == bulkJobId || b.ParentId == bulkJobId))
                .OrderBy(b => b.BookDate)
                .ThenBy(b => b.BookTime)
                .ThenBy(b => b.BulkJobId)
                .Select(b => b.BulkJobId)
                .ToListAsync();

            // Process each bulk job with the run name (either existing or newly created)
            foreach (var bjId in bulkJobsToCreate)
            {
                await Context.Procedures.UTL_stpJob_InsertFromTblBulkJobAsync(
                    bulkJobID: bjId,
                    runName: runName,
                    courierID: null,
                    runStatus: null,
                    returnValue: null,
                    cancellationToken: CancellationToken.None
                );
            }

            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    /// <summary>
    /// Creates a new job with minimal required information for quick entry.
    /// </summary>
    /// <param name="request">Job creation request with addresses, client, and speed.</param>
    /// <returns>The ID of the newly created job.</returns>
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

    /// <summary>
    /// Gets the name of a staff member by ID.
    /// </summary>
    public async Task<string> GetStaffNameAsync(int staffId) => await Context.TucStaffs
        .AsNoTracking()
        .Where(s => s.UcstId == staffId)
        .Select(s => s.UcstFirstName + " " + s.UcstLastName)
        .FirstOrDefaultAsync();

    /// <summary>
    /// Creates paired jobs for an inter-courier charge transfer between two couriers.
    /// </summary>
    /// <param name="viewModel">The inter-courier charge details including from/to courier and amount.</param>
    public async Task AddInterCourierChargeAsync(InterCourierChargeViewModel viewModel)
    {
        try
        {
            var staffId = _infoService.GetStaffId();
            var currentTime = _infoService.GetCurrentTenantTime();

            var note = $"From # {viewModel.FromCourierId} To # {viewModel.ToCourierId}";

            // Custom context to run a job number stored process in parallel 
            await using var fromJobNumberContext = await _contextFactory.CreateDbContextAsync();
            await using var toJobNumberContext = await _contextFactory.CreateDbContextAsync();

            var fromJobNumber =
                await GenerateJobNumberAsync(staffId, (int)JobServiceType.AllServices, fromJobNumberContext);
            var toJobNumber =
                await GenerateJobNumberAsync(staffId, (int)JobServiceType.AllServices, toJobNumberContext);

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

    /// <summary>
    /// Checks if a client has any active items available for a specific speed.
    /// </summary>
    public async Task<bool> HasClientItemsAvailableAsync(int clientId,
        int speedId)
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

    /// <summary>
    /// Retrieves paginated client items available for a specific speed, with selection state from a job.
    /// </summary>
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

    /// <summary>
    /// Associates client items with a job and updates the job amount.
    /// </summary>
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

    /// <summary>
    /// Retrieves job details needed for late call notification processing.
    /// </summary>
    public async Task<JobLateCallDto> GetJobForLateCallAsync(int jobId)
    {
        var job = await Context.TucJobs
            .AsNoTracking()
            .Where(j => j.UcjbId == jobId)
            .Select(JobMappings.JobLateCallMapping)
            .FirstOrDefaultAsync();

        return job;
    }

    /// <summary>
    /// Retrieves all available time zone options for selection.
    /// </summary>
    public async Task<List<TimeZoneSuggestion>> GetTimeZoneOptions()
    {
        var timeZones = await Context.TimeZones
            .AsNoTracking()
            .Select(t => new TimeZoneSuggestion
            {
                Id = t.Id,
                Text = t.DisplayName + " " + t.Code,
                TimeZoneIana = t.Name
            })
            .OrderBy(tz => tz.TimeZoneIana)
            .ToListAsync();

        return timeZones;
    }

    /// <summary>
    /// Updates the read status for multiple jobs in a single atomic operation.
    /// </summary>
    /// <param name="data">Request containing job IDs and whether to mark as read or unread.</param>
    public async Task BulkUpdateReadStatusAsync(BulkReadUpdateRequestModel data)
    {
        var jobIds = data.JobIds;
        if (jobIds == null || jobIds.Count == 0) return;

        var currentTenantTime = _infoService.GetCurrentTenantTime();
        var staffId = _infoService.GetStaffId();
        var shouldMarkAsRead = data.ShouldMarkAsRead;

        // Build comma-separated list of job IDs for SQL IN clause
        var jobIdList = string.Join(",", jobIds);

        // Use a single atomic SQL statement to handle both update and insert
        // This prevents the race condition where multiple pods try to insert the same JobId
        await Context.Database.ExecuteSqlRawAsync($@"
            -- Update existing tracker records
            UPDATE tucJobReadTracker
            SET HasBeenRead = @p0, ReadTimestamp = @p1, ReadByStaffId = @p2
            WHERE JobId IN ({jobIdList});

            -- Insert new tracker records only for jobs that exist in tucJob and don't have a tracker yet
            -- Uses NOT EXISTS to prevent PK violation race condition
            INSERT INTO tucJobReadTracker (JobId, HasBeenRead, ReadByStaffId, ReadTimestamp)
            SELECT j.UcjbId, @p0, @p2, @p1
            FROM tucJob j
            WHERE j.UcjbId IN ({jobIdList})
              AND NOT EXISTS (SELECT 1 FROM tucJobReadTracker t WHERE t.JobId = j.UcjbId);",
            shouldMarkAsRead, currentTenantTime, staffId);
    }

    /// <summary>
    /// Checks if a job number already exists in the system.
    /// </summary>
    public async Task<bool> JobNumberExistsAsync(string jobNumber) =>
        await Context.TucJobs.AnyAsync(j => j.UcjbNumber == jobNumber);

    /// <summary>
    /// Calculates the raw price for a nationwide service job using the database function.
    /// </summary>
    public async Task<decimal> GetNationwideServiceRawPriceAsync(int? clientId,
        int? fromSuburbId,
        int? toSuburbId,
        int? speed,
        int? size,
        float? weight,
        int? quantity,
        int? type)
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

    /// <summary>
    /// Retrieves detailed dispatch information for a job, checking both active and archived tables.
    /// </summary>
    /// <param name="jobId">The job ID to retrieve.</param>
    /// <returns>Dispatch job view model with full details including addresses, courier, and status.</returns>
    public async Task<DispatchJobViewModel> GetDispatchJobDetailAsync(int jobId)
    {
        var isUsCustomer = _infoService.IsUsTenant();

        // First, try to get from active jobs (TucJobs)
        var activeJob = await Context.TucJobs
            .AsNoTracking()
            .Where(j => j.UcjbId == jobId)
            .Select(JobMappings.JobDispatchMapping(isUsCustomer))
            .FirstOrDefaultAsync();

        if (activeJob != null)
        {
            // TucJob doesn't have an Archived field, so check tblJobs view for the actual archived status
            var archivedStatus = await Context.TblJobs
                .AsNoTracking()
                .Where(j => j.JobId == jobId)
                .Select(j => j.Archived ?? false)
                .FirstOrDefaultAsync();

            activeJob.IsArchived = archivedStatus;
            return activeJob;
        }

        // If not found in active jobs, try archived jobs (TblJobs)
        var archivedJobQuery =
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
            join rt in Context.TucJobReadTrackers on j.JobId equals rt.JobId into rtJoin
            from readTracker in rtJoin.DefaultIfEmpty()
            join vs in Context.VehicleSizes on j.Size equals vs.VehicleSizeId into vsJoin
            from vehicleSize in vsJoin.DefaultIfEmpty()
            join cl in Context.TucClients on j.ClientId equals cl.UcclId into clientJoin
            from client in clientJoin.DefaultIfEmpty()
            where j.JobId == jobId
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
                CourierData = co != null
                    ? new CourierData
                    {
                        Courier = co.Code,
                        CourierNumber = co.Code,
                        CourierId = co.UccrId,
                        CourierMobile = co.UccrMobile,
                        CourierName = co.UccrName + " " + co.UccrSurname
                    }
                    : null,
                AssignedCourier = co != null
                    ? new Suggestion
                    {
                        Id = co.UccrId,
                        Text = co.UccrName + " " + co.UccrSurname
                    }
                    : null,
                StatusId = j.Status,
                Status = status != null ? status.UcjsCode : null,
                StatusName = status != null ? status.UcjsName : null,
                Speed = speed != null ? speed.ShortName : null,
                SpeedId = j.Speed,
                JobTypeMins = speed != null ? speed.Minutes : null,
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
                    : null,
                IsArchived = j.Archived ?? false, // Use the actual Archived field from TblJobs view
                Locked = j.Locked.HasValue ? j.Locked != 0 : null,
                ToAirportId = j.ToAirportId,
                FromAirportId = j.FromAirportId,
                PickupContact = j.PickupFromContact,
                DeliveryContact = j.DeliverToContact
            };

        return await archivedJobQuery.AsNoTracking().FirstOrDefaultAsync();
    }

    /// <summary>
    /// Creates a new note type for job notes.
    /// </summary>
    /// <param name="noteType">The note type details to create.</param>
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

    /// <summary>
    /// Determines if a job has a parent (is a child job in a split or family).
    /// </summary>
    /// <param name="jobId">The job ID to check.</param>
    /// <returns>True if the job has a parent.</returns>
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

    /// <summary>
    /// Determines if a bulk job has a parent (is a child in a family).
    /// </summary>
    /// <param name="bulkJobId">The bulk job ID to check.</param>
    /// <returns>True if the bulk job has a parent.</returns>
    public async Task<bool> IsBulkJobParent(int bulkJobId)
    {
        var isParent = await Context.TblBulkJobs
            .Where(j => j.BulkJobId == bulkJobId)
            .Select(j => j.ParentId.HasValue || j.BulkParentId.HasValue)
            .FirstOrDefaultAsync();

        return isParent;
    }

    /// <summary>
    /// Retrieves all active note types for job notes.
    /// </summary>
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

    /// <summary>
    /// Updates or creates package/parcel items for a job.
    /// </summary>
    /// <param name="jobId">The job ID to update packages for.</param>
    /// <param name="parcels">List of parcel dimensions to add or update.</param>
    public async Task UpdatePackagesForJobAsync(int jobId,
        List<ParcelDimensions> parcels)
    {
        if (parcels == null || parcels.Count == 0) return;

        try
        {
            var effectiveJobId = await Context.GetEffectiveJobIdAsync(jobId);
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
                ArgumentNullException.ThrowIfNull(parcel.ItemId);
                await Context.TucJobItems
                    .Where(i => i.ItemId == parcel.ItemId.Value && i.JobId == effectiveJobId)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(i => i.Height, parcel.Height ?? 0)
                        .SetProperty(i => i.Length, parcel.Length ?? 0)
                        .SetProperty(i => i.Depth, parcel.Depth ?? 0)
                        .SetProperty(i => i.Barcode, parcel.Barcode)
                        .SetProperty(i => i.Notes, parcel.ItemName));
            }

            // Update UcjbQty with total parcel count so it syncs to device
            var totalItemCount = await Context.TucJobItems
                .Where(i => i.JobId == effectiveJobId)
                .CountAsync();

            await Context.TucJobs
                .Where(j => j.UcjbId == jobId)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(j => j.UcjbQty, (short)totalItemCount));
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(BaseJobRepository),
                    nameof(UpdatePackagesForJobAsync)));
            throw;
        }
    }

    /// <summary>
    /// Updates or creates package/parcel items for a bulk job.
    /// </summary>
    /// <param name="bulkJobId">The bulk job ID to update packages for.</param>
    /// <param name="parcels">List of parcel dimensions to add or update.</param>
    public async Task UpdatePackagesForBulkJobAsync(int bulkJobId,
        List<ParcelDimensions> parcels)
    {
        if (parcels == null || parcels.Count == 0) return;

        try
        {
            var effectiveJobId = await Context.GetEffectiveBulkJobIdAsync(bulkJobId);

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
                ArgumentNullException.ThrowIfNull(parcel.ItemId);
                await Context.TblBulkJobItems
                    .Where(i => i.ItemId == parcel.ItemId.Value && i.JobId == effectiveJobId)
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


    /// <summary>
    /// Adds new package items to a job with sequential item IDs.
    /// </summary>
    public async Task AddPackagesToJobAsync(int effectiveJobId,
        List<TucJobItem> items)
    {
        var existingCount = await GetJobItemCount(effectiveJobId);

        for (var i = 0; i < items.Count; i++) items[i].ItemId = existingCount + i + 1;

        await Context.TucJobItems.AddRangeAsync(items);
        await Context.SaveChangesAsync();
    }

    /// <summary>
    /// Retrieves all active jobs with location data for the mega map display.
    /// </summary>
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

    /// <summary>
    /// Updates the notes field for a job.
    /// </summary>
    /// <param name="jobId">The job ID to update.</param>
    /// <param name="note">The new notes content.</param>
    public async Task UpdateJobNoteAsync(int jobId,
        string note)
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

    /// <summary>
    /// Retrieves a job by ID including its related family jobs, marking it as read.
    /// </summary>
    /// <param name="jobId">The job ID to retrieve.</param>
    /// <returns>Job group containing the job and related jobs.</returns>
    public async Task<JobGroupViewModel> GetJobByIdAsync(int jobId)
    {
        try
        {
            await MarkJobAsReadAsync(jobId);

            var isLiveJob = await Context.IsLiveJobAsync(jobId);

            if (isLiveJob)
                return await GetLiveJobByIdAsync(jobId);

            return await GetArchivedJobByIdAsync(jobId);
        }
        catch (Exception e)
        {
            Log.Error(e, "Error occurred getting job {JobId}. Please see exception.", jobId);
            throw;
        }
    }

    /// <summary>
    /// Retrieves a single job by ID without related jobs.
    /// </summary>
    /// <param name="jobId">The job ID to retrieve.</param>
    /// <returns>The job view model.</returns>
    public async Task<JobViewModel> GetSingleJobById(int jobId)
    {
        try
        {
            var jobGroup = await GetJobByIdAsync(jobId);
            return jobGroup.Job;
        }
        catch (Exception e)
        {
            Log.Error(e, "Error occurred getting job {JobId}. Please see exception.", jobId);
            throw;
        }
    }

    /// <summary>
    /// Finds the 3 closest airports to a given coordinate using Haversine distance approximation.
    /// </summary>
    /// <param name="latitude">Reference latitude.</param>
    /// <param name="longitude">Reference longitude.</param>
    /// <returns>List of closest airports with distance and agent info.</returns>
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

    /// <summary>
    /// Retrieves a job type/speed by ID including its grouping information.
    /// </summary>
    /// <param name="speedId">The job type ID.</param>
    /// <returns>The job type entity with grouping.</returns>
    public async Task<TucJobType> GetJobTypeByIdAsync(int speedId)
    {
        var jobType = await Context.TucJobTypes
            .AsNoTracking()
            .Include(s => s.Grouping)
            .FirstOrDefaultAsync(x => x.UcjtId == speedId);

        return jobType ?? throw new KeyNotFoundException($"Job type with ID {speedId} not found");
    }

    /// <summary>
    /// Retrieves aggregate statistics for the overview page (active, completed, inactive counts).
    /// </summary>
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

    /// <summary>
    /// Updates the read status for a single job using MERGE for race condition safety.
    /// </summary>
    /// <param name="jobId">The job ID.</param>
    /// <param name="hasBeenRead">Whether to mark as read or unread.</param>
    public async Task UpdateJobReadStatusAsync(int jobId,
        bool hasBeenRead)
    {
        try
        {
            var staffId = _infoService.GetStaffId();
            var currentTenantTime = _infoService.GetCurrentTenantTime();

            // Use MERGE to handle concurrent inserts safely (prevents PK violation race condition)
            await Context.Database.ExecuteSqlInterpolatedAsync($@"
                MERGE INTO tucJobReadTracker WITH (HOLDLOCK) AS target
                USING (SELECT {jobId} AS JobId) AS source
                ON target.JobId = source.JobId
                WHEN MATCHED THEN
                    UPDATE SET HasBeenRead = {hasBeenRead},
                               ReadByStaffId = {staffId},
                               ReadTimestamp = {currentTenantTime}
                WHEN NOT MATCHED THEN
                    INSERT (JobId, HasBeenRead, ReadByStaffId, ReadTimestamp)
                    VALUES ({jobId}, {hasBeenRead}, {staffId}, {currentTenantTime});");
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository),
                    nameof(UpdateJobReadStatusAsync)));
            throw;
        }
    }

    /// <summary>
    /// Retrieves scan history for a barcode/scan within the last 3 days.
    /// </summary>
    /// <param name="runDate">Reference date for the search window.</param>
    /// <param name="scan">The barcode/scan value to search for.</param>
    /// <returns>List of scan events with courier and timestamp details.</returns>
    public async Task<List<ScanDetailResult>> ScanList(DateTimeOffset? runDate,
        string scan)
    {
        runDate ??= _infoService.GetCurrentTenantTime();
        var cutoffDate = runDate.Value.AddDays(-3);

        // Use proper joins instead of subqueries to avoid N+1 queries
        var query = from bs in Context.TblBulkScans
            join courier in Context.TucCouriers on bs.CourierId equals courier.UccrId into courierJoin
            from courier in courierJoin.DefaultIfEmpty()
            join runViewerTransferTo in Context.TucCouriers on bs.ToCourierId equals runViewerTransferTo.UccrId into
                rvtJoin
            from runViewerTransferTo in rvtJoin.DefaultIfEmpty()
            where bs.ScanDateTime > cutoffDate && bs.Scan == scan
            orderby bs.ScanDateTime
            select new
            {
                bs.BulkScanId,
                Courier = courier,
                bs.ScanDateTime,
                bs.ScanType,
                bs.CourierId,
                bs.ToCourierId,
                bs.RunName,
                TransferTo = bs.ToCourier,
                // Only include RunViewerTransferTo when CourierId is 999 and the courier is active
                RunViewerTransferTo = bs.CourierId == 999 && runViewerTransferTo != null && runViewerTransferTo.Active
                    ? runViewerTransferTo
                    : null
            };

        var results = await query
            .AsNoTracking()
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

    /// <summary>
    /// Validates that a job exists and was booked today for POD swap operation.
    /// </summary>
    /// <param name="jobNumber">The job number to validate.</param>
    /// <returns>True if the job is valid for POD swap.</returns>
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

    /// <summary>
    /// Manually reprices a job with a new total price.
    /// </summary>
    /// <param name="data">Repricing data including job ID and new price.</param>
    public async Task SimpleRepriceJobManualAsync(SimpleRepriceJobModel data)
    {
        try
        {
            var rowsChanged = data switch
            {
                { IsBulk: true } => await Context.TblBulkJobs
                    .Where(j => j.BulkJobId == data.JobId)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.Amount, data.NewPrice)),

                { IsPrebook: true } => await Context.TucJobBookings
                    .Where(j => j.UcbkId == data.JobId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(j => j.RatedManually, true)
                        .SetProperty(j => j.UcbkAmount, data.NewPrice)),

                _ => await RepriceRegularOrArchivedJobAsync(data)
            };

            if (rowsChanged == 0)
                throw new InvalidOperationException($"Job {data.JobId} not found");
        }
        catch (InvalidOperationException)
        {
            throw;
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository),
                    nameof(SimpleRepriceJobManualAsync)));
            throw;
        }
    }

    /// <summary>
    /// Calculates the total job price from a base amount by adding fuel surcharge (preview only, no save).
    /// </summary>
    /// <param name="data">Repricing data including job ID and base amount.</param>
    /// <returns>The calculated total including fuel surcharge.</returns>
    public async Task<decimal> CalculateJobPriceWithBaseAmountAsync(RepriceJobWithBaseAmountModel data)
    {
        try
        {
            // Get fuel percentage using compiled query
            var fuelPercentage = data.IsPrebook
                ? await Context.GetJobBookingFuelPercentageAsync(data.JobId)
                : await Context.GetJobFuelPercentageAsync(data.JobId);

            return CalculateTotalWithFuelSurcharge(data.BaseAmount, fuelPercentage);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository),
                    nameof(CalculateJobPriceWithBaseAmountAsync)));
            throw;
        }
    }

    /// <summary>
    /// Reprices a job using a base amount and calculates the fuel surcharge.
    /// </summary>
    /// <param name="data">Repricing data including job ID and base amount.</param>
    /// <returns>The calculated total including fuel surcharge.</returns>
    public async Task<decimal> RepriceJobWithBaseAmountAsync(RepriceJobWithBaseAmountModel data)
    {
        try
        {
            // Get fuel percentage using compiled query
            var fuelPercentage = data.IsPrebook
                ? await Context.GetJobBookingFuelPercentageAsync(data.JobId)
                : await Context.GetJobFuelPercentageAsync(data.JobId);

            var (totalAmount, fuelSurcharge) = CalculatePriceComponents(data.BaseAmount, fuelPercentage);

            if (data.IsPrebook)
            {
                var rowsChanged = await Context.TucJobBookings
                    .Where(j => j.UcbkId == data.JobId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(j => j.RatedManually, true)
                        .SetProperty(j => j.UcbkAmount, totalAmount));

                if (rowsChanged == 0)
                    throw new InvalidOperationException($"Job booking {data.JobId} not found");
            }
            else
            {
                // Try regular jobs first
                var rowsChanged = await Context.TucJobs
                    .Where(j => j.UcjbId == data.JobId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(j => j.RatedManually, true)
                        .SetProperty(j => j.UcjbAmount, totalAmount)
                        .SetProperty(j => j.FuelSurchargeAmount, fuelSurcharge)
                        .SetProperty(j => j.RawBaseAmount, data.BaseAmount));

                // Fall back to archived jobs if not found
                if (rowsChanged == 0)
                {
                    rowsChanged = await Context.TucJobArchives
                        .Where(j => j.UcjbId == data.JobId)
                        .ExecuteUpdateAsync(s => s
                            .SetProperty(j => j.RatedManually, true)
                            .SetProperty(j => j.UcjbAmount, totalAmount)
                            .SetProperty(j => j.FuelSurchargeAmount, fuelSurcharge)
                            .SetProperty(j => j.RawBaseAmount, data.BaseAmount));
                }

                if (rowsChanged == 0)
                    throw new InvalidOperationException($"Job {data.JobId} not found");
            }

            return totalAmount;
        }
        catch (InvalidOperationException)
        {
            throw;
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository),
                    nameof(RepriceJobWithBaseAmountAsync)));
            throw;
        }
    }

    private static decimal CalculateTotalWithFuelSurcharge(decimal baseAmount, decimal? fuelPercentage)
    {
        var fuelSurcharge = baseAmount * (fuelPercentage ?? 0);
        var totalAmount = baseAmount + fuelSurcharge;
        return Math.Round(totalAmount, 2, MidpointRounding.AwayFromZero);
    }

    private static (decimal TotalAmount, decimal FuelSurcharge) CalculatePriceComponents(decimal baseAmount, decimal? fuelPercentage)
    {
        var fuelSurcharge = Math.Round(baseAmount * (fuelPercentage ?? 0), 2, MidpointRounding.AwayFromZero);
        var totalAmount = Math.Round(baseAmount + fuelSurcharge, 2, MidpointRounding.AwayFromZero);
        return (totalAmount, fuelSurcharge);
    }

    /// <summary>
    /// Combines all non-empty address lines into a single comma-separated string for device sync.
    /// </summary>
    private static string CombineAddressLines(AddressViewModel address)
    {
        var lines = new[]
        {
            address.AddressLine1,
            address.AddressLine2,
            address.AddressLine3,
            address.AddressLine4,
            address.AddressLine5,
            address.AddressLine6,
            address.AddressLine7,
            address.AddressLine8
        };

        return string.Join(", ", lines.Where(line => !string.IsNullOrWhiteSpace(line)));
    }

    /// <summary>
    /// Assigns a courier to one or more jobs.
    /// </summary>
    /// <param name="jobIds">List of job IDs to assign.</param>
    /// <param name="courierId">The courier ID to assign.</param>
    public async Task AssignCourierToJobAsync(List<int> jobIds, int courierId)
    {
        var rowsChanged = await AssignCourierToJobsAsync(jobIds, courierId);
        if (rowsChanged == 0)
            throw new InvalidOperationException($"No records found for jobs: {string.Join(", ", jobIds)}");
    }

    /// <summary>
    /// Auto-dispatches courier assignment to related child jobs based on parent job assignments.
    /// Only updates child jobs that have auto-dispatch enabled and no courier assigned.
    /// </summary>
    /// <param name="jobIds">List of parent job IDs whose courier assignments should cascade to children.</param>
    /// <param name="internalStatus">The internal status to set on child jobs.</param>
    public async Task AssignCourierToChildJobsAsync(List<int> jobIds, InternalJobStatus internalStatus)
    {
        if (jobIds == null || jobIds.Count == 0) return;

        await using var transaction = await Context.Database.BeginTransactionAsync();

        try
        {
            var parentJobValues = await Context.TucJobs
                .AsNoTracking()
                .Where(parent => jobIds.Contains(parent.UcjbId) && parent.ParentId.HasValue)
                .Select(parent => new
                {
                    parent.ParentId,
                    parent.UcjbCourierId,
                    parent.UcjbDispId,
                    parent.UcjbDispTime,
                    parent.UcjbDispDate,
                    parent.UcjbStatus,
                    parent.UcjbDate
                })
                .ToListAsync();

            if (parentJobValues.Count == 0) return;

            var parentIds = parentJobValues
                .Where(p => p.ParentId.HasValue)
                .Select(p => p.ParentId.Value)
                .Distinct()
                .ToList();

            var parentValuesByParentId = parentJobValues
                .GroupBy(p => p.ParentId!.Value)
                .ToDictionary(g => g.Key, g => g.OrderBy(p => p.UcjbDate).First());

            var childJobsToUpdate = await Context.TucJobs
                .AsNoTracking()
                .Where(child => parentIds.Contains(child.ParentId.Value)
                                && child.UcjbCourierId == null
                                && child.JobRelationshipType.AutoDespatchToOtherChildJobs == true
                                && !jobIds.Contains(child.UcjbId))
                .Select(child => new
                {
                    child.UcjbId,
                    child.ParentId,
                    child.UcjbDate
                })
                .ToListAsync();

            var allChildIdsToUpdate = new List<(int childId, int parentId)>();

            foreach (var (parentId, parentValues) in parentValuesByParentId)
            {
                var childIds = childJobsToUpdate
                    .Where(c => c.ParentId == parentId && c.UcjbDate.Date <= parentValues.UcjbDate.Date)
                    .Select(c => (c.UcjbId, parentId))
                    .ToList();

                allChildIdsToUpdate.AddRange(childIds);
            }

            if (allChildIdsToUpdate.Count == 0)
            {
                await transaction.CommitAsync();
                return;
            }

            foreach (var (parentId, parentValues) in parentValuesByParentId)
            {
                var childIdsForThisParent = allChildIdsToUpdate
                    .Where(x => x.parentId == parentId)
                    .Select(x => x.childId)
                    .ToList();

                if (childIdsForThisParent.Count == 0) continue;

                await Context.TucJobs
                    .Where(j => childIdsForThisParent.Contains(j.UcjbId))
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(j => j.UcjbCourierId, parentValues.UcjbCourierId)
                        .SetProperty(j => j.UcjbDispId, parentValues.UcjbDispId)
                        .SetProperty(j => j.UcjbDispTime, parentValues.UcjbDispTime)
                        .SetProperty(j => j.UcjbDispDate, parentValues.UcjbDispDate)
                        .SetProperty(j => j.UcjbStatus, parentValues.UcjbStatus)
                        .SetProperty(j => j.InternalStatus, (int)internalStatus));
            }

            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    private static IOrderedQueryable<TucJob> ApplyLiveJobSorting(
        IQueryable<TucJob> query,
        string sortColumn,
        bool descending)
    {
        return sortColumn switch
        {
            "date" => descending
                ? query.OrderByDescending(j => j.UcjbDate).ThenByDescending(j => j.UcjbTime)
                    .ThenByDescending(j => j.UcjbId)
                : query.OrderBy(j => j.UcjbDate).ThenBy(j => j.UcjbTime).ThenBy(j => j.UcjbId),
            "time" => descending
                ? query.OrderByDescending(j => j.UcjbTime).ThenByDescending(j => j.UcjbDate)
                    .ThenByDescending(j => j.UcjbId)
                : query.OrderBy(j => j.UcjbTime).ThenBy(j => j.UcjbDate).ThenBy(j => j.UcjbId),
            "jobno" => descending
                ? query.OrderByDescending(j => j.UcjbNumber).ThenByDescending(j => j.UcjbId)
                : query.OrderBy(j => j.UcjbNumber).ThenBy(j => j.UcjbId),
            "client" => descending
                ? query.OrderByDescending(j => j.UcjbClientCode).ThenByDescending(j => j.UcjbId)
                : query.OrderBy(j => j.UcjbClientCode).ThenBy(j => j.UcjbId),
            "status" => descending
                ? query.OrderByDescending(j => j.UcjbStatus).ThenByDescending(j => j.UcjbId)
                : query.OrderBy(j => j.UcjbStatus).ThenBy(j => j.UcjbId),
            "speed" => descending
                ? query.OrderByDescending(j => j.UcjbSpeedNavigation!.ShortName).ThenByDescending(j => j.UcjbId)
                : query.OrderBy(j => j.UcjbSpeedNavigation!.ShortName).ThenBy(j => j.UcjbId),
            "courier" => descending
                ? query.OrderByDescending(j => j.UcjbCourier!.Code).ThenByDescending(j => j.UcjbId)
                : query.OrderBy(j => j.UcjbCourier!.Code).ThenBy(j => j.UcjbId),
            _ => query.OrderBy(j => j.UcjbDate).ThenBy(j => j.UcjbTime).ThenBy(j => j.UcjbId)
        };
    }

    private static IOrderedQueryable<TucJobArchive> ApplyArchivedJobSorting(
        IQueryable<TucJobArchive> query,
        string sortColumn,
        bool descending)
    {
        return sortColumn switch
        {
            "date" => descending
                ? query.OrderByDescending(j => j.UcjbDate).ThenByDescending(j => j.UcjbTime)
                    .ThenByDescending(j => j.UcjbId)
                : query.OrderBy(j => j.UcjbDate).ThenBy(j => j.UcjbTime).ThenBy(j => j.UcjbId),
            "time" => descending
                ? query.OrderByDescending(j => j.UcjbTime).ThenByDescending(j => j.UcjbDate)
                    .ThenByDescending(j => j.UcjbId)
                : query.OrderBy(j => j.UcjbTime).ThenBy(j => j.UcjbDate).ThenBy(j => j.UcjbId),
            "jobno" => descending
                ? query.OrderByDescending(j => j.UcjbNumber).ThenByDescending(j => j.UcjbId)
                : query.OrderBy(j => j.UcjbNumber).ThenBy(j => j.UcjbId),
            "client" => descending
                ? query.OrderByDescending(j => j.UcjbClientCode).ThenByDescending(j => j.UcjbId)
                : query.OrderBy(j => j.UcjbClientCode).ThenBy(j => j.UcjbId),
            "status" => descending
                ? query.OrderByDescending(j => j.UcjbStatus).ThenByDescending(j => j.UcjbId)
                : query.OrderBy(j => j.UcjbStatus).ThenBy(j => j.UcjbId),
            "speed" => descending
                ? query.OrderByDescending(j => j.SpeedNavigation!.ShortName).ThenByDescending(j => j.UcjbId)
                : query.OrderBy(j => j.SpeedNavigation!.ShortName).ThenBy(j => j.UcjbId),
            "courier" => descending
                ? query.OrderByDescending(j => j.UcjbCourier!.Code).ThenByDescending(j => j.UcjbId)
                : query.OrderBy(j => j.UcjbCourier!.Code).ThenBy(j => j.UcjbId),
            _ => query.OrderBy(j => j.UcjbDate).ThenBy(j => j.UcjbTime).ThenBy(j => j.UcjbId)
        };
    }

    private static IEnumerable<DispatchJobViewModel> ApplyDispatchJobSorting(
        IEnumerable<DispatchJobViewModel> jobs,
        string sortColumn,
        bool descending)
    {
        var orderedJobs = sortColumn switch
        {
            "date" => descending
                ? jobs.OrderByDescending(j => j.Booked).ThenByDescending(j => j.Time).ThenByDescending(j => j.Id)
                : jobs.OrderBy(j => j.Booked).ThenBy(j => j.Time).ThenBy(j => j.Id),
            "time" => descending
                ? jobs.OrderByDescending(j => j.Time).ThenByDescending(j => j.Booked).ThenByDescending(j => j.Id)
                : jobs.OrderBy(j => j.Time).ThenBy(j => j.Booked).ThenBy(j => j.Id),
            "jobno" => descending
                ? jobs.OrderByDescending(j => j.JobNo).ThenByDescending(j => j.Id)
                : jobs.OrderBy(j => j.JobNo).ThenBy(j => j.Id),
            "client" => descending
                ? jobs.OrderByDescending(j => j.Client).ThenByDescending(j => j.Id)
                : jobs.OrderBy(j => j.Client).ThenBy(j => j.Id),
            "status" => descending
                ? jobs.OrderByDescending(j => j.Status).ThenByDescending(j => j.Id)
                : jobs.OrderBy(j => j.Status).ThenBy(j => j.Id),
            "speed" => descending
                ? jobs.OrderByDescending(j => j.Speed).ThenByDescending(j => j.Id)
                : jobs.OrderBy(j => j.Speed).ThenBy(j => j.Id),
            "courier" => descending
                ? jobs.OrderByDescending(j => j.Courier).ThenByDescending(j => j.Id)
                : jobs.OrderBy(j => j.Courier).ThenBy(j => j.Id),
            "pickup" => descending
                ? jobs.OrderByDescending(j => j.From).ThenByDescending(j => j.Id)
                : jobs.OrderBy(j => j.From).ThenBy(j => j.Id),
            "delivery" => descending
                ? jobs.OrderByDescending(j => j.ToAddress).ThenByDescending(j => j.Id)
                : jobs.OrderBy(j => j.ToAddress).ThenBy(j => j.Id),
            "vehicle" => descending
                ? jobs.OrderByDescending(j => j.Vehicle?.Text).ThenByDescending(j => j.Id)
                : jobs.OrderBy(j => j.Vehicle?.Text).ThenBy(j => j.Id),
            _ => jobs.OrderBy(j => j.Booked).ThenBy(j => j.Time).ThenBy(j => j.Id)
        };

        return orderedJobs;
    }

    private async Task<int> RepriceRegularOrArchivedJobAsync(SimpleRepriceJobModel data)
    {
        // Try regular jobs first, fall back to the archive if not found
        var rowsChanged = await Context.TucJobs
            .Where(j => j.UcjbId == data.JobId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(j => j.RatedManually, true)
                .SetProperty(j => j.UcjbAmount, data.NewPrice));

        if (rowsChanged > 0) return rowsChanged;

        return await Context.TucJobArchives
            .Where(j => j.UcjbId == data.JobId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(j => j.RatedManually, true)
                .SetProperty(j => j.UcjbAmount, data.NewPrice));
    }

    private async Task UpdateJobCouriersAsync(List<JobManualPriceModel> data,
        List<TucJob> dbData,
        List<TucJobArchive> dbDataArchive)
    {
        var courierCodes = data.Where(d => !string.IsNullOrWhiteSpace(d.CourierCode))
            .Select(d => d.CourierCode.Trim())
            .Distinct()
            .ToList();

        if (courierCodes.Count == 0)
        {
            Log.Information("No courier updates requested");
            return;
        }

        var courierLookup = await Context.TucCouriers
            .AsNoTracking()
            .Where(c => courierCodes.Contains(c.Code) && c.Active)
            .ToDictionaryAsync(c => c.Code, c => c.UccrId);

        // Update couriers for each job
        foreach (var d in data.Where(d => !string.IsNullOrWhiteSpace(d.CourierCode)))
        {
            var match = (dynamic)dbData.FirstOrDefault(j => j.UcjbId == d.Id)
                        ?? dbDataArchive.FirstOrDefault(j => j.UcjbId == d.Id);

            if (match == null)
            {
                Log.Warning("Job with ID {DId} not found for courier update", d.Id);
                continue;
            }

            var trimmedCode = d.CourierCode.Trim();
            if (courierLookup.TryGetValue(trimmedCode, out var courierId))
            {
                match.UcjbCourierId = courierId;
                Log.Information("Job {DId} courier updated to {CourierCode} (ID: {CourierId})",
                    d.Id, trimmedCode, courierId);
            }
            else
            {
                Log.Warning("Courier code '{CourierCode}' not found in database for job {DId}",
                    trimmedCode, d.Id);
            }
        }
    }

    private async Task UpdateJobStatusesAsync(List<JobManualPriceModel> data,
        List<TucJob> dbData,
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

    private async Task<List<int>> GetAllRelatedJobIdsIncludingParentAsync(int jobId)
    {
        // Single query to get both parent ID and all related job IDs
        var jobWithRelations = await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => new
            {
                j.ParentId,
                // If it has parent, get siblings; otherwise get children
                RelatedJobIds = j.ParentId.HasValue
                    ? j.Parent.InverseParent.Select(child => child.UcjbId).ToList()
                    : j.InverseParent.Select(child => child.UcjbId).ToList()
            })
            .FirstOrDefaultAsync();

        if (jobWithRelations == null)
            return [];

        var relatedJobIds = jobWithRelations.RelatedJobIds;

        // Add the appropriate ID (parent or self)
        relatedJobIds.Add(jobWithRelations.ParentId ?? jobId);

        return relatedJobIds;
    }

    private async Task<List<int>> GetAllRelatedBulkJobIdsIncludingParentAsync(int bulkJobId)
    {
        // Single query to get both parent ID and all related job IDs
        var jobWithRelations = await Context.TblBulkJobs
            .Where(j => j.BulkJobId == bulkJobId)
            .Select(j => new
            {
                ParentId = j.BulkParentId,
                // If it has parent, get siblings; otherwise get children
                RelatedJobIds = j.BulkParentId.HasValue
                    ? j.Parent.InverseParent.Select(child => child.BulkJobId).ToList()
                    : j.InverseParent.Select(child => child.BulkJobId).ToList()
            })
            .FirstOrDefaultAsync();

        if (jobWithRelations == null) return [];

        var relatedBulkJobIds = jobWithRelations.RelatedJobIds;

        // Add the appropriate ID (parent or self)
        relatedBulkJobIds.Add(jobWithRelations.ParentId ?? bulkJobId);

        return relatedBulkJobIds;
    }

    private async Task UpdateJobDisplayInDespatchAsync(int jobId)
    {
        await Context.TucJobs
            .Where(j => j.RootParentId == jobId)
            .ExecuteUpdateAsync(j => j.SetProperty(x => x.DisplayInDespatch, true));
    }

    private async Task SetJobAsManuallyPriceAsync(int jobId,
        string note)
    {
        await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(j => j.RatedManually, true));

        await SaveNoteAsync(jobId, note);
    }

    private async Task SetPrebookJobAsManuallyPriceAsync(int prebookJobId,
        string note)
    {
        await Context.TucJobBookings
            .Where(j => j.UcbkId == prebookJobId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(j => j.RatedManually, true));

        await CreateNewRecurringJobNote(prebookJobId, note, false);
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
                if (string.IsNullOrWhiteSpace(zipCode) || !int.TryParse(zipCode, out var result))
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

    private async Task<decimal> CalculateAmountAsync(int clientId,
        decimal amount)
    {
        var outputParam = new OutputParameter<decimal?>();
        await Context.Procedures.UTL_stpPPD_ExclusiveAmountAsync(clientId, amount, outputParam);

        return outputParam.Value ?? 0m;
    }

    private async Task<string> GenerateJobNumberAsync(
        int staffId,
        int jobTypeId,
        DespatchContext customContext = null,
        CancellationToken cancellationToken = default
    )
    {
        var context = customContext ?? Context;
        var jobNumberOutput = new OutputParameter<string>();
        var returnValue = new OutputParameter<int>();

        await context.Procedures.NET_stpJob_Insert_JobNumberAsync(
            staffId,
            jobTypeId,
            jobNumberOutput,
            returnValue,
            cancellationToken
        );

        return jobNumberOutput.Value;
    }

    private async Task CloseTasksByJobIdsAsync(List<int> jobIds)
    {
        await Context.TucEvents
            .Where(t => jobIds.Contains(t.UcevJobId.Value) && !t.UcevClosed)
            .ExecuteUpdateAsync(setters => setters.SetProperty(e => e.UcevClosed, true));
    }

    private async Task CloseAllBulkJobTasksAsync(List<int> bulkJobIds)
    {
        var now = _infoService.GetCurrentTenantTime();
        var staffId = _infoService.GetStaffId();

        await Context.TblBulkEvents
            .Where(t => bulkJobIds.Contains(t.BulkJobId.Value) && !t.ClosedDate.HasValue)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(e => e.ClosedDate, now)
                .SetProperty(e => e.ClosedByName,
                    Context.TucStaffs
                        .Where(s => s.UcstId == staffId)
                        .Select(s => s.UcstFirstName + " " + s.UcstLastName)
                        .FirstOrDefault()));
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

    private async Task<int> GetJobItemCount(int effectiveJobId) =>
        await Context.TucJobItems.Where(i => i.JobId == effectiveJobId).CountAsync();

    private async Task MarkJobAsReadAsync(int jobId)
    {
        var staffId = _infoService.GetStaffId();
        var currentTenantTime = _infoService.GetCurrentTenantTime();

        // Single query: insert only if a job exists in TucJobs and no tracker exists yet
        await Context.Database.ExecuteSqlInterpolatedAsync($@"
            INSERT INTO tucJobReadTracker (JobId, HasBeenRead, ReadByStaffId, ReadTimestamp)
            SELECT {jobId}, 1, {staffId}, {currentTenantTime}
            WHERE EXISTS (SELECT 1 FROM tucJob WHERE ucjbId = {jobId})
              AND NOT EXISTS (SELECT 1 FROM tucJobReadTracker WHERE JobId = {jobId})");
    }

    private async Task<JobGroupViewModel> GetLiveJobByIdAsync(int jobId)
    {
        var mainJobInfo = await Context.TucJobs
            .AsNoTracking()
            .Where(j => j.UcjbId == jobId)
            .Select(j => new { j.UcjbId, FamilyRootId = j.ParentId ?? j.UcjbId })
            .TagWith("GetLiveJob - Family Root Lookup")
            .FirstOrDefaultAsync();

        ArgumentNullException.ThrowIfNull(mainJobInfo);

        var familyRootId = mainJobInfo.FamilyRootId;

        var allJobsInFamily = await Context.TucJobs
            .AsNoTracking()
            .AsSplitQuery()
            .Where(j => j.UcjbId == familyRootId || j.ParentId == familyRootId)
            .Select(JobMappings.JobMappingCore)
            .TagWith($"GetLiveJob - Complete Family {familyRootId}")
            .ToListAsync();

        var mainJob = allJobsInFamily.FirstOrDefault(j => j.Id == jobId);
        ArgumentNullException.ThrowIfNull(mainJob);

        var relatedJobs = allJobsInFamily.Where(j => j.Id != jobId).ToList();

        var allJobs = new List<JobViewModel> { mainJob };
        allJobs.AddRange(relatedJobs);

        await EnrichJobsWithCollectionsAsync(allJobs);

        return new JobGroupViewModel
        {
            Job = mainJob,
            RelatedJobs = relatedJobs
        };
    }

    private async Task EnrichJobsWithCollectionsAsync(List<JobViewModel> jobs)
    {
        if (jobs.Count == 0) return;

        var jobIds = jobs.Select(j => j.Id).ToList();
        var effectiveJobIds = jobs.Select(j => j.ParentId ?? j.Id).Distinct().ToList();

        await using var flightContext = await _contextFactory.CreateDbContextAsync();
        await using var pricingContext = await _contextFactory.CreateDbContextAsync();
        await using var parcelContext = await _contextFactory.CreateDbContextAsync();
        await using var flagsContext = await _contextFactory.CreateDbContextAsync();

        var flightInfoTask = BatchLoadFlightInfoAsync(flightContext, _infoService, jobs);
        var pricingTask = BatchLoadPricingBreakdownAsync(pricingContext, effectiveJobIds, jobs);
        var parcelDimensionsTask = BatchLoadParcelDimensionsAsync(parcelContext, jobIds, effectiveJobIds, jobs);
        var jobItemFlagsTask = BatchLoadJobItemFlagsAsync(flagsContext, jobIds, jobs);

        await Task.WhenAll(flightInfoTask, pricingTask, parcelDimensionsTask, jobItemFlagsTask);
    }

    private static async Task BatchLoadFlightInfoAsync(
        DespatchContext context,
        ITenantInfoService infoService,
        List<JobViewModel> jobs)
    {
        var jobSpeedGroupings = await context.TucJobTypes
            .AsNoTracking()
            .Where(s => jobs.Select(j => j.SpeedId).Contains(s.UcjtId))
            .Select(s => new { s.UcjtId, s.GroupingId })
            .TagWith("BatchLoadFlightInfo - Speed Groupings")
            .ToListAsync();

        var isUsTenant = infoService.IsUsTenant();
        var flightSpeedIds = jobSpeedGroupings
            .Where(s => s.GroupingId == (isUsTenant
                ? (int)SpeedGrouping.Flight
                : (int)UrgentSpeedGrouping.Flight))
            .Select(s => s.UcjtId)
            .ToHashSet();

        var flightJobs = jobs.Where(j => j.SpeedId.HasValue && flightSpeedIds.Contains(j.SpeedId.Value)).ToList();
        if (flightJobs.Count == 0) return;

        var flightJobEffectiveIds = flightJobs.Select(j => j.ParentId ?? j.Id).Distinct().ToList();

        var allFlightSegments = await context.TucJobNationwides
            .AsNoTracking()
            .Where(n => n.UcnwJobId.HasValue && flightJobEffectiveIds.Contains(n.UcnwJobId.Value))
            .OrderBy(n => n.UcnwJobId)
            .ThenBy(n => n.UcnwLegNumber)
            .Select(segment => new
            {
                JobId = segment.UcnwJobId,
                Segment = new FlightSegmentViewModel
                {
                    SegmentOrder = segment.UcnwLegNumber - 1,
                    CarrierFsCode = !string.IsNullOrEmpty(segment.UcnwFlightNo) && segment.UcnwFlightNo.Length >= 2
                        ? segment.UcnwFlightNo.Substring(0, 2)
                        : "??",
                    FlightNumber = !string.IsNullOrEmpty(segment.UcnwFlightNo) && segment.UcnwFlightNo.Length > 2
                        ? segment.UcnwFlightNo.Substring(2)
                        : "????",
                    DepartureTime = segment.UcnwEtd ?? SqlMinDateTime,
                    ArrivalTime = segment.UcnwEta ?? SqlMinDateTime,
                    DepartureAirportFsCode = segment.DepartureAirportFsCode,
                    DepartureAirportName = segment.DepartureAirportName,
                    DepartureAirportCity = segment.DepartureAirportCity,
                    DepartureAirportCountry = segment.DepartureAirportCountry,
                    DepartureAirportTimeZone = segment.DepartureAirportTimeZoneNavigation.Name,
                    DepartureAirportTimeZoneId = segment.DepartureAirportTimeZoneId ?? 0,
                    DepartureTerminal = segment.DepartureTerminal,
                    ArrivalAirportFsCode = segment.ArrivalAirportFsCode,
                    ArrivalAirportName = segment.ArrivalAirportName,
                    ArrivalAirportCity = segment.ArrivalAirportCity,
                    ArrivalAirportCountry = segment.ArrivalAirportCountry,
                    ArrivalAirportTimeZone = segment.ArrivalAirportTimeZoneNavigation.Name,
                    ArrivalAirportTimeZoneId = segment.ArrivalAirportTimeZoneId ?? 0,
                    ArrivalTerminal = segment.ArrivalTerminal,
                    ElapsedTime = (int)(segment.UcnwEta.HasValue && segment.UcnwEtd.HasValue
                        ? (segment.UcnwEta.Value - segment.UcnwEtd.Value).TotalMinutes
                        : 0),
                    AircraftName = segment.AircraftName,
                    AirlineName = segment.UcnwAirlineName
                },
                Notes = segment.UcnwNotes
            })
            .TagWith("BatchLoadFlightInfo - All Segments")
            .ToListAsync();

        var segmentsByJob = allFlightSegments
            .GroupBy(s => s.JobId)
            .ToDictionary(g => g.Key, g => g.ToList());

        foreach (var job in flightJobs)
        {
            var effectiveJobId = job.ParentId ?? job.Id;
            if (!segmentsByJob.TryGetValue(effectiveJobId, out var segments) || segments.Count == 0)
                continue;

            var flightSegments = segments.Select(s => s.Segment).ToList();
            var firstSegment = flightSegments[0];
            var lastSegment = flightSegments[^1];
            var notes = segments[0].Notes;

            job.AssignedFlight = new AssignedFlight
            {
                ExpectedArrival = lastSegment.ArrivalTime,
                ArrivalTimeZone = lastSegment.ArrivalAirportTimeZone,
                ExpectedDeparture = firstSegment.DepartureTime,
                DepartureTimeZone = firstSegment.DepartureAirportTimeZone,
                FlightNumber = firstSegment.CarrierFsCode + firstSegment.FlightNumber,
                Notes = notes,
                FlightSegments = flightSegments
            };

            ApplyFlightTimezones(job);
        }
    }

    private static async Task BatchLoadPricingBreakdownAsync(
        DespatchContext context,
        List<int> effectiveJobIds,
        List<JobViewModel> jobs)
    {
        var pricingTotals = await context.PricingBreakdowns
            .AsNoTracking()
            .Where(p => p.JobId.HasValue && effectiveJobIds.Contains(p.JobId.Value))
            .GroupBy(p => p.JobId)
            .Select(g => new
            {
                JobId = g.Key,
                Total = g.Sum(p => p.ChargeAmount)
            })
            .TagWith("BatchLoadPricing - All Jobs")
            .ToDictionaryAsync(x => x.JobId, x => x.Total);

        foreach (var job in jobs)
        {
            var effectiveJobId = job.ParentId ?? job.Id;
            if (pricingTotals.TryGetValue(effectiveJobId, out var total) && total > 0)
            {
                job.Charge = total;
            }
        }
    }

    private static async Task BatchLoadParcelDimensionsAsync(
        DespatchContext context,
        List<int> jobIds,
        List<int> effectiveJobIds,
        List<JobViewModel> jobs)
    {
        var allChildItems = await context.TucJobItems
            .AsNoTracking()
            .Where(i => jobIds.Contains(i.ChildJobId.Value))
            .Select(i => new
            {
                ChildJobId = i.ChildJobId.Value,
                Parcel = new ParcelDimensions
                {
                    ItemId = i.ItemId,
                    ItemName = i.Notes,
                    Height = i.Height,
                    Depth = i.Depth,
                    Length = i.Length,
                    Barcode = i.Barcode
                }
            })
            .TagWith("BatchLoadParcels - Child Items")
            .ToListAsync();

        var childItemsByJob = allChildItems
            .GroupBy(x => x.ChildJobId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Parcel).ToList());

        var allParentItems = await context.TucJobItems
            .AsNoTracking()
            .Where(i => effectiveJobIds.Contains(i.JobId) && i.ChildJobId == null)
            .Select(i => new
            {
                i.JobId,
                Parcel = new ParcelDimensions
                {
                    ItemId = i.ItemId,
                    ItemName = i.Notes,
                    Height = i.Height,
                    Depth = i.Depth,
                    Length = i.Length,
                    Barcode = i.Barcode
                },
                Pallet = new PalletInfo
                {
                    Id = i.JobId,
                    Quantity = i.Items,
                    ItemId = i.ItemId,
                    Weight = i.Weight,
                    Length = i.Length ?? 0,
                    Depth = i.Depth ?? 0,
                    Height = i.Height ?? 0,
                    Pu = i.Pu,
                    Do = i.Do,
                    DgClass = i.Dgclass,
                    Notes = i.Notes
                }
            })
            .TagWith("BatchLoadParcels - Parent Items")
            .ToListAsync();

        var parentItemsByJob = allParentItems
            .GroupBy(x => x.JobId)
            .ToDictionary(g => g.Key, g => (
                Parcels: g.Select(x => x.Parcel).ToList(),
                Pallets: g.Select(x => x.Pallet).ToList()
            ));

        foreach (var job in jobs)
        {
            if (childItemsByJob.TryGetValue(job.Id, out var childItems))
            {
                job.ParcelDimensions = childItems;
                continue;
            }

            var effectiveJobId = job.ParentId ?? job.Id;
            if (!parentItemsByJob.TryGetValue(effectiveJobId, out var parentItems)) continue;
            job.ParcelDimensions = parentItems.Parcels;
            if (parentItems.Pallets.Count != 0)
                job.PalletInfo = parentItems.Pallets;
        }
    }

    private static async Task BatchLoadJobItemFlagsAsync(
        DespatchContext context,
        List<int> jobIds,
        List<JobViewModel> jobs)
    {
        var allFlags = await context.TucJobItems
            .AsNoTracking()
            .Where(i => jobIds.Contains(i.JobId))
            .Select(i => new { i.JobId, i.Pu, i.Do, i.PrivateRes })
            .TagWith("BatchLoadFlags - All Jobs")
            .ToListAsync();

        var flagsByJob = allFlags
            .GroupBy(f => f.JobId)
            .ToDictionary(g => g.Key, g => new
            {
                TailLiftPu = g.Any(f => f.Pu == true),
                TailLiftDo = g.Any(f => f.Do == true),
                DeliverToPrivateRes = g.Any(f => f.PrivateRes == true)
            });

        foreach (var job in jobs)
        {
            if (!flagsByJob.TryGetValue(job.Id, out var flags)) continue;
            job.TailLiftPu = flags.TailLiftPu;
            job.TailLiftDo = flags.TailLiftDo;
            job.DeliverToPrivateRes = flags.DeliverToPrivateRes;
        }
    }

    private static void ApplyFlightTimezones(JobViewModel job)
    {
        if (job.AssignedFlight == null || job.AssignedFlight.FlightSegments.Count == 0)
            return;

        job.AssignedFlight.ExpectedArrival = job.AssignedFlight.ExpectedArrival.HasValue
            ? TimeZoneHelper.SetDateTimeWithTimeZone(job.AssignedFlight.ExpectedArrival.Value,
                job.AssignedFlight.ArrivalTimeZone)
            : null;

        job.AssignedFlight.ExpectedDeparture = job.AssignedFlight.ExpectedDeparture.HasValue
            ? TimeZoneHelper.SetDateTimeWithTimeZone(job.AssignedFlight.ExpectedDeparture.Value,
                job.AssignedFlight.DepartureTimeZone)
            : null;

        foreach (var segment in job.AssignedFlight.FlightSegments)
        {
            segment.ArrivalTime =
                TimeZoneHelper.SetDateTimeWithTimeZone(segment.ArrivalTime, segment.ArrivalAirportTimeZone);
            segment.DepartureTime =
                TimeZoneHelper.SetDateTimeWithTimeZone(segment.DepartureTime, segment.DepartureAirportTimeZone);
        }
    }

    private async Task<JobGroupViewModel> GetArchivedJobByIdAsync(int jobId)
    {
        var familyRootId = await Context.TucJobArchives
            .AsNoTracking()
            .Where(j => j.UcjbId == jobId)
            .Select(j => j.ParentId ?? j.UcjbId)
            .TagWith("GetArchivedJob - Family Root")
            .FirstOrDefaultAsync();

        if (familyRootId == 0)
            throw new KeyNotFoundException($"Archived job {jobId} not found");

        var allJobsInFamily = await Context.TucJobArchives
            .AsNoTracking()
            .AsSplitQuery()
            .Where(j => j.UcjbId == familyRootId || j.ParentId == familyRootId)
            .Select(JobMappings.JobArchiveMapping)
            .TagWith($"GetArchivedJob - Family {familyRootId}")
            .ToListAsync();

        if (allJobsInFamily.Count == 0) throw new KeyNotFoundException($"Archived job {jobId} not found");

        var archivedJob = allJobsInFamily.FirstOrDefault(j => j.Id == jobId);
        ArgumentNullException.ThrowIfNull(archivedJob);
        var archivedJobRelatedJobs = allJobsInFamily.Where(j => j.Id != jobId).ToList();

        return new JobGroupViewModel
        {
            Job = archivedJob,
            RelatedJobs = archivedJobRelatedJobs
        };
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
        TucCourier courier,
        TucCourier transferTo,
        TucCourier runViewerTransferTo,
        string runName)
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

    public async Task UpdateClearListAreaOrderStatus(List<int> courierIds)
    {
        if (courierIds.Count == 0) return;

        var now = _infoService.GetCurrentTenantTime();
        try
        {
            // Batch query 1: Get job counts per courier (jobs not void and not done)
            var jobCountsByCourier = await Context.TucJobs
                .Where(j => j.UcjbDate.Date == now.Date
                            && !j.UcjbVoid
                            && !j.UcjbJobDone
                            && j.UcjbCourierId.HasValue
                            && courierIds.Contains(j.UcjbCourierId.Value))
                .GroupBy(j => j.UcjbCourierId!.Value)
                .Select(g => new { CourierId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.CourierId, x => x.Count);

            // Batch query 2: Get counts of jobs NOT picked up or late delivery per courier
            var nonPickedUpCountsByCourier = await Context.TucJobs
                .Where(j => j.UcjbDate.Date == now.Date
                            && !j.UcjbVoid
                            && !j.UcjbJobDone
                            && j.UcjbCourierId.HasValue
                            && courierIds.Contains(j.UcjbCourierId.Value)
                            && j.UcjbStatus != (int)JobStatus.PickedUp
                            && j.UcjbStatus != (int)JobStatus.LateDelivery)
                .GroupBy(j => j.UcjbCourierId!.Value)
                .Select(g => new { CourierId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.CourierId, x => x.Count);

            // Determine which couriers get which status
            var couriersToSetRejected = new List<int>(); // Status 3 - no jobs
            var couriersToSetPickedUp = new List<int>(); // Status 5 - all jobs picked up or late

            foreach (var courierId in courierIds)
            {
                var jobCount = jobCountsByCourier.GetValueOrDefault(courierId, 0);

                if (jobCount == 0)
                {
                    couriersToSetRejected.Add(courierId);
                }
                else
                {
                    var nonPickedUpCount = nonPickedUpCountsByCourier.GetValueOrDefault(courierId, 0);
                    if (nonPickedUpCount == 0)
                    {
                        couriersToSetPickedUp.Add(courierId);
                    }
                }
            }

            // Bulk update using ExecuteUpdateAsync - no entity loading needed
            if (couriersToSetRejected.Count > 0)
            {
                await Context.TblClearListAreaOrders
                    .Where(c => couriersToSetRejected.Contains(c.CourierId))
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(c => c.Status, (int)JobStatus.Rejected)
                        .SetProperty(c => c.OrderTime, now));
            }

            if (couriersToSetPickedUp.Count > 0)
            {
                await Context.TblClearListAreaOrders
                    .Where(c => couriersToSetPickedUp.Contains(c.CourierId))
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(c => c.Status, (int)JobStatus.PickedUp)
                        .SetProperty(c => c.OrderTime, now));
            }
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository),
                    nameof(UpdateClearListAreaOrderStatus)));
            throw;
        }
    }

    private async Task<int> AssignCourierToJobsAsync(IEnumerable<int> jobIds, int courierId)
    {
        var tenantTime = _infoService.GetCurrentTenantTime();

        return await Context.TucJobs
            .Where(j => jobIds.Contains(j.UcjbId))
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(j => j.UcjbCourierId, courierId)
                .SetProperty(j => j.DesCheck, false)
                .SetProperty(j => j.FdcourierId, (int?)null)
                .SetProperty(j => j.UcjbDispDate, tenantTime)
                .SetProperty(j => j.UcjbDispTime, tenantTime)
                .SetProperty(j => j.UcjbStatus, j => j.UcjbStatus < 1 ? (int)JobStatus.Dispatched : j.UcjbStatus)
                .SetProperty(j => j.InternalStatus, (int)InternalJobStatus.AwaitingPod)
            );
    }

    public async Task<CourierPaymentCalculationData> GetCourierPaymentCalculationDataAsync(int jobId, bool isPrebook)
    {
        try
        {
            // Note: Courier payment calculation is only applicable to actual jobs (TucJob),
            // not to prebook/recurring jobs (TucJobBooking) since the SQL trigger only fires on tucJob.
            // The TucJobBooking table doesn't have all the required fields (RawBaseAmount, CourierBonus, etc.)
            if (isPrebook)
            {
                Log.Debug("Courier payment calculation not applicable for prebook jobs. JobId: {JobId}", jobId);
                return null;
            }

            return await Context.TucJobs
                .AsNoTracking()
                .Where(j => j.UcjbId == jobId)
                .Select(j => new CourierPaymentCalculationData
                {
                    JobId = j.UcjbId,
                    RawBaseAmount = j.RawBaseAmount,
                    FuelSurchargeAmount = j.FuelSurchargeAmount,
                    CourierPercentageOverride = j.CourierPercentageOverride,
                    CourierId = j.UcjbCourierId,
                    ClientId = j.UcjbClientId,
                    SpeedId = j.UcjbSpeed,
                    JobRelationshipTypeId = j.JobRelationshipTypeId,

                    // Job Relationship Type
                    PostAmountToCourier = j.JobRelationshipType != null && j.JobRelationshipType.PostAmountToCourier,

                    // Courier fields
                    CourierIsInternal = j.UcjbCourier != null && j.UcjbCourier.UccrInternal,
                    CourierPercentage = j.UcjbCourier != null ? (decimal?)j.UcjbCourier.UccrPercentage : null,
                    CourierBonusPercentage = j.UcjbCourier != null ? j.UcjbCourier.BonusPercentage : null,
                    CourierTypeId = j.UcjbCourier != null ? j.UcjbCourier.CourierTypeId : (int?)null,
                    CourierMasterCourierId = j.UcjbCourier != null ? j.UcjbCourier.MasterCourierId : null,
                    CourierSubContractorPercentage = j.UcjbCourier != null ? j.UcjbCourier.SubContractorPercentage : null,
                    CourierSubContractorFuelPercentage = j.UcjbCourier != null ? j.UcjbCourier.SubContractorFuelPercentage : null,
                    CourierSubContractorBonusPercentage = j.UcjbCourier != null ? j.UcjbCourier.SubContractorBonusPercentage : null,

                    // Client-Available Speed
                    ClientSpeedCourierPercentage = Context.TblClientAvailableSpeeds
                        .Where(cas => cas.ClientId == j.UcjbClientId && cas.SpeedId == j.UcjbSpeed)
                        .Select(cas => cas.CourierPercentage)
                        .FirstOrDefault(),

                    // Job Type (Speed)
                    JobTypeCourierPercentage = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.CourierPercentage : null,

                    // Client
                    ClientCourierPercentage = j.UcjbClient != null ? j.UcjbClient.CourierPercentage : null
                })
                .FirstOrDefaultAsync();
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository),
                    nameof(GetCourierPaymentCalculationDataAsync)));
            throw;
        }
    }

    public async Task UpdateCourierPaymentFieldsAsync(int jobId, bool isPrebook, CourierPaymentResult result)
    {
        try
        {
            if (isPrebook)
            {
                Log.Debug("Courier payment update not applicable for prebook jobs. JobId: {JobId}", jobId);
                return;
            }

            await Context.TucJobs
                .Where(j => j.UcjbId == jobId)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(j => j.CourierPercentage, result.CourierPercentage)
                    .SetProperty(j => j.CourierPayment, result.CourierPayment)
                    .SetProperty(j => j.CourierFuel, result.CourierFuel)
                    .SetProperty(j => j.CourierBonus, result.CourierBonus)
                    .SetProperty(j => j.MasterCourierId, result.MasterCourierId)
                    .SetProperty(j => j.SubContractorPercentage, result.SubContractorPercentage)
                    .SetProperty(j => j.SubContractorFuelPercentage, result.SubContractorFuelPercentage)
                    .SetProperty(j => j.SubContractorBonusPercentage, result.SubContractorBonusPercentage)
                );
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobRepository),
                    nameof(UpdateCourierPaymentFieldsAsync)));
            throw;
        }
    }
}