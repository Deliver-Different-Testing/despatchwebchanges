namespace DespatchWeb.Helpers;

/// <summary>
/// A job's booked moment is stored in two columns: ucjbDate holds the date (midnight) and ucjbTime holds the
/// time of day, which the booking page anchors on 1899-12-30. Writing the full moment into both makes the journal
/// trigger log a date change for a time-only edit and an 1899 "old" time (#1023), so an edit writes only the
/// column that changed and keeps a time-only anchor as it is.
/// </summary>
public static class BookedDateTime
{
    // Anything on or before SQL Server's zero date is a time-only anchor, not a real date.
    private static readonly DateTime LastAnchorDate = new(1900, 1, 1);

    /// <summary>The values to write for a new booked moment, each null when that column is already right.</summary>
    public static (DateTime? Date, DateTime? Time) Split(DateTime booked, DateTime? currentDate, DateTime? currentTime)
    {
        var date = booked.Date;
        var timeOfDay = ToWholeSeconds(booked.TimeOfDay);
        var keepsAnchor = currentTime.HasValue && currentTime.Value.Date <= LastAnchorDate;
        var time = (keepsAnchor ? currentTime!.Value.Date : date) + timeOfDay;

        var newDate = currentDate == date ? (DateTime?)null : date;
        var timeUnchanged = currentTime.HasValue
                            && ToWholeSeconds(currentTime.Value.TimeOfDay) == timeOfDay
                            && (keepsAnchor || currentTime.Value.Date == date);

        return (newDate, timeUnchanged ? null : time);
    }

    private static TimeSpan ToWholeSeconds(TimeSpan value) =>
        TimeSpan.FromSeconds(Math.Floor(value.TotalSeconds));
}
