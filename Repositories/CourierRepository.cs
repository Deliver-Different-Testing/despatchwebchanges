using System;
using System.Collections.Generic;
using System.Data.Common;
using System.Linq;
using System.Linq.Expressions;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DespatchWeb.Repositories;

public class CourierRepository(IDbContextFactory<DespatchContext> contextFactory, ITenantInfoService infoService)
    : BaseRepository(contextFactory),
        ICourierRepository
{
    public async Task<ActiveCouriersViewModel> GetCourierByIdAsync(int courierId)
    {
        var now = infoService.GetCurrentTenantTime();
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
                     c.CourierLogInOut.LogInTime.Date == now.Date &&
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
                        .SelectMany(d => d.TucJobItemJobs)
                        .Sum(i => i.Items),
                    CurrentWeight = c
                        .TucJobUcjbCouriers.Where(d => !d.UcjbJobDone && !d.UcjbVoid)
                        .SelectMany(d => d.TucJobItemJobs)
                        .Sum(i => i.Items * i.Weight),
                    AvailablePallets =
                        c.MaxPallets
                        * c.TucJobUcjbCouriers.Where(d => !d.UcjbJobDone && !d.UcjbVoid)
                            .SelectMany(d => d.TucJobItemJobs)
                            .Sum(i => i.Items),
                    AvailablePalletCapacity =
                        c.MaxPayload
                        * c.TucJobUcjbCouriers.Where(d => !d.UcjbJobDone && !d.UcjbVoid)
                            .SelectMany(d => d.TucJobItemJobs)
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

    public async Task<List<AvailableCourierPosition>> GetAvailableCouriersAsync(CourierLocationRequest data)
    {
        return !data.IsUsTenant
            ? await GetNzAvailableCourierPositionsAsync(data)
            : await GetUsAvailableCourierPositionsAsync(data);
    }

    private async Task<List<AvailableCourierPosition>> GetUsAvailableCourierPositionsAsync(CourierLocationRequest data)
    {
        var currentDate = infoService.GetCurrentTenantTime();
        var uaFleetIds = new[] { 32, 33, 34, 35, 36, 37, 38, 64 };

        var courierData = await Context.TucCouriers
            .Where(c => c.CourierFleetId != 29 &&
                        c.CourierGps != null &&
                        c.CourierGps.Longitude >= data.MinLng &&
                        c.CourierGps.Longitude <= data.MaxLng &&
                        c.CourierGps.Latitude >= data.MinLat &&
                        c.CourierGps.Latitude <= data.MaxLat &&
                        c.CourierLogInOut != null &&
                        c.CourierLogInOut.LogOutTime == null)
            .Select(c => new CourierPositionWithJobsDto
            {
                CourierId = c.UccrId,
                CourierName = c.UccrName,
                Latitude = c.CourierGps.Latitude ?? 0,
                Longitude = c.CourierGps.Longitude ?? 0,
                ChannelId = c.UccrChannelId ?? 0,
                VehicleType = c.UccrVehicle,
                ClearListAreaIDs = c.CourierGps.ZipPolygon.TblClearListAreaPolygons
                    .Select(x => x.ClearListArea.ClearListAreaId).ToList(),
                Code = c.Code,
                FleetCode = uaFleetIds.Contains(c.CourierFleetId ?? 0) ? "UA" : string.Empty,
                TotalJobs = c.TucJobUcjbCouriers.Count(j => !j.UcjbVoid && !j.UcjbJobDone),
                Jobs = c.TucJobUcjbCouriers
                    .Where(j => !j.UcjbVoid && !j.UcjbJobDone && j.UcjbTime != null)
                    .Select(j => new JobTimingDto
                    {
                        UcjbDate = j.UcjbDate,
                        UcjbTime = j.UcjbTime,
                        Minutes = j.AcceptedJobType.Minutes ?? 0
                    })
                    .ToList()
            })
            .AsNoTracking()
            .ToListAsync();

        var result = courierData.Select(c => new AvailableCourierPosition
        {
            CourierId = c.CourierId,
            CourierName = c.CourierName,
            Latitude = c.Latitude,
            Longitude = c.Longitude,
            ChannelId = c.ChannelId,
            VehicleType = c.VehicleType,
            ClearListAreaIDs = c.ClearListAreaIDs,
            Code = c.Code,
            FleetCode = c.FleetCode,
            TotalJobs = c.TotalJobs,
            OverDueJobs = c.Jobs.Count(j =>
                j.UcjbTime != null &&
                j.UcjbDate.Add(j.UcjbTime.Value.TimeOfDay).AddMinutes(j.Minutes) < currentDate)
        }).ToList();

        return result;
    }

    private async Task<List<AvailableCourierPosition>> GetNzAvailableCourierPositionsAsync(CourierLocationRequest data)
    {
        var couriers = await Context.TucCouriers
            .Where(c => c.CourierLogInOut.LogOutTime == null &&
                        c.CourierGps.Longitude >= data.MinLng && c.CourierGps.Longitude <= data.MaxLng &&
                        c.CourierGps.Latitude >= data.MinLat && c.CourierGps.Latitude <= data.MaxLat &&
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

        var now = infoService.GetCurrentTenantTime();
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
            var results = await GetActiveCouriersAsync();
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

    public async Task<List<ActiveCouriersViewModel>> AllActiveCouriersAsync()
    {
        try
        {
            Log.Information("Retrieving all active couriers");

            var results = await GetActiveCouriersAsync();
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

    private async Task<List<ActiveCourierDto>> GetActiveCouriersAsync()
    {
        var today = infoService.GetCurrentTenantTime();

        return await Context.TucCouriers
            .Where(c => c.Active &&
                        (c.SendJobsViaSms ||
                         c.SendAlertSms ||
                         (!c.SendJobsViaSms &&
                          c.CourierLogInOut != null &&
                          c.CourierLogInOut.LogInTime.Date == today.Date &&
                          c.CourierLogInOut.LogOutTime == null)))
            .Select(c => new ActiveCourierDto
            {
                CourierId = c.UccrId,
                Code = c.Code,
                Name = $"{c.UccrName} {c.UccrSurname}",
                DangerousGoods = c.UccrDangerousGoods == 1,
                DgLicenseExpiry = c.DglicenseExpiry,
                JobCount = c.TucJobUcjbCouriers.Count(jt => !jt.UcjbVoid && !jt.UcjbJobDone)
            })
            .OrderBy(c => c.Code)
            .AsNoTracking()
            .ToListAsync();
    }

    public async Task<ClearListViewModel> GetClearListsAsync(
        List<int> despatchViewIds
    )
    {
        if (despatchViewIds.Count == 0) return new ClearListViewModel();

        try
        {
            var query = Context.TblDespatchViews
                .Where(dv => despatchViewIds.Contains(dv.DespatchViewId));

            var clearLists = await query
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
                .ToListAsync();

            var activeCouriers = await GetActiveCouriersAsync();

            var areas = new List<AreaClearList>();
            foreach (var clearList in clearLists)
            {
                var areaClearList = await BuildClearListViewModelAsync(
                    activeCouriers,
                    clearList,
                    33
                );

                if (areaClearList == null)
                    continue;

                areaClearList.TotalRemaining = await ClearListTotalRemainingAsync(
                    clearList.AreaName?.ToLower()
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
        var currentDate = infoService.GetCurrentTenantTime();

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

    private async Task<AreaClearList> BuildClearListViewModelAsync(
        List<ActiveCourierDto> activeCouriers,
        ClearListAreaDto clearList,
        int percentHeight
    )
    {
        var clearListData = await GetClearListCouriers(clearList.ClearListAreaId);
        if (clearListData is null)
            return null;

        var acl = new AreaClearList
        {
            Id = clearList.ClearListAreaId,
            Name = clearList.AreaName,
            Order = clearList.AreaOrder,
            PercentHeight = percentHeight,
            Top = BuildClearListSection(clearListData, activeCouriers, 1),
            Middle = BuildClearListSection(clearListData, activeCouriers, 3),
            Bottom = BuildClearListSection(clearListData, activeCouriers, 5)
        };

        return acl;
    }

    private async Task<List<ClearListResult>> GetClearListCouriers(int clearListAreaId)
    {
        var currentDate = infoService.GetCurrentTenantTime();

        // Main courier data query
        var courierData = await (
            from ac in Context.UTL_fncClearListArea_Couriers(clearListAreaId, currentDate)
            join c in Context.TucCouriers on ac.CourierID equals c.UccrId
            join cf in Context.TucCourierFleets on c.CourierFleetId equals cf.UccfId
            join gps in Context.TblCourierGps on c.CourierGpsid equals gps.CourierGpsid into gpsGroup
            from gps in gpsGroup.DefaultIfEmpty()
            where cf.DisplayOnClearlistsDespatch
            select new ClearListResult
            {
                CourierId = ac.CourierID,
                Code = ac.Code +
                       (c.SendJobsViaSms ? "#" : string.Empty) +
                       (gps != null && EF.Functions.DateDiffMinute(gps.Created, currentDate) > 3 ? "*" : string.Empty) +
                       (!c.AutoDespatch ? "^" : string.Empty) +
                       (c.UccrVehicle == "Truck" ? "T" : string.Empty),
                DisplayOrder = ac.DisplayOrder ?? 0,
                Deliver = ac.Deliver,
                DisplayOrderDesc = ac.DisplayOrder == 1 ? ac.Created : null,
                DisplayOrderAsc = ac.DisplayOrder != 1 ? ac.Created : null,
                AutoDespatch = c.AutoDespatch
            }
        ).ToListAsync();

        // Add static separator rows
        var staticRows = new List<ClearListResult>
        {
            new()
            {
                CourierId = null,
                Code = "----",
                DisplayOrder = 2,
                Deliver = "---------",
                DisplayOrderDesc = null,
                DisplayOrderAsc = null,
                AutoDespatch = null
            },
            new()
            {
                CourierId = null,
                Code = "----",
                DisplayOrder = 4,
                Deliver = "---------",
                DisplayOrderDesc = null,
                DisplayOrderAsc = null,
                AutoDespatch = null
            }
        };

        // Combine and sort
        return courierData.Concat(staticRows).OrderBy(x => x.DisplayOrder).ToList();
    }


    private static List<ClearListSection> BuildClearListSection(
        List<ClearListResult> data,
        List<ActiveCourierDto> activeCouriers,
        int displayOrder
    )
    {
        if (data == null)
            return [];

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
            .AsNoTracking()
            .ToListAsync();

        return couriers;
    }

    public async Task<CourierDataDashboardViewModel> GetCourierDetailsForDashboardAsync(int courierId)
    {
        var courierData = await Context.TucCouriers
            .Where(c => c.UccrId == courierId)
            .Select(CourierDataDashboardMapping())
            .AsNoTracking()
            .FirstOrDefaultAsync();

        return courierData;
    }

    public async Task<CourierCompliancePaginatedResponse> GetAllCourierComplianceAsync(
        CourierComplianceFilterRequest request)
    {
        var now = infoService.GetCurrentTenantTime();

        // Ensure valid page and pageSize
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

        // Apply fleet filter
        if (!string.IsNullOrWhiteSpace(request.Fleet))
        {
            query = request.Fleet.ToLower() switch
            {
                "urgent" => query.Where(c => c.CourierFleet != null &&
                                             EF.Functions.Like(c.CourierFleet.UccfName.ToLower(), "%urgent%")),
                "dfrnt" => query.Where(c => c.CourierFleet != null &&
                                            EF.Functions.Like(c.CourierFleet.UccfName.ToLower(), "%dfrnt%")),
                "independent" => query.Where(c => c.CourierFleet != null &&
                                                  EF.Functions.Like(c.CourierFleet.UccfName.ToLower(),
                                                      "%independent%")),
                _ => query
            };
        }

        // Apply type filter
        if (!string.IsNullOrWhiteSpace(request.Type))
        {
            switch (request.Type.ToLower())
            {
                case "drivers_license":
                    // Only include couriers with driver's license data
                    query = query.Where(c => c.DriversLicenseExpiry.HasValue);
                    break;
                case "dg_endorsement":
                    // Only include couriers with DG endorsement
                    query = query.Where(c => c.UccrDangerousGoods == 1 && c.DglicenseExpiry.HasValue);
                    break;
                case "vehicle_wof":
                case "vehicle_rego":
                case "insurance":
                    // These would need additional database fields to filter properly
                    // For now, include all couriers
                    break;
            }
        }

        var expiringThreshold = now.AddDays(30);
        // Apply status filter
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

        var totalCount = await query.CountAsync();

        var totalExpired = await query
            .Where(c => c.DriversLicenseExpiry.HasValue && c.DriversLicenseExpiry.Value < now)
            .CountAsync();

        var totalExpiringSoon = await query
            .Where(c => c.DriversLicenseExpiry.HasValue &&
                        c.DriversLicenseExpiry.Value >= now &&
                        c.DriversLicenseExpiry.Value <= expiringThreshold)
            .CountAsync();

        var totalValid = await query
            .Where(c => !c.DriversLicenseExpiry.HasValue ||
                        c.DriversLicenseExpiry.Value > expiringThreshold)
            .CountAsync();

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

        // Calculate total pages
        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        // Apply pagination and get the data
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
                    c.UccrDangerousGoods == 1 ? c.DglicenseExpiry : c.DriversLicenseExpiry),
            })
            .AsNoTracking()
            .ToListAsync();

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

        // Ensure valid page and pageSize
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Max(1, Math.Min(100, request.PageSize));

        var query = Context.TblAfterHours
            .Where(c => c.CourierId.HasValue)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.SearchTerm))
        {
            var searchPattern = $"%{request.SearchTerm}%";

            query = query.Where(c =>
                EF.Functions.Like(c.Courier.UccrName, searchPattern) ||
                EF.Functions.Like(c.Courier.UccrSurname, searchPattern) ||
                EF.Functions.Like(c.Courier.VehiclePlateNnumber, searchPattern) ||
                EF.Functions.Like(c.Courier.UccrMobile, searchPattern) ||
                EF.Functions.Like(c.Courier.PersonalMobile, searchPattern) ||
                EF.Functions.Like(c.Courier.UccrEmail, searchPattern) ||
                EF.Functions.Like(c.Courier.UccrVehicleModel, searchPattern) ||
                EF.Functions.Like(c.Courier.UccrName + " " + c.Courier.UccrSurname, searchPattern) ||
                EF.Functions.Like(c.DayName, searchPattern) ||
                (c.Courier.Code != null && EF.Functions.Like(c.Courier.Code, searchPattern))
            );
        }

        // Filter by day
        if (!string.IsNullOrWhiteSpace(request.Day)
            && !request.Day.Equals("all", StringComparison.CurrentCultureIgnoreCase))
        {
            query = query.Where(c => EF.Functions.Like(c.DayName, request.Day));
            ;
        }

        var totalCount = await query.CountAsync();
        var totalActiveDrivers = await query
            .Where(c => c.Courier != null &&
                        c.Courier.CourierLogInOut != null &&
                        (c.Courier.CourierLogInOut.LogOutTime == null || c.Courier.CourierLogInOut.LogOutTime > now))
            .CountAsync();

        query = request.OrderBy?.ToLower() switch
        {
            "name" => request.SortDescending
                ? query.OrderByDescending(c => c.Courier.UccrName)
                    .ThenByDescending(c => c.Courier.UccrSurname)
                : query.OrderBy(c => c.Courier.UccrName)
                    .ThenBy(c => c.Courier.UccrSurname),
            "day" => request.SortDescending
                ? query.OrderByDescending(c => c.DayName)
                : query.OrderBy(c => c.DayName),
            "startTime" => request.SortDescending
                ? query.OrderByDescending(c => c.StartTime)
                : query.OrderBy(c => c.StartTime),
            "endTime" => request.SortDescending
                ? query.OrderByDescending(c => c.EndTime)
                : query.OrderBy(c => c.EndTime),
            _ => request.SortDescending
                ? query.OrderByDescending(c => c.StartTime)
                : query.OrderBy(c => c.StartTime)
        };

        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        var afterHoursSchedule = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new AfterHoursCourierScheduleViewModel
            {
                CourierId = c.CourierId.Value,
                CourierName = c.Courier.UccrName + " " + c.Courier.UccrSurname,
                Day = c.DayName,
                StartTime = c.StartTime,
                EndTime = c.EndTime,
                Duration = CalculateDuration(c.StartTime, c.EndTime)
            })
            .AsNoTracking()
            .ToListAsync();

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

    private static Expression<Func<TucCourier, CourierDataDashboardViewModel>> CourierDataDashboardMapping() =>
        c => new CourierDataDashboardViewModel
        {
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
        };
}