using System.Text.Json;
using DespatchWeb.Extensions;

namespace DespatchWeb.Tests.Extensions;

/// <summary>
/// Unit tests for DateExtension - tests UTC to timezone conversion functionality.
/// </summary>
public class DateExtensionTests
{

    [Fact]
    public void ToTimeZone_WithPacificTimeZone_ConvertsUtcToLocal()
    {
        // Arrange - 18:00 UTC should become 10:00 PST (UTC-8)
        var utcTime = new DateTime(2024, 1, 15, 18, 0, 0, DateTimeKind.Utc);

        // Act
        var result = utcTime.ToTimeZone("Pacific Standard Time");

        // Assert
        Assert.Equal(10, result.Hour);
        Assert.Equal(15, result.Day);
    }

    [Fact]
    public void ToTimeZone_WithNzTimeZone_ConvertsUtcToLocal()
    {
        // Arrange - 00:00 UTC on Jan 15 should become 13:00 NZDT on Jan 15 (UTC+13)
        var utcTime = new DateTime(2024, 1, 15, 0, 0, 0, DateTimeKind.Utc);

        // Act
        var result = utcTime.ToTimeZone("New Zealand Standard Time");

        // Assert
        Assert.Equal(13, result.Hour);
        Assert.Equal(15, result.Day);
    }

    [Fact]
    public void ToTimeZone_CrossesDayBoundary_ForwardInTime()
    {
        // Arrange - 22:00 UTC on Jan 15 becomes 11:00 NZDT on Jan 16 (UTC+13)
        var utcTime = new DateTime(2024, 1, 15, 22, 0, 0, DateTimeKind.Utc);

        // Act
        var result = utcTime.ToTimeZone("New Zealand Standard Time");

        // Assert
        Assert.Equal(16, result.Day);
        Assert.Equal(11, result.Hour);
    }

    [Fact]
    public void ToTimeZone_CrossesDayBoundary_BackwardInTime()
    {
        // Arrange - 02:00 UTC on Jan 15 becomes 18:00 PST on Jan 14 (UTC-8)
        var utcTime = new DateTime(2024, 1, 15, 2, 0, 0, DateTimeKind.Utc);

        // Act
        var result = utcTime.ToTimeZone("Pacific Standard Time");

        // Assert
        Assert.Equal(14, result.Day);
        Assert.Equal(18, result.Hour);
    }

    [Fact]
    public void ToTimeZone_WithUtc_ReturnsUnchangedTime()
    {
        // Arrange
        var utcTime = new DateTime(2024, 1, 15, 12, 30, 0, DateTimeKind.Utc);

        // Act
        var result = utcTime.ToTimeZone("UTC");

        // Assert
        Assert.Equal(12, result.Hour);
        Assert.Equal(30, result.Minute);
    }

    [Fact]
    public void ToTimeZone_DuringDaylightSavingTime_UsesCorrectOffset()
    {
        // Arrange - July is summer in US (PDT = UTC-7)
        var utcTime = new DateTime(2024, 7, 15, 17, 0, 0, DateTimeKind.Utc);

        // Act
        var result = utcTime.ToTimeZone("Pacific Standard Time");

        // Assert - 17:00 UTC = 10:00 PDT (UTC-7)
        Assert.Equal(10, result.Hour);
    }

    [Fact]
    public void ToTimeZone_WithInvalidTimeZone_FallsBackToUtc()
    {
        // Arrange
        var utcTime = new DateTime(2024, 1, 15, 12, 0, 0, DateTimeKind.Utc);

        // Act - Invalid timezone IDs now fall back to UTC instead of throwing
        var result = utcTime.ToTimeZone("Invalid TimeZone");

        // Assert - Should return UTC time unchanged
        Assert.Equal(12, result.Hour);
        Assert.Equal(15, result.Day);
    }

    [Fact]
    public void ToTimeZone_WithIanaTimeZone_ConvertsSuccessfully()
    {
        // Arrange - IANA timezone ID from FlightStats API
        var utcTime = new DateTime(2024, 1, 15, 18, 0, 0, DateTimeKind.Utc);

        // Act - IANA timezone IDs are now converted to Windows IDs
        var result = utcTime.ToTimeZone("America/Los_Angeles");

        // Assert - 18:00 UTC = 10:00 PST (UTC-8)
        Assert.Equal(10, result.Hour);
        Assert.Equal(15, result.Day);
    }

