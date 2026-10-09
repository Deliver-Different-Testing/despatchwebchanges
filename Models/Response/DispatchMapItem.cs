namespace DespatchWeb.Models.Response;

public sealed record DispatchMapItem
{
    public int JobId { get; init; }
    public string JobNo { get; init; }
    public AddressViewModel PickupAddress { get; init; }
    public AddressViewModel DeliveryAddress { get; init; }
    public Suggestion AssignedCourier { get; init; }
}
