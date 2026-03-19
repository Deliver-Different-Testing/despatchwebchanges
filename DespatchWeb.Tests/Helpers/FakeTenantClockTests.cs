using DespatchWeb.Interfaces;

namespace DespatchWeb.Tests.Helpers;

public class FakeTenantClockTests
{
    [Fact]
    public void TenantNow_ReturnsFixedTime()
    {
        var clock = new FakeTenantClock(TestDates.Now);

        Assert.Equal(TestDates.Now, clock.TenantNow);
    }

    [Fact]
    public void TenantNow_ReturnsSameValueOnMultipleAccesses()
    {
        var clock = new FakeTenantClock(TestDates.Now);

        var first = clock.TenantNow;
        var second = clock.TenantNow;
        var third = clock.TenantNow;

        Assert.Equal(first, second);
        Assert.Equal(second, third);
    }

    [Fact]
    public void TenantNow_PreservesTimeComponent()
    {
        var clock = new FakeTenantClock(TestDates.Now);

        Assert.Equal(14, clock.TenantNow.Hour);
        Assert.Equal(30, clock.TenantNow.Minute);
        Assert.Equal(0, clock.TenantNow.Second);
    }

    [Fact]
    public void TenantToday_ReturnsDateOnly()
    {
        var clock = new FakeTenantClock(TestDates.Now);

        Assert.Equal(TestDates.Today, clock.TenantToday);
    }

    [Fact]
    public void TenantToday_HasZeroTimeComponent()
    {
        var clock = new FakeTenantClock(TestDates.Now);

        Assert.Equal(TimeSpan.Zero, clock.TenantToday.TimeOfDay);
    }

    [Theory]
    [InlineData(0, 0, 0)]
    [InlineData(12, 0, 0)]
    [InlineData(23, 59, 59)]
    public void TenantToday_SameDateRegardlessOfTimeOfDay(int hour, int minute, int second)
    {
        var fixedTime = new DateTime(2024, 6, 15, hour, minute, second);
        var clock = new FakeTenantClock(fixedTime);

        Assert.Equal(new DateTime(2024, 6, 15), clock.TenantToday);
    }

    [Fact]
    public void UtcNow_ReturnsFixedTimeConvertedToUtc()
    {
        var clock = new FakeTenantClock(TestDates.Now);

        Assert.Equal(TestDates.Now.ToUniversalTime(), clock.UtcNow);
    }

    [Fact]
    public void UtcNow_WithUtcKindInput_ReturnsSameValue()
    {
        var utcTime = new DateTime(2024, 6, 15, 2, 30, 0, DateTimeKind.Utc);
        var clock = new FakeTenantClock(utcTime);

        Assert.Equal(utcTime, clock.UtcNow);
    }

    [Fact]
    public void ImplementsITenantClock()
    {
        var clock = new FakeTenantClock(TestDates.Now);

        Assert.IsType<ITenantClock>(clock, exactMatch: false);
    }

    [Fact]
    public void TenantToday_EqualsDateOfTenantNow()
    {
        var clock = new FakeTenantClock(TestDates.Now);

        Assert.Equal(clock.TenantNow.Date, clock.TenantToday);
    }
}
