using System;
using System.Collections.Generic;
using System.Linq;

namespace DespatchWeb.Enums;

[Flags]
public enum DaysOfWeek
{
    None = 0,
    Monday = 1,
    Tuesday = 2,
    Wednesday = 4,
    Thursday = 8,
    Friday = 16,
    Saturday = 32,
    Sunday = 64,
    Weekdays = Monday | Tuesday | Wednesday | Thursday | Friday,
    Weekend = Saturday | Sunday,
    All = Weekdays | Weekend
}

public static class DaysOfWeekExtensions
{
    // Convert to readable string (e.g., "Monday, Wednesday, Friday")
    public static string ToDisplayString(this DaysOfWeek days) => days == DaysOfWeek.None
        ? "None"
        : string.Join(", ", GetSelectedDays(days).Select(d => d.ToString()));

    // Get array of selected DaysOfWeek values
    public static DaysOfWeek[] GetSelectedDays(this DaysOfWeek days)
    {
        return Enum.GetValues(typeof(DaysOfWeek))
            .Cast<DaysOfWeek>()
            .Where(d => d != DaysOfWeek.None && d != DaysOfWeek.Weekdays && d != DaysOfWeek.Weekend &&
                        d != DaysOfWeek.All)
            .Where(d => days.HasFlag(d))
            .ToArray();
    }

    // Check if a specific day is included
    public static bool IncludesDay(this DaysOfWeek days, DaysOfWeek day) => (days & day) == day;

    // Add one or more days
    public static DaysOfWeek AddDays(this DaysOfWeek days, DaysOfWeek daysToAdd) => days | daysToAdd;

    // Remove one or more days
    public static DaysOfWeek RemoveDays(this DaysOfWeek days, DaysOfWeek daysToRemove) => days & ~daysToRemove;

    // Convert from integer (for database operations)
    public static DaysOfWeek FromInt(int value) => (DaysOfWeek)value;

    // Convert to integer (for database operations)
    public static int ToInt(this DaysOfWeek days) => (int)days;

    // Parse from comma-separated string (useful for migration from string field)
    public static DaysOfWeek ParseFromString(string dayString)
    {
        if (string.IsNullOrWhiteSpace(dayString))
            return DaysOfWeek.None;

        var result = DaysOfWeek.None;
        var dayNames = dayString.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        foreach (var dayName in dayNames)
        {
            if (Enum.TryParse<DaysOfWeek>(dayName, true, out var day))
                result |= day;
        }

        return result;
    }

    // Get DayOfWeek instances for the selected days (for DateTime operations)
    public static List<DayOfWeek> ToDayOfWeekList(this DaysOfWeek days)
    {
        var result = new List<DayOfWeek>();
        if (days.HasFlag(DaysOfWeek.Monday)) result.Add(DayOfWeek.Monday);
        if (days.HasFlag(DaysOfWeek.Tuesday)) result.Add(DayOfWeek.Tuesday);
        if (days.HasFlag(DaysOfWeek.Wednesday)) result.Add(DayOfWeek.Wednesday);
        if (days.HasFlag(DaysOfWeek.Thursday)) result.Add(DayOfWeek.Thursday);
        if (days.HasFlag(DaysOfWeek.Friday)) result.Add(DayOfWeek.Friday);
        if (days.HasFlag(DaysOfWeek.Saturday)) result.Add(DayOfWeek.Saturday);
        if (days.HasFlag(DaysOfWeek.Sunday)) result.Add(DayOfWeek.Sunday);
        return result;
    }

    // Check if a DateTime falls on one of the selected days
    public static bool IncludesDate(this DaysOfWeek days, DateTime date) =>
        days.ToDayOfWeekList().Contains(date.DayOfWeek);
}
