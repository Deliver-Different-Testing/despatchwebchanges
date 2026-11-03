using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Services;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// An AU clear list area is a set of postcodes (ZipPolygon). The NZ path reads Polygon.TblPolygonGps, which AU
/// area rows don't have (PolygonId is null), so AU must not fall into it. Jobs are placed by delivery postcode,
/// since a geocoded AU address never sits exactly on a zip's centre point the way the US match requires.
/// </summary>
public class ClearListEnvelopeServiceAuTests : IAsyncDisposable
{
    private const int AreaId = 10;

    private readonly SqliteTestDatabase _db = new();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private ClearListEnvelopeService CreateService() => new(_db.CreateFactoryMock(), _clock);

    private async Task SeedAreaOfTwoPostcodesAsync()
    {
        await using var context = _db.CreateContext();
        context.ZipPolygons.AddRange(
            new ZipPolygon {ZipPolygonId = 1, Zip = "2000", Latitude = -33.87m, Longitude = 151.21m},
            new ZipPolygon {ZipPolygonId = 2, Zip = "2026", Latitude = -33.89m, Longitude = 151.27m},
            new ZipPolygon {ZipPolygonId = 3, Zip = "3000", Latitude = -37.81m, Longitude = 144.96m});
        context.TblClearListAreas.Add(new TblClearListArea
        {
            ClearListAreaId = AreaId, Code = "SYD", Name = "Sydney", ChannelId = 1, Order = 1,
            Created = TestDates.Now, CreatedBy = "t", LastModified = TestDates.Now, LastModifiedBy = "t"
        });
        context.TblClearListAreaPolygons.AddRange(
            AreaPolygon(1, zipPolygonId: 1), AreaPolygon(2, zipPolygonId: 2));
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private static TblClearListAreaPolygon AreaPolygon(int id, int zipPolygonId) => new()
    {
        ClearListAreaPolygonId = id, ClearListAreaId = AreaId, ZipPolygonId = zipPolygonId, PolygonId = null,
        Created = TestDates.Now, CreatedBy = "t", LastModified = TestDates.Now, LastModifiedBy = "t"
    };

    private static TucCourier Courier(int id, int channelId) => new()
    {
        UccrId = id, UccrChannelId = channelId, Active = true, Code = $"C{id}", UccrName = $"A{id}", UccrSurname = "X", CourierGpsid = id, CourierLogInOutId = id,
        UccrEmail = $"c{id}@t.com", UccrMobile = "1",
        Created = TestDates.Now, CreatedBy = "T", LastModified = TestDates.Now, LastModifiedBy = "T"
    };

    private static TblCourierLogInOut LogIn(int courierId) => new()
    {
        CourierLogInOutId = courierId, CourierId = courierId, LogInTime = TestDates.Now.AddHours(-1),
        Created = TestDates.Now, CreatedBy = "t", LastModified = TestDates.Now, LastModifiedBy = "t",
        Notes = "", AppVersion = "t"
    };

    [Fact]
    public async Task Au_EnvelopeIsTheBoundsOfTheAreasPostcodes()
    {
        await SeedAreaOfTwoPostcodesAsync();
        await using var service = CreateService();

        var result = await service.GetClearListAreaEnvelopeAsync(AreaId, Country.Au);

        Assert.Equal(-33.89m, result.MinimumLatitude);
        Assert.Equal(-33.87m, result.MaximumLatitude);
        Assert.Equal(151.21m, result.MinimumLongitude);
        Assert.Equal(151.27m, result.MaximumLongitude);
    }

    [Fact]
    public async Task Au_UnassignedJobIsInTheEnvelopeByItsDeliveryPostcode_EvenWhenStoredWithTheOldFiveDigitPadding()
    {
        await SeedAreaOfTwoPostcodesAsync();
        await using (var context = _db.CreateContext())
        {
            context.TucJobs.AddRange(
                // delivering to 2000 (padded as 02000), outside the area's own bounds
                new TucJob {UcjbId = 1, UcjbNumber = "J1", DeliveryAddressLine7 = "02000", DeliveryLatitude = -33.80m, DeliveryLongitude = 151.40m},
                // delivering to 3000, which is in no part of this area
                new TucJob {UcjbId = 2, UcjbNumber = "J2", DeliveryAddressLine7 = "3000", DeliveryLatitude = -37.81m, DeliveryLongitude = 144.96m});
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var service = CreateService();

        var result = await service.GetClearListAreaEnvelopeAsync(AreaId, Country.Au, includeCouriers: true);

        Assert.Equal(-33.80m, result.MaximumLatitude);
        Assert.Equal(151.40m, result.MaximumLongitude);
        Assert.Equal(-33.89m, result.MinimumLatitude);   // J2 (Melbourne) did not stretch it
        Assert.Equal(151.21m, result.MinimumLongitude);
    }

    [Fact]
    public async Task Au_LoggedInCourierOnTheAreasChannelWithAJobToItsPostcode_IsInTheEnvelope()
    {
        await SeedAreaOfTwoPostcodesAsync();
        await using (var context = _db.CreateContext())
        {
            context.TucCouriers.AddRange(
                Courier(1, channelId: 1),
                Courier(2, channelId: 2));   // other channel
            context.TblCourierLogInOuts.AddRange(
                LogIn(1), LogIn(2));
            context.TblCourierGps.AddRange(
                new TblCourierGp {CourierGpsid = 1, CourierId = 1, Latitude = -33.50m, Longitude = 151.00m, Created = TestDates.Now, RawData = "x"},
                new TblCourierGp {CourierGpsid = 2, CourierId = 2, Latitude = -30.00m, Longitude = 150.00m, Created = TestDates.Now, RawData = "x"});
            context.TucJobs.AddRange(
                new TucJob {UcjbId = 1, UcjbNumber = "J1", UcjbCourierId = 1, DeliveryAddressLine7 = "2026"},
                new TucJob {UcjbId = 2, UcjbNumber = "J2", UcjbCourierId = 2, DeliveryAddressLine7 = "2026"});
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var service = CreateService();

        var result = await service.GetClearListAreaEnvelopeAsync(AreaId, Country.Au, includeCouriers: true);

        Assert.Equal(-33.50m, result.MaximumLatitude);    // courier 1 stretches it
        Assert.Equal(151.00m, result.MinimumLongitude);
        Assert.Equal(-33.89m, result.MinimumLatitude);    // courier 2 is on another channel
        Assert.Equal(151.27m, result.MaximumLongitude);
    }

    [Fact]
    public async Task Au_UnknownArea_ReturnsAnEmptyEnvelope()
    {
        await using var service = CreateService();

        var result = await service.GetClearListAreaEnvelopeAsync(9999, Country.Au);

        Assert.NotNull(result);
        Assert.Equal(0m, result.MaximumLatitude);
    }
}
