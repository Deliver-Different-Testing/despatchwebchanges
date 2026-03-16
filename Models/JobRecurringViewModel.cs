namespace DespatchWeb.Models;

public sealed class JobRecurringViewModel : JobViewModel
{
    public Suggestion InActiveBy { get; init; }
    public DateTime? InActiveDate { get; init; }
    public DateTime? FirstDue { get; init; }
    public DateTime? NextDue { get; init; }
    public DateTime? LastDone { get; init; }
    public DateTime? StopDate { get; init; }
    public DateTime? RestartDate { get; init; }
    public bool? Active { get; init; }

    public int DaysOfWeek { get; init; }
    public int Frequency { get; init; }

    public int HolidayDeliveryOption { get; init; }
}