using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.FlightStats;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace DespatchWeb.Controllers;

[ApiController]
[Route("api/[controller]")]
public class FlightWebhooksController : Controller
{
    private readonly INationwideJobRepository _jobRepository;
    private readonly ILogger<FlightWebhooksController> _logger;

    public FlightWebhooksController(ILogger<FlightWebhooksController> logger, INationwideJobRepository jobRepository)
    {
        _logger = logger;
        _jobRepository = jobRepository;
    }

    [HttpPost]
    public async Task<IActionResult> Index([FromBody] AlertPayload payload)
    {
        var alert = payload?.Alert;
        if (alert is null)
            return BadRequest("Alert is empty!");

        var alertTypeString = alert.Event?.Value;
        var alertType = EnumExtensions.ParseEnumMember<FlightStatsAlertEvent>(alertTypeString);

        // Do nothing if unknown
        if (alertType == FlightStatsAlertEvent.Unknown)
            return BadRequest($"Unknown alert type: {alertTypeString}");

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

        return Ok();
    }
}
