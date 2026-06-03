#nullable enable
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;

namespace DespatchWeb.Services;

public sealed class NpScopeProvider(ITenantInfoService tenantInfo) : INpScopeProvider
{
    public int? NpAgentId =>
        tenantInfo.GetClientTypeId() == (int)ClientType.NetworkPartner
            ? tenantInfo.GetNpAgentId()
            : null;
}