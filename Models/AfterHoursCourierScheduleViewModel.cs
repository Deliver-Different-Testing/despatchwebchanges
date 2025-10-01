using System;

namespace DespatchWeb.Models;

public class AfterHoursCourierScheduleViewModel
{
    public int AfterHoursScheduleId { get; set; }
    public int CourierId { get; set; }
    public string CourierName { get; set; }
    public string CourierCode { get; set; }
    public string Day { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public string Duration { get; set; }
}