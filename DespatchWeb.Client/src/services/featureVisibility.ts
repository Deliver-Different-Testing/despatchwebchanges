import {getSession} from '../api/session';
/**
 * Which DespatchWeb dashboards the signed-in session may open.
 *
 * Sourced from the session `visibleFeatures`
 * (`GET /api/context`), which the server resolves from the DF-Admin
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
    return getSession().visibleFeatures;
}

/** True when `key` is reachable — always true for an ungated session. */
export function isDashboardVisible(key: string): boolean {
    const granted = visibleDashboards();
    if (granted === null) return true;
    return granted.some(k => k.toLowerCase() === key.toLowerCase());
}
