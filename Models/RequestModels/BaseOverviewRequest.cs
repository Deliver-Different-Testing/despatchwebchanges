namespace DespatchWeb.Models.RequestModels;

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
