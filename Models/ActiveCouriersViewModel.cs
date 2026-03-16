using System.Text.Json.Serialization;

namespace DespatchWeb.Models;

public sealed class ActiveCouriersViewModel
{
    public int CourierId { get; init; }

    [JsonPropertyName("id")] public string Code { get; init; }

    public string Name { get; init; }

    public bool DangerousGoods { get; init; }

    public DateTime? DGLicenseExpiry { get; init; }

    public bool IsActive { get; init; }

    public string VehicleType { get; init; }
}