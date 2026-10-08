namespace DespatchWeb.Models.Dto;

public sealed record CourierJobSuburbDto
{
    public int CourierId { get; init; }
    public int? ToSuburbId { get; init; }
    public decimal? DeliveryLatitude { get; init; }
    public decimal? DeliveryLongitude { get; init; }
}
