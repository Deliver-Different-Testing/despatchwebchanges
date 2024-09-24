using System;
using System.Text.Json.Serialization;

namespace DespatchWeb.Models;

public class JobCreateViewModel
{
    [JsonPropertyName("clientID")] public int ClientId { get; set; }

    [JsonPropertyName("deliverToContact")] public string DeliverToContact { get; set; }

    [JsonPropertyName("podName")] public string PodName { get; set; }

    [JsonPropertyName("pickUpAddress")] public AddressViewModel PickUpAddress { get; set; }

    [JsonPropertyName("deliveryAddress")] public AddressViewModel DeliveryAddress { get; set; }

    [JsonPropertyName("date")] public DateTime Date { get; set; }

    [JsonPropertyName("fromContactName")] public string FromContactName { get; set; }

    [JsonPropertyName("refA")] public string RefA { get; set; }

    [JsonPropertyName("refB")] public string RefB { get; set; }

    [JsonPropertyName("deliveryNotes")] public string DeliveryNotes { get; set; }

    [JsonPropertyName("pickupNotes")] public string PickupNotes { get; set; }

    [JsonPropertyName("jobNotes")] public string JobNotes { get; set; }

    [JsonPropertyName("van")] public bool Van { get; set; }

    [JsonPropertyName("truck")] public bool Truck { get; set; }

    [JsonPropertyName("pedal")] public bool Pedal { get; set; }

    [JsonPropertyName("attention")] public bool Attention { get; set; }

    [JsonPropertyName("vanOK")] public bool VanOk { get; set; }

    [JsonPropertyName("reprice")] public bool Reprice { get; set; }

    [JsonPropertyName("void")] public bool Void { get; set; }

    [JsonPropertyName("done")] public bool Done { get; set; }

    [JsonPropertyName("charge")] public decimal Charge { get; set; }

    [JsonPropertyName("fromLat")] public decimal FromLat { get; set; }

    [JsonPropertyName("fromLong")] public decimal FromLong { get; set; }

    [JsonPropertyName("toLat")] public decimal ToLat { get; set; }

    [JsonPropertyName("toLong")] public decimal ToLong { get; set; }

    [JsonPropertyName("speedId")] public int SpeedId { get; set; }
}

public class CreateJobRequest
{
    [JsonPropertyName("job")] public JobCreateViewModel Job { get; set; }

    [JsonPropertyName("staffId")] public int? StaffId { get; set; }

    [JsonPropertyName("despatcherName")] public string DespatcherName { get; set; }
}