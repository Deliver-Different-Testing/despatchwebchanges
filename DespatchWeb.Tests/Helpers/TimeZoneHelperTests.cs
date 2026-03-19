using DespatchWeb.Helpers;

namespace DespatchWeb.Tests.Helpers;

/// <summary>
/// Unit tests for TimeZoneHelper - tests timezone offset application functionality.
/// Note: TimeZoneHelper.SetDateTimeWithTimeZone preserves the DateTime value and only applies the offset.
/// For UTC-to-local conversion, use DateExtension.ToTimeZoneOffset instead.
/// </summary>
public class TimeZoneHelperTests
{

    [Fact]
    public void SetDateTimeWithTimeZone_DateTimeOffset_WithUtc_ReturnsUtcOffset()
    {
        // Arrange
        var dateTime = new DateTimeOffset(2024, 6, 15, 12, 0, 0, TimeSpan.Zero);

        // Act
        var result = TimeZoneHelper.SetDateTimeWithTimeZone(dateTime, "UTC");

        // Assert
        Assert.Equal(TimeSpan.Zero, result.Offset);
        Assert.Equal(new DateTime(2024, 6, 15, 12, 0, 0), result.DateTime);
    }

    [Fact]
    public void SetDateTimeWithTimeZone_DateTimeOffset_WithNzTimeZone_AppliesOffset()
    {
        // Arrange
        var dateTime = new DateTimeOffset(2024, 6, 15, 12, 0, 0, TimeSpan.Zero);

        // Act
        var result = TimeZoneHelper.SetDateTimeWithTimeZone(dateTime, "New Zealand Standard Time");

        // Assert - NZ is UTC+12 in winter (June), DateTime preserved, offset applied
        Assert.Equal(TimeSpan.FromHours(12), result.Offset);
        Assert.Equal(new DateTime(2024, 6, 15, 12, 0, 0), result.DateTime);
    }

    [Fact]
    public void SetDateTimeWithTimeZone_DateTimeOffset_WithPacificTimeZone_AppliesOffset()
    {
        // Arrange
        var dateTime = new DateTimeOffset(2024, 1, 15, 12, 0, 0, TimeSpan.Zero);

        // Act
        var result = TimeZoneHelper.SetDateTimeWithTimeZone(dateTime, "Pacific Standard Time");

        // Assert - PST is UTC-8 in winter (January), DateTime preserved, offset applied
        Assert.Equal(TimeSpan.FromHours(-8), result.Offset);
        Assert.Equal(new DateTime(2024, 1, 15, 12, 0, 0), result.DateTime);
    }

    [Fact]
    public void SetDateTimeWithTimeZone_DateTimeOffset_PreservesDateTime()
    {
        // Arrange - Time should be preserved, only offset applied
        var dateTime = new DateTimeOffset(2024, 12, 25, 14, 30, 45, TimeSpan.Zero);

        // Act
        var result = TimeZoneHelper.SetDateTimeWithTimeZone(dateTime, "New Zealand Standard Time");

        // Assert - DateTime is preserved, NZDT offset (+13) applied
        Assert.Equal(14, result.Hour);
        Assert.Equal(30, result.Minute);
        Assert.Equal(45, result.Second);
        Assert.Equal(25, result.Day);
        Assert.Equal(TimeSpan.FromHours(13), result.Offset);
    }

    [Fact]
    public void SetDateTimeWithTimeZone_DateTimeOffset_WithInvalidTimeZone_ThrowsException()
    {
        // Arrange
        var dateTime = new DateTimeOffset(2024, 6, 15, 12, 0, 0, TimeSpan.Zero);

        // Act
        Action act = () => TimeZoneHelper.SetDateTimeWithTimeZone(dateTime, "Invalid TimeZone");

        // Assert
        var ex = Assert.Throws<ArgumentException>(act);
        Assert.Contains("Invalid or unsupported time zone", ex.Message);
    }

    [Fact]
    public void SetDateTimeWithTimeZone_DateTimeOffset_WithEmptyTimeZone_ThrowsException()
    {
        // Arrange
        var dateTime = new DateTimeOffset(2024, 6, 15, 12, 0, 0, TimeSpan.Zero);

        // Act
        Action act = () => TimeZoneHelper.SetDateTimeWithTimeZone(dateTime, "");

        // Assert
        var ex = Assert.Throws<ArgumentException>(act);
        Assert.Contains("Time zone cannot be null or empty", ex.Message);
    }

    [Fact]
    public void SetDateTimeWithTimeZone_DateTimeOffset_WithNullTimeZone_ThrowsException()
    {
        // Arrange
        var dateTime = new DateTimeOffset(2024, 6, 15, 12, 0, 0, TimeSpan.Zero);

        // Act
        Action act = () => TimeZoneHelper.SetDateTimeWithTimeZone(dateTime, null!);

        // Assert
        var ex = Assert.Throws<ArgumentException>(act);
        Assert.Contains("Time zone cannot be null or empty", ex.Message);
    }

