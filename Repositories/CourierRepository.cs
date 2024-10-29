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
using DespatchWebContextExtensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Serilog;

namespace DespatchWeb.Repositories;


public class CourierRepository(IMapper mapper, IDbContextFactory<DespatchContext> contextFactory) : BaseRepository(contextFactory), ICourierRepository
{
    private readonly DbContextWrapper _dbContextWrapper = new DbContextWrapper(contextFactory);
    public async Task<List<DES_qryTruckCourierStatusResult>> TruckCourierStatusAsync(string courierId)
    {
        var result = await Context.Procedures.DES_qryTruckCourierStatusAsync(courierId);
        return result;
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

    public List<AvailableCourierPosition> GetAvailableCouriers(decimal minLng, decimal minLat, decimal maxLng, decimal maxLat)
    {
        var result = new List<AvailableCourierPosition>();
        Context.LoadStoredProc("DESWEB_stpMapEnvelope")
            .WithSqlParam("@MinimumLongitude", minLng)
            .WithSqlParam("@MinimumLatitude", minLat)
            .WithSqlParam("@MaximumLongitude", maxLng)
            .WithSqlParam("@MaximumLatitude", maxLat)
            .ExecuteStoredProc(handle => { result = handle.ReadToList<AvailableCourierPosition>().ToList(); });
        return result;
    }

    public async Task<string> GetAirportCodeByIdAsync(int airportId)
    {
        return await Context.TblAirports
            .Where(a => a.AirportId == airportId)
            .Select(a => a.AirportCode)
            .FirstOrDefaultAsync();
    }


    public async Task<List<PotentialCouriersViewModel>> GetPotentialCouriersAsync(int jobId)
    {
        var results = await Context.Procedures.DESWEB_qryPotentialCouriersAsync(jobId);
        return mapper.Map<List<PotentialCouriersViewModel>>(results);
    }

    /// <summary>
    /// filters by active, sms setting and logged in
    /// </summary>
    /// <returns></returns>
    public async Task<List<ActiveCouriersViewModel>> ActiveCouriersAsync()
    {
        try
        {
            var results = await Context.Procedures.DES_qryCourierCombo_ActiveAsync();
            return _mapper.Map<List<ActiveCouriersViewModel>>(results);
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Database error occurred while fetching active couriers");
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error occurred while fetching active couriers");
            throw;
        }
    }

    /// <summary>
    /// All active couriers regardless of logged in or not via search
    /// </summary>
    /// <returns></returns>
    public async Task<List<AllCourierActiveViewModel>> AllActiveCouriersAsync(string searchTerm)
    {
        var results = await Context.Procedures.DESWeb_qryCourierComboAsync(searchTerm);

        return results.Select(r => new AllCourierActiveViewModel
        {
            ID = r.ID,
            Text = r.Text
        }).ToList();
    }

    public async Task<List<CourierPosition>> GetCourierRouteAsync(string code, DateTime? start, DateTime? end)
    {
        var results = await Context.Procedures.MAP_stpCourierGPS_LastPositionTodayAsync(code);
        return mapper.Map<List<CourierPosition>>(results);
    }

    /// <summary>
    /// All active couriers regardless of logged in or not
    /// </summary>
    /// <returns></returns>
    public async Task<List<ActiveCouriersViewModel>> AllActiveCouriersAsync()
    {
        var results = await Context.Procedures.DESWEB_qryCourierActiveAsync();
        return mapper.Map<List<ActiveCouriersViewModel>>(results);
    }


    public CourierLocation Location(string code)
    {
        var currentLocation = new CourierLocation();
        Context.LoadStoredProc("MAP_stpCourierGPS_LastPositionToday")
            .WithSqlParam("@CourierCode", code)
            .ExecuteStoredProc(handle => { currentLocation = handle.ReadToList<CourierLocation>().FirstOrDefault(); });
        return currentLocation;
    }

    public async Task<int> ClearListTotalRemainingAsync(string area)
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

    public async Task<ClearListViewModel> GetClearListsAsync(List<int> despatchViewIds)
    {
        // Early validation
        if (despatchViewIds == null || !despatchViewIds.Any())
            return new ClearListViewModel { Areas = new List<AreaClearList>() };

        try
        {
            var dbContext = _dbContextWrapper.GetContext();
            // Get all required data upfront
            var activeCouriers = await dbContext.Procedures.DES_qryCourierCombo_ActiveAsync();
            var clearLists = await Context.TblDespatchViews
                .Where(dv => despatchViewIds.Contains(dv.DespatchViewId))
                .SelectMany(dv => dv.DespatchViewZoneGroups)
                .Select(dvzg => dvzg.ZoneGroup.ClearListArea)
                .Where(cla => cla != null)
                .Distinct()
                .Select(cl => new { cl.ClearListAreaId, cl.Name, cl.Order })
                .ToListAsync();

            // Process each clear list sequentially to avoid DbContext threading issues
            var areas = new List<AreaClearList>();
            foreach (var clearList in clearLists)
            {
                var areaClearList = await BuildClearListViewModel(activeCouriers, clearList, 33);
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
            .Where(area => area.ClearListAreaId == clearListAreaId) // Added missing filter
            .SelectMany(area => area.TblClearListAreaPolygons)
            .Select(polygon => polygon.ZipPolygon)
            .Select(zipPolygon => new EnvelopeCoordinate
            {
                Longitude = Convert.ToDecimal(zipPolygon.Longitude),
                Latitude = Convert.ToDecimal(zipPolygon.Latitude)
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
            .Where(x => x.Courier.CourierLogInOut.LogInTime.Date == DateTime.Now &&
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
        int percentHeight)
    {
        // Combine multiple queries into one
        var clearListData = await Context.Procedures.DES_qdfCourier_ClearListsAsync(clearList.ClearListAreaId);

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
