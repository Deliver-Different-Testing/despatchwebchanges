#nullable enable
using DeliverDifferent.AgentAccess;
using DespatchWeb.Services.AgentRead;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DespatchWeb.Controllers;

public partial class AgentReadController
{
    [HttpGet("/Agent/Read/dispatch-board")]
    [AgentAccessible(AgentCapabilities.ToolDispatchBoard)]
    [Authorize(Policy = AgentCapabilities.PolicyPrefix + AgentCapabilities.ToolDispatchBoard)]
    public Task<IResult> DispatchBoard(
        [FromServices] IAgentDispatchBoardService board,
        [FromQuery(Name = "despatch_view_ids")] List<int>? despatchViewIds,
        DateOnly? date,
        int page = 1,
        [FromQuery(Name = "page_size")] int pageSize = AgentDispatchBoardService.DefaultPageSize,
        string detail = "summary",
        int limit = 25) =>
        Respond(() => board.GetAsync(new DispatchBoardRequest(despatchViewIds, date, page, pageSize, detail, limit), HttpContext.RequestAborted));
}
