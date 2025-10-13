using System;
using DespatchWeb.Enums;

namespace DespatchWeb.Models;

public class JobRecurringViewModel : JobViewModel
{
    public Suggestion InActiveBy { get; set; }
    public DateTime? InActiveDate { get; set; }
    public DateTime? FirstDue { get; set; }
    public DateTime? NextDue { get; set; }
    public DateTime? LastDone { get; set; }
    public DateTime? StopDate { get; set; }
    public DateTime? RestartDate { get; set; }
    public bool? Active { get; set; }
    public string CustomJobName { get; set; }

    public int DaysOfWeek { get; set; }
    public int Frequency { get; set; }

    public int HolidayDeliveryOption { get; set; }
}