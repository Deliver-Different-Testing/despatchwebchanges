using DespatchWeb.Interfaces;
using DespatchWeb.Services;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

public class TenantClockTests
{
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();

    private TenantClock CreateClock() => new(_tenantInfoServiceMock);

    [Fact]
    public void TenantNow_ReturnsTenantTimeFromService()
    {
        _tenantInfoServiceMock.GetCurrentTenantTime().Returns(TestDates.Now);

        var clock = CreateClock();

        Assert.Equal(TestDates.Now, clock.TenantNow);
    }

    [Fact]
    public void TenantNow_PreservesTimeComponent()
    {
        _tenantInfoServiceMock.GetCurrentTenantTime().Returns(TestDates.Now);

        var clock = CreateClock();

        Assert.Equal(14, clock.TenantNow.Hour);
        Assert.Equal(30, clock.TenantNow.Minute);
        Assert.Equal(0, clock.TenantNow.Second);
    }

    [Fact]
    public void TenantNow_DelegatesToServiceOnEachAccess()
    {
        var first = new DateTime(2024, 6, 15, 10, 0, 0);
        var second = new DateTime(2024, 6, 15, 10, 0, 1);

        _tenantInfoServiceMock.GetCurrentTenantTime()
            .Returns(first, second);

        var clock = CreateClock();

        Assert.Equal(first, clock.TenantNow);
        Assert.Equal(second, clock.TenantNow);

        _tenantInfoServiceMock.Received(2).GetCurrentTenantTime();
    }

    [Fact]
    public void TenantToday_ReturnsDateWithoutTimeComponent()
    {
        _tenantInfoServiceMock.GetCurrentTenantTime().Returns(TestDates.Now);

        var clock = CreateClock();

        Assert.Equal(TestDates.Today, clock.TenantToday);
    }

    [Fact]
    public void TenantToday_HasZeroTimeComponent()
    {
        _tenantInfoServiceMock.GetCurrentTenantTime().Returns(TestDates.Now);

        var clock = CreateClock();

        Assert.Equal(TimeSpan.Zero, clock.TenantToday.TimeOfDay);
    }

    [Fact]
    public void TenantToday_MatchesDateOfTenantNow()
    {
        _tenantInfoServiceMock.GetCurrentTenantTime().Returns(TestDates.Now);

        var clock = CreateClock();

        Assert.Equal(clock.TenantNow.Date, clock.TenantToday);
    }

    [Fact]
    public void UtcNow_ReturnsValueCloseToCurrentUtcTime()
    {
        var clock = CreateClock();

        var before = DateTime.UtcNow;
        var result = clock.UtcNow;
        var after = DateTime.UtcNow;

        Assert.InRange(result, before, after);
    }

    [Fact]
    public void UtcNow_DoesNotCallTenantInfoService()
    {
        var clock = CreateClock();

        _ = clock.UtcNow;

        _tenantInfoServiceMock.DidNotReceive().GetCurrentTenantTime();
    }
}
