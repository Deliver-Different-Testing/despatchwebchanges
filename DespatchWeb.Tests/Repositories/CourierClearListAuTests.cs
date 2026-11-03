using DespatchWeb.Models.Dto;
using DespatchWeb.Repositories;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// AU driver locations are postcode (ZipPolygon) areas: a job sits in the location its delivery postcode belongs to.
/// The US route matches the job's coordinates exactly against a zip's centre point, which a geocoded AU address never is.
/// </summary>
public class CourierClearListAuTests
{
    private static readonly DateTime Now = new(2026, 11, 3, 10, 0, 0);

    private static CourierClearListDto Courier(int channelId = 1) => new()
    {
        UccrId = 1, Code = "C1", UccrChannelId = channelId, AutoDespatch = true
    };

    private static List<SuburbClearListAreaDto> Area(string code, int channelId = 1) =>
        [new() { SuburbId = 0, ClearListAreaId = 10, Code = code, ChannelId = channelId }];

    private static Dictionary<int, List<CourierJobSuburbDto>> Jobs(params string?[] postcodes) =>
        new() { [1] = [.. postcodes.Select(p => new CourierJobSuburbDto { CourierId = 1, DeliveryPostCode = p })] };

    private static string Deliver(
        Dictionary<int, List<CourierJobSuburbDto>> jobs, Dictionary<string, List<SuburbClearListAreaDto>> postcodes) =>
        CourierRepository.BuildClearListResultsInMemory(
            [Courier()], jobs, [], [], isUsTenant: false, Now, postcodes).Single(r => r.CourierId == 1).Deliver;

    [Fact]
    public void JobGoesToTheLocationItsDeliveryPostcodeBelongsTo()
    {
        var lookup = new Dictionary<string, List<SuburbClearListAreaDto>> { ["2000"] = Area("SYD") };

        Assert.Equal("SYD2", Deliver(Jobs("2000", " 2000 "), lookup));
    }

    [Theory]
    [InlineData("02000", "2000")]   // stored with the US 5-digit padding
    [InlineData("00800", "0800")]   // Darwin keeps its own leading zero
    [InlineData(" 2026 ", "2026")]
    [InlineData("2000", "2000")]
    public void StoredPostcodeIsNormalisedToTheFourDigitForm(string stored, string expected)
    {
        Assert.Equal(expected, CourierRepository.NormaliseAuPostcode(stored));
    }

    [Fact]
    public void PaddedPostcodeStillFindsItsLocation()
    {
        var lookup = new Dictionary<string, List<SuburbClearListAreaDto>> { ["2000"] = Area("SYD") };

        Assert.Equal("SYD1", Deliver(Jobs("02000"), lookup));
    }

    [Fact]
    public void PostcodeInNoLocationOrNoPostcode_FallsToOther()
    {
        var lookup = new Dictionary<string, List<SuburbClearListAreaDto>> { ["2000"] = Area("SYD") };

        Assert.Equal("O2", Deliver(Jobs("3000", null), lookup));
    }

    [Fact]
    public void AuWithNoMatchingPostcodeAtAll_IsStillTheAuPath_AndEveryJobIsOther()
    {
        // an empty lookup must not fall back to the NZ suburb path
        var jobs = new Dictionary<int, List<CourierJobSuburbDto>>
        {
            [1] = [new CourierJobSuburbDto {CourierId = 1, ToSuburbId = 5, DeliveryPostCode = "3000"}]
        };
        var suburbLookup = new Dictionary<int, List<SuburbClearListAreaDto>> {[5] = Area("NZA")};

        var result = CourierRepository.BuildClearListResultsInMemory(
            [Courier()], jobs, suburbLookup, [], isUsTenant: false, Now, new Dictionary<string, List<SuburbClearListAreaDto>>());

        Assert.Equal("O1", result.Single(r => r.CourierId == 1).Deliver);
    }

    [Fact]
    public void NzIsUnchanged_NoPostcodeLookup_JobsStillGoBySuburb()
    {
        var jobs = new Dictionary<int, List<CourierJobSuburbDto>>
        {
            [1] = [new CourierJobSuburbDto {CourierId = 1, ToSuburbId = 5, DeliveryPostCode = "2000"}]
        };
        var suburbLookup = new Dictionary<int, List<SuburbClearListAreaDto>> {[5] = Area("NZA")};

        var result = CourierRepository.BuildClearListResultsInMemory(
            [Courier()], jobs, suburbLookup, [], isUsTenant: false, Now);

        Assert.Equal("NZA1", result.Single(r => r.CourierId == 1).Deliver);
    }

    [Fact]
    public void PrefersTheLocationOnTheCouriersChannel()
    {
        var lookup = new Dictionary<string, List<SuburbClearListAreaDto>>
        {
            ["2026"] = [.. Area("EAST", channelId: 2), .. Area("BONDI", channelId: 1)]
        };

        Assert.Equal("BONDI1", Deliver(Jobs("2026"), lookup));
    }
}
