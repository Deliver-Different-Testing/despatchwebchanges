using Serilog;
using TimeZoneConverter;

namespace DespatchWeb.Helpers;

public static class TimeZoneHelper
{
    /// <summary>
    /// Sets the timezone offset on a DateTimeOffset without converting the time.
    /// Use this for dates that are already in local time and just need the offset applied.
    /// For UTC dates that need conversion, use DateExtension.ToTimeZoneOffset instead.
    /// </summary>
    public static DateTimeOffset SetDateTimeWithTimeZone(DateTimeOffset dateTime, string timeZone)
    {
        var tz = GetTimeZoneInfo(timeZone);
        var offset = tz.GetUtcOffset(dateTime.DateTime);
        return new DateTimeOffset(dateTime.DateTime, offset);
    }

    /// <summary>
    /// Sets the timezone offset on a DateTime without converting the time.
    /// Use this for dates that are already in local time and just need the offset applied.
    /// For UTC dates that need conversion, use DateExtension.ToTimeZoneOffset instead.
    /// </summary>
    public static DateTimeOffset SetDateTimeWithTimeZone(DateTime dateTime, string timeZone)
    {
        var tz = GetTimeZoneInfo(timeZone);
        var offset = tz.GetUtcOffset(dateTime);
        return new DateTimeOffset(dateTime, offset);
    }

    private static TimeZoneInfo GetTimeZoneInfo(string timeZone)
    {
        if (string.IsNullOrWhiteSpace(timeZone))
        {
            throw new ArgumentException("Time zone cannot be null or empty.", nameof(timeZone));
        }

        if (TimeZoneInfo.TryFindSystemTimeZoneById(timeZone, out var tz))
        {
            Log.Debug("Using Windows time zone {TimeZone}", timeZone);
            return tz;
        }

        try
        {
            var windowsTimeZone = TZConvert.IanaToWindows(timeZone);
            tz = TimeZoneInfo.FindSystemTimeZoneById(windowsTimeZone);
            Log.Debug("Using IANA time zone {TimeZone} (converted to {WindowsTimeZone})", timeZone, windowsTimeZone);
            return tz;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Failed to convert or find time zone {TimeZone}", timeZone);
            throw new ArgumentException($"Invalid or unsupported time zone: {timeZone}", nameof(timeZone), ex);
        }
    }
}