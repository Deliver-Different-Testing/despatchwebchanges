using System;

namespace DespatchWeb.Models.RequestModels;

public class JobEventDataRequest
{
    public int JobId { get; set; }
    public string Notes { get; set; }
    public int EventTypeId { get; set; }
    public DateTimeOffset EventDueDate { get; set; }
}
