namespace DespatchWeb.Models.Response;

public class OverviewDeliveryMapResponse
{
    public Coordinates Center { get; init; }
    public int Zoom { get; init; }
    public OverviewJobLocation Job { get; init; }

    public int SelectedJobIndex { get; init; }
}

public class Coordinates
{
    public decimal Lat { get; init; }
    public decimal Lng { get; init; }
}

public class OverviewJobLocation
{
    public int Id { get; init; }
    public Coordinates Pickup { get; init; }
    public Coordinates Delivery { get; init; }
    public List<OverviewChildJobLocation> ChildJobs { get; init; }
}

public class OverviewChildJobLocation
{
    public int Id { get; init; }
    public Coordinates Pickup { get; init; }
    public Coordinates Delivery { get; init; }
    public bool Flight { get; init; }
}