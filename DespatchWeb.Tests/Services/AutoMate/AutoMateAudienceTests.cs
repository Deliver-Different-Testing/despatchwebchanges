using DespatchWeb.Models;

namespace DespatchWeb.Tests.Services.AutoMate;

public class AutoMateAudienceTests
{
    [Theory]
    [InlineData(1)]
    [InlineData(4)]
    [InlineData(5)]
    public void Internal_Tenant_AndDfrntAdmin_AreStaff_WithNoProfile(int clientTypeId)
    {
        var audience = AutoMateTestEnv.Audience(new ScopeContext(clientTypeId, null, null));

        Assert.True(audience.IsStaff);
        Assert.Null(audience.CspProfile);
    }

    [Theory]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(6)]
    public void CustomersPartnersAndConnectedTenants_AreNotStaff_AndGetTheCustomerProfile(int clientTypeId)
    {
        var audience = AutoMateTestEnv.Audience(new ScopeContext(clientTypeId, 9, null));

        Assert.False(audience.IsStaff);
        Assert.Equal("customer", audience.CspProfile);
    }

    [Fact]
    public void BackgroundContext_UnscopedAndMissingScope_AreNotStaff()
    {
        Assert.False(AutoMateTestEnv.Audience(ScopeContext.BackgroundContext).IsStaff);
        Assert.False(AutoMateTestEnv.Audience(ScopeContext.Unscoped).IsStaff);
        Assert.False(AutoMateTestEnv.Audience(null).IsStaff);
        Assert.Equal("customer", AutoMateTestEnv.Audience(ScopeContext.BackgroundContext).CspProfile);
    }
}
