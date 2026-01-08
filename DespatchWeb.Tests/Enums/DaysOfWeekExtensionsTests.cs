using DespatchWeb.Enums;
using FluentAssertions;

namespace DespatchWeb.Tests.Enums;

/// <summary>
/// Unit tests for DaysOfWeekExtensions - tests the ToBinaryString conversion.
/// The binary string format is MTWTFSS (Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday)
/// where each position is '1' if selected or '0' if not.
/// </summary>
public class DaysOfWeekExtensionsTests
{
    #region ToBinaryString - Individual Days

    [Fact]
    public void ToBinaryString_Monday_Returns1000000()
    {
        var result = DaysOfWeek.Monday.ToBinaryString();
        result.Should().Be("1000000");
    }

    [Fact]
    public void ToBinaryString_Tuesday_Returns0100000()
    {
        var result = DaysOfWeek.Tuesday.ToBinaryString();
        result.Should().Be("0100000");
    }

    [Fact]
    public void ToBinaryString_Wednesday_Returns0010000()
    {
        var result = DaysOfWeek.Wednesday.ToBinaryString();
        result.Should().Be("0010000");
    }

    [Fact]
    public void ToBinaryString_Thursday_Returns0001000()
    {
        var result = DaysOfWeek.Thursday.ToBinaryString();
        result.Should().Be("0001000");
    }

    [Fact]
    public void ToBinaryString_Friday_Returns0000100()
    {
        var result = DaysOfWeek.Friday.ToBinaryString();
        result.Should().Be("0000100");
    }

    [Fact]
    public void ToBinaryString_Saturday_Returns0000010()
    {
        var result = DaysOfWeek.Saturday.ToBinaryString();
        result.Should().Be("0000010");
    }

    [Fact]
    public void ToBinaryString_Sunday_Returns0000001()
    {
        var result = DaysOfWeek.Sunday.ToBinaryString();
        result.Should().Be("0000001");
    }

    #endregion

    #region ToBinaryString - Combined Days

    [Fact]
    public void ToBinaryString_None_Returns0000000()
    {
        var result = DaysOfWeek.None.ToBinaryString();
        result.Should().Be("0000000");
    }

    [Fact]
    public void ToBinaryString_Weekdays_Returns1111100()
    {
        var result = DaysOfWeek.Weekdays.ToBinaryString();
        result.Should().Be("1111100");
    }

    [Fact]
    public void ToBinaryString_Weekend_Returns0000011()
    {
        var result = DaysOfWeek.Weekend.ToBinaryString();
        result.Should().Be("0000011");
    }

    [Fact]
    public void ToBinaryString_All_Returns1111111()
    {
        var result = DaysOfWeek.All.ToBinaryString();
        result.Should().Be("1111111");
    }

    [Fact]
    public void ToBinaryString_MondayTuesdayWednesday_Returns1110000()
    {
        const DaysOfWeek days = DaysOfWeek.Monday | DaysOfWeek.Tuesday | DaysOfWeek.Wednesday;
        var result = days.ToBinaryString();
        result.Should().Be("1110000");
    }

    [Fact]
    public void ToBinaryString_MondayWednesdayFriday_Returns1010100()
    {
        const DaysOfWeek days = DaysOfWeek.Monday | DaysOfWeek.Wednesday | DaysOfWeek.Friday;
        var result = days.ToBinaryString();
        result.Should().Be("1010100");
    }

    [Fact]
    public void ToBinaryString_WeekdaysExceptThursday_Returns1110100()
    {
        // Mon, Tue, Wed, Fri (Thursday unticked)
        const DaysOfWeek days = DaysOfWeek.Monday | DaysOfWeek.Tuesday | DaysOfWeek.Wednesday | DaysOfWeek.Friday;
        var result = days.ToBinaryString();
        result.Should().Be("1110100");
    }

    #endregion

    #region ToBinaryString - String Length

    [Theory]
    [InlineData(DaysOfWeek.None)]
    [InlineData(DaysOfWeek.Monday)]
    [InlineData(DaysOfWeek.Weekdays)]
    [InlineData(DaysOfWeek.Weekend)]
    [InlineData(DaysOfWeek.All)]
    public void ToBinaryString_AlwaysReturnsSevenCharacters(DaysOfWeek days)
    {
        var result = days.ToBinaryString();
        result.Should().HaveLength(7);
    }

    [Theory]
    [InlineData(DaysOfWeek.None)]
    [InlineData(DaysOfWeek.Monday)]
    [InlineData(DaysOfWeek.All)]
    public void ToBinaryString_OnlyContainsZerosAndOnes(DaysOfWeek days)
    {
        var result = days.ToBinaryString();
        result.Should().MatchRegex("^[01]{7}$");
    }

    #endregion

    #region ToBinaryString - Real World Scenarios

    [Fact]
    public void ToBinaryString_TypicalBusinessDays_Returns1111100()
    {
        // Typical Mon-Fri business schedule
        const DaysOfWeek days = DaysOfWeek.Monday | DaysOfWeek.Tuesday | DaysOfWeek.Wednesday |
                                DaysOfWeek.Thursday | DaysOfWeek.Friday;
        var result = days.ToBinaryString();
        result.Should().Be("1111100");
    }

    [Fact]
    public void ToBinaryString_MondayWednesdayFridaySchedule_Returns1010100()
    {
        // Alternating day schedule
        const DaysOfWeek days = DaysOfWeek.Monday | DaysOfWeek.Wednesday | DaysOfWeek.Friday;
        var result = days.ToBinaryString();
        result.Should().Be("1010100");
    }

    [Fact]
    public void ToBinaryString_TuesdayThursdaySchedule_Returns0101000()
    {
        const DaysOfWeek days = DaysOfWeek.Tuesday | DaysOfWeek.Thursday;
        var result = days.ToBinaryString();
        result.Should().Be("0101000");
    }

    #endregion
}
