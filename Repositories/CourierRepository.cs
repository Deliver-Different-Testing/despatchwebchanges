using System;
using System.Collections.Generic;
using System.Data.Common;
using System.Linq;
using System.Threading.Tasks;
using AutoMapper;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWebContextExtensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Serilog;

namespace DespatchWeb.Repositories;


public class CourierRepository(IMapper mapper, IDbContextFactory<DespatchContext> contextFactory) : BaseRepository(contextFactory), ICourierRepository
{
    private readonly DbContextWrapper _dbContextWrapper = new DbContextWrapper(contextFactory);

    public async Task<List<TruckCourierStatusViewModel>> TruckCourierStatusAsync(string courierId)
    {
        try
        {
            return await Context.TucCouriers
                .Where(c => c.Active == true
                            && c.UccrVehicle == "Truck"
                            && (courierId == null || c.UccrId.ToString().Contains(courierId)))
                .Select(c => new TruckCourierStatusViewModel
                {
                    CourierId = c.UccrId,
                    CourierCode = c.Code,
                    FirstName = c.UccrName,
                    MaxPallets = c.MaxPallets,
                    MaxPayLoad = c.MaxPayload,
                    CurrentPallets = c.TucJobUcjbCouriers
                        .Where(d => !d.UcjbJobDone && !d.UcjbVoid)
                        .SelectMany(d => d.TucJobItems)
                        .Sum(i => i.Items),
                    CurrentWeight = c.TucJobUcjbCouriers
                        .Where(d => !d.UcjbJobDone && !d.UcjbVoid)
                        .SelectMany(d => d.TucJobItems)
                        .Sum(i => i.Items * i.Weight),
                    AvailablePallets = c.MaxPallets * c.TucJobUcjbCouriers
                        .Where(d => !d.UcjbJobDone && !d.UcjbVoid)
                        .SelectMany(d => d.TucJobItems)
                        .Sum(i => i.Items),
                    AvailablePalletCapacity = c.MaxPayload * c.TucJobUcjbCouriers
                        .Where(d => !d.UcjbJobDone && !d.UcjbVoid)
                        .SelectMany(d => d.TucJobItems)
                        .Sum(i => i.Items * i.Weight),
                })
                .OrderBy(c => c.CourierCode)
                .AsNoTracking()
                .ToListAsync();
        }
        catch (Exception e)
        {
            Log.Error(e, $"An error occured getting truck status for {courierId}");
            throw;
        }
    }

    public async Task AddEventAsync(string jobNo, int clientId, string contact, int staffId, int? courierId,
        int jobId, int jobType, string despatcherName, string notes, int eventType, float? lateTime = null,
        DateTime? etaTime = null, bool close = false)
    {
        int? staffOut = null;
        DateTime? responseTime = null;
        const bool pageCourier = false;

        string description = null;
        var date = DateTime.Now;
        var time = DateTime.Now;

        await Context.Procedures.DES_qdfEvent_InsertAsync(
            jobNo,
            clientId,
            contact,
            date.Date,
            time,
            eventType,
            lateTime,
            etaTime,
            staffId,
            staffOut,
            responseTime,
            notes,
            pageCourier,
            close,
            staffId,
            description,
            courierId,
            jobId,
            despatcherName,
            jobType
        );
    }

    public List<AvailableCourierPosition> GetAvailableCouriers(decimal minLng, decimal minLat, decimal maxLng, decimal maxLat, bool isUsTenant)
    {
        var result = new List<AvailableCourierPosition>();
        var procName = isUsTenant ? "DESWEB_stpUSMapEnvelope" : "DESWEB_stpMapEnvelope";
        Context.LoadStoredProc(procName)
            .WithSqlParam("@MinimumLongitude", minLng)
            .WithSqlParam("@MinimumLatitude", minLat)
            .WithSqlParam("@MaximumLongitude", maxLng)
            .WithSqlParam("@MaximumLatitude", maxLat)
            .ExecuteStoredProc(handle => { result = handle.ReadToList<AvailableCourierPosition>().ToList(); });
        return result;
    }

    public async Task<List<PotentialCouriersViewModel>> GetPotentialCouriersAsync(int jobId)
    {
        var results = await Context.Procedures.DESWEB_qryPotentialCouriersAsync(jobId);
        return mapper.Map<List<PotentialCouriersViewModel>>(results);
    }

