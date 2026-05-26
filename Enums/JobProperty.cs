namespace DespatchWeb.Enums;

public enum JobProperty
{
    ConNote,
    AirportOnly,
    Time,
    Date,
    Size,
    Items,
    SpeedID,
    AcceptedJobTypeID,
    Weight,
    ClientID,
    ClientCode,
    ContactID,
    Pedal,
    Attention,
    Reprice,
    Truck,
    Van,
    VanOK,
    InternalStatusID,
    Status,
    RefA,
    RefB,
    OurRef,
    FromContactName,
    ToContactName,
    FromContactPhone,
    ToContactPhone,
    DeliverToLeaveID,
    UndeliverableLocationID,
    Delivered,
    CompletedTime,
    DGClass,
    DGDocumentation,
    TrackingMethod,
    Direct,
    Void,
    TrackingMobile,
    TrackingEmail,
    PODName,
    PodName,
    Amount,
    NotifiedJobTypeID,
    Locked,
    PuTime,
    DeliverBy,
    BookedTime,
    FollowupTime,
    StopDate ,
    RestartDate,
    DaysOfWeek,
    Frequency,
    HolidayDelivery,
    Active,
    CustomJobName,
    TailLiftPu,
    TailLiftDo,
    DeliverToPrivateRes,
    Barcode,
    CourierId,
    InactiveBy,
    PickupArrivalTime,
    DeliveryArrivalTime,
    // Recurring Route assignment — cascades through booking tree
    // (parent + children + grandchildren) via RecurringJobRepository's
    // ClientID-mirror branch. Appended (not inserted) so the integer
    // ordinals of the existing members stay stable in case anything
    // serializes the enum as int.
    RouteId,

    // 3-way Assign picker target columns (Steve 2026-05-26,
    // HANDOVER-KEVIN-2026-05-26.md). Single-row write on tucJobBooking
    // mirroring the existing CourierId pattern. NpAgentId case writes
    // BOTH AgentId AND NpAgentId — the NP IS an agent (same TucAgent
    // row), and the existing tucJob-side convention populates both
    // columns together.
    AgentId,
    NpAgentId
}
