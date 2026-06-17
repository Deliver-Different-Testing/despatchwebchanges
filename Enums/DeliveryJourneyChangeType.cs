namespace DespatchWeb.Enums;

public enum DeliveryJourneyChangeType
{
    InternalStatus,
    JobStatus,
    FlightAssignment,
    AgentAssignment,
    JobUpdate,
    CourierAssignment,

    // Written by the tucJob_InsertJob trigger on row insert. FieldName is
    // "CreatedBySp" and NewValue is the inserting stored procedure's name
    // (from SESSION_CONTEXT), or "(unknown)" when that path didn't tag it.
    JobCreated
}

public enum DeliveryJourneyUpdatedByType
{
    Staff,
    Courier,
    System
}