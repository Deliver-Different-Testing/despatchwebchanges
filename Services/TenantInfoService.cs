using System;
using System.Globalization;
using System.Linq;
using DespatchWeb.Enums;
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

    public DateTime ConvertUtcToTenantTime(DateTime utcDateTime)
    {
        var tenantTimeZone = contextAccessor.HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "TimeZone")?.Value;
        var tenantTimeZoneInfo = TimeZoneInfo.FindSystemTimeZoneById(tenantTimeZone ?? string.Empty);

        return TimeZoneInfo.ConvertTimeFromUtc(utcDateTime, tenantTimeZoneInfo);
    }

    public DateTime ConvertUtcToTenantTime(string utcDateTime)
    {
        var parsedDateTime = DateTime.Parse(utcDateTime);
        var utcSpecifiedDateTime = DateTime.SpecifyKind(parsedDateTime, DateTimeKind.Utc);

        return ConvertUtcToTenantTime(utcSpecifiedDateTime);
    }
    
    public string FormatDateForTenant(DateTime? dateTime)
    {
        if (!dateTime.HasValue)
            return "";
        
        var countryCode = contextAccessor.HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "CountryCode")?.Value;
        
        var cultureCode = countryCode switch
        {
            "US" => "en-US",
            "GB" => "en-GB",
            "AU" => "en-AU",
            "NZ" => "en-NZ",
            _ => "en-US" // Default fallback
        };
        
        var culture = new CultureInfo(cultureCode);
        
        return dateTime.Value.ToString("g", culture); // "g" is short date/time pattern
    }

    public int GetStaffId()
    {
        var staffId = contextAccessor.HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "StaffID")?.Value;
        return int.Parse(staffId ?? string.Empty);
    }

    public bool IsUsTenant()
    {
        var usa = Country.Us.GetDescription();
        var countryCode = contextAccessor.HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "CountryCode")?.Value;

        return countryCode?.ToUpper().Equals(usa) ?? false;
    }
}
