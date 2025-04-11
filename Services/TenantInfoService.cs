using System;
using System.Linq;
using DespatchWeb.Interfaces;
using Microsoft.AspNetCore.Http;

namespace DespatchWeb.Services;

public class TenantInfoService(IHttpContextAccessor contextAccessor) : ITenantInfoService
{
    public DateTime GetCurrentTenantTime()
    {
        var tenantTimeZone = contextAccessor.HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "TimeZone")?.Value;
        var tenantTimeZoneInfo = TimeZoneInfo.FindSystemTimeZoneById(tenantTimeZone ?? string.Empty);
        var utcDateTime = DateTime.UtcNow;

        return TimeZoneInfo.ConvertTimeFromUtc(utcDateTime, tenantTimeZoneInfo);
    }

    public int GetStaffId()
    {
        var staffId = contextAccessor.HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "StaffID")?.Value;
        return int.Parse(staffId ?? string.Empty);
    }
}
