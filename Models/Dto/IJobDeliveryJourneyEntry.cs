namespace DespatchWeb.Models.Dto;

/// <summary>
/// The columns shared by live and archived delivery journey rows, so the journey timeline is built by one code path.
/// </summary>
public interface IJobDeliveryJourneyEntry
{
    int Id { get; }
    DateTime UpdatedAt { get; }
    string ChangeType { get; }
    string Comments { get; }
    string FieldName { get; }
    string OldValue { get; }
    string NewValue { get; }
    string StaffFirstName { get; }
    string StaffLastName { get; }
    string CourierName { get; }
    string CourierSurname { get; }
    string FlightNumber { get; }
    string NewAgentName { get; }
    string OldAgentName { get; }
    string NewJobStatusName { get; }
    string OldJobStatusName { get; }
    string NewCourierName { get; }
    string OldCourierName { get; }
}
