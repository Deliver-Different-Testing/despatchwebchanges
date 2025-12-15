using System;
using System.Collections.Frozen;
using System.Collections.Generic;
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
    private static readonly FrozenDictionary<string, string> CountryToCulture = new Dictionary<string, string>
    {
        ["US"] = "en-US",
        ["GB"] = "en-GB",
        ["AU"] = "en-AU",
        ["NZ"] = "en-NZ"
    }.ToFrozenDictionary();

    private DespatchContext Context => field ??= contextFactory.CreateDbContext();

    private int? _staffId;
    private int? _contactId;

    private string GetClaim(string claimType) =>
        contextAccessor.HttpContext?.User.Claims.FirstOrDefault(c => c.Type == claimType)?.Value;

    private string TimeZone => field ??= GetClaim("TimeZone");
    private string CountryCode => field ??= GetClaim("CountryCode");

    private TimeZoneInfo TenantTimeZoneInfo =>
        field ??= TimeZoneInfo.FindSystemTimeZoneById(TimeZone ?? "UTC");

    private CultureInfo TenantCultureInfo
    {
        get
        {
            if (field != null) return field;
            var cultureCode = CountryToCulture.GetValueOrDefault(CountryCode, "en-US");
            return field = new CultureInfo(cultureCode);
        }
    }

    public DateTime GetCurrentTenantTime() =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TenantTimeZoneInfo);

    public DateTime GetCurrentTimeFromTimeZone(TimeZone timeZone)
    {
        if (timeZone is null)
            return GetCurrentTenantTime();

        var timeZoneInfo = cache.GetOrCreate($"timezone_info_{timeZone.Name}", entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromDays(1);
            return TimeZoneInfo.FindSystemTimeZoneById(timeZone.Name);
        });

        return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, timeZoneInfo);
    }

    public string FormatDateForTenant(DateTime? dateTime) =>
        dateTime?.ToString("g", TenantCultureInfo) ?? string.Empty;

    public int GetStaffId() =>
        _staffId ??= int.TryParse(GetClaim("StaffID"), out var id) ? id : 0;

    public int GetContactId() =>
        _contactId ??= int.TryParse(GetClaim("ContactID"), out var id) ? id : 0;

    public bool IsUsTenant() =>
        string.Equals(CountryCode, Country.Us.GetDescription(), StringComparison.OrdinalIgnoreCase);

    public async Task<Suggestion> GetStaffInfoAsync()
    {
        var staffId = GetStaffId();

        return await cache.GetOrCreateAsync($"staff_info_{staffId}", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(8);

            return await Context.TucStaffs
                .Where(s => s.UcstId == staffId)
                .Select(s => new Suggestion
                {
                    Id = s.UcstId,
                    Text = s.UcstFirstName + " " + s.UcstLastName
                })
                .AsNoTracking()
                .FirstOrDefaultAsync();
        });
    }

    public string GetTenantTimeZone() => TimeZone ?? "UTC";

    public DateTimeOffset ConvertUtcToTenantTimeZone(DateTime utcDateTime)
    {
        var tenantTime = TimeZoneInfo.ConvertTimeFromUtc(utcDateTime, TenantTimeZoneInfo);
        var offset = TenantTimeZoneInfo.GetUtcOffset(utcDateTime);
        return new DateTimeOffset(tenantTime, offset);
    }
}