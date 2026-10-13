namespace DespatchWeb.Models.RequestModels;

public sealed class OverviewJobsRequest : BaseOverviewRequest
{
    public int StatusGroup { get; init; } = 1;
    public int Page { get; init; } = 1;
    public int Limit { get; init; } = 20;
    public string Search { get; init; }
    public string OrderBy { get; init; } = "jobName";
    public string OrderDirection { get; init; } = "asc";
}
