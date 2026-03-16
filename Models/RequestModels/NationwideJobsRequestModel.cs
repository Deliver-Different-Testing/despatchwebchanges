namespace DespatchWeb.Models.RequestModels;

public sealed class NationwideJobsRequestModel : JobQueryParams
{
    public  bool IsInternal { get; init; }
    public int Cid { get; init; }
    public List<int> DespatchViewIds { get; init; }
}