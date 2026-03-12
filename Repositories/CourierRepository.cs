using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Serilog;
using System;
using System.Collections.Generic;
using System.Data.Common;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.Extensions;

namespace DespatchWeb.Repositories;

public class CourierRepository(
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantInfoService infoService,
    ITenantClock clock,
    IClearListEnvelopeService clearListEnvelopeService,
    IMemoryCache cache)
    : BaseRepository(contextFactory),
        ICourierRepository
{
    private readonly IDbContextFactory<DespatchContext> _contextFactory = contextFactory;

    private static string GetPolygonMappingsCacheKey(List<int> clearListAreaIds)
    {
        // Sort IDs to ensure a consistent cache key regardless of order
        var sortedIds = string.Join("-", clearListAreaIds.OrderBy(x => x));
        return $"polygon-mappings:{sortedIds}";
    }

    public async Task<ActiveCouriersViewModel> GetCourierByIdAsync(int courierId)
    {
        var now = clock.TenantNow;
        var courier = await Context.GetCourierByIdAsync(courierId, now);
        return courier;
    }

    public async Task<TruckCourierStatusViewModel> TruckCourierStatusAsync(int courierId)
    {
        try
        {
            const string truckVehicleName = "Truck";

            var courierData = await Context.TucCouriers
                .Where(c => c.Active && c.UccrId == courierId)
                .Select(c => new
                {
                    c.UccrId,
                    c.Code,
                    c.UccrName,
                    c.LastModified,
                    c.MaxPallets,
                    c.MaxPayload,
                    c.UccrVehicle
                })
                .TagWith("TruckCourierStatus - Step 1: Courier Data")
                .FirstOrDefaultAsync();

            if (courierData == null) return null;

            if (courierData.UccrVehicle != truckVehicleName)
                return new TruckCourierStatusViewModel
                {
                    CourierId = courierData.UccrId,
                    CourierCode = courierData.Code,
                    FirstName = courierData.UccrName,
                    LastUpdated = courierData.LastModified,
                    MaxPallets = null,
                    MaxPayLoad = null,
                    CurrentPallets = null,
                    CurrentWeight = null,
                    AvailablePallets = null,
                    AvailablePalletCapacity = null
                };

            var jobItemsAggregate = await Context.TucJobs
                .Where(j => j.UcjbCourierId == courierId &&
                            !j.UcjbJobDone &&
                            !j.UcjbVoid)
                .SelectMany(j => j.TucJobItemJobs)
                .GroupBy(i => 1)
                .Select(g => new
                {
                    TotalItems = g.Sum(i => i.Items),
                    TotalWeight = g.Sum(i => i.Items * i.Weight)
                })
                .TagWith("TruckCourierStatus - Step 2: Job Items Aggregate")
                .FirstOrDefaultAsync();

            var currentPallets = jobItemsAggregate?.TotalItems ?? 0;
            var currentWeight = jobItemsAggregate?.TotalWeight ?? 0;

            return new TruckCourierStatusViewModel
            {
                CourierId = courierData.UccrId,
                CourierCode = courierData.Code,
                FirstName = courierData.UccrName,
                LastUpdated = courierData.LastModified,
                MaxPallets = courierData.MaxPallets,
                MaxPayLoad = courierData.MaxPayload,
                CurrentPallets = currentPallets,
                CurrentWeight = currentWeight,
                AvailablePallets = courierData.MaxPallets - currentPallets,
                AvailablePalletCapacity = courierData.MaxPayload - currentWeight
            };
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occurred getting courier status for {CourierId}", courierId);
            throw;
        }
    }

    public async Task<List<AvailableCourierPosition>> GetAvailableCouriersAsync(CourierLocationRequest data)
    {
        var correlationId = Guid.NewGuid().ToString();

        Log.Information(
            "[GetAvailableCouriers] START | CorrelationId: {CorrelationId} | MinLng: {MinLng}, MinLat: {MinLat}, MaxLng: {MaxLng}, MaxLat: {MaxLat}",
            correlationId,
            data.MinLng,
            data.MinLat,
            data.MaxLng,
            data.MaxLat
        );

        try
        {
            var isUsTenant = infoService.IsUsTenant();

            Log.Information(
                "[GetAvailableCouriers] Tenant determined | CorrelationId: {CorrelationId} | IsUsTenant: {IsUsTenant}",
                correlationId,
                isUsTenant
            );

            var stopwatch = System.Diagnostics.Stopwatch.StartNew();

            var result = isUsTenant
                ? await GetUsAvailableCourierPositionsAsync(data)
                : await GetNzAvailableCourierPositionsAsync(data);

            stopwatch.Stop();

            Log.Information(
                "[GetAvailableCouriers] SUCCESS | CorrelationId: {CorrelationId} | CourierCount: {CourierCount} | DurationMs: {DurationMs}",
                correlationId,
                result.Count,
                stopwatch.ElapsedMilliseconds
            );

            return result;
        }
        catch (Exception ex)
        {
            Log.Error(
                ex,
                "[GetAvailableCouriers] ERROR | CorrelationId: {CorrelationId} | Message: {ErrorMessage}",
                correlationId,
                ex.Message
            );
            throw;
        }
    }

    private async Task<List<AvailableCourierPosition>> GetUsAvailableCourierPositionsAsync(
        CourierLocationRequest data)
    {
        try
        {
            var currentDate = clock.TenantNow;

            var courierData = await Context.TucCouriers
                .Where(c => c.CourierFleetId != (int)CourierFleet.ClientDriver &&
                            c.CourierGps != null &&
                            c.CourierGps.Longitude >= data.MinLng &&
                            c.CourierGps.Longitude <= data.MaxLng &&
                            c.CourierGps.Latitude >= data.MinLat &&
                            c.CourierGps.Latitude <= data.MaxLat &&
                            c.CourierLogInOut != null &&
                            c.CourierLogInOut.LogOutTime == null)
                .Where(c => c.CourierFleet.DisplayOnClearlistsDespatch)
                .Select(c => new
                {
                    c.UccrId,
                    c.UccrName,
                    c.UccrSurname,
                    Latitude = c.CourierGps.Latitude ?? 0,
                    Longitude = c.CourierGps.Longitude ?? 0,
                    ChannelId = c.UccrChannelId ?? 0,
                    c.UccrVehicle,
                    ClearListAreaIDs = c.CourierGps.ZipPolygon.TblClearListAreaPolygons
                        .Select(x => x.ClearListAreaId).ToList(),
                    c.Code,
                    c.CourierFleetId,
                    DisplayOrder = c.TblClearListAreaOrder != null ? c.TblClearListAreaOrder.Status : 0
                })
                .TagWith("GetUsAvailableCouriers - Step 1: Courier Data")
                .ToListAsync();

            if (courierData.Count == 0) return [];

            var courierIds = courierData.Select(c => c.UccrId).ToList();

            var jobData = await Context.TucJobs
                .Where(j => j.UcjbCourierId.HasValue &&
                            courierIds.Contains(j.UcjbCourierId.Value) &&
                            !j.UcjbVoid &&
                            !j.UcjbJobDone)
                .Select(j => new
                {
                    CourierId = j.UcjbCourierId.Value,
                    j.UcjbDate,
                    j.UcjbTime,
                    Minutes = j.AcceptedJobType.Minutes ?? 0
                })
                .TagWith("GetUsAvailableCouriers - Step 2: Job Data")
                .ToListAsync();

            var jobsByCourier = jobData
                .GroupBy(j => j.CourierId)
                .ToDictionary(
                    g => g.Key,
                    g => new
                    {
                        Count = g.Count(),
                        TimedJobs = g.Where(j => j.UcjbTime != null).ToList()
                    }
                );

            return courierData.Select(c =>
            {
                var jobs = jobsByCourier.GetValueOrDefault(c.UccrId);

                return new AvailableCourierPosition
                {
                    CourierId = c.UccrId,
                    CourierName = c.UccrName + " " + c.UccrSurname,
                    Latitude = c.Latitude,
                    Longitude = c.Longitude,
                    ChannelId = c.ChannelId,
                    VehicleType = MapVehicleTypeToAbbreviation(c.UccrVehicle),
                    ClearListAreaIDs = c.ClearListAreaIDs,
                    Code = c.Code,
                    IsUrgentArmyDriver = c.CourierFleetId != null &&
                                         ((CourierFleet)c.CourierFleetId.Value).IsUrgentArmy(),
                    TotalJobs = jobs?.Count ?? 0,
                    OverDueJobs = jobs?.TimedJobs.Count(j =>
                        j.UcjbDate.CombineWithTime(j.UcjbTime).AddMinutes(j.Minutes) < currentDate) ?? 0,
                    DisplayOrder = c.DisplayOrder
                };
            }).ToList();
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(CourierRepository),
                    nameof(GetUsAvailableCourierPositionsAsync)));
            throw;
        }
    }

    private async Task<List<AvailableCourierPosition>> GetNzAvailableCourierPositionsAsync(
        CourierLocationRequest data)
    {
        try
        {
            var now = clock.TenantNow;

            var courierData = await Context.TucCouriers
                .Where(c => c.CourierLogInOut != null &&
                            c.CourierLogInOut.LogOutTime == null &&
                            c.CourierGps != null &&
                            c.CourierGps.Longitude >= data.MinLng &&
                            c.CourierGps.Longitude <= data.MaxLng &&
                            c.CourierGps.Latitude >= data.MinLat &&
                            c.CourierGps.Latitude <= data.MaxLat)
                .Where(c => c.CourierFleet.DisplayOnClearlistsDespatch)
                .Select(c => new
                {
                    c.UccrId,
                    c.UccrName,
                    c.UccrSurname,
                    Latitude = c.CourierGps.Latitude ?? 0,
                    Longitude = c.CourierGps.Longitude ?? 0,
                    ChannelId = c.UccrChannelId ?? 0,
                    c.UccrVehicle,
                    ClearListAreaIDs = c.CourierGps.Polygon.TblClearListAreaPolygons
                        .Select(x => x.ClearListAreaId).ToList(),
                    c.Code,
                    c.CourierFleetId,
                    DisplayOrder = c.TblClearListAreaOrder != null ? c.TblClearListAreaOrder.Status : 0
                })
                .TagWith("GetNzAvailableCouriers - Step 1: Courier Data")
                .ToListAsync();

            if (courierData.Count == 0) return [];

            var courierIds = courierData.Select(c => c.UccrId).ToList();

            // Single query for all job data
            var jobData = await Context.TucJobs
                .Where(j => j.UcjbCourierId.HasValue &&
                            courierIds.Contains(j.UcjbCourierId.Value) &&
                            !j.UcjbVoid &&
                            !j.UcjbJobDone)
                .Select(j => new
                {
                    CourierId = j.UcjbCourierId.Value,
                    j.UcjbDate,
                    j.UcjbTime,
                    j.AcceptedJobType.Minutes
                })
                .TagWith("GetNzAvailableCouriers - Step 2: Job Data")
                .ToListAsync();

            var jobsByCourier = jobData
                .GroupBy(j => j.CourierId)
                .ToDictionary(
                    g => g.Key,
                    g => new
                    {
                        Count = g.Count(),
                        TimedJobs = g.Where(j => j.UcjbTime != null).ToList()
                    }
                );

            return courierData.Select(c =>
            {
                var jobs = jobsByCourier.GetValueOrDefault(c.UccrId);

                return new AvailableCourierPosition
                {
                    CourierId = c.UccrId,
                    CourierName = c.UccrName + " " + c.UccrSurname,
                    Latitude = c.Latitude,
                    Longitude = c.Longitude,
                    ChannelId = c.ChannelId,
                    VehicleType = MapVehicleTypeToAbbreviation(c.UccrVehicle),
                    ClearListAreaIDs = c.ClearListAreaIDs,
                    Code = c.Code,
                    IsUrgentArmyDriver = c.CourierFleetId != null &&
                                         ((CourierFleet)c.CourierFleetId.Value).IsUrgentArmy(),
                    TotalJobs = jobs?.Count ?? 0,
                    OverDueJobs = jobs?.TimedJobs.Count(j =>
                        j.UcjbTime != null &&
                        j.UcjbDate.Add(j.UcjbTime.Value.TimeOfDay).AddMinutes(j.Minutes ?? 0) < now) ?? 0,
                    DisplayOrder = c.DisplayOrder
                };
            }).ToList();
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(CourierRepository),
                    nameof(GetNzAvailableCourierPositionsAsync)));
            throw;
        }
    }

    public async Task<List<PotentialCouriersViewModel>> GetPotentialCouriersAsync(int jobId)
    {
        var results = await Context.Procedures.DESWEB_qryPotentialCouriersAsync(jobId);
        return results.Select(c => new PotentialCouriersViewModel
        {
            Code = c.Code,
            CourierId = c.CourierID ?? 0,
            FirstName = c.FirstName,
            Reason = c.Reason,
            RuleNumber = c.RuleNumber ?? 0
        }).ToList();
    }

    public async Task<List<ActiveCouriersViewModel>> ActiveCouriersAsync()
    {
        try
        {
            var results = await GetActiveCouriersAsync(includeJobCount: false);
            return results.Select(c => new ActiveCouriersViewModel
            {
                Code = c.Code,
                CourierId = c.CourierId,
                Name = c.Name,
                DangerousGoods = c.DangerousGoods,
                DGLicenseExpiry = c.DgLicenseExpiry
            }).ToList();
        }
        catch (DbException ex)
        {
            Log.Error(ex, "Database error occurred while fetching active couriers");
            throw;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Unexpected error occurred while fetching active couriers");
            throw;
        }
    }

    public async Task<List<Suggestion>> AllActiveCouriersAsync(string searchTerm, bool dgOnly = false, bool loggedInOnly = false)
    {
        var isUsTenant = infoService.IsUsTenant();
        var now = clock.TenantNow;

        try
        {
            Log.Information(
                "Starting AllActiveCouriersAsync search with term: {SearchTerm}, DG Only: {DgOnly}, Logged In Only: {LoggedInOnly}",
                searchTerm,
                dgOnly,
                loggedInOnly
            );

            var query = Context.TucCouriers
                .Where(c =>
                    c.Active == true
                    && EF.Functions.Like(
                        c.Code + " " + c.UccrName + " " + c.UccrSurname,
                        $"%{searchTerm}%"
                    )
                );

            // Filter for DG-certified couriers if dgOnly is true
            if (dgOnly)
            {
                query = query.Where(c =>
                    c.UccrDangerousGoods == 1
                    && c.DglicenseExpiry != null
                    && c.DglicenseExpiry >= now.AddDays(-1)
                );
            }

            // Filter for logged-in couriers if loggedInOnly is true
            if (loggedInOnly)
            {
                var today = now.Date;
                query = query.Where(c =>
                    c.CourierLogInOut != null &&
                    c.CourierLogInOut.LogInTime.Date == today &&
                    c.CourierLogInOut.LogOutTime == null
                );
            }

            var results = await query
                .OrderBy(c => c.Code)
                .Select(c => new Suggestion
                {
                    Id = c.UccrId,
                    Text = isUsTenant
                        ? c.UccrName + " " + c.UccrSurname
                        : c.Code + " (" + c.UccrName + " " + c.UccrSurname + ")"
                })
                .ToListAsync();

            Log.Information(
                "AllActiveCouriersAsync completed. Found {Count} active couriers",
                results.Count
            );
            return results;
        }
        catch (Exception ex)
        {
            Log.Error(
                ex,
                "Error in AllActiveCouriersAsync with search term {SearchTerm}",
                searchTerm
            );
            throw;
        }
    }

    public async Task<List<ActiveCouriersViewModel>> AllActiveCouriersAsync()
    {
        try
        {
            Log.Information("Retrieving all active couriers");

            var results = await GetActiveCouriersAsync(includeJobCount: false);
            var mappedResults = results.Select(c => new ActiveCouriersViewModel
            {
                Code = c.Code,
                CourierId = c.CourierId,
                Name = c.Name,
                DangerousGoods = c.DangerousGoods,
                DGLicenseExpiry = c.DgLicenseExpiry
            }).ToList();

            Log.Information("Retrieved {Count} active couriers", mappedResults.Count);
            return mappedResults;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error retrieving all active couriers");
            throw;
        }
    }

    public async Task<ClearListEnvelopeViewModel> GetClearListAreaEnvelopeAsync(
        int clearListAreaId, Country country, bool includeCouriers = false) =>
        await clearListEnvelopeService.GetClearListAreaEnvelopeAsync(
            clearListAreaId, country, includeCouriers);

    private async Task<List<ActiveCourierDto>> GetActiveCouriersAsync(bool includeJobCount = true)
    {
        var today = clock.TenantToday;
        var results = await Context.GetActiveCouriersAsync(today);

        if (!includeJobCount || results.Count == 0) return results;

        var courierIds = results.Select(c => c.CourierId).ToList();

        var jobCounts = await Context.TucJobs
            .Where(j => j.UcjbCourierId.HasValue &&
                        courierIds.Contains(j.UcjbCourierId.Value) &&
                        !j.UcjbVoid &&
                        !j.UcjbJobDone &&
                        j.UcjbDate.Date <= today.Date)
            .GroupBy(j => j.UcjbCourierId.Value)
            .Select(g => new { CourierId = g.Key, Count = g.Count() })
            .TagWith("GetActiveCouriers - Job Counts")
            .ToListAsync();

        var jobCountDict = jobCounts.ToDictionary(x => x.CourierId, x => x.Count);

        // Update job counts in memory
        foreach (var result in results)
            result.JobCount = jobCountDict.GetValueOrDefault(result.CourierId, 0);

        return results;
    }

    public async Task<ClearListViewModel> GetClearListsAsync(
        List<int> despatchViewIds,
        DateTimeOffset? startDate = null,
        DateTimeOffset? endDate = null)
    {
        if (despatchViewIds.Count == 0) return new ClearListViewModel();

        try
        {
            var currentDate = clock.TenantNow;
            var currentDateOnly = currentDate.Date;

            // Use provided date range or default to today
            var jobStartDate = startDate?.DateTime ?? currentDateOnly;
            var jobEndDate = endDate?.DateTime ?? currentDateOnly.AddDays(1);

            // ===================================================================
            // WAVE 1: Independent queries (Clear Lists + Courier Data) - PARALLEL
            // ===================================================================
            var clearListsTask = GetClearListAreasAsync(despatchViewIds);
            var courierDataTask = GetAllCourierDataAsync(currentDateOnly);

            await Task.WhenAll(clearListsTask, courierDataTask);

            var clearLists = clearListsTask.Result;
            if (clearLists.Count == 0) return new ClearListViewModel();

            var allCourierData = courierDataTask.Result;
            var clearListAreaIds = clearLists.Select(cl => cl.ClearListAreaId).ToList();
            var courierIds = allCourierData.Select(c => c.UccrId).ToList();

            Log.Information("Wave 1 complete: Found {ClearListCount} clear lists, {CourierCount} couriers",
                clearLists.Count, allCourierData.Count);

            // ===================================================================
            // WAVE 2: Queries depending on Wave 1 results - PARALLEL
            // ===================================================================
            var polygonMappingsTask = GetPolygonMappingsAsync(clearListAreaIds);
            var areaFiltersTask = GetAreaFiltersAsync(clearLists);
            var displayOrdersTask = GetDisplayOrdersAsync(courierIds);
            var jobsTask = GetAllJobsAsync(courierIds, jobStartDate, jobEndDate);

            await Task.WhenAll(polygonMappingsTask, areaFiltersTask, displayOrdersTask, jobsTask);

            var allValidCourierGpsIds = polygonMappingsTask.Result;
            var areaFilterDict = areaFiltersTask.Result;
            var displayOrders = displayOrdersTask.Result;
            var allJobs = jobsTask.Result;

            Log.Information("Wave 2 complete: {PolygonCount} polygon mappings, {JobCount} jobs",
                allValidCourierGpsIds.Count, allJobs.Count);

            // Process polygon mappings - use appropriate ID based on tenant
            var isUsTenant = infoService.IsUsTenant();

            var polygonChannelsByClearListArea = allValidCourierGpsIds
                .GroupBy(x => x.ClearListAreaId)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(x => new { MatchingId = isUsTenant ? x.ZipPolygonId : x.PolygonId, x.ChannelId }).ToList()
                );

            // Apply display orders to courier data
            var displayOrderDict = displayOrders.ToDictionary(d => d.CourierId);
            foreach (var courier in allCourierData)
            {
                if (!displayOrderDict.TryGetValue(courier.UccrId, out var order)) continue;
                courier.DisplayOrder = order.Status;
                courier.OrderTime = order.OrderTime;
            }

            // Group couriers by GPS polygon ID for area filtering
            var couriersByPolygon = allCourierData
                .Where(c => isUsTenant ? c.ZipPolygonId.HasValue : c.PolygonId.HasValue)
                .GroupBy(c => isUsTenant ? c.ZipPolygonId!.Value : c.PolygonId!.Value)
                .ToDictionary(g => g.Key, g => g.ToList());

            // Process job counts
            var jobCountsByCourier = allJobs
                .GroupBy(j => j.CourierId)
                .ToDictionary(g => g.Key, g => g.Count());

            foreach (var courier in allCourierData)
            {
                courier.JobCount = jobCountsByCourier.GetValueOrDefault(courier.UccrId, 0);

                // If a courier has no jobs in the filtered range, move them to the "no jobs" section (3/purple)
                if (courier.JobCount == 0 && courier.DisplayOrder is 1 or 5)
                    courier.DisplayOrder = 3;
            }

            var jobsByCourier = allJobs
                .GroupBy(j => j.CourierId)
                .ToDictionary(g => g.Key, g => g.ToList());

            // ===================================================================
            // WAVE 3: Queries depending on Wave 2 results - PARALLEL
            // ===================================================================
            var areaRemainingTask = GetTotalRemainingForAllAreasAsync(areaFilterDict);

            Dictionary<int, List<SuburbClearListAreaDto>> suburbLookup = [];
            Dictionary<(decimal, decimal), List<SuburbClearListAreaDto>> coordinateLookup = [];

            if (isUsTenant)
            {
                var allCoordinates = allJobs
                    .Where(j => j.DeliveryLatitude.HasValue && j.DeliveryLongitude.HasValue)
                    .Select(j => (j.DeliveryLatitude!.Value, j.DeliveryLongitude!.Value))
                    .ToHashSet();

                var coordinateMappingsTask = GetCoordinateMappingsAsync(allCoordinates);
                await Task.WhenAll(coordinateMappingsTask, areaRemainingTask);
                coordinateLookup = coordinateMappingsTask.Result;

                Log.Information("Wave 3 complete (US): {CoordinateCount} coordinate mappings, {AreaCount} area remaining counts",
                    coordinateLookup.Count, areaRemainingTask.Result.Count);
            }
            else
            {
                var allSuburbIds = allJobs
                    .Where(j => j.ToSuburbId.HasValue)
                    .Select(j => j.ToSuburbId.Value)
                    .Distinct()
                    .ToHashSet();

                var suburbMappingsTask = GetSuburbMappingsAsync(allSuburbIds);
                await Task.WhenAll(suburbMappingsTask, areaRemainingTask);
                suburbLookup = suburbMappingsTask.Result;

                Log.Information("Wave 3 complete (NZ): {SuburbCount} suburb mappings, {AreaCount} area remaining counts",
                    suburbLookup.Count, areaRemainingTask.Result.Count);
            }

            var areaRemainingCounts = areaRemainingTask.Result;

            // ===================================================================
            // IN-MEMORY PROCESSING: Build clear lists for each area
            // ===================================================================
            Dictionary<string, int> columnDefinitions;
            if (isUsTenant)
            {
                // US: sort by database AreaOrder, distribute round-robin across 4 columns
                clearLists = clearLists.OrderBy(cl => cl.AreaOrder).ToList();
                columnDefinitions = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
                for (var i = 0; i < clearLists.Count; i++)
                    columnDefinitions[clearLists[i].AreaName] = i % 4 + 1;
            }
            else
            {
                // NZ: hardcoded column definitions and display order
                columnDefinitions = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
                {
                    { "Central", 1 }, { "Other", 1 },
                    { "West Mid", 2 }, { "Shallow West", 2 }, { "Deep West", 2 },
                    { "East Mid", 3 }, { "Shallow Shore", 3 }, { "Deep Shore", 3 },
                    { "Mangere", 4 }, { "Deep South", 4 }, { "Deep East", 4 }
                };

                var areaDisplayOrder = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
                {
                    { "Central", 1 }, { "Other", 2 }, { "West Mid", 3 }, { "Shallow West", 4 },
                    { "Deep West", 5 }, { "East Mid", 6 }, { "Shallow Shore", 7 }, { "Deep Shore", 8 },
                    { "Mangere", 9 }, { "Deep South", 10 }, { "Deep East", 11 }
                };

                clearLists = clearLists
                    .OrderBy(cl => areaDisplayOrder.TryGetValue(cl.AreaName, out var order) ? order : 999)
                    .ToList();
            }

            var areas = new List<AreaClearList>();

            foreach (var clearList in clearLists)
            {
                // Get couriers for this specific area WITH channel matching
                List<CourierClearListDto> areaCouriers = [];

                if (polygonChannelsByClearListArea.TryGetValue(clearList.ClearListAreaId, out var validPolygonChannels))
                {
                    // For each polygon-channel pair in this clear list area
                    foreach (var polygonChannel in validPolygonChannels)
                    {
                        if (polygonChannel.MatchingId == null ||
                            !couriersByPolygon.TryGetValue(polygonChannel.MatchingId.Value, out var couriersWithPolygon))
                            continue;

                        // Filter to only couriers whose channel matches the area's channel
                        var matchingCouriers = couriersWithPolygon
                            .Where(c => c.UccrChannelId == polygonChannel.ChannelId)
                            .ToList();

                        areaCouriers.AddRange(matchingCouriers);
                    }

                    // Remove duplicates (in case a courier matches multiple polygon-channel combos)
                    areaCouriers = areaCouriers
                        .GroupBy(c => c.UccrId)
                        .Select(g => g.First())
                        .ToList();
                }

                // Build clear list results even if empty
                var clearListResults = BuildClearListResultsInMemory(
                    areaCouriers,
                    jobsByCourier,
                    suburbLookup,
                    coordinateLookup,
                    isUsTenant,
                    currentDate
                );

                // Build sections (will be empty if no couriers)
                var areaClearList = new AreaClearList
                {
                    Id = clearList.ClearListAreaId,
                    Name = clearList.AreaName,
                    Order = clearList.AreaOrder,
                    PercentHeight = 33,
                    Top = BuildClearListSection(clearListResults, allCourierData, 1),
                    Middle = BuildClearListSection(clearListResults, allCourierData, 3),
                    Bottom = BuildClearListSection(clearListResults, allCourierData, 5),
                    TotalRemaining = areaRemainingCounts.GetValueOrDefault(
                        clearList.AreaName?.ToLower() ?? string.Empty,
                        0
                    )
                };

                areas.Add(areaClearList);
            }

            Log.Information("Final: Built {Count} areas for display", areas.Count);

            // ===================================================================
            // Build column layout
            // ===================================================================
            var columns = new List<ClearListColumn>();
            var assignedAreas = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            for (var columnNum = 1; columnNum <= 4; columnNum++)
            {
                var columnAreas = areas
                    .Where(a => columnDefinitions.TryGetValue(a.Name, out var col) && col == columnNum)
                    .ToList();

                foreach (var area in columnAreas)
                    assignedAreas.Add(area.Name);

                if (columnAreas.Count != 0)
                    columns.Add(new ClearListColumn { Areas = columnAreas });
            }

            var unassignedAreas = areas
                .Where(a => !assignedAreas.Contains(a.Name))
                .OrderBy(a => a.Name, StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (unassignedAreas.Count == 0)
            {
                return new ClearListViewModel
                {
                    Areas = areas,
                    Columns = columns
                };
            }

            if (columns.Count != 0)
            {
                columns.Last().Areas.AddRange(unassignedAreas);
            }
            else
            {
                const int maxColumns = 4;
                for (var i = 0; i < maxColumns; i++)
                    columns.Add(new ClearListColumn { Areas = [] });

                for (var i = 0; i < unassignedAreas.Count; i++)
                    columns[i % maxColumns].Areas.Add(unassignedAreas[i]);
            }

            return new ClearListViewModel
            {
                Areas = areas,
                Columns = columns
            };
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error in GetClearListsAsync for despatchViewIds: {@DespatchViewIds}", despatchViewIds);
            throw;
        }
    }

    private static List<ClearListResult> BuildClearListResultsInMemory(
        List<CourierClearListDto> areaCouriers,
        Dictionary<int, List<CourierJobSuburbDto>> jobsByCourier,
        Dictionary<int, List<SuburbClearListAreaDto>> suburbLookup,
        Dictionary<(decimal, decimal), List<SuburbClearListAreaDto>> coordinateLookup,
        bool isUsTenant,
        DateTime currentDate)
    {
        var clearListResults = new List<ClearListResult>();

        foreach (var courier in areaCouriers)
        {
            var courierJobs = jobsByCourier.GetValueOrDefault(courier.UccrId, []);
            var deliverCodes = new List<string>();

            if (courierJobs.Count != 0)
            {
                var jobsByArea = courierJobs
                    .GroupBy(job =>
                    {
                        List<SuburbClearListAreaDto> areaOptions = null;

                        if (isUsTenant)
                        {
                            if (job.DeliveryLatitude.HasValue && job.DeliveryLongitude.HasValue)
                                coordinateLookup.TryGetValue(
                                    (job.DeliveryLatitude.Value, job.DeliveryLongitude.Value),
                                    out areaOptions);
                        }
                        else
                        {
                            if (job.ToSuburbId.HasValue)
                                suburbLookup.TryGetValue(job.ToSuburbId.Value, out areaOptions);
                        }

                        if (areaOptions == null)
                            return "O";

                        var matchingSameChannel = areaOptions
                            .FirstOrDefault(sca => sca.ChannelId == courier.UccrChannelId);

                        if (matchingSameChannel != null)
                            return matchingSameChannel.Code;

                        var matchingDifferentChannel = areaOptions
                            .FirstOrDefault(sca => sca.ChannelId != courier.UccrChannelId);

                        return matchingDifferentChannel?.Code ?? "O";
                    })
                    .Select(g => new
                    {
                        DeliverCode = g.Key,
                        JobCount = g.Count()
                    });

                deliverCodes = jobsByArea
                    .Select(area => area.DeliverCode + (area.JobCount > 0 ? area.JobCount.ToString() : string.Empty))
                    .ToList();
            }

            // Build courier code with indicators
            var codeBuilder = courier.Code;
            if (courier.SendJobsViaSms) codeBuilder += "#";
            if (courier.GpsCreated.HasValue &&
                (currentDate - courier.GpsCreated.Value).TotalMinutes > 3)
                codeBuilder += "*";
            if (!courier.AutoDespatch) codeBuilder += "^";
            if (courier.UccrVehicle == "Truck") codeBuilder += "T";

            clearListResults.Add(new ClearListResult
            {
                CourierId = courier.UccrId,
                Code = codeBuilder,
                DisplayOrder = courier.DisplayOrder ?? 0,
                Deliver = string.Join(",", deliverCodes),
                DisplayOrderDesc = courier.DisplayOrder == 1 ? courier.OrderTime : null,
                DisplayOrderAsc = courier.DisplayOrder != 1 ? courier.OrderTime : null,
                AutoDespatch = courier.AutoDespatch
            });
        }

        // Add static separator rows and sort
        return clearListResults
            .Concat(GetStaticSeparatorRows())
            .OrderBy(x => x.DisplayOrder)
            .ThenBy(x => x.DisplayOrderDesc)
            .ThenBy(x => x.DisplayOrderAsc)
            .ThenBy(x => x.Code)
            .ThenBy(x => x.Deliver)
            .ToList();
    }

    // ===================================================================
    // PARALLEL QUERY HELPER METHODS FOR GetClearListsAsync
    // ===================================================================

    /// <summary>
    /// Query 1: Get all clear list areas for the given despatch view IDs.
    /// </summary>
    private async Task<List<ClearListAreaDto>> GetClearListAreasAsync(List<int> despatchViewIds)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        return await context.TblDespatchViews
            .Where(dv => despatchViewIds.Contains(dv.DespatchViewId))
            .SelectMany(dv => dv.DespatchViewZoneGroups)
            .Select(dvzg => dvzg.ZoneGroup.ClearListArea)
            .Where(cla => cla != null)
            .Distinct()
            .Select(cl => new ClearListAreaDto
            {
                ClearListAreaId = cl.ClearListAreaId,
                AreaName = cl.Name,
                AreaOrder = cl.Order
            })
            .TagWith("GetClearLists - Wave 1: Clear List Areas")
            .ToListAsync();
    }

    /// <summary>
    /// Query 3&4: Get all courier data with GPS, Fleet info.
    /// </summary>
    private async Task<List<CourierClearListDto>> GetAllCourierDataAsync(DateTime currentDateOnly)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        return await context.TucCouriers
            .Where(c => c.Active && c.TblClearListAreaOrder != null)
            .Where(c => c.CourierFleetId == (int)CourierFleet.UaAucklandP2P ||
                        (c.CourierLogInOut != null &&
                         c.CourierLogInOut.LogInTime >= currentDateOnly &&
                         c.CourierLogInOut.LogOutTime == null))
            .Where(c => c.CourierFleet.DisplayOnClearlistsDespatch)
            .GroupJoin(
                context.TucCourierFleets,
                c => c.CourierFleetId,
                cf => cf.UccfId,
                (c, cfGroup) => new { Courier = c, FleetGroup = cfGroup }
            )
            .SelectMany(
                x => x.FleetGroup.DefaultIfEmpty(),
                (x, cf) => new { x.Courier, Fleet = cf }
            )
            .GroupJoin(
                context.TblCourierGps,
                x => x.Courier.CourierGpsid,
                gps => gps.CourierGpsid,
                (x, gpsGroup) => new { x.Courier, x.Fleet, GpsGroup = gpsGroup }
            )
            .SelectMany(
                x => x.GpsGroup.DefaultIfEmpty(),
                (x, gps) => new { x.Courier, x.Fleet, Gps = gps }
            )
            .Select(x => new CourierClearListDto
            {
                UccrId = x.Courier.UccrId,
                Code = x.Courier.Code,
                Name = x.Courier.UccrName + " " + x.Courier.UccrSurname,
                DangerousGoods = x.Courier.UccrDangerousGoods == 1,
                DgLicenseExpiry = x.Courier.DglicenseExpiry,
                UccrChannelId = x.Courier.UccrChannelId,
                SendJobsViaSms = x.Courier.SendJobsViaSms,
                AutoDespatch = x.Courier.AutoDespatch,
                UccrVehicle = x.Courier.UccrVehicle,
                CourierGpsid = x.Courier.CourierGpsid,
                GpsCreated = x.Gps != null ? x.Gps.Created : null,
                PolygonId = x.Gps != null ? x.Gps.PolygonId : null,
                ZipPolygonId = x.Gps != null ? x.Gps.ZipPolygonId : null,
                JobCount = 0
            })
            .OrderBy(c => c.Code)
            .TagWith("GetClearLists - Wave 1: All Courier Data with GPS")
            .ToListAsync();
    }

    /// <summary>
    /// Query 2: Get polygon mappings for clear list areas (cached).
    /// </summary>
    private async Task<List<PolygonChannelMapping>> GetPolygonMappingsAsync(List<int> clearListAreaIds)
    {
        var cacheKey = GetPolygonMappingsCacheKey(clearListAreaIds);

        return await cache.GetOrCreateAsync(
            cacheKey,
            async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
                entry.Priority = CacheItemPriority.Normal;

                Log.Information("Cache MISS for polygon mappings - fetching from database");

                await using var context = await _contextFactory.CreateDbContextAsync();
                return await context.GetPolygonMappings(clearListAreaIds);
            }) ?? [];
    }

    /// <summary>
    /// Query 7: Get area filters for total remaining calculation.
    /// </summary>
    private async Task<Dictionary<string, string>> GetAreaFiltersAsync(List<ClearListAreaDto> clearLists)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var clearListNames = clearLists.Select(cl => cl.AreaName);

        var areaFilters = await context.TblDespatchViews
            .Where(v => v.ShowOnAssistDespatch == true &&
                        clearListNames.Contains(v.Name))
            .Select(v => new
            {
                v.Name,
                v.WhereCondition
            })
            .TagWith("GetClearLists - Wave 2: Area Filters")
            .ToListAsync();

        return areaFilters
            .Where(af => !string.IsNullOrEmpty(af.WhereCondition))
            .ToDictionary(af => af.Name?.ToLower() ?? "", af => af.WhereCondition);
    }

    /// <summary>
    /// Query 4b: Get display orders for couriers.
    /// </summary>
    private async Task<List<DisplayOrderDto>> GetDisplayOrdersAsync(List<int> courierIds)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        return await context.TblClearListAreaOrders
            .Where(cao => courierIds.Contains(cao.CourierId))
            .Select(cao => new DisplayOrderDto
            {
                CourierId = cao.CourierId,
                Status = cao.Status,
                OrderTime = cao.OrderTime
            })
            .TagWith("GetClearLists - Wave 2: Display Orders")
            .ToListAsync();
    }

    /// <summary>
    /// Query 5: Get all jobs for couriers.
    /// </summary>
    private async Task<List<CourierJobSuburbDto>> GetAllJobsAsync(
        List<int> courierIds, DateTime startDate, DateTime endDate)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var courierIdSet = courierIds.ToHashSet();

        return await context.TucJobs
            .Where(job => !job.UcjbJobDone &&
                          !job.UcjbVoid &&
                          job.UcjbDate >= startDate &&
                          job.UcjbDate < endDate &&
                          job.UcjbCourierId.HasValue &&
                          courierIdSet.Contains(job.UcjbCourierId.Value))
            .Select(job => new CourierJobSuburbDto
            {
                CourierId = job.UcjbCourierId.Value,
                ToSuburbId = job.UcjbTo,
                DeliveryLatitude = job.DeliveryLatitude,
                DeliveryLongitude = job.DeliveryLongitude
            })
            .TagWith("GetClearLists - Wave 2: All Jobs")
            .ToListAsync();
    }

    /// <summary>
    /// Query 6: Get suburb to clear list area mappings.
    /// </summary>
    private async Task<Dictionary<int, List<SuburbClearListAreaDto>>> GetSuburbMappingsAsync(HashSet<int> allSuburbIds)
    {
        if (allSuburbIds.Count == 0)
            return [];

        await using var context = await _contextFactory.CreateDbContextAsync();
        var suburbClearListAreas = await context.TblPolygonSuburbs
            .Where(ps => allSuburbIds.Contains(ps.SuburbId))
            .Join(context.TblPolygons,
                ps => ps.PolygonId,
                p => p.PolygonId,
                (ps, p) => new { ps.SuburbId, p.PolygonId })
            .Join(context.TblClearListAreaPolygons,
                p => p.PolygonId,
                cap => cap.PolygonId,
                (p, cap) => new { p.SuburbId, cap.ClearListAreaId })
            .Join(context.TblClearListAreas,
                cap => cap.ClearListAreaId,
                cla => cla.ClearListAreaId,
                (cap, cla) => new SuburbClearListAreaDto
                {
                    SuburbId = cap.SuburbId,
                    ClearListAreaId = cla.ClearListAreaId,
                    Code = cla.Code,
                    ChannelId = cla.ChannelId
                })
            .TagWith("GetClearLists - Wave 3: Suburb Mappings")
            .ToListAsync();

        return suburbClearListAreas
            .GroupBy(sca => sca.SuburbId)
            .ToDictionary(g => g.Key, g => g.ToList());
    }

    /// <summary>
    /// Query 6b (US): Map delivery coordinates → ZipPolygon → ClearListArea.
    /// </summary>
    private async Task<Dictionary<(decimal, decimal), List<SuburbClearListAreaDto>>>
        GetCoordinateMappingsAsync(HashSet<(decimal lat, decimal lng)> coordinates)
    {
        if (coordinates.Count == 0)
            return [];

        await using var context = await _contextFactory.CreateDbContextAsync();
        var latitudes = coordinates.Select(c => c.lat).Distinct().ToList();

        var results = await context.ZipPolygons
            .Where(zp => zp.Latitude.HasValue && zp.Longitude.HasValue &&
                         latitudes.Contains(zp.Latitude.Value))
            .Join(context.TblClearListAreaPolygons,
                zp => zp.ZipPolygonId,
                cap => cap.ZipPolygonId,
                (zp, cap) => new { zp.Latitude, zp.Longitude, cap.ClearListAreaId })
            .Join(context.TblClearListAreas,
                x => x.ClearListAreaId,
                cla => cla.ClearListAreaId,
                (x, cla) => new
                {
                    Lat = x.Latitude!.Value,
                    Lng = x.Longitude!.Value,
                    cla.ClearListAreaId,
                    cla.Code,
                    cla.ChannelId
                })
            .TagWith("GetClearLists - Wave 3: Coordinate Mappings (US)")
            .ToListAsync();

        return results
            .Where(r => coordinates.Contains((r.Lat, r.Lng)))
            .GroupBy(r => (r.Lat, r.Lng))
            .ToDictionary(
                g => g.Key,
                g => g.Select(r => new SuburbClearListAreaDto
                {
                    SuburbId = 0,
                    ClearListAreaId = r.ClearListAreaId,
                    Code = r.Code,
                    ChannelId = r.ChannelId
                }).ToList());
    }

    private async Task<Dictionary<string, int>> GetTotalRemainingForAllAreasAsync(
        Dictionary<string, string> areaFilterDict)
    {
        if (areaFilterDict.Count == 0)
            return new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        const string cacheKey = "ClearList:AreaRemainingCounts";

        return await cache.GetOrCreateAsync(cacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(30);

            Log.Information("AreaRemainingCounts cache MISS - calling stored procedure");

            await using var context = await _contextFactory.CreateDbContextAsync();

            var results = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

            await using var command = context.Database.GetDbConnection().CreateCommand();
            command.CommandText = "EXEC dbo.GetAreaRemainingCounts";
            command.CommandType = System.Data.CommandType.Text;

            await context.Database.OpenConnectionAsync();

            try
            {
                await using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    var areaName = reader.GetString(0);
                    var remaining = reader.GetInt32(1);
                    if (remaining >= 0)
                        results[areaName.ToLower()] = remaining;
                }
            }
            finally
            {
                await context.Database.CloseConnectionAsync();
            }

            return results;
        }) ?? new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
    }


    private static List<ClearListResult> GetStaticSeparatorRows()
    {
        return
        [
            new ClearListResult
            {
                CourierId = null,
                Code = "----",
                DisplayOrder = 2,
                Deliver = "---------",
                DisplayOrderDesc = null,
                DisplayOrderAsc = null,
                AutoDespatch = null
            },

            new ClearListResult
            {
                CourierId = null,
                Code = "----",
                DisplayOrder = 4,
                Deliver = "---------",
                DisplayOrderDesc = null,
                DisplayOrderAsc = null,
                AutoDespatch = null
            }
        ];
    }

    private static List<ClearListSection> BuildClearListSection(
        List<ClearListResult> data,
        List<CourierClearListDto> allCouriers,
        int displayOrder
    )
    {
        if (data == null) return [];

        return data
            .Where(c => c.DisplayOrder == displayOrder)
            .Select(x =>
            {
                var courier = allCouriers.FirstOrDefault(c => c?.UccrId == x.CourierId);
                return new ClearListSection
                {
                    CourierNumber = x.Code,
                    CourierData = BuildCourierData(x, allCouriers),
                    Destinations = BuildDestinations(x.Deliver),
                    JobCount = courier?.JobCount ?? 0
                };
            })
            .ToList();
    }

    private static CourierData BuildCourierData(
        ClearListResult result,
        List<CourierClearListDto> allCouriers
    )
    {
        if (allCouriers == null)
            return new CourierData();

        var courier = allCouriers.FirstOrDefault(c => c?.UccrId == result?.CourierId);

        return new CourierData
        {
            Courier = $"{courier?.Code} {courier?.Name}".Trim(),
            Location = "Unknown",
            Pu = "Unknown",
            Del = result?.Deliver ?? "Unknown",
            Lrm = "Unknown",
            Eta2Lrm = "Unknown",
            CourierId = result?.CourierId
        };
    }

    private static List<Destination> BuildDestinations(string deliver) =>
        deliver
            ?.Split(',')
            .Select((d, index) => new Destination { Id = index + 1, Label = d.Trim() })
            .Where(y => !string.IsNullOrWhiteSpace(y.Label))
            .ToList() ?? [];

    public async Task<List<Suggestion>> SearchAllCouriersAsync(string searchTerm)
    {
        var searchPattern = $"%{searchTerm}%";

        var couriers = await Context.TucCouriers
            .Where(c => EF.Functions.Like(c.Code, searchPattern)
                        || EF.Functions.Like(c.UccrName, searchPattern)
                        || EF.Functions.Like(c.UccrSurname, searchPattern)
                        || EF.Functions.Like(c.UccrVehicleModel, searchPattern)
                        || EF.Functions.Like(c.VehiclePlateNnumber, searchPattern)
                        || EF.Functions.Like(c.UccrEmail, searchPattern)
                        || EF.Functions.Like(c.PersonalMobile, searchPattern)
                        || EF.Functions.Like(c.UccrMobile, searchPattern)
                        || EF.Functions.Like(c.UccrName + " " + c.UccrSurname, searchPattern))
            .OrderBy(c => c.Code)
            .Take(50)
            .Select(c => new Suggestion
            {
                Id = c.UccrId,
                Text = $"{c.Code} - {c.UccrName} {c.UccrSurname}"
            })
            .ToListAsync();

        return couriers;
    }

    public async Task<CourierDataDashboardViewModel> GetCourierDetailsForDashboardAsync(int courierId) =>
        await Context.TucCouriers
            .Where(c => c.UccrId == courierId)
            .Select(c => new CourierDataDashboardViewModel
            {
                CourierId = c.UccrId,
                BasicInformation = new BasicInformation
                {
                    Code = c.Code,
                    FirstName = c.UccrName,
                    Surname = c.UccrSurname,
                    Email = c.UccrEmail,
                    Address = c.UccrAddress
                },
                ContactInformation = new ContactInformation
                {
                    Mobile = c.UccrMobile,
                    Home = c.PersonalMobile,
                    GstNumber = c.UccrGst,
                    IrdNumber = c.OpenForceNumber
                },
                VehicleInformation = new VehicleInformation
                {
                    Rego = c.VehiclePlateNnumber,
                    VehicleYear = c.UccrVehicleYear,
                    VehicleModel = c.UccrVehicleModel,
                    VehicleInsurance = c.UccrInsurance != null ? c.UccrInsurance.UcicName : "None"
                },
                Compliance = new Compliance
                {
                    DangerousGoods = c.UccrDangerousGoods == 1,
                    DangerousGoodsExpiry = c.DglicenseExpiry,
                    DriversLicenceExpiry = c.DriversLicenseExpiry
                },
                BankingAndEmergency = new BankingAndEmergency
                {
                    EmergencyContact = false,
                    Bank = c.UccrBankBranch,
                    SecurityCheck = false
                },
                AdditionalInformation = new AdditionalInformation
                {
                    ContactSignDate = c.UccrStartDate,
                    MobileInsurence = c.MobileInsurance,
                    DailyProfitAdjust = 42,
                    Notes = c.UccrNotes
                }
            })
            .FirstOrDefaultAsync();

    public async Task<CourierCompliancePaginatedResponse> GetAllCourierComplianceAsync(
        CourierComplianceFilterRequest request)
    {
        var now = clock.TenantNow;
        var tenantTimezone = infoService.GetTenantTimeZone();
        var expiringThreshold = now.AddDays(30);

        var page = Math.Max(1, request.Page);
        var pageSize = Math.Max(1, Math.Min(100, request.PageSize));

        var query = Context.TucCouriers.AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.SearchTerm))
        {
            var searchPattern = $"%{request.SearchTerm}%";
            query = query.Where(c =>
                EF.Functions.Like(c.Code, searchPattern) ||
                EF.Functions.Like(c.UccrName, searchPattern) ||
                EF.Functions.Like(c.UccrSurname, searchPattern) ||
                EF.Functions.Like(c.UccrMobile, searchPattern) ||
                EF.Functions.Like(c.PersonalMobile, searchPattern) ||
                EF.Functions.Like(c.VehiclePlateNnumber, searchPattern) ||
                EF.Functions.Like(c.UccrVehicleModel, searchPattern) ||
                EF.Functions.Like(c.UccrName + " " + c.UccrSurname, searchPattern)
            );
        }

        if (request.Fleet != 0)
            query = query.Where(c => c.CourierFleetId == request.Fleet);

        if (!string.IsNullOrWhiteSpace(request.Type))
        {
            query = request.Type.ToLower() switch
            {
                "drivers_license" => query.Where(c => c.DriversLicenseExpiry.HasValue),
                "dg_endorsement" => query.Where(c => c.UccrDangerousGoods == 1 && c.DglicenseExpiry.HasValue),
                _ => query
            };
        }

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            query = request.Status.ToLower() switch
            {
                "expired" => query.Where(c => c.DriversLicenseExpiry.HasValue && c.DriversLicenseExpiry.Value < now),
                "expiring" => query.Where(c =>
                    c.DriversLicenseExpiry.HasValue && c.DriversLicenseExpiry.Value >= now &&
                    c.DriversLicenseExpiry.Value <= expiringThreshold),
                "valid" => query.Where(c =>
                    !c.DriversLicenseExpiry.HasValue || c.DriversLicenseExpiry.Value > expiringThreshold),
                _ => query
            };
        }

        // Get all counts in a single query using GroupBy
        var aggregates = await query
            .GroupBy(c => 1)
            .Select(g => new
            {
                TotalCount = g.Count(),
                TotalExpired = g.Count(c => c.DriversLicenseExpiry.HasValue && c.DriversLicenseExpiry.Value < now),
                TotalExpiringSoon = g.Count(c =>
                    c.DriversLicenseExpiry.HasValue &&
                    c.DriversLicenseExpiry.Value >= now &&
                    c.DriversLicenseExpiry.Value <= expiringThreshold),
                TotalValid = g.Count(c =>
                    !c.DriversLicenseExpiry.HasValue ||
                    c.DriversLicenseExpiry.Value > expiringThreshold)
            })
            .FirstOrDefaultAsync();

        var totalCount = aggregates?.TotalCount ?? 0;
        var totalExpired = aggregates?.TotalExpired ?? 0;
        var totalExpiringSoon = aggregates?.TotalExpiringSoon ?? 0;
        var totalValid = aggregates?.TotalValid ?? 0;

        // Apply sorting
        query = request.OrderBy?.ToLower() switch
        {
            "code" => request.SortDescending
                ? query.OrderByDescending(c => c.Code)
                : query.OrderBy(c => c.Code),
            "name" => request.SortDescending
                ? query.OrderByDescending(c => c.UccrName).ThenByDescending(c => c.UccrSurname)
                : query.OrderBy(c => c.UccrName).ThenBy(c => c.UccrSurname),
            "expiry" => request.SortDescending
                ? query.OrderByDescending(c => c.DriversLicenseExpiry)
                : query.OrderBy(c => c.DriversLicenseExpiry),
            "type" => request.SortDescending
                ? query.OrderByDescending(c => "Dangerous Goods")
                : query.OrderBy(c => "Dangerous Goods"),
            _ => request.SortDescending
                ? query.OrderByDescending(c => c.Code)
                : query.OrderBy(c => c.Code)
        };

        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        var couriersCompliance = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new CourierComplianceViewModel
            {
                Code = c.Code,
                Name = c.UccrName + " " + c.UccrSurname,
                ComplianceType = c.UccrDangerousGoods == 1 ? "Dangerous Goods" : "Driver's License",
                ItemNumber = c.UccrDangerousGoods == 1 ? "DG-" + c.Code : "DL-" + c.Code,
                ExpiryDate = c.UccrDangerousGoods == 1 ? c.DglicenseExpiry : c.DriversLicenseExpiry,
                Status = GetComplianceStatus(now,
                    c.UccrDangerousGoods == 1 ? c.DglicenseExpiry : c.DriversLicenseExpiry),
                DaysUntilExpiry = CalculateDaysUntilExpiry(now,
                    c.UccrDangerousGoods == 1 ? c.DglicenseExpiry : c.DriversLicenseExpiry)
            })
            .ToListAsync();

        var convertedCompliance = couriersCompliance.Select(c => new CourierComplianceViewModel
        {
            Code = c.Code,
            Name = c.Name,
            ComplianceType = c.ComplianceType,
            ItemNumber = c.ItemNumber,
            ExpiryDate = c.ExpiryDate.HasValue
                ? TimeZoneHelper.SetDateTimeWithTimeZone(c.ExpiryDate.Value, tenantTimezone)
                : null,
            Status = c.Status,
            DaysUntilExpiry = c.DaysUntilExpiry
        }).ToList();

        return new CourierCompliancePaginatedResponse
        {
            Items = convertedCompliance,
            Total = totalCount,
            Page = page,
            Pages = totalPages,
            TotalExpired = totalExpired,
            TotalExpiringSoon = totalExpiringSoon,
            TotalValid = totalValid
        };
    }

    private static string GetComplianceStatus(DateTime now, DateTime? expiryDate)
    {
        if (!expiryDate.HasValue) return "Not Set";
        if (now >= expiryDate.Value) return "Expired";
        var daysUntilExpiry = (expiryDate.Value - now).TotalDays;
        return daysUntilExpiry <= 30 ? "Expiring Soon" : "Valid";
    }

    private static string CalculateDaysUntilExpiry(DateTime now, DateTime? expiryDate)
    {
        if (!expiryDate.HasValue) return "N/A";
        var days = (int)Math.Ceiling((expiryDate.Value - now).TotalDays);
        return days < 0 ? $"{Math.Abs(days)} days overdue" : $"{days} days";
    }

    public async Task<CourierAfterHoursPaginatedResponse> GetAfterHoursCourierScheduleAsync(
        CourierAfterHoursFilterRequest request)
    {
        var now = clock.TenantNow;
        var tenantTimezone = infoService.GetTenantTimeZone();

        // Ensure valid page and pageSize
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Max(1, Math.Min(100, request.PageSize));

        var query = Context.TblAfterhoursCouriers
            .Where(c => c.Courier != null)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.SearchTerm))
        {
            var searchPattern = $"%{request.SearchTerm}%";

            query = query.Where(c =>
                EF.Functions.Like(c.Courier.UccrName, searchPattern) ||
                EF.Functions.Like(c.Courier.Code, searchPattern) ||
                EF.Functions.Like(c.Courier.UccrSurname, searchPattern) ||
                EF.Functions.Like(c.Courier.VehiclePlateNnumber, searchPattern) ||
                EF.Functions.Like(c.Courier.UccrMobile, searchPattern) ||
                EF.Functions.Like(c.Courier.PersonalMobile, searchPattern) ||
                EF.Functions.Like(c.Courier.UccrEmail, searchPattern) ||
                EF.Functions.Like(c.Courier.UccrVehicleModel, searchPattern)
            );
        }

        // Filter by day
        if (!string.IsNullOrWhiteSpace(request.Day)
            && !request.Day.Equals("all", StringComparison.CurrentCultureIgnoreCase))
        {
            var dayValue = GetDayOfWeekAsInt(request.Day);
            if (dayValue != 0) query = query.Where(c => c.WeekDay == dayValue);
        }

        var totalActiveDrivers = await query
            .Where(c => c.Courier != null &&
                        c.Courier.CourierLogInOut != null &&
                        (c.Courier.CourierLogInOut.LogOutTime == null || c.Courier.CourierLogInOut.LogOutTime > now))
            .Select(c => c.CourierId)
            .Distinct()
            .CountAsync();

        // Group by courier and time schedule
        var groupedQuery = query
            .GroupBy(c => new
            {
                c.CourierId,
                CourierName = c.Courier.UccrName + " " + c.Courier.UccrSurname,
                c.Courier.Code,
                c.StartTime,
                c.EndTime
            })
            .Select(g => new
            {
                g.Key.CourierId,
                g.Key.CourierName,
                CourierCode = g.Key.Code,
                g.Key.StartTime,
                g.Key.EndTime,
                Days = g.Select(x => x.WeekDay).ToList(),
                AfterHoursScheduleIds = g.Select(x => x.Id).ToList()
            });

        var totalCount = await groupedQuery.CountAsync();

        groupedQuery = request.OrderBy?.ToLower() switch
        {
            "name" => request.SortDescending
                ? groupedQuery.OrderByDescending(c => c.CourierName)
                : groupedQuery.OrderBy(c => c.CourierName),
            "code" => request.SortDescending
                ? groupedQuery.OrderByDescending(c => c.CourierCode)
                : groupedQuery.OrderBy(c => c.CourierCode),
            "day" => request.SortDescending
                ? groupedQuery.OrderByDescending(c => c.Days.Min())
                : groupedQuery.OrderBy(c => c.Days.Min()),
            "startTime" => request.SortDescending
                ? groupedQuery.OrderByDescending(c => c.StartTime)
                : groupedQuery.OrderBy(c => c.StartTime),
            "endTime" => request.SortDescending
                ? groupedQuery.OrderByDescending(c => c.EndTime)
                : groupedQuery.OrderBy(c => c.EndTime),
            _ => request.SortDescending
                ? groupedQuery.OrderByDescending(c => c.StartTime)
                : groupedQuery.OrderBy(c => c.StartTime)
        };

        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        var afterHoursScheduleData = await groupedQuery
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var afterHoursSchedule = afterHoursScheduleData.Select(c => new AfterHoursCourierScheduleViewModel
        {
            AfterHoursScheduleId = c.AfterHoursScheduleIds.FirstOrDefault(),
            CourierId = c.CourierId,
            CourierName = c.CourierName,
            CourierCode = c.CourierCode,
            Days = c.Days.Select(DayOfWeekHelper.SqlIntToDayName)
                .OrderBy(day =>
                    Array.IndexOf(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], day))
                .ToList(),
            StartTime = TimeZoneHelper.SetDateTimeWithTimeZone(c.StartTime, tenantTimezone),
            EndTime = TimeZoneHelper.SetDateTimeWithTimeZone(c.EndTime, tenantTimezone),
            Duration = CalculateDuration(c.StartTime, c.EndTime)
        }).ToList();

        return new CourierAfterHoursPaginatedResponse
        {
            Items = afterHoursSchedule,
            Total = totalCount,
            Page = page,
            Pages = totalPages,
            TotalActiveDrivers = totalActiveDrivers
        };
    }

    private static string CalculateDuration(DateTime startTime, DateTime endTime)
    {
        // Extract only the time components
        var startTimeOnly = startTime.TimeOfDay;
        var endTimeOnly = endTime.TimeOfDay;

        // If end time is earlier than start time, assume it's the next day
        if (endTimeOnly < startTimeOnly) endTimeOnly = endTimeOnly.Add(TimeSpan.FromDays(1));

        var duration = endTimeOnly - startTimeOnly;
        return (int)duration.TotalHours + "h " + duration.Minutes + "m";
    }

    public async Task<TodayActiveDriversPaginatedResponse> GetTodayActiveDriversAsync(
        TodayActiveDriversFilterRequest request)
    {
        var now = clock.TenantNow;
        var today = clock.TenantToday;
        var tenantTimeZone = infoService.GetTenantTimeZone();

        var page = Math.Max(1, request.Page);
        var pageSize = Math.Max(1, Math.Min(100, request.PageSize));

        var query = Context.TucCouriers
            .Where(c => c.CourierLogInOut != null &&
                        c.CourierLogInOut.LogInTime.Date == today.Date);

        if (!string.IsNullOrWhiteSpace(request.SearchTerm))
        {
            var searchPattern = $"%{request.SearchTerm}%";
            query = query.Where(c =>
                EF.Functions.Like(c.Code, searchPattern) ||
                EF.Functions.Like(c.UccrName, searchPattern) ||
                EF.Functions.Like(c.UccrSurname, searchPattern) ||
                EF.Functions.Like(c.UccrMobile, searchPattern) ||
                EF.Functions.Like(c.PersonalMobile, searchPattern) ||
                EF.Functions.Like(c.VehiclePlateNnumber, searchPattern) ||
                EF.Functions.Like(c.UccrVehicleModel, searchPattern) ||
                EF.Functions.Like(c.UccrName + " " + c.UccrSurname, searchPattern)
            );
        }

        if (request.Fleet != 0)
            query = query.Where(c => c.CourierFleetId == request.Fleet);

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            query = request.Status.ToLower() switch
            {
                "active" => query.Where(c => c.CourierLogInOut.LogOutTime == null),
                "inactive" => query.Where(c => c.CourierLogInOut.LogOutTime != null),
                _ => query
            };
        }

        var totalCount = await query.CountAsync();

        if (totalCount == 0)
            return new TodayActiveDriversPaginatedResponse
            {
                Items = new List<TodayActiveDriversViewModel>(),
                Total = 0,
                Page = page,
                Pages = 0,
                TotalActiveDrivers = 0,
                TotalDriversActiveToday = 0,
                AverageSessionTime = 0.0
            };

        // Compute aggregates in SQL instead of materializing all rows
        var totalActiveDrivers = await query.CountAsync(c => c.CourierLogInOut.LogOutTime == null);

        // Average session time still needs in-memory computation due to COALESCE with runtime 'now'
        var sessionTimes = await query
            .Select(c => new
            {
                c.CourierLogInOut.LogInTime,
                c.CourierLogInOut.LogOutTime
            })
            .TagWith("GetTodayActiveDrivers - Step 1: Session Times for Average")
            .ToListAsync();
        var averageSessionTime = sessionTimes.Average(s => ((s.LogOutTime ?? now) - s.LogInTime).TotalMinutes);

        query = request.OrderBy?.ToLower() switch
        {
            "code" => request.SortDescending
                ? query.OrderByDescending(c => c.Code)
                : query.OrderBy(c => c.Code),
            "name" => request.SortDescending
                ? query.OrderByDescending(c => c.UccrName).ThenByDescending(c => c.UccrSurname)
                : query.OrderBy(c => c.UccrName).ThenBy(c => c.UccrSurname),
            "fleet" => request.SortDescending
                ? query.OrderByDescending(c => c.CourierFleet.UccfName)
                : query.OrderBy(c => c.CourierFleet.UccfName),
            "logintime" => request.SortDescending
                ? query.OrderByDescending(c => c.CourierLogInOut.LogInTime)
                : query.OrderBy(c => c.CourierLogInOut.LogInTime),
            "logouttime" => request.SortDescending
                ? query.OrderByDescending(c => c.CourierLogInOut.LogOutTime)
                : query.OrderBy(c => c.CourierLogInOut.LogOutTime),
            "status" => request.SortDescending
                ? query.OrderByDescending(c => c.CourierLogInOut.LogOutTime == null)
                : query.OrderBy(c => c.CourierLogInOut.LogOutTime == null),
            _ => request.SortDescending
                ? query.OrderByDescending(c => c.CourierLogInOut.LogInTime)
                : query.OrderBy(c => c.CourierLogInOut.LogInTime)
        };

        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        var couriers = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new
            {
                c.UccrId,
                c.Code,
                CourierName = c.UccrName + " " + c.UccrSurname,
                Fleet = c.CourierFleet != null ? c.CourierFleet.UccfName : "Not Available",
                c.CourierLogInOut.LogInTime,
                c.CourierLogInOut.LogOutTime,
                Status = c.CourierLogInOut.LogOutTime == null ? "Active" : "Inactive"
            })
            .TagWith("GetTodayActiveDrivers - Step 2: Paginated Courier Data")
            .ToListAsync();

        if (couriers.Count == 0)
            return new TodayActiveDriversPaginatedResponse
            {
                Items = new List<TodayActiveDriversViewModel>(),
                Total = totalCount,
                Page = page,
                Pages = totalPages,
                TotalActiveDrivers = totalActiveDrivers,
                TotalDriversActiveToday = totalActiveDrivers,
                AverageSessionTime = averageSessionTime
            };

        var courierIds = couriers.Select(c => c.UccrId).ToList();

        var deliveryCounts = await Context.TucJobs
            .Where(j => j.UcjbCourierId.HasValue &&
                        courierIds.Contains(j.UcjbCourierId.Value) &&
                        j.UcjbDate.Date == today.Date)
            .GroupBy(j => j.UcjbCourierId.Value)
            .Select(g => new { CourierId = g.Key, Count = g.Count() })
            .TagWith("GetTodayActiveDrivers - Step 3: Delivery Counts")
            .ToListAsync();

        var deliveryCountDict = deliveryCounts.ToDictionary(x => x.CourierId, x => x.Count);

        var courierViewModels = couriers.Select(c =>
        {
            var loginTime = TimeZoneHelper.SetDateTimeWithTimeZone(c.LogInTime, tenantTimeZone);
            var logoutTime = c.LogOutTime.HasValue
                ? TimeZoneHelper.SetDateTimeWithTimeZone(c.LogOutTime.Value, tenantTimeZone)
                : (DateTimeOffset?)null;

            return new TodayActiveDriversViewModel
            {
                CourierId = c.UccrId,
                Code = c.Code,
                Name = c.CourierName,
                Fleet = c.Fleet,
                LoginTime = loginTime,
                LogoutTime = logoutTime,
                Duration = CourierActiveDuration(c.LogInTime, c.LogOutTime ?? now),
                Deliveries = deliveryCountDict.GetValueOrDefault(c.UccrId, 0),
                Status = c.Status
            };
        }).ToList();

        return new TodayActiveDriversPaginatedResponse
        {
            Items = courierViewModels,
            Total = totalCount,
            Page = page,
            Pages = totalPages,
            TotalActiveDrivers = totalActiveDrivers,
            TotalDriversActiveToday = totalActiveDrivers,
            AverageSessionTime = averageSessionTime
        };
    }

    private static string CourierActiveDuration(DateTime loginTime, DateTime? logoutTime)
    {
        if (!logoutTime.HasValue) return "Currently Active";

        var duration = logoutTime.Value - loginTime;

        // If logout time is before login time, assume it's the next day
        if (duration.TotalMinutes < 0)
        {
            logoutTime = logoutTime.Value.AddDays(1);
            duration = logoutTime.Value - loginTime;
        }

        var hours = (int)duration.TotalHours;
        var minutes = duration.Minutes;

        return hours + "h " + minutes.ToString().PadLeft(2, '0') + "m";
    }

    public async Task<List<Suggestion>> GetAllFleetOptionsAsync()
    {
        var fleetOptions = await Context.TucCourierFleets
            .Select(f => new Suggestion
            {
                Id = f.UccfId,
                Text = f.UccfName
            })
            .OrderBy(f => f.Text)
            .ToListAsync();

        return fleetOptions;
    }

    public async Task<CourierDailyEarningsPaginatedResponse> GetCourierDailyEarningsAsync(PaginatedRequest request)
    {
        var now = clock.TenantNow;

        var page = Math.Max(1, request.Page);
        var pageSize = Math.Max(1, Math.Min(100, request.PageSize));

        var query = Context.TucCouriers
            .Where(c => c.CourierLogInOut != null &&
                        c.CourierLogInOut.LogInTime.Date == now.Date);

        if (!string.IsNullOrWhiteSpace(request.SearchTerm))
        {
            var searchPattern = $"%{request.SearchTerm}%";
            query = query.Where(c =>
                EF.Functions.Like(c.Code, searchPattern) ||
                EF.Functions.Like(c.UccrName, searchPattern) ||
                EF.Functions.Like(c.UccrSurname, searchPattern) ||
                EF.Functions.Like(c.UccrMobile, searchPattern) ||
                EF.Functions.Like(c.PersonalMobile, searchPattern) ||
                EF.Functions.Like(c.VehiclePlateNnumber, searchPattern) ||
                EF.Functions.Like(c.UccrVehicleModel, searchPattern) ||
                EF.Functions.Like(c.UccrName + " " + c.UccrSurname, searchPattern)
            );
        }

        var aggregates = await Context.TucJobs
            .Where(j => j.UcjbComplTime.HasValue &&
                        j.UcjbComplTime.Value.Date == now.Date)
            .GroupBy(j => 1)
            .Select(g => new
            {
                TotalDeliveries = g.Count(),
                TotalEarnings = g.Sum(j => j.CourierPayment) ?? 0
            })
            .TagWith("GetCourierDailyEarnings - Step 1: Global Aggregates")
            .FirstOrDefaultAsync();

        var totalDeliveriesToday = aggregates?.TotalDeliveries ?? 0;
        var totalEarningsToday = aggregates?.TotalEarnings ?? 0;

        var totalCount = await query.CountAsync();

        if (totalCount == 0)
        {
            return new CourierDailyEarningsPaginatedResponse
            {
                Items = new List<CourierDailyEarningsViewModel>(),
                Page = page,
                Pages = 0,
                Total = 0,
                TotalEarningsToday = totalEarningsToday,
                AverageHourlyRate = 0,
                TotalActiveDrivers = 0,
                TotalDeliveriesToday = totalDeliveriesToday
            };
        }

        query = request.OrderBy?.ToLower() switch
        {
            "name" => request.SortDescending
                ? query.OrderByDescending(c => c.UccrName).ThenByDescending(c => c.UccrSurname)
                : query.OrderBy(c => c.UccrName).ThenBy(c => c.UccrSurname),
            _ => query.OrderBy(c => c.UccrName).ThenBy(c => c.UccrSurname)
        };

        var couriers = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new
            {
                c.UccrId,
                CourierName = c.UccrName + " " + c.UccrSurname,
                c.CourierLogInOut.LogInTime,
                c.CourierLogInOut.LogOutTime
            })
            .TagWith("GetCourierDailyEarnings - Step 2: Paginated Courier Data")
            .ToListAsync();

        // Early return if pagination beyond data
        if (couriers.Count == 0)
            return new CourierDailyEarningsPaginatedResponse
            {
                Items = new List<CourierDailyEarningsViewModel>(),
                Page = page,
                Pages = (int)Math.Ceiling(totalCount / (double)pageSize),
                Total = totalCount,
                TotalEarningsToday = totalEarningsToday,
                AverageHourlyRate = 0,
                TotalActiveDrivers = totalCount,
                TotalDeliveriesToday = totalDeliveriesToday
            };

        var courierIds = couriers.Select(c => c.UccrId).ToList();

        // Get all courier data for hourly rate calculation (single query instead of 3)
        var allCouriersForAverage = await query
            .Select(c => new
            {
                c.UccrId,
                c.CourierLogInOut.LogInTime,
                c.CourierLogInOut.LogOutTime
            })
            .TagWith("GetCourierDailyEarnings - Step 3: All Couriers for Average")
            .ToListAsync();

        var allCourierIds = allCouriersForAverage.Select(c => c.UccrId).ToList();

        // Run earnings queries in parallel using separate contexts
        await using var earningsContext = CreateNewContext();
        await using var allEarningsContext = CreateNewContext();

        var earningsTask = earningsContext.TucJobs
            .Where(j => j.UcjbCourierId.HasValue &&
                        courierIds.Contains(j.UcjbCourierId.Value) &&
                        j.UcjbDate.Date == now.Date)
            .GroupBy(j => j.UcjbCourierId.Value)
            .Select(g => new
            {
                CourierId = g.Key,
                Deliveries = g.Count(),
                Earnings = g.Sum(j => j.CourierPayment) ?? 0
            })
            .TagWith("GetCourierDailyEarnings - Step 4a: Paginated Earnings Data")
            .ToListAsync();

        var allEarningsTask = allEarningsContext.TucJobs
            .Where(j => j.UcjbCourierId.HasValue &&
                        allCourierIds.Contains(j.UcjbCourierId.Value) &&
                        j.UcjbDate.Date == now.Date)
            .GroupBy(j => j.UcjbCourierId.Value)
            .Select(g => new
            {
                CourierId = g.Key,
                TotalEarnings = g.Sum(j => j.CourierPayment) ?? 0
            })
            .TagWith("GetCourierDailyEarnings - Step 4b: All Earnings for Average (today)")
            .ToListAsync();

        await Task.WhenAll(earningsTask, allEarningsTask);

        var earningsData = await earningsTask;
        var allEarningsForAverage = await allEarningsTask;

        var earningsDict = earningsData.ToDictionary(x => x.CourierId);
        var allEarningsDict = allEarningsForAverage.ToDictionary(x => x.CourierId, x => x.TotalEarnings);

        // Calculate hourly rates in memory using cached courier data
        var hourlyRates = new List<decimal>();
        foreach (var courier in allCouriersForAverage)
        {
            var hoursLogged = ((courier.LogOutTime ?? now) - courier.LogInTime).TotalMinutes;
            if (hoursLogged > 0 && allEarningsDict.TryGetValue(courier.UccrId, out var earnings)) hourlyRates.Add(earnings / (decimal)(hoursLogged / 60.0));
        }

        var averageHourlyRate = hourlyRates.Count > 0 ? hourlyRates.Average() : 0;

        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        var courierDailyEarnings = couriers.Select(c =>
        {
            var hoursLogged = (int)((c.LogOutTime ?? now) - c.LogInTime).TotalMinutes;
            var hasEarnings = earningsDict.TryGetValue(c.UccrId, out var earnings);
            var deliveries = hasEarnings ? earnings.Deliveries : 0;
            var totalEarnings = hasEarnings ? earnings.Earnings : 0;

            var hourlyRate = hoursLogged > 0 && totalEarnings > 0
                ? totalEarnings / (hoursLogged / 60.0m)
                : 0;

            return new CourierDailyEarningsViewModel
            {
                CourierId = c.UccrId,
                Name = c.CourierName,
                HoursLogged = hoursLogged,
                Deliveries = deliveries,
                Earnings = totalEarnings,
                HourlyRate = hourlyRate
            };
        }).ToList();

        courierDailyEarnings = request.OrderBy?.ToLower() switch
        {
            "hourslogged" => request.SortDescending
                ? courierDailyEarnings.OrderByDescending(x => x.HoursLogged).ToList()
                : courierDailyEarnings.OrderBy(x => x.HoursLogged).ToList(),
            "deliveries" => request.SortDescending
                ? courierDailyEarnings.OrderByDescending(x => x.Deliveries).ToList()
                : courierDailyEarnings.OrderBy(x => x.Deliveries).ToList(),
            "earnings" => request.SortDescending
                ? courierDailyEarnings.OrderByDescending(x => x.Earnings).ToList()
                : courierDailyEarnings.OrderBy(x => x.Earnings).ToList(),
            "hourlyrate" => request.SortDescending
                ? courierDailyEarnings.OrderByDescending(x => x.HourlyRate).ToList()
                : courierDailyEarnings.OrderBy(x => x.HourlyRate).ToList(),
            _ => courierDailyEarnings
        };

        return new CourierDailyEarningsPaginatedResponse
        {
            Items = courierDailyEarnings,
            Page = page,
            Pages = totalPages,
            Total = totalCount,
            TotalEarningsToday = totalEarningsToday,
            AverageHourlyRate = averageHourlyRate,
            TotalActiveDrivers = totalCount,
            TotalDeliveriesToday = totalDeliveriesToday
        };
    }

    public async Task<PaginatedResponse<CourierEmailViewModel>> GetCourierEmailsAsync(PaginatedRequest request)
    {
        // Ensure valid page and pageSize
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Max(1, Math.Min(100, request.PageSize));

        var query = Context.TucCouriers
            .Where(c => c.UccrEmail != null);

        if (!string.IsNullOrWhiteSpace(request.SearchTerm))
        {
            var searchPattern = $"%{request.SearchTerm}%";

            query = query.Where(c =>
                EF.Functions.Like(c.Code, searchPattern) ||
                EF.Functions.Like(c.UccrName, searchPattern) ||
                EF.Functions.Like(c.UccrSurname, searchPattern) ||
                EF.Functions.Like(c.UccrMobile, searchPattern) ||
                EF.Functions.Like(c.PersonalMobile, searchPattern) ||
                EF.Functions.Like(c.VehiclePlateNnumber, searchPattern) ||
                EF.Functions.Like(c.UccrVehicleModel, searchPattern) ||
                EF.Functions.Like(c.UccrName + " " + c.UccrSurname, searchPattern)
            );
        }

        var totalCount = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        query = request.OrderBy?.ToLower() switch
        {
            "code" => request.SortDescending
                ? query.OrderByDescending(c => c.Code)
                : query.OrderBy(c => c.Code),
            "email" => request.SortDescending
                ? query.OrderByDescending(c => c.UccrEmail)
                : query.OrderBy(c => c.UccrEmail),
            "phone" => request.SortDescending
                ? query.OrderByDescending(c => c.UccrMobile)
                : query.OrderBy(c => c.UccrMobile),
            "fleet" => request.SortDescending
                ? query.OrderByDescending(c => c.CourierFleet.UccfName)
                : query.OrderBy(c => c.CourierFleet.UccfName),
            _ => request.SortDescending
                ? query.OrderByDescending(c => c.UccrName).ThenByDescending(c => c.UccrSurname)
                : query.OrderBy(c => c.UccrName).ThenBy(c => c.UccrSurname)
        };

        var courierEmails = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new CourierEmailViewModel
            {
                CourierId = c.UccrId,
                Code = c.Code,
                Name = c.UccrName + " " + c.UccrSurname,
                Email = c.UccrEmail,
                Phone = c.UccrMobile,
                Fleet = c.CourierFleet != null ? c.CourierFleet.UccfName : "Not Available"
            })
            .ToListAsync();


        return new PaginatedResponse<CourierEmailViewModel>
        {
            Items = courierEmails,
            Page = page,
            Pages = totalPages,
            Total = totalCount
        };
    }

    public async Task SendEmailToCouriersAsync(GroupEmailDataViewModel request)
    {
        var emailsToSendTo = await Context.TucCouriers
            .Where(c => request.CourierIds.Contains(c.UccrId))
            .Select(c => c.UccrEmail)
            .ToListAsync();

        var manualMessages = emailsToSendTo.Select(email =>
                new TucManualMessage
                {
                    SendToEmailAddress = email,
                    ReplyToEmailAddress = Environment.GetEnvironmentVariable("ReplyToEmailAddress") ??
                                          "support@deliverdifferent.com",
                    Subject = request.Subject,
                    UcmmMessage = request.Body
                })
            .ToList();

        await Context.TucManualMessages.AddRangeAsync(manualMessages);
        await Context.SaveChangesAsync();
    }

    private static int GetDayOfWeekAsInt(string dayOfWeek) => DayOfWeekHelper.DayNameToSqlInt(dayOfWeek);

    public async Task UpdateAfterHoursCourierScheduleAsync(AfterHoursCourierScheduleViewModel request)
    {
        try
        {
            if (!request.StartTime.HasValue) throw new ArgumentNullException(nameof(request), "StartTime is required");
            if (!request.EndTime.HasValue) throw new ArgumentNullException(nameof(request), "EndTime is required");

            // Delete the original schedule group in a single query
            await Context.TblAfterhoursCouriers
                .Where(s => Context.TblAfterhoursCouriers
                    .Where(c => c.Id == request.AfterHoursScheduleId)
                    .Any(c => c.CourierId == s.CourierId &&
                              c.StartTime == s.StartTime &&
                              c.EndTime == s.EndTime))
                .ExecuteDeleteAsync();

            // Create new schedules with the updated data (new days, new times)
            var schedules = request.Days.Select(GetDayOfWeekAsInt).Select(dayOfWeek => new TblAfterhoursCourier
            {
                CourierId = request.CourierId,
                WeekDay = dayOfWeek,
                StartTime = request.StartTime.Value.DateTime,
                EndTime = request.EndTime.Value.DateTime
            }).ToList();

            await Context.TblAfterhoursCouriers.AddRangeAsync(schedules);
            await Context.SaveChangesAsync();
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(CourierRepository),
                    nameof(UpdateAfterHoursCourierScheduleAsync)));
            throw;
        }
    }

    public async Task CreateAfterHoursCourierScheduleAsync(AfterHoursCourierScheduleViewModel request)
    {
        try
        {
            if (!request.StartTime.HasValue) throw new ArgumentNullException(nameof(request), "StartTime is required");
            if (!request.EndTime.HasValue) throw new ArgumentNullException(nameof(request), "EndTime is required");

            // Add records for each day in batch
            var schedules = request.Days.Select(GetDayOfWeekAsInt).Select(dayOfWeek => new TblAfterhoursCourier
            {
                CourierId = request.CourierId,
                WeekDay = dayOfWeek,
                StartTime = request.StartTime.Value.DateTime,
                EndTime = request.EndTime.Value.DateTime
            }).ToList();

            await Context.TblAfterhoursCouriers.AddRangeAsync(schedules);
            await Context.SaveChangesAsync();
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(CourierRepository),
                    nameof(CreateAfterHoursCourierScheduleAsync)));
            throw;
        }
    }

    public async Task DeleteAfterHoursCourierScheduleAsync(int afterHoursScheduleId)
    {
        try
        {
            await Context.TblAfterhoursCouriers
                .Where(s => Context.TblAfterhoursCouriers
                    .Where(c => c.Id == afterHoursScheduleId)
                    .Any(c => c.CourierId == s.CourierId &&
                              c.StartTime == s.StartTime &&
                              c.EndTime == s.EndTime))
                .ExecuteDeleteAsync();
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(CourierRepository),
                    nameof(DeleteAfterHoursCourierScheduleAsync)));
            throw;
        }
    }

    public async Task<Suggestion> GetExactCourierByCodeAsync(string courierCode)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(courierCode);

            return await Context.TucCouriers
                .Where(c => c.Code == courierCode && c.Active)
                .Select(c => new Suggestion
                {
                    Id = c.UccrId,
                    Text = c.Code + ": " + c.UccrName + " " + c.UccrSurname
                })
                .FirstOrDefaultAsync();
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(CourierRepository),
                    nameof(GetExactCourierByCodeAsync)));
            throw;
        }
    }

    public async Task<List<DriverWorkOverviewViewModel>> GetDriverWorkOverviewAsync()
    {
        var now = clock.TenantNow;

        var drivers = await Context.TucCouriers
            .Where(c => c.Active)
            .Select(c => new
            {
                c.UccrId,
                CourierName = c.UccrName + " " + c.UccrSurname,
                c.UccrVehicle,
                DriverStatusText = c.CourierLogInOut != null && c.CourierLogInOut.LogOutTime == null
                    ? "Active"
                    : "Inactive"
            })
            .TagWith("GetDriverWorkOverview - Step 1: Active Drivers")
            .ToListAsync();

        if (drivers.Count == 0) return [];

        var driverIds = drivers.Select(d => d.UccrId).ToList();

        var jobCounts = await Context.TucJobs
            .Where(j => j.UcjbCourierId.HasValue &&
                        driverIds.Contains(j.UcjbCourierId.Value) &&
                        !j.UcjbJobDone &&
                        !j.UcjbVoid &&
                        j.UcjbStatus != (int)JobStatus.Void &&
                        j.UcjbStatus != (int)JobStatus.Completed &&
                        j.UcjbDate.Date <= now.Date)
            .GroupBy(j => j.UcjbCourierId.Value)
            .Select(g => new { CourierId = g.Key, Count = g.Count() })
            .TagWith("GetDriverWorkOverview - Step 2: Job Counts")
            .ToListAsync();

        var jobCountDict = jobCounts.ToDictionary(x => x.CourierId, x => x.Count);

        return drivers
            .Select(d => new DriverWorkOverviewViewModel
            {
                CourierId = d.UccrId,
                Name = d.CourierName,
                VehicleType = MapVehicleTypeToAbbreviation(d.UccrVehicle) ?? "No Vehicle",
                JobCount = jobCountDict.GetValueOrDefault(d.UccrId, 0),
                DriverStatusText = d.DriverStatusText
            })
            .ToList();
    }

    public async Task ResetClearListAreaOrderAsync(int courierId)
    {
        var tenantTime = clock.TenantNow;

        // Count jobs for the courier that are not void and not done
        var jobCount = await Context.TucJobs
            .Where(j =>
                j.UcjbVoid == false &&
                j.UcjbJobDone == false &&
                j.UcjbCourierId == courierId)
            .CountAsync();

        switch (jobCount)
        {
            case 0:
                // Update clear list area order - set status to 3 and format OrderTime
                await Context.TblClearListAreaOrders
                    .Where(c => c.CourierId == courierId)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(c => c.Status, 3)
                        .SetProperty(c => c.OrderTime, tenantTime));
                break;
            case > 0:
            {
                // Check if jobs are only status 5 (picked up) or 8 (late delivery)
                var jobsNotPickedUpOrLate = await Context.TucJobs
                    .Where(j =>
                        j.UcjbVoid == false &&
                        j.UcjbJobDone == false &&
                        j.UcjbCourierId == courierId &&
                        j.UcjbStatus != (int)JobStatus.PickedUp &&
                        j.UcjbStatus != (int)JobStatus.LateDelivery)
                    .CountAsync();

                if (jobsNotPickedUpOrLate == 0)
                {
                    // All jobs are only picked up or late delivery
                    await Context.TblClearListAreaOrders
                        .Where(c => c.CourierId == courierId)
                        .ExecuteUpdateAsync(setters => setters
                            .SetProperty(c => c.Status, 5)
                            .SetProperty(c => c.OrderTime, tenantTime));
                }

                break;
            }
        }
    }

    public async Task<List<Suggestion>> GetVehicleSizesAsync() => await Context.GetAllVehicleSizesAsync();

    public async Task<List<Suggestion>> GetAllRegionsAsync() => await Context.GetAllRegionsAsync();

    public async Task<List<Suggestion>> GetAllSpeedsAsync() => await Context.GetAllSpeedsAsync();


    /// <summary>
    /// Maps full vehicle type names to single character abbreviations
    /// Based on DESWEB_stpMapEnvelope stored procedure logic
    /// </summary>
    private static string MapVehicleTypeToAbbreviation(string vehicleType)
    {
        if (string.IsNullOrEmpty(vehicleType))
            return null;

        return vehicleType switch
        {
            "Hatchback" or "Sedan" => "C",
            "MotorBike" => "M",
            "Pushbike" => "B",
            "Station Wagon" => "W",
            "StationWagon" => "W",
            "Truck" => "T",
            "Utility" or "Van" => "V",
            _ => vehicleType // Return original if no match
        };
    }

    #region Driver Management Export Methods

    private const int MaxExportRows = 10_000;

    public async Task<List<TodayActiveDriversViewModel>> GetTodayActiveDriversForExportAsync(
        TodayActiveDriversFilterRequest request)
    {
        var now = clock.TenantNow;
        var today = clock.TenantToday;
        var tenantTimeZone = infoService.GetTenantTimeZone();

        var query = Context.TucCouriers
            .Where(c => c.CourierLogInOut != null &&
                        c.CourierLogInOut.LogInTime.Date == today.Date);

        if (!string.IsNullOrWhiteSpace(request.SearchTerm))
        {
            var searchPattern = $"%{request.SearchTerm}%";
            query = query.Where(c =>
                EF.Functions.Like(c.Code, searchPattern) ||
                EF.Functions.Like(c.UccrName, searchPattern) ||
                EF.Functions.Like(c.UccrSurname, searchPattern) ||
                EF.Functions.Like(c.UccrMobile, searchPattern) ||
                EF.Functions.Like(c.PersonalMobile, searchPattern) ||
                EF.Functions.Like(c.VehiclePlateNnumber, searchPattern) ||
                EF.Functions.Like(c.UccrVehicleModel, searchPattern) ||
                EF.Functions.Like(c.UccrName + " " + c.UccrSurname, searchPattern)
            );
        }

        if (request.Fleet != 0)
            query = query.Where(c => c.CourierFleetId == request.Fleet);

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            query = request.Status.ToLower() switch
            {
                "active" => query.Where(c => c.CourierLogInOut.LogOutTime == null),
                "inactive" => query.Where(c => c.CourierLogInOut.LogOutTime != null),
                _ => query
            };
        }

        var couriers = await query
            .OrderBy(c => c.UccrName).ThenBy(c => c.UccrSurname)
            .Take(MaxExportRows)
            .Select(c => new
            {
                c.UccrId,
                c.Code,
                CourierName = c.UccrName + " " + c.UccrSurname,
                Fleet = c.CourierFleet != null ? c.CourierFleet.UccfName : "Not Available",
                c.CourierLogInOut.LogInTime,
                c.CourierLogInOut.LogOutTime,
                Status = c.CourierLogInOut.LogOutTime == null ? "Active" : "Inactive"
            })
            .TagWith("GetTodayActiveDriversForExport")
            .ToListAsync();

        if (couriers.Count == 0) return [];

        var courierIds = couriers.Select(c => c.UccrId).ToList();

        var deliveryCounts = await Context.TucJobs
            .Where(j => j.UcjbCourierId.HasValue &&
                        courierIds.Contains(j.UcjbCourierId.Value) &&
                        j.UcjbDate.Date == today.Date)
            .GroupBy(j => j.UcjbCourierId.Value)
            .Select(g => new { CourierId = g.Key, Count = g.Count() })
            .ToListAsync();

        var deliveryCountDict = deliveryCounts.ToDictionary(x => x.CourierId, x => x.Count);

        return couriers.Select(c => new TodayActiveDriversViewModel
        {
            CourierId = c.UccrId,
            Code = c.Code,
            Name = c.CourierName,
            Fleet = c.Fleet,
            LoginTime = TimeZoneHelper.SetDateTimeWithTimeZone(c.LogInTime, tenantTimeZone),
            LogoutTime = c.LogOutTime.HasValue
                ? TimeZoneHelper.SetDateTimeWithTimeZone(c.LogOutTime.Value, tenantTimeZone)
                : null,
            Duration = CourierActiveDuration(c.LogInTime, c.LogOutTime ?? now),
            Deliveries = deliveryCountDict.GetValueOrDefault(c.UccrId, 0),
            Status = c.Status
        }).ToList();
    }

    public async Task<List<CourierComplianceViewModel>> GetCourierComplianceForExportAsync(
        CourierComplianceFilterRequest request)
    {
        var now = clock.TenantNow;
        var tenantTimezone = infoService.GetTenantTimeZone();
        var expiringThreshold = now.AddDays(30);

        var query = Context.TucCouriers.AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.SearchTerm))
        {
            var searchPattern = $"%{request.SearchTerm}%";
            query = query.Where(c =>
                EF.Functions.Like(c.Code, searchPattern) ||
                EF.Functions.Like(c.UccrName, searchPattern) ||
                EF.Functions.Like(c.UccrSurname, searchPattern) ||
                EF.Functions.Like(c.UccrMobile, searchPattern) ||
                EF.Functions.Like(c.PersonalMobile, searchPattern) ||
                EF.Functions.Like(c.VehiclePlateNnumber, searchPattern) ||
                EF.Functions.Like(c.UccrVehicleModel, searchPattern) ||
                EF.Functions.Like(c.UccrName + " " + c.UccrSurname, searchPattern)
            );
        }

        if (request.Fleet != 0)
            query = query.Where(c => c.CourierFleetId == request.Fleet);

        if (!string.IsNullOrWhiteSpace(request.Type))
        {
            query = request.Type.ToLower() switch
            {
                "drivers_license" => query.Where(c => c.DriversLicenseExpiry.HasValue),
                "dg_endorsement" => query.Where(c => c.UccrDangerousGoods == 1 && c.DglicenseExpiry.HasValue),
                _ => query
            };
        }

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            query = request.Status.ToLower() switch
            {
                "expired" => query.Where(c => c.DriversLicenseExpiry.HasValue && c.DriversLicenseExpiry.Value < now),
                "expiring" => query.Where(c =>
                    c.DriversLicenseExpiry.HasValue && c.DriversLicenseExpiry.Value >= now &&
                    c.DriversLicenseExpiry.Value <= expiringThreshold),
                "valid" => query.Where(c =>
                    !c.DriversLicenseExpiry.HasValue || c.DriversLicenseExpiry.Value > expiringThreshold),
                _ => query
            };
        }

        var items = await query
            .OrderBy(c => c.Code)
            .Take(MaxExportRows)
            .Select(c => new CourierComplianceViewModel
            {
                Code = c.Code,
                Name = c.UccrName + " " + c.UccrSurname,
                ComplianceType = c.UccrDangerousGoods == 1 ? "Dangerous Goods" : "Driver's License",
                ItemNumber = c.UccrDangerousGoods == 1 ? "DG-" + c.Code : "DL-" + c.Code,
                ExpiryDate = c.UccrDangerousGoods == 1 ? c.DglicenseExpiry : c.DriversLicenseExpiry,
                Status = GetComplianceStatus(now,
                    c.UccrDangerousGoods == 1 ? c.DglicenseExpiry : c.DriversLicenseExpiry),
                DaysUntilExpiry = CalculateDaysUntilExpiry(now,
                    c.UccrDangerousGoods == 1 ? c.DglicenseExpiry : c.DriversLicenseExpiry)
            })
            .TagWith("GetCourierComplianceForExport")
            .ToListAsync();

        return items.Select(c => new CourierComplianceViewModel
        {
            Code = c.Code,
            Name = c.Name,
            ComplianceType = c.ComplianceType,
            ItemNumber = c.ItemNumber,
            ExpiryDate = c.ExpiryDate.HasValue
                ? TimeZoneHelper.SetDateTimeWithTimeZone(c.ExpiryDate.Value, tenantTimezone)
                : null,
            Status = c.Status,
            DaysUntilExpiry = c.DaysUntilExpiry
        }).ToList();
    }

    public async Task<List<AfterHoursCourierScheduleViewModel>> GetAfterHoursScheduleForExportAsync(
        CourierAfterHoursFilterRequest request)
    {
        var tenantTimezone = infoService.GetTenantTimeZone();

        var query = Context.TblAfterhoursCouriers
            .Where(c => c.Courier != null)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.SearchTerm))
        {
            var searchPattern = $"%{request.SearchTerm}%";
            query = query.Where(c =>
                EF.Functions.Like(c.Courier.UccrName, searchPattern) ||
                EF.Functions.Like(c.Courier.Code, searchPattern) ||
                EF.Functions.Like(c.Courier.UccrSurname, searchPattern) ||
                EF.Functions.Like(c.Courier.VehiclePlateNnumber, searchPattern) ||
                EF.Functions.Like(c.Courier.UccrMobile, searchPattern) ||
                EF.Functions.Like(c.Courier.PersonalMobile, searchPattern) ||
                EF.Functions.Like(c.Courier.UccrEmail, searchPattern) ||
                EF.Functions.Like(c.Courier.UccrVehicleModel, searchPattern)
            );
        }

        if (!string.IsNullOrWhiteSpace(request.Day)
            && !request.Day.Equals("all", StringComparison.CurrentCultureIgnoreCase))
        {
            var dayValue = GetDayOfWeekAsInt(request.Day);
            if (dayValue != 0) query = query.Where(c => c.WeekDay == dayValue);
        }

        var groupedData = await query
            .GroupBy(c => new
            {
                c.CourierId,
                CourierName = c.Courier.UccrName + " " + c.Courier.UccrSurname,
                c.Courier.Code,
                c.StartTime,
                c.EndTime
            })
            .Select(g => new
            {
                g.Key.CourierId,
                g.Key.CourierName,
                CourierCode = g.Key.Code,
                g.Key.StartTime,
                g.Key.EndTime,
                Days = g.Select(x => x.WeekDay).ToList(),
                AfterHoursScheduleIds = g.Select(x => x.Id).ToList()
            })
            .OrderBy(c => c.CourierName)
            .TagWith("GetAfterHoursScheduleForExport")
            .ToListAsync();

        return groupedData.Select(c => new AfterHoursCourierScheduleViewModel
        {
            AfterHoursScheduleId = c.AfterHoursScheduleIds.FirstOrDefault(),
            CourierId = c.CourierId,
            CourierName = c.CourierName,
            CourierCode = c.CourierCode,
            Days = c.Days.Select(DayOfWeekHelper.SqlIntToDayName)
                .OrderBy(day =>
                    Array.IndexOf(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], day))
                .ToList(),
            StartTime = TimeZoneHelper.SetDateTimeWithTimeZone(c.StartTime, tenantTimezone),
            EndTime = TimeZoneHelper.SetDateTimeWithTimeZone(c.EndTime, tenantTimezone),
            Duration = CalculateDuration(c.StartTime, c.EndTime)
        }).ToList();
    }

    public async Task<List<CourierEmailViewModel>> GetCourierEmailsForExportAsync(PaginatedRequest request)
    {
        var query = Context.TucCouriers
            .Where(c => c.UccrEmail != null);

        if (!string.IsNullOrWhiteSpace(request.SearchTerm))
        {
            var searchPattern = $"%{request.SearchTerm}%";
            query = query.Where(c =>
                EF.Functions.Like(c.Code, searchPattern) ||
                EF.Functions.Like(c.UccrName, searchPattern) ||
                EF.Functions.Like(c.UccrSurname, searchPattern) ||
                EF.Functions.Like(c.UccrMobile, searchPattern) ||
                EF.Functions.Like(c.PersonalMobile, searchPattern) ||
                EF.Functions.Like(c.VehiclePlateNnumber, searchPattern) ||
                EF.Functions.Like(c.UccrVehicleModel, searchPattern) ||
                EF.Functions.Like(c.UccrName + " " + c.UccrSurname, searchPattern)
            );
        }

        return await query
            .OrderBy(c => c.UccrName)
            .ThenBy(c => c.UccrSurname)
            .Take(MaxExportRows)
            .Select(c => new CourierEmailViewModel
            {
                CourierId = c.UccrId,
                Code = c.Code,
                Name = c.UccrName + " " + c.UccrSurname,
                Email = c.UccrEmail,
                Phone = c.UccrMobile,
                Fleet = c.CourierFleet != null ? c.CourierFleet.UccfName : "Not Available"
            })
            .TagWith("GetCourierEmailsForExport")
            .ToListAsync();
    }

    public async Task<List<CourierDailyEarningsViewModel>> GetCourierDailyEarningsForExportAsync(
        PaginatedRequest request)
    {
        var now = clock.TenantNow;

        var query = Context.TucCouriers
            .Where(c => c.CourierLogInOut != null &&
                        c.CourierLogInOut.LogInTime.Date == now.Date);

        if (!string.IsNullOrWhiteSpace(request.SearchTerm))
        {
            var searchPattern = $"%{request.SearchTerm}%";
            query = query.Where(c =>
                EF.Functions.Like(c.Code, searchPattern) ||
                EF.Functions.Like(c.UccrName, searchPattern) ||
                EF.Functions.Like(c.UccrSurname, searchPattern) ||
                EF.Functions.Like(c.UccrMobile, searchPattern) ||
                EF.Functions.Like(c.PersonalMobile, searchPattern) ||
                EF.Functions.Like(c.VehiclePlateNnumber, searchPattern) ||
                EF.Functions.Like(c.UccrVehicleModel, searchPattern) ||
                EF.Functions.Like(c.UccrName + " " + c.UccrSurname, searchPattern)
            );
        }

        var couriers = await query
            .OrderBy(c => c.UccrName).ThenBy(c => c.UccrSurname)
            .Take(MaxExportRows)
            .Select(c => new
            {
                c.UccrId,
                CourierName = c.UccrName + " " + c.UccrSurname,
                c.CourierLogInOut.LogInTime,
                c.CourierLogInOut.LogOutTime
            })
            .TagWith("GetCourierDailyEarningsForExport")
            .ToListAsync();

        if (couriers.Count == 0) return [];

        var courierIds = couriers.Select(c => c.UccrId).ToList();

        var earningsData = await Context.TucJobs
            .Where(j => j.UcjbCourierId.HasValue &&
                        courierIds.Contains(j.UcjbCourierId.Value) &&
                        j.UcjbDate.Date == now.Date)
            .GroupBy(j => j.UcjbCourierId.Value)
            .Select(g => new
            {
                CourierId = g.Key,
                Deliveries = g.Count(),
                Earnings = g.Sum(j => j.CourierPayment) ?? 0
            })
            .ToListAsync();

        var earningsDict = earningsData.ToDictionary(x => x.CourierId);

        return couriers.Select(c =>
        {
            var hoursLogged = (int)((c.LogOutTime ?? now) - c.LogInTime).TotalMinutes;
            var hasEarnings = earningsDict.TryGetValue(c.UccrId, out var earnings);
            var deliveries = hasEarnings ? earnings.Deliveries : 0;
            var totalEarnings = hasEarnings ? earnings.Earnings : 0;

            var hourlyRate = hoursLogged > 0 && totalEarnings > 0
                ? totalEarnings / (hoursLogged / 60.0m)
                : 0;

            return new CourierDailyEarningsViewModel
            {
                CourierId = c.UccrId,
                Name = c.CourierName,
                HoursLogged = hoursLogged,
                Deliveries = deliveries,
                Earnings = totalEarnings,
                HourlyRate = hourlyRate
            };
        }).ToList();
    }

    #endregion
}