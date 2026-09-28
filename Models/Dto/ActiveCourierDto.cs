namespace DespatchWeb.Models.Dto;

public sealed class ActiveCourierDto
{
    public int CourierId { get; init; }
    public string Code { get; init; }
    public string Name { get; init; }
    public bool DangerousGoods { get; init; }
    public DateTime? DgLicenseExpiry { get; init; }
    public int JobCount { get; set; }
    public string VehicleType { get; init; }
}