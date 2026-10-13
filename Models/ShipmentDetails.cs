namespace DespatchWeb.Models;

public sealed class ShipmentDetails
{
    public string ContactName { get; set; }
    public string ContactMobile { get; set; }
    public double Weight { get; set; }
    public double Depth { get; set; }
    public double Length { get; set; }
    public double Height { get; set; }
    public int? Quantity { get; set; }
    public string JobNotes { get; set; }
}
