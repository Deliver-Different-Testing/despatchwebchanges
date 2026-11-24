using DespatchWeb.Helpers;

namespace DespatchWeb.Tests.Helpers;

public class BookedDateTimeTests
{
    private static readonly DateTime BookingPageAnchor = new(1899, 12, 30);

    [Fact]
    public void Split_TimeOnlyChangeOnABookingPageJob_KeepsTheAnchorAndLeavesTheDate()
    {
        var (date, time) = BookedDateTime.Split(new DateTime(2026, 11, 11, 15, 30, 0),
            currentDate: new DateTime(2026, 11, 11), currentTime: BookingPageAnchor.AddHours(14.5));

        Assert.Null(date);
        Assert.Equal(BookingPageAnchor.AddHours(15.5), time);
    }

    [Fact]
    public void Split_DateOnlyChange_LeavesTheTime()
    {
        var (date, time) = BookedDateTime.Split(new DateTime(2026, 11, 12, 14, 30, 0),
            currentDate: new DateTime(2026, 11, 11), currentTime: BookingPageAnchor.AddHours(14.5));

        Assert.Equal(new DateTime(2026, 11, 12), date);
        Assert.Null(time);
    }

    [Fact]
    public void Split_BothChanged_WritesBoth()
    {
        var (date, time) = BookedDateTime.Split(new DateTime(2026, 11, 12, 9, 0, 0),
            currentDate: new DateTime(2026, 11, 11), currentTime: new DateTime(2026, 11, 11, 14, 30, 0));

        Assert.Equal(new DateTime(2026, 11, 12), date);
        Assert.Equal(new DateTime(2026, 11, 12, 9, 0, 0), time);
    }

    [Fact]
    public void Split_DateOnlyChangeWhereTheTimeColumnCarriesARealDate_MovesItsDateToo()
    {
        var (date, time) = BookedDateTime.Split(new DateTime(2026, 11, 12, 14, 30, 0),
            currentDate: new DateTime(2026, 11, 11), currentTime: new DateTime(2026, 11, 11, 14, 30, 0));

        Assert.Equal(new DateTime(2026, 11, 12), date);
        Assert.Equal(new DateTime(2026, 11, 12, 14, 30, 0), time);
    }

    [Fact]
    public void Split_DateColumnCarryingATime_IsNormalisedToMidnight()
    {
        var (date, time) = BookedDateTime.Split(new DateTime(2026, 11, 11, 15, 30, 0),
            currentDate: new DateTime(2026, 11, 11, 15, 30, 0), currentTime: new DateTime(2026, 11, 11, 15, 30, 0));

        Assert.Equal(new DateTime(2026, 11, 11), date);
        Assert.Null(time);
    }

    [Fact]
    public void Split_NoTimeYet_WritesTheTimeOnTheBookedDate()
    {
        var (date, time) = BookedDateTime.Split(new DateTime(2026, 11, 11, 15, 30, 0),
            currentDate: new DateTime(2026, 11, 11), currentTime: null);

        Assert.Null(date);
        Assert.Equal(new DateTime(2026, 11, 11, 15, 30, 0), time);
    }

    [Fact]
    public void Split_Unchanged_WritesNothing_IgnoringSubSecondNoise()
    {
        var (date, time) = BookedDateTime.Split(new DateTime(2026, 11, 11, 14, 30, 0, 500),
            currentDate: new DateTime(2026, 11, 11), currentTime: BookingPageAnchor.AddHours(14.5).AddMilliseconds(3));

        Assert.Null(date);
        Assert.Null(time);
    }

    [Fact]
    public void Split_TruncatesTheNewTimeToWholeSeconds()
    {
        var (_, time) = BookedDateTime.Split(new DateTime(2026, 11, 11, 23, 59, 59, 999),
            currentDate: new DateTime(2026, 11, 11), currentTime: BookingPageAnchor.AddHours(9));

        Assert.Equal(BookingPageAnchor.Add(new TimeSpan(23, 59, 59)), time);
    }
}
