using DespatchWeb.Enums;
using DespatchWeb.Extensions;

namespace DespatchWeb.Tests.Enums;

/// <summary>
/// Unit tests for DaysOfWeekExtensions - tests the ToBinaryString conversion.
/// The binary string format is MTWTFSS (Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday)
/// where each position is '1' if selected or '0' if not.
/// </summary>
public class DaysOfWeekExtensionsTests
{

    [Fact]
    public void ToBinaryString_Monday_Returns1000000()
    {
        var result = DaysOfWeek.Monday.ToBinaryString();
        Assert.Equal("1000000", result);
    }

    [Fact]
    public void ToBinaryString_Tuesday_Returns0100000()
    {
        var result = DaysOfWeek.Tuesday.ToBinaryString();
        Assert.Equal("0100000", result);
    }

    [Fact]
    public void ToBinaryString_Wednesday_Returns0010000()
    {
        var result = DaysOfWeek.Wednesday.ToBinaryString();
        Assert.Equal("0010000", result);
    }

    [Fact]
    public void ToBinaryString_Thursday_Returns0001000()
    {
        var result = DaysOfWeek.Thursday.ToBinaryString();
        Assert.Equal("0001000", result);
    }

    [Fact]
    public void ToBinaryString_Friday_Returns0000100()
    {
        var result = DaysOfWeek.Friday.ToBinaryString();
        Assert.Equal("0000100", result);
    }

    [Fact]
    public void ToBinaryString_Saturday_Returns0000010()
    {
        var result = DaysOfWeek.Saturday.ToBinaryString();
        Assert.Equal("0000010", result);
    }

    [Fact]
    public void ToBinaryString_Sunday_Returns0000001()
    {
        var result = DaysOfWeek.Sunday.ToBinaryString();
        Assert.Equal("0000001", result);
    }

    [Fact]
    public void ToBinaryString_None_Returns0000000()
    {
        var result = DaysOfWeek.None.ToBinaryString();
        Assert.Equal("0000000", result);
    }

    [Fact]
    public void ToBinaryString_Weekdays_Returns1111100()
    {
        var result = DaysOfWeek.Weekdays.ToBinaryString();
        Assert.Equal("1111100", result);
    }

    [Fact]
    public void ToBinaryString_Weekend_Returns0000011()
    {
        var result = DaysOfWeek.Weekend.ToBinaryString();
        Assert.Equal("0000011", result);
    }

    [Fact]
    public void ToBinaryString_All_Returns1111111()
    {
        var result = DaysOfWeek.All.ToBinaryString();
        Assert.Equal("1111111", result);
    }

    [Fact]
    public void ToBinaryString_MondayTuesdayWednesday_Returns1110000()
    {
        const DaysOfWeek days = DaysOfWeek.Monday | DaysOfWeek.Tuesday | DaysOfWeek.Wednesday;
        var result = days.ToBinaryString();
        Assert.Equal("1110000", result);
    }

    [Fact]
    public void ToBinaryString_MondayWednesdayFriday_Returns1010100()
    {
        const DaysOfWeek days = DaysOfWeek.Monday | DaysOfWeek.Wednesday | DaysOfWeek.Friday;
        var result = days.ToBinaryString();
        Assert.Equal("1010100", result);
    }

    [Fact]
    public void ToBinaryString_WeekdaysExceptThursday_Returns1110100()
    {
        // Mon, Tue, Wed, Fri (Thursday unticked)
        const DaysOfWeek days = DaysOfWeek.Monday | DaysOfWeek.Tuesday | DaysOfWeek.Wednesday | DaysOfWeek.Friday;
        var result = days.ToBinaryString();
        Assert.Equal("1110100", result);
    }

    [Theory]
    [InlineData(DaysOfWeek.None)]
    [InlineData(DaysOfWeek.Monday)]
    [InlineData(DaysOfWeek.Weekdays)]
    [InlineData(DaysOfWeek.Weekend)]
    [InlineData(DaysOfWeek.All)]
    public void ToBinaryString_AlwaysReturnsSevenCharacters(DaysOfWeek days)
    {
        var result = days.ToBinaryString();
        Assert.Equal(7, result.Length);
    }

    [Theory]
    [InlineData(DaysOfWeek.None)]
    [InlineData(DaysOfWeek.Monday)]
    [InlineData(DaysOfWeek.All)]
    public void ToBinaryString_OnlyContainsZerosAndOnes(DaysOfWeek days)
    {
        var result = days.ToBinaryString();
        Assert.Matches("^[01]{7}$", result);
    }

    [Fact]
    public void ToBinaryString_TypicalBusinessDays_Returns1111100()
    {
        // Typical Mon-Fri business schedule
        const DaysOfWeek days = DaysOfWeek.Monday | DaysOfWeek.Tuesday | DaysOfWeek.Wednesday |
                                DaysOfWeek.Thursday | DaysOfWeek.Friday;
        var result = days.ToBinaryString();
        Assert.Equal("1111100", result);
    }

    [Fact]
    public void ToBinaryString_MondayWednesdayFridaySchedule_Returns1010100()
    {
        // Alternating day schedule
        const DaysOfWeek days = DaysOfWeek.Monday | DaysOfWeek.Wednesday | DaysOfWeek.Friday;
        var result = days.ToBinaryString();
        Assert.Equal("1010100", result);
    }

    [Fact]
    public void ToBinaryString_TuesdayThursdaySchedule_Returns0101000()
    {
        const DaysOfWeek days = DaysOfWeek.Tuesday | DaysOfWeek.Thursday;
        var result = days.ToBinaryString();
        Assert.Equal("0101000", result);
    }
}
