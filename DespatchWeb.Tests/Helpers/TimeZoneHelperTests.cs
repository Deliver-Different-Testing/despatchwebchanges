using DespatchWeb.Helpers;
using FluentAssertions;

namespace DespatchWeb.Tests.Helpers;

/// <summary>
/// Unit tests for TimeZoneHelper - tests timezone offset application functionality.
/// Note: TimeZoneHelper.SetDateTimeWithTimeZone preserves the DateTime value and only applies the offset.
/// For UTC-to-local conversion, use DateExtension.ToTimeZoneOffset instead.
/// </summary>
public class TimeZoneHelperTests
{
    #region SetDateTimeWithTimeZone (DateTimeOffset overload) Tests

    [Fact]
    public void SetDateTimeWithTimeZone_DateTimeOffset_WithUtc_ReturnsUtcOffset()
    {
        // Arrange
        var dateTime = new DateTimeOffset(2024, 6, 15, 12, 0, 0, TimeSpan.Zero);

        // Act
        var result = TimeZoneHelper.SetDateTimeWithTimeZone(dateTime, "UTC");

        // Assert
        result.Offset.Should().Be(TimeSpan.Zero);
        result.DateTime.Should().Be(new DateTime(2024, 6, 15, 12, 0, 0));
    }

    [Fact]
    public void SetDateTimeWithTimeZone_DateTimeOffset_WithNzTimeZone_AppliesOffset()
    {
        // Arrange
        var dateTime = new DateTimeOffset(2024, 6, 15, 12, 0, 0, TimeSpan.Zero);

        // Act
        var result = TimeZoneHelper.SetDateTimeWithTimeZone(dateTime, "New Zealand Standard Time");

        // Assert - NZ is UTC+12 in winter (June), DateTime preserved, offset applied
        result.Offset.Should().Be(TimeSpan.FromHours(12));
        result.DateTime.Should().Be(new DateTime(2024, 6, 15, 12, 0, 0));
    }

    [Fact]
    public void SetDateTimeWithTimeZone_DateTimeOffset_WithPacificTimeZone_AppliesOffset()
    {
        // Arrange
        var dateTime = new DateTimeOffset(2024, 1, 15, 12, 0, 0, TimeSpan.Zero);

        // Act
        var result = TimeZoneHelper.SetDateTimeWithTimeZone(dateTime, "Pacific Standard Time");

        // Assert - PST is UTC-8 in winter (January), DateTime preserved, offset applied
        result.Offset.Should().Be(TimeSpan.FromHours(-8));
        result.DateTime.Should().Be(new DateTime(2024, 1, 15, 12, 0, 0));
    }

    [Fact]
    public void SetDateTimeWithTimeZone_DateTimeOffset_PreservesDateTime()
    {
        // Arrange - Time should be preserved, only offset applied
        var dateTime = new DateTimeOffset(2024, 12, 25, 14, 30, 45, TimeSpan.Zero);

        // Act
        var result = TimeZoneHelper.SetDateTimeWithTimeZone(dateTime, "New Zealand Standard Time");

        // Assert - DateTime is preserved, NZDT offset (+13) applied
        result.Hour.Should().Be(14);
        result.Minute.Should().Be(30);
        result.Second.Should().Be(45);
        result.Day.Should().Be(25);
        result.Offset.Should().Be(TimeSpan.FromHours(13));
    }

    [Fact]
    public void SetDateTimeWithTimeZone_DateTimeOffset_WithInvalidTimeZone_ThrowsException()
    {
        // Arrange
        var dateTime = new DateTimeOffset(2024, 6, 15, 12, 0, 0, TimeSpan.Zero);

        // Act
        var act = () => TimeZoneHelper.SetDateTimeWithTimeZone(dateTime, "Invalid TimeZone");

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithMessage("*Invalid or unsupported time zone*");
    }

    [Fact]
    public void SetDateTimeWithTimeZone_DateTimeOffset_WithEmptyTimeZone_ThrowsException()
    {
        // Arrange
        var dateTime = new DateTimeOffset(2024, 6, 15, 12, 0, 0, TimeSpan.Zero);

        // Act
        var act = () => TimeZoneHelper.SetDateTimeWithTimeZone(dateTime, "");

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithMessage("*Time zone cannot be null or empty*");
    }

    [Fact]
    public void SetDateTimeWithTimeZone_DateTimeOffset_WithNullTimeZone_ThrowsException()
    {
        // Arrange
        var dateTime = new DateTimeOffset(2024, 6, 15, 12, 0, 0, TimeSpan.Zero);

        // Act
        var act = () => TimeZoneHelper.SetDateTimeWithTimeZone(dateTime, null!);

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithMessage("*Time zone cannot be null or empty*");
    }

