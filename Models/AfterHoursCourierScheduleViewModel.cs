using System;
using System.Collections.Generic;

namespace DespatchWeb.Models;

public class AfterHoursCourierScheduleViewModel
{
    public int AfterHoursScheduleId { get; set; }
    public int CourierId { get; set; }
    public string CourierName { get; set; }
    public string CourierCode { get; set; }
    public List<string> Days { get; set; } = [];
    public DateTimeOffset? StartTime { get; set; }
    public DateTimeOffset? EndTime { get; set; }
    public string Duration { get; set; }
}