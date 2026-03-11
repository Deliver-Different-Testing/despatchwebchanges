using System;
using System.Collections.Generic;
using DespatchWeb.Enums;

namespace DespatchWeb.Models.Dto;

public class JobRatingDetailsDto
{
    public int JobId { get; init; }
    public int? ClientId { get; init; }
    public int? FromId { get; init; }
    public int? ToId { get; init; }
    public int? SpeedId { get; init; }
    public bool IsPedal { get; init; }
    public bool IsVan { get; init; }
    public bool IsReturnJob { get; init; }
    public double? Weight { get; init; }
    public int? SizeId { get; init; }
    public bool IncludeFuelSurcharge { get; init; }
    public bool IsDirect { get; init; }
    public int? AcceptedJobTypeId { get; init; }
    public string OurRef { get; init; }
    public string RefA { get; init; }
    public string RefB { get; init; }
    public int Quantity { get; init; }
    public DateTime BookedDate { get; init; }

    // Coordinates - used for both US and non-US jobs
    public decimal PickupLat { get; init; }
    public decimal PickupLong { get; init; }
    public decimal DeliveryLat { get; init; }
    public decimal DeliveryLong { get; init; }

    // US-specific properties
    public string FromZip { get; init; }
    public string ToZip { get; init; }
    public bool DangerousGoods { get; init; }
    public int TotalPallets { get; init; }
    public int ExtraStopOffs { get; init; }
    public decimal DryIceWeight { get; init; }
    public int WaitTime { get; init; }

    // Flight-specific properties
    public int? FromAirportId { get; init; }
    public int? ToAirportId { get; init; }
    public int? FromAgentId { get; init; }
    public int? ToAgentId { get; init; }

    // Client-specific rate information
    public decimal ClientDiscount { get; init; }

    public decimal? Cubic { get; init; }
    public bool IsManuallyRated { get; init; }
    public bool? IsPrebook { get; init; }
    
    public bool CalculateDimsOncePerJob { get; init; }
    public decimal? PreviousRate { get; init; }

    /// <summary>
    /// When set, bypasses the DoesAddressMatchAirportAsync DB query for the pickup address.
    /// </summary>
    public bool? PrecomputedIsFromAddressAirport { get; init; }

    /// <summary>
    /// When set, bypasses the DoesAddressMatchAirportAsync DB query for the delivery address.
    /// </summary>
    public bool? PrecomputedIsToAddressAirport { get; init; }
}


public class JobRatingDetailsDtoNz : JobRatingDetailsDto
{
    // Address Details for From location
    public string FromCompanyName { get; init; }
    public string FromBuildingName { get; init; }
    public string FromStreetAddress { get; init; }
    public string FromCity { get; init; }
    public string FromState { get; init; }
    public string FromSuburb { get; init; }
    public string FromPostCode { get; init; }
    public string FromCountryCode { get; init; }

    // Address Details for To location
    public string ToCompanyName { get; init; }
    public string ToBuildingName { get; init; }
    public string ToStreetAddress { get; init; }
    public string ToCity { get; init; }
    public string ToState { get; init; }
    public string ToSuburb { get; init; }
    public string ToPostCode { get; init; }
    public string ToCountryCode { get; init; }

    // Package Details
    public List<PackageDetailsDto> Packages { get; init; } = [];

    // Truck-specific properties
    public bool? PickupTailLift { get; init; }
    public bool? DropoffTailLift { get; init; }
    public bool? PrivateRes { get; init; }
    public bool? HasDgDocuments { get; init; }
    public string TruckStartTime { get; init; }
    public int? TruckHours { get; init; }
    public JobType JobType { get; init; }
    
    public bool IsTruck { get; init; }
}

public class PackageDetailsDto
{
    public string Name { get; init; }
    public double? Length { get; init; }
    public double? Width { get; init; }
    public double? Height { get; init; }
    public double Cubic { get; init; }
    public double Kg { get; init; }
    public string Type { get; init; }
    public string PackageCode { get; init; }
    public int Units { get; init; }
}