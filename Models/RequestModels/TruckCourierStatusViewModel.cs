using System;
using System.Text.Json.Serialization;

namespace DespatchWeb.Models.RequestModels;

public class TruckCourierStatusViewModel
{
    [JsonPropertyName("id")] public int CourierId { get; set; }

    [JsonPropertyName("courierCode")] public string CourierCode { get; set; }

    [JsonPropertyName("firstName")] public string FirstName { get; set; }

    [JsonPropertyName("maxPallets")] public int? MaxPallets { get; set; }

    [JsonPropertyName("maxPayLoad")]
    public double? MaxPayLoad { get; set; }

    [JsonPropertyName("currentPallets")] public int CurrentPallets { get; set; }

    [JsonPropertyName("currentWeight")] public double CurrentWeight { get; set; }

    [JsonPropertyName("availablePalletCapacity")]
    public double? AvailablePalletCapacity { get; set; }

    [JsonPropertyName("availablePallets")] public double? AvailablePallets { get; set; }

    [JsonIgnore]
    public bool IsAtCapacity =>
        CurrentPallets >= MaxPallets ||
        CurrentWeight >= MaxPayLoad;

    [JsonPropertyName("lastUpdated")] public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
}
