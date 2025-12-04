using System;

namespace DespatchWeb.Helpers;

public static class DateExtension
{
    public static DateTime ResetTimeToStartOfDay(this DateTime dateTime) => 
        new(dateTime.Year, dateTime.Month, dateTime.Day, 0, 0, 0, 0);

    public static DateTime ResetTimeToEndOfDay(this DateTime dateTime) => 
        new(dateTime.Year, dateTime.Month, dateTime.Day, 23, 59, 59, 999);
    
    public static DateTime CombineWithTime(this DateTime date, DateTime? time) =>
        new(
            date.Year,
            date.Month,
            date.Day,
            time?.Hour ?? 0,
            time?.Minute ?? 0,
            time?.Second ?? 0
        );
}
