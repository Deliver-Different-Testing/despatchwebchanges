namespace DespatchWeb.Models;

public sealed class VehicleInformation
{
    public string Rego { get; init; }
    public int? VehicleYear { get; init; }
    public string VehicleModel { get; init; }
    public string VehicleInsurance { get; init; }
}
