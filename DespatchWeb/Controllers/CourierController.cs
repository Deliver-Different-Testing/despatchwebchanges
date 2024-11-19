using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace DespatchWeb.Controllers;

public class CourierController : Controller
{
    private readonly ICourierRepository _courierRepo;
    private readonly ILogger<CourierController> _logger;

    public CourierController(ICourierRepository courierRepository, ILogger<CourierController> logger)
    {
        _courierRepo = courierRepository;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> Index([FromQuery] List<int> despatchViewIds)
    {
        try
        {
            var result = await _courierRepo.GetClearListsAsync(despatchViewIds);
            return Json(result);
        }
        catch (Exception e)
        {
            _logger.LogError(e, "An error occured getting clear lists");
            return StatusCode(500);
        }
    }

    [HttpGet]
    public async Task<IActionResult> ClearListEnvelope(int clearListId, int countryId)
    {
        try
        {
            var country = (Country)countryId;
            var result = await _courierRepo.GetClearListAreaEnvelopeAsync(clearListId, country);
            return Json(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting clear list envelopes");
            return StatusCode(500);
        }
    }

    [HttpGet]
    public async Task<IActionResult> Active()
    {
        try
        {
            var result = await _courierRepo.ActiveCouriersAsync();
            return Json(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting active couriers");
            return StatusCode(500);
        }
    }

    [HttpGet]
    public IActionResult AvailableCourierLocation(decimal minLng, decimal minLat, decimal maxLng, decimal maxLat)
    {
        try
        {
            var result = _courierRepo.GetAvailableCouriers(minLng, minLat, maxLng, maxLat);
            return Json(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting available courier locations");
            return StatusCode(500);
        }
    }

    [HttpGet]
    public async Task<IActionResult> PotentialCouriers(int jobId)
    {
        try
        {
            var result = await _courierRepo.GetPotentialCouriersAsync(jobId);
            return Json(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting potential couriers");
            return StatusCode(500);
        }
    }

    [HttpGet]
    public async Task<IActionResult> AllActiveSearch(string searchTerm)
    {
        try
        {
            var result = await _courierRepo.AllActiveCouriersAsync(searchTerm);
            return Json(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching active couriers");
            return StatusCode(500);
        }
    }

    [HttpGet]
    public async Task<IActionResult> AllActive()
    {
        try
        {
            var result = await _courierRepo.AllActiveCouriersAsync();
            return Json(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting all active couriers");
            return StatusCode(500);
        }
    }

    [HttpGet]
    public IActionResult Location(string code)
    {
        try
        {
            var result = _courierRepo.Location(code);
            return Json(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting courier location");
            return StatusCode(500);
        }
    }

    [HttpGet]
    public async Task<IActionResult> Route(string code, DateTime? start, DateTime? end)
    {
        try
        {
            var result = await _courierRepo.GetCourierRouteAsync(code, start, end);
            return Json(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting courier route");
            return StatusCode(500);
        }
    }

    [HttpGet]
    public async Task<IActionResult> TruckCourierStatus(string courierId)
    {
        try
        {
            var result = await _courierRepo.TruckCourierStatusAsync(courierId);
            return Json(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting truck courier status");
            return StatusCode(500);
        }
    }

    [HttpPost]
    public async Task<IActionResult> AddFollowupEvent(string jobNo, int clientId, string contact, int staffId,
        int courierId, int jobId, int jobType, string despatcherName)
    {
        try
        {
            await _courierRepo.AddEventAsync(jobNo, clientId, contact, staffId, courierId, jobId, jobType,
                despatcherName, "Follow up dangerous goods license with courier", 69);
            return Json("OK");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding followup event");
            return StatusCode(500);
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetVehicleSizes()
    {
        try
        {
            var vehicleSizes = await _courierRepo.GetVehicleSizesAsync();
            return Json(vehicleSizes);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting vehicle sizes");
            return StatusCode(500);
        }
    }
}
