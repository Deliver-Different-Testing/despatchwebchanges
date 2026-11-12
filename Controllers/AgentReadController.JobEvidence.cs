#nullable enable
using DeliverDifferent.AgentAccess;
using DespatchWeb.Services.AgentRead;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DespatchWeb.Controllers;

public partial class AgentReadController
{
    [HttpGet("/Agent/Read/job-evidence")]
    [AgentAccessible(AgentCapabilities.ToolJobEvidence)]
    [Authorize(Policy = AgentCapabilities.PolicyPrefix + AgentCapabilities.ToolJobEvidence)]
    public Task<IResult> JobEvidence(
        [FromServices] IAgentJobEvidenceService evidence,
        string? job,
        [FromQuery(Name = "job_id")] int? jobId,
        string? month,
        string detail = "summary",
        [FromQuery(Name = "max_items")] int maxItems = AgentJobEvidenceService.DefaultMaxItems) =>
        Respond(() => evidence.GetAsync(job, jobId, month, string.Equals(detail, "all", StringComparison.OrdinalIgnoreCase), maxItems, HttpContext.RequestAborted));
}
