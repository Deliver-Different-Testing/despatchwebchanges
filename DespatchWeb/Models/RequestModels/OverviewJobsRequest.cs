namespace DespatchWeb.Models.RequestModels;

public class OverviewJobsRequest
{
    public int StatusGroup { get; set; } = 1;
    public int Page { get; set; } = 1;
    public int Limit { get; set; } = 20;
}