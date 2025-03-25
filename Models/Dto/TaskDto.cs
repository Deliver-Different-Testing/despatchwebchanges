using System;

namespace DespatchWeb.Models.Dto;

public class TaskDto
{
    public int Id { get; set; }
    public string Despatcher { get; set; }
    public string Notes { get; set; }
    public int? JobId { get; set; }
    public bool? Closed { get; set; }
    public DateTime? Date { get; set; }
    public DateTime? Time { get; set; }
    public string Description { get; set; }
    public double EventType { get; set; }
    public int StaffId { get; set; }
    public string StaffFirstName { get; set; }
    public string StaffLastName { get; set; }
}
