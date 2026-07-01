using System.Security.Claims;
using DespatchWeb.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Memory;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Diagnostic simulation of the delivery-journey "times show as UTC" report.
///
/// The delivery journey converts timestamps server-side via
/// TenantInfoService.ConvertUtcToTenantTimeZone, which resolves the tenant's
/// "TimeZone" claim with a bare TimeZoneInfo.FindSystemTimeZoneById(value ?? "UTC")
/// (no IANA/Windows conversion, no fallback handling).
///
/// These tests feed a fixed 03:00 UTC instant (the probe value used by the
/// temporary [TZDIAG] logging) through the REAL TenantInfoService for each of the
/// timezone-id formats a tenant claim might plausibly hold, and surface which
/// formats convert correctly versus which silently/loudly fail. The goal is to
/// reproduce the exact condition under which an NZ tenant ends up displayed as UTC.
/// </summary>
public sealed class TenantTimeZoneResolutionSimulationTests(ITestOutputHelper output) : IAsyncDisposable
{
    // 03:00 UTC on 2026-06-18 — matches the temporary [TZDIAG] probe in
    // DeliveryJourneyService so the test mirrors what production will log.
    private static readonly DateTime ProbeUtc = new(2026, 6, 18, 3, 0, 0, DateTimeKind.Utc);

    private readonly SqliteTestDatabase _db = new();
    private readonly IHttpContextAccessor _httpContextAccessorMock = Substitute.For<IHttpContextAccessor>();
    private readonly MemoryCache _memoryCache = new(new MemoryCacheOptions());

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        _memoryCache.Dispose();
        await _db.DisposeAsync();
    }

    private TenantInfoService CreateServiceWithTimeZoneClaim(string? timeZone)
    {
        var claims = timeZone is null ? [] : new List<Claim> { new("TimeZone", timeZone) };
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"));
        _httpContextAccessorMock.HttpContext.Returns(new DefaultHttpContext { User = principal });
        return new TenantInfoService(_httpContextAccessorMock, _db.CreateFactoryMock(), _memoryCache);
    }

    [Theory]
    [InlineData("New Zealand Standard Time")] // Windows id
    [InlineData("Pacific/Auckland")]          // IANA id
    [InlineData("Eastern Standard Time")]     // US Windows id (known-good per live data)
    [InlineData("America/New_York")]          // US IANA id
    [InlineData("UTC")]
    [InlineData("")]                          // present-but-empty claim
    [InlineData(null)]                        // no claim
    public void ConvertUtcToTenantTimeZone_AcrossClaimFormats_ReportsResolvedOffset(string? timeZoneClaim)
    {
        var service = CreateServiceWithTimeZoneClaim(timeZoneClaim);

        string outcome;
        try
        {
            var result = service.ConvertUtcToTenantTimeZone(ProbeUtc);
            outcome = $"OK  resolvedTz='{service.GetTenantTimeZone()}'  03:00Z -> {result:o}  (offset {result.Offset})";
        }
        catch (Exception ex)
        {
            outcome = $"THREW {ex.GetType().Name}: {ex.Message}";
        }

        output.WriteLine($"claim='{timeZoneClaim ?? "<null>"}'  =>  {outcome}");
    }

    [Fact]
    public void ConvertUtcToTenantTimeZone_NzWindowsId_ConvertsToNzLocal_NotUtc()
    {
        // Baseline: with a valid NZ Windows id the server MUST convert (not stamp).
        // 03:00 UTC in June (NZST, +12) is 15:00 the same day. If this ever returns
        // 03:00+00:00 the tenant tz silently fell back to UTC — the reported bug.
        var service = CreateServiceWithTimeZoneClaim("New Zealand Standard Time");

        var result = service.ConvertUtcToTenantTimeZone(ProbeUtc);

        Assert.Equal(TimeSpan.FromHours(12), result.Offset);
        Assert.Equal(15, result.Hour);
        Assert.NotEqual(TimeSpan.Zero, result.Offset);
    }
}
