using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.FlightStats;
using DespatchWeb.Models.RequestModels;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DespatchWeb.Controllers;

public class NationwideJobController(
    INationwideJobRepository repository,
    IFlightStatsService flightService,
    IClientAccessValidatorService clientAccessValidator,
    ICountryService countryService,
    ITaskRepository taskRepository,
    ITenantInfoService infoService)
    : Controller
{
    [HttpGet]
    public async Task<IActionResult> NationwideJobListNew(JobQueryParams queryParams, bool isInternal,
        int cid, string clientIds, List<int> despatchViewIds)
    {
        try
        {
            if (!isInternal) await clientAccessValidator.ValidateClientAccess(cid, clientIds);
            var isUsTenant = countryService.IsUsTenant();

            var result = await repository.NationwideJobListAsync(queryParams.Order,
                queryParams.OrderDirection, isInternal, isUsTenant, clientIds, NationwideWidget.JobList, despatchViewIds);

            return Json(result);
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured getting the new Nationwide job list");
            return StatusCode(500, e.Message);
        }
    }

    [HttpGet]
    public async Task<IActionResult> NationwideJobListPod(JobQueryParams queryParams, bool isInternal,
        int cid, string clientIds, List<int> despatchViewIds)
    {
        try
        {
            if (!isInternal) await clientAccessValidator.ValidateClientAccess(cid, clientIds);
            var isUsTenant = countryService.IsUsTenant();

            var result = await repository.NationwideJobListAsync(queryParams.Order,
                queryParams.OrderDirection, isInternal, isUsTenant, clientIds, NationwideWidget.Pod, despatchViewIds);

            return Json(result);
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured getting the pod Nationwide job list");
            return StatusCode(500, e.Message);
        }
    }

    [HttpGet]
    public async Task<IActionResult> NationwideJobListBookDelivery(JobQueryParams queryParams,
        bool isInternal,
        int cid, string clientIds, List<int> despatchViewIds)
    {
        try
        {
            if (!isInternal) await clientAccessValidator.ValidateClientAccess(cid, clientIds);
            var isUsTenant = countryService.IsUsTenant();

            var result = await repository.NationwideJobListAsync(queryParams.Order,
                queryParams.OrderDirection, isInternal, isUsTenant, clientIds, NationwideWidget.ActionRequired, despatchViewIds);

            return Json(result);
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured getting the delivery Nationwide job list");
            return StatusCode(500, e.Message);
        }
    }

    [HttpGet]
    public async Task<IActionResult> NationwideJobListReprice(JobQueryParams queryParams, bool isInternal,
        int cid, string clientIds, List<int> despatchViewIds)
    {
        try
        {
            if (!isInternal) await clientAccessValidator.ValidateClientAccess(cid, clientIds);
            var isUsTenant = countryService.IsUsTenant();

            var result = await repository.NationwideJobListAsync(queryParams.Order,
                queryParams.OrderDirection, isInternal, isUsTenant, clientIds, NationwideWidget.Reprice, despatchViewIds);

            return Json(result);
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured getting the reprice Nationwide job list");
            return StatusCode(500, e.Message);
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetScheduledFlightOptions(
        DateTime departureDate,
        int jobId,
        int? airlineId,
        int? departureAirportId)
    {
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();

        try
        {
            Log.Information(
                "Flight search requested for job {JobId} with departure {DepartureDate}, airline {AirlineId}",
                jobId, departureDate, airlineId);

            var flights = await flightService.GetFlightsAsync(
                jobId,
                departureDate,
                airlineId,
                departureAirportId,
                flightBuffer: 0,
                codeType: null,
                extendedOptions: null);

            stopwatch.Stop();
            Log.Information(
                "Flight search API completed in {ElapsedMs}ms for job {JobId}, returned {FlightCount} flights",
                stopwatch.ElapsedMilliseconds, jobId, flights.Count);

            return Json(flights);
        }
        catch (Exception e)
        {
            stopwatch.Stop();
            Log.Error(e, "An error occurred getting scheduled flight options for job {JobId} after {ElapsedMs}ms",
                jobId, stopwatch.ElapsedMilliseconds);
            return StatusCode(500, e.Message);
        }
    }

    [HttpPost]
    public async Task<IActionResult> AssignFlightToJob([FromBody] AssignFlightToJobRequest request)
    {
        try
        {
            if (request is null)
                return BadRequest("Oops, no flight data was provided. Unable to assign to job.");

            // Get flight details
            ScheduledFlight flight;
            try
            {
                flight = await flightService.GetFlightDetailsByFlightNumberAsync(request.FlightNumber,
                    request.DepartureDate);

                if (flight == null)
                {
                    var warning =
                        $"Flight with number {request.FlightNumber} and departure date {request.DepartureDate:yyyy-MM-dd} not found.";
                    Log.Information(warning);
                    return StatusCode(500, warning);
                }
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error retrieving flight details for flight {FlightNumber}", request.FlightNumber);
                return StatusCode(500, ex.Message);
            }

            // Get airport codes
            string departureAirportCode;
            try
            {
                var (_, depCode) = await repository.GetAirportCodesByJobIdAsync(request.JobId);
                departureAirportCode = depCode;
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error retrieving airport codes for JobId: {JobId}", request.JobId);
                return StatusCode(500, "Unable to retrieve airport information");
            }

            // Create webhook
            string webhookId;
            try
            {
                webhookId = await flightService.CreateFlightRuleByDepartureAsync(
                    request.FlightNumber,
                    request.DepartureDate,
                    departureAirportCode) ?? string.Empty;
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error creating flight rule webhook for flight {FlightNumber}",
                    request.FlightNumber);
                return StatusCode(500, ex.Message);
            }

            // Add job
            try
            {

                await repository.AddJobNationwideAsync(request.JobId, flight, webhookId);
            }
            catch (DbUpdateException ex)
            {
                Log.Error(ex, "Database error while adding job {JobId}", request.JobId);
                return StatusCode(500, "Unable to save job information");
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error adding nationwide job for JobId: {JobId}", request.JobId);
                return StatusCode(500, "Unable to complete job assignment");
            }

            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Unexpected error in AssignFlightToJob");
            return StatusCode(500, ex.Message);
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetAgentsForJob(int jobId)
    {
        try
        {
            var agents = await repository.GetAgentsAsync(jobId);
            if (agents != null && agents.Count != 0)
            {
                return Json(agents);
            }

            Log.Information("No agents found for job {JobId}", jobId);
            return Json(new List<AgentViewModel>());
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error retrieving agents for JobId: {JobId}", jobId);
            return StatusCode(500, ex.Message);
        }
    }

    [HttpPost]
    public async Task<IActionResult> AssignAgentToJob([FromBody] AgentJobRequestModel jobRequestModel)
    {
        try
        {
            if (jobRequestModel?.AgentId == null || jobRequestModel.JobId == null)
                return BadRequest("Oops, no agent data was provided. Unable to assign to job.");

            try
            {
                var addToDb = await repository.AddAgentToJobAsync(jobRequestModel.AgentId.Value, jobRequestModel.JobId.Value);
                if (!addToDb)
                    return BadRequest("An error occurred while assigning the agent to the job.");

                return Ok();
            }
            catch (DbUpdateException ex)
            {
                Log.Error(ex, "Database error while assigning agent {AgentId} to job {JobId}",
                    jobRequestModel.AgentId, jobRequestModel.JobId);
                return StatusCode(500, "Unable to save agent assignment");
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error assigning agent {AgentId} to job {JobId}",
                    jobRequestModel.AgentId, jobRequestModel.JobId);
                return StatusCode(500, "Unable to complete agent assignment");
            }
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Unexpected error in AssignAgentToJob");
            return StatusCode(500, ex.Message);
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetActiveAirlines()
    {
        try
        {
            var activeAirlines = await repository.GetActiveAirlineOptionsAsync();
            return Json(activeAirlines);
        }
        catch (Exception e)
        {
           Log.Error(e, "An error occured getting the active airlines");
           return StatusCode(500, e.Message);
        }
    }

    [HttpPost]
    public async Task<IActionResult> SendAgentQuote(int agentId, int jobId)
    {
        try
        {
            await repository.SendAgentRequestMessageAsync(agentId, jobId);
            return Ok();
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured getting the active airlines");
            return StatusCode(500, e.Message);
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetNearbyAirports(int jobId, int? maxDistanceMiles)
    {
        try
        {
            var airports = await repository.GetNearbyAirportsAsync(jobId, maxDistanceMiles);
            return Json(airports);
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured getting the active airports");
            return StatusCode(500, e.Message);
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetFlightInfo(string flightNumber, DateTime departureDate)
    {
        try
        {
            var flightConnections = await flightService.GetFlightDetailByFlightNumberDetailDialog(flightNumber, departureDate);
            return Json(flightConnections);
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured getting the flight detail");
            return StatusCode(500, e.Message);
        }
    }

    [HttpPost]
    public async Task<IActionResult> RestoreJob(int jobId)
    {
        try
        {
            await repository.RestoreNationwideJobAsync(jobId);
            return Ok();
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured retstoring the nationwide job");
            return StatusCode(500, e.Message);
        }
    }
}
