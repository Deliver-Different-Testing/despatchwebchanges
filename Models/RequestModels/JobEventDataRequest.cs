using System;

namespace DespatchWeb.Models.RequestModels;

public class JobEventDataRequest
{
    public int JobId { get; init; }
    public string Notes { get; init; }
    public int EventTypeId { get; init; }
    public DateTimeOffset EventDueDate { get; init; }
}
