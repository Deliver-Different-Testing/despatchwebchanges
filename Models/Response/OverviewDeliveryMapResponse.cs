using System.Collections.Generic;

namespace DespatchWeb.Models.Response;

public class OverviewDeliveryMapResponse
{
    public Coordinates Center { get; set; }
    public int Zoom { get; set; }
    public OverviewJobLocation Job { get; set; }
}

public class Coordinates
{
    public decimal Lat { get; set; }
    public decimal Lng { get; set; }
}

public class OverviewJobLocation
{
    public int Id { get; set; }
    public Coordinates Pickup { get; set; }
    public Coordinates Delivery { get; set; }
    public List<OverviewChildJobLocation> ChildJobs { get; set; }
    public int SelectedJobIndex { get; set; }
    public Coordinates CourierLocation { get; set; }
}

public class OverviewChildJobLocation
{
    public int Id { get; set; }
    public Coordinates Pickup { get; set; }
    public Coordinates Delivery { get; set; }
    public bool Flight { get; set; }
}