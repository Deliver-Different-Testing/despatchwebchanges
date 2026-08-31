/**
 * Route-level enforcement of the DF-Admin dashboard grant.
 *
 * Hiding a nav item only makes a dashboard undiscoverable — the ui-router state
 * is still reachable by URL. This maps each gated state to its catalogue key so
 * a deep link lands somewhere the session is actually allowed.
 *
 * Backend endpoints keep their own `[Authorize]` gates; this is navigation, not
 * a data boundary.
 */

import {dashboardFeatureKeys, isDashboardVisible, visibleDashboards} from './featureVisibility';

/**
 * ui-router state -> catalogue key. Both variants of a dashboard that has a beta
 * state map to the same key, so opting out of the beta is not a way past the grant.
 * States absent from this map are not gated dashboards.
 */
export const dashboardStateFeatureKeys: Readonly<Record<string, string>> = {
    home: dashboardFeatureKeys.dispatch,
    dispatchV2: dashboardFeatureKeys.dispatch,
    nw: dashboardFeatureKeys.nationwide,
    overview: dashboardFeatureKeys.overview,
    taskDashboard: dashboardFeatureKeys.taskDashboard,
    jobSearch: dashboardFeatureKeys.jobSearch,
    jobSearchV2: dashboardFeatureKeys.jobSearch,
    recurringJobs: dashboardFeatureKeys.recurringJobs,
    courierMap: dashboardFeatureKeys.courierMap,
    driverManagement: dashboardFeatureKeys.driverManagement,
};

/** Landing preference when the requested dashboard is blocked. */
const LANDING_ORDER = [
    'dispatchV2',
    'jobSearch',
    'nw',
    'overview',
    'taskDashboard',
    'recurringJobs',
    'courierMap',
    'driverManagement',
];

/** The first dashboard this session may open, or null when none may be. */
export function firstAllowedDashboardState(): string | null {
    if (visibleDashboards() === null) return LANDING_ORDER[0];
    return LANDING_ORDER.find(state => isDashboardVisible(dashboardStateFeatureKeys[state])) ?? null;
}

/**
 * The state to redirect to instead of `stateName`, or null to let the
 * transition proceed. The redirect target is always an allowed state (or the
 * ungated `forbidden` page), so this cannot loop.
 */
export function resolveDashboardRedirect(stateName: string): string | null {
    const featureKey = dashboardStateFeatureKeys[stateName];
    if (!featureKey || isDashboardVisible(featureKey)) return null;
    return firstAllowedDashboardState() ?? 'forbidden';
}
