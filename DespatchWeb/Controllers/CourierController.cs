using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Models;
using DespatchWeb.Repositories;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Controllers
{
    public class CourierController : Controller
    {
        private CourierRepository _courierRepo;

        public CourierController(CourierRepository courierRepository)
        {
            _courierRepo = courierRepository;

        }
        public async Task<IActionResult> Index()
        {
            var result = await _courierRepo.ClearLists();
            return Json(result);
        }

        public IActionResult ClearListEnvelope(int clearListId)
        {
            var result = _courierRepo.ClearListEnvelope(clearListId);
            return Json(result);
        }

        public async Task<IActionResult> Active()
        {
            var result = await _courierRepo.ActiveCouriers();
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

        public async Task<IActionResult> AllActiveSearch(string searchTerm)
        {
            var result =  await _courierRepo.AllActiveCouriers(searchTerm);
            return Json(result);
        }

        public async Task<IActionResult> AllActive()
        {
            var result = await _courierRepo.AllActiveCouriersAsync();
            return Json(result);
        }


        public IActionResult Location(string code)
        {
            var result = _courierRepo.Location(code);
            return Json(result);
        }

        [HttpGet]
        public async Task<IActionResult> Route(string code, DateTime? start, DateTime? end)
        {
            var result = await _courierRepo.GetCourierRoute(code, start, end);
            return Json(result);
        }

        public async Task<IActionResult> TruckCourierStatus(string courierId)
        {
            var result =  await _courierRepo.TruckCourierStatus(courierId);
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