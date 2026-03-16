namespace DespatchWeb.Models.Dto;

public sealed record JobDeliveryJourneyDto
{
    public int Id { get; init; }
    public DateTime UpdatedAt { get; init; }
    public string ChangeType { get; init; }
    public string Comments { get; init; }
    public string FieldName { get; init; }
    public string OldValue { get; init; }
    public string NewValue { get; init; }

    // Staff (who made the update)
    public string StaffFirstName { get; init; }
    public string StaffLastName { get; init; }

    // Courier (who made the update)
    public string CourierName { get; init; }
    public string CourierSurname { get; init; }

    // Flight
    public string FlightNumber { get; init; }

    // Agent changes
    public string NewAgentName { get; init; }
    public string OldAgentName { get; init; }

    // Job Status changes
    public string NewJobStatusName { get; init; }
    public string OldJobStatusName { get; init; }

    // Courier assignment changes
    public string NewCourierName { get; init; }
    public string OldCourierName { get; init; }
}

public sealed record JobDeliveryJourneyArchiveDto
{
    public int Id { get; init; }
    public DateTime UpdatedAt { get; init; }
    public string ChangeType { get; init; }
    public string Comments { get; init; }
    public string FieldName { get; init; }
    public string OldValue { get; init; }
    public string NewValue { get; init; }
    public string UpdatedByType { get; init; }

    // Staff (who made the update)
    public string StaffFirstName { get; init; }
    public string StaffLastName { get; init; }

    // Courier (who made the update)
    public string CourierName { get; init; }
    public string CourierSurname { get; init; }

    // Flight
    public string FlightNumber { get; init; }

    // Agent changes
    public string NewAgentName { get; init; }
    public string OldAgentName { get; init; }

    // Job Status changes
    public string NewJobStatusName { get; init; }
    public string OldJobStatusName { get; init; }

    // Courier assignment changes
    public string NewCourierName { get; init; }
    public string OldCourierName { get; init; }
}