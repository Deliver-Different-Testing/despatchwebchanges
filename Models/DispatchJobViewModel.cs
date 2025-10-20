using System;
using System.Collections.Generic;

namespace DespatchWeb.Models;

public class DispatchJobViewModel
{
    // Core identifiers
    public int Id { get; set; }
    public string JobNo { get; set; }

    public bool IsFlightJob { get; set; }
    public bool IsAgentJob { get; set; }
    public bool IsArchived { get; set; }
    public bool IsBulkJob { get; set; }

    public bool HasBeenRead { get; set; }
    public bool IsParentOrSingle { get; set; }
    public int? ParentId { get; set; }

    // Status and timing information
    public int? InternalStatusId { get; set; }
    public int? SpeedId { get; set; }
    public int? StatusId { get; set; }
    public string StatusName { get; set; }
    public string Status { get; set; }
    public DateTime? Time { get; set; }
    public DateTime? Booked { get; set; }
    public double? Remain { get; set; }

    // Courier information
    public string Courier { get; set; }
    public Suggestion AssignedCourier { get; set; }
    public CourierData CourierData { get; set; }

    // Addresses
    public string From { get; set; }
    public string ToAddress { get; set; }
    public int? ToSuburbId { get; set; }
    public AddressViewModel PickupAddress { get; set; }
    public AddressViewModel DeliveryAddress { get; set; }
    public decimal? PickUpLongitude { get; set; }
    public decimal? PickUpLatitude { get; set; }
    public decimal? DeliveryLongitude { get; set; }
    public decimal? DeliveryLatitude { get; set; }

    public string PickupContact { get; set; }
    public string DeliveryContact { get; set; }

    // Routing data
    public bool? Direct { get; set; }
    public string Speed { get; set; }
    public string Notify { get; set; }
    public Suggestion Vehicle { get; set; }

    // Job properties
    public string Client { get; set; }
    public int? ClientId { get; set; }
    public string ClientName { get; set; }
    public int? JobType { get; set; }
    public string JobTypeDescription { get; set; }

    public int? PickupTime { get; set; }
    public int? AlertLatePickup { get; set; }
    public int? DeliveryTime { get; set; }
    public int? AlertLateDelivery { get; set; }

    // Late call fields
    public int? Lp { get; set; }
    public int? Ld { get; set; }

    // Job flags
    public bool? Locked { get; set; }
    public bool? Done { get; set; }
    public bool? BulkJob { get; set; }
    public bool? PreBook { get; set; }

    // Special delivery options
    public Suggestion Size { get; set; }
    public bool? Return { get; set; }
    public int? DgClass { get; set; }
    public bool? SaturdayDelivery { get; set; }

    // Special fields
    public int? PickupFrom { get; set; }
    public int? RootParentId { get; set; }

    // Airport Fields
    public int? ToAirportId { get; set; }
    public int? FromAirportId { get; set; }

    public AssignedFlight AssignedFlight { get; set; }
    public AgentViewModel AssignedAgent { get; set; }

    // UI helper fields
    public List<Suggestion> RelatedJobs { get; set; }

    public string ConNote { get; set; }
    public DateTime? FollowupTime { get; set; }
    public bool Van { get; set; }
    public bool Truck { get; set; }
    public int? JobTypeMins { get; set; }
    public Suggestion PickUpTimeZone { get; set; }
    public Suggestion DeliveryTimeZone { get; set; }
    public bool AllowSplit { get; set; }
}