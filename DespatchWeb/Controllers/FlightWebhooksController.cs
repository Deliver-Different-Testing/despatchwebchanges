using System;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.FlightStats;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace DespatchWeb.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/[controller]")]
public class FlightWebhooksController : ControllerBase
{
    private readonly INationwideJobRepository _jobRepository;
    private readonly ILogger<FlightWebhooksController> _logger;

    public FlightWebhooksController(ILogger<FlightWebhooksController> logger, INationwideJobRepository jobRepository)
    {
        _logger = logger;
        _jobRepository = jobRepository;
    }

    [HttpPost("webhook")]
    public async Task<IActionResult> ReceiveWebhook([FromBody] AlertPayload payload)
    {
        var alert = payload?.Alert;
        if (alert is null)
            return BadRequest("Alert is empty!");

        var alertTypeString = alert.Event?.Value;
        var alertType = EnumExtensions.ParseEnumMember<FlightStatsAlertEvent>(alertTypeString);

        // Log the received alert
        _logger.LogInformation($"Received alert of type: {alertType}");

        // Do nothing if unknown
        if (alertType == FlightStatsAlertEvent.Unknown)
            return BadRequest($"Unknown alert type: {alertTypeString}");

        try
        {
            switch (alertType)
            {
                case FlightStatsAlertEvent.PreDepartureStatus:
                case FlightStatsAlertEvent.PreArrivalStatus:
                case FlightStatsAlertEvent.EnRoute:
                case FlightStatsAlertEvent.Landed:
                case FlightStatsAlertEvent.Baggage:
                case FlightStatsAlertEvent.TimeAdjustment:
                case FlightStatsAlertEvent.DepartureGate:
                case FlightStatsAlertEvent.ArrivalGate:
                case FlightStatsAlertEvent.EquipmentAdjustment:
                    // Update note without changing status
                    await _jobRepository.UpdateJobNotesByFlightStatus(alertType, alert);
                    break;
                case FlightStatsAlertEvent.Cancelled:
                case FlightStatsAlertEvent.Diverted:
                case FlightStatsAlertEvent.DepartureDelay:
                case FlightStatsAlertEvent.ArrivalDelay:
                    // Update status and notes
                    await _jobRepository.UpdateNationwideJobStatusByFlightStatus(alertType, alert);
                    break;
                default:
                    return BadRequest($"Unhandled alert type: {alertType}");
            }

            return Ok($"Successfully processed alert of type: {alertType}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error processing alert of type: {alertType}");
            return StatusCode(500, "An error occurred while processing the alert");
        }
    }

    [HttpGet("health")]
    public IActionResult HealthCheck()
    {
        return Ok("FlightWebhooks API is running");
    }
}
