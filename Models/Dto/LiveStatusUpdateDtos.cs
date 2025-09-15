using System;

namespace DespatchWeb.Models.Dto;

public abstract class JobStatusUpdateDto
{
    public DateTime UpdatedAt { get; set; }
    public string ChangeType { get; set; }
    public string Comments { get; set; }
    public string FieldName { get; set; }
    public string OldValue { get; set; }
    public string NewValue { get; set; }
}

public class LiveJobStatusUpdateDto : JobStatusUpdateDto
{
    public string StaffName { get; set; }
    public string CourierName { get; set; }
    public string FlightNo { get; set; }
    public string NewAgentName { get; set; }
    public string OldAgentName { get; set; }
    public string NewStatusName { get; set; }
    public string OldStatusName { get; set; }
}

public class ArchivedJobStatusUpdateDto : JobStatusUpdateDto
{
    public string UpdatedByType { get; set; }
    public int? FlightId { get; set; }
    public int? NewAgentId { get; set; }
    public int? OldAgentId { get; set; }
    public int? NewJobStatusId { get; set; }
    public int? OldJobStatusId { get; set; }
}