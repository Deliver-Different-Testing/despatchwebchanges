using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.AspNetCore.Mvc;

namespace DespatchWeb.Controllers;

public class CourierController : Controller
{
    private readonly ICourierRepository _courierRepo;

    public CourierController(ICourierRepository courierRepository)
    {
        _courierRepo = courierRepository;
    }

    public async Task<IActionResult> Index(List<int> despatchViewIds)
    {
        if (despatchViewIds is { Count: 0 })
            return Json(new ClearListViewModel());

        var result = await _courierRepo.GetClearListsAsync(despatchViewIds);
        return Json(result);
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
        catch (Exception e)
        {
            Console.WriteLine(e);
            throw;
        }
    }

    public async Task<IActionResult> Active()
    {
        var result = await _courierRepo.ActiveCouriersAsync();
        return Json(result);
    }

    [HttpGet]
    public IActionResult AvailableCourierLocation(decimal minLng, decimal minLat, decimal maxLng, decimal maxLat)
    {
        var result = _courierRepo.GetAvailableCouriers(minLng, minLat, maxLng, maxLat);
        return Json(result);
    }

    [HttpGet]
    public async Task<IActionResult> PotentialCouriers(int jobId)
    {
        var result = await _courierRepo.GetPotentialCouriersAsync(jobId);
        return Json(result);
    }

    public async Task<IActionResult> AllActiveSearch(string searchTerm)
    {
        var result = await _courierRepo.AllActiveCouriersAsync(searchTerm);
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
        var result = await _courierRepo.GetCourierRouteAsync(code, start, end);
        return Json(result);
    }

    public async Task<IActionResult> TruckCourierStatus(string courierId)
    {
        var result = await _courierRepo.TruckCourierStatusAsync(courierId);
        return Json(result);
    }

    [HttpPost]
    public async Task<IActionResult> AddFollowupEvent(string jobNo, int clientId, string contact, int staffId,
        int courierId, int jobId, int jobType, string despatcherName)
    {
        await _courierRepo.AddEventAsync(jobNo, clientId, contact, staffId, courierId, jobId, jobType,
            despatcherName, "Follow up dangerous goods license with courier", 69);
        return Json("OK");
    }
}