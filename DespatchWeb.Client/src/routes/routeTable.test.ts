import {
    ROUTES,
    getRoute,
    navRoutes,
    landingOrder,
    resolveAlias,
    routePath,
    routeUrlWithJobId,
} from './routeTable';
import {dashboardFeatureKeys} from '../services/featureVisibility';

const EXPECTED_PATHS: Record<string, string> = {
    home: '/',
    dispatch: '/dispatch',
    dispatchV2: '/dispatchV2',
    nationwide: '/nationwide',
    cs: '/CS',
    jobSearch: '/jobSearch',
    jobSearchV2: '/jobSearchV2',
    recurringJobs: '/recurringJobs',
    overview: '/overview',
    taskDashboard: '/taskDashboard',
    driverManagement: '/driverManagement',
    courierMap: '/courierMap',
    settings: '/settings',
    notFound: '/not-found',
    error: '/error',
    forbidden: '/forbidden',
    serverError: '/server-error',
};

describe('routeTable', () => {
    it('registers exactly the known states with their current paths', () => {
        expect(Object.fromEntries(ROUTES.map(r => [r.state, r.path]))).toEqual(EXPECTED_PATHS);
    });

    it('has unique states and paths', () => {
        expect(new Set(ROUTES.map(r => r.state)).size).toBe(ROUTES.length);
        expect(new Set(ROUTES.map(r => r.path)).size).toBe(ROUTES.length);
    });

    it('resolves every alias to a real page', () => {
        const aliases = ROUTES.filter(r => r.redirectTo);
        expect(aliases.map(a => [a.state, a.redirectTo])).toEqual([
            ['home', 'dispatch'],
            ['dispatchV2', 'dispatch'],
            ['cs', 'jobSearch'],
            ['jobSearchV2', 'jobSearch'],
        ]);
        for (const alias of aliases) {
            expect(getRoute(alias.redirectTo!)?.kind).toBe('page');
            expect(resolveAlias(alias.state)).toBe(alias.redirectTo);
        }
        expect(resolveAlias('dispatch')).toBe('dispatch');
    });

    it('uses catalogue feature keys', () => {
        const valid = new Set<string>(Object.values(dashboardFeatureKeys));
        for (const r of ROUTES.filter(r => r.featureKey)) {
            expect(valid.has(r.featureKey!)).toBe(true);
        }
    });

    it('lists nav items in the side-nav order', () => {
        expect(navRoutes().map(r => r.state)).toEqual([
            'dispatch', 'nationwide', 'overview', 'taskDashboard',
            'jobSearch', 'recurringJobs', 'courierMap', 'driverManagement',
        ]);
        expect(navRoutes().map(r => r.navId)).toEqual([
            'dashboard', 'shipping', 'overview', 'tasks',
            'jobSearch', 'recurringJobs', 'courierMap', 'driverManagement',
        ]);
    });

    it('lists the landing order', () => {
        expect(landingOrder()).toEqual([
            'dispatch', 'jobSearch', 'nationwide', 'overview',
            'taskDashboard', 'recurringJobs', 'courierMap', 'driverManagement',
        ]);
    });

    it('builds paths and jobId urls', () => {
        expect(routePath('nationwide')).toBe('/nationwide');
        expect(routeUrlWithJobId('home')).toBe('/?jobId');
        expect(routeUrlWithJobId('jobSearchV2')).toBe('/jobSearchV2?jobId');
        expect(() => routePath('nope')).toThrow();
    });

    it('records titles and sections for pages', () => {
        expect(getRoute('settings')).toMatchObject({title: 'Settings', section: 'Account'});
        expect(getRoute('nationwide')).toMatchObject({title: 'Nationwide', section: 'Operations'});
        expect(getRoute('taskDashboard')).toMatchObject({title: 'Task Dashboard', section: 'Dashboards'});
    });
});
