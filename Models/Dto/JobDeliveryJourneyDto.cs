using System;

namespace DespatchWeb.Models.Dto;

public class JobDeliveryJourneyDto
{
    public int Id { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string ChangeType { get; set; }
    public string Comments { get; set; }
    public string FieldName { get; set; }
    
    // Staff
    public string StaffFirstName { get; set; }
    public string StaffLastName { get; set; }
    
    // Courier
    public string CourierName { get; set; }
    public string CourierSurname { get; set; }
    
    // Flight
    public string FlightNumber { get; set; }
    
    // New Agent
    public string NewAgentName { get; set; }
    
    // Old Agent
    public string OldAgentName { get; set; }
    
    // New Job Status
    public string NewJobStatusName { get; set; }
    
    // Old Job Status
    public string OldJobStatusName { get; set; }
}

public class JobDeliveryJourneyArchiveDto
{
    public int Id { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string ChangeType { get; set; }
    public int? OldJobStatusId { get; set; }
    public int? NewJobStatusId { get; set; }
    public string UpdatedByType { get; set; }
    public int? FlightId { get; set; }
    public int? NewAgentId { get; set; }
    public int? OldAgentId { get; set; }
    public string FieldName { get; set; }
    public string OldValue { get; set; }
    public string NewValue { get; set; }
}