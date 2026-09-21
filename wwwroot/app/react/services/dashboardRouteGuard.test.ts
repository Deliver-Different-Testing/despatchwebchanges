import {
    dashboardStateFeatureKeys,
    firstAllowedDashboardState,
    resolveDashboardRedirect,
} from './dashboardRouteGuard';

describe('dashboardRouteGuard', () => {
    afterEach(() => {
        delete window.VisibleFeatures;
    });

    it('lets every state through when the session is not gated', () => {
        expect(resolveDashboardRedirect('dispatch')).toBeNull();
        expect(resolveDashboardRedirect('courierMap')).toBeNull();
    });

    it('lets a granted dashboard through', () => {
        window.VisibleFeatures = ['dw-dispatch'];

        expect(resolveDashboardRedirect('dispatch')).toBeNull();
        expect(resolveDashboardRedirect('home')).toBeNull();
    });

    it('redirects a blocked dashboard to the first one the session can reach', () => {
        window.VisibleFeatures = ['dw-job-search'];

        // Deep-linking to a hidden dashboard must not be a way around the grant.
        expect(resolveDashboardRedirect('courierMap')).toBe('jobSearch');
        expect(resolveDashboardRedirect('dispatch')).toBe('jobSearch');
    });

    it('redirects to forbidden when nothing at all is granted', () => {
        window.VisibleFeatures = [];

        expect(firstAllowedDashboardState()).toBeNull();
        expect(resolveDashboardRedirect('dispatch')).toBe('forbidden');
    });

    it('leaves states that are not gated dashboards alone', () => {
        window.VisibleFeatures = [];

        expect(resolveDashboardRedirect('forbidden')).toBeNull();
        expect(resolveDashboardRedirect('notFound')).toBeNull();
        expect(resolveDashboardRedirect('cs')).toBeNull();
    });

    it('gates every alias of a dashboard that has a legacy bookmark state', () => {
        // A legacy `/xV2` bookmark must not become a way past the grant.
        expect(dashboardStateFeatureKeys.home).toBe(dashboardStateFeatureKeys.dispatch);
        expect(dashboardStateFeatureKeys.dispatch).toBe(dashboardStateFeatureKeys.dispatchV2);
        expect(dashboardStateFeatureKeys.jobSearch).toBe(dashboardStateFeatureKeys.jobSearchV2);
        expect(dashboardStateFeatureKeys.nw).toBe(dashboardStateFeatureKeys.nwV2);
    });

    it('blocks and allows nwV2 exactly as it does nw', () => {
        window.VisibleFeatures = ['dw-dispatch'];
        expect(resolveDashboardRedirect('nw')).not.toBeNull();
        expect(resolveDashboardRedirect('nwV2')).not.toBeNull();

        delete window.VisibleFeatures;
        expect(resolveDashboardRedirect('nw')).toBeNull();
        expect(resolveDashboardRedirect('nwV2')).toBeNull();
    });
});
