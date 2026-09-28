namespace DespatchWeb.Models;

public sealed class JobCreateViewModel
{
    public int ClientId { get; init; }
    public string DeliverToContact { get; init; }
    public AddressViewModel PickUpAddress { get; init; }
    public AddressViewModel DeliveryAddress { get; init; }
    public DateTimeOffset Date { get; init; }
    public string FromContactName { get; init; }
    public string RefA { get; init; }
    public string RefB { get; init; }
    public string DeliveryNotes { get; init; }
    public string PickupNotes { get; init; }
    public string JobNotes { get; init; }
    public decimal Charge { get; init; }
    public int SpeedId { get; init; }
    public int? VehicleId { get; init; }
    public decimal? WeightKg { get; init; }
    public decimal? WeightLb { get; init; }
}