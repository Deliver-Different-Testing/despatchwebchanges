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
            ? new ClaimsIdentity([new Claim(ClaimTypes.Name, "test")], "TestAuth")
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

    // ---- Branches programme: tenant staff limited by the BranchIds claim ----

    private void StubBranches(params int[]? branchIds) =>
        _tenantInfo.GetBranchIds().Returns(branchIds);

    private void SeedBranches(params TblBranch[] branches)
    {
        using var seed = _db.CreateContext();
        seed.TblBranches.AddRange(branches);
        seed.SaveChanges();
    }

    private static TblBranch Branch(int id, string code, int? siteId, bool isDefault = false, bool active = true) =>
        new() { BranchId = id, Name = code, Code = code, SiteId = siteId, IsDefault = isDefault, Active = active };

    private void SignInAs(ClientType type, int? clientId = 1)
    {
        SetAuthenticated(true);
        StubClaims((int)type, false, null, false, true, clientId);
    }

    [Fact]
    public void TenantStaff_WithNoBranchClaim_IsNotBranchScoped()
    {
        SignInAs(ClientType.Tenant);
        StubBranches(null);

        var scope = CreateProvider().Scope;

        Assert.False(scope.IsBranchScoped);
        Assert.Null(scope.BranchIds);
    }

    [Fact]
    public void TenantStaff_WithBranches_IsBranchScoped_WithTheirIdsSitesAndDefaultFlag()
    {
        SeedBranches(Branch(1, "SYD", 43, isDefault: true), Branch(2, "MEL", 44), Branch(3, "BNE", 45));
        SignInAs(ClientType.Tenant);
        StubBranches(2, 1);

        var scope = CreateProvider().Scope;

        Assert.True(scope.IsBranchScoped);
        Assert.Equal([2, 1], scope.BranchIds);
        Assert.True(scope.DefaultBranchInScope);
        Assert.Equal([43, 44], scope.BranchSiteIds!.Order());   // Brisbane is not theirs
    }

    [Fact]
    public void TenantStaff_WithBranches_CarriesTheConfiguredParentJobCourier()
    {
        // The courier split parents are parked on: a placeholder the job rule's courier arm must ignore.
        SeedBranches(Branch(1, "SYD", 43, isDefault: true), Branch(2, "MEL", 44));
        using (var seed = _db.CreateContext())
        {
            seed.TblSettings.Add(TestSettings.Minimal(parentJobCourierId: 4));
            seed.SaveChanges();
        }

        SignInAs(ClientType.Tenant);
        StubBranches(1);

        var scope = CreateProvider().Scope;

        Assert.Equal(4, scope.ParentJobCourierId);
    }

    [Fact]
    public void TenantStaff_WithBranches_HasNoParentJobCourier_WhenNoneIsConfigured()
    {
        SeedBranches(Branch(1, "SYD", 43, isDefault: true));
        SignInAs(ClientType.Tenant);
        StubBranches(1);

        Assert.Null(CreateProvider().Scope.ParentJobCourierId);
    }

    [Fact]
    public void TenantStaff_WithoutTheDefaultBranch_DoesNotGetDefaultBranchRows()
    {
        SeedBranches(Branch(1, "SYD", 43, isDefault: true), Branch(2, "MEL", 44));
        SignInAs(ClientType.Tenant);
        StubBranches(2);

        var scope = CreateProvider().Scope;

        Assert.False(scope.DefaultBranchInScope);
        Assert.Equal([44], scope.BranchSiteIds);
    }

    [Fact]
    public void AnInactiveBranch_ContributesNoSite_ButStillCountsAsTheirs()
    {
        SeedBranches(Branch(1, "SYD", 43, isDefault: true), Branch(2, "MEL", 44, active: false));
        SignInAs(ClientType.Tenant);
        StubBranches(1, 2);

        var scope = CreateProvider().Scope;

        Assert.Equal([1, 2], scope.BranchIds);
        Assert.Equal([43], scope.BranchSiteIds);
    }

    [Fact]
    public void ABranchWithNoSite_ContributesNoSite()
    {
        SeedBranches(Branch(1, "SYD", null, isDefault: true));
        SignInAs(ClientType.Tenant);
        StubBranches(1);

        Assert.Empty(CreateProvider().Scope.BranchSiteIds!);
    }

    [Fact]
    public void AnEmptyBranchList_IsBranchScoped_ToNothing_FailingClosed()
    {
        SignInAs(ClientType.Tenant);
        StubBranches([]);

        var scope = CreateProvider().Scope;

        Assert.True(scope.IsBranchScoped);
        Assert.Empty(scope.BranchIds!);
        Assert.False(scope.DefaultBranchInScope);
        Assert.Empty(scope.BranchSiteIds!);
    }

    [Fact]
    public void TransitionalInternalStaff_CanBeBranchScoped_Too()
    {
        SeedBranches(Branch(1, "SYD", 43, isDefault: true));
        SignInAs(ClientType.Internal);
        StubBranches(1);

        Assert.True(CreateProvider().Scope.IsBranchScoped);
    }

    [Theory]
    [InlineData(ClientType.DfrntAdmin)]
    [InlineData(ClientType.NetworkPartner)]
    [InlineData(ClientType.Customer)]
    public void NobodyElse_IsEverBranchScoped_EvenWithTheClaim(ClientType type)
    {
        SignInAs(type);
        StubBranches(1, 2);

        var scope = CreateProvider().Scope;

        Assert.False(scope.IsBranchScoped);
        Assert.Null(scope.BranchIds);
    }

    [Fact]
    public void BackgroundWork_IsNeverBranchScoped()
    {
        SetAuthenticated(false);
        StubBranches(1);

        var scope = CreateProvider().Scope;

        Assert.True(scope.BypassFilters);
        Assert.False(scope.IsBranchScoped);
    }

    [Fact]
    public void WhenTheBranchLookupFails_TheUserStaysBranchScoped_WithoutDefaultOrSiteMatching()
    {
        SignInAs(ClientType.Tenant);
        StubBranches(1);
        var failing = Substitute.For<IDbContextFactory<DespatchContext>>();
        failing.CreateDbContext().Returns(_ => throw new InvalidOperationException("database down"));

        var scope = new ScopeProvider(_httpContextAccessor, _tenantInfo, failing).Scope;

        Assert.True(scope.IsBranchScoped);   // a failure narrows what they see, it never widens it
        Assert.False(scope.DefaultBranchInScope);
        Assert.Empty(scope.BranchSiteIds!);
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
    public void Internal_ResolvesToInternalScope_NotCustomerScoped()
    {
        // Transitional: Internal (ClientTypeId = 1) is bypassed by EF filters
        // (treated like Tenant / DFRNTAdmin) until the Phase 1.3 reparent ships,
        // so it must NOT fall into the customer-side ClientId predicate branch.
        SetAuthenticated(true);
        StubClaims(
            clientTypeId: (int)ClientType.Internal,
            clientTypeIdAbsent: false,
            npAgentId: null,
            npAgentIdAbsent: false,
            npAgentIdEmpty: true,
            clientId: 100);

        var scope = CreateProvider().Scope;

        Assert.True(scope.IsInternal);
        Assert.False(scope.IsCustomerScoped);
        Assert.False(scope.IsNetworkPartner);
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