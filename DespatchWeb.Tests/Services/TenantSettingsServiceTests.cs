using DespatchWeb.EntityClasses;
using DespatchWeb.Services;
using DespatchWeb.Tests.Helpers;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Tests for TenantSettingsService — read-only access to tenant-wide JSON
/// settings on tblSetting (one row per tenant database).
/// </summary>
public class TenantSettingsServiceTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private TenantSettingsService CreateService() => new(_db.CreateFactoryMock());

    [Fact]
    public async Task GetDispatchAddressFormatDefaultAsync_WhenNotConfigured_ReturnsNull()
    {
        await using (var context = _db.CreateContext())
        {
            context.TblSettings.Add(CreateMinimalSetting());
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }
        var service = CreateService();

        var result = await service.GetDispatchAddressFormatDefaultAsync();

        Assert.Null(result);
    }

    [Fact]
    public async Task GetDispatchAddressFormatDefaultAsync_ReturnsTheStoredJson()
    {
        await using (var context = _db.CreateContext())
        {
            var setting = CreateMinimalSetting();
            setting.DispatchAddressFormatJson = "{\"fields\":[\"streetNumber\",\"streetName\"]}";
            context.TblSettings.Add(setting);
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }
        var service = CreateService();

        var result = await service.GetDispatchAddressFormatDefaultAsync();

        Assert.Equal("{\"fields\":[\"streetNumber\",\"streetName\"]}", result);
    }

    [Fact]
    public async Task GetCourierFlagLastDeliveryDefaultAsync_ReturnsTheStoredModeOrNull()
    {
        await using (var context = _db.CreateContext())
        {
            var setting = CreateMinimalSetting();
            setting.CourierFlagLastDeliveryMode = "locality";
            context.TblSettings.Add(setting);
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }
        var service = CreateService();

        Assert.Equal("locality", await service.GetCourierFlagLastDeliveryDefaultAsync());
    }

    [Theory]
    [InlineData("dispatch", "dispatch")]
    [InlineData("dfrnt", "dfrnt")]
    [InlineData(null, null)]
    [InlineData("", null)]
    [InlineData("sidebar", null)]
    public async Task GetNavStyleDefaultAsync_ReturnsOnlyAKnownStyle(string? stored, string? expected)
    {
        await using (var context = _db.CreateContext())
        {
            var setting = CreateMinimalSetting();
            setting.DespatchNavStyle = stored;
            context.TblSettings.Add(setting);
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }
        var service = CreateService();

        Assert.Equal(expected, await service.GetNavStyleDefaultAsync());
    }

    [Fact]
    public async Task GetAppearanceDefaultAsync_ReturnsTheStoredJson()
    {
        await using (var context = _db.CreateContext())
        {
            var setting = CreateMinimalSetting();
            setting.AppearanceDefaultsJson = "{\"contrast\":\"high\",\"primary\":\"#2a4eff\"}";
            context.TblSettings.Add(setting);
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }
        var service = CreateService();

        Assert.Equal("{\"contrast\":\"high\",\"primary\":\"#2a4eff\"}", await service.GetAppearanceDefaultAsync());
    }

    [Fact]
    public async Task GetAppearanceDefaultAsync_WhenNotConfigured_ReturnsNull()
    {
        await using (var context = _db.CreateContext())
        {
            context.TblSettings.Add(CreateMinimalSetting());
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }
        var service = CreateService();

        Assert.Null(await service.GetAppearanceDefaultAsync());
    }

    private static TblSetting CreateMinimalSetting()
    {
        var setting = TestSettings.Minimal();
        setting.InternetJobChargeType = 0;
        setting.InternetJobStaffId = 0;
        return setting;
    }
}
