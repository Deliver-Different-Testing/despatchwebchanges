namespace DespatchWeb.Models.RequestModels;

public class NationwideJobsRequestModel : JobQueryParams
{
    public  bool IsInternal { get; init; }
    public int Cid { get; init; }
    public List<int> DespatchViewIds { get; init; }
}