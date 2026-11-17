#nullable enable
using DespatchWeb.Enums;

namespace DespatchWeb.Models;

/// <summary>
/// Immutable per-request snapshot of the user's row-level data scope. Built
/// once at request entry by <c>IScopeProvider</c>, read by EF global query
/// filters and any other surface that needs to apply the per-ClientType
/// predicate. Mirrors the spec in
/// <c>docs/CLIENT-TYPE-FILTERING-CURRENT-STATE-2026-06-02.md</c> §
/// "Implementation standard for app teams".
/// </summary>
public sealed record ScopeContext(
    int? ClientTypeId,
    int? ClientId,
    int? NpAgentId,
    bool BypassFilters = false,
    IReadOnlyList<int>? BranchIds = null,
    bool DefaultBranchInScope = false,
    IReadOnlyList<int>? BranchSiteIds = null,
    int? ParentJobCourierId = null)
{
    /// <summary>
    /// Background workers, scaffolding, design-time, or anonymous endpoints —
    /// no auth context at all. Filters short-circuit. Distinct from
    /// <see cref="Unscoped"/>, which represents an authenticated user whose
    /// claims didn't resolve (deny).
    /// </summary>
    public static readonly ScopeContext BackgroundContext =
        new(null, null, null, BypassFilters: true);

    /// <summary>
    /// Authenticated user with no resolvable scope. Filters deny (returns
    /// empty result) per spec §3.2.
    /// </summary>
    public static readonly ScopeContext Unscoped = new(null, null, null);

    public bool IsNetworkPartner => ClientTypeId == (int)ClientType.NetworkPartner;
    public bool IsDfAdmin => ClientTypeId == (int)ClientType.DfrntAdmin;
    public bool IsConnectedTenant => ClientTypeId == (int)ClientType.ConnectedTenant;
    public bool IsTenant => ClientTypeId == (int)ClientType.Tenant;

    /// <summary>
    /// Transitional: ClientTypeId == 1 (Internal). The spec collapses Internal
    /// into Customer scope, but DespatchWeb operations staff still live on
    /// ClientTypeId = 1 until the Phase 1.3 reparent to DFRNTAdmin (5) runs.
    /// Bypassed by EF filters so dispatch keeps working in the meantime.
    /// Remove this property (and its consumer in DespatchContext) once the
    /// reparent migration has shipped.
    /// </summary>
    public bool IsInternal => ClientTypeId == (int)ClientType.Internal;

    // NULL / 2 collapse to Customer scope. Internal (1) is intentionally
    // excluded while the Phase 1.3 reparent is pending — see IsInternal.
    public bool IsCustomerScoped =>
        ClientTypeId is null or (int)ClientType.Customer;

    /// <summary>
    /// Tenant (or transitional Internal) staff limited to some branches (Branches programme, B2). <see cref="BranchIds"/>
    /// is null when the Hub <c>BranchIds</c> claim is empty: no restriction, exactly as before branches existed.
    /// An empty non-null list limits the user to no branch. DF Admin, network partners, customers and background work
    /// are never branch scoped. <see cref="DefaultBranchInScope"/>: a courier or client with no branch belongs to the
    /// default branch (D1), so it counts for a user who holds that branch. <see cref="BranchSiteIds"/>: the <c>tblSite</c>
    /// ids of the user's active branches, matched against a job's pickup and delivery suburbs.
    /// <see cref="ParentJobCourierId"/>: the system courier <c>tblSetting.ParentJobCourierId</c> that split parents are parked
    /// on. It is a placeholder, not a real branch courier, so the courier arm of the job rule ignores it (a split parent is
    /// judged by client, suburbs and its real legs' couriers).
    /// </summary>
    public bool IsBranchScoped =>
        !BypassFilters && (IsTenant || IsInternal) && BranchIds is not null;
}
