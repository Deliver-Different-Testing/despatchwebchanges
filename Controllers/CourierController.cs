using DespatchWeb.Repositories;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Threading.Tasks;

namespace DespatchWeb.Controllers
{
    public class CourierController(CourierRepository courierRepository) : Controller
    {

        public async Task<IActionResult> Index()
        {
            var result = await courierRepository.ClearLists();
            return Json(result);
        }

        public IActionResult ClearListEnvelope(int clearListId)
        {
            var result = courierRepository.ClearListEnvelope(clearListId);
            return Json(result);
        }

        public async Task<IActionResult> Active()
        {
            var result = await courierRepository.ActiveCouriers();
            return Json(result);
        }


        [HttpGet]
        public IActionResult AvailableCourierLocation(decimal minLng, decimal minLat, decimal maxLng, decimal maxLat)
        {
            var result = courierRepository.GetAvailableCouriers(minLng, minLat, maxLng, maxLat);
            return Json(result);
        }

        [HttpGet]
        public IActionResult PotentialCouriers(int jobId)
        {
            var result = courierRepository.GetPotentialCouriers(jobId);
            return Json(result);
        }

        public async Task<IActionResult> AllActiveSearch(string searchTerm)
        {
            var result =  await courierRepository.AllActiveCouriers(searchTerm);
            return Json(result);
        }

        public async Task<IActionResult> AllActive()
        {
            var result = await courierRepository.AllActiveCouriersAsync();
            return Json(result);
        }


        public IActionResult Location(string code)
        {
            var result = courierRepository.Location(code);
            return Json(result);
        }

        [HttpGet]
        public async Task<IActionResult> Route(string code, DateTime? start, DateTime? end)
        {
            var result = await courierRepository.GetCourierRoute(code, start, end);
            return Json(result);
        }

        public async Task<IActionResult> TruckCourierStatus(string courierId)
        {
            var result =  await courierRepository.TruckCourierStatus(courierId);
            return Json(result);
        }

        [HttpPost]
        public async Task<IActionResult> AddFollowupEvent(string jobNo, int clientId, string contact, int staffId,
            int courierId, int jobId, int jobType, string despatcherName)
        {
            await courierRepository.AddEventAsync(jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName, "Follow up dangerous goods license with courier", 69);
            return Json("OK");
        }

        [HttpGet]
        public async Task<IActionResult> GetSingleCourier(int courierId)
        {
            var result = await _courierRepo.ActiveCouriers();
            var currentCourier = result.FirstOrDefault(c => c.CourierID == courierId);

            var courier = new
            {
                id = currentCourier.CourierID,
                text = currentCourier.Text
            };

            return Json(courier);
        }
    }
}