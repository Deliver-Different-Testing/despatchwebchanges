using DespatchWeb.Helpers;

namespace DespatchWeb.Tests.Helpers;

/// <summary>
/// Unit tests for DayOfWeekHelper - tests day of week conversion functionality.
/// Verifies that conversions follow ISO 8601 weekday convention:
/// Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5, Saturday=6, Sunday=7
/// </summary>
public class DayOfWeekHelperTests
{

    [Theory]
    [InlineData("Monday", 1)]
    [InlineData("Tuesday", 2)]
    [InlineData("Wednesday", 3)]
    [InlineData("Thursday", 4)]
    [InlineData("Friday", 5)]
    [InlineData("Saturday", 6)]
    [InlineData("Sunday", 7)]
    public void DayNameToSqlInt_ValidDayName_ReturnsCorrectIsoValue(string dayName, int expectedValue)
    {
        // Act
        var result = DayOfWeekHelper.DayNameToSqlInt(dayName);

        // Assert
        Assert.Equal(expectedValue, result);
    }

    [Theory]
    [InlineData("monday", 1)]
    [InlineData("SUNDAY", 7)]
    [InlineData("MONDAY", 1)]
    [InlineData("tuesday", 2)]
    [InlineData("sUnDaY", 7)]
    public void DayNameToSqlInt_CaseInsensitive_ReturnsCorrectIsoValue(string dayName, int expectedValue)
    {
        // Act
        var result = DayOfWeekHelper.DayNameToSqlInt(dayName);

        // Assert
        Assert.Equal(expectedValue, result);
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
        Assert.Equal(0, result);
    }

    [Fact]
    public void DayNameToSqlInt_NullDayName_ReturnsZero()
    {
        // Act
        var result = DayOfWeekHelper.DayNameToSqlInt(null!);

        // Assert
        Assert.Equal(0, result);
    }

    [Fact]
    public void DayNameToSqlInt_Monday_ReturnsOne_MatchesIsoConvention()
    {
        // This test explicitly verifies the ISO 8601 weekday convention
        // where Monday is the first day of the week (value 1)
        var result = DayOfWeekHelper.DayNameToSqlInt("Monday");

        Assert.True(result == 1, "ISO 8601 defines Monday as the first day of the week (value 1)");
    }

    [Fact]
    public void DayNameToSqlInt_AllDays_AreSequential()
    {
        // Verify that days are sequential from 1-7 (Monday through Sunday per ISO 8601)
        var days = new[] { "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday" };

        for (var i = 0; i < days.Length; i++)
        {
            var result = DayOfWeekHelper.DayNameToSqlInt(days[i]);
            Assert.True(result == i + 1, $"{days[i]} should be {i + 1}");
        }
    }

    [Theory]
    [InlineData(1, "Monday")]
    [InlineData(2, "Tuesday")]
    [InlineData(3, "Wednesday")]
    [InlineData(4, "Thursday")]
    [InlineData(5, "Friday")]
    [InlineData(6, "Saturday")]
    [InlineData(7, "Sunday")]
    public void SqlIntToDayName_ValidIsoValue_ReturnsCorrectDayName(int isoValue, string expectedDayName)
    {
        // Act
        var result = DayOfWeekHelper.SqlIntToDayName(isoValue);

        // Assert
        Assert.Equal(expectedDayName, result);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(8)]
    [InlineData(100)]
    public void SqlIntToDayName_InvalidValue_ReturnsUnknown(int invalidValue)
    {
        // Act
        var result = DayOfWeekHelper.SqlIntToDayName(invalidValue);

        // Assert
        Assert.Equal("Unknown", result);
    }

    [Fact]
    public void SqlIntToDayName_One_ReturnsMonday_MatchesIsoConvention()
    {
        // This test explicitly verifies the ISO 8601 weekday convention
        // where 1 represents Monday
        var result = DayOfWeekHelper.SqlIntToDayName(1);

        Assert.True(result == "Monday", "ISO 8601 weekday value 1 represents Monday");
    }

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
        Assert.Equal(originalDayName, resultDayName);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(4)]
    [InlineData(5)]
    [InlineData(6)]
    [InlineData(7)]
    public void RoundTrip_IntToDayNameAndBack_ReturnsSameInt(int originalInt)
    {
        // Act
        var dayName = DayOfWeekHelper.SqlIntToDayName(originalInt);
        var resultInt = DayOfWeekHelper.DayNameToSqlInt(dayName);

        // Assert
        Assert.Equal(originalInt, resultInt);
    }

    [Fact]
    public void IsoConvention_WeekStartsOnMonday()
    {
        // ISO 8601 defines Monday as the first day of the week
        // Monday = 1, Tuesday = 2, ..., Sunday = 7

        Assert.True(DayOfWeekHelper.DayNameToSqlInt("Monday") == 1, "Week starts on Monday in ISO 8601");
        Assert.True(DayOfWeekHelper.DayNameToSqlInt("Sunday") == 7, "Week ends on Sunday in ISO 8601");
    }

    [Fact]
    public void IsoConvention_WeekdaysAreSequential()
    {
        // Verify Monday-Friday are sequential (1-5)
        Assert.Equal(1, DayOfWeekHelper.DayNameToSqlInt("Monday"));
        Assert.Equal(2, DayOfWeekHelper.DayNameToSqlInt("Tuesday"));
        Assert.Equal(3, DayOfWeekHelper.DayNameToSqlInt("Wednesday"));
        Assert.Equal(4, DayOfWeekHelper.DayNameToSqlInt("Thursday"));
        Assert.Equal(5, DayOfWeekHelper.DayNameToSqlInt("Friday"));
    }

}
