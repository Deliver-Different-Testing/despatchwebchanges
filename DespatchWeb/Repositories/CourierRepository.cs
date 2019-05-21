
using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Models;
using System.Linq.Dynamic.Core;
using DespatchWebContextExtensions;
using Microsoft.EntityFrameworkCore;
using Remotion.Linq.Clauses;

namespace DespatchWeb.Repositories
{
    public class CourierRepository
    {
        private readonly DespatchWebDataContext _context;

        public CourierRepository(DespatchWebDataContext context)
        {
            _context = context;
        }

        public List<ActiveCouriersViewModel> ActiveCouriers()
        {
            var activeCouriers = new List<ActiveCouriersViewModel>();
            _context.LoadStoredProc("DES_qryCourierCombo_Active")
                .ExecuteStoredProc(handle =>
                {
                    activeCouriers = handle.ReadToList<ActiveCouriersViewModel>().ToList();
                });
            return activeCouriers;
        }

        public CourierLocation Location(string code)
        {
            var currentLocation = new CourierLocation();
            _context.LoadStoredProc("MAP_stpCourierGPS_LastPositionToday")
                .ExecuteStoredProc(handle =>
                    {
                        currentLocation = handle.ReadToList<CourierLocation>().FirstOrDefault();
                    });
            return currentLocation;
        }

        public ClearListViewModel ClearLists()
        {
            var activeCouriers = new List<ActiveCouriersViewModel>();
            _context.LoadStoredProc("DES_qryCourierCombo_Active")
                .ExecuteStoredProc(handle =>
                {
                    activeCouriers = handle.ReadToList<ActiveCouriersViewModel>().ToList();
                });
            var data = new ClearListViewModel
            {
                Central = BuildClearListViewModel(activeCouriers, 1, 70),
                Other = BuildClearListViewModel(activeCouriers, 8, 30),
                WestMid = BuildClearListViewModel(activeCouriers, 6, 33),
                EastMid = BuildClearListViewModel(activeCouriers, 16, 33),
                ShallowWest = BuildClearListViewModel(activeCouriers, 9, 33),
                DeepWest = BuildClearListViewModel(activeCouriers, 5, 33),
                ShallowShore = BuildClearListViewModel(activeCouriers, 7, 33),
                DeepShore = BuildClearListViewModel(activeCouriers, 18, 33),
                Mangere = BuildClearListViewModel(activeCouriers, 17, 33),
                DeepSouth = BuildClearListViewModel(activeCouriers, 17, 33),
                DeepEast = BuildClearListViewModel(activeCouriers, 3, 33)
            };

            return data;
        }

        private AreaClearList BuildClearListViewModel(IReadOnlyCollection<ActiveCouriersViewModel> activeCouriers, int clearListId, int percentHeight)
        {
            var result = new List<CourierClearListViewModel>();
            _context.LoadStoredProc("DES_qdfCourier_ClearLists")
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
                        Eta2lrm = "25 Min"
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
                        Eta2lrm = "25 Min"
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