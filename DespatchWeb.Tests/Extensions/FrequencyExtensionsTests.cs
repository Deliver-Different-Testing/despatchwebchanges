using DespatchWeb.Enums;
using DespatchWeb.Extensions;

namespace DespatchWeb.Tests.Extensions;

public class FrequencyExtensionsTests
{
    [Theory]
    [InlineData(Frequency.None, "None")]
    [InlineData(Frequency.Weekly, "Weekly")]
    [InlineData(Frequency.Fortnightly, "Fortnightly")]
    [InlineData(Frequency.FirstOfMonth, "First of the Month")]
    [InlineData(Frequency.SecondOfMonth, "Second of the Month")]
    [InlineData(Frequency.ThirdOfMonth, "Third of the Month")]
    [InlineData(Frequency.FirstWorkdayOfMonth, "First Workday of the Month")]
    [InlineData(Frequency.LastWorkdayOfMonth, "Last Workday of the Month")]
    public void ToDisplayString_SingleFlag_ReturnsExpectedString(Frequency frequency, string expected)
    {
        var result = frequency.ToDisplayString();

        Assert.Equal(expected, result);
    }

    [Fact]
    public void ToDisplayString_CombinedFlags_ReturnsCommaSeparatedString()
    {
        var frequency = Frequency.Weekly | Frequency.FirstOfMonth;

        var result = frequency.ToDisplayString();

        Assert.Equal("Weekly, First of the Month", result);
    }

    [Fact]
    public void ToDisplayString_MultipleCombinedFlags_ReturnsAllCommaSeparated()
    {
        var frequency = Frequency.Weekly | Frequency.Fortnightly | Frequency.LastWorkdayOfMonth;

        var result = frequency.ToDisplayString();

        Assert.Equal("Weekly, Fortnightly, Last Workday of the Month", result);
    }

    [Fact]
    public void IsWeeklyMatch_SameDayOfWeek_ReturnsTrue()
    {
        // Both are Wednesdays
        var date = new DateTime(2025, 1, 8);
        var reference = new DateTime(2025, 1, 1);

        Assert.True(FrequencyExtensions.IsWeeklyMatch(date, reference));
    }

    [Fact]
    public void IsWeeklyMatch_DifferentDayOfWeek_ReturnsFalse()
    {
        // Wednesday vs Thursday
        var date = new DateTime(2025, 1, 2);
        var reference = new DateTime(2025, 1, 1);

        Assert.False(FrequencyExtensions.IsWeeklyMatch(date, reference));
    }

    [Fact]
    public void IsWeeklyMatch_SameDate_ReturnsTrue()
    {
        var date = new DateTime(2025, 1, 1);

        Assert.True(FrequencyExtensions.IsWeeklyMatch(date, date));
    }

    [Fact]
    public void IsFortnightlyMatch_SameDate_ReturnsTrue()
    {
        var date = new DateTime(2025, 1, 1);

        Assert.True(FrequencyExtensions.IsFortnightlyMatch(date, date));
    }

    [Theory]
    [InlineData(14)]
    [InlineData(28)]
    [InlineData(42)]
    public void IsFortnightlyMatch_MultiplesOf14DaysLater_ReturnsTrue(int daysLater)
    {
        var reference = new DateTime(2025, 1, 1);
        var date = reference.AddDays(daysLater);

        Assert.True(FrequencyExtensions.IsFortnightlyMatch(date, reference));
    }

    [Theory]
    [InlineData(7)]
    [InlineData(15)]
    [InlineData(1)]
    [InlineData(13)]
    public void IsFortnightlyMatch_NonMultiplesOf14Days_ReturnsFalse(int daysLater)
    {
        var reference = new DateTime(2025, 1, 1);
        var date = reference.AddDays(daysLater);

        Assert.False(FrequencyExtensions.IsFortnightlyMatch(date, reference));
    }

    [Fact]
    public void IsFortnightlyMatch_14DaysBefore_ReturnsTrue()
    {
        var reference = new DateTime(2025, 1, 15);
        var date = new DateTime(2025, 1, 1);

        Assert.True(FrequencyExtensions.IsFortnightlyMatch(date, reference));
    }

    [Fact]
    public void IsFirstWorkdayOfMonth_FirstDayIsWeekday_ReturnsTrue()
    {
        // Jan 1, 2025 is a Wednesday
        var date = new DateTime(2025, 1, 1);

        Assert.True(FrequencyExtensions.IsFirstWorkdayOfMonth(date));
    }

    [Fact]
    public void IsFirstWorkdayOfMonth_MonthStartsOnSaturday_MondayIsFirstWorkday()
    {
        // Feb 1, 2025 is a Saturday, so Feb 3 (Monday) is the first workday
        var date = new DateTime(2025, 2, 3);

        Assert.True(FrequencyExtensions.IsFirstWorkdayOfMonth(date));
    }

    [Fact]
    public void IsFirstWorkdayOfMonth_SecondDayWhenFirstIsWeekday_ReturnsFalse()
    {
        // Jan 1, 2025 is Wednesday, so Jan 2 is not first workday
        var date = new DateTime(2025, 1, 2);

        Assert.False(FrequencyExtensions.IsFirstWorkdayOfMonth(date));
    }

    [Fact]
    public void IsFirstWorkdayOfMonth_Saturday_ReturnsFalse()
    {
        // Jan 4, 2025 is a Saturday
        var date = new DateTime(2025, 1, 4);

        Assert.False(FrequencyExtensions.IsFirstWorkdayOfMonth(date));
    }

