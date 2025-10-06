using System;
using TimeZoneConverter;

namespace DespatchWeb.Helpers;

public static class TimeZoneHelper
{
    public static DateTimeOffset SetDateTimeWithTimeZone(DateTimeOffset dateTime, string timeZone)
    {
        var windowsTimeZone = TZConvert.IanaToWindows(timeZone);
        var tz = TimeZoneInfo.FindSystemTimeZoneById(windowsTimeZone);
        var offset = tz.GetUtcOffset(dateTime);
        return new DateTimeOffset(dateTime.DateTime, offset);
    }
}