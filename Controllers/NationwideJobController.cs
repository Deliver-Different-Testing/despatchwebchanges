using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.FlightStats;
using DespatchWeb.Models.RequestModels;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Serilog;

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

            var status = (DispatchStatus)queryParams.Status;
            var result = await _repository.NationwideJobListAsync(queryParams?.Order,
                queryParams?.Asc, isInternal, clientIds, NationwideWidget.JobList, despatchViewIds, status);

            return Json(result);
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured getting the new Nationwide job list");
            return StatusCode(500, "An unexpected error occurred while retrieving the job list");
        }
    }

    [HttpGet]
    public async Task<IActionResult> NationwideJobListPod([FromQuery] JobQueryParams queryParams, bool isInternal,
        int cid, string clientIds, [FromQuery] List<int> despatchViewIds)
    {
        try
        {
            if (!isInternal) await clientAccessValidator.ValidateClientAccess(cid, clientIds);

            var status = (DispatchStatus)queryParams.Status;
            var result = await _repository.NationwideJobListAsync(queryParams?.Order,
                queryParams?.Asc, isInternal, clientIds, NationwideWidget.Pod, despatchViewIds, status);

            return Json(result);
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured getting the pod Nationwide job list");
            return StatusCode(500, "An unexpected error occurred while retrieving the job list");
        }
    }

    [HttpGet]
    public async Task<IActionResult> NationwideJobListBookDelivery([FromQuery] JobQueryParams queryParams,
        bool isInternal,
        int cid, string clientIds, [FromQuery] List<int> despatchViewIds)
    {
        try
        {
            if (!isInternal) await clientAccessValidator.ValidateClientAccess(cid, clientIds);

            var status = (DispatchStatus)queryParams.Status;
            var result = await _repository.NationwideJobListAsync(queryParams.Order,
                queryParams.Asc, isInternal, clientIds, NationwideWidget.ActionRequired, despatchViewIds, status);

            return Json(result);
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured getting the delivery Nationwide job list");
            return StatusCode(500, "An unexpected error occurred while retrieving the job list");
        }
    }

    [HttpGet]
    public async Task<IActionResult> NationwideJobListReprice([FromQuery] JobQueryParams queryParams, bool isInternal,
        int cid, string clientIds, [FromQuery] List<int> despatchViewIds)
    {
        try
        {
            if (!isInternal) await clientAccessValidator.ValidateClientAccess(cid, clientIds);

            var status = (DispatchStatus)queryParams.Status;
            var result = await _repository.NationwideJobListAsync(queryParams.Order,
                queryParams.Asc, isInternal, clientIds, NationwideWidget.Reprice, despatchViewIds, status);

            return Json(result);
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured getting the reprice Nationwide job list");
            return StatusCode(500, "An unexpected error occurred while retrieving the job list");
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetScheduledFlightOptions(DateTime departureDate, int jobId)
    {
        try
        {
            var (toAirport, fromAirport) = await repository.GetAirportCodesByJobIdAsync(jobId);

            if (string.IsNullOrEmpty(toAirport) || string.IsNullOrEmpty(fromAirport))
                return BadRequest("Invalid airport ID(s) provided.");

            var flightOptions =
                await flightService.GetFlightsAsync(fromAirport, toAirport, departureDate);

            return Json(flightOptions ?? new List<FlightViewModel>());
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured getting scheduled flight options");
            return StatusCode(500, "An unexpected error occurred while retrieving the job list");
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
                return StatusCode(500, "Unable to retrieve flight information");
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
                return StatusCode(500, "Unable to set up flight tracking");
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
            return StatusCode(500, "An unexpected error occurred while processing your request");
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetAgentsForJob(int jobId)
    {
        try
        {
            var agents = await repository.GetAgentsAsync(jobId);
            if (agents != null && agents.Any())
            {
                return Json(agents);
            }

            Log.Information($"No agents found for job {jobId}");
            return Json(new List<AgentViewModel>());
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error retrieving agents for JobId: {JobId}", jobId);
            return StatusCode(500, "An error occurred while retrieving agent information");
        }
    }

    [HttpPost]
    public async Task<IActionResult> AssignAgentToJob([FromBody] AssignAgentModel model)
    {
        try
        {
            if (model?.AgentId == null || model.JobId == null)
                return BadRequest("Oops, no agent data was provided. Unable to assign to job.");

            try
            {
                var addToDb = await repository.AddAgentToJobAsync(model.AgentId.Value, model.JobId.Value);
                if (!addToDb)
                    return BadRequest("An error occurred while assigning the agent to the job.");

                return Ok();
            }
            catch (DbUpdateException ex)
            {
                Log.Error(ex, "Database error while assigning agent {AgentId} to job {JobId}",
                    model.AgentId, model.JobId);
                return StatusCode(500, "Unable to save agent assignment");
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error assigning agent {AgentId} to job {JobId}",
                    model.AgentId, model.JobId);
                return StatusCode(500, "Unable to complete agent assignment");
            }
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Unexpected error in AssignAgentToJob");
            return StatusCode(500, "An unexpected error occurred while processing your request");
        }
    }
}