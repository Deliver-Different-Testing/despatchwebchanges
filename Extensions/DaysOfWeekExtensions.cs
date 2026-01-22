using System;
using System.Linq;
using DespatchWeb.Enums;

namespace DespatchWeb.Extensions;

public static class DaysOfWeekExtensions
{
    extension(DaysOfWeek days)
    {
        public string ToDisplayString() =>
            days == DaysOfWeek.None
                ? "None"
                : string.Join(", ", days.GetSelectedDays().Select(d => d.ToString()));

        private DaysOfWeek[] GetSelectedDays() =>
            Enum.GetValues<DaysOfWeek>()
                .Where(d => d != DaysOfWeek.None && d != DaysOfWeek.Weekdays && d != DaysOfWeek.Weekend &&
                            d != DaysOfWeek.All)
                .Where(d => days.HasFlag(d))
                .ToArray();

        /// <summary>
        /// Converts the DaysOfWeek flags to a 7-character binary string in MTWTFSS order.
        /// Each position is '1' if the day is selected, '0' if not.
        /// Example: Monday + Tuesday + Wednesday = "1110000"
        /// </summary>
        public string ToBinaryString() =>
            string.Concat(
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