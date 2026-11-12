#nullable enable
using DeliverDifferent.AgentAccess;
using DespatchWeb.Services.AgentRead;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DespatchWeb.Controllers;

public partial class AgentReadController
{
    [HttpGet("/Agent/Read/driver-day")]
    [AgentAccessible(AgentCapabilities.ToolDriverDay)]
    [Authorize(Policy = AgentCapabilities.PolicyPrefix + AgentCapabilities.ToolDriverDay)]
    public Task<IResult> DriverDay(
        [FromServices] IAgentDriverDayService day,
        string? search,
        int? fleet,
        string? status,
        [FromQuery(Name = "despatch_view_ids")] List<int>? despatchViewIds,
        [FromQuery(Name = "include_board")] bool includeBoard = true,
        DateTimeOffset? now = null,
        string detail = "attention",
        [FromQuery(Name = "max_drivers")] int maxDrivers = AgentDriverDayService.DefaultMaxDrivers) =>
        Respond(() => day.GetAsync(new DriverDayRequest(search, fleet, status, despatchViewIds, includeBoard, now, detail, maxDrivers), HttpContext.RequestAborted));
}
