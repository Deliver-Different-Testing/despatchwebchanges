#nullable enable
using DeliverDifferent.AgentAccess;
using DespatchWeb.Services.AgentRead;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DespatchWeb.Controllers;

public partial class AgentReadController
{
    [HttpGet("/Agent/Read/jobs")]
    [AgentAccessible(AgentCapabilities.ToolJobSearch)]
    [Authorize(Policy = AgentCapabilities.PolicyPrefix + AgentCapabilities.ToolJobSearch)]
    public Task<IResult> JobSearch(
        [FromServices] IAgentJobSearchService search,
        string? q,
        string? job,
        string? reference,
        [FromQuery(Name = "order_number")] string? orderNumber,
        [FromQuery(Name = "order_id")] string? orderId,
        [FromQuery(Name = "expected_fulfilment_orders")] int? expectedFulfilmentOrders,
        DateOnly? from,
        DateOnly? to,
        [FromQuery(Name = "as_of")] DateOnly? asOf,
        [FromQuery(Name = "lookback_days")] int? lookbackDays,
        [FromQuery(Name = "client_id")] int? clientId,
        [FromQuery(Name = "courier_id")] int? courierId,
        int page = 1,
        [FromQuery(Name = "page_size")] int pageSize = AgentJobSearchService.DefaultPageSize,
        string? detail = null,
        [FromQuery(Name = "max_rows")] int? maxRows = null) =>
        Respond(async () =>
        {
            var held = await capabilities.GetAsync(User, HttpContext.RequestAborted);
            return await search.SearchAsync(new JobSearchRequest(
                q, job, reference, orderNumber, orderId, expectedFulfilmentOrders, from, to, asOf, lookbackDays,
                clientId, courierId, page, pageSize, string.Equals(detail, "all", StringComparison.OrdinalIgnoreCase), maxRows,
                AgentJobSearchService.ColumnsFor(held)),
                HttpContext.RequestAborted);
        });
}

