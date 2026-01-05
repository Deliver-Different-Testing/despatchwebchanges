using System.Security.Claims;
using DespatchWeb.EntityClasses;
using DespatchWeb.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using MockQueryable.Moq;
using Moq;
using TimeZone = DespatchWeb.EntityClasses.TimeZone;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Unit tests for TenantInfoService - tests timezone handling, culture formatting, and claim parsing.
/// </summary>
public class TenantInfoServiceTests
{
    private readonly Mock<IHttpContextAccessor> _httpContextAccessorMock = new();
    private readonly Mock<IDbContextFactory<DespatchContext>> _contextFactoryMock = new();
    private readonly IMemoryCache _memoryCache = new MemoryCache(new MemoryCacheOptions());

    private TenantInfoService CreateService() => new(
        _httpContextAccessorMock.Object,
        _contextFactoryMock.Object,
        _memoryCache
    );

    private void SetupHttpContextWithClaims(params (string type, string value)[] claims)
    {
        var claimsList = claims.Select(c => new Claim(c.type, c.value)).ToList();
        var identity = new ClaimsIdentity(claimsList, "TestAuth");
        var principal = new ClaimsPrincipal(identity);
        var httpContext = new DefaultHttpContext { User = principal };
        _httpContextAccessorMock.Setup(x => x.HttpContext).Returns(httpContext);
    }

    #region GetCurrentTenantTime Tests

    [Fact]
    public void GetCurrentTenantTime_WithUtcTimeZone_ReturnsUtcTime()
    {
        // Arrange
        SetupHttpContextWithClaims(("TimeZone", "UTC"));
        var service = CreateService();

        // Act
        var result = service.GetCurrentTenantTime();

        // Assert
        result.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
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
        result.Should().BeCloseTo(expected, TimeSpan.FromSeconds(1));
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
        result.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
    }

    #endregion

    #region GetCurrentTimeFromTimeZone Tests

    [Fact]
    public void GetCurrentTimeFromTimeZone_WithNullTimeZone_ReturnsTenantTime()
    {
        // Arrange
        SetupHttpContextWithClaims(("TimeZone", "UTC"));
        var service = CreateService();

        // Act
        var result = service.GetCurrentTimeFromTimeZone(null);

        // Assert
        result.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
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
        result.Should().BeCloseTo(expected, TimeSpan.FromSeconds(1));
    }

    #endregion

    #region FormatDateForTenant Tests

    [Fact]
    public void FormatDateForTenant_WithNullDate_ReturnsEmptyString()
    {
        // Arrange
        SetupHttpContextWithClaims(("CountryCode", "US"));
        var service = CreateService();

        // Act
        var result = service.FormatDateForTenant(null);

        // Assert
        result.Should().BeEmpty();
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
        result.Should().Contain("12/25/2024"); // US format MM/dd/yyyy
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
        result.Should().Contain("25/12/2024"); // NZ format dd/MM/yyyy
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
        result.Should().Contain("25/12/2024"); // GB format dd/MM/yyyy
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
        result.Should().Contain("12/25/2024"); // Defaults to US format
    }

    #endregion

    #region GetStaffId Tests

    [Fact]
    public void GetStaffId_WithValidClaim_ReturnsStaffId()
    {
        // Arrange
        SetupHttpContextWithClaims(("StaffID", "42"));
        var service = CreateService();

        // Act
        var result = service.GetStaffId();

        // Assert
        result.Should().Be(42);
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
        result.Should().Be(0);
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
        result1.Should().Be(42);
        result2.Should().Be(42);
    }

    #endregion

    #region GetContactId Tests

    [Fact]
    public void GetContactId_WithValidClaim_ReturnsContactId()
    {
        // Arrange
        SetupHttpContextWithClaims(("ContactID", "123"));
        var service = CreateService();

        // Act
        var result = service.GetContactId();

        // Assert
        result.Should().Be(123);
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
        result.Should().Be(0);
    }

    #endregion

    #region IsUsTenant Tests

    [Fact]
    public void IsUsTenant_WithUsCountryCode_ReturnsTrue()
    {
        // Arrange
        SetupHttpContextWithClaims(("CountryCode", "US"));
        var service = CreateService();

        // Act
        var result = service.IsUsTenant();

        // Assert
        result.Should().BeTrue();
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
        result.Should().BeTrue();
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
        result.Should().BeFalse();
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
        result.Should().BeFalse();
    }

    #endregion

    #region GetTenantTimeZone Tests

    [Fact]
    public void GetTenantTimeZone_WithTimeZoneClaim_ReturnsTimeZone()
    {
        // Arrange
        SetupHttpContextWithClaims(("TimeZone", "Pacific Standard Time"));
        var service = CreateService();

        // Act
        var result = service.GetTenantTimeZone();

        // Assert
        result.Should().Be("Pacific Standard Time");
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
        result.Should().Be("UTC");
    }

    #endregion

    #region ConvertUtcToTenantTimeZone Tests

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
        result.Offset.Should().Be(TimeSpan.Zero);
        result.DateTime.Should().Be(utcTime);
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
        result.Offset.Should().Be(TimeSpan.FromHours(12));
    }

    #endregion

    #region GetStaffInfoAsync Tests

    [Fact]
    public async Task GetStaffInfoAsync_WithValidStaffId_ReturnsStaffInfo()
    {
        // Arrange
        SetupHttpContextWithClaims(("StaffID", "1"));

        var staffList = new List<TucStaff>
        {
            new() { UcstId = 1, UcstFirstName = "John", UcstLastName = "Doe" }
        };

        var mockDbSet = staffList.BuildMockDbSet();
        var mockContext = new Mock<DespatchContext>(new DbContextOptions<DespatchContext>());
        mockContext.Setup(c => c.TucStaffs).Returns(mockDbSet.Object);
        _contextFactoryMock.Setup(f => f.CreateDbContext()).Returns(mockContext.Object);

        var service = CreateService();

        // Act
        var result = await service.GetStaffInfoAsync();

        // Assert
        result.Should().NotBeNull();
        result.Id.Should().Be(1);
        result.Text.Should().Be("John Doe");
    }

    [Fact]
    public async Task GetStaffInfoAsync_WithInvalidStaffId_ReturnsNull()
    {
        // Arrange
        SetupHttpContextWithClaims(("StaffID", "999"));

        var staffList = new List<TucStaff>
        {
            new() { UcstId = 1, UcstFirstName = "John", UcstLastName = "Doe" }
        };

        var mockDbSet = staffList.BuildMockDbSet();
        var mockContext = new Mock<DespatchContext>(new DbContextOptions<DespatchContext>());
        mockContext.Setup(c => c.TucStaffs).Returns(mockDbSet.Object);
        _contextFactoryMock.Setup(f => f.CreateDbContext()).Returns(mockContext.Object);

        var service = CreateService();

        // Act
        var result = await service.GetStaffInfoAsync();

        // Assert
        result.Should().BeNull();
    }

    #endregion
}
