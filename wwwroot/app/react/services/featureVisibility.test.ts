import {isDashboardVisible, visibleDashboards} from './featureVisibility';

describe('featureVisibility', () => {
    afterEach(() => {
        delete window.VisibleFeatures;
    });

    it('treats an absent or null global as "not gated" so every dashboard stays reachable', () => {
        expect(visibleDashboards()).toBeNull();
        expect(isDashboardVisible('dw-dispatch')).toBe(true);

        window.VisibleFeatures = null;

        expect(visibleDashboards()).toBeNull();
        expect(isDashboardVisible('dw-dispatch')).toBe(true);
    });

    it('allows only the granted keys once the session is gated', () => {
        window.VisibleFeatures = ['dw-dispatch', 'dw-job-search'];

        expect(isDashboardVisible('dw-dispatch')).toBe(true);
        expect(isDashboardVisible('dw-job-search')).toBe(true);
        expect(isDashboardVisible('dw-courier-map')).toBe(false);
    });

    it('hides everything when a gated session was granted nothing', () => {
        // An empty array is a real answer ("DF Admin granted no dashboard"),
        // not a missing one — it must not read as ungated.
        window.VisibleFeatures = [];

        expect(visibleDashboards()).toEqual([]);
        expect(isDashboardVisible('dw-dispatch')).toBe(false);
    });

    it('ignores a malformed global rather than locking the user out', () => {
        window.VisibleFeatures = 'dw-dispatch' as unknown as string[];

        expect(visibleDashboards()).toBeNull();
        expect(isDashboardVisible('dw-dispatch')).toBe(true);
    });

    it('matches keys case-insensitively, as the backend resolver does', () => {
        window.VisibleFeatures = ['DW-Dispatch'];

        expect(isDashboardVisible('dw-dispatch')).toBe(true);
    });
});
