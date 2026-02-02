using DespatchWeb.Extensions;
using FluentAssertions;

namespace DespatchWeb.Tests.Extensions;

/// <summary>
/// Unit tests for DateExtension - tests UTC to timezone conversion functionality.
/// </summary>
public class DateExtensionTests
{
    #region ToTimeZone Tests

    [Fact]
    public void ToTimeZone_WithPacificTimeZone_ConvertsUtcToLocal()
    {
        // Arrange - 18:00 UTC should become 10:00 PST (UTC-8)
        var utcTime = new DateTime(2024, 1, 15, 18, 0, 0, DateTimeKind.Utc);

        // Act
        var result = utcTime.ToTimeZone("Pacific Standard Time");

        // Assert
        result.Hour.Should().Be(10);
        result.Day.Should().Be(15);
    }

    [Fact]
    public void ToTimeZone_WithNzTimeZone_ConvertsUtcToLocal()
    {
        // Arrange - 00:00 UTC on Jan 15 should become 13:00 NZDT on Jan 15 (UTC+13)
        var utcTime = new DateTime(2024, 1, 15, 0, 0, 0, DateTimeKind.Utc);

        // Act
        var result = utcTime.ToTimeZone("New Zealand Standard Time");

        // Assert
        result.Hour.Should().Be(13);
        result.Day.Should().Be(15);
    }

    [Fact]
    public void ToTimeZone_CrossesDayBoundary_ForwardInTime()
    {
        // Arrange - 22:00 UTC on Jan 15 becomes 11:00 NZDT on Jan 16 (UTC+13)
        var utcTime = new DateTime(2024, 1, 15, 22, 0, 0, DateTimeKind.Utc);

        // Act
        var result = utcTime.ToTimeZone("New Zealand Standard Time");

        // Assert
        result.Day.Should().Be(16);
        result.Hour.Should().Be(11);
    }

    [Fact]
    public void ToTimeZone_CrossesDayBoundary_BackwardInTime()
    {
        // Arrange - 02:00 UTC on Jan 15 becomes 18:00 PST on Jan 14 (UTC-8)
        var utcTime = new DateTime(2024, 1, 15, 2, 0, 0, DateTimeKind.Utc);

        // Act
        var result = utcTime.ToTimeZone("Pacific Standard Time");

        // Assert
        result.Day.Should().Be(14);
        result.Hour.Should().Be(18);
    }

    [Fact]
    public void ToTimeZone_WithUtc_ReturnsUnchangedTime()
    {
        // Arrange
        var utcTime = new DateTime(2024, 1, 15, 12, 30, 0, DateTimeKind.Utc);

        // Act
        var result = utcTime.ToTimeZone("UTC");

        // Assert
        result.Hour.Should().Be(12);
        result.Minute.Should().Be(30);
    }

    [Fact]
    public void ToTimeZone_DuringDaylightSavingTime_UsesCorrectOffset()
    {
        // Arrange - July is summer in US (PDT = UTC-7)
        var utcTime = new DateTime(2024, 7, 15, 17, 0, 0, DateTimeKind.Utc);

        // Act
        var result = utcTime.ToTimeZone("Pacific Standard Time");

        // Assert - 17:00 UTC = 10:00 PDT (UTC-7)
        result.Hour.Should().Be(10);
    }

    [Fact]
    public void ToTimeZone_WithInvalidTimeZone_FallsBackToUtc()
    {
        // Arrange
        var utcTime = new DateTime(2024, 1, 15, 12, 0, 0, DateTimeKind.Utc);

        // Act - Invalid timezone IDs now fall back to UTC instead of throwing
        var result = utcTime.ToTimeZone("Invalid TimeZone");

        // Assert - Should return UTC time unchanged
        result.Hour.Should().Be(12);
        result.Day.Should().Be(15);
    }

    [Fact]
    public void ToTimeZone_WithIanaTimeZone_ConvertsSuccessfully()
    {
        // Arrange - IANA timezone ID from FlightStats API
        var utcTime = new DateTime(2024, 1, 15, 18, 0, 0, DateTimeKind.Utc);

        // Act - IANA timezone IDs are now converted to Windows IDs
        var result = utcTime.ToTimeZone("America/Los_Angeles");

        // Assert - 18:00 UTC = 10:00 PST (UTC-8)
        result.Hour.Should().Be(10);
        result.Day.Should().Be(15);
    }

    #endregion

    #region ToTimeZoneOffset (TimeZoneInfo overload) Tests

    [Fact]
    public void ToTimeZoneOffset_TimeZoneInfo_ConvertsAndIncludesOffset()
    {
        // Arrange - 18:00 UTC should become 10:00 PST with -8 offset
        var utcTime = new DateTime(2024, 1, 15, 18, 0, 0, DateTimeKind.Utc);
        var pstTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Pacific Standard Time");

        // Act
        var result = utcTime.ToTimeZoneOffset(pstTimeZone);

        // Assert
        result.Hour.Should().Be(10);
        result.Offset.Should().Be(TimeSpan.FromHours(-8));
    }

    [Fact]
    public void ToTimeZoneOffset_TimeZoneInfo_PreservesUtcInstant()
    {
        // Arrange
        var utcTime = new DateTime(2024, 1, 15, 18, 0, 0, DateTimeKind.Utc);
        var nzTimeZone = TimeZoneInfo.FindSystemTimeZoneById("New Zealand Standard Time");

        // Act
        var result = utcTime.ToTimeZoneOffset(nzTimeZone);

        // Assert - The UtcDateTime should match the original
        result.UtcDateTime.Should().Be(utcTime);
    }

    #endregion

