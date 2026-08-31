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
        expect(resolveDashboardRedirect('dispatchV2')).toBeNull();
        expect(resolveDashboardRedirect('courierMap')).toBeNull();
    });

    it('lets a granted dashboard through', () => {
        window.VisibleFeatures = ['dw-dispatch'];

        expect(resolveDashboardRedirect('dispatchV2')).toBeNull();
        expect(resolveDashboardRedirect('home')).toBeNull();
    });

    it('redirects a blocked dashboard to the first one the session can reach', () => {
        window.VisibleFeatures = ['dw-job-search'];

        // Deep-linking to a hidden dashboard must not be a way around the grant.
        expect(resolveDashboardRedirect('courierMap')).toBe('jobSearch');
        expect(resolveDashboardRedirect('dispatchV2')).toBe('jobSearch');
    });

    it('redirects to forbidden when nothing at all is granted', () => {
        window.VisibleFeatures = [];

        expect(firstAllowedDashboardState()).toBeNull();
        expect(resolveDashboardRedirect('dispatchV2')).toBe('forbidden');
    });

    it('leaves states that are not gated dashboards alone', () => {
        window.VisibleFeatures = [];

        expect(resolveDashboardRedirect('forbidden')).toBeNull();
        expect(resolveDashboardRedirect('notFound')).toBeNull();
        expect(resolveDashboardRedirect('cs')).toBeNull();
    });

    it('gates both variants of the dashboards that have a v2 state', () => {
        // A beta opt-out must not become a way past the grant.
        expect(dashboardStateFeatureKeys.home).toBe(dashboardStateFeatureKeys.dispatchV2);
        expect(dashboardStateFeatureKeys.jobSearch).toBe(dashboardStateFeatureKeys.jobSearchV2);
    });
});
