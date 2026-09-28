/**
 * Which DespatchWeb dashboards the signed-in session may open.
 *
 * Sourced from the Razor-rendered `VisibleFeatures` global
 * (`Views/Home/Index.cshtml`), which the server resolves from the DF-Admin
 * feature catalogue — see `IFeatureVisibilityService`. This answers "which
 * dashboards can this user reach"; row-level visibility is a separate question,
 * already answered by the EF global query filters.
 *
 * `null` (or an absent global) means the session is not gated and everything
 * stays reachable. An empty array is a real answer — gated, granted nothing —
 * and must not be confused with the former.
 */

/** The dashboard keys in the catalogue, seeded under `hub-tile-despatchweb`. */
export const dashboardFeatureKeys = {
    dispatch: 'dw-dispatch',
    nationwide: 'dw-nationwide',
    overview: 'dw-overview',
    taskDashboard: 'dw-task-dashboard',
    jobSearch: 'dw-job-search',
    recurringJobs: 'dw-recurring-jobs',
    courierMap: 'dw-courier-map',
    driverManagement: 'dw-driver-management',
} as const;

/** The granted keys, or `null` when this session is not gated. */
export function visibleDashboards(): string[] | null {
    const granted = window.VisibleFeatures;
    // A non-array value can only mean the global was mis-emitted; failing open
    // keeps a serialization bug from taking the nav away from everyone.
    return Array.isArray(granted) ? granted : null;
}

/** True when `key` is reachable — always true for an ungated session. */
export function isDashboardVisible(key: string): boolean {
    const granted = visibleDashboards();
    if (granted === null) return true;
    return granted.some(k => k.toLowerCase() === key.toLowerCase());
}
