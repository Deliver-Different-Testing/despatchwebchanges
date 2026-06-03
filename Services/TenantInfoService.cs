using System.Globalization;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using TimeZone = DespatchWeb.EntityClasses.TimeZone;

namespace DespatchWeb.Services;

/// <summary>
/// Service for retrieving tenant-specific information including timezone, culture, and staff details from the current HTTP context.
/// </summary>
public sealed class TenantInfoService(
    IHttpContextAccessor contextAccessor,
    IDbContextFactory<DespatchContext> contextFactory,
    IMemoryCache cache) : ITenantInfoService
{
    private DespatchContext _context;
    private DespatchContext Context => _context ??= contextFactory.CreateDbContext();

    private string _cachedTimeZone;
    private string _cachedCountryCode;
    private int? _cachedStaffId;
    private int? _cachedContactId;
    private bool _clientTypeIdRead;
    private int? _cachedClientTypeId;
    private bool _clientTypeIdClaimAbsent;
    private bool _npAgentIdRead;
    private int? _cachedNpAgentId;
    private bool _npAgentIdClaimAbsent;
    private bool _npAgentIdClaimEmpty;
    private bool _clientIdRead;
    private int? _cachedClientId;
    private TimeZoneInfo _cachedTimeZoneInfo;
    private CultureInfo _cachedCultureInfo;

    /// <summary>
    /// Gets the tenant's timezone from user claims.
    /// </summary>
    private string GetTimeZone() => _cachedTimeZone ??= contextAccessor.HttpContext?.User.Claims
        .FirstOrDefault(x => x.Type == "TimeZone")?.Value;

    /// <summary>
    /// Gets the tenant's country code from user claims.
    /// </summary>
    private string GetCountryCode() => _cachedCountryCode ??= contextAccessor.HttpContext?.User.Claims
        .FirstOrDefault(x => x.Type == "CountryCode")?.Value;

    /// <summary>
    /// Gets the TimeZoneInfo for the tenant's timezone.
    /// </summary>
    private TimeZoneInfo GetTimeZoneInfo()
    {
        if (_cachedTimeZoneInfo != null)
        {
            return _cachedTimeZoneInfo;
        }

        var timeZone = GetTimeZone();
        _cachedTimeZoneInfo = TimeZoneInfo.FindSystemTimeZoneById(timeZone ?? "UTC");
        return _cachedTimeZoneInfo;
    }

    /// <summary>
    /// Gets the CultureInfo for the tenant's country (US, GB, AU, NZ).
    /// </summary>
    private CultureInfo GetCultureInfo()
    {
        if (_cachedCultureInfo != null)
        {
            return _cachedCultureInfo;
        }

        var countryCode = GetCountryCode();
        var cultureCode = countryCode switch
        {
            "US" => "en-US",
            "GB" => "en-GB",
            "AU" => "en-AU",
            "NZ" => "en-NZ",
            _ => "en-US"
        };
        _cachedCultureInfo = new CultureInfo(cultureCode, false);
        return _cachedCultureInfo;
    }

    /// <summary>
    /// Gets the current date/time converted to the tenant's timezone.
    /// </summary>
    /// <returns>The current time in the tenant's timezone.</returns>
    public DateTime GetCurrentTenantTime()
    {
        var tenantTimeZoneInfo = GetTimeZoneInfo();
        return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tenantTimeZoneInfo);
    }

    /// <summary>
    /// Gets the current time in a specific timezone, falling back to tenant timezone if null.
    /// </summary>
    /// <param name="timeZone">The timezone to convert to, or null to use tenant timezone.</param>
    /// <returns>The current time in the specified timezone.</returns>
    public DateTime GetCurrentTimeFromTimeZone(TimeZone timeZone)
    {
        var cacheKey = $"timezone_info_{timeZone.Name}";
        var timeZoneInfo = cache.GetOrCreate(cacheKey, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromDays(1);
            return TimeZoneInfo.FindSystemTimeZoneById(timeZone.Name);
        });

        return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, timeZoneInfo);
    }

    /// <summary>
    /// Formats a date/time using the tenant's culture-specific format.
    /// </summary>
    /// <param name="dateTime">The date/time to format.</param>
    /// <returns>A culture-specific formatted date string, or empty if null.</returns>
    public string FormatDateForTenant(DateTime? dateTime)
    {
        if (!dateTime.HasValue)
        {
            return string.Empty;
        }

        var culture = GetCultureInfo();
        return dateTime.Value.ToString("g", culture);
    }


    /// <summary>
    /// Gets the current staff member's ID from user claims.
    /// </summary>
    /// <returns>The staff ID, or 0 if not found.</returns>
    public int GetStaffId()
    {
        if (_cachedStaffId.HasValue)
        {
            return _cachedStaffId.Value;
        }

        var staffIdString = contextAccessor.HttpContext?.User.Claims
            .FirstOrDefault(x => x.Type == "StaffID")?.Value;
        _cachedStaffId = int.Parse(staffIdString ?? "0");
        return _cachedStaffId.Value;
    }

    /// <inheritdoc />
    public string GetCurrentTenantId() =>
        contextAccessor.HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "CurrentTenantID")?.Value;

    /// <summary>
    /// Gets the current contact's ID from user claims.
    /// </summary>
    /// <returns>The contact ID, or 0 if not found.</returns>
    public int GetContactId()
    {
        if (_cachedContactId.HasValue)
        {
            return _cachedContactId.Value;
        }

        var contactId = contextAccessor.HttpContext?.User.Claims
            .FirstOrDefault(x => x.Type == "ContactID")?.Value;
        _cachedContactId = int.Parse(contactId ?? "0");
        return _cachedContactId.Value;
    }

    /// <inheritdoc />
    public int? GetClientTypeId()
    {
        if (_clientTypeIdRead) return _cachedClientTypeId;
        ReadClientTypeIdClaim();
        return _cachedClientTypeId;
    }

    /// <inheritdoc />
    public bool ClientTypeIdClaimAbsent
    {
        get
        {
            if (!_clientTypeIdRead) ReadClientTypeIdClaim();
            return _clientTypeIdClaimAbsent;
        }
    }

    private void ReadClientTypeIdClaim()
    {
        _clientTypeIdRead = true;
        var claim = contextAccessor.HttpContext?.User.Claims
            .FirstOrDefault(x => x.Type == "ClientTypeId");
        if (claim is null)
        {
            _clientTypeIdClaimAbsent = true;
            _cachedClientTypeId = null;
            return;
        }
        _cachedClientTypeId = int.TryParse(claim.Value, out var value) ? value : null;
    }

    /// <inheritdoc />
    public int? GetNpAgentId()
    {
        if (_npAgentIdRead) return _cachedNpAgentId;
        ReadNpAgentIdClaim();
        return _cachedNpAgentId;
    }

    /// <inheritdoc />
    public bool NpAgentIdClaimAbsent
    {
        get
        {
            if (!_npAgentIdRead) ReadNpAgentIdClaim();
            return _npAgentIdClaimAbsent;
        }
    }

    /// <inheritdoc />
    public bool NpAgentIdClaimEmpty
    {
        get
        {
            if (!_npAgentIdRead) ReadNpAgentIdClaim();
            return _npAgentIdClaimEmpty;
        }
    }

    private void ReadNpAgentIdClaim()
    {
        _npAgentIdRead = true;
        var claim = contextAccessor.HttpContext?.User.Claims
            .FirstOrDefault(x => x.Type == "NpAgentId");
        if (claim is null)
        {
            _npAgentIdClaimAbsent = true;
            _cachedNpAgentId = null;
            return;
        }
        if (string.IsNullOrEmpty(claim.Value))
        {
            _npAgentIdClaimEmpty = true;
            _cachedNpAgentId = null;
            return;
        }
        _cachedNpAgentId = int.TryParse(claim.Value, out var value) ? value : null;
    }

    /// <inheritdoc />
    public int? GetClientId()
    {
        if (_clientIdRead) return _cachedClientId;
        _clientIdRead = true;
        var raw = contextAccessor.HttpContext?.User.Claims
            .FirstOrDefault(x => x.Type == "ClientID")?.Value;
        _cachedClientId = int.TryParse(raw, out var value) ? value : null;
        return _cachedClientId;
    }

    /// <summary>
    /// Determines if the current tenant is a US-based tenant.
    /// </summary>
    /// <returns>True if the tenant's country code is "US".</returns>
    public bool IsUsTenant()
    {
        var countryCode = GetCountryCode();
        var usa = Country.Us.GetDescription();
        return countryCode?.ToUpper().Equals(usa) ?? false;
    }

    /// <summary>
    /// Gets the current staff member's information (ID and full name) with 8-hour caching.
    /// </summary>
    /// <returns>A Suggestion object with staff ID and name.</returns>
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
                .FirstOrDefaultAsync();

            return staff;
        });
    }

    /// <summary>
    /// Gets the tenant's timezone ID string, defaulting to UTC if not set.
    /// </summary>
    public string GetTenantTimeZone() => GetTimeZone() ?? "UTC";

    /// <summary>
    /// Converts a UTC DateTime to a DateTimeOffset in the tenant's timezone.
    /// </summary>
    /// <param name="utcDateTime">The UTC date/time to convert.</param>
    /// <returns>A DateTimeOffset with the tenant's timezone offset applied.</returns>
    public DateTimeOffset ConvertUtcToTenantTimeZone(DateTime utcDateTime)
    {
        var tenantTimeZoneInfo = GetTimeZoneInfo();
        var tenantTime = TimeZoneInfo.ConvertTimeFromUtc(utcDateTime, tenantTimeZoneInfo);
        var offset = tenantTimeZoneInfo.GetUtcOffset(utcDateTime);
        return new DateTimeOffset(tenantTime, offset);
    }

    public void Dispose() => _context?.Dispose();
}