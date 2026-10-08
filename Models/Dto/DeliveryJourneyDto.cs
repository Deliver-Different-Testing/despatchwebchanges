namespace DespatchWeb.Models.Dto;

public sealed record DeliveryJourneyDto
{
    public int EventId { get; init; }
    public string Description { get; init; }
    public DateTime? Date { get; init; }
    public DateTime? Time { get; init; }
    public DateTime? CreatedAtUtc { get; init; }
    public bool Closed { get; init; }
    public string Despatcher { get; init; }
    
    // Staff In (Assigned to)
    public string AssignedToFirstName { get; init; }
    public string AssignedToLastName { get; init; }
    
    // Staff Out (Completed by)
    public string CompletedByFirstName { get; init; }
    public string CompletedByLastName { get; init; }
    
    // Audit trail
    public IReadOnlyList<EventAuditDto> Audits { get; init; } = [];
}
