using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.AspNetCore.Mvc;

namespace DespatchWeb.Controllers;

public class NationwideJobController(IJobRepository jobRepository, IFlightStatusService flightStatusService) : Controller
{
  
    [HttpGet]
    public async Task<IActionResult> GetScheduledFlightOptions(DateTime departureDate, int jobId)
    {
        var (toAirport, fromAirport) = await jobRepository.GetAirportCodesByJobIdAsync(jobId);

        if (string.IsNullOrEmpty(toAirport) || string.IsNullOrEmpty(fromAirport))
            return BadRequest("Invalid airport ID(s) provided.");

        var flightOptions =
            await flightStatusService.GetFlightsAsync(fromAirport, toAirport, departureDate);

        return Json(flightOptions ?? new List<FlightOptionsViewModel>());
    }
}
