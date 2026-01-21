namespace DespatchWeb.Helpers;

/// <summary>
/// Helper class for converting between day names and integer values.
/// Uses SQL Server DATEPART(WEEKDAY) convention: Sunday=1, Monday=2, ..., Saturday=7
/// </summary>
public static class DayOfWeekHelper
{
    /// <summary>
    /// Converts a day name string to its SQL Server DATEPART(WEEKDAY) integer value.
    /// </summary>
    /// <param name="dayOfWeek">The day name (e.g., "Monday", "Sunday")</param>
    /// <returns>Integer value 1-7 where Sunday=1, Monday=2, ..., Saturday=7. Returns 0 for invalid input.</returns>
    public static int DayNameToSqlInt(string dayOfWeek) =>
        dayOfWeek switch
        {
            "Sunday" => 1,
            "Monday" => 2,
            "Tuesday" => 3,
            "Wednesday" => 4,
            "Thursday" => 5,
            "Friday" => 6,
            "Saturday" => 7,
            _ => 0
        };

    /// <summary>
    /// Converts a SQL Server DATEPART(WEEKDAY) integer value to its day name.
    /// </summary>
    /// <param name="sqlDayOfWeek">Integer value 1-7 where Sunday=1, Monday=2, ..., Saturday=7</param>
    /// <returns>The day name string, or "Unknown" for invalid input.</returns>
    public static string SqlIntToDayName(int sqlDayOfWeek) =>
        sqlDayOfWeek switch
        {
            1 => "Sunday",
            2 => "Monday",
            3 => "Tuesday",
            4 => "Wednesday",
            5 => "Thursday",
            6 => "Friday",
            7 => "Saturday",
            _ => "Unknown"
        };
}
