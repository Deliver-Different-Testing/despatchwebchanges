#nullable enable
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Services;

/// <inheritdoc cref="INetworkPartnerContextService" />
public sealed class NetworkPartnerContextService(
    IDbContextFactory<DespatchContext> contextFactory,
    IScopeProvider scopeProvider) : INetworkPartnerContextService
{
    /// <inheritdoc />
    public async Task<MapCentre?> GetMapCentreAsync()
    {
        var scope = scopeProvider.Scope;
        if (scope?.IsNetworkPartner != true || scope.NpAgentId is not { } npAgentId)
        {
            return null;
        }

        await using var context = await contextFactory.CreateDbContextAsync();

        var coordinates = await context.TucAgents
            .Where(a => a.UcagId == npAgentId)
            .Select(a => new {a.Latitude, a.Longitude})
            .FirstOrDefaultAsync();

        return coordinates is {Latitude: { } latitude, Longitude: { } longitude}
            ? new MapCentre(latitude, longitude)
            : null;
    }
}
