namespace DespatchWeb.Helpers;

/// <summary>
/// Helper class for converting between day names and integer values.
/// Uses ISO 8601 weekday convention: Monday=1, Tuesday=2, ..., Sunday=7
/// </summary>
public static class DayOfWeekHelper
{
    /// <summary>
    /// Converts a day name string to its ISO 8601 weekday integer value.
    /// </summary>
    /// <param name="dayOfWeek">The day name (e.g., "Monday", "Sunday")</param>
    /// <returns>Integer value 1-7 where Monday=1, Tuesday=2, ..., Sunday=7. Returns 0 for invalid input.</returns>
    public static int DayNameToSqlInt(string dayOfWeek) =>
        dayOfWeek?.ToLowerInvariant() switch
        {
            "monday" => 1,
            "tuesday" => 2,
            "wednesday" => 3,
            "thursday" => 4,
            "friday" => 5,
            "saturday" => 6,
            "sunday" => 7,
            _ => 0
        };

    /// <summary>
    /// Converts an ISO 8601 weekday integer value to its day name.
    /// </summary>
    /// <param name="sqlDayOfWeek">Integer value 1-7 where Monday=1, Tuesday=2, ..., Sunday=7</param>
    /// <returns>The day name string, or "Unknown" for invalid input.</returns>
    public static string SqlIntToDayName(int sqlDayOfWeek) =>
        sqlDayOfWeek switch
        {
            1 => "Monday",
            2 => "Tuesday",
            3 => "Wednesday",
            4 => "Thursday",
            5 => "Friday",
            6 => "Saturday",
            7 => "Sunday",
            _ => "Unknown"
        };
}
