namespace DespatchWeb.Models;

public sealed class ClearListViewModel
{
    public List<AreaClearList> Areas { get; set; } = [];
    public List<ClearListColumn> Columns { get; set; } = [];
}

public sealed class ClearListColumn
{
    public List<AreaClearList> Areas { get; set; } = [];
}

public sealed class AreaClearList
{
    public int Id { get; set; }
    public string Name { get; set; }
    public int Order { get; set; }
    public int PercentHeight { get; set; }
    public List<ClearListSection> Top { get; set; } = [];
    public List<ClearListSection> Middle { get; set; } = [];
    public List<ClearListSection> Bottom { get; set; } = [];
    public int TotalRemaining { get; set; }
}

public sealed class ClearListSection
{
    public string CourierNumber { get; set; }
    public CourierData CourierData { get; set; }
    public List<Destination> Destinations { get; set; } = [];
    public int JobCount { get; set; }
}

public sealed class CourierData
{
    public string Courier { get; set; }
    public string CourierNumber { get; set; }
    public string Location { get; set; }
    public string Pu { get; set; }
    public string Del { get; set; }
    public string Lrm { get; set; }
    public string Eta2Lrm { get; set; }
    public int? CourierId { get; set; }
    public string CourierName { get; set; }
    public string CourierMobile { get; set; }
}

public sealed class Destination
{
    public int Id { get; set; }
    public string Label { get; set; }
}
