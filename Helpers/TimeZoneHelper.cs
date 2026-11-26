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

    /// <summary>
    /// Converts a tenant-local wall-clock time to UTC. A time that does not exist (skipped by a spring-forward change)
    /// is read at the zone's standard offset, which lands just after the gap whatever its length.
    /// </summary>
    public static DateTime TenantLocalToUtc(DateTime local, string timeZone)
    {
        var tz = GetTimeZoneInfo(timeZone);
        var unspecified = DateTime.SpecifyKind(local, DateTimeKind.Unspecified);
        if (tz.IsInvalidTime(unspecified))
        {
            return DateTime.SpecifyKind(unspecified - tz.BaseUtcOffset, DateTimeKind.Utc);
        }

        return TimeZoneInfo.ConvertTimeToUtc(unspecified, tz);
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