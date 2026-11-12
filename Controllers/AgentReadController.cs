#nullable enable
using System.Text.Json.Nodes;
using DeliverDifferent.AgentAccess;
using DeliverDifferent.AgentAccess.Export;
using DespatchWeb.Services.AgentRead;
using Microsoft.AspNetCore.Mvc;

namespace DespatchWeb.Controllers;

/// <summary>
/// Agent-shaped, read-only answers for the MCP tools (docs/agent-read-api.md). GET only; every action is opted in with
/// [AgentAccessible] and its tool verb, and its answer passes through <see cref="AgentFieldProjector"/>.
/// </summary>
[ApiController]
public partial class AgentReadController(IAgentCapabilitySource capabilities) : ControllerBase
{
    private async Task<IResult> Respond(Func<Task<JsonObject>> build)
    {
        try
        {
            var body = await build();
            var held = await capabilities.GetAsync(User, HttpContext.RequestAborted);
            var projected = AgentFieldProjector.Apply(body, held, ExportColumns.CostColumnsAllowed(User, held));
            return Results.Content(projected.ToJsonString(), "application/json");
        }
        catch (AgentReadException e)
        {
            return Results.BadRequest(new { error = e.Message });
        }
    }
}
