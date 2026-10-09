namespace DespatchWeb.Models;

public sealed class UrgentPackageObject
{
    public string Name { get; init; }
    public double? Length { get; init; }
    public double? Width { get; init; }
    public double? Height { get; init; }
    public double Cubic { get; init; }
    public double Kg { get; init; }
    public string Type { get; init; }
    public string PackageCode { get; init; }
    public int Units { get; init; }
}
