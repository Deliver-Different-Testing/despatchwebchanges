using System;
using System.Collections.Generic;
using System.Data.Common;
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

public class CourierRepository(
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantInfoService infoService,
    IClearListEnvelopeService clearListEnvelopeService)
    : BaseRepository(contextFactory),
        ICourierRepository
{
    public async Task<ActiveCouriersViewModel> GetCourierByIdAsync(int courierId)
    {
        var now = infoService.GetCurrentTenantTime();
        var courier = await Context.TucCouriers
            .AsNoTracking()
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
                .AsNoTracking()
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
        var isUsTenant = infoService.IsUsTenant();
        return isUsTenant
            ? await GetUsAvailableCourierPositionsAsync(data)
            : await GetNzAvailableCourierPositionsAsync(data);
    }

    private async Task<List<AvailableCourierPosition>> GetUsAvailableCourierPositionsAsync(CourierLocationRequest data)
    {
        var currentDate = infoService.GetCurrentTenantTime();
        var uaFleetIds = new[] { 32, 33, 34, 35, 36, 37, 38, 64 };

        var courierData = await Context.TucCouriers
            .AsNoTracking()
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
                DisplayOrder = c.TblClearListAreaOrder != null ? c.TblClearListAreaOrder.Status : null,
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
            .ToListAsync();

        var result = courierData.Select(c => new AvailableCourierPosition
        {
            CourierId = c.CourierId,
            CourierName = c.CourierName,
            Latitude = c.Latitude,
            Longitude = c.Longitude,
            ChannelId = c.ChannelId,
            VehicleType = MapVehicleTypeToAbbreviation(c.VehicleType),
            ClearListAreaIDs = c.ClearListAreaIDs,
            Code = c.Code,
            FleetCode = c.FleetCode,
            TotalJobs = c.TotalJobs,
            OverDueJobs = c.Jobs.Count(j =>
                j.UcjbTime != null &&
                j.UcjbDate.Add(j.UcjbTime.Value.TimeOfDay).AddMinutes(j.Minutes) < currentDate),
            DisplayOrder = c.DisplayOrder
        }).ToList();

        return result;
    }

    private async Task<List<AvailableCourierPosition>> GetNzAvailableCourierPositionsAsync(CourierLocationRequest data)
    {
        var couriers = await Context.TucCouriers
            .AsNoTracking()
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
                DisplayOrder = c.TblClearListAreaOrder != null ? c.TblClearListAreaOrder.Status : null,
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
            VehicleType = MapVehicleTypeToAbbreviation(dto.VehicleType),
            ClearListAreaIDs = dto.ClearListAreaIDs,
            Code = dto.Code,
            FleetCode = uaFleetIds.Contains(dto.FleetId ?? 0) ? "UA" : string.Empty,
            TotalJobs = dto.TotalJobs,
            OverDueJobs = dto.Jobs.Count(j =>
                j.UcjbTime != null && j.UcjbDate.Add(j.UcjbTime.Value.TimeOfDay).AddMinutes(j.Minutes ?? 0) < now),
            DisplayOrder = dto.DisplayOrder
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
        var isUsTenant = infoService.IsUsTenant();

        try
        {
            Log.Information(
                "Starting AllActiveCouriersAsync search with term: {SearchTerm}",
                searchTerm
            );

            var results = await Context.TucCouriers
                .AsNoTracking()
                .Where(c =>
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
            .AsNoTracking()
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
                JobCount = c.TucJobUcjbCouriers.Count(jt =>
                    !jt.UcjbVoid &&
                    !jt.UcjbJobDone &&
                    jt.UcjbDate.Date <= today.Date)
            })
            .OrderBy(c => c.Code)
            .ToListAsync();
    }

    public async Task<ClearListViewModel> GetClearListsAsync(List<int> despatchViewIds)
    {
        //if (Debugger.IsAttached) return ClearListTestData.GenerateClearListViewModel();

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

            // Group areas into columns matching DespatchWeb_Urgent's vertical layout
            var columnDefinitions = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
            {
                // Column 1
                { "Central", 1 },
                { "Other", 1 },
                // Column 2
                { "West Mid", 2 },
                { "Shallow West", 2 },
                { "Deep West", 2 },
                // Column 3
                { "East Mid", 3 },
                { "Shallow Shore", 3 },
                { "Deep Shore", 3 },
                // Column 4
                { "Mangere", 4 },
                { "Deep South", 4 },
                { "Deep East", 4 }
            };

            var areaDisplayOrder = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
            {
                { "Central", 1 },
                { "Other", 2 },
                { "West Mid", 3 },
                { "Shallow West", 4 },
                { "Deep West", 5 },
                { "East Mid", 6 },
                { "Shallow Shore", 7 },
                { "Deep Shore", 8 },
                { "Mangere", 9 },
                { "Deep South", 10 },
                { "Deep East", 11 }
            };

            clearLists = clearLists
                .OrderBy(cl => areaDisplayOrder.ContainsKey(cl.AreaName ?? "")
                    ? areaDisplayOrder[cl.AreaName]
                    : 999)
                .ToList();

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

            // Group areas into columns for vertical layout
            var columns = new List<ClearListColumn>();
            var assignedAreas = new HashSet<string>();

            for (int columnNum = 1; columnNum <= 4; columnNum++)
            {
                var columnAreas = areas
                    .Where(a => columnDefinitions.ContainsKey(a.Name ?? "")
                        && columnDefinitions[a.Name] == columnNum)
                    .ToList();

                // Track which areas have been assigned to columns
                foreach (var area in columnAreas)
                {
                    assignedAreas.Add(area.Name ?? "");
                }

                if (columnAreas.Any())
                {
                    columns.Add(new ClearListColumn { Areas = columnAreas });
                }
            }

            // Handle areas not in columnDefinitions - order alphabetically by name
            var unassignedAreas = areas
                .Where(a => !assignedAreas.Contains(a.Name ?? ""))
                .OrderBy(a => a.Name, StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (unassignedAreas.Any())
            {
                // If we have predefined columns (NZ tenant), append unassigned to last column
                // If no predefined columns (US/other tenants), distribute horizontally across 4 columns
                if (columns.Any())
                {
                    columns.Last().Areas.AddRange(unassignedAreas);
                }
                else
                {
                    // Distribute unassigned areas horizontally across 4 columns
                    const int maxColumns = 4;
                    for (int i = 0; i < maxColumns; i++)
                    {
                        columns.Add(new ClearListColumn { Areas = new List<AreaClearList>() });
                    }

                    for (int i = 0; i < unassignedAreas.Count; i++)
                    {
                        int columnIndex = i % maxColumns; // Distribute horizontally: 0,1,2,3,0,1,2,3...
                        columns[columnIndex].Areas.Add(unassignedAreas[i]);
                    }
                }
            }

            return new ClearListViewModel
            {
                Areas = areas,
                Columns = columns
            };
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
            .AsNoTracking()
            .OrderBy(v => v.VehicleName)
            .Select(v => new Suggestion { Id = v.VehicleSizeId, Text = v.VehicleName })
            .ToListAsync();

        return vehicles;
    }

    public async Task<List<Suggestion>> GetAllRegionsAsync()
    {
        var regions = await Context.TblBulkRegions
            .AsNoTracking()
            .OrderBy(r => r.Name)
            .Select(r => new Suggestion { Id = r.BulkRegionId, Text = r.Name })
            .ToListAsync();

        return regions;
    }

    public async Task<List<Suggestion>> GetAllSpeedsAsync()
    {
        var speeds = await Context.TucJobTypes
            .AsNoTracking()
            .OrderBy(r => r.UcjtName)
            .Select(r => new Suggestion { Id = r.UcjtId, Text = r.UcjtName })
            .ToListAsync();

        return speeds;
    }

    private async Task<int> ClearListTotalRemainingAsync(string area)
    {
        var filter = Context
            .TblDespatchViews.FirstOrDefault(v => (v.ShowOnAssistDespatch ?? false) == true && v.Name == area)
            ?.WhereCondition;

        if (string.IsNullOrEmpty(filter))
            return 0;

        filter += " AND ((ucjbStatus IS NULL OR ucjbStatus = 0) AND ucjbCourierId is null)";
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
            if (Enum.TryParse<DayOfWeek>(request.Day, true, out var dayOfWeek))
            {
                var dayValue = (int)dayOfWeek;
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

        // Ensure valid page and pageSize
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Max(1, Math.Min(100, request.PageSize));

        var query = Context.TucCouriers
            .Where(c => c.CourierLogInOut != null
                        && c.CourierLogInOut.LogInTime.Date == today.Date).AsQueryable();

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
            c.CourierLogInOut.LogInTime.Date == today.Date).CountAsync();

        var sessionData = await query
            .AsNoTracking()
            .Where(c => c.CourierLogInOut != null && c.CourierLogInOut.LogInTime.Date == today.Date)
            .Select(c => new { c.CourierLogInOut.LogInTime, c.CourierLogInOut.LogOutTime })
            .ToListAsync();

        var averageSessionTime = sessionData.Count != 0
            ? sessionData.Average(s => ((s.LogOutTime ?? today) - s.LogInTime).TotalMinutes)
            : 0.0;

        // Apply sorting
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

        // Calculate total pages
        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        var couriers = await query
            .AsNoTracking()
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
                Duration = CourierActiveDuration(c.CourierLogInOut.LogInTime, c.CourierLogInOut.LogOutTime ?? today),
                Deliveries = c.TucJobUcjbCouriers != null
                    ? c.TucJobUcjbCouriers.Count(j => j.UcjbDate.Date == today.Date)
                    : 0,
                Status = c.CourierLogInOut.LogOutTime == null ? "Active" : "Inactive"
            })
            .ToListAsync();

        foreach (var courier in couriers)
        {
            courier.LoginTime = TimeZoneHelper.SetDateTimeWithTimeZone(courier.LoginTime, tenantTimeZone);
            courier.LogoutTime = courier.LogoutTime.HasValue
                ? TimeZoneHelper.SetDateTimeWithTimeZone(courier.LogoutTime.Value, tenantTimeZone)
                : null;
        }

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

        var courierDailyEarnings = await query
            .AsNoTracking()
            .Select(c => new CourierDailyEarningsViewModel
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
            .AsNoTracking()
            .Where(c => c.CourierLogInOut != null && c.CourierLogInOut.LogInTime.Date == date.Date)
            .Select(c => new
            {
                HoursLogged =
                    EF.Functions.DateDiffMinute(c.CourierLogInOut.LogInTime, c.CourierLogInOut.LogOutTime ?? date),
                Earnings = c.TucJobUcjbCouriers != null ? c.TucJobUcjbCouriers.Sum(j => j.CourierPayment ?? 0) : 0
            })
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

    public async Task UpdateAfterHoursCourierScheduleAsync(AfterHoursCourierScheduleViewModel request)
    {
        ArgumentNullException.ThrowIfNull(request.StartTime);
        ArgumentNullException.ThrowIfNull(request.EndTime);

        foreach (var dayOfWeek in request.Days.Select(GetDayOfWeekAsInt))
        {
            await Context.TblAfterhoursCouriers
                .Where(c => c.Id == request.AfterHoursScheduleId)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(e => e.StartTime, request.StartTime.Value.DateTime)
                    .SetProperty(e => e.EndTime, request.EndTime.Value.DateTime)
                    .SetProperty(e => e.WeekDay, dayOfWeek)
                );
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

    public async Task DeleteAfterHoursCourierScheduleAsync(int afterHoursScheduleId)
    {
        try
        {
            await Context.TblAfterhoursCouriers
                .Where(s => s.Id == afterHoursScheduleId)
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
            ArgumentNullException.ThrowIfNull(courierCode, nameof(courierCode));

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