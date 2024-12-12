using System;

namespace DespatchWeb.Models;

public class JobCreateViewModel
{
    public int ClientId { get; set; }
    public string DeliverToContact { get; set; }
    public string PodName { get; set; }
    public AddressViewModel PickUpAddress { get; set; }
    public AddressViewModel DeliveryAddress { get; set; }
    public DateTime Date { get; set; }
    public string FromContactName { get; set; }
    public string RefA { get; set; }
    public string RefB { get; set; }
    public string DeliveryNotes { get; set; }
    public string PickupNotes { get; set; }
    public string JobNotes { get; set; }
    public bool Van { get; set; }
    public bool Truck { get; set; }
    public bool Pedal { get; set; }
    public bool Attention { get; set; }
    public bool VanOk { get; set; }
    public bool Reprice { get; set; }
    public bool Void { get; set; }
    public bool Done { get; set; }
    public decimal Charge { get; set; }
    public decimal FromLat { get; set; }
    public decimal FromLong { get; set; }
    public decimal ToLat { get; set; }
    public decimal ToLong { get; set; }
    public int SpeedId { get; set; }
    public int VehicleId { get; set; }
}

public class CreateJobRequest
{
    public JobCreateViewModel Job { get; set; }
    public int? StaffId { get; set; }
    public string DespatcherName { get; set; }
}