    public async Task<List<ActiveCouriersViewModel>> ActiveCouriersAsync()
    {
        try
        {
            var results = await Context.Procedures.DES_qryCourierCombo_ActiveAsync();
            return mapper.Map<List<ActiveCouriersViewModel>>(results);
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
            Log.Information("Starting AllActiveCouriersAsync search with term: {SearchTerm}", searchTerm);

            var results = await Context.TucCouriers
                .Where(c => c.Active == true &&
                            (c.Code + " " + c.UccrName + " " + c.UccrSurname)
                            .Contains(searchTerm))
                .OrderBy(c => c.Code)
                .Select(c => new Suggestion
                {
                    Id = c.UccrId,
                    Text = c.UccrName + " " + c.UccrSurname
                })
                .AsNoTracking()
                .ToListAsync();

            Log.Information("AllActiveCouriersAsync completed. Found {Count} active couriers", results.Count);
            return results;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error in AllActiveCouriersAsync with search term {SearchTerm}", searchTerm);
            throw;
        }
    }

    public async Task<List<CourierPosition>> GetCourierRouteAsync(string code, DateTime? start, DateTime? end)
    {
        try
        {
            Log.Information("Getting courier route for code: {CourierCode}, start: {StartDate}, end: {EndDate}",
                code, start, end);

            var results = await Context.Procedures.MAP_stpCourierGPS_LastPositionTodayAsync(code);
            var mappedResults = mapper.Map<List<CourierPosition>>(results);

            Log.Information("Retrieved {Count} position records for courier {CourierCode}",
                mappedResults.Count, code);
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

            var results = await Context.Procedures.DESWEB_qryCourierActiveAsync();
            var mappedResults = mapper.Map<List<ActiveCouriersViewModel>>(results);

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
            Context.LoadStoredProc("MAP_stpCourierGPS_LastPositionToday")
                .WithSqlParam("@CourierCode", code)
                .ExecuteStoredProc(handle =>
                {
                    currentLocation = handle.ReadToList<CourierLocation>().FirstOrDefault();
                });

            if (currentLocation != null)
            {
                Log.Information("Retrieved location for courier {CourierCode}: Lat={Latitude}, Long={Longitude}",
                    code, currentLocation.Latitude, currentLocation.Longitude);
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
        bool includeCouriers = false)
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

    public async Task<ClearListViewModel> GetClearListsAsync(List<int> despatchViewIds, bool isUsTenant)
    {
        try
        {
            var dbContext = _dbContextWrapper.GetContext();
            // Get all required data upfront
            var activeCouriers = await Context.Procedures.DES_qryCourierCombo_ActiveAsync();
            var query = Context.TblDespatchViews.AsQueryable();

            // If view(s) provided, filter to these
            if (despatchViewIds.Any())
            {
                query = query.Where(dv => despatchViewIds.Contains(dv.DespatchViewId));
            }

            // Get the results
            var clearLists = await query.SelectMany(dv => dv.DespatchViewZoneGroups)
                .Select(dvzg => dvzg.ZoneGroup.ClearListArea)
                .Where(cla => cla != null)
                .Distinct()
                .Select(cl => new { cl.ClearListAreaId, cl.Name, cl.Order })
                .ToListAsync();

            // Process each clear list sequentially to avoid DbContext threading issues
            var areas = new List<AreaClearList>();
            foreach (var clearList in clearLists)
            {
                var areaClearList = await BuildClearListViewModel(activeCouriers, clearList, 33, isUsTenant);
                if (areaClearList == null) continue;

                areaClearList.TotalRemaining = await ClearListTotalRemainingAsync(clearList.Name?.ToLower());
                areas.Add(areaClearList);
            }

            return new ClearListViewModel { Areas = areas };
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error in GetClearListsAsync for despatchViewIds: {@DespatchViewIds}",
                despatchViewIds);
            throw;
        }
    }

    public async Task<List<Suggestion>> GetVehicleSizesAsync()
    {
        return await Context.VehicleSizes.Select(v => new Suggestion
        {
            Id = v.VehicleSizeId, Text = v.VehicleName
        }).ToListAsync();
    }

    public async Task<List<Suggestion>> GetAllRegionsAsync()
    {
        var regions = await Context.TblBulkRegions
            .OrderBy(r => r.Name)
            .Select(r => new Suggestion
            {
                Id = r.BulkRegionId,
                Text = r.Name
            }).AsNoTracking().ToListAsync();

        return regions;
    }

    public async Task<List<Suggestion>> GetAllSpeedsAsync()
    {
        var speeds = await Context.TucJobTypes
            .OrderBy(r => r.UcjtName)
            .Select(r => new Suggestion
            {
                Id = r.UcjtId,
                Text = r.UcjtName
            }).AsNoTracking().ToListAsync();

        return speeds;
    }

    public async Task<string> GetAirportCodeByIdAsync(int airportId)
    {
        try
        {
            Log.Information("Looking up airport code for ID: {AirportId}", airportId);

            var airportCode = await Context.TblAirports
                .Where(a => a.AirportId == airportId)
                .Select(a => a.AirportCode)
                .AsNoTracking()
                .FirstOrDefaultAsync();

            if (airportCode != null)
            {
                Log.Information("Found airport code {AirportCode} for ID {AirportId}", airportCode, airportId);
            }
            else
            {
                Log.Warning("No airport found for ID {AirportId}", airportId);
            }

            return airportCode;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error looking up airport code for ID {AirportId}", airportId);
            throw;
        }
    }

    private async Task<int> ClearListTotalRemainingAsync(string area)
    {
        var filter =
            Context.TblDespatchViews.FirstOrDefault(v =>
                (v.ShowOnAssistDespatch ?? false) == true && v.Name == area)?.WhereCondition;

        if (string.IsNullOrEmpty(filter))
            return 0;

        filter += " AND (ucjbStatus <> 9 AND ucjbCourierId is null)";
        var query =
            $"select *, null as CourierLatitude, null as CourierLongitude from DESWEB_qryDespatch where {filter}";
        var jobs = await Context.DeswebQryDespatches.FromSqlRaw(query).ToListAsync();
        return jobs.Count;
    }

    private async Task<ClearListEnvelopeViewModel> GetClearListEnvelopeUsAsync(int clearListAreaId,
        bool includeCouriers)
    {
        var query = GetClearListAreaBoundariesQuery(clearListAreaId);

        if (!includeCouriers) return await CalculateEnvelopeAsync(query);
        var courierLocationsQuery = GetCourierLocationsQueryUs(clearListAreaId);
        var unassingedJobLocationsQuery = GetUnassignedJobLocationsQueryUs(clearListAreaId);

        query = (query ?? throw new InvalidOperationException())
            .Concat(courierLocationsQuery ?? throw new InvalidOperationException())
            .Concat(unassingedJobLocationsQuery ?? throw new InvalidOperationException());

        return await CalculateEnvelopeAsync(query);
    }

    private async Task<ClearListEnvelopeViewModel> GetClearListEnvelopeNzAsync(int clearListAreaId,
        bool includeCouriers)
    {
        var query = GetAreaPolygonsQueryNz(clearListAreaId);

        if (!includeCouriers) return await CalculateEnvelopeAsync(query);
        var courierLocationsQuery = GetCourierLocationsQueryNz(clearListAreaId);
        var unassignedJobsQuery = GetUnassignedJobLocationsQueryNz(clearListAreaId);

        query = (query ?? throw new InvalidOperationException())
            .Concat(courierLocationsQuery ?? throw new InvalidOperationException())
            .Concat(unassignedJobsQuery ?? throw new InvalidOperationException());

        return await CalculateEnvelopeAsync(query);
    }

    private IQueryable<EnvelopeCoordinate> GetClearListAreaBoundariesQuery(int clearListAreaId)
    {
        return Context.TblClearListAreas
            .Where(area => area.ClearListAreaId == clearListAreaId)
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
        return Context.TucCouriers
            .SelectMany(c => c.TucJobUcjbCouriers
                .Where(jt => !jt.UcjbJobDone && !jt.UcjbVoid)
                .SelectMany(jt => Context.ZipPolygons
                    .Where(zp => zp.Latitude == jt.PickUpLatitude && zp.Longitude == jt.PickUpLongitude)
                    .SelectMany(zp => zp.TblClearListAreaPolygons
                        .Where(clap => clap.ClearListArea.ClearListAreaId == clearListAreaId &&
                                       clap.ClearListArea.ChannelId == c.UccrChannelId)
                        .Select(clap => new
                        {
                            Courier = c,
                            Job = jt,
                        })
                    )
                )
            )
            .Where(x => //x.Courier.CourierLogInOut.LogInTime.Date == DateTime.Now &&
                        x.Courier.CourierLogInOut.LogOutTime == null)
            .Select(x => new EnvelopeCoordinate
            {
                Longitude = (decimal)x.Courier.CourierGps.Longitude,
                Latitude = (decimal)x.Courier.CourierGps.Latitude
            });
    }

    private IQueryable<EnvelopeCoordinate> GetUnassignedJobLocationsQueryUs(int clearListAreaId)
    {
        return Context.TucJobs
            .Where(jt => !jt.UcjbJobDone &&
                         !jt.UcjbVoid &&
                         jt.UcjbCourierId == null)
            .SelectMany(jt => Context.ZipPolygons
                .Where(zp => zp.Latitude == jt.PickUpLatitude &&
                             zp.Longitude == jt.PickUpLongitude)
                .SelectMany(zp => zp.TblClearListAreaPolygons
                    .Where(clazp => clazp.ClearListAreaId == clearListAreaId)
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
        return Context.TblClearListAreas
            .Where(cla => cla.ClearListAreaId == clearListAreaId)
            .SelectMany(cla => cla.TblClearListAreaPolygons
                .SelectMany(clap => clap.Polygon.TblPolygonGps
                    .Select(pgps => new EnvelopeCoordinate
                    {
                        Longitude = pgps.Longitude,
                        Latitude = pgps.Latitude
                    })
                ));
    }

    private IQueryable<EnvelopeCoordinate> GetCourierLocationsQueryNz(int clearListAreaId)
    {
        return Context.TucCouriers
            .Where(c => c.CourierLogInOut.LogInTime.Date == DateTime.Now &&
                        c.CourierLogInOut.LogOutTime == null)
            .SelectMany(c => c.TucJobUcjbCouriers
                .Where(jt => !jt.UcjbJobDone &&
                             !jt.UcjbVoid)
                .SelectMany(jt => jt.UcjbToNavigation.TblPolygonSuburbs
                    .SelectMany(dps => dps.Polygon.TblClearListAreaPolygons
                        .Where(dclap => dclap.ClearListArea.ClearListAreaId == clearListAreaId &&
                                        dclap.ClearListArea.ChannelId == c.UccrChannelId)
                        .Select(dclap => new EnvelopeCoordinate
                        {
                            Longitude = (decimal)c.CourierGps.Longitude,
                            Latitude = (decimal)c.CourierGps.Latitude
                        })
                    )
                ));
    }

    private IQueryable<EnvelopeCoordinate> GetUnassignedJobLocationsQueryNz(int clearListAreaId)
    {
        return Context.TucJobs
            .Where(jt => !jt.UcjbJobDone &&
                         !jt.UcjbVoid &&
                         jt.UcjbCourierId == null)
            .SelectMany(jt => jt.UcjbToNavigation.TblPolygonSuburbs
                .SelectMany(ps => ps.Polygon.TblClearListAreaPolygons
                    .Where(clap => clap.ClearListAreaId == clearListAreaId)
                    .Select(clap => new EnvelopeCoordinate
                    {
                        Longitude = (decimal)jt.DeliveryLongitude,
                        Latitude = (decimal)jt.DeliveryLatitude
                    })
                ));
    }

    private static async Task<ClearListEnvelopeViewModel> CalculateEnvelopeAsync(IQueryable<EnvelopeCoordinate> query)
    {
        var result = await query.GroupBy(_ => 1)
            .Select(g => new ClearListEnvelopeViewModel
            {
                MinimumLongitude = g.Min(x => x.Longitude),
                MinimumLatitude = g.Min(x => x.Latitude),
                MaximumLongitude = g.Max(x => x.Longitude),
                MaximumLatitude = g.Max(x => x.Latitude)
            }).FirstOrDefaultAsync();

        return result ?? new ClearListEnvelopeViewModel();
    }

    private async Task<AreaClearList> BuildClearListViewModel(
        IReadOnlyCollection<DES_qryCourierCombo_ActiveResult> activeCouriers,
        dynamic clearList,
        int percentHeight,
        bool isUsTenant)
    {
        // Combine multiple queries into one
        var clearListData = isUsTenant
            ? await Context.Procedures.DES_qdfUS_Courier_ClearListsAsync(clearList.ClearListAreaId) 
            : await Context.Procedures.DES_qdfCourier_ClearListsAsync(clearList.ClearListAreaId);

        if (clearListData == null) return null;

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

    private static List<ClearListSection> BuildClearListSection(IEnumerable<DES_qdfCourier_ClearListsResult> result,
        IReadOnlyCollection<DES_qryCourierCombo_ActiveResult> activeCouriers, int displayOrder)
    {
        if (result == null)
            return new List<ClearListSection>();

        return result.Where(c => c.DisplayOrder == displayOrder)
            .Select(x => new ClearListSection
            {
                CourierNumber = x.Hash,
                CourierData = BuildCourierData(x, activeCouriers),
                Destinations = BuildDestinations(x.Deliver)
            }).ToList();
    }

    private static CourierData BuildCourierData(DES_qdfCourier_ClearListsResult x,
        IReadOnlyCollection<DES_qryCourierCombo_ActiveResult> activeCouriers)
    {
        if (activeCouriers == null) return new CourierData();
        var activeCourier = activeCouriers.FirstOrDefault(c => c?.CourierID == x?.CourierID);

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
        return deliver?.Split(',')
            .Select((d, index) => new Destination
            {
                Id = index + 1,
                Label = d.Trim()
            })
            .Where(y => !string.IsNullOrWhiteSpace(y.Label))
            .ToList() ?? new List<Destination>();
    }
}
