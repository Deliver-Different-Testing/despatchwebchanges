namespace DespatchWeb.Models.RequestModels;

public class ExtraRateCalculationRequest
{
    // Weight and Dimension Properties
    public decimal TotalWeight { get; set; }
    public int Quantity { get; set; }
    public decimal Cubic { get; set; }
    public int TotalPallets { get; set; }
    
    // Delivery Properties
    public int ExtraStopOffs { get; set; }
    public int VehicleSizeId { get; set; }
    
    // Hazardous Materials
    public bool DangerousGoods { get; set; }
    public decimal DryIceWeight { get; set; }
    
    // Time-based Properties
    public int? WaitTime { get; set; }
    public bool IsHoliday { get; set; }
    public bool IsAfterHours { get; set; }
    
    // Charge Properties
    public int? ExtraChargeId { get; set; }
    public decimal FuelSurcharge { get; set; }
    
    // Zone Properties
    public int? FromZoneCongestionId { get; set; }
    public int? ToZoneCongestionId { get; set; }
    
    public decimal? Ppd { get; set; }
}