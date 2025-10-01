using System;
using System.Collections.Generic;
using System.Data.Common;
using System.Diagnostics;
using System.Linq;
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
using Serilog;

namespace DespatchWeb.Repositories;

public class CourierRepository(IDbContextFactory<DespatchContext> contextFactory, ITenantInfoService infoService, IClearListEnvelopeService clearListEnvelopeService)
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

    public async Task<TruckCourierStatusViewModel> TruckCourierStatusAsync(int courierId)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(courierId);
            const string truckVehicleName = "Truck";

            var courierStatusData = await Context.TucCouriers
                .Where(c => c.Active && c.UccrId == courierId)
                .Select(c => new TruckCourierStatusViewModel
                {
                    CourierId = c.UccrId,
                    CourierCode = c.Code,
                    FirstName = c.UccrName,
                    LastUpdated = c.LastModified,
                    MaxPallets = c.UccrVehicle == truckVehicleName ? c.MaxPallets : null,
                    MaxPayLoad = c.UccrVehicle == truckVehicleName ? c.MaxPayload : null,
                    CurrentPallets = c.UccrVehicle == truckVehicleName
                        ? c.TucJobUcjbCouriers
                            .Where(d => !d.UcjbJobDone && !d.UcjbVoid)
                            .SelectMany(d => d.TucJobItemJobs)
                            .Sum(i => i.Items)
                        : null,
                    CurrentWeight = c.UccrVehicle == truckVehicleName
                        ? c.TucJobUcjbCouriers
                            .Where(d => !d.UcjbJobDone && !d.UcjbVoid)
                            .SelectMany(d => d.TucJobItemJobs)
                            .Sum(i => i.Items * i.Weight)
                        : null,
                    AvailablePallets = c.UccrVehicle == truckVehicleName
                        ? c.MaxPallets - c.TucJobUcjbCouriers
                            .Where(d => !d.UcjbJobDone && !d.UcjbVoid)
                            .SelectMany(d => d.TucJobItemJobs)
                            .Sum(i => i.Items)
                        : null,
                    AvailablePalletCapacity = c.UccrVehicle == truckVehicleName
                        ? c.MaxPayload - c.TucJobUcjbCouriers
                            .Where(d => !d.UcjbJobDone && !d.UcjbVoid)
                            .SelectMany(d => d.TucJobItemJobs)
                            .Sum(i => i.Items * i.Weight)
                        : null
                })
                .AsNoTracking()
                .OrderBy(c => c.CourierCode)
                .FirstOrDefaultAsync();

            return courierStatusData;
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured getting courier status for {CourierId}", courierId);
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
            var results = await GetActiveCouriersAsync();
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
                    && EF.Functions.Like(
                        c.Code + " " + c.UccrName + " " + c.UccrSurname,
                        $"%{searchTerm}%"
                    )
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
                Name = c.UccrName + " " + c.UccrSurname,
                DangerousGoods = c.UccrDangerousGoods == 1,
                DgLicenseExpiry = c.DglicenseExpiry,
                JobCount = c.TucJobUcjbCouriers.Count(jt => !jt.UcjbVoid && !jt.UcjbJobDone)
            })
            .OrderBy(c => c.Code)
            .AsNoTracking()
            .ToListAsync();
    }

    public async Task<ClearListViewModel> GetClearListsAsync(List<int> despatchViewIds)
    {
        if (Debugger.IsAttached) return ClearListTestData.GetTopFiveUsCities();
        
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
        var vehicles = await Context.VehicleSizes
            .OrderBy(v => v.VehicleName)
            .Select(v => new Suggestion { Id = v.VehicleSizeId, Text = v.VehicleName })
            .AsNoTracking()
            .ToListAsync();

        return vehicles;
    }

    public async Task<List<Suggestion>> GetAllRegionsAsync()
    {
        var regions = await Context.TblBulkRegions
            .OrderBy(r => r.Name)
            .Select(r => new Suggestion { Id = r.BulkRegionId, Text = r.Name })
            .AsNoTracking()
            .ToListAsync();

        return regions;
    }

    public async Task<List<Suggestion>> GetAllSpeedsAsync()
    {
        var speeds = await Context.TucJobTypes
            .OrderBy(r => r.UcjtName)
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
        if (request.Fleet != 0) query = query.Where(c => c.CourierFleetId == request.Fleet);

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
            if (Enum.TryParse<DayOfWeek>(request.Day, true, out var dayOfWeek))
            {
                var dayValue = (int)dayOfWeek;
                query = query.Where(c => c.WeekDay == dayValue);
            }
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
            "code" => request.SortDescending
                ? query.OrderByDescending(c => c.Courier.Code)
                : query.OrderBy(c => c.Courier.Code),
            "day" => request.SortDescending
                ? query.OrderByDescending(c => c.WeekDay)
                : query.OrderBy(c => c.WeekDay),
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
                AfterHoursScheduleId = c.Id,
                CourierId = c.CourierId,
                CourierName = c.Courier.UccrName + " " + c.Courier.UccrSurname,
                CourierCode = c.Courier.Code,
                Day = c.WeekDay == 0 ? "Sunday" :
                    c.WeekDay == 1 ? "Monday" :
                    c.WeekDay == 2 ? "Tuesday" :
                    c.WeekDay == 3 ? "Wednesday" :
                    c.WeekDay == 4 ? "Thursday" :
                    c.WeekDay == 5 ? "Friday" :
                    c.WeekDay == 6 ? "Saturday" : "Unknown",
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

    public async Task<TodayActiveDriversPaginatedResponse> GetTodayActiveDriversAsync(
        TodayActiveDriversFilterRequest request)
    {
        var now = infoService.GetCurrentTenantTime();

        // Ensure valid page and pageSize
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Max(1, Math.Min(100, request.PageSize));

        var query = Context.TucCouriers
            .Where(c => c.CourierLogInOut != null
                        && c.CourierLogInOut.LogInTime.Date == now.Date).AsQueryable();

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
        if (request.Fleet != 0) query = query.Where(c => c.CourierFleetId == request.Fleet);

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            query = request.Status.ToLower() switch
            {
                "active" => query.Where(c => c.CourierLogInOut != null &&
                                             c.CourierLogInOut.LogOutTime == null),
                "inactive" => query.Where(c => c.CourierLogInOut != null &&
                                               c.CourierLogInOut.LogOutTime != null),
                _ => query
            };
        }

        var totalCount = await query.CountAsync();
        var totalActiveDrivers =
            await query.Where(c => c.CourierLogInOut != null && c.CourierLogInOut.LogOutTime == null).CountAsync();
        var totalDriversActiveToday = await query.Where(c =>
            c.CourierLogInOut != null && c.CourierLogInOut.LogOutTime == null &&
            c.CourierLogInOut.LogInTime.Date == now.Date).CountAsync();

        var sessionData = await query
            .Where(c => c.CourierLogInOut != null && c.CourierLogInOut.LogInTime.Date == now.Date)
            .Select(c => new { c.CourierLogInOut.LogInTime, c.CourierLogInOut.LogOutTime })
            .AsNoTracking()
            .ToListAsync();

        var averageSessionTime = sessionData.Count != 0
            ? sessionData.Average(s => ((s.LogOutTime ?? now) - s.LogInTime).TotalMinutes)
            : 0.0;

        // Calculate total pages
        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        var couriers = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new TodayActiveDriversViewModel
            {
                CourierId = c.UccrId,
                Code = c.Code,
                Name = c.UccrName + " " + c.UccrSurname,
                Fleet = c.CourierFleet != null ? c.CourierFleet.UccfName : "Not Available",
                LoginTime = c.CourierLogInOut.LogInTime,
                LogoutTime = c.CourierLogInOut.LogOutTime,
                Duration = CourierActiveDuration(c.CourierLogInOut.LogInTime, c.CourierLogInOut.LogOutTime ?? now),
                Deliveries = c.TucJobUcjbCouriers != null
                    ? c.TucJobUcjbCouriers.Count(j => j.UcjbDate.Date == now.Date)
                    : 0,
                Status = c.CourierLogInOut.LogOutTime == null ? "Active" : "Inactive"
            })
            .AsNoTracking()
            .ToListAsync();

        return new TodayActiveDriversPaginatedResponse
        {
            Items = couriers,
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
        if (!logoutTime.HasValue) return "Not Available";
        var duration = logoutTime.Value - loginTime;
        return (int)duration.TotalHours + "h " + duration.Minutes + "m";
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
            .AsNoTracking()
            .ToListAsync();

        return fleetOptions;
    }

    public async Task<CourierDailyEarningsPaginatedResponse> GetCourierDailyEarningsAsync(PaginatedRequest request)
    {
        var now = infoService.GetCurrentTenantTime();

        // Ensure valid page and pageSize
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Max(1, Math.Min(100, request.PageSize));

        var query = Context.TucCouriers
            .Where(c => c.CourierLogInOut != null && c.CourierLogInOut.LogInTime.Date == now.Date).AsQueryable();

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
        var totalDeliveriesToday = await GetCompletedJobCountForDayAsync(now);
        var totalEarningsToday = await GetTotalCourierEarningsForDayAsync(now);
        var averageHourlyRate = await GetAverageHourlyWageForDateAsync(now);

        // Calculate total pages
        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        var courierDailyEarnings = await query.Select(c => new CourierDailyEarningsViewModel
            {
                CourierId = c.UccrId,
                Name = c.UccrName + " " + c.UccrSurname,
                HoursLogged =
                    EF.Functions.DateDiffMinute(c.CourierLogInOut.LogInTime, c.CourierLogInOut.LogOutTime ?? now),
                Deliveries = c.TucJobUcjbCouriers != null
                    ? c.TucJobUcjbCouriers.Count(j => j.UcjbDate.Date == now.Date)
                    : 0,
                Earnings = c.TucJobUcjbCouriers != null ? c.TucJobUcjbCouriers.Sum(j => j.CourierPayment ?? 0) : 0,
                HourlyRate =
                    EF.Functions.DateDiffMinute(c.CourierLogInOut.LogInTime, c.CourierLogInOut.LogOutTime ?? now) >
                    0
                        ? (c.TucJobUcjbCouriers != null ? c.TucJobUcjbCouriers.Sum(j => j.CourierPayment ?? 0) : 0)
                          / (EF.Functions.DateDiffMinute(c.CourierLogInOut.LogInTime,
                                 c.CourierLogInOut.LogOutTime ?? now) /
                             60.0m)
                        : 0
            })
            .AsNoTracking()
            .ToListAsync();

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

    private async Task<int> GetCompletedJobCountForDayAsync(DateTime now)
    {
        var completedCount = await Context.TucJobs
            .Where(j => j.UcjbComplTime.HasValue && j.UcjbComplTime.Value.Date == now.Date)
            .CountAsync();

        return completedCount;
    }

    private async Task<decimal> GetTotalCourierEarningsForDayAsync(DateTime now)
    {
        var totalEarnings = await Context.TucJobs
            .Where(j => j.UcjbComplTime.HasValue && j.UcjbComplTime.Value.Date == now.Date)
            .Select(j => j.CourierPayment)
            .SumAsync();

        return totalEarnings ?? 0;
    }

    private async Task<decimal> GetAverageHourlyWageForDateAsync(DateTime date)
    {
        var courierData = await Context.TucCouriers
            .Where(c => c.CourierLogInOut != null && c.CourierLogInOut.LogInTime.Date == date.Date)
            .Select(c => new
            {
                HoursLogged =
                    EF.Functions.DateDiffMinute(c.CourierLogInOut.LogInTime, c.CourierLogInOut.LogOutTime ?? date),
                Earnings = c.TucJobUcjbCouriers != null ? c.TucJobUcjbCouriers.Sum(j => j.CourierPayment ?? 0) : 0
            })
            .AsNoTracking()
            .ToListAsync();

        var hourlyRates = courierData
            .Where(c => c.HoursLogged > 0)
            .Select(c => c.Earnings / (c.HoursLogged / 60.0m))
            .ToList();

        return hourlyRates.Count != 0 ? hourlyRates.Average() : 0;
    }

    public async Task<PaginatedResponse<CourierEmailViewModel>> GetCourierEmailsAsync(PaginatedRequest request)
    {
        // Ensure valid page and pageSize
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Max(1, Math.Min(100, request.PageSize));

        var query = Context.TucCouriers
            .Where(c => c.UccrEmail != null).AsQueryable();

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

        var courierEmails = await query.Select(c => new CourierEmailViewModel
            {
                CourierId = c.UccrId,
                Code = c.Code,
                Name = c.UccrName + " " + c.UccrSurname,
                Email = c.UccrEmail,
                Phone = c.UccrMobile,
                Fleet = c.CourierFleet != null ? c.CourierFleet.UccfName : "Not Available"
            })
            .AsNoTracking()
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
            .AsNoTracking()
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

    public async Task UpdateAfterHoursCourierScheduleAsync(AfterHoursCourierScheduleViewModel request)
    {
        ArgumentNullException.ThrowIfNull(request.StartTime);
        ArgumentNullException.ThrowIfNull(request.EndTime);
        
        var dayOfWeek = GetDayOfWeekAsInt(request.Day);
        
        var rowsAffected = await Context.TblAfterhoursCouriers
            .Where(c => c.Id == request.AfterHoursScheduleId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(e => e.StartTime, request.StartTime.Value)
                .SetProperty(e => e.EndTime, request.EndTime.Value)
                .SetProperty(e => e.WeekDay, dayOfWeek)
            );

        if (rowsAffected == 0) throw new Exception("After hours schedule not found");
    }

    public async Task CreateAfterHoursCourierScheduleAsync(AfterHoursCourierScheduleViewModel request)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(request.StartTime);
            ArgumentNullException.ThrowIfNull(request.EndTime);

            var dayOfWeek = GetDayOfWeekAsInt(request.Day);
            
            var schedule = new TblAfterhoursCourier
            {
                CourierId = request.CourierId,
                WeekDay = dayOfWeek,
                StartTime = request.StartTime.Value,
                EndTime = request.EndTime.Value
            };
            
            await Context.TblAfterhoursCouriers.AddAsync(schedule);
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
}