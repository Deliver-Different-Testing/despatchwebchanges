using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
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
    IFlightRateService flightRateService)
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

            var result = await repository.NationwideJobListAsync(queryParams, isInternal, isUsTenant, clientIds,
                NationwideWidget.JobList, despatchViewIds);

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

            var result = await repository.NationwideJobListAsync(queryParams, isInternal, isUsTenant, clientIds,
                NationwideWidget.Pod, despatchViewIds);

            return Json(result);
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured getting the pod Nationwide job list");
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

            var result = await repository.NationwideJobListAsync(queryParams, isInternal, isUsTenant, clientIds,
                NationwideWidget.Reprice, despatchViewIds);

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
        int? departureAirportId,
        int minimumLayoverMinutes = 60) //minimumLayover allowed
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
                extendedOptions: null,
                minimumLayoverMinutes: minimumLayoverMinutes);

            if (flights is null || flights.Count == 0)
            {
                stopwatch.Stop();
                return Json(new List<FlightViewModel>());
            }

            // Get the rates
            foreach (var flight in flights)
            {
                // Get amount from stored proc
                var amount = await flightRateService.GetCarrierFlightRateByJobIdAsync(
                    jobId,
                    flight.AirlineCode,
                    flight.FlightSegments.Count != 0,
                    flight.DepartureTime);

                flight.Amount = amount;
            }

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
            return BadRequest("No flight data was provided. Unable to assign to job.");

        // Get flight details
        AddFlightToJobDto flight;

        if (request.FlightSegments != null && request.FlightSegments.Count != 0)
        {
            var firstSegment = request.FlightSegments.First();
            var lastSegment = request.FlightSegments.Last();
            
            // Map flight segments from request
            flight = new AddFlightToJobDto
            {
                AirlineName = firstSegment.AirlineName ??
                              (firstSegment.CarrierFsCode != null
                                  ? $"{firstSegment.CarrierFsCode} Airlines"
                                  : null),
                ArrivalTime = lastSegment.ArrivalTime,  
                CarrierFsCode = firstSegment.CarrierFsCode,  
                DepartureTime = firstSegment.DepartureTime, 
                FlightNumber = firstSegment.FlightNumber,  
                FlightSegments = request.FlightSegments
            };
        }
        else
        {
            try
            {
                // Updated to pass jobId for route information
                flight = await flightService.GetFlightDetailsByFlightNumberAsync(
                    request.FlightNumber,
                    request.DepartureDate,
                    request.JobId);
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error retrieving flight details for flight {FlightNumber}", request.FlightNumber);
                return StatusCode(500, ex.Message);
            }
        }

        if (flight == null)
        {
            return BadRequest("Flight details could not be retrieved.");
        }

        // Create webhook
        var webhookIds = new List<string>();
        try
        {
            foreach (var segment in flight.FlightSegments)
            {
                // Generate a webhookId for each flight segment
                var webhookId = await flightService.CreateFlightRuleByDepartureAsync(
                    segment.CarrierFsCode + segment.FlightNumber,
                    segment.DepartureTime,
                    segment.DepartureAirportFsCode) ?? string.Empty;

                if (!string.IsNullOrEmpty(webhookId))
                {
                    webhookIds.Add(webhookId);
                }
            }
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error creating flight rule webhook for flight {FlightNumber}",
                request.FlightNumber);
            return StatusCode(500, ex.Message);
        }

        // Add a job
        try
        {
            await repository.AddJobNationwideAsync(request.JobId, flight, webhookIds);
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
                var addToDb =
                    await repository.AddAgentToJobAsync(jobRequestModel.AgentId.Value, jobRequestModel.JobId.Value, jobRequestModel.IncludeStopJobs ?? false);
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
    public async Task<IActionResult> SendAgentQuote([FromBody] AgentJobRequestModel data)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(data);
            ArgumentNullException.ThrowIfNull(data.AgentId);
            ArgumentNullException.ThrowIfNull(data.JobId);

            await repository.SendAgentRequestMessageAsync(data.AgentId.Value, data.JobId.Value);
            return Ok();
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured getting the active airlines");
            return StatusCode(500, e.Message);
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetNearbyAirports(int jobId)
    {
        try
        {
            var airports = await repository.GetNearbyAirportsAsync(jobId);
            return Json(airports);
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured getting the active airports");
            return StatusCode(500, e.Message);
        }
    }
    

    [HttpPost]
    public async Task<IActionResult> RestoreJob([FromBody] RestoreJobRequest request)
    {
        try
        {
            // Step 1: Disconnect from webhook alerts
            var webhookIds = await repository.GetFlightWebhookIdByJobIdAsync(request.JobId);
            foreach (var webhookId in webhookIds) await flightService.DeleteFlightRuleById(webhookId);

            // Step 2: Restore Job
            await repository.RestoreNationwideJobAsync(request.JobId);
            return Ok();
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured restoring the nationwide job");
            return StatusCode(500, e.Message);
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetAllAgentsSearch(string searchTerm)
    {
        try
        {
            var agents = await repository.GetAllAgentOptionsBySearchAsync(searchTerm);
            return Json(agents);
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured getting all agents");
            return StatusCode(500, e.Message);
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetAgentInfo(int agentId)
    {
        try
        {
            var agentInfo = await repository.GetAgentInfoForDialogAsync(agentId);
            return Json(agentInfo);
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured getting all agents");
            return StatusCode(500, e.Message);
        }
    }
}
