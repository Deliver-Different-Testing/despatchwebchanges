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

        public DateTime ToTimeZone(string timeZoneId)
        {
            var timeZone = DateTime.FindTimeZoneById(timeZoneId);
            return TimeZoneInfo.ConvertTimeFromUtc(dateTime, timeZone);
        }

        public DateTimeOffset ToTimeZoneOffset(TimeZoneInfo timeZone)
        {
            var converted = TimeZoneInfo.ConvertTimeFromUtc(dateTime, timeZone);
            var offset = timeZone.GetUtcOffset(converted);
            return new DateTimeOffset(converted, offset);
        }

        public DateTimeOffset ToTimeZoneOffset(string timeZoneId)
        {
            var timeZone = DateTime.FindTimeZoneById(timeZoneId);
            var converted = TimeZoneInfo.ConvertTimeFromUtc(dateTime, timeZone);
            var offset = timeZone.GetUtcOffset(converted);
            return new DateTimeOffset(converted, offset);
        }

        private static TimeZoneInfo FindTimeZoneById(string timeZoneId)
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
            }
            catch (TimeZoneNotFoundException)
            {
                // On Windows, IANA timezone IDs (e.g., "America/Los_Angeles") are not recognized.
                return TimeZoneInfo.TryConvertIanaIdToWindowsId(timeZoneId, out var windowsId) ? TimeZoneInfo.FindSystemTimeZoneById(windowsId) :
                    // If conversion fails, fall back to UTC
                    TimeZoneInfo.Utc;
            }
        }
    }
}
