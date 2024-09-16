using Newtonsoft.Json;

namespace DespatchWeb.Models;

public class InterCourierChargeViewModel
{
    [JsonProperty("fromCourierId")] public int FromCourierId { get; set; }

    [JsonProperty("toCourierId")] public int ToCourierId { get; set; }

    [JsonProperty("reference")] public string Reference { get; set; }

    [JsonProperty("zones")] public int Zones { get; set; }

    [JsonProperty("amount")] public decimal Amount { get; set; }

    [JsonProperty("staffId")] public int StaffId { get; set; }
}