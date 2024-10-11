using System.Threading.Tasks;
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
        var test = payload.Alert.Rule.Console.WriteLine(payload);
        return Ok();
    }
}
