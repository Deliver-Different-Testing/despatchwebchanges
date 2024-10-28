using System;
using System.Collections.Generic;
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

namespace DespatchWeb.Repositories;

public class CourierRepository : ICourierRepository
{
    private readonly DespatchContext _context;
    private readonly ILogger<CourierRepository> _logger;
    private readonly IMapper _mapper;

    public CourierRepository(DespatchContext context, IMapper mapper, ILogger<CourierRepository> logger)
    {
        _context = context;
        _mapper = mapper;
        _logger = logger;
    }

    public async Task<List<DES_qryTruckCourierStatusResult>> TruckCourierStatusAsync(string courierId)
    {
        var result = await _context.Procedures.DES_qryTruckCourierStatusAsync(courierId);
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

        await _context.Procedures.DES_qdfEvent_InsertAsync(
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

    public List<AvailableCourierPosition> GetAvailableCouriers(decimal minLng, decimal minLat, decimal maxLng,
        decimal maxLat)
    {
        var result = new List<AvailableCourierPosition>();
        _context.LoadStoredProc("DESWEB_stpMapEnvelope")
            .WithSqlParam("@MinimumLongitude", minLng)
            .WithSqlParam("@MinimumLatitude", minLat)
            .WithSqlParam("@MaximumLongitude", maxLng)
            .WithSqlParam("@MaximumLatitude", maxLat)
            .ExecuteStoredProc(handle => { result = handle.ReadToList<AvailableCourierPosition>().ToList(); });
        return result;
    }

    public async Task<List<PotentialCouriersViewModel>> GetPotentialCouriersAsync(int jobId)
    {
        var results = await _context.Procedures.DESWEB_qryPotentialCouriersAsync(jobId);
        return _mapper.Map<List<PotentialCouriersViewModel>>(results);
    }

    /// <summary>
    /// filters by active, sms setting and logged in
    /// </summary>
    /// <returns></returns>
    public async Task<List<ActiveCouriersViewModel>> ActiveCouriersAsync()
    {
        var results = await _context.Procedures.DES_qryCourierCombo_ActiveAsync();
        return _mapper.Map<List<ActiveCouriersViewModel>>(results);
    }

    /// <summary>
    /// All active couriers regardless of logged in or not via search
    /// </summary>
    /// <returns></returns>
    public async Task<List<AllCourierActiveViewModel>> AllActiveCouriersAsync(string searchTerm)
    {
        var results = await _context.Procedures.DESWeb_qryCourierComboAsync(searchTerm);

        return results.Select(r => new AllCourierActiveViewModel
        {
            ID = r.ID,
            Text = r.Text
        }).ToList();
    }

    public async Task<List<CourierPosition>> GetCourierRouteAsync(string code, DateTime? start, DateTime? end)
    {
        var results = await _context.Procedures.MAP_stpCourierGPS_LastPositionTodayAsync(code);
        return _mapper.Map<List<CourierPosition>>(results);
    }

    /// <summary>
    /// All active couriers regardless of logged in or not
    /// </summary>
    /// <returns></returns>
    public async Task<List<ActiveCouriersViewModel>> AllActiveCouriersAsync()
    {
        var results = await _context.Procedures.DESWEB_qryCourierActiveAsync();
        return _mapper.Map<List<ActiveCouriersViewModel>>(results);
    }

    public CourierLocation Location(string code)
    {
        var currentLocation = new CourierLocation();
        _context.LoadStoredProc("MAP_stpCourierGPS_LastPositionToday")
            .WithSqlParam("@CourierCode", code)
            .ExecuteStoredProc(handle => { currentLocation = handle.ReadToList<CourierLocation>().FirstOrDefault(); });
        return currentLocation;
    }

    public async Task<int> ClearListTotalRemainingAsync(string area)
    {
        var filter =
            _context.TblDespatchViews.FirstOrDefault(v =>
                (v.ShowOnAssistDespatch ?? false) == true && v.Name == area)?.WhereCondition;

        if (string.IsNullOrEmpty(filter))
            return 0;

        filter += " AND (ucjbStatus <> 9 AND ucjbCourierId is null)";
        var query =
            $"select *, null as CourierLatitude, null as CourierLongitude from DESWEB_qryDespatch where {filter}";
        var jobs = await _context.DeswebQryDespatches.FromSqlRaw(query).ToListAsync();
        return jobs.Count;
    }

    public async Task<ClearListEnvelopeViewModel> GetClearListAreaEnvelopeAsync(int clearListAreaId,
        Country country, bool includeCouriers = false)
    {
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
            var activeCouriersTask = _context.Procedures.DES_qryCourierCombo_ActiveAsync();

            var clearListsQuery = await _context.TblDespatchViews
                .Where(dv => despatchViewIds.Contains(dv.DespatchViewId))
                .SelectMany(dv => dv.DespatchViewZoneGroups)
                .Select(dvzg => dvzg.ZoneGroup.ClearListArea)
                .Where(cla => cla != null) // Filter nulls early
                .Distinct()
                .ToListAsync();

            var activeCouriers = await activeCouriersTask; // Await parallel task

            // Process clear lists in parallel
            var viewModel = new ClearListViewModel
            {
                Areas = new List<AreaClearList>()
            };

            var areaTasks = clearListsQuery.Select(async clearList =>
            {
                var areaClearList = await BuildClearListViewModel(activeCouriers, clearList, 33);
                if (areaClearList == null) return null;

                var clearListName = clearList.Name?.ToLower();
                areaClearList.TotalRemaining = await ClearListTotalRemainingAsync(clearListName);
                return areaClearList;
            });

            var areas = await Task.WhenAll(areaTasks);
            viewModel.Areas.AddRange(areas.Where(a => a != null));

            return viewModel;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in GetClearListsAsync for despatchViewIds: {@DespatchViewIds}",
                despatchViewIds);
            throw;
        }
    }

    public async Task<string> GetAirportCodeByIdAsync(int airportId)
    {
        return await _context.TblAirports
            .Where(a => a.AirportId == airportId)
            .Select(a => a.AirportCode)
            .FirstOrDefaultAsync();
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
        return _context.TblClearListAreas
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
        return _context.TucCouriers
            .SelectMany(c => c.TucJobUcjbCouriers
                .Where(jt => !jt.UcjbJobDone && !jt.UcjbVoid)
                .SelectMany(jt => _context.ZipPolygons
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
        return _context.TucJobs
            .Where(jt => !jt.UcjbJobDone &&
                         !jt.UcjbVoid &&
                         jt.UcjbCourierId == null)
            .SelectMany(jt => _context.ZipPolygons
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
        return _context.TblClearListAreas
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
        return _context.TucCouriers
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
        return _context.TucJobs
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
        IReadOnlyCollection<DES_qryCourierCombo_ActiveResult> activeCouriers, TblClearListArea clearList,
        int percentHeight)
    {
        var result =
            await _context.Procedures.DES_qdfCourier_ClearListsAsync(clearList?.ClearListAreaId);

        var acl = new AreaClearList
        {
            Id = clearList.ClearListAreaId,
            Name = clearList.Name,
            Order = clearList.Order,
            PercentHeight = percentHeight
        };

        var sections = new Dictionary<string, int>
        {
            { "Top", 1 },
            { "Middle", 3 },
            { "Bottom", 5 }
        };

        foreach (var section in sections)
        {
            var sectionData = BuildClearListSection(result, activeCouriers, section.Value);
            if (section.Key != null) typeof(AreaClearList).GetProperty(section.Key)?.SetValue(acl, sectionData);
        }

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