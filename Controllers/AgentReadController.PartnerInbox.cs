#nullable enable
using DeliverDifferent.AgentAccess;
using DespatchWeb.Services.AgentRead;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DespatchWeb.Controllers;

public partial class AgentReadController
{
    [HttpGet("/Agent/Read/partner-inbox")]
    [AgentAccessible(AgentCapabilities.ToolPartnerInbox)]
    [Authorize(Policy = AgentCapabilities.PolicyPrefix + AgentCapabilities.ToolPartnerInbox)]
    public Task<IResult> PartnerInbox(
        [FromServices] IAgentPartnerInboxService inbox,
        [FromQuery(Name = "job_id")] int? jobId,
        int? limit,
        string detail = "inbox",
        string only = "all",
        [FromQuery(Name = "stale_hours")] int staleHours = 24,
        [FromQuery(Name = "max_jobs")] int maxJobs = 25,
        [FromQuery(Name = "include_history")] bool includeHistory = true,
        [FromQuery(Name = "as_of")] string? asOf = null) =>
        Respond(() => inbox.GetAsync(
            new PartnerInboxRequest(jobId, limit, detail, only, staleHours, maxJobs, includeHistory, asOf), HttpContext.RequestAborted));
}
