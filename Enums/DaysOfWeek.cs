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
    public static string ToDisplayString(this DaysOfWeek days)
    {
        return days == DaysOfWeek.None
            ? "None"
            : string.Join(", ", days.GetSelectedDays().Select(d => d.ToString()));
    }

    public static DaysOfWeek[] GetSelectedDays(this DaysOfWeek days)
    {
        return Enum.GetValues(typeof(DaysOfWeek))
            .Cast<DaysOfWeek>()
            .Where(d => d != DaysOfWeek.None && d != DaysOfWeek.Weekdays && d != DaysOfWeek.Weekend &&
                        d != DaysOfWeek.All)
            .Where(d => days.HasFlag(d))
            .ToArray();
    }

    /// <summary>
    /// Converts the DaysOfWeek flags to a 7-character binary string in MTWTFSS order.
    /// Each position is '1' if the day is selected, '0' if not.
    /// Example: Monday + Tuesday + Wednesday = "1110000"
    /// </summary>
    public static string ToBinaryString(this DaysOfWeek days)
    {
        return string.Concat(
            days.HasFlag(DaysOfWeek.Monday) ? '1' : '0',
            days.HasFlag(DaysOfWeek.Tuesday) ? '1' : '0',
            days.HasFlag(DaysOfWeek.Wednesday) ? '1' : '0',
            days.HasFlag(DaysOfWeek.Thursday) ? '1' : '0',
            days.HasFlag(DaysOfWeek.Friday) ? '1' : '0',
            days.HasFlag(DaysOfWeek.Saturday) ? '1' : '0',
            days.HasFlag(DaysOfWeek.Sunday) ? '1' : '0'
        );
    }
}