using System;
using Serilog;
using TimeZoneConverter;

namespace DespatchWeb.Helpers;

public static class TimeZoneHelper
{
    public static DateTimeOffset SetDateTimeWithTimeZone(DateTimeOffset dateTime, string timeZone)
    {
        if (TimeZoneInfo.TryFindSystemTimeZoneById(timeZone, out var tz))
        {
            Log.Debug("Using Windows time zone {TimeZone}", timeZone);
        }
        else
        {
            // Assume it's an IANA time zone and convert it
            var windowsTimeZone = TZConvert.IanaToWindows(timeZone);
            tz = TimeZoneInfo.FindSystemTimeZoneById(windowsTimeZone);
            Log.Debug("Using IANA time zone {TimeZone}", timeZone);
        }
    
        var offset = tz.GetUtcOffset(dateTime);
        return new DateTimeOffset(dateTime.DateTime, offset);
    }
}