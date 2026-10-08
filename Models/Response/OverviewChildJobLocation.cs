namespace DespatchWeb.Models.Response;

public sealed record OverviewChildJobLocation
{
    public int Id { get; init; }
    public Coordinates Pickup { get; init; }
    public Coordinates Delivery { get; init; }
    public bool Flight { get; init; }
}
