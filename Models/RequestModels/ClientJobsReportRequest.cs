namespace DespatchWeb.Models.RequestModels;

public class ClientJobsReportRequest
{
    public DateTimeOffset StartDate { get; init; }
    public DateTimeOffset EndDate { get; init; }
    public List<int> ClientIds { get; init; } = [];
}
