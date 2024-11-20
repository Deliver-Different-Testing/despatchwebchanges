using System;

namespace DespatchWeb.Models;

public class PrebookListViewModel
{
    public int Id { get; set; }
    public DateTime Booked { get; set; }
    public string Client { get; set; }

    [Obsolete("Use pickup/delivery address properties instead")]
    public string FromAddress { get; set; }

    [Obsolete("Use pickup/delivery address properties instead")]
    public string ToAddress { get; set; }

    public string JobNo { get; set; }
    public int? ClientId { get; set; }
    public string Courier { get; set; }
    public string Speed { get; set; }
    public AddressViewModel PickupAddress { get; set; }
    public AddressViewModel DeliveryAddress { get; set; }
}