using System;

namespace DespatchWeb.Models;

public class JobCreateViewModel
{
    public int ClientId { get; set; }
    public string DeliverToContact { get; set; }
    public AddressViewModel PickUpAddress { get; set; }
    public AddressViewModel DeliveryAddress { get; set; }
    public DateTimeOffset Date { get; set; }
    public string FromContactName { get; set; }
    public string RefA { get; set; }
    public string RefB { get; set; }
    public string DeliveryNotes { get; set; }
    public string PickupNotes { get; set; }
    public string JobNotes { get; set; }
    public decimal Charge { get; set; }
    public int SpeedId { get; set; }
}