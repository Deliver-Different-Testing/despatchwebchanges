using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DespatchWeb.Controllers;

public class NationwideJobController(
    INationwideJobRepository repository,
    IFlightStatsService flightService,
    IClientAccessValidatorService clientAccessValidator,
    ITenantInfoService infoService,
    IFlightRateService flightRateService,
    IAddAgentRecoveryJobService recoveryJobService)
    : Controller
{
    public async Task<IActionResult> NationwideJobListNew([FromQuery] NationwideJobsRequestModel data)
    {
        try
        {
            if (!data.IsInternal) await clientAccessValidator.ValidateClientAccessAsync(data.Cid, data.ClientIds);
            var isUsTenant = infoService.IsUsTenant();

            var result = await repository.NationwideJobListAsync(data, data.IsInternal, isUsTenant, data.ClientIds,
                NationwideWidget.JobList, data.DespatchViewIds);

            return Json(result);
        }
        catch (Exception e)
        {
            ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController), nameof(NationwideJobListNew));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> NationwideJobListPod([FromQuery] NationwideJobsRequestModel data)
    {
        try
        {
            if (!data.IsInternal) await clientAccessValidator.ValidateClientAccessAsync(data.Cid, data.ClientIds);
            var isUsTenant = infoService.IsUsTenant();

            var result = await repository.NationwideJobListAsync(data, data.IsInternal, isUsTenant, data.ClientIds,
                NationwideWidget.Pod, data.DespatchViewIds);

            return Json(result);
        }
        catch (Exception e)
        {
            ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController), nameof(NationwideJobListPod));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> NationwideJobListReprice([FromQuery] NationwideJobsRequestModel data)
    {
        try
        {
            if (!data.IsInternal) await clientAccessValidator.ValidateClientAccessAsync(data.Cid, data.ClientIds);
            var isUsTenant = infoService.IsUsTenant();

            var result = await repository.NationwideJobListAsync(data, data.IsInternal, isUsTenant, data.ClientIds,
                NationwideWidget.Reprice, data.DespatchViewIds);

            return Json(result);
        }
        catch (Exception e)
        {
            ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController), nameof(NationwideJobListReprice));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> GetScheduledFlightOptions(
        DateTime departureDate,
        int jobId,
        int? airlineId,
        int? departureAirportId,
        int? arrivalAirportId,
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
                arrivalAirportId,
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
            ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController), nameof(GetScheduledFlightOptions));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> AssignFlightToJob([FromBody] AssignFlightToJobRequest request)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(request);

            // Get flight details
            var flight = await GetFlightDetails(request);
            ArgumentNullException.ThrowIfNull(flight);

            // Create webhooks for flight segments
            var webhookIds = await CreateWebhooks(flight);

            // Save job assignment
            await repository.AddJobNationwideAsync(request, flight, webhookIds);

            return Ok();
        }
        catch (Exception ex)
        {
            ErrorMessageStringFormatter.FormatForLogging(ex, nameof(NationwideJobController), nameof(AssignFlightToJob));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    private async Task<AddFlightToJobDto> GetFlightDetails(AssignFlightToJobRequest request)
    {
        // Use provided flight segments if available
        if (request.FlightSegments?.Count > 0)
        {
            var firstSegment = request.FlightSegments.OrderBy(f => f.SegmentOrder).First();
            var lastSegment = request.FlightSegments.OrderBy(f => f.SegmentOrder).Last();

            return new AddFlightToJobDto
            {
                AirlineName = firstSegment.AirlineName ??
                              (firstSegment.CarrierFsCode != null ? $"{firstSegment.CarrierFsCode} Airlines" : null),
                ArrivalTime = lastSegment.ArrivalTime,
                CarrierFsCode = firstSegment.CarrierFsCode,
                DepartureTime = firstSegment.DepartureTime,
                FlightNumber = firstSegment.FlightNumber,
                FlightSegments = request.FlightSegments
            };
        }

        // Otherwise get flight details from service
        try
        {
            return await flightService.GetFlightDetailsByFlightNumberAsync(
                request.FlightNumber,
                DateTime.Parse(request.DepartureDate),
                request.JobId);
        }
        catch (Exception ex)
        {
            ErrorMessageStringFormatter.FormatForLogging(ex, nameof(NationwideJobController), nameof(GetFlightDetails));
            throw;
        }
    }

    private async Task<List<string>> CreateWebhooks(AddFlightToJobDto flight)
    {
        var webhookIds = new List<string>();

        try
        {
            foreach (var segment in flight.FlightSegments)
            {
                var webhookId = await flightService.CreateFlightRuleByDepartureAsync(
                    $"{segment.CarrierFsCode}{segment.FlightNumber}",
                    segment.DepartureTime,
                    segment.DepartureAirportFsCode) ?? string.Empty;

                if (!string.IsNullOrEmpty(webhookId)) webhookIds.Add(webhookId);
            }

            return webhookIds;
        }
        catch (Exception ex)
        {
            ErrorMessageStringFormatter.FormatForLogging(ex, nameof(NationwideJobController), nameof(CreateWebhooks));
            throw;
        }
    }

    public async Task<IActionResult> GetAgentsForJob(int jobId)
    {
        try
        {
            var agents = await repository.GetAgentsAsync(jobId);
            if (agents != null && agents.Count != 0) return Json(agents);

            Log.Information("No agents found for job {JobId}", jobId);
            return Json(new List<AgentViewModel>());
        }
        catch (Exception ex)
        {
            ErrorMessageStringFormatter.FormatForLogging(ex, nameof(NationwideJobController), nameof(GetAgentsForJob));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> AssignAgentToJob([FromBody] AgentJobRequestModel jobRequestModel)
    {
        try
        {
            if (jobRequestModel?.AgentId == null || jobRequestModel.JobId == null)
                return BadRequest("Oops, no agent data was provided. Unable to assign to job.");

            await repository.AddAgentToJobAsync(jobRequestModel.AgentId.Value, jobRequestModel.JobId.Value,
                jobRequestModel.IncludeStopJobs ?? false);

            return Ok();
        }
        catch (Exception ex)
        {
            ErrorMessageStringFormatter.FormatForLogging(ex, nameof(NationwideJobController), nameof(AssignAgentToJob));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> GetActiveAirlines()
    {
        try
        {
            var activeAirlines = await repository.GetActiveAirlineOptionsAsync();
            return Json(activeAirlines);
        }
        catch (Exception e)
        {
            ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController), nameof(GetActiveAirlines));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
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
            ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController), nameof(SendAgentQuote));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> GetNearbyAirports(int jobId, bool usePickup)
    {
        try
        {
            var airports = await repository.GetNearbyAirportsAsync(jobId, usePickup);
            return Json(airports);
        }
        catch (Exception e)
        {
            ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController), nameof(GetNearbyAirports));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
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
            ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController), nameof(RestoreJob));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> GetAllAgentsSearch(string searchTerm)
    {
        try
        {
            var agents = await repository.GetAllAgentOptionsBySearchAsync(searchTerm);
            return Json(agents);
        }
        catch (Exception e)
        {
            ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController), nameof(GetAllAgentsSearch));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> GetAgentInfo(int agentId)
    {
        try
        {
            var agentInfo = await repository.GetAgentInfoForDialogAsync(agentId);
            return Json(agentInfo);
        }
        catch (Exception e)
        {
            ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController), nameof(GetAgentInfo));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> AddAgentRecoveryJob([FromBody] AddAgentRecoveryRequest request)
    {
        try
        {
            var newStopJobId = await recoveryJobService.AddRecoveryAgentJobAsync(request);
            return Json(newStopJobId);
        }
        catch (Exception e)
        {
            ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController), nameof(AddAgentRecoveryJob));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> GetAgentRecoveryJobs(int jobId)
    {
        try
        {
            var agentRecoveryInfo = await repository.GetRecoveryAgentDialogDataAsync(jobId);
            return Json(agentRecoveryInfo);
        }
        catch (Exception e)
        {
            ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController), nameof(GetAgentRecoveryJobs));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> GetAgentOptionsByAirport(int airportId)
    {
        try
        {
            var airports = await repository.GetAgentOptionsByAirportAsync(airportId);
            return Json(airports);
        }
        catch (Exception e)
        {
            ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController), nameof(GetAgentOptionsByAirport));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> GetAllActiveAirports()
    {
        try
        {
            var airports = await repository.GetAllActiveAirportsWithAgentsAsync();
            return Json(airports);
        }
        catch (Exception e)
        {
            ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController), nameof(GetAllActiveAirports));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> UpdateAgentRecoveryJob([FromBody] UpdateAgentRecoveryRequest request)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(request);
            await repository.UpdateRecoveryAgentAsync(request);
            return Ok();
        }
        catch (Exception e)
        {
            ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController), nameof(UpdateAgentRecoveryJob));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> RemoveAgentRecoveryJob([FromBody] UpdateAgentRecoveryRequest request)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(request);
            ArgumentNullException.ThrowIfNull(request.RecoveryId);

            await repository.RemoveRecoveryAgentAsync(request.RecoveryId);
            return Ok();
        }
        catch (Exception e)
        {
            ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController), nameof(RemoveAgentRecoveryJob));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> RelatedJobHasFlightAssigned(int agentJobId)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(agentJobId);

            var isAllowed = await repository.CanAssignAgentToJobAsync(agentJobId);
            return Json(isAllowed);
        }
        catch (Exception e)
        {
            ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController), nameof(RelatedJobHasFlightAssigned));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> CalculateCargoReadyTime(int jobId, string carrierFsCode, DateTime arrivalTime)
    {
        try
        {
            var cargoReadyTime = await repository.CalculateCargoReadyTimeAsync(jobId, carrierFsCode, arrivalTime);
            return Json(cargoReadyTime);
        }
        catch (Exception e)
        {
            ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController), nameof(CalculateCargoReadyTime));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }
}