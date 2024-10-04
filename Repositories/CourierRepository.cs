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

namespace DespatchWeb.Repositories;


public class CourierRepository(IMapper mapper, IDbContextFactory<DespatchContext> contextFactory) : BaseRepository(contextFactory), ICourierRepository
{
    public async Task<List<DES_qryTruckCourierStatusResult>> TruckCourierStatusAsync(string courierId)
    {
        var result = await Context.Procedures.DES_qryTruckCourierStatusAsync(CourierID: courierId);
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
            JobNo: jobNo,
            ClientID: clientId,
            Contact: contact,
            Date: date.Date,
            Time: time,
            Type: eventType,
            LateTime: lateTime,
            ETATime: etaTime,
            StaffIDIn: staffId,
            StaffIDOut: staffOut,
            ResponseTime: responseTime,
            Notes: notes,
            PageCourier: pageCourier,
            Closed: close,
            Originator: staffId,
            Description: description,
            CourierID: courierId,
            JobID: jobId,
            Despatcher: despatcherName,
            JobType: jobType
        );
    }

    public List<AvailableCourierPosition> GetAvailableCouriers(decimal minLng, decimal minLat, decimal maxLng, decimal maxLat)
    {
        var result = new List<AvailableCourierPosition>();
        Context.LoadStoredProc(storedProcName: "DESWEB_stpMapEnvelope")
            .WithSqlParam(paramName: "@MinimumLongitude", paramValue: minLng)
            .WithSqlParam(paramName: "@MinimumLatitude", paramValue: minLat)
            .WithSqlParam(paramName: "@MaximumLongitude", paramValue: maxLng)
            .WithSqlParam(paramName: "@MaximumLatitude", paramValue: maxLat)
            .ExecuteStoredProc(handleResults: handle =>
            {
                result = handle.ReadToList<AvailableCourierPosition>().ToList();
            });
        return result;
    }

    public async Task<List<PotentialCouriersViewModel>> GetPotentialCouriersAsync(int jobId)
    {
        var results = await Context.Procedures.DESWEB_qryPotentialCouriersAsync(JobID: jobId);
        return mapper.Map<List<PotentialCouriersViewModel>>(source: results);
    }

    /// <summary>
    /// filters by active, sms setting and logged in
    /// </summary>
    /// <returns></returns>
    public async Task<List<ActiveCouriersViewModel>> ActiveCouriersAsync()
    {
        var results = await Context.Procedures.DES_qryCourierCombo_ActiveAsync();
        return mapper.Map<List<ActiveCouriersViewModel>>(source: results);
    }

    /// <summary>
    /// All active couriers regardless of logged in or not via search
    /// </summary>
    /// <returns></returns>
    public async Task<List<AllCourierActiveViewModel>> AllActiveCouriersAsync(string searchTerm)
    {
        var results = await Context.Procedures.DESWeb_qryCourierComboAsync(SearchTerm: searchTerm);

        return results.Select(selector: r => new AllCourierActiveViewModel
        {
            ID = r.ID,
            Text = r.Text
        }).ToList();
    }

    public async Task<List<CourierPosition>> GetCourierRouteAsync(string code, DateTime? start, DateTime? end)
    {
        var results = await Context.Procedures.MAP_stpCourierGPS_LastPositionTodayAsync(CourierCode: code);
        return mapper.Map<List<CourierPosition>>(results);
    }

    /// <summary>
    /// All active couriers regardless of logged in or not
    /// </summary>
    /// <returns></returns>
    public async Task<List<ActiveCouriersViewModel>> AllActiveCouriersAsync()
    {
        var results = await Context.Procedures.DESWEB_qryCourierActiveAsync();
        return mapper.Map<List<ActiveCouriersViewModel>>(source: results);
    }


    public CourierLocation Location(string code)
    {
        var currentLocation = new CourierLocation();
        Context.LoadStoredProc(storedProcName: "MAP_stpCourierGPS_LastPositionToday")
            .WithSqlParam(paramName: "@CourierCode", paramValue: code)
            .ExecuteStoredProc(handleResults: handle =>
            {
                currentLocation = handle.ReadToList<CourierLocation>().FirstOrDefault();
            });
        return currentLocation;
    }

    public async Task<int> ClearListTotalRemainingAsync(string area)
    {
        var filter =
            Context.TblDespatchViews.FirstOrDefault(predicate: v =>
                (v.ShowOnAssistDespatch ?? false) == true && v.Name == area)?.WhereCondition;

        if (string.IsNullOrEmpty(value: filter))
            return 0;

        filter += " AND (ucjbStatus <> 9 AND ucjbCourierId is null)";
        var query =
            $"select *, null as CourierLatitude, null as CourierLongitude from DESWEB_qryDespatch where {filter}";
        var jobs = await Context.DeswebQryDespatches.FromSqlRaw(sql: query).ToListAsync();
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
        var activeCouriers = await Context.Procedures.DES_qryCourierCombo_ActiveAsync();

        var clearLists = await Context.TblDespatchViews
            .Where(dv => despatchViewIds.Contains(dv.DespatchViewId))
            .SelectMany(dv => dv.DespatchViewZoneGroups)
            .Select(dvzg => dvzg.ZoneGroup.ClearListArea)
            .Distinct()
            .ToListAsync();

        var viewModel = new ClearListViewModel();
        foreach (var clearList in clearLists)
        {
            var areaClearList = await BuildClearListViewModel(activeCouriers, clearList, 33);
            if (areaClearList == null) continue;
            areaClearList.TotalRemaining = await ClearListTotalRemainingAsync(clearList?.Name?.ToLower());

            viewModel.Areas?.Add(areaClearList);
        }

        return viewModel;
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
        return from cla in Context.TblClearListAreas
            join clazp in Context.ClearListAreaZipPolygons on cla.ClearListAreaId equals clazp.ClearListAreaId
            join zp in Context.ZipPolygons on clazp.ZipPolygonId equals zp.ZipPolygonId
            where cla.ClearListAreaId == clearListAreaId
            select new EnvelopeCoordinate { Longitude = (decimal)zp.Longitude, Latitude = (decimal)zp.Latitude };
    }

    private IQueryable<EnvelopeCoordinate> GetCourierLocationsQueryUs(int clearListAreaId)
    {
        var today = DateTime.Today;
        return from c in Context.TblCouriers
            join jt in Context.TblJobTodays on c.CourierId equals jt.CourierId
            join zp in Context.ZipPolygons on new { Lat = jt.PickUpLatitude, Lon = jt.PickUpLongitude }
                equals new { Lat = zp.Latitude, Lon = zp.Longitude }
            join clazp in Context.ClearListAreaZipPolygons on zp.ZipPolygonId equals clazp.ZipPolygonId
            join cla in Context.TblClearListAreas on clazp.ClearListAreaId equals cla.ClearListAreaId
            join clio in Context.TblCourierLogInOuts on c.CourierLogInOutId equals clio.CourierLogInOutId
            join cg in Context.TblCourierGps on c.CourierGpsid equals cg.CourierGpsid
            where cla.ClearListAreaId == clearListAreaId
                  && clio.LogInTime.Date == today
                  && clio.LogOutTime == null
                  && jt.JobDone == false
                  && jt.Void == false
                  && cla.ChannelId == c.ChannelId
            select new EnvelopeCoordinate { Longitude = (decimal)cg.Longitude, Latitude = (decimal)cg.Latitude };
    }

    private IQueryable<EnvelopeCoordinate> GetUnassignedJobLocationsQueryUs(int clearListAreaId)
    {
        return from jt in Context.TblJobTodays
            join zp in Context.ZipPolygons on new { Lat = jt.PickUpLatitude, Lon = jt.PickUpLongitude }
                equals new { Lat = zp.Latitude, Lon = zp.Longitude }
            join clazp in Context.ClearListAreaZipPolygons on zp.ZipPolygonId equals clazp.ZipPolygonId
            where clazp.ClearListAreaId == clearListAreaId
                  && jt.JobDone == false
                  && jt.Void == false
                  && jt.CourierId == null
            select new EnvelopeCoordinate
                { Longitude = (decimal)jt.DeliveryLongitude, Latitude = (decimal)jt.DeliveryLatitude };
    }

    private IQueryable<EnvelopeCoordinate> GetAreaPolygonsQueryNz(int clearListAreaId)
    {
        return from cla in Context.TblClearListAreas
            join clap in Context.TblClearListAreaPolygons on cla.ClearListAreaId equals clap.ClearListAreaId
            join pgps in Context.TblPolygonGps on clap.PolygonId equals pgps.PolygonId
            where cla.ClearListAreaId == clearListAreaId
            select new EnvelopeCoordinate { Longitude = pgps.Longitude, Latitude = pgps.Latitude };
    }

    private IQueryable<EnvelopeCoordinate> GetCourierLocationsQueryNz(int clearListAreaId)
    {
        var today = DateTime.Today;
        return from c in Context.TblCouriers
            join jt in Context.TblJobTodays on c.CourierId equals jt.CourierId
            join dps in Context.TblPolygonSuburbs on jt.ToSuburbId equals dps.SuburbId
            join dp in Context.TblPolygons on dps.PolygonId equals dp.PolygonId
            join dclap in Context.TblClearListAreaPolygons on dp.PolygonId equals dclap.PolygonId
            join dcla in Context.TblClearListAreas on dclap.ClearListAreaId equals dcla.ClearListAreaId
            join clio in Context.TblCourierLogInOuts on c.CourierLogInOutId equals clio.CourierLogInOutId
            join cgps in Context.TblCourierGps on c.CourierGpsid equals cgps.CourierGpsid
            where dcla.ClearListAreaId == clearListAreaId
                  && clio.LogInTime.Date == today
                  && clio.LogOutTime == null
                  && jt.JobDone == false
                  && jt.Void == false
                  && dcla.ChannelId == c.ChannelId
            select new EnvelopeCoordinate { Longitude = (decimal)cgps.Longitude, Latitude = (decimal)cgps.Latitude };
    }

    private IQueryable<EnvelopeCoordinate> GetUnassignedJobLocationsQueryNz(int clearListAreaId)
    {
        return from jt in Context.TblJobTodays
            join ps in Context.TblPolygonSuburbs on jt.ToSuburbId equals ps.SuburbId
            join clap in Context.TblClearListAreaPolygons on ps.PolygonId equals clap.PolygonId
            where clap.ClearListAreaId == clearListAreaId
                  && jt.JobDone == false
                  && jt.Void == false
                  && jt.CourierId == null
            select new EnvelopeCoordinate
                { Longitude = (decimal)jt.DeliveryLongitude, Latitude = (decimal)jt.DeliveryLatitude };
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
            await Context.Procedures.DES_qdfCourier_ClearListsAsync(ClearListAreaID: clearList?.ClearListAreaId);

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
