using DespatchWeb.Enums;

namespace DespatchWeb.Models.Dto;

public sealed record JobRatingDetailsDtoNz : JobRatingDetailsDto
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
    public IReadOnlyList<PackageDetailsDto> Packages { get; init; } = [];

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
