using System;

namespace DespatchWeb.Models;

public class PrebookListViewModel
{
    public int Id { get; set; }
    public DateTimeOffset Booked { get; set; }
    public DateTimeOffset? NextDueTime { get; set; }
    public string Client { get; set; }
    public string CustomJobName { get; set; }
    public string JobNo { get; set; }
    public int? ClientId { get; set; }
    public string Courier { get; set; }
    public string Speed { get; set; }
    public AddressViewModel PickupAddress { get; set; }
    public AddressViewModel DeliveryAddress { get; set; }
}