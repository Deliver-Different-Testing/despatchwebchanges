using DespatchWeb.Models;
using DespatchWeb.Services;
using Microsoft.EntityFrameworkCore;

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

    private async Task CreateTableAsync(bool withRow)
    {
        await using var context = _db.CreateContext();
        await context.Database.ExecuteSqlRawAsync(
            "CREATE TABLE SignUpPageSettings (SignUpPageSettingsId INTEGER PRIMARY KEY, MapCenterLatitude REAL NOT NULL, MapCenterLongitude REAL NOT NULL)",
            TestContext.Current.CancellationToken);
        if (withRow)
        {
            await context.Database.ExecuteSqlRawAsync(
                "INSERT INTO SignUpPageSettings VALUES (1, -33.8679, 151.2073)", TestContext.Current.CancellationToken);
        }
    }

    [Fact]
    public async Task ReturnsTheTenantsCentre()
    {
        await CreateTableAsync(withRow: true);

        var centre = await new TenantMapCentreService(_db.CreateFactoryMock()).GetMapCentreAsync();

        Assert.Equal(new MapCentre(-33.8679m, 151.2073m), centre);
    }

    [Fact]
    public async Task NoRow_ReturnsNull_SoTheFrontEndKeepsItsDefault()
    {
        await CreateTableAsync(withRow: false);

        Assert.Null(await new TenantMapCentreService(_db.CreateFactoryMock()).GetMapCentreAsync());
    }

    [Fact]
    public async Task NoTable_ReturnsNull()
    {
        Assert.Null(await new TenantMapCentreService(_db.CreateFactoryMock()).GetMapCentreAsync());
    }
}
