using System.Collections.Generic;

namespace DespatchWeb.Models;

public class ClearListViewModel
{
    public List<AreaClearList> Areas { get; set; } = new();
}

public class AreaClearList
{
    public int Id { get; set; }
    public string Name { get; set; }
    public int Order { get; set; }
    public int PercentHeight { get; set; }
    public List<ClearListSection> Top { get; set; } = new();
    public List<ClearListSection> Middle { get; set; } = new();
    public List<ClearListSection> Bottom { get; set; } = new();
    public int TotalRemaining { get; set; }
}

public class ClearListSection
{
    public string CourierNumber { get; set; }
    public CourierData CourierData { get; set; }
    public List<Destination> Destinations { get; set; } = new();
}

public class CourierData
{
    public string Courier { get; set; }
    public string Location { get; set; }
    public string Pu { get; set; }
    public string Del { get; set; }
    public string Lrm { get; set; }
    public string Eta2Lrm { get; set; }
    public int? CourierId { get; set; }
    public string CourierName { get; set; }
    public string CourierMobile { get; set; }
    public string CourierNumber { get; set; }
}

public class Destination
{
    public int Id { get; set; }
    public string Label { get; set; }
}