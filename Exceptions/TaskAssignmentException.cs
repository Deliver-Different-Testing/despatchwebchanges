namespace DespatchWeb.Exceptions;

/// <summary>
/// A task can't be assigned because a staff record it needs is missing: either the person it is being
/// assigned to, or the signed-in user (every assignment writes a tucEventAudit row keyed on the caller's
/// StaffID, and both tucEvent.UcevStaffIDIn and tucEventAudit.UceaStaffID are foreign keys to tucStaff).
/// </summary>
/// <remarks>
/// Before this check the update went to SQL Server and failed on FK_tucEvent_tucStaff_In, which the
/// controller sanitised to a generic 500 ("Couldn't assign the task"). Crisis hit this on 10 Nov 2026
/// with a login whose StaffID claim had no tucStaff row. Messages here are written by us and carry no
/// exception text or schema detail, so the controller returns them verbatim.
/// </remarks>
public class TaskAssignmentException(string message) : Exception(message)
{
    public const string CallerNotStaff =
        "Your login isn't linked to a staff record, so tasks can't be assigned. Ask your DFRNT administrator to link it.";

    public const string AssigneeNotStaff =
        "That person isn't in the staff list, so the task can't be assigned to them.";
}
