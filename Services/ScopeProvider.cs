#nullable enable
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DespatchWeb.Services;

/// <summary>
/// Resolves <see cref="ScopeContext"/> once per request from Hub-issued
/// claims. Claim-first; falls back to a single <c>tucClient</c> lookup keyed
/// off the legacy <c>ClientID</c> claim when the newer
/// <c>ClientTypeId</c> / <c>NpAgentId</c> claims are absent
/// (pre-2026-06-03 cookies). Empty-string <c>NpAgentId</c> is Hub-authoritative
/// "no NP linkage" — no DB call, and the filters deny. Unauthenticated /
/// background scenarios resolve to <see cref="ScopeContext.BackgroundContext"/>
/// so filters short-circuit.
/// </summary>
public sealed class ScopeProvider(
    IHttpContextAccessor contextAccessor,
    ITenantInfoService tenantInfo,
    IDbContextFactory<DespatchContext> contextFactory) : IScopeProvider, IDisposable
{
    private ScopeContext? _scope;
    private bool _resolved;
    private DespatchContext? _bootstrapContext;

    public ScopeContext Scope
    {
        get
        {
            if (_resolved)
            {
                return _scope!;
            }

            _scope = Resolve();
            return _scope;
        }
    }

    private ScopeContext Resolve()
    {
        // Set _resolved first so any recursive Scope access during the
        // bootstrap DB lookup (via the global query filter expressions)
        // returns BackgroundContext (bypass) instead of re-entering Resolve.
        _resolved = true;
        _scope = ScopeContext.BackgroundContext;

        var isAuthenticated = contextAccessor.HttpContext?.User.Identity?.IsAuthenticated ?? false;
        if (!isAuthenticated)
        {
            // No auth: background worker, scaffolding, anonymous endpoint.
            // Filters bypass.
            return _scope;
        }

        var clientTypeId = tenantInfo.GetClientTypeId();
        var clientId = tenantInfo.GetClientId();
        var npAgentId = tenantInfo.GetNpAgentId();

        var clientTypeAbsent = tenantInfo.ClientTypeIdClaimAbsent;
        var npAgentAbsent = tenantInfo.NpAgentIdClaimAbsent;
        var npAgentEmpty = tenantInfo.NpAgentIdClaimEmpty;

        // transitional — fall back to tucClient lookup only when the newer
        // claims are entirely absent. Remove once every Hub session has
        // refreshed (per spec §3.4).
        if (clientTypeAbsent && clientId.HasValue)
        {
            try
            {
                _bootstrapContext ??= contextFactory.CreateDbContext();
                var row = _bootstrapContext.TucClients
                    .IgnoreQueryFilters()
                    .Where(c => c.UcclId == clientId.Value)
                    .Select(c => new { c.ClientTypeId, c.NpAgentId })
                    .FirstOrDefault();
                if (row != null)
                {
                    clientTypeId = row.ClientTypeId;
                    if (npAgentAbsent)
                    {
                        npAgentId = row.NpAgentId;
                    }
                }
            }
            catch (Exception ex)
            {
                Log.Warning(ex,
                    "ScopeProvider transitional tucClient lookup failed for ClientID={ClientId}. Falling back to Unscoped (deny)",
                    clientId.Value);
            }
        }

        // Spec §3.3 — empty NpAgentId claim is "no NP linkage". Never substitute
        // a DB value here, even if the bootstrap branch found one (which it
        // shouldn't, given empty-string and absent are now distinct).
        if (npAgentEmpty)
        {
            npAgentId = null;
        }

        // Branches programme (B2): only tenant (and transitional Internal) staff can be branch-limited, and only by a
        // non-empty BranchIds claim. Everyone else (customers, network partners, DF Admin) is never branch scoped.
        var branchIds = clientTypeId is (int)ClientType.Tenant or (int)ClientType.Internal
            ? tenantInfo.GetBranchIds()
            : null;

        if (branchIds is null)
        {
            return _scope = new ScopeContext(clientTypeId, clientId, npAgentId);
        }

        var (defaultBranchInScope, siteIds, parentJobCourierId) = LookUpBranches(branchIds);
        return _scope = new ScopeContext(clientTypeId, clientId, npAgentId,
            BranchIds: branchIds,
            DefaultBranchInScope: defaultBranchInScope,
            BranchSiteIds: siteIds,
            ParentJobCourierId: parentJobCourierId);
    }

    // One tblBranch read per request, only for branch-limited users: whether the default branch is one of theirs (a
    // courier or client with no branch belongs to it, D1) and the sites of their ACTIVE branches (a job is theirs when a
    // pickup or delivery suburb sits on one). If the lookup fails the user keeps only the client and courier arms, so a
    // failure narrows what they see rather than widening it.
    //
    // The same read also fetches the system courier split parents are parked on (tblSetting.ParentJobCourierId): it is a
    // placeholder with no real branch, and the job rule's courier arm must not count it.
    private (bool DefaultBranchInScope, IReadOnlyList<int> SiteIds, int? ParentJobCourierId) LookUpBranches(IReadOnlyList<int> branchIds)
    {
        if (branchIds.Count == 0)
        {
            return (false, [], null);
        }

        try
        {
            _bootstrapContext ??= contextFactory.CreateDbContext();
            var ids = branchIds.ToArray();
            var rows = _bootstrapContext.TblBranches
                .Where(b => b.IsDefault || ids.Contains(b.BranchId))
                .Select(b => new { b.BranchId, b.IsDefault, b.Active, b.SiteId })
                .ToList();
            var defaultInScope = rows.Any(b => b.IsDefault && ids.Contains(b.BranchId));
            int[] siteIds =
            [
                .. rows.Where(b => b.Active && b.SiteId != null && ids.Contains(b.BranchId))
                    .Select(b => b.SiteId!.Value)
                    .Distinct()
            ];
            var parentJobCourierId = _bootstrapContext.TblSettings
                .Where(s => s.SettingId == 1)
                .Select(s => s.ParentJobCourierId)
                .FirstOrDefault();
            return (defaultInScope, siteIds, parentJobCourierId);
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "ScopeProvider branch lookup failed. Default-branch matching and address matching are off for this request");
            return (false, [], null);
        }
    }

    public void Dispose() => _bootstrapContext?.Dispose();
}
