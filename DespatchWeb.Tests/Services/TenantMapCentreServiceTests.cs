using DespatchWeb.EntityClasses;
using DespatchWeb.Models;
using DespatchWeb.Services;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// An AU tenant's maps open on its own centre (SignUpPageSettings, the same row Booking's /MapCenter serves)
/// instead of Auckland. The table is new and has no row until someone adds one.
/// </summary>
public class TenantMapCentreServiceTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private async Task SeedAsync(decimal lat, decimal lng)
    {
        await using var context = _db.CreateContext();
        context.SignUpPageSettings.Add(new SignUpPageSetting
        {
            SignUpPageSettingsId = 1, MapCenterLatitude = lat, MapCenterLongitude = lng
        });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task ReturnsTheTenantsCentre()
    {
        await SeedAsync(-33.8679m, 151.2073m);

        var centre = await new TenantMapCentreService(_db.CreateFactoryMock()).GetMapCentreAsync();

        Assert.Equal(new MapCentre(-33.8679m, 151.2073m), centre);
    }

    [Fact]
    public async Task NoRow_ReturnsNull_SoTheFrontEndKeepsItsDefault()
    {
        Assert.Null(await new TenantMapCentreService(_db.CreateFactoryMock()).GetMapCentreAsync());
    }

    [Fact]
    public async Task RowStillOnTheAucklandColumnDefaults_ReturnsNull_SoAnAuTenantDoesNotOpenOnAuckland()
    {
        await SeedAsync(-36.850657m, 174.76466m);

        Assert.Null(await new TenantMapCentreService(_db.CreateFactoryMock()).GetMapCentreAsync());
    }
}
