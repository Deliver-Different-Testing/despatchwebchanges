using DespatchWeb.Enums;
using DespatchWeb.Models;
using DespatchWeb.Services;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Unit tests for ClearListEnvelopeService - tests validation and routing behavior.
/// </summary>
public class ClearListEnvelopeServiceTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private ClearListEnvelopeService CreateService() => new(
        _db.CreateFactoryMock().Object,
        _clock
    );

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(-100)]
    public async Task GetClearListAreaEnvelopeAsync_InvalidClearListAreaId_ThrowsArgumentException(int invalidId)
    {
        var service = CreateService();

        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => service.GetClearListAreaEnvelopeAsync(invalidId, Country.Nz));

        Assert.Contains("Invalid clearListAreaId", ex.Message);
    }

    [Fact]
    public async Task GetClearListAreaEnvelopeAsync_InvalidCountry_ThrowsArgumentException()
    {
        var service = CreateService();
        const Country invalidCountry = (Country)999;

        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => service.GetClearListAreaEnvelopeAsync(1, invalidCountry));

        Assert.Contains("Invalid country", ex.Message);
    }

    [Fact]
    public async Task GetClearListAreaEnvelopeAsync_Nz_RoutesToNzLogic()
    {
        var service = CreateService();

        var result = await service.GetClearListAreaEnvelopeAsync(1, Country.Nz);

        Assert.NotNull(result);
        Assert.IsType<ClearListEnvelopeViewModel>(result);
    }

    [Fact]
    public async Task GetClearListAreaEnvelopeAsync_Us_RoutesToUsLogic()
    {
        var service = CreateService();

        var result = await service.GetClearListAreaEnvelopeAsync(1, Country.Us);

        Assert.NotNull(result);
        Assert.IsType<ClearListEnvelopeViewModel>(result);
    }

    [Fact]
    public async Task GetClearListAreaEnvelopeAsync_NonExistingArea_ReturnsDefaultEnvelope()
    {
        var service = CreateService();

        var result = await service.GetClearListAreaEnvelopeAsync(9999, Country.Nz);

        Assert.Equal(0m, result.MinimumLongitude);
        Assert.Equal(0m, result.MinimumLatitude);
        Assert.Equal(0m, result.MaximumLongitude);
        Assert.Equal(0m, result.MaximumLatitude);
    }
}