    [Fact]
    public void ToTimeZoneOffset_TimeZoneInfo_ConvertsAndIncludesOffset()
    {
        // Arrange - 18:00 UTC should become 10:00 PST with -8 offset
        var utcTime = new DateTime(2024, 1, 15, 18, 0, 0, DateTimeKind.Utc);
        var pstTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Pacific Standard Time");

        // Act
        var result = utcTime.ToTimeZoneOffset(pstTimeZone);

        // Assert
        Assert.Equal(10, result.Hour);
        Assert.Equal(TimeSpan.FromHours(-8), result.Offset);
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
        Assert.Equal(utcTime, result.UtcDateTime);
    }

    [Fact]
    public void ToTimeZoneOffset_String_ConvertsAndIncludesOffset()
    {
        // Arrange - 18:00 UTC should become 10:00 PST with -8 offset
        var utcTime = new DateTime(2024, 1, 15, 18, 0, 0, DateTimeKind.Utc);

        // Act
        var result = utcTime.ToTimeZoneOffset("Pacific Standard Time");

        // Assert
        Assert.Equal(10, result.Hour);
        Assert.Equal(TimeSpan.FromHours(-8), result.Offset);
    }

    [Fact]
    public void ToTimeZoneOffset_String_WithNzTimeZone()
    {
        // Arrange - 00:00 UTC becomes 13:00 NZDT with +13 offset
        var utcTime = new DateTime(2024, 1, 15, 0, 0, 0, DateTimeKind.Utc);

        // Act
        var result = utcTime.ToTimeZoneOffset("New Zealand Standard Time");

        // Assert
        Assert.Equal(13, result.Hour);
        Assert.Equal(TimeSpan.FromHours(13), result.Offset); // NZDT in January
    }

    [Fact]
    public void ToTimeZoneOffset_String_DuringDaylightSaving()
    {
        // Arrange - June is winter in NZ (NZST = UTC+12)
        var utcTime = new DateTime(2024, 6, 15, 0, 0, 0, DateTimeKind.Utc);

        // Act
        var result = utcTime.ToTimeZoneOffset("New Zealand Standard Time");

        // Assert
        Assert.Equal(12, result.Hour);
        Assert.Equal(TimeSpan.FromHours(12), result.Offset); // NZST in June
    }

    [Fact]
    public void ToTimeZoneOffset_String_PreservesUtcInstant()
    {
        // Arrange
        var utcTime = new DateTime(2024, 3, 15, 8, 30, 0, DateTimeKind.Utc);

        // Act
        var result = utcTime.ToTimeZoneOffset("Pacific Standard Time");

        // Assert - The UtcDateTime should match the original
        Assert.Equal(utcTime, result.UtcDateTime);
    }

    [Fact]
    public void ToTimeZoneOffset_String_WithInvalidTimeZone_FallsBackToUtc()
    {
        // Arrange
        var utcTime = new DateTime(2024, 1, 15, 12, 0, 0, DateTimeKind.Utc);

        // Act - Invalid timezone IDs now fall back to UTC instead of throwing
        var result = utcTime.ToTimeZoneOffset("Invalid TimeZone");

        // Assert - Should return UTC time with zero offset
        Assert.Equal(12, result.Hour);
        Assert.Equal(15, result.Day);
        Assert.Equal(TimeSpan.Zero, result.Offset);
    }

    [Fact]
    public void ToTimeZoneOffset_String_WithIanaTimeZone_ConvertsSuccessfully()
    {
        // Arrange - IANA timezone ID from FlightStats API
        var utcTime = new DateTime(2024, 1, 15, 18, 0, 0, DateTimeKind.Utc);

        // Act - IANA timezone IDs are now converted to Windows IDs
        var result = utcTime.ToTimeZoneOffset("America/Los_Angeles");

        // Assert - 18:00 UTC = 10:00 PST with -8 offset
        Assert.Equal(10, result.Hour);
        Assert.Equal(15, result.Day);
        Assert.Equal(TimeSpan.FromHours(-8), result.Offset);
    }

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
        Assert.Equal(9, result.Hour);
        Assert.Equal(30, result.Minute);
        Assert.Equal(16, result.Day);
        Assert.Equal(TimeSpan.FromHours(13), result.Offset);
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
        Assert.Equal(18, result.Hour);
        Assert.Equal(14, result.Day);
        Assert.Equal(TimeSpan.FromHours(-8), result.Offset);
    }

    [Fact]
    public void ToTimeZoneOffset_JsonSerialization_IncludesOffset()
    {
        // Scenario: DateTimeOffset serializes to JSON with offset for frontend

        // Arrange
        var utcTime = new DateTime(2024, 1, 15, 18, 0, 0, DateTimeKind.Utc);

        // Act
        var result = utcTime.ToTimeZoneOffset("Pacific Standard Time");
        var jsonString = JsonSerializer.Serialize(result);

        // Assert - JSON should include the -08:00 offset
        Assert.Contains("-08:00", jsonString);
        Assert.Contains("10:00:00", jsonString); // Local time
    }

}
