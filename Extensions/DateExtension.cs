using System;

namespace DespatchWeb.Extensions;

public static class DateExtension
{
    extension(DateTime dateTime)
    {
        public DateTime ResetTimeToStartOfDay() => 
            new(dateTime.Year, dateTime.Month, dateTime.Day, 0, 0, 0, 0);

        public DateTime ResetTimeToEndOfDay() => 
            new(dateTime.Year, dateTime.Month, dateTime.Day, 23, 59, 59, 999);

        public DateTime CombineWithTime(DateTime? time) =>
            new(
                dateTime.Year,
                dateTime.Month,
                dateTime.Day,
                time?.Hour ?? 0,
                time?.Minute ?? 0,
                time?.Second ?? 0
            );
    }
}
