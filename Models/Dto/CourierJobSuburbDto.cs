namespace DespatchWeb.Models.Dto;

public sealed record CourierJobSuburbDto
{
    public int CourierId { get; init; }
    public int? ToSuburbId { get; init; }
    public decimal? DeliveryLatitude { get; init; }
    public decimal? DeliveryLongitude { get; init; }

    /// <summary>Delivery postcode (AddressLine7); AU tenants place a job in a driver location by it.</summary>
    public string DeliveryPostCode { get; init; }
}
