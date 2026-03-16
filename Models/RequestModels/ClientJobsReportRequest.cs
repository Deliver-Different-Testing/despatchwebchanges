namespace DespatchWeb.Models.RequestModels;

public sealed class ClientJobsReportRequest
{
    public DateTimeOffset StartDate { get; init; }
    public DateTimeOffset EndDate { get; init; }
    public List<int> ClientIds { get; init; } = [];
}
