using System;

namespace DespatchWeb.Models.RequestModels;

public class JobEventDataRequest
{
    public int StaffId { get; set; }
    public int JobId { get; set; }
    public string DespatcherName { get; set; }
    public string Notes { get; set; }
    public int EventTypeId { get; set; }
    public DateTime EventDueDate { get; set; }
}
