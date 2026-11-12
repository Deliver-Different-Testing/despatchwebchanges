#nullable enable
using DeliverDifferent.AgentAccess;
using DespatchWeb.Services.AgentRead;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DespatchWeb.Controllers;

public partial class AgentReadController
{
    [HttpGet("/Agent/Read/recurring-check")]
    [AgentAccessible(AgentCapabilities.ToolRecurringCheck)]
    [Authorize(Policy = AgentCapabilities.PolicyPrefix + AgentCapabilities.ToolRecurringCheck)]
    public Task<IResult> RecurringCheck(
        [FromServices] IAgentRecurringCheckService check,
        [FromQuery(Name = "include_inactive")] bool includeInactive = false,
        string detail = "problems",
        [FromQuery(Name = "window_days")] int windowDays = 7,
        [FromQuery(Name = "as_of")] DateOnly? asOf = null,
        [FromQuery(Name = "max_bookings")] int? maxBookings = null) =>
        Respond(() => check.CheckAsync(new RecurringCheckRequest(includeInactive, detail, windowDays, asOf, maxBookings), HttpContext.RequestAborted));
}
