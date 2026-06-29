#nullable enable annotations
using System.Globalization;
using System.Security.Claims;
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
    private DespatchContext? _context;
    private DespatchContext Context => _context ??= contextFactory.CreateDbContext();

    private string? _timeZoneOverride;
    private TimeZoneInfo? _cachedTimeZoneInfo;
    private CultureInfo? _cachedCultureInfo;

    private readonly Dictionary<string, Claim?> _claims = new();

    /// <summary>
    /// Reads a claim from the current user, memoizing the <see cref="Claim"/> object
    /// (not just its value) so callers can distinguish an absent claim from a
    /// present-but-empty one. Returns null when the claim — or the HTTP context — is
    /// absent.
    /// </summary>
    private Claim? Claim(string type)
    {
        if (_claims.TryGetValue(type, out var cached))
        {
            return cached;
        }

        var claim = contextAccessor.HttpContext?.User.Claims.FirstOrDefault(x => x.Type == type);
        _claims[type] = claim;
        return claim;
    }

    private string? ClaimValue(string type) => Claim(type)?.Value;

    /// <summary>
    /// Gets the tenant's timezone: the <c>TimeZone</c> claim when present, otherwise the
    /// request-supplied override (see <see cref="SetTenantTimeZoneOverride"/>). Returns
    /// null only when neither is available, so callers can apply their own UTC default.
    /// </summary>
    private string? GetTimeZone()
    {
        var claim = ClaimValue("TimeZone");
        return !string.IsNullOrWhiteSpace(claim) ? claim
            : !string.IsNullOrWhiteSpace(_timeZoneOverride) ? _timeZoneOverride
            : null;
    }

    /// <inheritdoc />
    public void SetTenantTimeZoneOverride(string? timeZone)
    {
        if (string.IsNullOrWhiteSpace(timeZone))
        {
            return;
        }

        _timeZoneOverride = timeZone;
        // GetTimeZone() re-evaluates against the override; clear the resolved info
        // that may have been populated (as UTC) before the override arrived.
        _cachedTimeZoneInfo = null;
    }

    /// <summary>
    /// Gets the tenant's country code from user claims.
    /// </summary>
    private string? GetCountryCode() => ClaimValue("CountryCode");

    /// <summary>
    /// Gets the TimeZoneInfo for the tenant's timezone, falling back to UTC when no
    /// timezone is resolvable so timezone-converting features degrade gracefully.
    /// </summary>
    private TimeZoneInfo GetTimeZoneInfo() => _cachedTimeZoneInfo ??= ResolveTimeZoneInfo(GetTimeZone());

    /// <summary>
    /// Resolves a timezone id to a <see cref="TimeZoneInfo"/> without throwing. Accepts
    /// both Windows ("New Zealand Standard Time") and IANA ("Pacific/Auckland") ids, and
    /// falls back to UTC for a missing/blank/unknown id rather than throwing — so a
    /// timezone that can't be resolved degrades gracefully instead of 500ing the request.
    /// </summary>
    private static TimeZoneInfo ResolveTimeZoneInfo(string? timeZone)
    {
        if (string.IsNullOrWhiteSpace(timeZone))
        {
            return TimeZoneInfo.Utc;
        }

        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(timeZone);
        }
        catch (TimeZoneNotFoundException)
        {
            // On Windows hosts IANA ids aren't recognised directly; convert then retry.
            return TimeZoneInfo.TryConvertIanaIdToWindowsId(timeZone, out var windowsId)
                ? TimeZoneInfo.FindSystemTimeZoneById(windowsId)
                : TimeZoneInfo.Utc;
        }
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
    public int GetStaffId() => int.Parse(ClaimValue("StaffID") ?? "0");

    /// <inheritdoc />
    public string? GetCurrentTenantId() => ClaimValue("CurrentTenantID");

    /// <summary>
    /// Gets the current contact's ID from user claims.
    /// </summary>
    /// <returns>The contact ID, or 0 if not found.</returns>
    public int GetContactId() => int.Parse(ClaimValue("ContactID") ?? "0");

    /// <inheritdoc />
    public int? GetClientTypeId() =>
        Claim("ClientTypeId") is { } claim && int.TryParse(claim.Value, out var value) ? value : null;

    /// <inheritdoc />
    public bool ClientTypeIdClaimAbsent => Claim("ClientTypeId") is null;

    /// <inheritdoc />
    public int? GetNpAgentId() =>
        Claim("NpAgentId") is { Value: { Length: > 0 } v } && int.TryParse(v, out var value) ? value : null;

    /// <inheritdoc />
    public bool NpAgentIdClaimAbsent => Claim("NpAgentId") is null;

    /// <inheritdoc />
    public bool NpAgentIdClaimEmpty => Claim("NpAgentId") is { } claim && string.IsNullOrEmpty(claim.Value);

    /// <inheritdoc />
    public int? GetClientId() => int.TryParse(ClaimValue("ClientID"), out var value) ? value : null;

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
    /// Returns null when no TucStaff row matches the current staff ID claim.
    /// </summary>
    public async Task<Suggestion?> GetStaffInfoAsync()
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