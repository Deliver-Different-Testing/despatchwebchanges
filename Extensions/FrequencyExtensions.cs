using DespatchWeb.Enums;

namespace DespatchWeb.Extensions;

public static class FrequencyExtensions
{
    extension(Frequency frequency)
    {
        public string ToDisplayString() =>
            frequency switch
            {
                Frequency.None => "None",
                Frequency.Weekly => "Weekly",
                Frequency.Fortnightly => "Fortnightly",
                Frequency.FirstOfMonth => "First of the Month",
                Frequency.SecondOfMonth => "Second of the Month",
                Frequency.ThirdOfMonth => "Third of the Month",
                Frequency.FirstWorkdayOfMonth => "First Workday of the Month",
                Frequency.LastWorkdayOfMonth => "Last Workday of the Month",
                _ => string.Join(", ", frequency.GetSelectedFrequencies().Select(f => f.ToDisplayString()))
            };

        private Frequency[] GetSelectedFrequencies() =>
        [
            .. Enum.GetValues<Frequency>()
                .Where(f => f != Frequency.None)
                .Where(f => frequency.HasFlag(f))
        ];

        private bool MatchesDate(DateTime date, DateTime referenceDate)
        {
            var matches = false;

            if (frequency.HasFlag(Frequency.Weekly))
            {
                matches |= IsWeeklyMatch(date, referenceDate);
            }

            if (frequency.HasFlag(Frequency.Fortnightly))
            {
                matches |= IsFortnightlyMatch(date, referenceDate);
            }

            if (frequency.HasFlag(Frequency.FirstOfMonth))
            {
                matches |= date.Day == 1;
            }

            if (frequency.HasFlag(Frequency.SecondOfMonth))
            {
                matches |= date.Day == 2;
            }

            if (frequency.HasFlag(Frequency.ThirdOfMonth))
            {
                matches |= date.Day == 3;
            }

            if (frequency.HasFlag(Frequency.FirstWorkdayOfMonth))
            {
                matches |= IsFirstWorkdayOfMonth(date);
            }

            if (frequency.HasFlag(Frequency.LastWorkdayOfMonth))
            {
                matches |= IsLastWorkdayOfMonth(date);
            }

            return matches;
        }
    }

    // Helper methods
    public static bool IsWeeklyMatch(DateTime date, DateTime reference) => date.DayOfWeek == reference.DayOfWeek;

    public static bool IsFortnightlyMatch(DateTime date, DateTime reference)
    {
        var diff = date.Date - reference.Date;
        return Math.Abs(diff.Days) % 14 == 0;
    }

    public static bool IsFirstWorkdayOfMonth(DateTime date)
    {
        var isWeekday = date.DayOfWeek != DayOfWeek.Saturday && date.DayOfWeek != DayOfWeek.Sunday;

        if (!isWeekday)
        {
            return false;
        }

        if (date.Day == 1)
        {
            return true;
        }

        var current = new DateTime(date.Year, date.Month, 1);
        while (current < date)
        {
            if (current.DayOfWeek != DayOfWeek.Saturday && current.DayOfWeek != DayOfWeek.Sunday)
            {
                return false;
            }

            current = current.AddDays(1);
        }

        return true;
    }

    public static bool IsLastWorkdayOfMonth(DateTime date)
    {
        var isWeekday = date.DayOfWeek != DayOfWeek.Saturday && date.DayOfWeek != DayOfWeek.Sunday;

        if (!isWeekday)
        {
            return false;
        }

        var lastDay = new DateTime(date.Year, date.Month, DateTime.DaysInMonth(date.Year, date.Month));

        if (lastDay.DayOfWeek != DayOfWeek.Saturday && lastDay.DayOfWeek != DayOfWeek.Sunday && lastDay == date.Date)
        {
            return true;
        }

        var current = date.AddDays(1);
        while (current <= lastDay)
        {
            if (current.DayOfWeek != DayOfWeek.Saturday && current.DayOfWeek != DayOfWeek.Sunday)
            {
                return false;
            }

            current = current.AddDays(1);
        }

        return true;
    }

    public static DateTime? GetNextOccurrenceForSingleFrequency(Frequency frequency, DateTime after, DateTime referenceDate)
    {
        var current = after.AddDays(1);

        for (var i = 0; i < 100; i++)
        {
            if (frequency.MatchesDate(current, referenceDate))
            {
                return current;
            }

            current = current.AddDays(1);
        }

        return null;
    }
}