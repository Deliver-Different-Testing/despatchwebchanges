namespace DespatchWeb.Enums;

public enum DeliveryJourneyChangeType
{
    InternalStatus,
    JobStatus,
    FlightAssignment,
    AgentAssignment,
    JobUpdate,
    CourierAssignment,

    // Handing a job to a network partner (tucJob.NpAgentId). Distinct from
    // AgentAssignment: it changes who can see the job, not who is delivering it,
    // so it leaves the job status and dispatch stamps alone.
    NetworkPartnerAssignment,

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

public static class DeliveryJourneyUpdatedBy
{
    /// <summary>
    /// The <c>UpdatedByType</c> that pairs with a given staff id.
    /// <c>CK_JobDeliveryJourney_UserID_Required</c> requires the actor column
    /// named by <c>UpdatedByType</c> to be populated, so a null staff id must be
    /// recorded as <c>System</c> rather than an unattributed <c>Staff</c> row.
    /// </summary>
    public static string TypeForStaffId(int? staffId) =>
        staffId is null
            ? nameof(DeliveryJourneyUpdatedByType.System)
            : nameof(DeliveryJourneyUpdatedByType.Staff);
}