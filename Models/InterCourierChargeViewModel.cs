using System.Text.Json.Serialization;

namespace DespatchWeb.Models;

public class InterCourierChargeViewModel
{
    [JsonPropertyName("fromCourierId")] public int FromCourierId { get; set; }

    [JsonPropertyName("toCourierId")] public int ToCourierId { get; set; }

    [JsonPropertyName("reference")] public string Reference { get; set; }

    [JsonPropertyName("zones")] public int Zones { get; set; }

    [JsonPropertyName("amount")] public decimal Amount { get; set; }

    [JsonPropertyName("staffId")] public int StaffId { get; set; }
}