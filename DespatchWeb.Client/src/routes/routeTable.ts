import {dashboardFeatureKeys} from '../services/featureVisibility';

export type RouteKind = 'page' | 'alias' | 'error';
export type RouteSection = 'Dashboards' | 'Operations' | 'Account';

export interface RouteEntry {
    /** ui-router state name. */
    state: string;
    /** URL without query string. */
    path: string;
    kind: RouteKind;
    title?: string;
    section?: RouteSection;
    /** Catalogue key gating the page; aliases carry their target's key. */
    featureKey?: string;
    /** Alias only: the page state this one redirects to. */
    redirectTo?: string;
    /** Side-nav item id; present only for pages shown in the nav. */
    navId?: string;
    /** Side-nav position, ascending. */
    navOrder?: number;
    /** Landing preference when the requested dashboard is blocked, ascending. */
    landingOrder?: number;
}

export const ROUTES: readonly RouteEntry[] = [
    {state: 'home', path: '/', kind: 'alias', redirectTo: 'dispatch', featureKey: dashboardFeatureKeys.dispatch},
    {
        state: 'dispatch', path: '/dispatch', kind: 'page', title: 'Dispatch', section: 'Dashboards',
        featureKey: dashboardFeatureKeys.dispatch, navId: 'dashboard', navOrder: 1, landingOrder: 1,
    },
    {state: 'dispatchV2', path: '/dispatchV2', kind: 'alias', redirectTo: 'dispatch', featureKey: dashboardFeatureKeys.dispatch},
    {
        state: 'nationwide', path: '/nationwide', kind: 'page', title: 'Nationwide', section: 'Operations',
        featureKey: dashboardFeatureKeys.nationwide, navId: 'shipping', navOrder: 2, landingOrder: 3,
    },
    {state: 'cs', path: '/CS', kind: 'alias', redirectTo: 'jobSearch'},
    {
        state: 'jobSearch', path: '/jobSearch', kind: 'page', title: 'Search', section: 'Dashboards',
        featureKey: dashboardFeatureKeys.jobSearch, navId: 'jobSearch', navOrder: 5, landingOrder: 2,
    },
    {state: 'jobSearchV2', path: '/jobSearchV2', kind: 'alias', redirectTo: 'jobSearch', featureKey: dashboardFeatureKeys.jobSearch},
    {
        state: 'recurringJobs', path: '/recurringJobs', kind: 'page', title: 'Recurring Jobs', section: 'Dashboards',
        featureKey: dashboardFeatureKeys.recurringJobs, navId: 'recurringJobs', navOrder: 6, landingOrder: 6,
    },
    {
        state: 'overview', path: '/overview', kind: 'page', title: 'Overview', section: 'Dashboards',
        featureKey: dashboardFeatureKeys.overview, navId: 'overview', navOrder: 3, landingOrder: 4,
    },
    {
        state: 'taskDashboard', path: '/taskDashboard', kind: 'page', title: 'Task Dashboard', section: 'Dashboards',
        featureKey: dashboardFeatureKeys.taskDashboard, navId: 'tasks', navOrder: 4, landingOrder: 5,
    },
    {
        state: 'driverManagement', path: '/driverManagement', kind: 'page', title: 'Drivers', section: 'Operations',
        featureKey: dashboardFeatureKeys.driverManagement, navId: 'driverManagement', navOrder: 8, landingOrder: 8,
    },
    {
        state: 'courierMap', path: '/courierMap', kind: 'page', title: 'Courier Map', section: 'Operations',
        featureKey: dashboardFeatureKeys.courierMap, navId: 'courierMap', navOrder: 7, landingOrder: 7,
    },
    {state: 'settings', path: '/settings', kind: 'page', title: 'Settings', section: 'Account'},
    {state: 'notFound', path: '/not-found', kind: 'error'},
    {state: 'error', path: '/error', kind: 'error'},
    {state: 'forbidden', path: '/forbidden', kind: 'error'},
    {state: 'serverError', path: '/server-error', kind: 'error'},
];

const byState = new Map(ROUTES.map(r => [r.state, r]));

export const getRoute = (state: string): RouteEntry | undefined => byState.get(state);

export function routePath(state: string): string {
    const route = byState.get(state);
    if (!route) throw new Error(`Unknown route state: ${state}`);
    return route.path;
}

/** ui-router url for states that take an optional `jobId` query param. */
export const routeUrlWithJobId = (state: string): string => `${routePath(state)}?jobId`;

/** The page an alias redirects to; non-aliases resolve to themselves. */
export const resolveAlias = (state: string): string => byState.get(state)?.redirectTo ?? state;

const sortedBy = (key: 'navOrder' | 'landingOrder') =>
    ROUTES.filter(r => r[key] !== undefined).sort((a, b) => a[key]! - b[key]!);

export const navRoutes = (): RouteEntry[] => sortedBy('navOrder');

export const landingOrder = (): string[] => sortedBy('landingOrder').map(r => r.state);

/** Every state (the page and its aliases) gated by the same catalogue key. */
export const statesForFeatureKey = (featureKey: string): string[] =>
    ROUTES.filter(r => r.featureKey === featureKey).map(r => r.state);