    [Fact]
    public void SetDateTimeWithTimeZone_DateTime_WithUtc_ReturnsUtcOffset()
    {
        // Arrange
        var dateTime = new DateTime(2024, 6, 15, 12, 0, 0);

        // Act
        var result = TimeZoneHelper.SetDateTimeWithTimeZone(dateTime, "UTC");

        // Assert
        Assert.Equal(TimeSpan.Zero, result.Offset);
        Assert.Equal(dateTime, result.DateTime);
    }

    [Fact]
    public void SetDateTimeWithTimeZone_DateTime_WithNzTimeZone_AppliesOffset()
    {
        // Arrange
        var dateTime = new DateTime(2024, 6, 15, 12, 0, 0);

        // Act
        var result = TimeZoneHelper.SetDateTimeWithTimeZone(dateTime, "New Zealand Standard Time");

        // Assert - NZ is UTC+12 in winter (June), DateTime preserved, offset applied
        Assert.Equal(TimeSpan.FromHours(12), result.Offset);
        Assert.Equal(dateTime, result.DateTime);
    }

    [Fact]
    public void SetDateTimeWithTimeZone_DateTime_PreservesDateTime()
    {
        // Arrange - 14:30 should remain 14:30, only offset applied
        var dateTime = new DateTime(2024, 12, 25, 14, 30, 45);

        // Act
        var result = TimeZoneHelper.SetDateTimeWithTimeZone(dateTime, "Pacific Standard Time");

        // Assert - DateTime is preserved, PST offset (-8) applied
        Assert.Equal(14, result.Hour);
        Assert.Equal(30, result.Minute);
        Assert.Equal(45, result.Second);
        Assert.Equal(TimeSpan.FromHours(-8), result.Offset);
    }

    [Fact]
    public void SetDateTimeWithTimeZone_WithIanaTimeZone_AppliesCorrectOffset()
    {
        // Arrange
        var dateTime = new DateTimeOffset(2024, 6, 15, 12, 0, 0, TimeSpan.Zero);

        // Act - Using IANA timezone format (Pacific/Auckland)
        var result = TimeZoneHelper.SetDateTimeWithTimeZone(dateTime, "Pacific/Auckland");

        // Assert - NZ is UTC+12 in winter (June)
        Assert.Equal(TimeSpan.FromHours(12), result.Offset);
        Assert.Equal(new DateTime(2024, 6, 15, 12, 0, 0), result.DateTime);
    }

    [Fact]
    public void SetDateTimeWithTimeZone_WithIanaAmericaLosAngeles_AppliesCorrectOffset()
    {
        // Arrange
        var dateTime = new DateTimeOffset(2024, 1, 15, 12, 0, 0, TimeSpan.Zero);

        // Act
        var result = TimeZoneHelper.SetDateTimeWithTimeZone(dateTime, "America/Los_Angeles");

        // Assert - LA is UTC-8 in winter (January)
        Assert.Equal(TimeSpan.FromHours(-8), result.Offset);
        Assert.Equal(new DateTime(2024, 1, 15, 12, 0, 0), result.DateTime);
    }

    [Fact]
    public void SetDateTimeWithTimeZone_NzDaylightSavingTime_AppliesCorrectOffset()
    {
        // Arrange - December is summer in NZ (NZDT = UTC+13)
        var dateTime = new DateTimeOffset(2024, 12, 15, 12, 0, 0, TimeSpan.Zero);

        // Act
        var result = TimeZoneHelper.SetDateTimeWithTimeZone(dateTime, "New Zealand Standard Time");

        // Assert - NZ is UTC+13 in summer (December) due to daylight saving
        Assert.Equal(TimeSpan.FromHours(13), result.Offset);
        Assert.Equal(new DateTime(2024, 12, 15, 12, 0, 0), result.DateTime);
    }

    [Fact]
    public void SetDateTimeWithTimeZone_PacificDaylightSavingTime_AppliesCorrectOffset()
    {
        // Arrange - July is summer in US (PDT = UTC-7)
        var dateTime = new DateTimeOffset(2024, 7, 15, 12, 0, 0, TimeSpan.Zero);

        // Act
        var result = TimeZoneHelper.SetDateTimeWithTimeZone(dateTime, "Pacific Standard Time");

        // Assert - PST becomes PDT in summer (UTC-7)
        Assert.Equal(TimeSpan.FromHours(-7), result.Offset);
        Assert.Equal(new DateTime(2024, 7, 15, 12, 0, 0), result.DateTime);
    }

}
