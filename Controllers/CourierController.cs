using DespatchWeb.Repositories;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Threading.Tasks;
using DespatchWeb.Interfaces;
using DespatchWeb.Enums;
using DespatchWeb.Models;
using System.Collections.Generic;
using Serilog;

namespace DespatchWeb.Controllers
{
 public class CourierController(ICourierRepository courierRepository) : Controller
 {
     public async Task<IActionResult> Index([FromQuery]List<int> despatchViewIds)
    {
        try
        {
            if (despatchViewIds is { Count: 0 })
                despatchViewIds.Add(49);

            var result = await courierRepository.GetClearListsAsync(despatchViewIds);
            return Json(result);
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured getting clear lists");
            return StatusCode(500);
        }
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
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting clear list envelopes");
            return StatusCode(500);
        }
    }

    [HttpGet]
    public async Task<IActionResult> Active()
    {
        try
        {
            var result = await courierRepository.ActiveCouriersAsync();
            return Json(result);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting active couriers");
            return StatusCode(500);
        }
    }

    [HttpGet]
    public IActionResult AvailableCourierLocation(decimal minLng, decimal minLat, decimal maxLng, decimal maxLat)
    {
        try
        {
            var result = courierRepository.GetAvailableCouriers(minLng, minLat, maxLng, maxLat);
            return Json(result);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting available courier locations");
            return StatusCode(500);
        }
    }

    [HttpGet]
    public async Task<IActionResult> PotentialCouriers(int jobId)
    {
        try
        {
            var result = await courierRepository.GetPotentialCouriersAsync(jobId);
            return Json(result);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting potential couriers");
            return StatusCode(500);
        }
    }

    [HttpGet]
    public async Task<IActionResult> AllActiveSearch(string searchTerm)
    {
        try
        {
            var result = await courierRepository.AllActiveCouriersAsync(searchTerm);
            return Json(result);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error searching active couriers");
            return StatusCode(500);
        }
    }

    [HttpGet]
    public async Task<IActionResult> AllActive()
    {
        try
        {
            var result = await courierRepository.AllActiveCouriersAsync();
            return Json(result);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting all active couriers");
            return StatusCode(500);
        }
    }

    [HttpGet]
    public IActionResult Location(string code)
    {
        try
        {
            var result = courierRepository.Location(code);
            return Json(result);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting courier location");
            return StatusCode(500);
        }
    }

    [HttpGet]
    public async Task<IActionResult> Route(string code, DateTime? start, DateTime? end)
    {
        try
        {
            var result = await courierRepository.GetCourierRouteAsync(code, start, end);
            return Json(result);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting courier route");
            return StatusCode(500);
        }
    }

    [HttpGet]
    public async Task<IActionResult> TruckCourierStatus(string courierId)
    {
        try
        {
            var result = await courierRepository.TruckCourierStatusAsync(courierId);
            return Json(result);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting truck courier status");
            return StatusCode(500);
        }
    }

    [HttpPost]
    public async Task<IActionResult> AddFollowupEvent(string jobNo, int clientId, string contact, int staffId,
        int courierId, int jobId, int jobType, string despatcherName)
    {
        try
        {
            await courierRepository.AddEventAsync(jobNo, clientId, contact, staffId, courierId, jobId, jobType,
                despatcherName, "Follow up dangerous goods license with courier", 69);
            return Json("OK");
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error adding followup event");
            return StatusCode(500);
        }
    }
}
}