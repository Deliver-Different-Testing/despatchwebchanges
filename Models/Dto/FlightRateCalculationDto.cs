using System;

namespace DespatchWeb.Models.Dto;

public class FlightRateCalculationDto
{
    // Required parameters
    public int ClientId { get; set; }
    public string FromCity { get; set; }
    public string FromState { get; set; }
    public string ToCity { get; set; }
    public string ToState { get; set; }
    public string CarrierCode { get; set; }
    public decimal TotalWeight { get; set; }
    public int Quantity { get; set; }

    // Optional parameters with default values
    public decimal Cubic { get; set; } = 0;
    public int TotalPallets { get; set; } = 0;
    public int ExtraStopOffs { get; set; } = 0;
    public DateTime? BookTime { get; set; } = null;
    public int VehicleSizeId { get; set; } = 0;
    public bool DangerousGoods { get; set; } = false;
    public decimal DryIceWeight { get; set; } = 0;
    public int? WaitTime { get; set; } = 0;
    public decimal? Ppd { get; set; }
}
