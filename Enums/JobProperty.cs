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
    NpAgentId,

    // Three-state recurring operational mode
    // (0=Inactive, 1=Active, 2=Manual). Backed by tucJobBooking.RecurringMode.
    // Replaces JobProperty.Active in new UI; Active stays for legacy callers
    // and is kept in sync by the update branch per Steve's compatibility rule
    // (Active/Inactive map 1:1, Manual maps to ucbkActive=1 so it stays
    // visible in legacy active-only screens during rollout).
    RecurringMode,

    // Complete flight number (e.g. "NZ123") saved on a recurring flight
    // booking. Single-row write on tucJobBooking.SavedFlightNumber; empty
    // string clears it.
    SavedFlightNumber,

    // Create-ahead offset (days). Backed by tucJobBooking.RecurringInitialDays.
    // Drives uspPrebookSet's @TargetDate = today + N and InsertSchedule /
    // InsertJob's ucbkDate read. Editing this on a fortnightly template also
    // fires UTL_stpJobBooking_RecomputeFirstDueOnEdit to keep the ucbkFirstDue
    // parity anchor intact (see Dane 2026-07-16 CreateAheadDays scope and
    // Kevin's response report for the rationale). Post-edit does NOT re-run
    // the initial-phase batch; the backfill dialog handles the gap.
    RecurringInitialDays
}
