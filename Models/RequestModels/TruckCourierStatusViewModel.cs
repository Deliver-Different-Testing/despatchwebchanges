using System;
using System.Text.Json.Serialization;
using Newtonsoft.Json;

namespace DespatchWeb.Models.RequestModels;

public class TruckCourierStatusViewModel
{
    [JsonProperty("id")] public int CourierId { get; set; }

    [JsonProperty("courierCode")] public string CourierCode { get; set; }

    [JsonProperty("firstName")] public string FirstName { get; set; }

    [JsonProperty("maxPallets")] public int? MaxPallets { get; set; }

    [JsonProperty("maxPayLoad")]
    [JsonPropertyOrder(1)]
    public double? MaxPayLoad { get; set; }

    [JsonProperty("currentPallets")] public int CurrentPallets { get; set; }

    [JsonProperty("currentWeight")] public double CurrentWeight { get; set; }

    [JsonProperty("availablePalletCapacity")]
    public double? AvailablePalletCapacity { get; set; }

    [JsonProperty("availablePallets")] public double? AvailablePallets { get; set; }

    [Newtonsoft.Json.JsonIgnore]
    public bool IsAtCapacity =>
        CurrentPallets >= MaxPallets ||
        CurrentWeight >= MaxPayLoad;

    [JsonProperty("lastUpdated")] public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
}
