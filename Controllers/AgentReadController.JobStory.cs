#nullable enable
using DeliverDifferent.AgentAccess;
using DespatchWeb.Services.AgentRead;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DespatchWeb.Controllers;

public partial class AgentReadController
{
    [HttpGet("/Agent/Read/job-story")]
    [AgentAccessible(AgentCapabilities.ToolJobStory)]
    [Authorize(Policy = AgentCapabilities.PolicyPrefix + AgentCapabilities.ToolJobStory)]
    public Task<IResult> JobStory(
        [FromServices] IAgentJobStoryService story,
        string? job,
        [FromQuery(Name = "job_id")] int? jobId) =>
        Respond(() => story.GetAsync(job, jobId, HttpContext.RequestAborted));
}
