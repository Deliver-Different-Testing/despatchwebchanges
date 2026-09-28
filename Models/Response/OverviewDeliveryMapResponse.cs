namespace DespatchWeb.Models.Response;

public sealed record OverviewDeliveryMapResponse
{
    public Coordinates Center { get; init; }
    public int Zoom { get; init; }
    public OverviewJobLocation Job { get; init; }

    public int SelectedJobIndex { get; init; }
}

public readonly record struct Coordinates
{
    public decimal Lat { get; init; }
    public decimal Lng { get; init; }
}

public sealed record OverviewJobLocation
{
    public int Id { get; init; }
    public Coordinates Pickup { get; init; }
    public Coordinates Delivery { get; init; }
    public IReadOnlyList<OverviewChildJobLocation> ChildJobs { get; init; }
}

public sealed record OverviewChildJobLocation
{
    public int Id { get; init; }
    public Coordinates Pickup { get; init; }
    public Coordinates Delivery { get; init; }
    public bool Flight { get; init; }
}