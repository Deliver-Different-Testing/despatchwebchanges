namespace DespatchWeb.Models.Response;

public sealed record MegaMapResponse
{
    public int JobId { get; init; }
    public string JobNumber { get; init; }
    public string JobStatus { get; init; }
    public DateTime EstimatedDelivery { get; init; }
    public AddressViewModel PickupLocation { get; init; }
    public AddressViewModel DeliveryLocation { get; init; }
    public CourierLocation CourierLocation { get; init; }
    public bool IsFlightJob { get; init; }
    public AssignedFlight FlightInfo { get; init; }
}

public sealed record CourierLocation
{
    public int CourierId { get; init; }
    public string CourierName { get; init; }
    public Coordinates? Coordinates { get; init; }
}