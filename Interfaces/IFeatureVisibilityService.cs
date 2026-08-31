#nullable enable
namespace DespatchWeb.Interfaces;

/// <summary>
/// Resolves which DespatchWeb dashboards the current session may open, from the
/// DF-Admin feature catalogue (<c>dbo.Feature</c> x <c>dbo.ClientTypeFeature</c>)
/// that the configurator authors and dbmigrationsv2 seeds into the same tenant
/// database.
///
/// This answers "which dashboards can this user reach", which is a different
/// question from the row-level scope enforced by the EF global query filters in
/// <c>DespatchContext.OnModelCreatingPartial</c>. Both apply.
/// </summary>
public interface IFeatureVisibilityService
{
    /// <summary>
    /// The dashboard feature keys this session may open, or <c>null</c> when the
    /// session is not gated at all and every dashboard stays reachable.
    ///
    /// Only Network Partner sessions are gated in this slice — see
    /// <c>docs/JACOB-NP-DESPATCHWEB-DASHBOARD-VISIBILITY-2026-08-30.md</c>. A
    /// mis-seeded catalogue must not be able to take the nav away from
    /// dispatchers, so every other audience resolves to <c>null</c> until
    /// per-tenant seeding has been verified.
    /// </summary>
    Task<IReadOnlySet<string>?> GetVisibleDashboardsAsync();
}
