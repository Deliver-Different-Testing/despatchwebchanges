using System;
using System.Linq;
using DespatchWeb.Interfaces;
using Microsoft.AspNetCore.Http;

namespace DespatchWeb.Services;

public class TenantTimeService(IHttpContextAccessor contextAccessor) : ITenantTimeService
{
    public DateTime GetCurrentTenantTime()
    {
        var tenantTimeZone = contextAccessor.HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "TimeZone")?.Value;
        var tenantTimeZoneInfo = TimeZoneInfo.FindSystemTimeZoneById(tenantTimeZone ?? string.Empty);
        var utcDateTime = DateTime.UtcNow;

        return TimeZoneInfo.ConvertTimeFromUtc(utcDateTime, tenantTimeZoneInfo);
    }
}
