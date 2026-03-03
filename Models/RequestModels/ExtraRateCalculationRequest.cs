namespace DespatchWeb.Models.RequestModels;

public class ExtraRateCalculationRequest
{
    // Weight and Dimension Properties
    public decimal TotalWeight { get; init; }
    public int Quantity { get; init; }
    public decimal Cubic { get; init; }
    public int TotalPallets { get; init; }
    
    // Delivery Properties
    public int ExtraStopOffs { get; init; }
    public int VehicleSizeId { get; init; }
    
    // Hazardous Materials
    public bool DangerousGoods { get; init; }
    public decimal DryIceWeight { get; init; }
    
    // Time-based Properties
    public int? WaitTime { get; init; }
    public bool IsHoliday { get; init; }
    public bool IsAfterHours { get; init; }
    
    // Charge Properties
    public int? ExtraChargeId { get; init; }
    public decimal FuelSurcharge { get; init; }
    
    // Zone Properties
    public int? FromZoneCongestionId { get; init; }
    public int? ToZoneCongestionId { get; init; }
    
    public decimal? Ppd { get; init; }
}