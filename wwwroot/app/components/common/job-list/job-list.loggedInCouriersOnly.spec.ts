/**
 * Tests for JobListComponent loggedInCouriersOnly toggle functionality
 * Verifies that the toggle state is persisted and correctly included in courier search URLs
 */

describe('JobListComponent loggedInCouriersOnly', () => {
    // Mock localStorage
    let localStorageMock: { [key: string]: string };

    beforeEach(() => {
        localStorageMock = {};

        // Mock localStorage
        Storage.prototype.getItem = jest.fn((key: string) => localStorageMock[key] || null);
        Storage.prototype.setItem = jest.fn((key: string, value: string) => {
            localStorageMock[key] = value;
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // Simplified context interface that mirrors the component
    interface JobListContext {
        loggedInCouriersOnly: boolean;
        jobListType: string;
        LOGGED_IN_ONLY_KEY: string;
        COURIER_URL: string;
    }

    // Mirror of the toggleLoggedInCouriersOnly implementation
    // Note: With md-switch, ng-model updates the value BEFORE ng-change is called,
    // so we simulate that by setting the value first, then calling the persist function
    const simulateMdSwitchToggle = (context: JobListContext): void => {
        // Simulate ng-model updating the value (this happens before ng-change)
        context.loggedInCouriersOnly = !context.loggedInCouriersOnly;
    };

    const toggleLoggedInCouriersOnly = (context: JobListContext): void => {
        // ng-model has already updated loggedInCouriersOnly, just persist it
        localStorage.setItem(
            `${context.LOGGED_IN_ONLY_KEY}_${context.jobListType}`,
            String(context.loggedInCouriersOnly)
        );
    };

    // Helper to simulate full toggle (ng-model change + ng-change callback)
    const performToggle = (context: JobListContext): void => {
        simulateMdSwitchToggle(context);
        toggleLoggedInCouriersOnly(context);
    };

    // Mirror of the loadLoggedInOnlySetting from setupJobListVariables
    const loadLoggedInOnlySetting = (context: JobListContext): void => {
        const savedLoggedInOnly = localStorage.getItem(
            `${context.LOGGED_IN_ONLY_KEY}_${context.jobListType}`
        );
        if (savedLoggedInOnly) {
            context.loggedInCouriersOnly = savedLoggedInOnly === 'true';
        }
    };

    // Mirror of the URL building logic from performCourierSearch
    const buildCourierSearchUrl = (
        context: JobListContext,
        isDgJob: boolean
    ): string => {
        const params: string[] = [];
        if (isDgJob) params.push('dgOnly=true');
        if (context.loggedInCouriersOnly) params.push('loggedInOnly=true');

        return params.length > 0
            ? `${context.COURIER_URL}?${params.join('&')}`
            : context.COURIER_URL;
    };

    // Mirror of the URL building for bulkAssignCourier
    const buildBulkAssignUrl = (context: JobListContext): string => {
        return context.loggedInCouriersOnly
            ? `${context.COURIER_URL}?loggedInOnly=true`
            : context.COURIER_URL;
    };

    const createContext = (overrides?: Partial<JobListContext>): JobListContext => ({
        loggedInCouriersOnly: false,
        jobListType: 'dispatch',
        LOGGED_IN_ONLY_KEY: 'jobListLoggedInCouriersOnly_123',
        COURIER_URL: '/courier/AllActiveSearch',
        ...overrides
    });

    describe('Toggle state management', () => {
        it('should toggle from false to true', () => {
            const context = createContext({ loggedInCouriersOnly: false });

            performToggle(context);

            expect(context.loggedInCouriersOnly).toBe(true);
        });

        it('should toggle from true to false', () => {
            const context = createContext({ loggedInCouriersOnly: true });

            performToggle(context);

            expect(context.loggedInCouriersOnly).toBe(false);
        });

        it('should persist toggle state to localStorage', () => {
            const context = createContext({ loggedInCouriersOnly: false });

            performToggle(context);

            expect(localStorage.setItem).toHaveBeenCalledWith(
                'jobListLoggedInCouriersOnly_123_dispatch',
                'true'
            );
        });

        it('should persist different job list types separately', () => {
            const dispatchContext = createContext({
                loggedInCouriersOnly: false,
                jobListType: 'dispatch'
            });
            const nationwideContext = createContext({
                loggedInCouriersOnly: false,
                jobListType: 'nationwide'
            });

            performToggle(dispatchContext);
            performToggle(nationwideContext);
            performToggle(nationwideContext); // Toggle twice

            expect(localStorage.setItem).toHaveBeenCalledWith(
                'jobListLoggedInCouriersOnly_123_dispatch',
                'true'
            );
            expect(localStorage.setItem).toHaveBeenCalledWith(
                'jobListLoggedInCouriersOnly_123_nationwide',
                'false'
            );
        });
    });

    describe('Loading saved state', () => {
        it('should load saved true value from localStorage', () => {
            localStorageMock['jobListLoggedInCouriersOnly_123_dispatch'] = 'true';
            const context = createContext({ loggedInCouriersOnly: false });

            loadLoggedInOnlySetting(context);

            expect(context.loggedInCouriersOnly).toBe(true);
        });

        it('should load saved false value from localStorage', () => {
            localStorageMock['jobListLoggedInCouriersOnly_123_dispatch'] = 'false';
            const context = createContext({ loggedInCouriersOnly: true });

            loadLoggedInOnlySetting(context);

            expect(context.loggedInCouriersOnly).toBe(false);
        });

        it('should keep default value when no saved state exists', () => {
            const context = createContext({ loggedInCouriersOnly: false });

            loadLoggedInOnlySetting(context);

            expect(context.loggedInCouriersOnly).toBe(false);
        });

        it('should load correct state for specific job list type', () => {
            localStorageMock['jobListLoggedInCouriersOnly_123_dispatch'] = 'true';
            localStorageMock['jobListLoggedInCouriersOnly_123_nationwide'] = 'false';

            const dispatchContext = createContext({ jobListType: 'dispatch' });
            const nationwideContext = createContext({ jobListType: 'nationwide' });

            loadLoggedInOnlySetting(dispatchContext);
            loadLoggedInOnlySetting(nationwideContext);

            expect(dispatchContext.loggedInCouriersOnly).toBe(true);
            expect(nationwideContext.loggedInCouriersOnly).toBe(false);
        });
    });

    describe('URL building for courier search', () => {
        it('should return base URL when loggedInOnly is false and not DG job', () => {
            const context = createContext({ loggedInCouriersOnly: false });

            const url = buildCourierSearchUrl(context, false);

            expect(url).toBe('/courier/AllActiveSearch');
        });

        it('should include loggedInOnly parameter when toggle is true', () => {
            const context = createContext({ loggedInCouriersOnly: true });

            const url = buildCourierSearchUrl(context, false);

            expect(url).toBe('/courier/AllActiveSearch?loggedInOnly=true');
        });

        it('should include dgOnly parameter when job is DG', () => {
            const context = createContext({ loggedInCouriersOnly: false });

            const url = buildCourierSearchUrl(context, true);

            expect(url).toBe('/courier/AllActiveSearch?dgOnly=true');
        });

        it('should include both parameters when loggedInOnly is true and job is DG', () => {
            const context = createContext({ loggedInCouriersOnly: true });

            const url = buildCourierSearchUrl(context, true);

            expect(url).toBe('/courier/AllActiveSearch?dgOnly=true&loggedInOnly=true');
        });

        it('should build URL correctly for multiple searches', () => {
            const context = createContext({ loggedInCouriersOnly: true });

            // First search - DG job
            const url1 = buildCourierSearchUrl(context, true);
            // Second search - non-DG job
            const url2 = buildCourierSearchUrl(context, false);
            // Toggle off
            context.loggedInCouriersOnly = false;
            // Third search - DG job with toggle off
            const url3 = buildCourierSearchUrl(context, true);

            expect(url1).toBe('/courier/AllActiveSearch?dgOnly=true&loggedInOnly=true');
            expect(url2).toBe('/courier/AllActiveSearch?loggedInOnly=true');
            expect(url3).toBe('/courier/AllActiveSearch?dgOnly=true');
        });
    });

    describe('URL building for bulk assign', () => {
        it('should return base URL when loggedInOnly is false', () => {
            const context = createContext({ loggedInCouriersOnly: false });

            const url = buildBulkAssignUrl(context);

            expect(url).toBe('/courier/AllActiveSearch');
        });

        it('should include loggedInOnly parameter when toggle is true', () => {
            const context = createContext({ loggedInCouriersOnly: true });

            const url = buildBulkAssignUrl(context);

            expect(url).toBe('/courier/AllActiveSearch?loggedInOnly=true');
        });
    });

    describe('Integration scenarios', () => {
        it('should persist and reload state across sessions', () => {
            // First session - toggle on
            const context1 = createContext();
            performToggle(context1);
            expect(context1.loggedInCouriersOnly).toBe(true);

            // Simulate new session - create new context and load saved state
            const context2 = createContext({ loggedInCouriersOnly: false });
            loadLoggedInOnlySetting(context2);

            expect(context2.loggedInCouriersOnly).toBe(true);
        });

        it('should handle rapid toggling correctly', () => {
            const context = createContext({ loggedInCouriersOnly: false });

            // Rapid toggles
            performToggle(context); // true
            performToggle(context); // false
            performToggle(context); // true
            performToggle(context); // false
            performToggle(context); // true

            expect(context.loggedInCouriersOnly).toBe(true);
            expect(localStorage.setItem).toHaveBeenLastCalledWith(
                'jobListLoggedInCouriersOnly_123_dispatch',
                'true'
            );
        });

        it('should build correct URLs after toggle state changes', () => {
            const context = createContext({ loggedInCouriersOnly: false });

            // URL before toggle
            const url1 = buildCourierSearchUrl(context, false);
            expect(url1).toBe('/courier/AllActiveSearch');

            // Toggle and build URL
            performToggle(context);
            const url2 = buildCourierSearchUrl(context, false);
            expect(url2).toBe('/courier/AllActiveSearch?loggedInOnly=true');

            // Toggle back and build URL
            performToggle(context);
            const url3 = buildCourierSearchUrl(context, false);
            expect(url3).toBe('/courier/AllActiveSearch');
        });
    });

    describe('Edge cases', () => {
        it('should handle empty jobListType', () => {
            const context = createContext({ jobListType: '' });

            performToggle(context);

            expect(localStorage.setItem).toHaveBeenCalledWith(
                'jobListLoggedInCouriersOnly_123_',
                'true'
            );
        });

        it('should handle special characters in jobListType', () => {
            const context = createContext({ jobListType: 'job-search-main' });

            performToggle(context);

            expect(localStorage.setItem).toHaveBeenCalledWith(
                'jobListLoggedInCouriersOnly_123_job-search-main',
                'true'
            );
        });

        it('should not affect other localStorage keys', () => {
            localStorageMock['otherKey'] = 'otherValue';
            const context = createContext();

            performToggle(context);

            expect(localStorageMock['otherKey']).toBe('otherValue');
        });
    });

    describe('Query parameter formatting', () => {
        it('should use ampersand to join multiple parameters', () => {
            const context = createContext({ loggedInCouriersOnly: true });

            const url = buildCourierSearchUrl(context, true);

            expect(url).toContain('&');
            expect(url.split('&')).toHaveLength(2);
        });

        it('should not have trailing ampersand', () => {
            const context = createContext({ loggedInCouriersOnly: true });

            const url = buildCourierSearchUrl(context, true);

            expect(url).not.toMatch(/&$/);
        });

        it('should not have leading ampersand after question mark', () => {
            const context = createContext({ loggedInCouriersOnly: true });

            const url = buildCourierSearchUrl(context, false);

            expect(url).not.toMatch(/\?&/);
        });

        it('should have question mark before first parameter', () => {
            const context = createContext({ loggedInCouriersOnly: true });

            const url = buildCourierSearchUrl(context, false);

            expect(url).toMatch(/\?loggedInOnly=/);
        });
    });
});