    #region ToTimeZoneOffset (string overload) Tests

    [Fact]
    public void ToTimeZoneOffset_String_ConvertsAndIncludesOffset()
    {
        // Arrange - 18:00 UTC should become 10:00 PST with -8 offset
        var utcTime = new DateTime(2024, 1, 15, 18, 0, 0, DateTimeKind.Utc);

        // Act
        var result = utcTime.ToTimeZoneOffset("Pacific Standard Time");

        // Assert
        result.Hour.Should().Be(10);
        result.Offset.Should().Be(TimeSpan.FromHours(-8));
    }

    [Fact]
    public void ToTimeZoneOffset_String_WithNzTimeZone()
    {
        // Arrange - 00:00 UTC becomes 13:00 NZDT with +13 offset
        var utcTime = new DateTime(2024, 1, 15, 0, 0, 0, DateTimeKind.Utc);

        // Act
        var result = utcTime.ToTimeZoneOffset("New Zealand Standard Time");

        // Assert
        result.Hour.Should().Be(13);
        result.Offset.Should().Be(TimeSpan.FromHours(13)); // NZDT in January
    }

    [Fact]
    public void ToTimeZoneOffset_String_DuringDaylightSaving()
    {
        // Arrange - June is winter in NZ (NZST = UTC+12)
        var utcTime = new DateTime(2024, 6, 15, 0, 0, 0, DateTimeKind.Utc);

        // Act
        var result = utcTime.ToTimeZoneOffset("New Zealand Standard Time");

        // Assert
        result.Hour.Should().Be(12);
        result.Offset.Should().Be(TimeSpan.FromHours(12)); // NZST in June
    }

    [Fact]
    public void ToTimeZoneOffset_String_PreservesUtcInstant()
    {
        // Arrange
        var utcTime = new DateTime(2024, 3, 15, 8, 30, 0, DateTimeKind.Utc);

        // Act
        var result = utcTime.ToTimeZoneOffset("Pacific Standard Time");

        // Assert - The UtcDateTime should match the original
        result.UtcDateTime.Should().Be(utcTime);
    }

    [Fact]
    public void ToTimeZoneOffset_String_WithInvalidTimeZone_FallsBackToUtc()
    {
        // Arrange
        var utcTime = new DateTime(2024, 1, 15, 12, 0, 0, DateTimeKind.Utc);

        // Act - Invalid timezone IDs now fall back to UTC instead of throwing
        var result = utcTime.ToTimeZoneOffset("Invalid TimeZone");

        // Assert - Should return UTC time with zero offset
        result.Hour.Should().Be(12);
        result.Day.Should().Be(15);
        result.Offset.Should().Be(TimeSpan.Zero);
    }

    [Fact]
    public void ToTimeZoneOffset_String_WithIanaTimeZone_ConvertsSuccessfully()
    {
        // Arrange - IANA timezone ID from FlightStats API
        var utcTime = new DateTime(2024, 1, 15, 18, 0, 0, DateTimeKind.Utc);

        // Act - IANA timezone IDs are now converted to Windows IDs
        var result = utcTime.ToTimeZoneOffset("America/Los_Angeles");

        // Assert - 18:00 UTC = 10:00 PST with -8 offset
        result.Hour.Should().Be(10);
        result.Day.Should().Be(15);
        result.Offset.Should().Be(TimeSpan.FromHours(-8));
    }

    #endregion

    #region Flight Time Scenario Tests

    [Fact]
    public void ToTimeZoneOffset_FlightDepartureFromAuckland()
    {
        // Scenario: Flight departs Auckland at local time
        // Database stores UTC, frontend should display Auckland local time

        // Arrange - Flight stored as 20:30 UTC (which is 09:30 NZDT next day)
        var utcDepartureTime = new DateTime(2024, 1, 15, 20, 30, 0, DateTimeKind.Utc);

        // Act
        var result = utcDepartureTime.ToTimeZoneOffset("New Zealand Standard Time");

        // Assert - Should display as 09:30 on Jan 16 with +13 offset
        result.Hour.Should().Be(9);
        result.Minute.Should().Be(30);
        result.Day.Should().Be(16);
        result.Offset.Should().Be(TimeSpan.FromHours(13));
    }

    [Fact]
    public void ToTimeZoneOffset_FlightArrivalInLosAngeles()
    {
        // Scenario: Flight arrives Los Angeles at local time
        // Database stores UTC, frontend should display LA local time

        // Arrange - Flight stored as 02:00 UTC (which is 18:00 PST previous day)
        var utcArrivalTime = new DateTime(2024, 1, 15, 2, 0, 0, DateTimeKind.Utc);

        // Act
        var result = utcArrivalTime.ToTimeZoneOffset("Pacific Standard Time");

        // Assert - Should display as 18:00 on Jan 14 with -8 offset
        result.Hour.Should().Be(18);
        result.Day.Should().Be(14);
        result.Offset.Should().Be(TimeSpan.FromHours(-8));
    }

    [Fact]
    public void ToTimeZoneOffset_JsonSerialization_IncludesOffset()
    {
        // Scenario: DateTimeOffset serializes to JSON with offset for frontend

        // Arrange
        var utcTime = new DateTime(2024, 1, 15, 18, 0, 0, DateTimeKind.Utc);

        // Act
        var result = utcTime.ToTimeZoneOffset("Pacific Standard Time");
        var jsonString = System.Text.Json.JsonSerializer.Serialize(result);

        // Assert - JSON should include the -08:00 offset
        jsonString.Should().Contain("-08:00");
        jsonString.Should().Contain("10:00:00"); // Local time
    }

    #endregion
}
