using System;
using Newtonsoft.Json;

namespace DespatchWeb.Models;

public class JobCreateViewModel
{
    [JsonProperty("clientID")] public int ClientId { get; set; }

    [JsonProperty("deliverToContact")] public string DeliverToContact { get; set; }

    [JsonProperty("podName")] public string PodName { get; set; }

    [JsonProperty("pickUpAddress")] public AddressViewModel PickUpAddress { get; set; }

    [JsonProperty("deliveryAddress")] public AddressViewModel DeliveryAddress { get; set; }

    [JsonProperty("date")] public DateTime Date { get; set; }

    [JsonProperty("fromContactName")] public string FromContactName { get; set; }

    [JsonProperty("refA")] public string RefA { get; set; }

    [JsonProperty("refB")] public string RefB { get; set; }

    [JsonProperty("deliveryNotes")] public string DeliveryNotes { get; set; }

    [JsonProperty("pickupNotes")] public string PickupNotes { get; set; }

    [JsonProperty("jobNotes")] public string JobNotes { get; set; }

    [JsonProperty("van")] public bool Van { get; set; }

    [JsonProperty("truck")] public bool Truck { get; set; }

    [JsonProperty("pedal")] public bool Pedal { get; set; }

    [JsonProperty("attention")] public bool Attention { get; set; }

    [JsonProperty("vanOK")] public bool VanOk { get; set; }

    [JsonProperty("reprice")] public bool Reprice { get; set; }

    [JsonProperty("void")] public bool Void { get; set; }

    [JsonProperty("done")] public bool Done { get; set; }

    [JsonProperty("charge")] public decimal Charge { get; set; }

    [JsonProperty("fromLat")] public decimal FromLat { get; set; }

    [JsonProperty("fromLong")] public decimal FromLong { get; set; }

    [JsonProperty("toLat")] public decimal ToLat { get; set; }

    [JsonProperty("toLong")] public decimal ToLong { get; set; }

    [JsonProperty("speedId")] public int SpeedId { get; set; }
}

public class CreateJobRequest
{
    [JsonProperty("job")] public JobCreateViewModel Job { get; set; }

    [JsonProperty("staffId")] public int? StaffId { get; set; }

    [JsonProperty("despatcherName")] public string DespatcherName { get; set; }
}
