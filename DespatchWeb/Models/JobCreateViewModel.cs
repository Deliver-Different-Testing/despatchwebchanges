using System;
using Newtonsoft.Json;

namespace DespatchWeb.Models;

public class CreateJobRequest
{
    [JsonProperty("job")] public JobCreateViewModel Job { get; set; }
    [JsonProperty("staffId")] public int? StaffId { get; set; }
}

public class JobCreateViewModel
{
    [JsonProperty("clientID")] public int ClientId { get; set; }

    [JsonProperty("speedId")] public int SpeedId { get; set; }

    [JsonProperty("deliverToContact")] public string DeliverToContact { get; set; }

    [JsonProperty("fromAddress")] public string FromAddress { get; set; }

    [JsonProperty("fromSuburb")] public int FromSuburb { get; set; }

    [JsonProperty("toAddress")] public string ToAddress { get; set; }

    [JsonProperty("toSuburb")] public int ToSuburb { get; set; }

    [JsonProperty("date")] public DateTime Date { get; set; }

    [JsonProperty("fromContactName")] public string FromContactName { get; set; }

    [JsonProperty("deliveryNotes")] public string DeliveryNotes { get; set; }

    [JsonProperty("pickupNotes")] public string PickupNotes { get; set; }

    [JsonProperty("van")] public bool Van { get; set; }

    [JsonProperty("truck")] public bool Truck { get; set; }

    [JsonProperty("pedal")] public bool Pedal { get; set; }

    [JsonProperty("attention")] public bool Attention { get; set; }

    [JsonProperty("vanOK")] public bool VanOK { get; set; }

    [JsonProperty("reprice")] public bool Reprice { get; set; }

    [JsonProperty("void")] public bool Void { get; set; }

    [JsonProperty("done")] public bool Done { get; set; }

    [JsonProperty("charge")] public decimal Charge { get; set; }
}
