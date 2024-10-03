using System;
using System.Linq;
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
    public async Task<IActionResult> GetScheduledFlightOptions(DateTime departureDate, int departureAirportId,
        int destinationAirportId)
    {
        var (departureAirportCode, destinationAirportCode) =
            await GetAirportCodes(departureAirportId, destinationAirportId);

        if (string.IsNullOrEmpty(departureAirportCode) || string.IsNullOrEmpty(destinationAirportCode))
            return BadRequest("Invalid airport ID(s) provided.");

        var flightOptions =
            await _flightStatusService.GetFlightsAsync(departureAirportCode, destinationAirportCode, departureDate);

        if (flightOptions == null || !flightOptions.Any())
            return NotFound("No flight options found for the specified criteria.");

        return Json(flightOptions);
    }

    private async Task<(string departureCode, string destinationCode)> GetAirportCodes(int departureAirportId,
        int destinationAirportId)
    {
        var departureTask = _courierRepo.GetAirportCodeByIdAsync(departureAirportId);
        var destinationTask = _courierRepo.GetAirportCodeByIdAsync(destinationAirportId);

        await Task.WhenAll(departureTask, destinationTask);

        return (departureTask.Result, destinationTask.Result);
    }
}
