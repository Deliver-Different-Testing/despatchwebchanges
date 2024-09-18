using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AutoMapper;
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWebContextExtensions;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

public class CourierRepository : ICourierRepository
{
    private readonly DespatchContext _context;
    private readonly IMapper _mapper;

    public CourierRepository(DespatchContext context, IMapper mapper)
    {
        _context = context;
        _mapper = mapper;
    }

    public async Task<List<DES_qryTruckCourierStatusResult>> TruckCourierStatus(string courierId)
    {
        var result = await _context.Procedures.DES_qryTruckCourierStatusAsync(CourierID: courierId);
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

    public List<AvailableCourierPosition> GetAvailableCouriers(decimal minLng, decimal minLat, decimal maxLng,
        decimal maxLat)
    {
        var result = new List<AvailableCourierPosition>();
        _context.LoadStoredProc(storedProcName: "DESWEB_stpMapEnvelope")
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
        var results = await _context.Procedures.DESWEB_qryPotentialCouriersAsync(JobID: jobId);
        return _mapper.Map<List<PotentialCouriersViewModel>>(source: results);
    }

    /// <summary>
    /// filters by active, sms setting and logged in
    /// </summary>
    /// <returns></returns>
    public async Task<List<ActiveCouriersViewModel>> ActiveCouriersAsync()
    {
        var results = await _context.Procedures.DES_qryCourierCombo_ActiveAsync();
        return _mapper.Map<List<ActiveCouriersViewModel>>(source: results);
    }

    /// <summary>
    /// All active couriers regardless of logged in or not via search
    /// </summary>
    /// <returns></returns>
    public async Task<List<AllCourierActiveViewModel>> AllActiveCouriersAsync(string searchTerm)
    {
        var results = await _context.Procedures.DESWeb_qryCourierComboAsync(SearchTerm: searchTerm);

        return results.Select(selector: r => new AllCourierActiveViewModel
        {
            ID = r.ID,
            Text = r.Text
        }).ToList();
    }

    public async Task<List<CourierPosition>> GetCourierRoute(string code, DateTime? start, DateTime? end)
    {
        var result = new List<CourierPosition>();
        await _context.LoadStoredProc(storedProcName: "MAP_stpCourierGPS_CourierTimeTrace_New")
            .WithSqlParam(paramName: "@CourierCode", paramValue: code)
            .WithSqlParam(paramName: "@StartTime", paramValue: start)
            .WithSqlParam(paramName: "@EndTime", paramValue: end)
            .ExecuteStoredProcAsync(
                handleResults: handle => { result = handle.ReadToList<CourierPosition>().ToList(); });
        return result;
    }

    /// <summary>
    /// All active couriers regardless of logged in or not
    /// </summary>
    /// <returns></returns>
    public async Task<List<ActiveCouriersViewModel>> AllActiveCouriersAsync()
    {
        var results = await _context.Procedures.DESWEB_qryCourierActiveAsync();
        return _mapper.Map<List<ActiveCouriersViewModel>>(source: results);
    }

    public CourierLocation Location(string code)
    {
        var currentLocation = new CourierLocation();
        _context.LoadStoredProc(storedProcName: "MAP_stpCourierGPS_LastPositionToday")
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
            _context.TblDespatchViews.FirstOrDefault(predicate: v =>
                (v.ShowOnAssistDespatch ?? false) == true && v.Name == area)?.WhereCondition;

        if (string.IsNullOrEmpty(value: filter))
            return 0;

        filter += " AND (ucjbStatus <> 9 AND ucjbCourierId is null)";
        var query =
            $"select *, null as CourierLatitude, null as CourierLongitude from DESWEB_qryDespatch where {filter}";
        var jobs = await _context.DeswebQryDespatches.FromSqlRaw(sql: query).ToListAsync();
        return jobs.Count;
    }

    public async Task<ClearListEnvelopeViewModel> ClearListEnvelopeAsync(int id)
    {
        var result =
            await _context.Procedures.MAP_stpClearListArea_EnvelopeAsync(ClearListAreaID: id, IncludeCouriers: false);

        return result == null
            ? _mapper.Map<ClearListEnvelopeViewModel>(result.First())
            : new ClearListEnvelopeViewModel();
    }

    public async Task<ClearListViewModel> ClearLists(int despatchViewId)
    {
        var activeCouriers = await _context.Procedures.DES_qryCourierCombo_ActiveAsync();

        var clearLists = await _context.TblDespatchViews
            .Where(dv => dv.DespatchViewId == despatchViewId)
            .SelectMany(dv => dv.DespatchViewZoneGroups)
            .Select(dvzg => dvzg.ZoneGroup)
            .SelectMany(zg => zg.TblClearListZoneGroups)
            .Select(clzg => clzg.ClearListArea)
            .ToListAsync();

        var viewModel = new ClearListViewModel();
        foreach (var area in clearLists.Select(clear => new AreaClearList
                 {
                     Id = clear.ClearListAreaId,
                     Name = clear.Name,
                     PercentHeight = 33
                 }).Select(area => BuildClearListViewModel(activeCouriers, area.Id, area.PercentHeight)))
        {
            area.TotalRemaining = await ClearListTotalRemainingAsync(area.Name.ToLower());

            viewModel.Areas.Add(area);
        }


        var data = new ClearListViewModel
        {
            Central = BuildClearListViewModel(activeCouriers: activeCouriers, clearListId: 1, percentHeight: 70),
            City = BuildClearListViewModel(activeCouriers: activeCouriers, clearListId: 2, percentHeight: 33),
            Parnell = BuildClearListViewModel(activeCouriers: activeCouriers, clearListId: 12, percentHeight: 33),
            Ponsonby = BuildClearListViewModel(activeCouriers: activeCouriers, clearListId: 15, percentHeight: 33),
            NewMarket = BuildClearListViewModel(activeCouriers: activeCouriers, clearListId: 13, percentHeight: 33),
            Eden = BuildClearListViewModel(activeCouriers: activeCouriers, clearListId: 14, percentHeight: 33),
            Other = BuildClearListViewModel(activeCouriers: activeCouriers, clearListId: 8, percentHeight: 30),
            WestMid = BuildClearListViewModel(activeCouriers: activeCouriers, clearListId: 6, percentHeight: 33),
            EastMid = BuildClearListViewModel(activeCouriers: activeCouriers, clearListId: 16, percentHeight: 33),
            ShallowWest = BuildClearListViewModel(activeCouriers: activeCouriers, clearListId: 9, percentHeight: 33),
            DeepWest = BuildClearListViewModel(activeCouriers: activeCouriers, clearListId: 5, percentHeight: 33),
            ShallowShore = BuildClearListViewModel(activeCouriers: activeCouriers, clearListId: 7, percentHeight: 33),
            DeepShore = BuildClearListViewModel(activeCouriers: activeCouriers, clearListId: 18, percentHeight: 33),
            Mangere = BuildClearListViewModel(activeCouriers: activeCouriers, clearListId: 17, percentHeight: 33),
            DeepSouth = BuildClearListViewModel(activeCouriers: activeCouriers, clearListId: 4, percentHeight: 33),
            DeepEast = BuildClearListViewModel(activeCouriers: activeCouriers, clearListId: 3, percentHeight: 33)
        };

        data.Central.TotalRemaining = await ClearListTotalRemainingAsync(area: "central");
        data.City.TotalRemaining = await ClearListTotalRemainingAsync(area: "city");
        data.Parnell.TotalRemaining = await ClearListTotalRemainingAsync(area: "parnell");
        data.Ponsonby.TotalRemaining = await ClearListTotalRemainingAsync(area: "ponsonby");
        data.NewMarket.TotalRemaining = await ClearListTotalRemainingAsync(area: "newmarket");
        data.Eden.TotalRemaining = await ClearListTotalRemainingAsync(area: "eden");
        data.Other.TotalRemaining = await ClearListTotalRemainingAsync(area: "other");
        data.WestMid.TotalRemaining = await ClearListTotalRemainingAsync(area: "west mid");
        data.EastMid.TotalRemaining = await ClearListTotalRemainingAsync(area: "east mid");
        data.ShallowWest.TotalRemaining = await ClearListTotalRemainingAsync(area: "shallow west");
        data.DeepWest.TotalRemaining = await ClearListTotalRemainingAsync(area: "deep west");
        data.ShallowShore.TotalRemaining = await ClearListTotalRemainingAsync(area: "shallow shore");
        data.DeepShore.TotalRemaining = await ClearListTotalRemainingAsync(area: "deep shore");
        data.Mangere.TotalRemaining = await ClearListTotalRemainingAsync(area: "mangere");
        data.DeepSouth.TotalRemaining = await ClearListTotalRemainingAsync(area: "deep south");
        data.DeepEast.TotalRemaining = await ClearListTotalRemainingAsync(area: "deep east");
        return data;
    }


    private AreaClearList BuildClearListViewModel(IReadOnlyCollection<ActiveCouriersViewModel> activeCouriers,
        int clearListId, int percentHeight)
    {
        var result = new List<CourierClearListViewModel>();
        _context.LoadStoredProc(storedProcName: "DES_qdfCourier_ClearLists")
            .WithSqlParam(paramName: "@ClearListAreaID", paramValue: clearListId)
            .ExecuteStoredProc(handleResults: handle =>
            {
                result = handle.ReadToList<CourierClearListViewModel>().ToList();
            });

        var acl = new AreaClearList
        {
            PercentHeight = percentHeight,
            Top = result.Where(predicate: c => c.DisplayOrder == 1).Select(selector: x => new ClearListSection
            {
                CourierNumber = x.CourierCode,
                CourierData = new CourierData
                {
                    Courier = activeCouriers.FirstOrDefault(predicate: c => c.CourierID == x.CourierID)?.Code + " " +
                              activeCouriers.FirstOrDefault(predicate: c => c.CourierID == x.CourierID)?.Name,
                    Location = "Penrose 373 Neilson St",
                    Pu = "Central 1",
                    Del = "Shallow Shore 3 | Deep Shore 2",
                    Lrm = "36 Min",
                    Eta2Lrm = "25 Min",
                    CourierId = x.CourierID
                },
                Destinations = x.Deliver.Split(separator: ",").Select(selector: d => new Destination
                {
                    Id = 1,
                    Label = d.Trim()
                }).Where(predicate: y => !string.IsNullOrWhiteSpace(value: y.Label)).ToList()
            }).ToList(),
            Middle = result.Where(predicate: c => c.DisplayOrder == 3).Select(selector: x => new ClearListSection
            {
                CourierNumber = x.CourierCode,
                CourierData = new CourierData
                {
                    Courier = activeCouriers.FirstOrDefault(predicate: c => c.CourierID == x.CourierID)?.Code + " " +
                              activeCouriers.FirstOrDefault(predicate: c => c.CourierID == x.CourierID)?.Name,
                    Location = "Penrose 373 Neilson St",
                    Pu = "Central 1",
                    Del = "Shallow Shore 3 | Deep Shore 2",
                    Lrm = "36 Min",
                    Eta2Lrm = "25 Min",
                    CourierId = x.CourierID
                },
                Destinations = x.Deliver.Split(separator: ",").Select(selector: d => new Destination
                {
                    Id = 1,
                    Label = d.Trim()
                }).Where(predicate: y => !string.IsNullOrWhiteSpace(value: y.Label)).ToList()
            }).ToList(),
            Bottom = result.Where(predicate: c => c.DisplayOrder == 5).Select(selector: x => new ClearListSection
            {
                CourierNumber = x.CourierCode,
                CourierData = new CourierData
                {
                    Courier = activeCouriers.FirstOrDefault(predicate: c => c.CourierID == x.CourierID)?.Code + " " +
                              activeCouriers.FirstOrDefault(predicate: c => c.CourierID == x.CourierID)?.Name,
                    Location = "Penrose 373 Neilson St",
                    Pu = "Central 1",
                    Del = "Shallow Shore 3 | Deep Shore 2",
                    Lrm = "36 Min",
                    Eta2Lrm = "25 Min",
                    CourierId = x.CourierID
                },
                Destinations = x.Deliver.Split(separator: ",").Select(selector: d => new Destination
                {
                    Id = 1,
                    Label = d.Trim()
                }).Where(predicate: y => !string.IsNullOrWhiteSpace(value: y.Label)).ToList()
            }).ToList()
        };
        return acl;
    }
}
