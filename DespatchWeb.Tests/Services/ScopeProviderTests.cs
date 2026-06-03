using System.Security.Claims;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Unit tests for <see cref="ScopeProvider"/>. Covers claim-first resolution,
/// the transitional pre-2026-06-03 tucClient fallback, and the strict
/// empty-vs-absent NpAgentId distinction per spec §3.3 / §3.4.
/// </summary>
public class ScopeProviderTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly IHttpContextAccessor _httpContextAccessor = Substitute.For<IHttpContextAccessor>();
    private readonly ITenantInfoService _tenantInfo = Substitute.For<ITenantInfoService>();

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private ScopeProvider CreateProvider() =>
        new(_httpContextAccessor, _tenantInfo, _db.CreateFactoryMock());

    private void SetAuthenticated(bool authenticated)
    {
        var identity = authenticated
            ? new ClaimsIdentity(new[] { new Claim(ClaimTypes.Name, "test") }, "TestAuth")
            : new ClaimsIdentity();
        var principal = new ClaimsPrincipal(identity);
        var httpContext = new DefaultHttpContext { User = principal };
        _httpContextAccessor.HttpContext.Returns(httpContext);
    }

    private static TucClient BuildClient(int npAgentId) => new()
    {
        UcclId = 100,
        UcclName = "Test",
        UcclLegalName = "Test Legal",
        Smsname = "T",
        UcclCode = "T",
        UcclAddress = "1 St",
        UcclExtraAddress = "",
        UcclPostal = "",
        UcclPostCode = "0",
        UcclPhone = "",
        UcclPhone2 = "",
        UcclMobile = "",
        UcclFax = "",
        UcclType = "",
        Created = TestDates.Now,
        CreatedBy = "T",
        LastModified = TestDates.Now,
        LastModifiedBy = "T",
        ClientTypeId = (int)ClientType.NetworkPartner,
        NpAgentId = npAgentId
    };

    private void StubClaims(
        int? clientTypeId,
        bool clientTypeIdAbsent,
        int? npAgentId,
        bool npAgentIdAbsent,
        bool npAgentIdEmpty,
        int? clientId)
    {
        _tenantInfo.GetClientTypeId().Returns(clientTypeId);
        _tenantInfo.ClientTypeIdClaimAbsent.Returns(clientTypeIdAbsent);
        _tenantInfo.GetNpAgentId().Returns(npAgentId);
        _tenantInfo.NpAgentIdClaimAbsent.Returns(npAgentIdAbsent);
        _tenantInfo.NpAgentIdClaimEmpty.Returns(npAgentIdEmpty);
        _tenantInfo.GetClientId().Returns(clientId);
    }

    [Fact]
    public void Unauthenticated_ReturnsBackgroundContext_BypassFiltersTrue()
    {
        SetAuthenticated(false);

        var scope = CreateProvider().Scope;

        Assert.True(scope.BypassFilters);
        Assert.Null(scope.ClientTypeId);
    }

    [Fact]
    public void NoHttpContext_ReturnsBackgroundContext()
    {
        _httpContextAccessor.HttpContext.Returns((HttpContext?)null);

        var scope = CreateProvider().Scope;

        Assert.True(scope.BypassFilters);
    }

    [Fact]
    public void NpUser_WithValidClaims_ResolvesToNpScope()
    {
        SetAuthenticated(true);
        StubClaims(
            clientTypeId: (int)ClientType.NetworkPartner,
            clientTypeIdAbsent: false,
            npAgentId: 42,
            npAgentIdAbsent: false,
            npAgentIdEmpty: false,
            clientId: 100);

        var scope = CreateProvider().Scope;

        Assert.True(scope.IsNetworkPartner);
        Assert.Equal(42, scope.NpAgentId);
        Assert.Equal(100, scope.ClientId);
        Assert.False(scope.BypassFilters);
    }

    [Fact]
    public void NpUser_EmptyNpAgentIdClaim_NpAgentIdNull_NoDbFallback()
    {
        // Spec §3.3 — empty string is Hub-authoritative "no NP linkage".
        SetAuthenticated(true);
        StubClaims(
            clientTypeId: (int)ClientType.NetworkPartner,
            clientTypeIdAbsent: false,
            npAgentId: null,
            npAgentIdAbsent: false,
            npAgentIdEmpty: true,
            clientId: 100);

        // Seed a tucClient with a real NpAgentId — verifies provider does NOT
        // fall back to DB on empty claim.
        using (var seed = _db.CreateContext())
        {
            seed.TucClients.Add(BuildClient(npAgentId: 999));
            seed.SaveChanges();
        }

        var scope = CreateProvider().Scope;

        Assert.True(scope.IsNetworkPartner);
        Assert.Null(scope.NpAgentId);
    }

    [Fact]
    public void TransitionalFallback_ClientTypeClaimAbsent_LooksUpTucClient()
    {
        // Spec §3.4 — pre-2026-06-03 cookies carry ClientID but not the
        // newer ClientTypeId / NpAgentId claims. Provider must hydrate from DB.
        SetAuthenticated(true);
        StubClaims(
            clientTypeId: null,
            clientTypeIdAbsent: true,
            npAgentId: null,
            npAgentIdAbsent: true,
            npAgentIdEmpty: false,
            clientId: 100);

        using (var seed = _db.CreateContext())
        {
            seed.TucClients.Add(BuildClient(npAgentId: 42));
            seed.SaveChanges();
        }

        var scope = CreateProvider().Scope;

        Assert.True(scope.IsNetworkPartner);
        Assert.Equal(42, scope.NpAgentId);
        Assert.Equal(100, scope.ClientId);
    }

    [Fact]
    public void TransitionalFallback_NoTucClientRow_StaysUnscoped()
    {
        SetAuthenticated(true);
        StubClaims(
            clientTypeId: null,
            clientTypeIdAbsent: true,
            npAgentId: null,
            npAgentIdAbsent: true,
            npAgentIdEmpty: false,
            clientId: 12345); // not in seed

        var scope = CreateProvider().Scope;

        Assert.Null(scope.ClientTypeId);
        Assert.False(scope.BypassFilters);
        Assert.Equal(12345, scope.ClientId);
    }

    [Fact]
    public void TransitionalFallback_NoClientIdAtAll_StaysBackground()
    {
        SetAuthenticated(true);
        StubClaims(
            clientTypeId: null,
            clientTypeIdAbsent: true,
            npAgentId: null,
            npAgentIdAbsent: true,
            npAgentIdEmpty: false,
            clientId: null);

        var scope = CreateProvider().Scope;

        // No identity → resolves as authenticated-but-unscoped Customer.
        Assert.True(scope.IsCustomerScoped);
        Assert.Null(scope.ClientId);
    }

    [Fact]
    public void DfAdmin_ResolvesToDfAdminScope()
    {
        SetAuthenticated(true);
        StubClaims(
            clientTypeId: (int)ClientType.DfrntAdmin,
            clientTypeIdAbsent: false,
            npAgentId: null,
            npAgentIdAbsent: false,
            npAgentIdEmpty: true,
            clientId: 100);

        var scope = CreateProvider().Scope;

        Assert.True(scope.IsDfAdmin);
        Assert.False(scope.IsNetworkPartner);
    }

    [Fact]
    public void Tenant_ResolvesToTenantScope()
    {
        SetAuthenticated(true);
        StubClaims(
            clientTypeId: (int)ClientType.Tenant,
            clientTypeIdAbsent: false,
            npAgentId: null,
            npAgentIdAbsent: false,
            npAgentIdEmpty: true,
            clientId: 100);

        var scope = CreateProvider().Scope;

        Assert.True(scope.IsTenant);
        Assert.False(scope.IsCustomerScoped);
    }

    [Fact]
    public void ConnectedTenant_ResolvesToConnectedTenantScope()
    {
        SetAuthenticated(true);
        StubClaims(
            clientTypeId: (int)ClientType.ConnectedTenant,
            clientTypeIdAbsent: false,
            npAgentId: null,
            npAgentIdAbsent: false,
            npAgentIdEmpty: true,
            clientId: 100);

        var scope = CreateProvider().Scope;

        Assert.True(scope.IsConnectedTenant);
        // ConnectedTenant should never reach here — middleware rejects at boundary —
        // but defence in depth: scope.BypassFilters is false so EF filters deny.
        Assert.False(scope.BypassFilters);
    }

    [Fact]
    public void Customer_ResolvesToCustomerScope()
    {
        SetAuthenticated(true);
        StubClaims(
            clientTypeId: (int)ClientType.Customer,
            clientTypeIdAbsent: false,
            npAgentId: null,
            npAgentIdAbsent: false,
            npAgentIdEmpty: true,
            clientId: 100);

        var scope = CreateProvider().Scope;

        Assert.True(scope.IsCustomerScoped);
        Assert.Equal(100, scope.ClientId);
    }

    [Fact]
    public void Scope_AccessedMultipleTimes_ResolvesOnce()
    {
        SetAuthenticated(true);
        StubClaims(
            clientTypeId: (int)ClientType.NetworkPartner,
            clientTypeIdAbsent: false,
            npAgentId: 42,
            npAgentIdAbsent: false,
            npAgentIdEmpty: false,
            clientId: 100);

        var provider = CreateProvider();
        var a = provider.Scope;
        var b = provider.Scope;

        Assert.Same(a, b);
        _tenantInfo.Received(1).GetClientTypeId();
    }
}
