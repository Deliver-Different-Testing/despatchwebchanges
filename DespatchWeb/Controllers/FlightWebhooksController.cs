using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Models.FlightStats;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace DespatchWeb.Controllers;

[ApiController]
[Route("api/[controller]")]
public class FlightWebhooksController : Controller
{
    private readonly ILogger<FlightWebhooksController> _logger;

    public FlightWebhooksController(ILogger<FlightWebhooksController> logger)
    {
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> Index([FromBody] AlertPayload payload)
    {
        var alertTypeString = payload?.Alert?.Event?.Value;
        var alertType = EnumExtensions.ParseEnumMember<FlightStatsAlertEvent>(alertTypeString);

        // Do nothing if unknown
        if (alertType == FlightStatsAlertEvent.Unknown)
            return BadRequest($"Unknown alert type: {alertTypeString}");


        switch (alertType)
        {
            case FlightStatsAlertEvent.PreDepartureStatus:
                // Handle pre-departure status
                break;
            case FlightStatsAlertEvent.PreArrivalStatus:
                // Handle pre-arrival status
                break;
            case FlightStatsAlertEvent.EnRoute:
                // Handle en route status
                break;
            case FlightStatsAlertEvent.Landed:
                // Handle landed status
                break;
            case FlightStatsAlertEvent.Cancelled:
                // Handle cancellation
                break;
            case FlightStatsAlertEvent.Diverted:
                // Handle diversion
                break;
            case FlightStatsAlertEvent.DepartureDelay:
                // Handle departure delay
                break;
            case FlightStatsAlertEvent.ArrivalDelay:
                // Handle arrival delay
                break;
            case FlightStatsAlertEvent.Baggage:
                // Handle baggage update
                break;
            case FlightStatsAlertEvent.TimeAdjustment:
                // Handle time adjustment
                break;
            case FlightStatsAlertEvent.DepartureGate:
                // Handle departure gate change
                break;
            case FlightStatsAlertEvent.ArrivalGate:
                // Handle arrival gate change
                break;
            case FlightStatsAlertEvent.EquipmentAdjustment:
                // Handle equipment adjustment
                break;
            default:
                // This should never be reached due to the earlier check,
                // but it's good practice to include it
                return BadRequest($"Unhandled alert type: {alertType}");
        }

        return Ok();
    }
}
