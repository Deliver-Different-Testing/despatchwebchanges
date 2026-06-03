using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Services;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

public class NpScopeProviderTests
{
    private readonly ITenantInfoService _tenantInfo = Substitute.For<ITenantInfoService>();

    private NpScopeProvider CreateProvider() => new(_tenantInfo);

    [Fact]
    public void NpAgentId_WhenClientTypeIsNetworkPartner_AndAgentClaimSet_ReturnsAgentId()
    {
        _tenantInfo.GetClientTypeId().Returns((int)ClientType.NetworkPartner);
        _tenantInfo.GetNpAgentId().Returns(77);

        Assert.Equal(77, CreateProvider().NpAgentId);
    }

    [Theory]
    [InlineData(ClientType.Internal)]
    [InlineData(ClientType.Customer)]
    public void NpAgentId_WhenClientTypeIsNotNetworkPartner_ReturnsNull(ClientType clientType)
    {
        // Even when an NpAgentId happens to be on the claim, a non-NP ClientType
        // gates it to null. Mirrors the legacy DB query's
        // "ClientTypeId == NetworkPartner AND NpAgentId IS NOT NULL" guard.
        _tenantInfo.GetClientTypeId().Returns((int)clientType);
        _tenantInfo.GetNpAgentId().Returns(77);

        Assert.Null(CreateProvider().NpAgentId);
    }

    [Fact]
    public void NpAgentId_WhenNpClientHasNoLinkedAgent_ReturnsNull()
    {
        _tenantInfo.GetClientTypeId().Returns((int)ClientType.NetworkPartner);
        _tenantInfo.GetNpAgentId().Returns((int?)null);

        Assert.Null(CreateProvider().NpAgentId);
    }

    [Fact]
    public void NpAgentId_WhenNoClientTypeClaim_ReturnsNull()
    {
        // Pre-claim sessions / couriers don't carry ClientTypeId. Gate stays closed.
        _tenantInfo.GetClientTypeId().Returns((int?)null);
        _tenantInfo.GetNpAgentId().Returns(77);

        Assert.Null(CreateProvider().NpAgentId);
    }
}
