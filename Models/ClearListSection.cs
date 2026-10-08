namespace DespatchWeb.Models;

public sealed class ClearListSection
{
    public string CourierNumber { get; set; }
    public CourierData CourierData { get; set; }
    public List<Destination> Destinations { get; set; } = [];
    public int JobCount { get; set; }
}
