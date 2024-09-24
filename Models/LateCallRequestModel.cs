using System;
using System.Text.Json.Serialization;

namespace DespatchWeb.Models;

public class LateCallRequest
{
    [JsonPropertyName("clientId")] public int ClientId { get; set; }

    [JsonPropertyName("lateType")] public int LateType { get; set; }

    [JsonPropertyName("lateTime")] public int LateTime { get; set; }

    [JsonPropertyName("minutes")] public int Minutes { get; set; }

    [JsonPropertyName("pickupTime")] public int PickupTime { get; set; }

    [JsonPropertyName("alertLatePickup")] public int AlertLatePickup { get; set; }

    [JsonPropertyName("deliveryTime")] public int DeliveryTime { get; set; }

    [JsonPropertyName("alertLateDelivery")] public int AlertLateDelivery { get; set; }

    [JsonPropertyName("jobNo")] public string JobNo { get; set; }

    [JsonPropertyName("contact")] public string Contact { get; set; }

    [JsonPropertyName("staffId")] public string StaffId { get; set; }

    [JsonPropertyName("jobTime")] public DateTime JobTime { get; set; }

    [JsonPropertyName("jobId")] public int JobId { get; set; }

    [JsonPropertyName("jobType")] public int JobType { get; set; }

    [JsonPropertyName("bookedSpeed")] public string BookedSpeed { get; set; }

    [JsonPropertyName("notifiedSpeed")] public string NotifiedSpeed { get; set; }

    [JsonPropertyName("despatcherName")] public string DespatcherName { get; set; }

    [JsonPropertyName("calculationRequired")] public bool CalculationRequired { get; set; }
}
