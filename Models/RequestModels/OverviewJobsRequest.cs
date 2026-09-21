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

public sealed class OpenJobsRequest : BaseOverviewRequest;

public class BaseOverviewRequest
{
    public DateTime? StartDate { get; init; }
    public DateTime? EndDate { get; init; }
    public List<int> Regions { get; init; } = [];
    public List<int> Speeds { get; init; } = [];
    public List<int> Couriers { get; init; } = [];
    public List<int> DespatchViewIds { get; init; } = [];
    public bool ScopeToDespatchViews { get; init; }
}
