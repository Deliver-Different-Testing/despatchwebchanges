namespace DespatchWeb.Models.Dto;

public class DeliveryJourneyDto
{
    public int EventId { get; init; }
    public string Description { get; init; }
    public DateTime? Date { get; init; }
    public DateTime? Time { get; init; }
    public bool Closed { get; init; }
    public string Despatcher { get; init; }
    
    // Staff In (Assigned to)
    public string AssignedToFirstName { get; init; }
    public string AssignedToLastName { get; init; }
    
    // Staff Out (Completed by)
    public string CompletedByFirstName { get; init; }
    public string CompletedByLastName { get; init; }
    
    // Audit trail
    public List<EventAuditDto> Audits { get; init; } = [];
}

public class EventAuditDto
{
    public string ChangeType { get; init; }
    public string ColumnName { get; init; }
    public string StaffFirstName { get; init; }
    public string StaffLastName { get; init; }
    public DateTime ChangedAt { get; init; }
}