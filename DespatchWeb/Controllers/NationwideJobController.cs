using System;
using System.Threading.Tasks;
using DespatchWeb.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace DespatchWeb.Controllers;

public class NationwideJobController : Controller
{
    private readonly ICourierRepository _courierRepo;
    private readonly IFlightStatusService _flightStatusService;

    public NationwideJobController(ICourierRepository courierRepo, IFlightStatusService flightStatusService)
    {
        _courierRepo = courierRepo;
        _flightStatusService = flightStatusService;
    }

    [HttpGet]
    public async Task<IActionResult> GetScheduledFlightOptions(DateTime departureDate, int departureAirportId)
    {
        var departureAirportCode = await _courierRepo.GetAirportCodeByIdAsync(departureAirportId);
        var flightOptions = await _flightStatusService.GetDepartingFlightsAsync(departureAirportCode, departureDate);

        return Json(flightOptions);
    }
}
