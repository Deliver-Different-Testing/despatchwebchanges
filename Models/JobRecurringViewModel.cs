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

    // Recurring Route assignment. Null when not assigned to any route.
    // Consumed by the React detail panel's Route dropdown in
    // JobDetailHeader so the current selection pre-populates instead of
    // defaulting to "No route".
    public int? RouteId { get; init; }

    // Create-ahead offset (days). Pass-through from
    // tucJobBooking.RecurringInitialDays. Drives the "Create bookings X
    // days ahead" input in the RecurringJobFields card. Null / 0 means
    // legacy same-day behaviour.
    public int? RecurringInitialDays { get; init; }
}