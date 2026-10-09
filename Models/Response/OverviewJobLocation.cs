namespace DespatchWeb.Models.Response;

public sealed record OverviewJobLocation
{
    public int Id { get; init; }
    public Coordinates Pickup { get; init; }
    public Coordinates Delivery { get; init; }
    public IReadOnlyList<OverviewChildJobLocation> ChildJobs { get; init; }
}
