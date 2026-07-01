namespace DespatchWeb.Models;

public class DispatchJobViewModel
{
    // Core identifiers
    public Guid AngularId { get; set; }
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
    public bool IsPartnerJob { get; set; }
    public bool? Done { get; set; }
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

    // Recurring flight: the complete flight number (e.g. "NZ123") saved against
    // a recurring booking so the same flight auto-assigns each push-to-live.
    public string SavedFlightNumber { get; set; }

    public AssignedFlight AssignedFlight { get; set; }
    public AgentViewModel AssignedAgent { get; set; }
    public bool IsAgentAssigned { get; set; }

    public string SentToPartnerName { get; set; }

    // Name of the OTHER tenant on a partner pairing — populated for both the
    // sender (via JobPartnerDispatch) and the receiver (via the most recent
    // change-request pairing) so the UI can substitute the actual tenant name
    // for the generic "counterparty" / "partner" copy.
    public string PartnerTenantName { get; set; }

    // IntMgrPartnerPairing.Id for the pairing this job belongs to. Set at
    // SendToPartner time for outbound jobs and by IntegrationManager at
    // mirror ingestion for inbound jobs, so the frontend can disambiguate
    // when filing a JobChangeRequest on a tenant with multiple active
    // pairings. Falls back to JobPartnerDispatch / most-recent CR pairing
    // for jobs that pre-date the column.
    public int? PartnerPairingId { get; set; }

    // UI helper fields
    public List<Suggestion> RelatedJobs { get; set; }
    public List<DispatchJobViewModel> Children { get; set; }

    public string ConNote { get; set; }
    public DateTime? FollowupTime { get; set; }
    public bool Van { get; set; }
    public bool Truck { get; set; }
    public int? JobTypeMins { get; set; }
    public Suggestion PickUpTimeZone { get; set; }
    public Suggestion DeliveryTimeZone { get; set; }
    public bool AllowSplit { get; set; }
    public string CustomJobName { get; set; }
    public int? AccessorialChargeGroupId { get; set; }
    public decimal? Amount { get; set; }
    public double? Weight { get; set; }
    public short? Quantity { get; set; }
}