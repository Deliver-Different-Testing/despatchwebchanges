#nullable enable
using DespatchWeb.Constants;
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Services;

/// <summary>
/// Reads the DF-Admin feature catalogue in-process. The rule mirrors the
/// configurator's <c>ClientTypeFeatureResolver</c> — the two live in separate
/// repos against the same tables, so any change to the predicate below belongs
/// in both.
/// </summary>
public sealed class FeatureVisibilityService(
    IDbContextFactory<DespatchContext> contextFactory,
    IScopeProvider scopeProvider) : IFeatureVisibilityService
{
    /// <inheritdoc />
    public async Task<IReadOnlySet<string>?> GetVisibleDashboardsAsync()
    {
        var scope = scopeProvider.Scope;

        if (scope is null || !IsGated(scope.ClientTypeId))
        {
            return null;
        }

        await using var context = await contextFactory.CreateDbContextAsync();

        var visible = await (
                from feature in context.Features
                join grant in context.ClientTypeFeatures
                    on feature.FeatureKey equals grant.FeatureKey
                where feature.ParentKey == DashboardFeatureKeys.DespatchWebTile
                      && feature.ClientVisible
                      && feature.ReleaseStatus == DashboardFeatureKeys.LiveReleaseStatus
                      && grant.ClientTypeId == scope.ClientTypeId
                      && grant.Visible
                select feature.FeatureKey)
            .Distinct()
            .ToListAsync();

        return visible.ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Which audiences the gate applies to. Network Partner only for now; widen
    /// this once each tenant's catalogue has been verified, and the rest of the
    /// service needs no change.
    /// </summary>
    private static bool IsGated(int? clientTypeId) =>
        clientTypeId == (int)Enums.ClientType.NetworkPartner;
}
