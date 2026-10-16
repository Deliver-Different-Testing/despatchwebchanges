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

import {isDashboardVisible, visibleDashboards} from '../services/featureVisibility';
import {ROUTES, landingOrder} from './routeTable';

/**
 * ui-router state -> catalogue key. Every alias of a dashboard maps to the
 * same key, so a legacy bookmark state is not a way past the grant.
 * States absent from this map are not gated dashboards.
 */
export const dashboardStateFeatureKeys: Readonly<Record<string, string>> = Object.fromEntries(
    ROUTES.filter(r => r.featureKey).map(r => [r.state, r.featureKey!]),
);

/** The first dashboard this session may open, or null when none may be. */
export function firstAllowedDashboardState(): string | null {
    const order = landingOrder();
    if (visibleDashboards() === null) return order[0];
    return order.find(state => isDashboardVisible(dashboardStateFeatureKeys[state])) ?? null;
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