    [Fact]
    public void IsFirstWorkdayOfMonth_Sunday_ReturnsFalse()
    {
        // Jan 5, 2025 is a Sunday
        var date = new DateTime(2025, 1, 5);

        Assert.False(FrequencyExtensions.IsFirstWorkdayOfMonth(date));
    }

    [Fact]
    public void IsFirstWorkdayOfMonth_MonthStartsOnSunday_MondayIsFirstWorkday()
    {
        // June 1, 2025 is a Sunday, so June 2 (Monday) is first workday
        var date = new DateTime(2025, 6, 2);

        Assert.True(FrequencyExtensions.IsFirstWorkdayOfMonth(date));
    }

    [Fact]
    public void IsLastWorkdayOfMonth_LastDayIsWeekday_ReturnsTrue()
    {
        // Jan 31, 2025 is a Friday
        var date = new DateTime(2025, 1, 31);

        Assert.True(FrequencyExtensions.IsLastWorkdayOfMonth(date));
    }

    [Fact]
    public void IsLastWorkdayOfMonth_LastDayIsMonday_ReturnsTrue()
    {
        // March 31, 2025 is a Monday
        var date = new DateTime(2025, 3, 31);

        Assert.True(FrequencyExtensions.IsLastWorkdayOfMonth(date));
    }

    [Fact]
    public void IsLastWorkdayOfMonth_FridayBeforeWeekendEndOfMonth_ReturnsTrue()
    {
        // Aug 29, 2025 is Friday; Aug 30=Sat, Aug 31=Sun
        var date = new DateTime(2025, 8, 29);

        Assert.True(FrequencyExtensions.IsLastWorkdayOfMonth(date));
    }

    [Fact]
    public void IsLastWorkdayOfMonth_NotLastWorkday_ReturnsFalse()
    {
        // March 28, 2025 is a Friday, but March 31 is a Monday (weekday)
        var date = new DateTime(2025, 3, 28);

        Assert.False(FrequencyExtensions.IsLastWorkdayOfMonth(date));
    }

    [Fact]
    public void IsLastWorkdayOfMonth_Saturday_ReturnsFalse()
    {
        // March 29, 2025 is a Saturday
        var date = new DateTime(2025, 3, 29);

        Assert.False(FrequencyExtensions.IsLastWorkdayOfMonth(date));
    }

    [Fact]
    public void IsLastWorkdayOfMonth_Sunday_ReturnsFalse()
    {
        // March 30, 2025 is a Sunday
        var date = new DateTime(2025, 3, 30);

        Assert.False(FrequencyExtensions.IsLastWorkdayOfMonth(date));
    }

    [Fact]
    public void GetNextOccurrenceForSingleFrequency_Weekly_ReturnsNextSameDayOfWeek()
    {
        // Reference is Wednesday Jan 1, 2025; after is also Jan 1
        // Next Wednesday is Jan 8
        var reference = new DateTime(2025, 1, 1);
        var after = new DateTime(2025, 1, 1);

        var result = FrequencyExtensions.GetNextOccurrenceForSingleFrequency(Frequency.Weekly, after, reference);

        Assert.NotNull(result);
        Assert.Equal(new DateTime(2025, 1, 8), result.Value);
    }

    [Fact]
    public void GetNextOccurrenceForSingleFrequency_Fortnightly_Returns14DaysLater()
    {
        var reference = new DateTime(2025, 1, 1);
        var after = new DateTime(2025, 1, 1);

        var result = FrequencyExtensions.GetNextOccurrenceForSingleFrequency(Frequency.Fortnightly, after, reference);

        Assert.NotNull(result);
        Assert.Equal(new DateTime(2025, 1, 15), result.Value);
    }

    [Fact]
    public void GetNextOccurrenceForSingleFrequency_FirstOfMonth_ReturnsFirstOfNextMonth()
    {
        var after = new DateTime(2025, 1, 15);
        var reference = new DateTime(2025, 1, 1);

        var result = FrequencyExtensions.GetNextOccurrenceForSingleFrequency(Frequency.FirstOfMonth, after, reference);

        Assert.NotNull(result);
        Assert.Equal(new DateTime(2025, 2, 1), result.Value);
    }

    [Fact]
    public void GetNextOccurrenceForSingleFrequency_FirstWorkdayOfMonth_ReturnsCorrectDate()
    {
        // After Jan 15, 2025 - next first workday is Feb 3 (Feb 1 is Saturday)
        var after = new DateTime(2025, 1, 15);
        var reference = new DateTime(2025, 1, 1);

        var result = FrequencyExtensions.GetNextOccurrenceForSingleFrequency(Frequency.FirstWorkdayOfMonth, after, reference);

        Assert.NotNull(result);
        Assert.Equal(new DateTime(2025, 2, 3), result.Value);
    }

    [Fact]
    public void GetNextOccurrenceForSingleFrequency_None_ReturnsNull()
    {
        var after = new DateTime(2025, 1, 1);
        var reference = new DateTime(2025, 1, 1);

        var result = FrequencyExtensions.GetNextOccurrenceForSingleFrequency(Frequency.None, after, reference);

        Assert.Null(result);
    }

    [Fact]
    public void GetNextOccurrenceForSingleFrequency_LastWorkdayOfMonth_ReturnsCorrectDate()
    {
        // After Jan 1, 2025 - last workday of Jan is Jan 31 (Friday)
        var after = new DateTime(2025, 1, 1);
        var reference = new DateTime(2025, 1, 1);

        var result = FrequencyExtensions.GetNextOccurrenceForSingleFrequency(Frequency.LastWorkdayOfMonth, after, reference);

        Assert.NotNull(result);
        Assert.Equal(new DateTime(2025, 1, 31), result.Value);
    }
}
