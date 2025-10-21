using System;
using System.Collections.Generic;
using DespatchWeb.Enums;

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
    public decimal? PreviousRate { get; set; }
}


public class JobRatingDetailsDtoNz : JobRatingDetailsDto
{
    // Address Details for From location
    public string FromCompanyName { get; set; }
    public string FromBuildingName { get; set; }
    public string FromStreetAddress { get; set; }
    public string FromCity { get; set; }
    public string FromState { get; set; }
    public string FromSuburb { get; set; }
    public string FromPostCode { get; set; }
    public string FromCountryCode { get; set; }

    // Address Details for To location
    public string ToCompanyName { get; set; }
    public string ToBuildingName { get; set; }
    public string ToStreetAddress { get; set; }
    public string ToCity { get; set; }
    public string ToState { get; set; }
    public string ToSuburb { get; set; }
    public string ToPostCode { get; set; }
    public string ToCountryCode { get; set; }

    // Package Details
    public List<PackageDetailsDto> Packages { get; set; }

    // Truck-specific properties
    public bool? PickupTailLift { get; set; }
    public bool? DropoffTailLift { get; set; }
    public bool? PrivateRes { get; set; }
    public bool? HasDgDocuments { get; set; }
    public string TruckStartTime { get; set; }
    public int? TruckHours { get; set; }
    public JobType JobType { get; set; }
    
    public bool IsTruck { get; set; }
}

public class PackageDetailsDto
{
    public string Name { get; set; }
    public double? Length { get; set; }
    public double? Width { get; set; }
    public double? Height { get; set; }
    public double Cubic { get; set; }
    public double Kg { get; set; }
    public string Type { get; set; }
    public string PackageCode { get; set; }
    public int Units { get; set; }
}