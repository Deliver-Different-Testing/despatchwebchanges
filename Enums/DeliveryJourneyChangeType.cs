namespace DespatchWeb.Enums;

public enum DeliveryJourneyChangeType
{
    InternalStatus,
    JobStatus,
    FlightAssignment,
    AgentAssignment,
    JobUpdate,
    CourierAssignment
}

public enum DeliveryJourneyUpdatedByType
{
    Staff,
    Courier,
    System
}