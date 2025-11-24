using System;
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
    extension(DaysOfWeek days)
    {
        public string ToDisplayString() => days == DaysOfWeek.None
            ? "None"
            : string.Join(", ", GetSelectedDays(days).Select(d => d.ToString()));

        public DaysOfWeek[] GetSelectedDays()
        {
            return Enum.GetValues(typeof(DaysOfWeek))
                .Cast<DaysOfWeek>()
                .Where(d => d != DaysOfWeek.None && d != DaysOfWeek.Weekdays && d != DaysOfWeek.Weekend &&
                            d != DaysOfWeek.All)
                .Where(d => days.HasFlag(d))
                .ToArray();
        }
    }
}