    #endregion

    #region SetDateTimeWithTimeZone (DateTime overload) Tests

    [Fact]
    public void SetDateTimeWithTimeZone_DateTime_WithUtc_ReturnsUtcOffset()
    {
        // Arrange
        var dateTime = new DateTime(2024, 6, 15, 12, 0, 0);

        // Act
        var result = TimeZoneHelper.SetDateTimeWithTimeZone(dateTime, "UTC");

        // Assert
        result.Offset.Should().Be(TimeSpan.Zero);
        result.DateTime.Should().Be(dateTime);
    }

    [Fact]
    public void SetDateTimeWithTimeZone_DateTime_WithNzTimeZone_AppliesOffset()
    {
        // Arrange
        var dateTime = new DateTime(2024, 6, 15, 12, 0, 0);

        // Act
        var result = TimeZoneHelper.SetDateTimeWithTimeZone(dateTime, "New Zealand Standard Time");

        // Assert - NZ is UTC+12 in winter (June), DateTime preserved, offset applied
        result.Offset.Should().Be(TimeSpan.FromHours(12));
        result.DateTime.Should().Be(dateTime);
    }

    [Fact]
    public void SetDateTimeWithTimeZone_DateTime_PreservesDateTime()
    {
        // Arrange - 14:30 should remain 14:30, only offset applied
        var dateTime = new DateTime(2024, 12, 25, 14, 30, 45);

        // Act
        var result = TimeZoneHelper.SetDateTimeWithTimeZone(dateTime, "Pacific Standard Time");

        // Assert - DateTime is preserved, PST offset (-8) applied
        result.Hour.Should().Be(14);
        result.Minute.Should().Be(30);
        result.Second.Should().Be(45);
        result.Offset.Should().Be(TimeSpan.FromHours(-8));
    }

    #endregion

    #region IANA TimeZone Support Tests

    [Fact]
    public void SetDateTimeWithTimeZone_WithIanaTimeZone_AppliesCorrectOffset()
    {
        // Arrange
        var dateTime = new DateTimeOffset(2024, 6, 15, 12, 0, 0, TimeSpan.Zero);

        // Act - Using IANA timezone format (Pacific/Auckland)
        var result = TimeZoneHelper.SetDateTimeWithTimeZone(dateTime, "Pacific/Auckland");

        // Assert - NZ is UTC+12 in winter (June)
        result.Offset.Should().Be(TimeSpan.FromHours(12));
        result.DateTime.Should().Be(new DateTime(2024, 6, 15, 12, 0, 0));
    }

    [Fact]
    public void SetDateTimeWithTimeZone_WithIanaAmericaLosAngeles_AppliesCorrectOffset()
    {
        // Arrange
        var dateTime = new DateTimeOffset(2024, 1, 15, 12, 0, 0, TimeSpan.Zero);

        // Act
        var result = TimeZoneHelper.SetDateTimeWithTimeZone(dateTime, "America/Los_Angeles");

        // Assert - LA is UTC-8 in winter (January)
        result.Offset.Should().Be(TimeSpan.FromHours(-8));
        result.DateTime.Should().Be(new DateTime(2024, 1, 15, 12, 0, 0));
    }

    #endregion

    #region Daylight Saving Time Tests

    [Fact]
    public void SetDateTimeWithTimeZone_NzDaylightSavingTime_AppliesCorrectOffset()
    {
        // Arrange - December is summer in NZ (NZDT = UTC+13)
        var dateTime = new DateTimeOffset(2024, 12, 15, 12, 0, 0, TimeSpan.Zero);

        // Act
        var result = TimeZoneHelper.SetDateTimeWithTimeZone(dateTime, "New Zealand Standard Time");

        // Assert - NZ is UTC+13 in summer (December) due to daylight saving
        result.Offset.Should().Be(TimeSpan.FromHours(13));
        result.DateTime.Should().Be(new DateTime(2024, 12, 15, 12, 0, 0));
    }

    [Fact]
    public void SetDateTimeWithTimeZone_PacificDaylightSavingTime_AppliesCorrectOffset()
    {
        // Arrange - July is summer in US (PDT = UTC-7)
        var dateTime = new DateTimeOffset(2024, 7, 15, 12, 0, 0, TimeSpan.Zero);

        // Act
        var result = TimeZoneHelper.SetDateTimeWithTimeZone(dateTime, "Pacific Standard Time");

        // Assert - PST becomes PDT in summer (UTC-7)
        result.Offset.Should().Be(TimeSpan.FromHours(-7));
        result.DateTime.Should().Be(new DateTime(2024, 7, 15, 12, 0, 0));
    }

    #endregion
}
