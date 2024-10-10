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

        return Json(flightOptions ?? new List<FlightViewModel>());
    }

    [HttpPost]
    public async Task<IActionResult> AssignFlightToJob([FromBody] AssignFlightToJobRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        if (!DateTime.TryParse(request.DepartureDate, out var departureDate))
            return BadRequest("Invalid departure date format. Please use YYYY-MM-DD.");

        try
        {
            var flight = await _flightStatusService.GetFlightDetailsByFlightNumber(request.FlightNumber, departureDate);

            if (flight == null)
                return NotFound(
                    $"Flight with number {request.FlightNumber} and departure date {departureDate:yyyy-MM-dd} not found.");

            var addToDb = await _jobRepository.AddJobNationwide(request.JobId, flight);

            return addToDb
                ? Ok("Flight successfully assigned to job.")
                : BadRequest("An error occurred while assigning the flight to the job.");
        }
        catch (Exception ex)
        {
            Console.WriteLine(ex.Message);
            return StatusCode(500, "An unexpected error occurred while processing your request.");
        }
    }
}