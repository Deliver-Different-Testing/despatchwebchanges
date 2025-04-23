using System;
using System.Collections.Generic;
using System.Data.Common;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using DespatchWebContextExtensions;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DespatchWeb.Repositories;

public class CourierRepository(IDbContextFactory<DespatchContext> contextFactory, ITenantInfoService tenantInfoService)
    : BaseRepository(contextFactory),
        ICourierRepository
{
    public async Task<ActiveCouriersViewModel> GetCourierByIdAsync(int courierId)
    {
        var courier = await Context.TucCouriers
            .Where(c => c.UccrId == courierId)
            .Select(c => new ActiveCouriersViewModel
            {
                Code = c.Code,
                Name = c.UccrName,
                CourierId = c.UccrId,
                DangerousGoods = c.UccrDangerousGoods == 1,
                DGLicenseExpiry = c.DglicenseExpiry,
                IsActive = c.Active == true && (
                    c.SendJobsViaSms == true ||
                    c.SendAlertSms == true ||
                    (c.SendJobsViaSms == false &&
                     c.CourierLogInOut != null &&
                     c.CourierLogInOut.LogInTime.Date == DateTime.Today &&
                     c.CourierLogInOut.LogOutTime == null)
                )
            })
            .AsNoTracking()
            .FirstOrDefaultAsync();

        return courier;
    }

    public async Task<List<TruckCourierStatusViewModel>> TruckCourierStatusAsync(string courierId)
    {
        try
        {
            return await Context
                .TucCouriers.Where(c =>
                    c.Active == true
                    && c.UccrVehicle == "Truck"
                    && (courierId == null || c.UccrId.ToString().Contains(courierId))
                )
                .Select(c => new TruckCourierStatusViewModel
                {
                    CourierId = c.UccrId,
                    CourierCode = c.Code,
                    FirstName = c.UccrName,
                    MaxPallets = c.MaxPallets,
                    MaxPayLoad = c.MaxPayload,
                    CurrentPallets = c
                        .TucJobUcjbCouriers.Where(d => !d.UcjbJobDone && !d.UcjbVoid)
                        .SelectMany(d => d.TucJobItems)
                        .Sum(i => i.Items),
                    CurrentWeight = c
                        .TucJobUcjbCouriers.Where(d => !d.UcjbJobDone && !d.UcjbVoid)
                        .SelectMany(d => d.TucJobItems)
                        .Sum(i => i.Items * i.Weight),
                    AvailablePallets =
                        c.MaxPallets
                        * c.TucJobUcjbCouriers.Where(d => !d.UcjbJobDone && !d.UcjbVoid)
                            .SelectMany(d => d.TucJobItems)
                            .Sum(i => i.Items),
                    AvailablePalletCapacity =
                        c.MaxPayload
                        * c.TucJobUcjbCouriers.Where(d => !d.UcjbJobDone && !d.UcjbVoid)
                            .SelectMany(d => d.TucJobItems)
                            .Sum(i => i.Items * i.Weight)
                })
                .OrderBy(c => c.CourierCode)
                .AsNoTracking()
                .ToListAsync();
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured getting truck status for {CourierId}", courierId);
            throw;
        }
    }

    public async Task<List<AvailableCourierPosition>> GetAvailableCouriers(
        decimal minLng,
        decimal minLat,
        decimal maxLng,
        decimal maxLat,
        bool isUsTenant
    )
    {
        if (!isUsTenant)
            return await GetNzAvailableCourierPositions(
                minLng,
                minLat,
                maxLng,
                maxLat
            );

        return await GetUsAvailableCourierPositions(
            minLng,
            minLat,
            maxLng,
            maxLat
        );
    }

    private async Task<List<AvailableCourierPosition>> GetUsAvailableCourierPositions(
        decimal minimumLongitude,
        decimal minimumLatitude,
        decimal maximumLongitude,
        decimal maximumLatitude)
    {
        var currentDate = tenantInfoService.GetCurrentTenantTime();

        var couriers = await Context.TucCouriers
            .Where(c => c.CourierLogInOut.LogOutTime == null &&
                        c.CourierGps.Longitude >= minimumLongitude && c.CourierGps.Longitude <= maximumLongitude
                        && c.CourierGps.Latitude >= minimumLatitude && c.CourierGps.Latitude <= maximumLatitude
                        && c.CourierFleetId != 29)
            .Select(c => new CourierDto
            {
                CourierId = c.UccrId,
                Latitude = c.CourierGps.Latitude ?? 0,
                Longitude = c.CourierGps.Longitude ?? 0,
                ChannelId = c.UccrChannelId ?? 0,
                VehicleType = c.UccrVehicle,
                ClearListAreaIDs = c.CourierGps.ZipPolygon.TblClearListAreaPolygons
                    .Select(x => x.ClearListArea.ClearListAreaId).ToList(),
                Code = c.Code,
                FleetId = c.CourierFleetId,
                TotalJobs = c.TucJobUcjbCouriers.Count(j => !j.UcjbVoid && !j.UcjbJobDone),
                Jobs = c.TucJobUcjbCouriers
                    .Where(j => !j.UcjbVoid && !j.UcjbJobDone && j.UcjbTime != null)
                    .Select(j => new JobDto
                    {
                        UcjbDate = j.UcjbDate,
                        UcjbTime = j.UcjbTime,
                        Minutes = j.AcceptedJobType.Minutes
                    })
                    .ToList(),
                CourierName = c.UccrName
            })
            .AsNoTracking()
            .ToListAsync();


        var uaFleetIds = new[] { 32, 33, 34, 35, 36, 37, 38, 64 };

        return couriers.Select(dto => new AvailableCourierPosition
        {
            CourierId = dto.CourierId,
            CourierName = dto.CourierName,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            ChannelId = dto.ChannelId,
            VehicleType = dto.VehicleType,
            ClearListAreaIDs = dto.ClearListAreaIDs,
            Code = dto.Code,
            FleetCode = uaFleetIds.Contains(dto.FleetId ?? 0) ? "UA" : string.Empty,
            TotalJobs = dto.TotalJobs,
            OverDueJobs = dto.Jobs.Count(j =>
                j.UcjbTime != null &&
                j.UcjbDate.Add(j.UcjbTime.Value.TimeOfDay).AddMinutes(j.Minutes ?? 0) < currentDate)
        }).ToList();
    }

    private async Task<List<AvailableCourierPosition>> GetNzAvailableCourierPositions(
        decimal minimumLongitude,
        decimal minimumLatitude,
        decimal maximumLongitude,
        decimal maximumLatitude)
    {
        var couriers = await Context.TucCouriers
            .Where(c => c.CourierLogInOut.LogOutTime == null &&
                        c.CourierGps.Longitude >= minimumLongitude && c.CourierGps.Longitude <= maximumLongitude &&
                        c.CourierGps.Latitude >= minimumLatitude && c.CourierGps.Latitude <= maximumLatitude &&
                        c.CourierFleetId != 29)
            .Select(c => new CourierDto
            {
                CourierId = c.UccrId,
                CourierName = c.UccrName,
                Latitude = c.CourierGps.Latitude ?? 0,
                Longitude = c.CourierGps.Longitude ?? 0,
                ChannelId = c.UccrChannelId ?? 0,
                VehicleType = c.UccrVehicle,
                ClearListAreaIDs = c.CourierGps.Polygon.TblClearListAreaPolygons
                    .Select(x => x.ClearListArea.ClearListAreaId).ToList(),
                Code = c.Code,
                FleetId = c.CourierFleetId,
                TotalJobs = c.TucJobUcjbCouriers.Count(j => !j.UcjbVoid && !j.UcjbJobDone),
                Jobs = c.TucJobUcjbCouriers
                    .Where(j => !j.UcjbVoid && !j.UcjbJobDone && j.UcjbTime != null)
                    .Select(j => new JobDto
                    {
                        UcjbDate = j.UcjbDate,
                        UcjbTime = j.UcjbTime,
                        Minutes = j.AcceptedJobType.Minutes
                    })
                    .ToList()
            })
            .AsNoTracking()
            .ToListAsync();

        var now = tenantInfoService.GetCurrentTenantTime();
        var uaFleetIds = new[] { 32, 33, 34, 35, 36, 37, 38, 64 };

        return couriers.Select(dto => new AvailableCourierPosition
        {
            CourierId = dto.CourierId,
            CourierName = dto.CourierName,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            ChannelId = dto.ChannelId,
            VehicleType = dto.VehicleType,
            ClearListAreaIDs = dto.ClearListAreaIDs,
            Code = dto.Code,
            FleetCode = uaFleetIds.Contains(dto.FleetId ?? 0) ? "UA" : string.Empty,
            TotalJobs = dto.TotalJobs,
            OverDueJobs = dto.Jobs.Count(j =>
                j.UcjbTime != null && j.UcjbDate.Add(j.UcjbTime.Value.TimeOfDay).AddMinutes(j.Minutes ?? 0) < now)
        }).ToList();
    }

    public async Task<List<PotentialCouriersViewModel>> GetPotentialCouriersAsync(int jobId)
    {
        var results = await Context.Procedures.DESWEB_qryPotentialCouriersAsync(jobId);
        return results.Select(x => new PotentialCouriersViewModel
        {
            Code = x.Code,
            CourierId = x.CourierID ?? 0,
            FirstName = x.FirstName,
            Reason = x.Reason,
            RuleNumber = x.RuleNumber ?? 0
        }).ToList();
    }

    public async Task<List<ActiveCouriersViewModel>> ActiveCouriersAsync()
    {
        try
        {
            var results = await GetActiveCouriers();
            return results.Select(x => new ActiveCouriersViewModel
            {
                Code = x.Code,
                CourierId = x.CourierId,
                Name = x.Name,
                DangerousGoods = x.DangerousGoods,
                DGLicenseExpiry = x.DgLicenseExpiry
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

    public async Task<List<Suggestion>> AllActiveCouriersAsync(string searchTerm)
    {
        try
        {
            Log.Information(
                "Starting AllActiveCouriersAsync search with term: {SearchTerm}",
                searchTerm
            );

            var results = await Context
                .TucCouriers.Where(c =>
                    c.Active == true
                    && (c.Code + " " + c.UccrName + " " + c.UccrSurname).Contains(searchTerm)
                )
                .OrderBy(c => c.Code)
                .Select(c => new Suggestion
                {
                    Id = c.UccrId,
                    Text = c.UccrName + " " + c.UccrSurname
                })
                .AsNoTracking()
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

    public async Task<List<CourierPosition>> GetCourierRouteAsync(
        string code,
        DateTime? start,
        DateTime? end
    )
    {
        try
        {
            Log.Information(
                "Getting courier route for code: {CourierCode}, start: {StartDate}, end: {EndDate}",
                code,
                start,
                end
            );

            var results = await Context.Procedures.MAP_stpCourierGPS_LastPositionTodayAsync(code);
            var mappedResults = results.Select(x => new CourierPosition
            {
                Latitude = x.Latitude,
                Longitude = x.Longitude,
                FirstName = x.FirstName,
                rawdata = x.rawdata,
                Time = x.Time,
                Status = x.Status,
                CourierName = x.CourierName,
                GPSWasEstimated = x.GPSWasEstimated,
                JobID = x.JobID
            }).ToList();

            Log.Information(
                "Retrieved {Count} position records for courier {CourierCode}",
                mappedResults.Count,
                code
            );
            return mappedResults;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting courier route for code {CourierCode}", code);
            throw;
        }
    }

    public async Task<List<ActiveCouriersViewModel>> AllActiveCouriersAsync()
    {
        try
        {
            Log.Information("Retrieving all active couriers");

            var results = await GetActiveCouriers();
            var mappedResults = results.Select(x => new ActiveCouriersViewModel
            {
                Code = x.Code,
                CourierId = x.CourierId,
                Name = x.Name,
                DangerousGoods = x.DangerousGoods,
                DGLicenseExpiry = x.DgLicenseExpiry
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

    public CourierLocation Location(string code)
    {
        try
        {
            Log.Information("Getting current location for courier: {CourierCode}", code);

            var currentLocation = new CourierLocation();
            Context
                .LoadStoredProc("MAP_stpCourierGPS_LastPositionToday")
                .WithSqlParam("@CourierCode", code)
                .ExecuteStoredProc(handle =>
                {
                    currentLocation = handle.ReadToList<CourierLocation>().FirstOrDefault();
                });

            if (currentLocation != null)
            {
                Log.Information(
                    "Retrieved location for courier {CourierCode}: Lat={Latitude}, Long={Longitude}",
                    code,
                    currentLocation.Latitude,
                    currentLocation.Longitude
                );
            }
            else
            {
                Log.Warning("No location found for courier {CourierCode}", code);
            }

            return currentLocation;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting location for courier {CourierCode}", code);
            throw;
        }
    }

    public async Task<ClearListEnvelopeViewModel> GetClearListAreaEnvelopeAsync(
        int clearListAreaId,
        Country country,
        bool includeCouriers = false
    )
    {
        if (clearListAreaId <= 0)
            throw new ArgumentException("Invalid clearListAreaId", nameof(clearListAreaId));

        if (!Enum.IsDefined(typeof(Country), country))
            throw new ArgumentException("Invalid country", nameof(country));

        return country switch
        {
            Country.Nz => await GetClearListEnvelopeNzAsync(clearListAreaId, includeCouriers),
            Country.Us => await GetClearListEnvelopeUsAsync(clearListAreaId, includeCouriers),
            _ => throw new ArgumentOutOfRangeException(nameof(country), country, null)
        };
    }

    private async Task<List<ActiveCourierDto>> GetActiveCouriers()
    {
        return await Context.TucCouriers
            .Where(c => c.Active)
            .Where(c => c.SendJobsViaSms ||
                        c.SendAlertSms ||
                        (c.SendJobsViaSms == false &&
                         c.CourierLogInOut != null &&
                         c.CourierLogInOut.LogInTime.Date == DateTime.Today &&
                         c.CourierLogInOut.LogOutTime == null))
            .Select(c => new ActiveCourierDto
            {
                CourierId = c.UccrId,
                Code = c.Code,
                Name = c.UccrName + " " + c.UccrSurname,
                DangerousGoods = c.UccrDangerousGoods == 1,
                DgLicenseExpiry = c.DglicenseExpiry,
                JobCount = c.TucJobUcjbCouriers.Count(jt => !jt.UcjbVoid && !jt.UcjbJobDone)
            })
            .OrderBy(c => c.Code)
            .ToListAsync();
    }

    public async Task<ClearListViewModel> GetClearListsAsync(
        List<int> despatchViewIds,
        bool isUsTenant
    )
    {
        try
        {
            // Get all required data upfront
            var activeCouriers = await GetActiveCouriers();
            var query = Context.TblDespatchViews.AsQueryable();

            // If view(s) provided, filter to these
            if (despatchViewIds.Count != 0)
            {
                query = query.Where(dv => despatchViewIds.Contains(dv.DespatchViewId));
            }

            // Get the results
            var clearLists = await query
                .SelectMany(dv => dv.DespatchViewZoneGroups)
                .Select(dvzg => dvzg.ZoneGroup.ClearListArea)
                .Where(cla => cla != null)
                .Distinct()
                .Select(cl => new
                {
                    cl.ClearListAreaId,
                    cl.Name,
                    cl.Order
                })
                .ToListAsync();

            // Process each clear list sequentially to avoid DbContext threading issues
            var areas = new List<AreaClearList>();
            foreach (var clearList in clearLists)
            {
                var areaClearList = await BuildClearListViewModel(
                    activeCouriers,
                    clearList,
                    33,
                    isUsTenant
                );

                if (areaClearList == null)
                    continue;

                areaClearList.TotalRemaining = await ClearListTotalRemainingAsync(
                    clearList.Name?.ToLower()
                );
                areas.Add(areaClearList);
            }

            return new ClearListViewModel { Areas = areas };
        }
        catch (Exception ex)
        {
            Log.Error(
                ex,
                "Error in GetClearListsAsync for despatchViewIds: {@DespatchViewIds}",
                despatchViewIds
            );
            throw;
        }
    }

    public async Task<List<Suggestion>> GetVehicleSizesAsync()
    {
        var vehicles = await Context
            .VehicleSizes.OrderBy(v => v.VehicleName)
            .Select(v => new Suggestion { Id = v.VehicleSizeId, Text = v.VehicleName })
            .AsNoTracking()
            .ToListAsync();

        return vehicles;
    }

    public async Task<List<Suggestion>> GetAllRegionsAsync()
    {
        var regions = await Context
            .TblBulkRegions.OrderBy(r => r.Name)
            .Select(r => new Suggestion { Id = r.BulkRegionId, Text = r.Name })
            .AsNoTracking()
            .ToListAsync();

        return regions;
    }

    public async Task<List<Suggestion>> GetAllSpeedsAsync()
    {
        var speeds = await Context
            .TucJobTypes.OrderBy(r => r.UcjtName)
            .Select(r => new Suggestion { Id = r.UcjtId, Text = r.UcjtName })
            .AsNoTracking()
            .ToListAsync();

        return speeds;
    }

    private async Task<int> ClearListTotalRemainingAsync(string area)
    {
        var filter = Context
            .TblDespatchViews.FirstOrDefault(v =>
                (v.ShowOnAssistDespatch ?? false) == true && v.Name == area
            )
            ?.WhereCondition;

        if (string.IsNullOrEmpty(filter))
            return 0;

        filter += " AND (ucjbStatus <> 9 AND ucjbCourierId is null)";
        var query =
            $"select *, null as CourierLatitude, null as CourierLongitude from DESWEB_qryDespatch where {filter}";
        var jobs = await Context.DeswebQryDespatches.FromSqlRaw(query).ToListAsync();
        return jobs.Count;
    }

    private async Task<ClearListEnvelopeViewModel> GetClearListEnvelopeUsAsync(
        int clearListAreaId,
        bool includeCouriers
    )
    {
        var query = GetClearListAreaBoundariesQuery(clearListAreaId);

        if (!includeCouriers)
            return await CalculateEnvelopeAsync(query);
        var courierLocationsQuery = GetCourierLocationsQueryUs(clearListAreaId);
        var unassingedJobLocationsQuery = GetUnassignedJobLocationsQueryUs(clearListAreaId);

        query = (query ?? throw new InvalidOperationException())
            .Concat(courierLocationsQuery ?? throw new InvalidOperationException())
            .Concat(unassingedJobLocationsQuery ?? throw new InvalidOperationException());

        return await CalculateEnvelopeAsync(query);
    }

    private async Task<ClearListEnvelopeViewModel> GetClearListEnvelopeNzAsync(
        int clearListAreaId,
        bool includeCouriers
    )
    {
        var query = GetAreaPolygonsQueryNz(clearListAreaId);

        if (!includeCouriers)
            return await CalculateEnvelopeAsync(query);
        var courierLocationsQuery = GetCourierLocationsQueryNz(clearListAreaId);
        var unassignedJobsQuery = GetUnassignedJobLocationsQueryNz(clearListAreaId);

        query = (query ?? throw new InvalidOperationException())
            .Concat(courierLocationsQuery ?? throw new InvalidOperationException())
            .Concat(unassignedJobsQuery ?? throw new InvalidOperationException());

        return await CalculateEnvelopeAsync(query);
    }

    private IQueryable<EnvelopeCoordinate> GetClearListAreaBoundariesQuery(int clearListAreaId)
    {
        return Context
            .TblClearListAreas.Where(area => area.ClearListAreaId == clearListAreaId)
            .SelectMany(area => area.TblClearListAreaPolygons)
            .Select(polygon => polygon.ZipPolygon)
            .Select(zipPolygon => new EnvelopeCoordinate
            {
                Longitude = (decimal)zipPolygon.Longitude,
                Latitude = (decimal)zipPolygon.Latitude
            });
    }

    private IQueryable<EnvelopeCoordinate> GetCourierLocationsQueryUs(int clearListAreaId)
    {
        var currentDate = tenantInfoService.GetCurrentTenantTime();

        return Context
            .TucCouriers.SelectMany(c =>
                c.TucJobUcjbCouriers.Where(jt => !jt.UcjbJobDone && !jt.UcjbVoid)
                    .SelectMany(jt =>
                        Context
                            .ZipPolygons.Where(zp =>
                                zp.Latitude == jt.PickUpLatitude
                                && zp.Longitude == jt.PickUpLongitude
                            )
                            .SelectMany(zp =>
                                zp.TblClearListAreaPolygons.Where(clap =>
                                        clap.ClearListArea.ClearListAreaId == clearListAreaId
                                        && clap.ClearListArea.ChannelId == c.UccrChannelId
                                    )
                                    .Select(clap => new { Courier = c, Job = jt })
                            )
                    )
            )
            .Where(x => x.Courier.CourierLogInOut.LogInTime <= currentDate &&
                x.Courier.CourierLogInOut.LogOutTime == null
            )
            .Select(x => new EnvelopeCoordinate
            {
                Longitude = (decimal)x.Courier.CourierGps.Longitude,
                Latitude = (decimal)x.Courier.CourierGps.Latitude
            });
    }

    private IQueryable<EnvelopeCoordinate> GetUnassignedJobLocationsQueryUs(int clearListAreaId)
    {
        return Context
            .TucJobs.Where(jt => !jt.UcjbJobDone && !jt.UcjbVoid && jt.UcjbCourierId == null)
            .SelectMany(jt =>
                Context
                    .ZipPolygons.Where(zp =>
                        zp.Latitude == jt.PickUpLatitude && zp.Longitude == jt.PickUpLongitude
                    )
                    .SelectMany(zp =>
                        zp.TblClearListAreaPolygons.Where(clazp =>
                                clazp.ClearListAreaId == clearListAreaId
                            )
                            .Select(clazp => new EnvelopeCoordinate
                            {
                                Longitude = (decimal)jt.DeliveryLongitude,
                                Latitude = (decimal)jt.DeliveryLatitude
                            })
                    )
            );
    }

    private IQueryable<EnvelopeCoordinate> GetAreaPolygonsQueryNz(int clearListAreaId)
    {
        return Context
            .TblClearListAreas.Where(cla => cla.ClearListAreaId == clearListAreaId)
            .SelectMany(cla =>
                cla.TblClearListAreaPolygons.SelectMany(clap =>
                    clap.Polygon.TblPolygonGps.Select(pgps => new EnvelopeCoordinate
                    {
                        Longitude = pgps.Longitude,
                        Latitude = pgps.Latitude
                    })
                )
            );
    }

    private IQueryable<EnvelopeCoordinate> GetCourierLocationsQueryNz(int clearListAreaId)
    {
        return Context
            .TucCouriers.Where(c =>
                c.CourierLogInOut.LogInTime.Date == DateTime.Today
                && c.CourierLogInOut.LogOutTime == null
            )
            .SelectMany(c =>
                c.TucJobUcjbCouriers.Where(jt => !jt.UcjbJobDone && !jt.UcjbVoid)
                    .SelectMany(jt =>
                        jt.UcjbToNavigation.TblPolygonSuburbs.SelectMany(dps =>
                            dps.Polygon.TblClearListAreaPolygons.Where(dclap =>
                                    dclap.ClearListArea.ClearListAreaId == clearListAreaId
                                    && dclap.ClearListArea.ChannelId == c.UccrChannelId
                                )
                                .Select(dclap => new EnvelopeCoordinate
                                {
                                    Longitude = (decimal)c.CourierGps.Longitude,
                                    Latitude = (decimal)c.CourierGps.Latitude
                                })
                        )
                    )
            );
    }

    private IQueryable<EnvelopeCoordinate> GetUnassignedJobLocationsQueryNz(int clearListAreaId)
    {
        return Context
            .TucJobs.Where(jt => !jt.UcjbJobDone && !jt.UcjbVoid && jt.UcjbCourierId == null)
            .SelectMany(jt =>
                jt.UcjbToNavigation.TblPolygonSuburbs.SelectMany(ps =>
                    ps.Polygon.TblClearListAreaPolygons.Where(clap =>
                            clap.ClearListAreaId == clearListAreaId
                        )
                        .Select(clap => new EnvelopeCoordinate
                        {
                            Longitude = (decimal)jt.DeliveryLongitude,
                            Latitude = (decimal)jt.DeliveryLatitude
                        })
                )
            );
    }

    private static async Task<ClearListEnvelopeViewModel> CalculateEnvelopeAsync(
        IQueryable<EnvelopeCoordinate> query
    )
    {
        var result = await query
            .GroupBy(_ => 1)
            .Select(g => new ClearListEnvelopeViewModel
            {
                MinimumLongitude = g.Min(x => x.Longitude),
                MinimumLatitude = g.Min(x => x.Latitude),
                MaximumLongitude = g.Max(x => x.Longitude),
                MaximumLatitude = g.Max(x => x.Latitude)
            })
            .FirstOrDefaultAsync();

        return result ?? new ClearListEnvelopeViewModel();
    }

    private async Task<AreaClearList> BuildClearListViewModel(
        List<ActiveCourierDto> activeCouriers,
        dynamic clearList,
        int percentHeight,
        bool isUsTenant
    )
    {
        // Combine multiple queries into one
        var clearListData = isUsTenant
            ? await Context.Procedures.DES_qdfUS_Courier_ClearListsAsync(clearList.ClearListAreaId)
            : await Context.Procedures.DES_qdfCourier_ClearListsAsync(clearList.ClearListAreaId);

        if (clearListData == null)
            return null;

        var acl = new AreaClearList
        {
            Id = clearList.ClearListAreaId,
            Name = clearList.Name,
            Order = clearList.Order,
            PercentHeight = percentHeight,
            Top = BuildClearListSection(clearListData, activeCouriers, 1),
            Middle = BuildClearListSection(clearListData, activeCouriers, 3),
            Bottom = BuildClearListSection(clearListData, activeCouriers, 5)
        };

        return acl;
    }

    private static List<ClearListSection> BuildClearListSection(
        IEnumerable<DES_qdfCourier_ClearListsResult> result,
        List<ActiveCourierDto> activeCouriers,
        int displayOrder
    )
    {
        if (result == null)
            return [];

        return result
            .Where(c => c.DisplayOrder == displayOrder)
            .Select(x =>
            {
                var activeCourier = activeCouriers.FirstOrDefault(c => c?.CourierId == x.CourierID);
                return new ClearListSection
                {
                    CourierNumber = x.Hash,
                    CourierData = BuildCourierData(x, activeCouriers),
                    Destinations = BuildDestinations(x.Deliver),
                    JobCount = activeCourier?.JobCount ?? 0
                };
            })
            .ToList();
    }

    private static CourierData BuildCourierData(
        DES_qdfCourier_ClearListsResult x,
        List<ActiveCourierDto> activeCouriers
    )
    {
        if (activeCouriers == null)
            return new CourierData();
        var activeCourier = activeCouriers.FirstOrDefault(c => c?.CourierId == x?.CourierID);

        return new CourierData
        {
            Courier = $"{activeCourier?.Code}   {activeCourier?.Name}".Trim(),
            Location = "Unknown",
            Pu = "Unknown",
            Del = x?.Deliver ?? "Unknown",
            Lrm = "Unknown",
            Eta2Lrm = "Unknown",
            CourierId = x?.CourierID
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
}
