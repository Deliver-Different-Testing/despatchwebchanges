
using System;
using System.Collections.Generic;
using System.Data.Common;
using System.Linq;
using System.Linq.Expressions;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Models;
using System.Linq.Dynamic.Core;
using DespatchWeb.Controllers;
using DespatchWebContextExtensions;
using Microsoft.EntityFrameworkCore;


namespace DespatchWeb.Repositories
{
    public class CourierRepository(DespatchContext context)
    {
        public async Task<List<DES_qryTruckCourierStatusResult>> TruckCourierStatus(string courierId)
        {
            var result = await context.Procedures.DES_qryTruckCourierStatusAsync(courierId);
            return result;
        }

        public async Task AddEventAsync(string jobNo, int clientId, string contact, int staffId, int? courierId, int jobId, int jobType, string despatcherName, string notes, int eventType, float? lateTime = null, DateTime? etaTime = null, bool close = false)
        {
            int? staffOut = null;
            DateTime? responseTime = null;
            var pageCourier = false;
            
            string description = null;
            var date = DateTime.Now;
            var time = DateTime.Now;


            await context.LoadStoredProc("DES_qdfEvent_Insert")
                .WithSqlParam("@JobNo", jobNo)
                .WithSqlParam("@ClientID", clientId)
                .WithSqlParam("@Contact", contact)
                .WithSqlParam("@Date", date.Date)
                .WithSqlParam("@Time", time)
                .WithSqlParam("@Type", eventType)
                .WithSqlParam("@LateTime", lateTime)
                .WithSqlParam("@ETATime", etaTime)
                .WithSqlParam("@StaffIDIn", staffId)
                .WithSqlParam("@StaffIDOut", staffOut)
                .WithSqlParam("@ResponseTime", responseTime)
                .WithSqlParam("@Notes", notes)
                .WithSqlParam("@PageCourier", pageCourier)
                .WithSqlParam("@Closed", close)
                .WithSqlParam("@Originator", staffId)
                .WithSqlParam("@Description", description)
                .WithSqlParam("@CourierID", courierId)
                .WithSqlParam("@JobID", jobId)
                .WithSqlParam("@Despatcher", despatcherName)
                .WithSqlParam("@JobType", jobType)
                .ExecuteStoredNonQueryAsync();



        }

        public List<AvailableCourierPosition> GetAvailableCouriers(decimal minLng, decimal minLat, decimal maxLng, decimal maxLat)
        {
            var result = new List<AvailableCourierPosition>();
            context.LoadStoredProc("DESWEB_stpMapEnvelope")
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

        public List<PotentialCouriersViewModel> GetPotentialCouriers(int jobId)
        {
            var result = new List<PotentialCouriersViewModel>();
            context.LoadStoredProc("DESWEB_qryPotentialCouriers")
                .WithSqlParam("@JobID", jobId)

                .ExecuteStoredProc(handle =>
                {
                    result = handle.ReadToList<PotentialCouriersViewModel>().ToList();
                });
            return result;
        }

        /// <summary>
        /// filters by active, sms setting and logged in
        /// </summary>
        /// <returns></returns>
        public async Task<List<ActiveCouriersViewModel>> ActiveCouriers()
        {
            var activeCouriers = new List<ActiveCouriersViewModel>();
            await context.LoadStoredProc("DES_qryCourierCombo_Active")
                .ExecuteStoredProcAsync(handle =>
                {
                    activeCouriers = handle.ReadToList<ActiveCouriersViewModel>().ToList();
                });
            return activeCouriers;
        }

        /// <summary>
        /// All active couriers regardless of logged in or not via search
        /// </summary>
        /// <returns></returns>
        public async Task<List<AllCourierActiveViewModel>> AllActiveCouriers(string searchTerm)
        {
            var activeCouriers = new List<AllCourierActiveViewModel>();
            await context.LoadStoredProc("DESWEB_qryCourierCombo")
                .WithSqlParam("@SearchTerm", searchTerm)
                .ExecuteStoredProcAsync(handle =>
                {
                    activeCouriers = handle.ReadToList<AllCourierActiveViewModel>().ToList();
                });
            return activeCouriers;
        }

        public async Task<List<CourierPosition>> GetCourierRoute(string code, DateTime? start, DateTime? end)
        {
            var result = new List<CourierPosition>();
            await context.LoadStoredProc("MAP_stpCourierGPS_CourierTimeTrace_New")
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
            var activeCouriers = new List<ActiveCouriersViewModel>();
            await context.LoadStoredProc("DESWEB_qryCourierActive")
                .ExecuteStoredProcAsync(handle =>
                {
                    activeCouriers = handle.ReadToList<ActiveCouriersViewModel>().ToList();
                });
            return activeCouriers;
        }


        public CourierLocation Location(string code)
        {
            var currentLocation = new CourierLocation();
            context.LoadStoredProc("MAP_stpCourierGPS_LastPositionToday")
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
            context.LoadStoredProc("DES_qryCourierCombo_Active")
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

        internal ClearListEnvelopeViewModel ClearListEnvelope(int id)
        {
            var envelope = new ClearListEnvelopeViewModel();
            context.LoadStoredProc("MAP_stpClearListArea_Envelope")
                .WithSqlParam("@ClearListAreaID", id)
                .WithSqlParam("@IncludeCouriers", false)
                .ExecuteStoredProc(handle => { envelope = handle.ReadToList<ClearListEnvelopeViewModel>().FirstOrDefault(); });
            return envelope;
        }

        public async Task<int> ClearListTotalRemainingAsync(string area)
        {
            var filter =
                context.TblDespatchViews.FirstOrDefault(v =>
                        (v.ShowOnAssistDespatch ?? false) == true && v.Name == area)?.WhereCondition;
            if (string.IsNullOrEmpty(filter))
            {
                return 0;
            }
            filter += " AND (ucjbStatus <> 9 AND ucjbCourierId is null)";
            var s = $"select *, null as CourierLatitude, null as CourierLongitude from DESWEB_qryDespatch where {filter}";
            var jobs = await context.DeswebQryDespatches.FromSqlRaw(s).ToListWithNoLockAsync();
            return jobs.Count;
        }


        private AreaClearList BuildClearListViewModel(IReadOnlyCollection<ActiveCouriersViewModel> activeCouriers, int clearListId, int percentHeight)
        {
            var result = new List<CourierClearListViewModel>();
            context.LoadStoredProc("DES_qdfCourier_ClearLists")
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
}