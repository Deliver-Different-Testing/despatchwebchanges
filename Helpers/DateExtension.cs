using System;

namespace DespatchWeb.Helpers;

public static class DateExtension
{
    public static DateTime ResetTimeToStartOfDay(this DateTime dateTime)
    {
        return new DateTime(dateTime.Year, dateTime.Month, dateTime.Day, 0, 0, 0, 0);
    }

    public static DateTime ResetTimeToEndOfDay(this DateTime dateTime)
    {
        return new DateTime(dateTime.Year, dateTime.Month, dateTime.Day, 23, 59, 59, 999);
    }
}
