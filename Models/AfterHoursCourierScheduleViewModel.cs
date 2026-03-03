using System;
using System.Collections.Generic;

namespace DespatchWeb.Models;

public class AfterHoursCourierScheduleViewModel
{
    public int AfterHoursScheduleId { get; init; }
    public int CourierId { get; init; }
    public string CourierName { get; init; }
    public string CourierCode { get; init; }
    public List<string> Days { get; init; } = [];
    public DateTimeOffset? StartTime { get; init; }
    public DateTimeOffset? EndTime { get; init; }
    public string Duration { get; init; }
}