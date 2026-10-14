using System.Security.Claims;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Services;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DespatchWeb.Tests.Services;

public class SessionContextServiceTests : IDisposable
{
    private readonly IClientRepository _clients = Substitute.For<IClientRepository>();
    private readonly IFeatureVisibilityService _features = Substitute.For<IFeatureVisibilityService>();
    private readonly INetworkPartnerContextService _np = Substitute.For<INetworkPartnerContextService>();
    private readonly string? _originalHubUrl = Environment.GetEnvironmentVariable("HubUrl");

    public void Dispose() => Environment.SetEnvironmentVariable("HubUrl", _originalHubUrl);

    private SessionContextService CreateSut() => new(_clients, _features, _np);

    private static ClaimsPrincipal User(string contactId = "100", string countryCode = "NZ", string staffId = "7") =>
        new(new ClaimsIdentity(
        [
            new Claim("StaffID", staffId),
            new Claim("ContactID", contactId),
            new Claim("CountryCode", countryCode),
            new Claim("TimeZone", "Pacific/Auckland")
        ], "TestAuth"));

    [Fact]
    public async Task BuildAsync_MapsClientAndClaims()
    {
        Environment.SetEnvironmentVariable("HubUrl", "https://hub.test/");
        _clients.ValidateClientAsync(100).Returns(new ClientViewModel
        {
            FirstName = "Jane", FullName = "Jane Doe", Email = "j@t.com", Internal = true,
            IsNetworkPartner = true, StaffID = 5
        });
        _features.GetVisibleDashboardsAsync().Returns(new HashSet<string> { "dw-dispatch" });
        _np.GetMapCentreAsync().Returns(new MapCentre(-36.8m, 174.7m));

        var dto = await CreateSut().BuildAsync(User());

        Assert.Equal(5, dto.ContactId);
        Assert.Equal(7, dto.StaffId);
        Assert.Equal("Jane", dto.FirstName);
        Assert.Equal("Jane Doe", dto.FullName);
        Assert.Equal("j@t.com", dto.Email);
        Assert.Null(dto.Dispatcher);
        Assert.Equal("Pacific/Auckland", dto.TimeZone);
        Assert.Equal("NZ", dto.CountryCode);
        Assert.True(dto.ClientInternal);
        Assert.True(dto.IsNetworkPartner);
        if (dto.VisibleFeatures != null)
        {
            Assert.Equal(["dw-dispatch"], dto.VisibleFeatures);
        }

        Assert.Equal(new MapCentre(-36.8m, 174.7m), dto.NpMapCenter);
        Assert.Equal("https://hub.test/", dto.HubUrl);
    }

    [Fact]
    public async Task BuildAsync_FallsBackToParsedContactId_WhenNoStaffId()
    {
        _clients.ValidateClientAsync(100).Returns(new ClientViewModel());

        var dto = await CreateSut().BuildAsync(User());

        Assert.Equal(100, dto.ContactId);
    }

    [Theory]
    [InlineData("US", true, "USD")]
    [InlineData("us", true, "USD")]
    [InlineData("NZ", false, "NZD")]
    public async Task BuildAsync_DerivesTenantFlagAndCurrencyFromCountry(string country, bool isUs, string currency)
    {
        _clients.ValidateClientAsync(100).Returns(new ClientViewModel());

        var dto = await CreateSut().BuildAsync(User(countryCode: country));

        Assert.Equal(isUs, dto.IsUsTenant);
        Assert.Equal(currency, dto.CurrencyCode);
    }

    [Fact]
    public async Task BuildAsync_UngatedSession_LeavesVisibleFeaturesNull()
    {
        _clients.ValidateClientAsync(100).Returns(new ClientViewModel());
        _features.GetVisibleDashboardsAsync().Returns((IReadOnlySet<string>?)null);

        var dto = await CreateSut().BuildAsync(User());

        Assert.Null(dto.VisibleFeatures);
    }

    [Fact]
    public async Task BuildAsync_SwallowsFeatureAndMapCentreFailures()
    {
        _clients.ValidateClientAsync(100).Returns(new ClientViewModel());
        _features.GetVisibleDashboardsAsync().ThrowsAsync(new InvalidOperationException("boom"));
        _np.GetMapCentreAsync().ThrowsAsync(new InvalidOperationException("boom"));

        var dto = await CreateSut().BuildAsync(User());

        Assert.Null(dto.VisibleFeatures);
        Assert.Null(dto.NpMapCenter);
    }

    [Fact]
    public async Task BuildAsync_InvalidContactId_Throws()
    {
        await Assert.ThrowsAsync<ArgumentException>(() => CreateSut().BuildAsync(User(contactId: "abc")));
    }

    [Fact]
    public async Task BuildAsync_UnknownContact_Throws()
    {
        _clients.ValidateClientAsync(100).Returns((ClientViewModel)null!);

        await Assert.ThrowsAsync<InvalidOperationException>(() => CreateSut().BuildAsync(User()));
    }
}