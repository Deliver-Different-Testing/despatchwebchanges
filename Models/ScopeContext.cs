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
    bool BypassFilters = false)
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

    // NULL / 1 / 2 collapse to Customer scope per spec §"Data scope per ClientType".
    public bool IsCustomerScoped =>
        ClientTypeId is null
            or (int)ClientType.Internal
            or (int)ClientType.Customer;
}
