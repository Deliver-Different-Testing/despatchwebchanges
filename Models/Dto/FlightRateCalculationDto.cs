namespace DespatchWeb.Models.Dto;

public sealed record FlightRateCalculationDto
{
    // Required parameters
    public int ClientId { get; init; }
    public string FromCity { get; init; }
    public string FromState { get; init; }
    public string ToCity { get; init; }
    public string ToState { get; init; }
    public string CarrierCode { get; init; }
    public decimal TotalWeight { get; init; }
    public int Quantity { get; init; }

    // Optional parameters with default values
    public decimal Cubic { get; init; } = 0;
    public int TotalPallets { get; init; }
    public int ExtraStopOffs { get; init; }
    public DateTime? BookTime { get; init; }
    public int VehicleSizeId { get; init; }
    public bool DangerousGoods { get; init; }
    public decimal DryIceWeight { get; init; }
    public int? PickupWaitTime { get; init; } = 0;
    public int? DeliveryWaitTime { get; init; } = 0;
    public decimal? Ppd { get; init; }
}
