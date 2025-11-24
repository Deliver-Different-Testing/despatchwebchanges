using System;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using TimeZone = DespatchWeb.EntityClasses.TimeZone;

namespace DespatchWeb.Services;

public class TenantInfoService(
    IHttpContextAccessor contextAccessor,
    IDbContextFactory<DespatchContext> contextFactory,
    IMemoryCache cache) : ITenantInfoService
{
    private DespatchContext Context => field ??= contextFactory.CreateDbContext();

    private string _cachedTimeZone;
    private string _cachedCountryCode;
    private int? _cachedStaffId;
    private int? _cachedContactId;
    private TimeZoneInfo _cachedTimeZoneInfo;
    private CultureInfo _cachedCultureInfo;

    private string GetTimeZone() => _cachedTimeZone ??= contextAccessor.HttpContext?.User.Claims
        .FirstOrDefault(x => x.Type == "TimeZone")?.Value;

    private string GetCountryCode() => _cachedCountryCode ??= contextAccessor.HttpContext?.User.Claims
        .FirstOrDefault(x => x.Type == "CountryCode")?.Value;

    private TimeZoneInfo GetTimeZoneInfo()
    {
        if (_cachedTimeZoneInfo != null) return _cachedTimeZoneInfo;
        var timeZone = GetTimeZone();
        _cachedTimeZoneInfo = TimeZoneInfo.FindSystemTimeZoneById(timeZone ?? "UTC");
        return _cachedTimeZoneInfo;
    }

    private CultureInfo GetCultureInfo()
    {
        if (_cachedCultureInfo != null) return _cachedCultureInfo;
        var countryCode = GetCountryCode();
        var cultureCode = countryCode switch
        {
            "US" => "en-US",
            "GB" => "en-GB",
            "AU" => "en-AU",
            "NZ" => "en-NZ",
            _ => "en-US"
        };
        _cachedCultureInfo = new CultureInfo(cultureCode);
        return _cachedCultureInfo;
    }

    public DateTime GetCurrentTenantTime()
    {
        var tenantTimeZoneInfo = GetTimeZoneInfo();
        return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tenantTimeZoneInfo);
    }

    public DateTime GetCurrentTimeFromTimeZone(TimeZone timeZone)
    {
        if (timeZone is null)
            return GetCurrentTenantTime();

        var cacheKey = $"timezone_info_{timeZone.Name}";
        var timeZoneInfo = cache.GetOrCreate(cacheKey, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromDays(1);
            return TimeZoneInfo.FindSystemTimeZoneById(timeZone.Name);
        });

        return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, timeZoneInfo);
    }

    public string FormatDateForTenant(DateTime? dateTime)
    {
        if (!dateTime.HasValue)
            return string.Empty;

        var culture = GetCultureInfo();
        return dateTime.Value.ToString("g", culture);
    }


    public int GetStaffId()
    {
        if (_cachedStaffId.HasValue) return _cachedStaffId.Value;
        var staffIdString = contextAccessor.HttpContext?.User.Claims
            .FirstOrDefault(x => x.Type == "StaffID")?.Value;
        _cachedStaffId = int.Parse(staffIdString ?? "0");
        return _cachedStaffId.Value;
    }

    public int GetContactId()
    {
        if (_cachedContactId.HasValue) return _cachedContactId.Value;
        var contactId = contextAccessor.HttpContext?.User.Claims
            .FirstOrDefault(x => x.Type == "ContactID")?.Value;
        _cachedContactId = int.Parse(contactId ?? "0");
        return _cachedContactId.Value;
    }

    public bool IsUsTenant()
    {
        var countryCode = GetCountryCode();
        var usa = Country.Us.GetDescription();
        return countryCode?.ToUpper().Equals(usa) ?? false;
    }

    public async Task<Suggestion> GetStaffInfoAsync()
    {
        var staffId = GetStaffId();

        // Cache key unique per staff member
        var cacheKey = $"staff_info_{staffId}";

        return await cache.GetOrCreateAsync(cacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(8);

            var staff = await Context.TucStaffs
                .Where(s => s.UcstId == staffId)
                .Select(s => new Suggestion
                {
                    Id = s.UcstId,
                    Text = s.UcstFirstName + " " + s.UcstLastName
                })
                .AsNoTracking()
                .FirstOrDefaultAsync();

            return staff;
        });
    }
    
    public string GetTenantTimeZone() => GetTimeZone() ?? "UTC";
    
    public DateTimeOffset ConvertUtcToTenantTimeZone(DateTime utcDateTime)
    {
        var tenantTimeZoneInfo = GetTimeZoneInfo();
        var tenantTime = TimeZoneInfo.ConvertTimeFromUtc(utcDateTime, tenantTimeZoneInfo);
        var offset = tenantTimeZoneInfo.GetUtcOffset(utcDateTime);
        return new DateTimeOffset(tenantTime, offset);
    }
}