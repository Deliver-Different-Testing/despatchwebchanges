using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace DespatchWeb.Controllers
{
    public class CourierController : Controller
    {
        private CourierRepository _courierRepo;

        public CourierController(CourierRepository courierRepository)
        {
            _courierRepo = courierRepository;

        }
        public IActionResult Index()
        {
            var result = _courierRepo.ClearLists();
            return Json(result);
        }

        public IActionResult ClearListEnvelope(int clearListId)
        {
            var result = _courierRepo.ClearListEnvelope(clearListId);
            return Json(result);
        }

        public IActionResult Active()
        {
            var result = _courierRepo.ActiveCouriers();
            return Json(result);
        }

        [HttpGet]
        public IActionResult AvailableCourierLocation(decimal minLng, decimal minLat, decimal maxLng, decimal maxLat)
        {
            var result = _courierRepo.GetAvailableCouriers(minLng, minLat, maxLng, maxLat);
            return Json(result);
        }

        [HttpGet]
        public IActionResult PotentialCouriers(int jobId)
        {
            var result = _courierRepo.GetPotentialCouriers(jobId);
            return Json(result);
        }

        public IActionResult Location(string code)
        {
            var result = _courierRepo.Location(code);
            return Json(result);
        }

        [HttpPost]
        public async Task<IActionResult> AddFollowupEvent(string jobNo, int clientId, string contact, int staffId, int courierId, int jobId, int jobType, string despatcherName)
        {
            await _courierRepo.AddEventAsync(jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName, "Follow up dangerous goods license with courier", 69);
            return Json("OK");
        }
        
    }
}