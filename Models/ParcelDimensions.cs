namespace DespatchWeb.Models;

public sealed class ParcelDimensions
{
    public int? ItemId { get; set; }
    public string ItemName { get; set; }
    public double? Height { get; set; }
    public double? Length { get; set; }
    public double? Depth { get; set; }
    public double? Weight { get; set; }
    public decimal? Cubic { get; set; }
    public string Barcode { get; set; }
}
