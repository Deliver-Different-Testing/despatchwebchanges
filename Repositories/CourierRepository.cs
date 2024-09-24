using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AutoMapper;
using DespatchWeb.Controllers;
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWebContextExtensions;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;


public class CourierRepository(IMapper mapper, IDbContextFactory<DespatchContext> contextFactory) : BaseRepository(contextFactory), ICourierRepository
{
    public async Task<List<DES_qryTruckCourierStatusResult>> TruckCourierStatus(string courierId)
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
        Context.LoadStoredProc("DESWEB_stpMapEnvelope")
            .WithSqlParam("@MinimumLongitude", minLng)
            .WithSqlParam("@MinimumLatitude", minLat)
            .WithSqlParam("@MaximumLongitude", maxLng)
            .WithSqlParam("@MaximumLatitude", maxLat)
            .ExecuteStoredProc(handle =>
            {
                result = handle.ReadToList<AvailableCourierPosition>().ToList();
            });
        return result;
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
        var results = await Context.Procedures.DES_qryCourierCombo_ActiveAsync();
        return mapper.Map<List<ActiveCouriersViewModel>>(results);
    }

    /// <summary>
    /// All active couriers regardless of logged in or not via search
    /// </summary>
    /// <returns></returns>
    public async Task<List<AllCourierActiveViewModel>> AllActiveCouriersAsync(string searchTerm)
    {
        var results = await Context.Procedures.DESWeb_qryCourierComboAsync(SearchTerm: searchTerm);

        return results.Select(r => new AllCourierActiveViewModel
        {
            ID = r.ID,
            Text = r.Text
        }).ToList();
    }

    public async Task<List<CourierPosition>> GetCourierRoute(string code, DateTime? start, DateTime? end)
    {
        var result = new List<CourierPosition>();
        await Context.LoadStoredProc("MAP_stpCourierGPS_CourierTimeTrace_New")
            .WithSqlParam("@CourierCode", code)
            .WithSqlParam("@StartTime", start)
            .WithSqlParam("@EndTime", end)
            .ExecuteStoredProcAsync(handle => { result = handle.ReadToList<CourierPosition>().ToList(); });
        return result;
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
            .ExecuteStoredProc(handle =>
                {
                    currentLocation = handle.ReadToList<CourierLocation>().FirstOrDefault();
                });
        return currentLocation;
    }

    public async Task<ClearListViewModel> ClearLists()
    {
        var activeCouriers = new List<ActiveCouriersViewModel>();
        Context.LoadStoredProc("DES_qryCourierCombo_Active")
            .ExecuteStoredProc(handle =>
            {
                activeCouriers = handle.ReadToList<ActiveCouriersViewModel>().ToList();
            });
        var data = new ClearListViewModel
        {
            Central = BuildClearListViewModel(activeCouriers, 1, 70),
            City = BuildClearListViewModel(activeCouriers, 2, 33),
            Parnell = BuildClearListViewModel(activeCouriers, 12, 33),
            Ponsonby = BuildClearListViewModel(activeCouriers, 15, 33),
            NewMarket = BuildClearListViewModel(activeCouriers, 13, 33),
            Eden = BuildClearListViewModel(activeCouriers, 14, 33),
            Other = BuildClearListViewModel(activeCouriers, 8, 30),
            WestMid = BuildClearListViewModel(activeCouriers, 6, 33),
            EastMid = BuildClearListViewModel(activeCouriers, 16, 33),
            ShallowWest = BuildClearListViewModel(activeCouriers, 9, 33),
            DeepWest = BuildClearListViewModel(activeCouriers, 5, 33),
            ShallowShore = BuildClearListViewModel(activeCouriers, 7, 33),
            DeepShore = BuildClearListViewModel(activeCouriers, 18, 33),
            Mangere = BuildClearListViewModel(activeCouriers, 17, 33),
            DeepSouth = BuildClearListViewModel(activeCouriers, 4, 33),
            DeepEast = BuildClearListViewModel(activeCouriers, 3, 33)
        };

        data.Central.TotalRemaining = await ClearListTotalRemainingAsync("central");
        data.City.TotalRemaining = await ClearListTotalRemainingAsync("city");
        data.Parnell.TotalRemaining = await ClearListTotalRemainingAsync("parnell");
        data.Ponsonby.TotalRemaining = await ClearListTotalRemainingAsync("ponsonby");
        data.NewMarket.TotalRemaining = await ClearListTotalRemainingAsync("newmarket");
        data.Eden.TotalRemaining = await ClearListTotalRemainingAsync("eden");
        data.Other.TotalRemaining = await ClearListTotalRemainingAsync("other");
        data.WestMid.TotalRemaining = await ClearListTotalRemainingAsync("west mid");
        data.EastMid.TotalRemaining = await ClearListTotalRemainingAsync("east mid");
        data.ShallowWest.TotalRemaining = await ClearListTotalRemainingAsync("shallow west");
        data.DeepWest.TotalRemaining = await ClearListTotalRemainingAsync("deep west");
        data.ShallowShore.TotalRemaining = await ClearListTotalRemainingAsync("shallow shore");
        data.DeepShore.TotalRemaining = await ClearListTotalRemainingAsync("deep shore");
        data.Mangere.TotalRemaining = await ClearListTotalRemainingAsync("mangere");
        data.DeepSouth.TotalRemaining = await ClearListTotalRemainingAsync("deep south");
        data.DeepEast.TotalRemaining = await ClearListTotalRemainingAsync("deep east");
        return data;
    }

    public async Task<int> ClearListTotalRemainingAsync(string area)
    {
        var filter =
            Context.TblDespatchViews.FirstOrDefault(v =>
                (v.ShowOnAssistDespatch ?? false) == true && v.Name == area)?.WhereCondition;
        if (string.IsNullOrEmpty(filter))
        {
            return 0;
        }

        filter += " AND (ucjbStatus <> 9 AND ucjbCourierId is null)";
        var s =
            $"select *, null as CourierLatitude, null as CourierLongitude from DESWEB_qryDespatch where {filter}";
        var jobs = await Context.DeswebQryDespatches.FromSqlRaw(s).ToListWithNoLockAsync();
        return jobs.Count;
    }

    public ClearListEnvelopeViewModel ClearListEnvelope(int id)
    {
        var envelope = new ClearListEnvelopeViewModel();
        Context.LoadStoredProc("MAP_stpClearListArea_Envelope")
            .WithSqlParam("@ClearListAreaID", id)
            .WithSqlParam("@IncludeCouriers", false)
            .ExecuteStoredProc(handle =>
            {
                envelope = handle.ReadToList<ClearListEnvelopeViewModel>().FirstOrDefault();
            });
        return envelope;
    }


    private AreaClearList BuildClearListViewModel(IReadOnlyCollection<ActiveCouriersViewModel> activeCouriers, int clearListId, int percentHeight)
    {
        var result = new List<CourierClearListViewModel>();
        Context.LoadStoredProc("DES_qdfCourier_ClearLists")
            .WithSqlParam("@ClearListAreaID", clearListId)
            .ExecuteStoredProc(handle => { result = handle.ReadToList<CourierClearListViewModel>().ToList(); });

        var acl = new AreaClearList
        {
            PercentHeight = percentHeight,
            Top = result.Where(c => c.DisplayOrder == 1).Select(x => new ClearListSection()
            {
                CourierNumber = x.CourierCode,
                CourierData = new CourierData()
                {
                    Courier = activeCouriers.FirstOrDefault(c => c.CourierID == x.CourierID)?.Code + " " +
                              activeCouriers.FirstOrDefault(c => c.CourierID == x.CourierID)?.Name,
                    Location = "Penrose 373 Neilson St",
                    Pu = "Central 1",
                    Del = "Shallow Shore 3 | Deep Shore 2",
                    Lrm = "36 Min",
                    Eta2lrm = "25 Min",
                    CourierID = x.CourierID
                },
                Destinations = x.Deliver.Split(",").Select(d => new Destination()
                {
                    Id = 1,
                    Label = d.Trim()
                }).Where(y => !string.IsNullOrWhiteSpace(y.Label)).ToList()
            }).ToList(),
            Middle = result.Where(c => c.DisplayOrder == 3).Select(x => new ClearListSection()
            {
                CourierNumber = x.CourierCode,
                CourierData = new CourierData()
                {
                    Courier = activeCouriers.FirstOrDefault(c => c.CourierID == x.CourierID)?.Code + " " +
                              activeCouriers.FirstOrDefault(c => c.CourierID == x.CourierID)?.Name,
                    Location = "Penrose 373 Neilson St",
                    Pu = "Central 1",
                    Del = "Shallow Shore 3 | Deep Shore 2",
                    Lrm = "36 Min",
                    Eta2lrm = "25 Min",
                    CourierID = x.CourierID
                },
                Destinations = x.Deliver.Split(",").Select(d => new Destination()
                {
                    Id = 1,
                    Label = d.Trim()
                }).Where(y => !string.IsNullOrWhiteSpace(y.Label)).ToList()
            }).ToList(),
            Bottom = result.Where(c => c.DisplayOrder == 5).Select(x => new ClearListSection()
            {
                CourierNumber = x.CourierCode,
                CourierData = new CourierData()
                {
                    Courier = activeCouriers.FirstOrDefault(c => c.CourierID == x.CourierID)?.Code + " " +
                              activeCouriers.FirstOrDefault(c => c.CourierID == x.CourierID)?.Name,
                    Location = "Penrose 373 Neilson St",
                    Pu = "Central 1",
                    Del = "Shallow Shore 3 | Deep Shore 2",
                    Lrm = "36 Min",
                    Eta2lrm = "25 Min",
                    CourierID = x.CourierID
                },
                Destinations = x.Deliver.Split(",").Select(d => new Destination()
                {
                    Id = 1,
                    Label = d.Trim()
                }).Where(y => !string.IsNullOrWhiteSpace(y.Label)).ToList()
            }).ToList()
        };
        return acl;
    }
}