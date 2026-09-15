#nullable enable
using DespatchWeb.EntityClasses;
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

        return _scope = new ScopeContext(clientTypeId, clientId, npAgentId);
    }

    public void Dispose() => _bootstrapContext?.Dispose();
}
