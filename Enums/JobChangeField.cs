namespace DespatchWeb.Enums;

/// <summary>
/// Closed set of tucJob fields that the inter-tenant change-request workflow knows about.
/// String-typed at the wire boundary (<c>ujcrFieldName</c>), enum-typed in service code.
/// v1 deliberately omits PickupAddress, DeliveryAddress, ServiceWindow, and
/// CancellationAfterAcceptance — those mutations touch tucJobAddress, the rate engine, and
/// the dispatch lifecycle in ways the current apply path doesn't cover. Shipping them in
/// the enum would let dispatchers file a request that silently doesn't update the job.
/// </summary>
public enum JobChangeField
{
    Notes,
    ProgressNote,
    PodNote,
    Quantity,
    Speed,
    PartnerAgreedRate
}
