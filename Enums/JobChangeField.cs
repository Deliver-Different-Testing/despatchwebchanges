namespace DespatchWeb.Enums;

/// <summary>
/// Closed set of tucJob fields that the inter-tenant change-request workflow knows about.
/// String-typed at the wire boundary (<c>ujcrFieldName</c>), enum-typed in service code.
///
/// Categories live in <see cref="Services.JobChangePolicyService"/>:
///   Auto-apply (customer-visible, non-rated)         — applies immediately on both sides.
///   Manual (rated / commercial-affecting)            — counterparty must approve.
///
/// Compound fields (Packages, PickupAddress, DeliveryAddress) serialize a JSON payload
/// into <c>UjcrRequestedValue</c>; on apply, the service deserialises and delegates to
/// the same repository methods the standard edit endpoints use.
/// Other entity-tracked fields (Weight, Size, AirportOnly, recurring config) remain
/// deferred — they still don't reduce to a single repository call.
/// </summary>
public enum JobChangeField
{
    // Auto-apply — notes family (existing)
    Notes,
    ProgressNote,
    PodNote,

    // Manual — commercial / rated (existing)
    Quantity,
    Speed,
    PartnerAgreedRate,

    // Auto-apply — customer-visible, non-rated
    ConNote,
    RefA,
    RefB,
    OurRef,
    Attention,
    FromContactName,
    ToContactName,
    FromContactPhone,
    ToContactPhone,
    TrackingMobile,
    TrackingEmail,
    TrackingMethod,
    Barcode,
    DeliverToLeaveID,

    // Manual — date/time, dispatch parameters, DG, rate-affecting flags
    Date,
    Time,
    PuTime,
    DeliverBy,
    BookedTime,
    AcceptedJobTypeID,
    Direct,
    DGClass,
    DGDocumentation,

    // Manual — compound fields. RequestedValue carries a JSON-encoded payload.
    Packages,
    PickupAddress,
    DeliveryAddress
}
