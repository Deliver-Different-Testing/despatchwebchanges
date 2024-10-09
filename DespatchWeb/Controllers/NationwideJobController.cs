using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.AspNetCore.Mvc;

namespace DespatchWeb.Controllers;

public class NationwideJobController : Controller
{
    private readonly IFlightStatusService _flightStatusService;
    private readonly IJobRepository _jobRepository;

    public NationwideJobController(IJobRepository jobRepository, IFlightStatusService flightStatusService)
    {
        _jobRepository = jobRepository;
        _flightStatusService = flightStatusService;
    }

    [HttpGet]
    public async Task<IActionResult> GetScheduledFlightOptions(DateTime departureDate, int jobId)
    {
        var (toAirport, fromAirport) = await _jobRepository.GetAirportCodesByJobIdAsync(jobId);

        if (string.IsNullOrEmpty(toAirport) || string.IsNullOrEmpty(fromAirport))
            return BadRequest("Invalid airport ID(s) provided.");

        var flightOptions =
            await _flightStatusService.GetFlightsAsync(fromAirport, toAirport, departureDate);

        return Json(flightOptions ?? new List<FlightOptionsViewModel>());
    }
}
