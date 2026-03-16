namespace DespatchWeb.Models.Response;

public sealed record JobCoordinateModel
{
    public int Id { get; init; }
    public string JobNo { get; init; }
    public decimal? PickupLatitude { get; init; }
    public decimal? PickupLongitude { get; init; }
    public decimal? DeliveryLatitude { get; init; }
    public decimal? DeliveryLongitude { get; init; }
    public int? StatusId { get; init; }
    public string StatusName { get; init; }
    public int ClientId { get; init; }
    public string ClientName { get; init; }
    public string Speed { get; init; }
    public string FromAddress { get; init; }
    public string ToAddress { get; init; }
}
