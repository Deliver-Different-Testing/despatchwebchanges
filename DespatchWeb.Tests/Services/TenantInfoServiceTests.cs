using System.Security.Claims;
using DespatchWeb.EntityClasses;
using DespatchWeb.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using NSubstitute;
using TimeZone = DespatchWeb.EntityClasses.TimeZone;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Unit tests for TenantInfoService - tests timezone handling, culture formatting, and claim parsing.
/// </summary>
public class TenantInfoServiceTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly IHttpContextAccessor _httpContextAccessorMock = Substitute.For<IHttpContextAccessor>();
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly MemoryCache _memoryCache = new(new MemoryCacheOptions());

    public TenantInfoServiceTests() => _contextFactoryMock = _db.CreateFactoryMock();

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        _memoryCache.Dispose();
        await _db.DisposeAsync();
    }

    private TenantInfoService CreateService() => new(
        _httpContextAccessorMock,
        _contextFactoryMock,
        _memoryCache
    );

    private void SetupHttpContextWithClaims(params (string type, string value)[] claims)
    {
        var claimsList = claims.Select(c => new Claim(c.type, c.value)).ToList();
        var identity = new ClaimsIdentity(claimsList, "TestAuth");
        var principal = new ClaimsPrincipal(identity);
        var httpContext = new DefaultHttpContext { User = principal };
        _httpContextAccessorMock.HttpContext.Returns(httpContext);
    }

    [Fact]
    public void GetCurrentTenantTime_WithUtcTimeZone_ReturnsUtcTime()
    {
        // Arrange
        SetupHttpContextWithClaims(("TimeZone", "UTC"));
        var service = CreateService();

        // Act
        var result = service.GetCurrentTenantTime();

        // Assert
        Assert.True(Math.Abs((result - DateTime.UtcNow).TotalSeconds) < 1);
    }

    [Fact]
    public void GetCurrentTenantTime_WithNzTimeZone_ReturnsNzTime()
    {
        // Arrange
        SetupHttpContextWithClaims(("TimeZone", "New Zealand Standard Time"));
        var service = CreateService();

        // Act
        var result = service.GetCurrentTenantTime();

        // Assert
        var expected = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow,
            TimeZoneInfo.FindSystemTimeZoneById("New Zealand Standard Time"));
        Assert.True(Math.Abs((result - expected).TotalSeconds) < 1);
    }

    [Fact]
    public void GetCurrentTenantTime_WithNoTimeZoneClaim_DefaultsToUtc()
    {
        // Arrange
        SetupHttpContextWithClaims(); // No claims
        var service = CreateService();

        // Act
        var result = service.GetCurrentTenantTime();

        // Assert
        Assert.True(Math.Abs((result - DateTime.UtcNow).TotalSeconds) < 1);
    }

    [Fact]
    public void GetCurrentTimeFromTimeZone_WithSpecificTimeZone_ReturnsCorrectTime()
    {
        // Arrange
        SetupHttpContextWithClaims(("TimeZone", "UTC"));
        var service = CreateService();
        var timeZone = new TimeZone { Name = "Pacific Standard Time" };

        // Act
        var result = service.GetCurrentTimeFromTimeZone(timeZone);

        // Assert
        var expected = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow,
            TimeZoneInfo.FindSystemTimeZoneById("Pacific Standard Time"));
        Assert.True(Math.Abs((result - expected).TotalSeconds) < 1);
    }

    [Fact]
    public void FormatDateForTenant_WithNullDate_ReturnsEmptyString()
    {
        // Arrange
        SetupHttpContextWithClaims(("CountryCode", "US"));
        var service = CreateService();

        // Act
        var result = service.FormatDateForTenant(null);

        // Assert
        Assert.Empty(result);
    }

    [Fact]
    public void FormatDateForTenant_WithUsCountry_UsesUsCulture()
    {
        // Arrange
        SetupHttpContextWithClaims(("CountryCode", "US"));
        var service = CreateService();
        var date = new DateTime(2024, 12, 25, 14, 30, 0);

        // Act
        var result = service.FormatDateForTenant(date);

        // Assert
        Assert.Contains("12/25/2024", result); // US format MM/dd/yyyy
    }

    [Fact]
    public void FormatDateForTenant_WithNzCountry_UsesNzCulture()
    {
        // Arrange
        SetupHttpContextWithClaims(("CountryCode", "NZ"));
        var service = CreateService();
        var date = new DateTime(2024, 12, 25, 14, 30, 0);

        // Act
        var result = service.FormatDateForTenant(date);

        // Assert
        Assert.Contains("25/12/2024", result); // NZ format dd/MM/yyyy
    }

    [Fact]
    public void FormatDateForTenant_WithGbCountry_UsesGbCulture()
    {
        // Arrange
        SetupHttpContextWithClaims(("CountryCode", "GB"));
        var service = CreateService();
        var date = new DateTime(2024, 12, 25, 14, 30, 0);

        // Act
        var result = service.FormatDateForTenant(date);

        // Assert
        Assert.Contains("25/12/2024", result); // GB format dd/MM/yyyy
    }

    [Fact]
    public void FormatDateForTenant_WithUnknownCountry_DefaultsToUsCulture()
    {
        // Arrange
        SetupHttpContextWithClaims(("CountryCode", "XX"));
        var service = CreateService();
        var date = new DateTime(2024, 12, 25, 14, 30, 0);

        // Act
        var result = service.FormatDateForTenant(date);

        // Assert
        Assert.Contains("12/25/2024", result); // Defaults to US format
    }

    [Fact]
    public void GetStaffId_WithValidClaim_ReturnsStaffId()
    {
        // Arrange
        SetupHttpContextWithClaims(("StaffID", "42"));
        var service = CreateService();

        // Act
        var result = service.GetStaffId();

        // Assert
        Assert.Equal(42, result);
    }

    [Fact]
    public void GetStaffId_WithNoClaim_ReturnsZero()
    {
        // Arrange
        SetupHttpContextWithClaims(); // No claims
        var service = CreateService();

        // Act
        var result = service.GetStaffId();

        // Assert
        Assert.Equal(0, result);
    }

    [Fact]
    public void GetStaffId_CalledMultipleTimes_ReturnsCachedValue()
    {
        // Arrange
        SetupHttpContextWithClaims(("StaffID", "42"));
        var service = CreateService();

        // Act
        var result1 = service.GetStaffId();
        var result2 = service.GetStaffId();

        // Assert
        Assert.Equal(42, result1);
        Assert.Equal(42, result2);
    }

    [Fact]
    public void GetContactId_WithValidClaim_ReturnsContactId()
    {
        // Arrange
        SetupHttpContextWithClaims(("ContactID", "123"));
        var service = CreateService();

        // Act
        var result = service.GetContactId();

        // Assert
        Assert.Equal(123, result);
    }

    [Fact]
    public void GetContactId_WithNoClaim_ReturnsZero()
    {
        // Arrange
        SetupHttpContextWithClaims(); // No claims
        var service = CreateService();

        // Act
        var result = service.GetContactId();

        // Assert
        Assert.Equal(0, result);
    }

    [Fact]
    public void IsUsTenant_WithUsCountryCode_ReturnsTrue()
    {
        // Arrange
        SetupHttpContextWithClaims(("CountryCode", "US"));
        var service = CreateService();

        // Act
        var result = service.IsUsTenant();

        // Assert
        Assert.True(result);
    }

    [Fact]
    public void IsUsTenant_WithLowercaseUsCountryCode_ReturnsTrue()
    {
        // Arrange
        SetupHttpContextWithClaims(("CountryCode", "us"));
        var service = CreateService();

        // Act
        var result = service.IsUsTenant();

        // Assert
        Assert.True(result);
    }

    [Fact]
    public void IsUsTenant_WithNzCountryCode_ReturnsFalse()
    {
        // Arrange
        SetupHttpContextWithClaims(("CountryCode", "NZ"));
        var service = CreateService();

        // Act
        var result = service.IsUsTenant();

        // Assert
        Assert.False(result);
    }

    [Fact]
    public void IsUsTenant_WithNoCountryCode_ReturnsFalse()
    {
        // Arrange
        SetupHttpContextWithClaims(); // No claims
        var service = CreateService();

        // Act
        var result = service.IsUsTenant();

        // Assert
        Assert.False(result);
    }

    [Fact]
    public void GetTenantTimeZone_WithTimeZoneClaim_ReturnsTimeZone()
    {
        // Arrange
        SetupHttpContextWithClaims(("TimeZone", "Pacific Standard Time"));
        var service = CreateService();

        // Act
        var result = service.GetTenantTimeZone();

        // Assert
        Assert.Equal("Pacific Standard Time", result);
    }

    [Fact]
    public void GetTenantTimeZone_WithNoTimeZoneClaim_ReturnsUtc()
    {
        // Arrange
        SetupHttpContextWithClaims(); // No claims
        var service = CreateService();

        // Act
        var result = service.GetTenantTimeZone();

        // Assert
        Assert.Equal("UTC", result);
    }

    [Fact]
    public void ConvertUtcToTenantTimeZone_WithUtcTimeZone_ReturnsCorrectOffset()
    {
        // Arrange
        SetupHttpContextWithClaims(("TimeZone", "UTC"));
        var service = CreateService();
        var utcTime = new DateTime(2024, 6, 15, 12, 0, 0, DateTimeKind.Utc);

        // Act
        var result = service.ConvertUtcToTenantTimeZone(utcTime);

        // Assert
        Assert.Equal(TimeSpan.Zero, result.Offset);
        Assert.Equal(utcTime, result.DateTime);
    }

    [Fact]
    public void ConvertUtcToTenantTimeZone_WithNzTimeZone_ReturnsCorrectOffset()
    {
        // Arrange
        SetupHttpContextWithClaims(("TimeZone", "New Zealand Standard Time"));
        var service = CreateService();
        var utcTime = new DateTime(2024, 6, 15, 12, 0, 0, DateTimeKind.Utc);

        // Act
        var result = service.ConvertUtcToTenantTimeZone(utcTime);

        // Assert - NZ is UTC+12 in winter (June)
        Assert.Equal(TimeSpan.FromHours(12), result.Offset);
    }

    [Fact]
    public async Task GetStaffInfoAsync_WithValidStaffId_ReturnsStaffInfo()
    {
        // Arrange
        SetupHttpContextWithClaims(("StaffID", "1"));

        await using var context = _db.CreateContext();
        context.TucStaffs.Add(new TucStaff
        {
            UcstId = 1, UcstFirstName = "John", UcstLastName = "Doe",
            CreatedBy = "test", LastModifiedBy = "test"
        });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var service = CreateService();

        // Act
        var result = await service.GetStaffInfoAsync();

        // Assert
        Assert.NotNull(result);
        Assert.Equal(1, result.Id);
        Assert.Equal("John Doe", result.Text);
    }

    [Fact]
    public async Task GetStaffInfoAsync_WithInvalidStaffId_ReturnsNull()
    {
        // Arrange
        SetupHttpContextWithClaims(("StaffID", "999"));

        await using var context = _db.CreateContext();
        context.TucStaffs.Add(new TucStaff
        {
            UcstId = 1, UcstFirstName = "John", UcstLastName = "Doe",
            CreatedBy = "test", LastModifiedBy = "test"
        });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var service = CreateService();

        // Act
        var result = await service.GetStaffInfoAsync();

        // Assert
        Assert.Null(result);
    }

    [Theory]
    [InlineData("1", 1)]   // Internal
    [InlineData("3", 3)]   // NetworkPartner
    [InlineData("5", 5)]   // DFRNTAdmin
    public void GetClientTypeId_WithValidClaim_ReturnsValue(string claimValue, int expected)
    {
        SetupHttpContextWithClaims(("ClientTypeId", claimValue));
        var service = CreateService();

        Assert.Equal(expected, service.GetClientTypeId());
    }

    [Fact]
    public void GetClientTypeId_WithNoClaim_ReturnsNull()
    {
        // Couriers and pre-claim sessions don't carry ClientTypeId — caller
        // gets null instead of a misleading zero.
        SetupHttpContextWithClaims();
        var service = CreateService();

        Assert.Null(service.GetClientTypeId());
    }

    [Fact]
    public void GetClientTypeId_WithEmptyClaim_ReturnsNull()
    {
        // Hub stamps an empty string when the underlying tucClient row had a null
        // ClientTypeId, so the claim is present-but-empty rather than absent.
        SetupHttpContextWithClaims(("ClientTypeId", string.Empty));
        var service = CreateService();

        Assert.Null(service.GetClientTypeId());
    }

    [Fact]
    public void GetClientTypeId_CalledMultipleTimes_ReturnsCachedValue()
    {
        SetupHttpContextWithClaims(("ClientTypeId", "3"));
        var service = CreateService();

        Assert.Equal(3, service.GetClientTypeId());
        Assert.Equal(3, service.GetClientTypeId());
    }

    [Fact]
    public void GetNpAgentId_WithValidClaim_ReturnsValue()
    {
        SetupHttpContextWithClaims(("NpAgentId", "77"));
        var service = CreateService();

        Assert.Equal(77, service.GetNpAgentId());
    }

    [Fact]
    public void GetNpAgentId_WithNoClaim_ReturnsNull()
    {
        SetupHttpContextWithClaims();
        var service = CreateService();

        Assert.Null(service.GetNpAgentId());
    }

    [Fact]
    public void GetNpAgentId_WithEmptyClaim_ReturnsNull()
    {
        SetupHttpContextWithClaims(("NpAgentId", string.Empty));
        var service = CreateService();

        Assert.Null(service.GetNpAgentId());
    }

    [Fact]
    public void GetNpAgentId_CalledMultipleTimes_ReturnsCachedValue()
    {
        SetupHttpContextWithClaims(("NpAgentId", "77"));
        var service = CreateService();

        Assert.Equal(77, service.GetNpAgentId());
        Assert.Equal(77, service.GetNpAgentId());
    }

    [Fact]
    public void ClientTypeIdClaimAbsent_ClaimMissing_ReturnsTrue()
    {
        SetupHttpContextWithClaims();
        var service = CreateService();

        Assert.True(service.ClientTypeIdClaimAbsent);
    }

    [Fact]
    public void ClientTypeIdClaimAbsent_ClaimPresentButEmpty_ReturnsFalse()
    {
        // Spec §3.3: empty-string ≠ absent. The claim being present, even as "",
        // signals Hub-authoritative data — no DB fallback.
        SetupHttpContextWithClaims(("ClientTypeId", string.Empty));
        var service = CreateService();

        Assert.False(service.ClientTypeIdClaimAbsent);
    }

    [Fact]
    public void ClientTypeIdClaimAbsent_ClaimPresent_ReturnsFalse()
    {
        SetupHttpContextWithClaims(("ClientTypeId", "3"));
        var service = CreateService();

        Assert.False(service.ClientTypeIdClaimAbsent);
    }

    [Fact]
    public void NpAgentIdClaimAbsent_ClaimMissing_ReturnsTrueAndEmptyFalse()
    {
        SetupHttpContextWithClaims();
        var service = CreateService();

        Assert.True(service.NpAgentIdClaimAbsent);
        Assert.False(service.NpAgentIdClaimEmpty);
    }

    [Fact]
    public void NpAgentIdClaimEmpty_ClaimPresentButEmpty_ReturnsTrueAndAbsentFalse()
    {
        SetupHttpContextWithClaims(("NpAgentId", string.Empty));
        var service = CreateService();

        Assert.False(service.NpAgentIdClaimAbsent);
        Assert.True(service.NpAgentIdClaimEmpty);
    }

    [Fact]
    public void NpAgentIdClaim_ParseableValue_BothFlagsFalse()
    {
        SetupHttpContextWithClaims(("NpAgentId", "42"));
        var service = CreateService();

        Assert.False(service.NpAgentIdClaimAbsent);
        Assert.False(service.NpAgentIdClaimEmpty);
        Assert.Equal(42, service.GetNpAgentId());
    }

    [Fact]
    public void GetClientId_WithValidClaim_ReturnsValue()
    {
        SetupHttpContextWithClaims(("ClientID", "123"));
        var service = CreateService();

        Assert.Equal(123, service.GetClientId());
    }

    [Fact]
    public void GetClientId_WithNoClaim_ReturnsNull()
    {
        SetupHttpContextWithClaims();
        var service = CreateService();

        Assert.Null(service.GetClientId());
    }

    [Fact]
    public void GetClientId_WithEmptyClaim_ReturnsNull()
    {
        SetupHttpContextWithClaims(("ClientID", string.Empty));
        var service = CreateService();

        Assert.Null(service.GetClientId());
    }
}