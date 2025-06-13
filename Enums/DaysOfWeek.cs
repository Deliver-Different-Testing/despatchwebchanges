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
    public static string ToDisplayString(this DaysOfWeek days) => days == DaysOfWeek.None
        ? "None"
        : string.Join(", ", GetSelectedDays(days).Select(d => d.ToString()));

    private static DaysOfWeek[] GetSelectedDays(this DaysOfWeek days)
    {
        return Enum.GetValues(typeof(DaysOfWeek))
            .Cast<DaysOfWeek>()
            .Where(d => d != DaysOfWeek.None && d != DaysOfWeek.Weekdays && d != DaysOfWeek.Weekend &&
                        d != DaysOfWeek.All)
            .Where(d => days.HasFlag(d))
            .ToArray();
    }

    public static bool IncludesDay(this DaysOfWeek days, DaysOfWeek day) => (days & day) == day;
    
    private static List<DayOfWeek> ToDayOfWeekList(this DaysOfWeek days)
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

    public static bool IncludesDate(this DaysOfWeek days, DateTime date) =>
        days.ToDayOfWeekList().Contains(date.DayOfWeek);
}
