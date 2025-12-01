using System;
using System.Collections.Generic;

namespace DespatchWeb.Models.Dto;

public class DeliveryJourneyDto
{
    public int EventId { get; set; }
    public string Description { get; set; }
    public DateTime? Date { get; set; }
    public DateTime? Time { get; set; }
    public bool Closed { get; set; }
    public string Despatcher { get; set; }
    
    // Staff In (Assigned to)
    public string AssignedToFirstName { get; set; }
    public string AssignedToLastName { get; set; }
    
    // Staff Out (Completed by)
    public string CompletedByFirstName { get; set; }
    public string CompletedByLastName { get; set; }
    
    // Audit trail
    public List<EventAuditDto> Audits { get; set; }
}

public class EventAuditDto
{
    public string ChangeType { get; set; }
    public string ColumnName { get; set; }
    public string StaffFirstName { get; set; }
    public string StaffLastName { get; set; }
    public DateTime ChangedAt { get; set; }
}