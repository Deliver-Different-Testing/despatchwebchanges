using System;

namespace DespatchWeb.Models.Dto;

public class JobDeliveryJourneyDto
{
    public int Id { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string ChangeType { get; set; }
    public string Comments { get; set; }
    public string FieldName { get; set; }
    public string OldValue { get; set; }
    public string NewValue { get; set; }

    // Staff (who made the update)
    public string StaffFirstName { get; set; }
    public string StaffLastName { get; set; }

    // Courier (who made the update)
    public string CourierName { get; set; }
    public string CourierSurname { get; set; }

    // Flight
    public string FlightNumber { get; set; }

    // Agent changes
    public string NewAgentName { get; set; }
    public string OldAgentName { get; set; }

    // Job Status changes
    public string NewJobStatusName { get; set; }
    public string OldJobStatusName { get; set; }

    // Courier assignment changes
    public string NewCourierName { get; set; }
    public string OldCourierName { get; set; }
}

public class JobDeliveryJourneyArchiveDto
{
    public int Id { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string ChangeType { get; set; }
    public string Comments { get; set; }
    public string FieldName { get; set; }
    public string OldValue { get; set; }
    public string NewValue { get; set; }
    public string UpdatedByType { get; set; }

    // Staff (who made the update)
    public string StaffFirstName { get; set; }
    public string StaffLastName { get; set; }

    // Courier (who made the update)
    public string CourierName { get; set; }
    public string CourierSurname { get; set; }

    // Flight
    public string FlightNumber { get; set; }

    // Agent changes
    public string NewAgentName { get; set; }
    public string OldAgentName { get; set; }

    // Job Status changes
    public string NewJobStatusName { get; set; }
    public string OldJobStatusName { get; set; }

    // Courier assignment changes
    public string NewCourierName { get; set; }
    public string OldCourierName { get; set; }
}