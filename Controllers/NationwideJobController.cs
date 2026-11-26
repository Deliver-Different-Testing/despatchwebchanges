using System.Diagnostics;
using System.Text.Json;
using DespatchWeb.Constants;
using DespatchWeb.Enums;
using DespatchWeb.Filters;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DespatchWeb.Controllers;

[Authorize]
public class NationwideJobController(
    INationwideJobRepository repository,
    IFlightStatsService flightService,
    IFlightAssignmentService flightAssignmentService,
    IClientAccessValidatorService clientAccessValidator,
    ITenantInfoService infoService,
    IFlightRateService flightRateService,
    IClientRepository clientRepository,
    IAddAgentRecoveryJobService recoveryJobService,
    IScopeProvider scopeProvider,
    IForwardAirApiClient forwardAirClient)
    : Controller
{
    private bool CallerIsNetworkPartner => scopeProvider.Scope?.IsNetworkPartner ?? false;

    public Task<IActionResult> NationwideJobListNew([FromQuery] NationwideJobsRequestModel data)
    {
        return NationwideJobListAsync(data, NationwideWidget.JobList, nameof(NationwideJobListNew));
    }

    public Task<IActionResult> NationwideJobListPod([FromQuery] NationwideJobsRequestModel data)
    {
        return NationwideJobListAsync(data, NationwideWidget.Pod, nameof(NationwideJobListPod));
    }

    public Task<IActionResult> NationwideJobListReprice([FromQuery] NationwideJobsRequestModel data)
    {
        return NationwideJobListAsync(data, NationwideWidget.Reprice, nameof(NationwideJobListReprice));
    }

    private async Task<IActionResult> NationwideJobListAsync(
        NationwideJobsRequestModel data, NationwideWidget widget, string actionName)
    {
        try
        {
            var clientIds = await RetrieveAndFormatClientIds();

            if (!data.IsInternal)
            {
                await clientAccessValidator.ValidateClientAccessAsync(data.Cid, clientIds);
            }

            var isUsTenant = infoService.IsUsTenant();

            var result = await repository.NationwideJobListAsync(data, data.IsInternal, isUsTenant, clientIds,
                widget, data.DespatchViewIds);

            return Json(result);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController), actionName));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [RequireScope(ScopedRecord.Job, "jobId")]
    public async Task<IActionResult> GetScheduledFlightOptions(
        DateTimeOffset departureDate,
        int jobId,
        int? airlineId,
        int? departureAirportId,
        int? arrivalAirportId,
        int minimumLayoverMinutes = 60,
        bool includeNearbyAirports = false)
    {
        var stopwatch = Stopwatch.StartNew();

        try
        {
            Log.Information(
                "Flight search requested for job {JobId} with departure {DepartureDate}, airline {AirlineId}",
                jobId, departureDate, airlineId);

            var forwardAirCarrierId = await repository.GetActiveFlightCarrierIdByCodeAsync(ForwardAirCarrier.Code);
            var forwardAirOnly = forwardAirCarrierId.HasValue && airlineId == forwardAirCarrierId;
            var forwardAirTask = forwardAirCarrierId.HasValue && (airlineId is null || forwardAirOnly)
                && departureAirportId.HasValue && arrivalAirportId.HasValue
                ? QuoteForwardAirAsync(jobId, new ForwardAirLegQuoteRequestDto
                {
                    ShipDate = DateOnly.FromDateTime(departureDate.Date),
                    OriginAirportId = departureAirportId,
                    DestinationAirportId = arrivalAirportId
                })
                : null;

            IReadOnlyList<FlightViewModel> flights = [];
            string flightSearchMessage = null;
            if (!forwardAirOnly)
            {
                try
                {
                    flights = await flightService.GetFlightsAsync(
                        jobId,
                        departureDate,
                        airlineId,
                        departureAirportId,
                        arrivalAirportId,
                        codeType: "FS",
                        extendedOptions: null,
                        minimumLayoverMinutes: minimumLayoverMinutes,
                        allowNearbyDepartures: includeNearbyAirports,
                        allowNearbyArrivals: includeNearbyAirports);
                }
                catch (HttpRequestException e) when (forwardAirTask is not null)
                {
                    Log.Error(e, "FlightStats API error for job {JobId}; still offering Forward Air", jobId);
                    flightSearchMessage = "Flight search service is currently unavailable. Please try again later.";
                }
            }

            string forwardAirMessage = null;
            if (forwardAirTask is not null)
            {
                var quote = await forwardAirTask;
                var named = quote.Success
                    ? quote.Services.Where(s => !string.IsNullOrWhiteSpace(s.ServiceCode)).ToList()
                    : [];
                var bookable = named
                    .Where(s => !string.IsNullOrWhiteSpace(s.OriginTimeZone) && !string.IsNullOrWhiteSpace(s.DestinationTimeZone)
                                && s.EstimatedArrival.HasValue)
                    .ToList();
                if (bookable.Count != 0)
                {
                    flights = [.. (flights ?? []), .. bookable.Select(s => MapForwardAirService(s, departureAirportId, arrivalAirportId))];
                }

                if (!quote.Success)
                {
                    forwardAirMessage = quote.Error;
                }
                else if (bookable.Count < named.Count)
                {
                    forwardAirMessage =
                        "Some Forward Air services were left out because Forward Air gave no arrival time or an airport on this route has no time zone set.";
                }
            }

            if (flights is { Count: > 1 })
            {
                flights = [.. flights.OrderBy(f => f.ArrivalTime)];
            }

            if (flights is null || flights.Count == 0)
            {
                stopwatch.Stop();
                var noFlightsMessage = forwardAirOnly
                    ? forwardAirMessage ?? "Forward Air has no services for the selected route and date."
                    : JoinMessages(
                        flightSearchMessage
                        ?? "No flights found for the selected route and date. Try adjusting the departure date or changing the airline filter.",
                        forwardAirMessage);
                return Json(new FlightSearchResponse
                {
                    Flights = [],
                    Message = noFlightsMessage
                });
            }

            foreach (var flight in flights)
            {
                var amount = await flightRateService.GetCarrierFlightRateByJobIdAsync(
                    jobId,
                    flight.AirlineCode,
                    flight.FlightSegments.Count != 0,
                    flight.DepartureTime.Date);

                flight.Amount = amount;
            }

            stopwatch.Stop();
            Log.Information(
                "Flight search API completed in {ElapsedMs}ms for job {JobId}, returned {FlightCount} flights",
                stopwatch.ElapsedMilliseconds, jobId, flights.Count);

            return Json(new FlightSearchResponse
            {
                Flights = [.. flights],
                Message = flightSearchMessage is null ? forwardAirMessage : JoinMessages(flightSearchMessage, forwardAirMessage)
            });
        }
        catch (ArgumentException e)
        {
            stopwatch.Stop();
            Log.Warning(e, "Flight search validation failed for job {JobId}: {Message}", jobId, e.Message);
            return Json(new FlightSearchResponse
            {
                Flights = [],
                Message = e.Message
            });
        }
        catch (HttpRequestException e)
        {
            stopwatch.Stop();
            Log.Error(e, "FlightStats API error for job {JobId}", jobId);
            return Json(new FlightSearchResponse
            {
                Flights = [],
                Message = "Flight search service is currently unavailable. Please try again later."
            });
        }
        catch (Exception e)
        {
            stopwatch.Stop();
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController),
                    nameof(GetScheduledFlightOptions)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    private async Task<ForwardAirQuoteResponseDto> QuoteForwardAirAsync(int legId, ForwardAirLegQuoteRequestDto search)
    {
        try
        {
            return await forwardAirClient.GetLegQuoteAsync(legId, search, HttpContext?.RequestAborted ?? CancellationToken.None);
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            Log.Warning(e, "Forward Air quote failed for leg {LegId}", legId);
            return new ForwardAirQuoteResponseDto {Success = false, Error = "Forward Air quote is unavailable."};
        }
    }

    private static string JoinMessages(params string[] messages)
    {
        var parts = messages.Where(m => !string.IsNullOrWhiteSpace(m)).ToArray();
        return parts.Length == 0 ? null : string.Join(" ", parts);
    }

    private static FlightViewModel MapForwardAirService(ForwardAirQuoteServiceDto service, int? departureAirportId,
        int? arrivalAirportId)
    {
        var departure = ToOffset(service.ShipDate, service.OriginTimeZone);
        var arrival = ToOffset(service.EstimatedArrival ?? service.ShipDate, service.DestinationTimeZone);
        var duration = arrival.UtcDateTime - departure.UtcDateTime;
        var elapsedMinutes = (int)duration.TotalMinutes;

        return new FlightViewModel
        {
            Airline = ForwardAirCarrier.Name,
            AirlineCode = ForwardAirCarrier.Code,
            FlightNumber = service.ServiceCode,
            ServiceTypeDescription = service.ServiceName,
            DepartureTime = departure,
            ArrivalTime = arrival,
            DepartureTimeZone = service.OriginTimeZone,
            ArrivalTimeZone = service.DestinationTimeZone,
            DepartureAirport = service.OriginAirport,
            ArrivalAirport = service.DestinationAirport,
            Duration = duration,
            ElapsedTime = elapsedMinutes,
            Stops = 0,
            FlightSegments =
            [
                new FlightSegmentViewModel
                {
                    SegmentOrder = 0,
                    CarrierFsCode = ForwardAirCarrier.Code,
                    FlightNumber = service.ServiceCode,
                    DepartureTime = departure,
                    ArrivalTime = arrival,
                    DepartureAirportId = departureAirportId ?? 0,
                    ArrivalAirportId = arrivalAirportId ?? 0,
                    DepartureAirportFsCode = service.OriginAirport,
                    ArrivalAirportFsCode = service.DestinationAirport,
                    DepartureAirportTimeZone = service.OriginTimeZone,
                    ArrivalAirportTimeZone = service.DestinationTimeZone,
                    ElapsedTime = elapsedMinutes,
                    AirlineName = ForwardAirCarrier.Name
                }
            ]
        };
    }

    private static DateTimeOffset ToOffset(DateTime local, string timeZoneId)
    {
        var unspecified = DateTime.SpecifyKind(local, DateTimeKind.Unspecified);
        try
        {
            return TimeZoneHelper.SetDateTimeWithTimeZone(unspecified, timeZoneId);
        }
        catch (ArgumentException e)
        {
            Log.Warning(e, "Forward Air time zone {TimeZoneId} is unknown; treating {LocalTime} as UTC", timeZoneId, local);
            return new DateTimeOffset(unspecified, TimeSpan.Zero);
        }
    }

    [HttpGet("api/nationwide/{legId:int}/forwardair")]
    [RequireScope(ScopedRecord.Job, "legId")]
    public async Task<IActionResult> GetForwardAirJob(int legId, CancellationToken cancellationToken = default)
    {
        try
        {
            var job = await forwardAirClient.GetJobAsync(legId, cancellationToken);
            return job is null ? NotFound() : Json(job);
        }
        catch (Exception e) when (e is HttpRequestException or InvalidOperationException or JsonException)
        {
            Log.Warning(e, "Forward Air job lookup failed for leg {LegId}", legId);
            return StatusCode(502, "Forward Air details are unavailable right now.");
        }
    }

    [HttpGet("api/nationwide/{legId:int}/forwardair/documents/{type}")]
    [RequireScope(ScopedRecord.Job, "legId")]
    public async Task<IActionResult> GetForwardAirDocument(int legId, string type,
        CancellationToken cancellationToken = default)
    {
        var documentType = type?.ToUpperInvariant();
        if (documentType is not ("LABEL" or "BOL" or "DELIVER"))
        {
            return BadRequest("Unknown document type.");
        }

        try
        {
            var document = await forwardAirClient.GetDocumentAsync(legId, documentType, cancellationToken);
            return document is null
                ? NotFound()
                : File(document.Content, document.ContentType, document.FileName);
        }
        catch (Exception e) when (e is HttpRequestException or InvalidOperationException)
        {
            Log.Warning(e, "Forward Air document {Type} failed for leg {LegId}", documentType, legId);
            return StatusCode(502, "Forward Air documents are unavailable right now.");
        }
    }

    public async Task<IActionResult> GetRecurringFlightOptions(
        DateTimeOffset departureDate,
        int bookingId,
        int? departureAirportId,
        int? arrivalAirportId,
        int minimumLayoverMinutes = 60,
        bool includeNearbyAirports = false)
    {
        try
        {
            if (departureAirportId is null || arrivalAirportId is null)
            {
                return Json(new FlightSearchResponse
                {
                    Flights = [],
                    Message =
                        "This recurring booking has no departure/arrival airports set, so flights can't be searched."
                });
            }

            var flights = await flightService.GetFlightsAsync(
                bookingId,
                departureDate,
                airlineId: null,
                departureAirportId: departureAirportId,
                arrivalAirportId: arrivalAirportId,
                codeType: "FS",
                extendedOptions: null,
                minimumLayoverMinutes: minimumLayoverMinutes,
                allowNearbyDepartures: includeNearbyAirports,
                allowNearbyArrivals: includeNearbyAirports);

            if (flights is null || flights.Count == 0)
            {
                return Json(new FlightSearchResponse
                {
                    Flights = [],
                    Message =
                        "No flights found for the selected route and date. Try a different date, or enter the flight number manually."
                });
            }

            return Json(new FlightSearchResponse { Flights = [.. flights] });
        }
        catch (ArgumentException e)
        {
            Log.Warning(e, "Recurring flight search validation failed for booking {BookingId}: {Message}", bookingId,
                e.Message);
            return Json(new FlightSearchResponse { Flights = [], Message = e.Message });
        }
        catch (HttpRequestException e)
        {
            Log.Error(e, "FlightStats API error for booking {BookingId}", bookingId);
            return Json(new FlightSearchResponse
            {
                Flights = [],
                Message = "Flight search service is currently unavailable. Please try again later."
            });
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController),
                    nameof(GetRecurringFlightOptions)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    [RequireScope(ScopedRecord.Job, "request.JobId")]
    public async Task<IActionResult> AssignFlightToJob(
        [FromBody] AssignFlightToJobRequest request, CancellationToken cancellationToken = default)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(request);

            await flightAssignmentService.AssignFlightAsync(request, cancellationToken);

            return Ok();
        }
        catch (InvalidOperationException ex)
        {
            Log.Warning(ex, "Flight assignment rejected for JobId: {JobId}", request.JobId);
            return Conflict(ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(NationwideJobController),
                    nameof(AssignFlightToJob)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> GetFlightWebhookStatus(int jobId)
    {
        try
        {
            var webhookIds = await repository.GetFlightWebhookIdByJobIdAsync(jobId);

            if (webhookIds.Count == 0)
            {
                return Json(new { active = false });
            }

            var tasks = webhookIds.Select(flightService.IsFlightRuleActiveAsync);
            var results = await Task.WhenAll(tasks);

            return Json(new { active = results.Any(r => r) });
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController),
                    nameof(GetFlightWebhookStatus)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> GetAgentsForJob(int jobId)
    {
        try
        {
            var agents = await repository.GetAgentsAsync(jobId);
            if (agents.Count != 0)
            {
                return Json(agents);
            }

            Log.Information("No agents found for job {JobId}", jobId);
            return Json(new List<AgentViewModel>());
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(NationwideJobController),
                    nameof(GetAgentsForJob)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> AssignAgentToJob([FromBody] AgentJobRequestModel jobRequestModel)
    {
        try
        {
            if (CallerIsNetworkPartner)
            {
                return Forbid();
            }

            if (jobRequestModel?.AgentId == null || jobRequestModel.JobId == null)
            {
                return BadRequest("Oops, no agent data was provided. Unable to assign to job.");
            }

            var result = await repository.AddAgentToJobAsync(jobRequestModel.AgentId.Value,
                jobRequestModel.JobId.Value, jobRequestModel.IncludeStopJobs ?? false,
                jobRequestModel.EmailSubject, jobRequestModel.EmailNote, jobRequestModel.Resend);

            return Ok(new
            {
                status = result.Status.ToString(),
                agentEmail = result.AgentEmail,
                willEmail = result.WillEmail,
                alertType = result.AlertType?.ToString()
            });
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(NationwideJobController),
                    nameof(AssignAgentToJob)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> AssignNpAgentToJob([FromBody] AssignNpAgentRequest request)
    {
        try
        {
            if (CallerIsNetworkPartner)
            {
                return Forbid();
            }

            if (request?.NpAgentId == null || request.JobId == null)
            {
                return BadRequest("Oops, no network partner data was provided. Unable to assign to job.");
            }

            await repository.AssignNpAgentToJobAsync(request.NpAgentId.Value, request.JobId.Value);
            return Ok(new { success = true });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(NationwideJobController),
                    nameof(AssignNpAgentToJob)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> AssignAgentToJobs([FromBody] AssignAgentToJobsRequest request)
    {
        try
        {
            if (CallerIsNetworkPartner)
            {
                return Forbid();
            }

            if (request?.AgentId == null || request.JobIds is not {Count: > 0})
            {
                return BadRequest("Oops, no agent or jobs were provided. Unable to assign.");
            }

            var results = await repository.AssignAgentToJobsAsync(request.AgentId.Value, request.JobIds,
                request.IncludeStopJobs ?? false, request.EmailSubject, request.EmailNote, request.Resend);

            return Ok(BulkAssignmentResponse(results));
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(NationwideJobController),
                    nameof(AssignAgentToJobs)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> AssignNpAgentToJobs([FromBody] AssignNpAgentToJobsRequest request)
    {
        try
        {
            if (CallerIsNetworkPartner)
            {
                return Forbid();
            }

            if (request?.NpAgentId == null || request.JobIds is not {Count: > 0})
            {
                return BadRequest("Oops, no network partner or jobs were provided. Unable to assign.");
            }

            var results = await repository.AssignNpAgentToJobsAsync(request.NpAgentId.Value, request.JobIds);
            return Ok(BulkAssignmentResponse(results));
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(NationwideJobController),
                    nameof(AssignNpAgentToJobs)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    private static object BulkAssignmentResponse(IReadOnlyList<BulkAssignmentResult> results) => new
    {
        assigned = results.Count(r => r.Succeeded),
        failed = results.Count(r => !r.Succeeded),
        results = results.Select(r => new
        {
            jobId = r.JobId,
            succeeded = r.Succeeded,
            failureReason = r.FailureReason,
            emailStatus = r.EmailStatus?.ToString()
        })
    };

    public async Task<IActionResult> GetActiveAirlines()
    {
        try
        {
            var activeAirlines = await repository.GetActiveAirlineOptionsAsync();
            return Json(activeAirlines);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController),
                    nameof(GetActiveAirlines)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> SendAgentQuote([FromBody] AgentJobRequestModel data)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(data);
            if (!data.AgentId.HasValue || !data.JobId.HasValue)
            {
                throw new ArgumentNullException(nameof(data));
            }

            // An explicit send by the dispatcher, so it goes even if the agent already has this alert.
            await repository.SendAgentRequestMessageAsync(data.AgentId.Value, data.JobId.Value, resend: true);
            return Ok();
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController),
                    nameof(SendAgentQuote)));
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
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController),
                    nameof(GetNearbyAirports)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    [RequireScope(ScopedRecord.Job, "request.JobId")]
    public async Task<IActionResult> RestoreJob([FromBody] RestoreJobRequest request)
    {
        try
        {
            var webhookIds = await repository.GetFlightWebhookIdByJobIdAsync(request.JobId);
            foreach (var webhookId in webhookIds.Where(id => !string.IsNullOrEmpty(id)))
            {
                await flightService.DeleteFlightRuleById(webhookId);
            }

            await repository.RestoreNationwideJobAsync(request.JobId);
            return Ok();
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController),
                    nameof(RestoreJob)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> GetAllAgentsSearch(string searchTerm, bool? isNetworkPartner = null)
    {
        try
        {
            var agents = await repository.GetAllAgentOptionsBySearchAsync(searchTerm, isNetworkPartner);
            return Json(agents);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController),
                    nameof(GetAllAgentsSearch)));
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
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController),
                    nameof(GetAgentInfo)));
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
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController),
                    nameof(AddAgentRecoveryJob)));
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
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController),
                    nameof(GetAgentRecoveryJobs)));
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
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController),
                    nameof(GetAgentOptionsByAirport)));
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
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController),
                    nameof(GetAllActiveAirports)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> GetAllActiveAirportSuggestions()
    {
        try
        {
            var airports = await repository.GetAllActiveAirportSuggestionsAsync();
            return Json(airports);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController),
                    nameof(GetAllActiveAirportSuggestions)));
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
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController),
                    nameof(UpdateAgentRecoveryJob)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> RemoveAgentRecoveryJob([FromBody] UpdateAgentRecoveryRequest request)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(request);

            await repository.RemoveRecoveryAgentAsync(request.RecoveryId);
            return Ok();
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController),
                    nameof(RemoveAgentRecoveryJob)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> CalculateCargoReadyTime(int jobId, string carrierFsCode,
        DateTimeOffset arrivalTime)
    {
        try
        {
            var cargoReadyTime =
                await repository.CalculateCargoReadyTimeAsync(jobId, carrierFsCode, arrivalTime.DateTime);
            return Json(cargoReadyTime);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController),
                    nameof(CalculateCargoReadyTime)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> CanAssignAgentToJob(int agentJobId)
    {
        try
        {
            var canAssign = await repository.CanAssignAgentToJobAsync(agentJobId);
            return Json(canAssign);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController),
                    nameof(CanAssignAgentToJob)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> GetAgentInboundEmailPreview(int agentId, int jobId, string note = null)
    {
        try
        {
            var preview = await repository.GetAgentInboundEmailPreviewAsync(agentId, jobId);
            var email = preview.Status is AgentInboundEmailStatus.Queued or AgentInboundEmailStatus.AlreadySent
                ? await repository.ComposeAgentAlertAsync(agentId, jobId, emailNote: note)
                : null;
            return Json(new
            {
                status = preview.Status.ToString(),
                agentEmail = preview.AgentEmail,
                willEmail = preview.WillEmail,
                alertType = preview.AlertType?.ToString(),
                subject = email?.Subject,
                html = email?.HtmlBody
            });
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(NationwideJobController),
                    nameof(GetAgentInboundEmailPreview)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    private async Task<string> RetrieveAndFormatClientIds()
    {
        var contactId = infoService.GetContactId();
        var clientIds = await clientRepository.ClientContactsAsync(contactId);
        return string.Join(",", clientIds.Select(c => c.Id));
    }
}