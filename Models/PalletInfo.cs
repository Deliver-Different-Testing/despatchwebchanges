namespace DespatchWeb.Models;

public sealed class PalletInfo
{
    public int Id { get; set; }
    public int Quantity { get; set; }
    public double Weight { get; set; }
    public double Length { get; set; }
    public double Depth { get; set; }
    public double Height { get; set; }
    public double Cubic { get; set; }
    public bool? Pu { get; set; }
    public bool? Do { get; set; }
    public int? DgClass { get; set; }
    public string Notes { get; set; }
    public int ItemId { get; set; }
    public byte ItemStatus { get; set; }
}
