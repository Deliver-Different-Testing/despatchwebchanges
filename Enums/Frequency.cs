using System;
using System.Linq;

namespace DespatchWeb.Enums;

[Flags]
public enum Frequency
{
    None = 0,
    Weekly = 1,
    Fortnightly = 2,
    FirstOfMonth = 4,
    SecondOfMonth = 8,
    ThirdOfMonth = 16,
    FirstWorkdayOfMonth = 32,
    LastWorkdayOfMonth = 64
}

public static class FrequencyExtensions
{
    // Convert to readable string
    public static string ToDisplayString(this Frequency frequency)
    {
        return frequency switch
        {
            Frequency.None => "None",
            Frequency.Weekly => "Weekly",
            Frequency.Fortnightly => "Fortnightly",
            Frequency.FirstOfMonth => "First of the Month",
            Frequency.SecondOfMonth => "Second of the Month",
            Frequency.ThirdOfMonth => "Third of the Month",
            Frequency.FirstWorkdayOfMonth => "First Workday of the Month",
            Frequency.LastWorkdayOfMonth => "Last Workday of the Month",
            _ => string.Join(", ", GetSelectedFrequencies(frequency).Select(ToDisplayString))
        };
    }

    // Get array of selected Frequency values
    public static Frequency[] GetSelectedFrequencies(this Frequency frequency)
    {
        return Enum.GetValues(typeof(Frequency))
            .Cast<Frequency>()
            .Where(f => f != Frequency.None)
            .Where(f => frequency.HasFlag(f))
            .ToArray();
    }

    // Check if a specific frequency is included
    public static bool IncludesFrequency(this Frequency frequency, Frequency freqToCheck) =>
        (frequency & freqToCheck) == freqToCheck;

    // Add one or more frequencies
    public static Frequency AddFrequency(this Frequency frequency, Frequency freqToAdd) => frequency | freqToAdd;

    // Remove one or more frequencies
    public static Frequency RemoveFrequency(this Frequency frequency, Frequency freqToRemove) =>
        frequency & ~freqToRemove;

    // Convert from integer (for database operations)
    public static Frequency FromInt(int value) => (Frequency)value;

    // Convert to integer (for database operations)
    public static int ToInt(this Frequency frequency) => (int)frequency;

    // Parse from string (useful for migration from string field)
    public static Frequency ParseFromString(string frequencyString)
    {
        if (string.IsNullOrWhiteSpace(frequencyString))
            return Frequency.None;

        return frequencyString.ToLower() switch
        {
            "weekly" => Frequency.Weekly,
            "fortnightly" => Frequency.Fortnightly,
            "first of the month" => Frequency.FirstOfMonth,
            "second of the month" => Frequency.SecondOfMonth,
            "third of the month" => Frequency.ThirdOfMonth,
            "first workday of the month" => Frequency.FirstWorkdayOfMonth,
            "last workday of the month" => Frequency.LastWorkdayOfMonth,
            _ => Frequency.None
        };
    }

    // Check if a specific date matches this frequency
    public static bool MatchesDate(this Frequency frequency, DateTime date, DateTime? referenceDate = null)
    {
        referenceDate ??= DateTime.Today;

        // For any frequency, check each flag
        var matches = false;

        if (frequency.HasFlag(Frequency.Weekly)) matches |= IsWeeklyMatch(date, referenceDate.Value);

        if (frequency.HasFlag(Frequency.Fortnightly)) matches |= IsFortnightlyMatch(date, referenceDate.Value);

        if (frequency.HasFlag(Frequency.FirstOfMonth)) matches |= date.Day == 1;

        if (frequency.HasFlag(Frequency.SecondOfMonth)) matches |= date.Day == 2;

        if (frequency.HasFlag(Frequency.ThirdOfMonth)) matches |= date.Day == 3;

        if (frequency.HasFlag(Frequency.FirstWorkdayOfMonth)) matches |= IsFirstWorkdayOfMonth(date);

        if (frequency.HasFlag(Frequency.LastWorkdayOfMonth)) matches |= IsLastWorkdayOfMonth(date);

        return matches;
    }

    // Get the next occurrence of this frequency after the specified date
    public static DateTime? GetNextOccurrence(this Frequency frequency, DateTime after)
    {
        var selectedFrequencies = GetSelectedFrequencies(frequency);
        if (selectedFrequencies.Length == 0)
            return null;

        // Find the next occurrence for each selected frequency
        var nextDates = selectedFrequencies.Select(f => GetNextOccurrenceForSingleFrequency(f, after))
            .Where(d => d.HasValue)
            .Select(d => d.Value);

        // Return the earliest one
        var dateTimes = nextDates as DateTime[] ?? nextDates.ToArray();
        return dateTimes.Length != 0 ? dateTimes.Min() : null;
    }

    // Helper methods
    private static bool IsWeeklyMatch(DateTime date, DateTime reference)
    {
        // For weekly, just check if the day of week matches the reference
        return date.DayOfWeek == reference.DayOfWeek;
    }

    private static bool IsFortnightlyMatch(DateTime date, DateTime reference)
    {
        // For fortnightly, check if the days are exactly 14 days apart from reference
        var diff = date.Date - reference.Date;
        return Math.Abs(diff.Days) % 14 == 0;
    }

    private static bool IsFirstWorkdayOfMonth(DateTime date)
    {
        // Check if the date is a weekday (not Saturday or Sunday)
        var isWeekday = date.DayOfWeek != DayOfWeek.Saturday && date.DayOfWeek != DayOfWeek.Sunday;

        if (!isWeekday)
            return false;

        // Check if it's the first day of the month
        if (date.Day == 1)
            return true;

        // Otherwise, check if all previous days in the month are weekend days
        var current = new DateTime(date.Year, date.Month, 1);
        while (current < date)
        {
            if (current.DayOfWeek != DayOfWeek.Saturday && current.DayOfWeek != DayOfWeek.Sunday)
                return false;

            current = current.AddDays(1);
        }

        return true;
    }

    private static bool IsLastWorkdayOfMonth(DateTime date)
    {
        // Check if the date is a weekday (not Saturday or Sunday)
        var isWeekday = date.DayOfWeek != DayOfWeek.Saturday && date.DayOfWeek != DayOfWeek.Sunday;

        if (!isWeekday)
            return false;

        // Get the last day of the month
        var lastDay = new DateTime(date.Year, date.Month, DateTime.DaysInMonth(date.Year, date.Month));

        // If the last day is a weekday and it's our date, return true
        if (lastDay.DayOfWeek != DayOfWeek.Saturday && lastDay.DayOfWeek != DayOfWeek.Sunday && lastDay == date.Date)
            return true;

        // Otherwise, check if all subsequent days in the month are weekend days
        var current = date.AddDays(1);
        while (current <= lastDay)
        {
            if (current.DayOfWeek != DayOfWeek.Saturday && current.DayOfWeek != DayOfWeek.Sunday)
                return false;

            current = current.AddDays(1);
        }

        return true;
    }

    private static DateTime? GetNextOccurrenceForSingleFrequency(Frequency frequency, DateTime after)
    {
        // Start checking from the day after
        var current = after.AddDays(1);

        // Look ahead a reasonable amount (max 100 days to prevent infinite loops)
        for (var i = 0; i < 100; i++)
        {
            if (MatchesDate(frequency, current))
                return current;

            current = current.AddDays(1);
        }

        return null;
    }
}
