using DespatchWeb.Helpers;
using FluentAssertions;

namespace DespatchWeb.Tests.Helpers;

/// <summary>
/// Unit tests for DayOfWeekHelper - tests day of week conversion functionality.
/// Verifies that conversions follow SQL Server DATEPART(WEEKDAY) convention:
/// Sunday=1, Monday=2, Tuesday=3, Wednesday=4, Thursday=5, Friday=6, Saturday=7
/// </summary>
public class DayOfWeekHelperTests
{
    #region DayNameToSqlInt Tests

    [Theory]
    [InlineData("Sunday", 1)]
    [InlineData("Monday", 2)]
    [InlineData("Tuesday", 3)]
    [InlineData("Wednesday", 4)]
    [InlineData("Thursday", 5)]
    [InlineData("Friday", 6)]
    [InlineData("Saturday", 7)]
    public void DayNameToSqlInt_ValidDayName_ReturnsCorrectSqlValue(string dayName, int expectedValue)
    {
        // Act
        var result = DayOfWeekHelper.DayNameToSqlInt(dayName);

        // Assert
        result.Should().Be(expectedValue);
    }

    [Theory]
    [InlineData("monday", 2)]
    [InlineData("SUNDAY", 1)]
    [InlineData("MONDAY", 2)]
    [InlineData("tuesday", 3)]
    [InlineData("sUnDaY", 1)]
    public void DayNameToSqlInt_CaseInsensitive_ReturnsCorrectSqlValue(string dayName, int expectedValue)
    {
        // Act
        var result = DayOfWeekHelper.DayNameToSqlInt(dayName);

        // Assert
        result.Should().Be(expectedValue);
    }

    [Theory]
    [InlineData("")]
    [InlineData("InvalidDay")]
    [InlineData("Mon")]
    [InlineData("Sun")]
    public void DayNameToSqlInt_InvalidDayName_ReturnsZero(string invalidDayName)
    {
        // Act
        var result = DayOfWeekHelper.DayNameToSqlInt(invalidDayName);

        // Assert
        result.Should().Be(0);
    }

    [Fact]
    public void DayNameToSqlInt_NullDayName_ReturnsZero()
    {
        // Act
        var result = DayOfWeekHelper.DayNameToSqlInt(null!);

        // Assert
        result.Should().Be(0);
    }

    [Fact]
    public void DayNameToSqlInt_Sunday_ReturnsOne_MatchesSqlServerConvention()
    {
        // This test explicitly verifies the SQL Server DATEPART(WEEKDAY) convention
        // where Sunday is the first day of the week (value 1)
        var result = DayOfWeekHelper.DayNameToSqlInt("Sunday");

        result.Should().Be(1, "SQL Server DATEPART(WEEKDAY) returns 1 for Sunday by default");
    }

    [Fact]
    public void DayNameToSqlInt_AllDays_AreSequential()
    {
        // Verify that days are sequential from 1-7
        var days = new[] { "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday" };

        for (var i = 0; i < days.Length; i++)
        {
            var result = DayOfWeekHelper.DayNameToSqlInt(days[i]);
            result.Should().Be(i + 1, $"{days[i]} should be {i + 1}");
        }
    }

    #endregion

    #region SqlIntToDayName Tests

    [Theory]
    [InlineData(1, "Sunday")]
    [InlineData(2, "Monday")]
    [InlineData(3, "Tuesday")]
    [InlineData(4, "Wednesday")]
    [InlineData(5, "Thursday")]
    [InlineData(6, "Friday")]
    [InlineData(7, "Saturday")]
    public void SqlIntToDayName_ValidSqlValue_ReturnsCorrectDayName(int sqlValue, string expectedDayName)
    {
        // Act
        var result = DayOfWeekHelper.SqlIntToDayName(sqlValue);

        // Assert
        result.Should().Be(expectedDayName);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(8)]
    [InlineData(100)]
    public void SqlIntToDayName_InvalidSqlValue_ReturnsUnknown(int invalidSqlValue)
    {
        // Act
        var result = DayOfWeekHelper.SqlIntToDayName(invalidSqlValue);

        // Assert
        result.Should().Be("Unknown");
    }

    [Fact]
    public void SqlIntToDayName_One_ReturnsSunday_MatchesSqlServerConvention()
    {
        // This test explicitly verifies the SQL Server DATEPART(WEEKDAY) convention
        // where 1 represents Sunday
        var result = DayOfWeekHelper.SqlIntToDayName(1);

        result.Should().Be("Sunday", "SQL Server DATEPART(WEEKDAY) value 1 represents Sunday by default");
    }

    #endregion

    #region Round-Trip Tests

    [Theory]
    [InlineData("Sunday")]
    [InlineData("Monday")]
    [InlineData("Tuesday")]
    [InlineData("Wednesday")]
    [InlineData("Thursday")]
    [InlineData("Friday")]
    [InlineData("Saturday")]
    public void RoundTrip_DayNameToIntAndBack_ReturnsSameDayName(string originalDayName)
    {
        // Act
        var sqlInt = DayOfWeekHelper.DayNameToSqlInt(originalDayName);
        var resultDayName = DayOfWeekHelper.SqlIntToDayName(sqlInt);

        // Assert
        resultDayName.Should().Be(originalDayName);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(4)]
    [InlineData(5)]
    [InlineData(6)]
    [InlineData(7)]
    public void RoundTrip_SqlIntToDayNameAndBack_ReturnsSameSqlInt(int originalSqlInt)
    {
        // Act
        var dayName = DayOfWeekHelper.SqlIntToDayName(originalSqlInt);
        var resultSqlInt = DayOfWeekHelper.DayNameToSqlInt(dayName);

        // Assert
        resultSqlInt.Should().Be(originalSqlInt);
    }

    #endregion

    #region SQL Server Convention Documentation Tests

    [Fact]
    public void SqlServerConvention_WeekStartsOnSunday()
    {
        // SQL Server DATEPART(WEEKDAY) by default uses SET DATEFIRST 7 (US convention)
        // This means Sunday = 1, Monday = 2, ..., Saturday = 7

        DayOfWeekHelper.DayNameToSqlInt("Sunday").Should().Be(1, "Week starts on Sunday in SQL Server default");
        DayOfWeekHelper.DayNameToSqlInt("Saturday").Should().Be(7, "Week ends on Saturday in SQL Server default");
    }

    [Fact]
    public void SqlServerConvention_WeekdaysAreSequential()
    {
        // Verify Monday-Friday are sequential (2-6)
        DayOfWeekHelper.DayNameToSqlInt("Monday").Should().Be(2);
        DayOfWeekHelper.DayNameToSqlInt("Tuesday").Should().Be(3);
        DayOfWeekHelper.DayNameToSqlInt("Wednesday").Should().Be(4);
        DayOfWeekHelper.DayNameToSqlInt("Thursday").Should().Be(5);
        DayOfWeekHelper.DayNameToSqlInt("Friday").Should().Be(6);
    }

    #endregion
}
