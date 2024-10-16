using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.AspNetCore.Mvc;

namespace DespatchWeb.Controllers;

public class NationwideJobController(
    INationwideJobRepository repository,
    IFlightStatsService flightService,
    IClientAccessValidatorService clientAccessValidator)
    : Controller
{
    [HttpGet]
    public async Task<IActionResult> NationwideJobListNew([FromQuery] JobQueryParams queryParams, bool isInternal,
        int cid, string clientIds, [FromQuery] List<int> despatchViewIds)
    {
        try
        {
            if (!isInternal) await clientAccessValidator.ValidateClientAccess(cid, clientIds);

            var result = await repository.NationwideJobListAsync(queryParams?.Status, queryParams?.Order,
                queryParams?.Asc, isInternal, clientIds, NationwideWindowPanel.JobList, despatchViewIds);
            return Json(result);
        }
        catch (Exception e)
        {
            Console.WriteLine(e);
            throw;
        }
    }

    [HttpGet]
    public async Task<IActionResult> NationwideJobListPod([FromQuery] JobQueryParams queryParams, bool isInternal,
        int cid, string clientIds, [FromQuery] List<int> despatchViewIds)
    {
        if (!isInternal) await clientAccessValidator.ValidateClientAccess(cid, clientIds);

        var result = await repository.NationwideJobListAsync(queryParams?.Status, queryParams?.Order,
            queryParams?.Asc, isInternal, clientIds, NationwideWindowPanel.Pod, despatchViewIds);
        return Json(result);
    }

    [HttpGet]
    public async Task<IActionResult> NationwideJobListBookDelivery([FromQuery] JobQueryParams queryParams,
        bool isInternal,
        int cid, string clientIds, [FromQuery] List<int> despatchViewIds)
    {
        if (!isInternal) await clientAccessValidator.ValidateClientAccess(cid, clientIds);

        var result = await repository.NationwideJobListAsync(queryParams?.Status, queryParams?.Order,
            queryParams?.Asc, isInternal, clientIds, NationwideWindowPanel.ActionRequired, despatchViewIds);
        return Json(result);
    }

    [HttpGet]
    public async Task<IActionResult> NationwideJobListReprice([FromQuery] JobQueryParams queryParams, bool isInternal,
        int cid, string clientIds, [FromQuery] List<int> despatchViewIds)
    {
        if (!isInternal) await clientAccessValidator.ValidateClientAccess(cid, clientIds);

        var result = await repository.NationwideJobListAsync(queryParams?.Status, queryParams?.Order,
            queryParams?.Asc, isInternal, clientIds, NationwideWindowPanel.Reprice, despatchViewIds);
        return Json(result);
    }

    [HttpGet]
    public async Task<IActionResult> GetScheduledFlightOptions(DateTime departureDate, int jobId)
    {
        var (toAirport, fromAirport) = await repository.GetAirportCodesByJobIdAsync(jobId);

        if (string.IsNullOrEmpty(toAirport) || string.IsNullOrEmpty(fromAirport))
            return BadRequest("Invalid airport ID(s) provided.");

        var flightOptions =
            await flightService.GetFlightsAsync(fromAirport, toAirport, departureDate);

        return Json(flightOptions ?? new List<FlightViewModel>());
    }

    [HttpPost]
    public async Task<IActionResult> AssignFlightToJob([FromBody] AssignFlightToJobRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        if (!DateTime.TryParse(request.DepartureDate, out var departureDate))
            return BadRequest("Invalid departure date format. Please use YYYY-MM-DD.");

        var flight = await flightService.GetFlightDetailsByFlightNumberAsync(request.FlightNumber, departureDate);
        var (_, departureAirportCode) = await repository.GetAirportCodesByJobIdAsync(request.JobId);

        if (flight == null)
            return NotFound(
                $"Flight with number {request.FlightNumber} and departure date {departureDate:yyyy-MM-dd} not found.");

        var addToDb = await repository.AddJobNationwide(request.JobId, flight);
        if (!addToDb) return BadRequest("An error occurred while assigning the flight to the job.");

        // Set up webhook to receive alerts
        await flightService.CreateFlightRuleByDeparture(request.FlightNumber, departureDate,
            departureAirportCode);

        return Ok();
    }
}
