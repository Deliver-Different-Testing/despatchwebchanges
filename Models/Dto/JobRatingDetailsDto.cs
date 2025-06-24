using System;

namespace DespatchWeb.Models.Dto;

public class JobRatingDetailsDto
{
    public int JobId { get; set; }
    public int? ClientId { get; set; }
    public int? FromId { get; set; }
    public int? ToId { get; set; }
    public int? SpeedId { get; set; }
    public bool IsPedal { get; set; }
    public bool IsVan { get; set; }
    public bool IsReturnJob { get; set; }
    public double? Weight { get; set; }
    public int? SizeId { get; set; }
    public bool IncludeFuelSurcharge { get; set; }
    public bool IsDirect { get; set; }
    public int? AcceptedJobTypeId { get; set; }
    public string OurRef { get; set; }
    public string RefA { get; set; }
    public string RefB { get; set; }
    public int Quantity { get; set; }
    public DateTime BookedDate { get; set; }

    // Coordinates - used for both US and non-US jobs
    public decimal PickupLat { get; set; }
    public decimal PickupLong { get; set; }
    public decimal DeliveryLat { get; set; }
    public decimal DeliveryLong { get; set; }

    // US-specific properties
    public string FromZip { get; set; }
    public string ToZip { get; set; }
    public bool DangerousGoods { get; set; }
    public int TotalPallets { get; set; }
    public int ExtraStopOffs { get; set; }
    public decimal DryIceWeight { get; set; }
    public int WaitTime { get; set; }

    // Flight-specific properties
    public int? FromAirportId { get; set; }
    public int? ToAirportId { get; set; }
    public int? FromAgentId { get; set; }
    public int? ToAgentId { get; set; }

    // Client-specific rate information
    public decimal ClientDiscount { get; set; }

    public decimal? Cubic { get; set; }
    public bool IsManuallyRated { get; set; }
    public bool? IsPrebook { get; set; }
    
    public bool CalculateDimsOncePerJob { get; set; }
}
