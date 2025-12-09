using System;
using System.Collections.Generic;
using System.Data.Common;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
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

namespace DespatchWeb.Repositories;

public class CourierRepository(
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantInfoService infoService,
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
        var now = infoService.GetCurrentTenantTime();
        var courier = await Context.GetCourierByIdAsync(courierId, now);
        return courier;
    }

    public async Task<TruckCourierStatusViewModel> TruckCourierStatusAsync(int courierId)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(courierId);
            const string truckVehicleName = "Truck";

            var courierData = await Context.TucCouriers
                .AsNoTracking()
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
            {
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
            }

            var jobItemsAggregate = await Context.TucJobs
                .AsNoTracking() // Article tip #2
                .Where(j => j.UcjbCourierId == courierId && // Filter early
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
            var currentDate = infoService.GetCurrentTenantTime();

            var courierData = await Context.TucCouriers
                .AsNoTracking()
                .Where(c => c.CourierFleetId != (int)CourierFleet.ClientDriver &&
                            c.CourierGps != null &&
                            c.CourierGps.Longitude >= data.MinLng &&
                            c.CourierGps.Longitude <= data.MaxLng &&
                            c.CourierGps.Latitude >= data.MinLat &&
                            c.CourierGps.Latitude <= data.MaxLat &&
                            c.CourierLogInOut != null &&
                            c.CourierLogInOut.LogOutTime == null)
                .Select(c => new
                {
                    c.UccrId,
                    c.UccrName,
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
                .AsNoTracking()
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
                    CourierName = c.UccrName,
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
            var now = infoService.GetCurrentTenantTime();

            var courierData = await Context.TucCouriers
                .AsNoTracking()
                .Where(c => c.CourierLogInOut != null &&
                            c.CourierLogInOut.LogOutTime == null &&
                            c.CourierGps != null &&
                            c.CourierGps.Longitude >= data.MinLng &&
                            c.CourierGps.Longitude <= data.MaxLng &&
                            c.CourierGps.Latitude >= data.MinLat &&
                            c.CourierGps.Latitude <= data.MaxLat)
                .Select(c => new
                {
                    c.UccrId,
                    c.UccrName,
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
                .AsNoTracking()
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
                    CourierName = c.UccrName,
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

    public async Task<List<Suggestion>> AllActiveCouriersAsync(string searchTerm, bool dgOnly = false)
    {
        var isUsTenant = infoService.IsUsTenant();
        var now = infoService.GetCurrentTenantTime();

        try
        {
            Log.Information(
                "Starting AllActiveCouriersAsync search with term: {SearchTerm}, DG Only: {DgOnly}",
                searchTerm,
                dgOnly
            );

            var query = Context.TucCouriers
                .AsNoTracking()
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
        var today = infoService.GetCurrentTenantTime();
        var results = await Context.GetActiveCouriersAsync(today);

        if (!includeJobCount || results.Count == 0) return results;

        var courierIds = results.Select(c => c.CourierId).ToList();

        var jobCounts = await Context.TucJobs
            .AsNoTracking()
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

    public async Task<ClearListViewModel> GetClearListsAsync(List<int> despatchViewIds)
    {
        if (despatchViewIds.Count == 0) return new ClearListViewModel();

        try
        {
            var currentDate = infoService.GetCurrentTenantTime();
            var currentDateOnly = currentDate.Date;

            // ===================================================================
            // QUERY 1: Get all clear list areas
            // ===================================================================
            var clearLists = await Context.TblDespatchViews
                .AsNoTracking()
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
                .TagWith("GetClearLists - Step 1: Clear List Areas")
                .ToListAsync();

            if (clearLists.Count == 0) return new ClearListViewModel();

            var clearListAreaIds = clearLists.Select(cl => cl.ClearListAreaId).ToList();

            Log.Information("Step 1: Found {Count} clear lists for despatchViewIds: {@Ids}",
                clearLists.Count, despatchViewIds);

            if (clearLists.Count == 0)
            {
                // Debug: Check if despatch views exist
                var viewCount = await Context.TblDespatchViews
                    .Where(dv => despatchViewIds.Contains(dv.DespatchViewId))
                    .CountAsync();
                Log.Warning("Found {Count} despatch views but 0 clear lists", viewCount);
            }

            // ===================================================================
            // QUERY 2: Get ALL courier GPS polygon mappings for ALL areas at once (CACHED)
            // ===================================================================
            var cacheKey = GetPolygonMappingsCacheKey(clearListAreaIds);

            var allValidCourierGpsIds = await cache.GetOrCreateAsync(
                cacheKey,
                async entry =>
                {
                    // Cache for 5 minutes
                    entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);

                    // Set priority (if memory is low, this can be evicted)
                    entry.Priority = CacheItemPriority.Normal;

                    Log.Information("Cache MISS for polygon mappings - fetching from database");

                    return await Context.GetPolygonMappings(clearListAreaIds);
                });

            Log.Information("Step 2: Using polygon mappings (Cached: {IsCached})",
                cache.TryGetValue(cacheKey, out _));

            var polygonChannelsByClearListArea = allValidCourierGpsIds
                .GroupBy(x => x.ClearListAreaId)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(x => new { x.PolygonId, x.ChannelId }).ToList()
                );

            Log.Information("Step 2b: Polygons grouped into {Count} clear list areas",
                polygonChannelsByClearListArea.Count);

            // ===================================================================
            // QUERY 3: Get ALL active couriers with jobs
            // ===================================================================
            var activeCouriers = await Context.TucCouriers
                .AsNoTracking()
                .Where(c => c.Active &&
                            (c.SendJobsViaSms ||
                             c.SendAlertSms ||
                             (c.CourierLogInOut != null &&
                              c.CourierLogInOut.LogInTime.Date <= currentDateOnly &&
                              c.CourierLogInOut.LogOutTime == null)))
                .Select(c => new ActiveCourierDto
                {
                    CourierId = c.UccrId,
                    Code = c.Code,
                    Name = c.UccrName + " " + c.UccrSurname,
                    DangerousGoods = c.UccrDangerousGoods == 1,
                    DgLicenseExpiry = c.DglicenseExpiry,
                    JobCount = c.TucJobUcjbCouriers.Count(j =>
                        !j.UcjbVoid &&
                        !j.UcjbJobDone &&
                        j.UcjbDate.Date <= currentDateOnly)
                })
                .OrderBy(c => c.Code)
                .TagWith("GetClearLists - Step 3: Active Couriers with Job Counts")
                .ToListAsync();
            Log.Information("Step 3: Found {Count} active couriers", activeCouriers.Count);

            // ===================================================================
            // QUERY 4a: Get courier BASE data (without display orders)
            // ===================================================================
            var courierBaseData = await Context.TucCouriers
                .AsNoTracking()
                .Where(c => c.Active && c.TblClearListAreaOrder != null)
                .Where(c => c.CourierFleetId == (int)CourierFleet.UaAucklandP2P ||
                            (c.CourierLogInOut != null &&
                             c.CourierLogInOut.LogInTime.Date <= currentDateOnly &&
                             c.CourierLogInOut.LogOutTime == null))
                .GroupJoin(
                    Context.TucCourierFleets.AsNoTracking(),
                    c => c.CourierFleetId,
                    cf => cf.UccfId,
                    (c, cfGroup) => new { Courier = c, FleetGroup = cfGroup }
                )
                .SelectMany(
                    x => x.FleetGroup.DefaultIfEmpty(),
                    (x, cf) => new { x.Courier, Fleet = cf }
                )
                .GroupJoin(
                    Context.TblCourierGps.AsNoTracking(),
                    x => x.Courier.CourierGpsid,
                    gps => gps.CourierGpsid,
                    (x, gpsGroup) => new { x.Courier, x.Fleet, GpsGroup = gpsGroup }
                )
                .SelectMany(
                    x => x.GpsGroup.DefaultIfEmpty(),
                    (x, gps) => new { x.Courier, x.Fleet, Gps = gps }
                )
                .Select(x => new
                {
                    x.Courier.UccrId,
                    x.Courier.Code,
                    x.Courier.UccrChannelId,
                    x.Courier.SendJobsViaSms,
                    x.Courier.AutoDespatch,
                    x.Courier.UccrVehicle,
                    x.Courier.CourierGpsid,
                    GpsCreated = x.Gps != null ? x.Gps.Created : (DateTime?)null,
                    PolygonId = x.Gps != null ? x.Gps.PolygonId : null
                })
                .ToListAsync();

            Log.Information("Step 2: Found {Count} courier base data records", courierBaseData.Count);

            var courierIds = courierBaseData.Select(c => c.UccrId).ToList();

            // ===================================================================
            // QUERY 4b: Get ALL display orders in ONE query (FIXES N+1)
            // ===================================================================
            var displayOrders = await Context.TblClearListAreaOrders
                .AsNoTracking()
                .Where(cao => courierIds.Contains(cao.CourierId))
                .Select(cao => new
                {
                    cao.CourierId,
                    cao.Status,
                    cao.OrderTime
                })
                .TagWith("GetClearLists - Step 4b: Display Orders")
                .ToListAsync();

            var displayOrderDict = displayOrders.ToDictionary(d => d.CourierId);

            // ===================================================================
            // Step 4c: Combine in memory
            // ===================================================================
            var allCourierData = courierBaseData.Select(c => new CourierClearListDto
            {
                UccrId = c.UccrId,
                Code = c.Code,
                UccrChannelId = c.UccrChannelId,
                SendJobsViaSms = c.SendJobsViaSms,
                AutoDespatch = c.AutoDespatch,
                UccrVehicle = c.UccrVehicle,
                CourierGpsid = c.CourierGpsid,
                GpsCreated = c.GpsCreated,
                PolygonId = c.PolygonId,
                DisplayOrder = displayOrderDict.TryGetValue(c.UccrId, out var order) ? order.Status : null,
                OrderTime = displayOrderDict.TryGetValue(c.UccrId, out var order2) ? order2.OrderTime : null
            }).ToList();

            // Group couriers by GPS polygon ID for area filtering
            var couriersByPolygon = allCourierData
                .Where(c => c.PolygonId.HasValue)
                .GroupBy(c => c.PolygonId.Value)
                .ToDictionary(g => g.Key, g => g.ToList());

            Log.Information("[STEP 4c - Combined Data] Total allCourierData: {Count}", allCourierData.Count);

            // ===================================================================
            // QUERY 5: Get ALL jobs for ALL couriers at once
            // ===================================================================
            var allCourierIds = allCourierData.Select(c => c.UccrId).ToHashSet();

            var allJobs = await Context.TblJobs
                .AsNoTracking()
                .Where(job => !job.JobDone &&
                              !job.Void &&
                              job.Date.HasValue &&
                              job.Date.Value.Date <= currentDateOnly &&
                              job.CourierId.HasValue &&
                              allCourierIds.Contains(job.CourierId.Value))
                .Select(job => new CourierJobSuburbDto
                {
                    CourierId = job.CourierId.Value,
                    ToSuburbId = job.ToSuburbId
                })
                .TagWith("GetClearLists - Step 5: All Jobs")
                .ToListAsync();

            var jobsByCourier = allJobs
                .GroupBy(j => j.CourierId)
                .ToDictionary(g => g.Key, g => g.ToList());


            // ===================================================================
            // QUERY 6: Get ALL suburb mappings at once
            // ===================================================================
            var allSuburbIds = allJobs
                .Where(j => j.ToSuburbId.HasValue)
                .Select(j => j.ToSuburbId.Value)
                .Distinct()
                .ToHashSet();

            Dictionary<int, List<SuburbClearListAreaDto>> suburbLookup = [];

            if (allSuburbIds.Count != 0)
            {
                var suburbClearListAreas = await Context.TblPolygonSuburbs
                    .AsNoTracking()
                    .Where(ps => allSuburbIds.Contains(ps.SuburbId))
                    .Join(Context.TblPolygons.AsNoTracking(),
                        ps => ps.PolygonId,
                        p => p.PolygonId,
                        (ps, p) => new { ps.SuburbId, p.PolygonId })
                    .Join(Context.TblClearListAreaPolygons.AsNoTracking(),
                        p => p.PolygonId,
                        cap => cap.PolygonId,
                        (p, cap) => new { p.SuburbId, cap.ClearListAreaId })
                    .Join(Context.TblClearListAreas.AsNoTracking(),
                        cap => cap.ClearListAreaId,
                        cla => cla.ClearListAreaId,
                        (cap, cla) => new SuburbClearListAreaDto
                        {
                            SuburbId = cap.SuburbId,
                            ClearListAreaId = cla.ClearListAreaId,
                            Code = cla.Code,
                            ChannelId = cla.ChannelId
                        })
                    .TagWith("GetClearLists - Step 6: Suburb Mappings")
                    .ToListAsync();

                suburbLookup = suburbClearListAreas
                    .GroupBy(sca => sca.SuburbId)
                    .ToDictionary(g => g.Key, g => g.ToList());
            }

            // ===================================================================
            // QUERY 7: Get area filters for total remaining calculation
            // ===================================================================
            var clearListNames = clearLists.Select(cl => cl.AreaName);
            var areaFilters = await Context.TblDespatchViews
                .AsNoTracking()
                .Where(v => v.ShowOnAssistDespatch == true &&
                            clearListNames.Contains(v.Name))
                .Select(v => new
                {
                    v.Name,
                    v.WhereCondition
                })
                .TagWith("GetClearLists - Step 7: Area Filters")
                .ToListAsync();

            var areaFilterDict = areaFilters
                .Where(af => !string.IsNullOrEmpty(af.WhereCondition))
                .ToDictionary(af => af.Name?.ToLower() ?? "", af => af.WhereCondition);

            // ===================================================================
            // QUERY 8: Get total remaining for ALL areas (Sequential Batch)
            // ===================================================================
            var areaRemainingCounts = await GetTotalRemainingForAllAreasAsync(areaFilterDict);

            // ===================================================================
            // IN-MEMORY PROCESSING: Build clear lists for each area
            // ===================================================================
            var columnDefinitions = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
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
                        if (polygonChannel.PolygonId == null ||
                            !couriersByPolygon.TryGetValue(polygonChannel.PolygonId.Value, out var couriersWithPolygon))
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
                    currentDate
                );

                // Build sections (will be empty if no couriers)
                var areaClearList = new AreaClearList
                {
                    Id = clearList.ClearListAreaId,
                    Name = clearList.AreaName,
                    Order = clearList.AreaOrder,
                    PercentHeight = 33,
                    Top = BuildClearListSection(clearListResults, activeCouriers, 1),
                    Middle = BuildClearListSection(clearListResults, activeCouriers, 3),
                    Bottom = BuildClearListSection(clearListResults, activeCouriers, 5),
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
                        if (!job.ToSuburbId.HasValue ||
                            !suburbLookup.TryGetValue(job.ToSuburbId.Value, out var areaOptions))
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

    private async Task<Dictionary<string, int>> GetTotalRemainingForAllAreasAsync(
        Dictionary<string, string> areaFilterDict)
    {
        if (areaFilterDict.Count == 0)
            return new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        const string statusFilter = " AND ((ucjbStatus IS NULL OR ucjbStatus = 0) AND ucjbCourierId is null)";

        // Create semaphore with max 5 concurrent operations
        using var semaphore = new SemaphoreSlim(Math.Min(areaFilterDict.Count, 5));

        // Create and START all tasks immediately by calling ToList()
        var tasks = areaFilterDict.Select(async kvp =>
        {
            await semaphore.WaitAsync();
            try
            {
                var areaName = kvp.Key;
                var filter = kvp.Value + statusFilter;
                var query = $"SELECT *, NULL as CourierLatitude, NULL as CourierLongitude FROM DESWEB_qryDespatch WHERE {filter}";

                try
                {
                    await using var context = await _contextFactory.CreateDbContextAsync();

                    var count = await context.DeswebQryDespatches
                        .FromSqlRaw(query)
                        .AsNoTracking()
                        .TagWith($"GetTotalRemaining - Area: {areaName}")
                        .CountAsync();

                    return (AreaName: areaName, Count: count);
                }
                catch (Exception ex)
                {
                    Log.Warning(ex, "Failed to get total remaining for area {AreaName}", areaName);
                    return (AreaName: areaName, Count: 0);
                }
            }
            finally
            {
                semaphore.Release();
            }
        }).ToList();

        var counts = await Task.WhenAll(tasks);

        // Build a dictionary with OrdinalIgnoreCase comparer
        var results = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var result in counts) results[result.AreaName] = result.Count;
    
        return results;
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
        List<ActiveCourierDto> activeCouriers,
        int displayOrder
    )
    {
        if (data == null) return [];

        return data
            .Where(c => c.DisplayOrder == displayOrder)
            .Select(x =>
            {
                var activeCourier = activeCouriers.FirstOrDefault(c => c?.CourierId == x.CourierId);
                return new ClearListSection
                {
                    CourierNumber = x.Code,
                    CourierData = BuildCourierData(x, activeCouriers),
                    Destinations = BuildDestinations(x.Deliver),
                    JobCount = activeCourier?.JobCount ?? 0
                };
            })
            .ToList();
    }

    private static CourierData BuildCourierData(
        ClearListResult result,
        List<ActiveCourierDto> activeCouriers
    )
    {
        if (activeCouriers == null)
            return new CourierData();
        var activeCourier = activeCouriers.FirstOrDefault(c => c?.CourierId == result?.CourierId);

        return new CourierData
        {
            Courier = $"{activeCourier?.Code} {activeCourier?.Name}".Trim(),
            Location = "Unknown",
            Pu = "Unknown",
            Del = result?.Deliver ?? "Unknown",
            Lrm = "Unknown",
            Eta2Lrm = "Unknown",
            CourierId = result?.CourierId
        };
    }

    private static List<Destination> BuildDestinations(string deliver)
    {
        return deliver
            ?.Split(',')
            .Select((d, index) => new Destination { Id = index + 1, Label = d.Trim() })
            .Where(y => !string.IsNullOrWhiteSpace(y.Label))
            .ToList() ?? [];
    }

    public async Task<List<Suggestion>> SearchAllCouriersAsync(string searchTerm)
    {
        var searchPattern = $"%{searchTerm}%";

        var couriers = await Context.TucCouriers
            .AsNoTracking()
            .Where(c => EF.Functions.Like(c.Code, searchPattern)
                        || EF.Functions.Like(c.UccrName, searchPattern)
                        || EF.Functions.Like(c.UccrSurname, searchPattern)
                        || EF.Functions.Like(c.UccrVehicleModel, searchPattern)
                        || EF.Functions.Like(c.VehiclePlateNnumber, searchPattern)
                        || EF.Functions.Like(c.UccrEmail, searchPattern)
                        || EF.Functions.Like(c.PersonalMobile, searchPattern)
                        || EF.Functions.Like(c.UccrMobile, searchPattern)
                        || EF.Functions.Like(c.UccrName + " " + c.UccrSurname, searchPattern))
            .Select(c => new Suggestion
            {
                Id = c.UccrId,
                Text = $"{c.Code} - {c.UccrName} {c.UccrSurname}"
            })
            .ToListAsync();

        return couriers;
    }

    public async Task<CourierDataDashboardViewModel> GetCourierDetailsForDashboardAsync(int courierId)
    {
        var courierData = await Context.TucCouriers
            .AsNoTracking()
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

        return courierData;
    }

    public async Task<CourierCompliancePaginatedResponse> GetAllCourierComplianceAsync(
        CourierComplianceFilterRequest request)
    {
        var now = infoService.GetCurrentTenantTime();
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
            .AsNoTracking()
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

        foreach (var compliance in couriersCompliance)
        {
            compliance.ExpiryDate = compliance.ExpiryDate.HasValue
                ? TimeZoneHelper.SetDateTimeWithTimeZone(compliance.ExpiryDate.Value, tenantTimezone)
                : null;
        }

        return new CourierCompliancePaginatedResponse
        {
            Items = couriersCompliance,
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
        var now = infoService.GetCurrentTenantTime();
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
            if (dayValue != 0)
            {
                query = query.Where(c => c.WeekDay == dayValue);
            }
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
            .AsNoTracking()
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
            Days = c.Days.Select(d => d switch
                {
                    0 => "Sunday",
                    1 => "Monday",
                    2 => "Tuesday",
                    3 => "Wednesday",
                    4 => "Thursday",
                    5 => "Friday",
                    6 => "Saturday",
                    7 => "Sunday",
                    _ => "Unknown"
                }).OrderBy(day =>
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
        var today = infoService.GetCurrentTenantTime();
        var tenantTimeZone = infoService.GetTenantTimeZone();

        var page = Math.Max(1, request.Page);
        var pageSize = Math.Max(1, Math.Min(100, request.PageSize));

        var query = Context.TucCouriers
            .AsNoTracking() // Article tip #2
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

        var sessionData = await query
            .Select(c => new
            {
                c.CourierLogInOut.LogInTime,
                c.CourierLogInOut.LogOutTime,
                IsActive = c.CourierLogInOut.LogOutTime == null
            })
            .TagWith("GetTodayActiveDrivers - Step 1: Session Aggregates")
            .ToListAsync();

        var totalCount = sessionData.Count;

        // Early return if no data (Article tip #4 - Use Any())
        if (totalCount == 0)
        {
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
        }

        var totalActiveDrivers = sessionData.Count(s => s.IsActive);
        var totalDriversActiveToday = sessionData.Count(s => s.IsActive && s.LogInTime.Date == today.Date);
        var averageSessionTime = sessionData.Average(s => ((s.LogOutTime ?? today) - s.LogInTime).TotalMinutes);

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
        {
            return new TodayActiveDriversPaginatedResponse
            {
                Items = new List<TodayActiveDriversViewModel>(),
                Total = totalCount,
                Page = page,
                Pages = totalPages,
                TotalActiveDrivers = totalActiveDrivers,
                TotalDriversActiveToday = totalDriversActiveToday,
                AverageSessionTime = averageSessionTime
            };
        }

        var courierIds = couriers.Select(c => c.UccrId).ToList();

        var deliveryCounts = await Context.TucJobs
            .AsNoTracking() // Article tip #2
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
                Duration = CourierActiveDuration(c.LogInTime, c.LogOutTime ?? today),
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
            TotalDriversActiveToday = totalDriversActiveToday,
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
            .AsNoTracking()
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
        var now = infoService.GetCurrentTenantTime();

        var page = Math.Max(1, request.Page);
        var pageSize = Math.Max(1, Math.Min(100, request.PageSize));

        var query = Context.TucCouriers
            .AsNoTracking() // Article tip #2
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
            .AsNoTracking()
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
        {
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
        }

        var courierIds = couriers.Select(c => c.UccrId).ToList();

        var earningsData = await Context.TucJobs
            .AsNoTracking()
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
            .TagWith("GetCourierDailyEarnings - Step 3: Earnings Data")
            .ToListAsync();

        var earningsDict = earningsData.ToDictionary(x => x.CourierId);

        var allCourierIds = await query
            .Select(c => c.UccrId)
            .ToListAsync();

        var allEarningsForAverage = await Context.TucJobs
            .AsNoTracking()
            .Where(j => j.UcjbCourierId.HasValue &&
                        allCourierIds.Contains(j.UcjbCourierId.Value))
            .GroupBy(j => j.UcjbCourierId.Value)
            .Select(g => new
            {
                CourierId = g.Key,
                TotalEarnings = g.Sum(j => j.CourierPayment) ?? 0
            })
            .TagWith("GetCourierDailyEarnings - Step 4: Average Hourly Rate Calculation")
            .ToListAsync();

        var allEarningsDict = allEarningsForAverage.ToDictionary(x => x.CourierId, x => x.TotalEarnings);

        // Calculate hourly rates in memory
        var hourlyRates = new List<decimal>();
        foreach (var courier in await query.Select(c => new
                 {
                     c.UccrId,
                     c.CourierLogInOut.LogInTime,
                     c.CourierLogInOut.LogOutTime
                 }).ToListAsync())
        {
            var hoursLogged = ((courier.LogOutTime ?? now) - courier.LogInTime).TotalMinutes;
            if (hoursLogged > 0 && allEarningsDict.TryGetValue(courier.UccrId, out var earnings))
            {
                hourlyRates.Add(earnings / (decimal)(hoursLogged / 60.0));
            }
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
            .Where(c => c.UccrEmail != null).Distinct().AsQueryable();

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

        var courierEmails = await query
            .AsNoTracking()
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
            .AsNoTracking()
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

    private static int GetDayOfWeekAsInt(string dayOfWeek)
    {
        return dayOfWeek switch
        {
            "Monday" => 1,
            "Tuesday" => 2,
            "Wednesday" => 3,
            "Thursday" => 4,
            "Friday" => 5,
            "Saturday" => 6,
            "Sunday" => 7,
            _ => 0
        };
    }

    public async Task UpdateAfterHoursCourierScheduleAsync(AfterHoursCourierScheduleViewModel request)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(request.StartTime);
            ArgumentNullException.ThrowIfNull(request.EndTime);

            // Delete the original schedule group in a single query
            await Context.TblAfterhoursCouriers
                .Where(s => Context.TblAfterhoursCouriers
                    .Where(c => c.Id == request.AfterHoursScheduleId)
                    .Any(c => c.CourierId == s.CourierId &&
                              c.StartTime == s.StartTime &&
                              c.EndTime == s.EndTime))
                .ExecuteDeleteAsync();

            // Create new schedules with the updated data (new days, new times)
            foreach (var schedule in request.Days.Select(GetDayOfWeekAsInt).Select(dayOfWeek => new TblAfterhoursCourier
                     {
                         CourierId = request.CourierId,
                         WeekDay = dayOfWeek,
                         StartTime = request.StartTime.Value.DateTime,
                         EndTime = request.EndTime.Value.DateTime
                     })) await Context.TblAfterhoursCouriers.AddAsync(schedule);

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
            ArgumentNullException.ThrowIfNull(request.StartTime);
            ArgumentNullException.ThrowIfNull(request.EndTime);

            // Add a record for each day
            foreach (var schedule in request.Days.Select(GetDayOfWeekAsInt).Select(dayOfWeek => new TblAfterhoursCourier
                     {
                         CourierId = request.CourierId,
                         WeekDay = dayOfWeek,
                         StartTime = request.StartTime.Value.DateTime,
                         EndTime = request.EndTime.Value.DateTime
                     })) await Context.TblAfterhoursCouriers.AddAsync(schedule);

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
                .AsNoTracking()
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
        var now = infoService.GetCurrentTenantTime();

        var drivers = await Context.TucCouriers
            .AsNoTracking()
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
            .AsNoTracking()
            .Where(j => j.UcjbCourierId.HasValue &&
                        driverIds.Contains(j.UcjbCourierId.Value) &&
                        !j.UcjbJobDone &&
                        !j.UcjbVoid &&
                        j.UcjbDate.Date == now.Date)
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
                VehicleType = MapVehicleTypeToAbbreviation(d.UccrVehicle),
                JobCount = jobCountDict.GetValueOrDefault(d.UccrId, 0),
                DriverStatusText = d.DriverStatusText
            })
            .ToList();
    }

    public async Task ResetClearListAreaOrderAsync(int courierId)
    {
        var tenantTime = infoService.GetCurrentTenantTime();

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
}