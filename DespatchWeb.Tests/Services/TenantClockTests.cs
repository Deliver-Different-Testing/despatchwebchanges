using DespatchWeb.Interfaces;
using DespatchWeb.Services;
using FluentAssertions;
using Moq;

namespace DespatchWeb.Tests.Services;

public class TenantClockTests
{
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();

    private TenantClock CreateClock() => new(_tenantInfoServiceMock.Object);

    [Fact]
    public void TenantNow_ReturnsTenantTimeFromService()
    {
        _tenantInfoServiceMock.Setup(s => s.GetCurrentTenantTime()).Returns(TestDates.Now);

        var clock = CreateClock();

        clock.TenantNow.Should().Be(TestDates.Now);
    }

    [Fact]
    public void TenantNow_PreservesTimeComponent()
    {
        _tenantInfoServiceMock.Setup(s => s.GetCurrentTenantTime()).Returns(TestDates.Now);

        var clock = CreateClock();

        clock.TenantNow.Hour.Should().Be(14);
        clock.TenantNow.Minute.Should().Be(30);
        clock.TenantNow.Second.Should().Be(0);
    }

    [Fact]
    public void TenantNow_DelegatesToServiceOnEachAccess()
    {
        var first = new DateTime(2024, 6, 15, 10, 0, 0);
        var second = new DateTime(2024, 6, 15, 10, 0, 1);

        _tenantInfoServiceMock.SetupSequence(s => s.GetCurrentTenantTime())
            .Returns(first)
            .Returns(second);

        var clock = CreateClock();

        clock.TenantNow.Should().Be(first);
        clock.TenantNow.Should().Be(second);

        _tenantInfoServiceMock.Verify(s => s.GetCurrentTenantTime(), Times.Exactly(2));
    }

    [Fact]
    public void TenantToday_ReturnsDateWithoutTimeComponent()
    {
        _tenantInfoServiceMock.Setup(s => s.GetCurrentTenantTime()).Returns(TestDates.Now);

        var clock = CreateClock();

        clock.TenantToday.Should().Be(TestDates.Today);
    }

    [Fact]
    public void TenantToday_HasZeroTimeComponent()
    {
        _tenantInfoServiceMock.Setup(s => s.GetCurrentTenantTime()).Returns(TestDates.Now);

        var clock = CreateClock();

        clock.TenantToday.TimeOfDay.Should().Be(TimeSpan.Zero);
    }

    [Fact]
    public void TenantToday_MatchesDateOfTenantNow()
    {
        _tenantInfoServiceMock.Setup(s => s.GetCurrentTenantTime()).Returns(TestDates.Now);

        var clock = CreateClock();

        clock.TenantToday.Should().Be(clock.TenantNow.Date);
    }

    [Fact]
    public void UtcNow_ReturnsValueCloseToCurrentUtcTime()
    {
        var clock = CreateClock();

        var before = DateTime.UtcNow;
        var result = clock.UtcNow;
        var after = DateTime.UtcNow;

        result.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);
    }

    [Fact]
    public void UtcNow_DoesNotCallTenantInfoService()
    {
        var clock = CreateClock();

        _ = clock.UtcNow;

        _tenantInfoServiceMock.Verify(s => s.GetCurrentTenantTime(), Times.Never);
    }
}
