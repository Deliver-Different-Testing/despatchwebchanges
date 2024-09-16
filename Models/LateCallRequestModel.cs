using System;
using Newtonsoft.Json;

namespace DespatchWeb.Models;

public class LateCallRequest
{
    [JsonProperty("clientId")] public int ClientId { get; set; }

    [JsonProperty("lateType")] public int LateType { get; set; }

    [JsonProperty("lateTime")] public int LateTime { get; set; }

    [JsonProperty("minutes")] public int Minutes { get; set; }

    [JsonProperty("pickupTime")] public int PickupTime { get; set; }

    [JsonProperty("alertLatePickup")] public int AlertLatePickup { get; set; }

    [JsonProperty("deliveryTime")] public int DeliveryTime { get; set; }

    [JsonProperty("alertLateDelivery")] public int AlertLateDelivery { get; set; }

    [JsonProperty("jobNo")] public string JobNo { get; set; }

    [JsonProperty("contact")] public string Contact { get; set; }

    [JsonProperty("staffId")] public string StaffId { get; set; }

    [JsonProperty("jobTime")] public DateTime JobTime { get; set; }

    [JsonProperty("jobId")] public int JobId { get; set; }

    [JsonProperty("jobType")] public int JobType { get; set; }

    [JsonProperty("bookedSpeed")] public string BookedSpeed { get; set; }

    [JsonProperty("notifiedSpeed")] public string NotifiedSpeed { get; set; }

    [JsonProperty("despatcherName")] public string DespatcherName { get; set; }

    [JsonProperty("calculationRequired")] public bool CalculationRequired { get; set; }
}
