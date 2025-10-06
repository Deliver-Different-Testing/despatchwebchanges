using System;

namespace DespatchWeb.Helpers;

public static class TimeZoneHelper
{
    public static DateTimeOffset SetDateTimeWithTimeZone(DateTimeOffset dateTime, string timeZone)
    {
        var tz = TimeZoneInfo.FindSystemTimeZoneById(timeZone);
        var offset = tz.GetUtcOffset(dateTime);
        return new DateTimeOffset(dateTime.DateTime, offset);
    }
}