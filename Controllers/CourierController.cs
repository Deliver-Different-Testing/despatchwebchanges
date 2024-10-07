using DespatchWeb.Repositories;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Threading.Tasks;
using DespatchWeb.Interfaces;
using DespatchWeb.Enums;
using DespatchWeb.Models;
using System.Collections.Generic;

namespace DespatchWeb.Controllers
{
 public class CourierController(ICourierRepository courierRepository) : Controller
 {
     public async Task<IActionResult> Index([FromQuery]List<int> despatchViewIds)
    {
        if (despatchViewIds is { Count: 0 })
            return Json(new ClearListViewModel());

        var result = await courierRepository.GetClearListsAsync(despatchViewIds);
        return Json(result);
    }

    [HttpGet]
    public async Task<IActionResult> ClearListEnvelope(int clearListId, int countryId)
    {
        try
        {
            var country = (Country)countryId;
            var result = await courierRepository.GetClearListAreaEnvelopeAsync(clearListId, country);
            return Json(result);
        }
        catch (Exception e)
        {
            Console.WriteLine(e);
            throw;
        }
    }

    public async Task<IActionResult> Active()
    {
        var result = await courierRepository.ActiveCouriersAsync();
        return Json(result);
    }

    [HttpGet]
    public IActionResult AvailableCourierLocation(decimal minLng, decimal minLat, decimal maxLng, decimal maxLat)
    {
        var result = courierRepository.GetAvailableCouriers(minLng, minLat, maxLng, maxLat);
        return Json(result);
    }

    [HttpGet]
    public async Task<IActionResult> PotentialCouriers(int jobId)
    {
        var result = await courierRepository.GetPotentialCouriersAsync(jobId);
        return Json(result);
    }

    public async Task<IActionResult> AllActiveSearch(string searchTerm)
    {
        var result = await courierRepository.AllActiveCouriersAsync(searchTerm);
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
        var result = await courierRepository.GetCourierRouteAsync(code, start, end);
        return Json(result);
    }

    public async Task<IActionResult> TruckCourierStatus(string courierId)
    {
        var result = await courierRepository.TruckCourierStatusAsync(courierId);
        return Json(result);
    }

    [HttpPost]
    public async Task<IActionResult> AddFollowupEvent(string jobNo, int clientId, string contact, int staffId,
        int courierId, int jobId, int jobType, string despatcherName)
    {
        await courierRepository.AddEventAsync(jobNo, clientId, contact, staffId, courierId, jobId, jobType,
            despatcherName, "Follow up dangerous goods license with courier", 69);
        return Json("OK");
    }
}
}