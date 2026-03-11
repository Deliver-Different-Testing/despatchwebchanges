using DespatchWeb.Interfaces;
using FluentAssertions;

namespace DespatchWeb.Tests.Helpers;

public class FakeTenantClockTests
{
    [Fact]
    public void TenantNow_ReturnsFixedTime()
    {
        var clock = new FakeTenantClock(TestDates.Now);

        clock.TenantNow.Should().Be(TestDates.Now);
    }

    [Fact]
    public void TenantNow_ReturnsSameValueOnMultipleAccesses()
    {
        var clock = new FakeTenantClock(TestDates.Now);

        var first = clock.TenantNow;
        var second = clock.TenantNow;
        var third = clock.TenantNow;

        first.Should().Be(second);
        second.Should().Be(third);
    }

    [Fact]
    public void TenantNow_PreservesTimeComponent()
    {
        var clock = new FakeTenantClock(TestDates.Now);

        clock.TenantNow.Hour.Should().Be(14);
        clock.TenantNow.Minute.Should().Be(30);
        clock.TenantNow.Second.Should().Be(0);
    }

    [Fact]
    public void TenantToday_ReturnsDateOnly()
    {
        var clock = new FakeTenantClock(TestDates.Now);

        clock.TenantToday.Should().Be(TestDates.Today);
    }

    [Fact]
    public void TenantToday_HasZeroTimeComponent()
    {
        var clock = new FakeTenantClock(TestDates.Now);

        clock.TenantToday.TimeOfDay.Should().Be(TimeSpan.Zero);
    }

    [Theory]
    [InlineData(0, 0, 0)]
    [InlineData(12, 0, 0)]
    [InlineData(23, 59, 59)]
    public void TenantToday_SameDateRegardlessOfTimeOfDay(int hour, int minute, int second)
    {
        var fixedTime = new DateTime(2024, 6, 15, hour, minute, second);
        var clock = new FakeTenantClock(fixedTime);

        clock.TenantToday.Should().Be(new DateTime(2024, 6, 15));
    }

    [Fact]
    public void UtcNow_ReturnsFixedTimeConvertedToUtc()
    {
        var clock = new FakeTenantClock(TestDates.Now);

        clock.UtcNow.Should().Be(TestDates.Now.ToUniversalTime());
    }

    [Fact]
    public void UtcNow_WithUtcKindInput_ReturnsSameValue()
    {
        var utcTime = new DateTime(2024, 6, 15, 2, 30, 0, DateTimeKind.Utc);
        var clock = new FakeTenantClock(utcTime);

        clock.UtcNow.Should().Be(utcTime);
    }

    [Fact]
    public void ImplementsITenantClock()
    {
        var clock = new FakeTenantClock(TestDates.Now);

        clock.Should().BeAssignableTo<ITenantClock>();
    }

    [Fact]
    public void TenantToday_EqualsDateOfTenantNow()
    {
        var clock = new FakeTenantClock(TestDates.Now);

        clock.TenantToday.Should().Be(clock.TenantNow.Date);
    }
}
