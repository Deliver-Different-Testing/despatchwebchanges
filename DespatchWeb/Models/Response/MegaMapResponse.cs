using System;

namespace DespatchWeb.Models.Response;

public class MegaMapResponse
{
    public int JobId { get; set; }
    public string JobNumber { get; set; }
    public string JobStatus { get; set; }
    public DateTime EstimatedDelivery { get; set; }
    public AddressViewModel PickupLocation { get; set; }
    public AddressViewModel DeliveryLocation { get; set; }
    public CourierLocation CourierLocation { get; set; }
    public bool IsFlightJob { get; set; }
    public AssignedFlight FlightInfo { get; set; }
}

public class CourierLocation
{
    public int CourierId { get; set; }
    public string CourierName { get; set; }
    public Coordinates Coordinates { get; set; }
}