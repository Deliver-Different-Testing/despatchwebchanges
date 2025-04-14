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

    public DaysOfWeek DaysOfWeek { get; set; }
    public Frequency Frequency { get; set; }

    public string DaysDisplay => DaysOfWeek.ToDisplayString();
    public string FrequencyDisplay => Frequency.ToDisplayString();

    public bool IncludesDay(DaysOfWeek day) => DaysOfWeek.IncludesDay(day);

    public bool ShouldRunOnDate(DateTime date) =>
        DaysOfWeek.IncludesDate(date) && Frequency.MatchesDate(date);

    public DateTime? GetNextRunDate(DateTime after)
    {
        var nextFrequencyDate = Frequency.GetNextOccurrence(after);
        if (!nextFrequencyDate.HasValue)
            return null;

        // Find the next date that matches both frequency and day of week
        var current = nextFrequencyDate.Value;
        for (var i = 0; i < 14; i++) // Look ahead up to 2 weeks
        {
            if (DaysOfWeek.IncludesDate(current))
                return current;

            current = current.AddDays(1);
        }

        return null;
    }
}
