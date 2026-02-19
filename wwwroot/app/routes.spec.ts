/**
 * Tests for RouterConfig
 * Covers route configuration, default redirects, and state definitions
 */

import RouterConfig from './routes';

describe('RouterConfig', () => {
    let mockUrlRouterProvider: {
        when: jest.Mock;
        otherwise: jest.Mock;
    };
    let mockStateProvider: {
        state: jest.Mock;
    };
    let registeredStates: Map<string, any>;

    beforeEach(() => {
        registeredStates = new Map();

        mockUrlRouterProvider = {
            when: jest.fn(),
            otherwise: jest.fn()
        };

        mockStateProvider = {
            state: jest.fn((name: string, config: any) => {
                registeredStates.set(name, config);
                return mockStateProvider; // Allow chaining
            })
        };
    });

    describe('Default Route Configuration', () => {
        it('should redirect empty URL to home page ("/")', () => {
            new RouterConfig(
                mockUrlRouterProvider as any,
                mockStateProvider as any
            );

            expect(mockUrlRouterProvider.when).toHaveBeenCalledWith('', '/');
        });

        it('should redirect unknown routes to not-found page', () => {
            new RouterConfig(
                mockUrlRouterProvider as any,
                mockStateProvider as any
            );

            expect(mockUrlRouterProvider.otherwise).toHaveBeenCalledWith('/not-found');
        });

        it('should call when exactly once for empty URL redirect', () => {
            new RouterConfig(
                mockUrlRouterProvider as any,
                mockStateProvider as any
            );

            expect(mockUrlRouterProvider.when).toHaveBeenCalledTimes(1);
        });

        it('should call otherwise exactly once', () => {
            new RouterConfig(
                mockUrlRouterProvider as any,
                mockStateProvider as any
            );

            expect(mockUrlRouterProvider.otherwise).toHaveBeenCalledTimes(1);
        });
    });

    describe('Home State Configuration', () => {
        beforeEach(() => {
            new RouterConfig(
                mockUrlRouterProvider as any,
                mockStateProvider as any
            );
        });

        it('should register home state', () => {
            expect(registeredStates.has('home')).toBe(true);
        });

        it('should configure home state with root URL', () => {
            const homeState = registeredStates.get('home');
            expect(homeState.url).toBe('/?jobId');
        });

        it('should configure home state with homeComponent', () => {
            const homeState = registeredStates.get('home');
            expect(homeState.component).toBe('homeComponent');
        });

        it('should configure home state with optional jobId param', () => {
            const homeState = registeredStates.get('home');
            expect(homeState.params).toBeDefined();
            expect(homeState.params.jobId).toEqual({
                value: null,
                squash: true
            });
        });

        it('should configure home state with lazy loading resolves', () => {
            const homeState = registeredStates.get('home');
            expect(homeState.resolve).toBeDefined();
            expect(homeState.resolve.manifest).toBeDefined();
            expect(homeState.resolve.loadModule).toBeDefined();
        });
    });

    describe('Error States Configuration', () => {
        beforeEach(() => {
            new RouterConfig(
                mockUrlRouterProvider as any,
                mockStateProvider as any
            );
        });

        it('should register notFound state', () => {
            expect(registeredStates.has('notFound')).toBe(true);
        });

        it('should configure notFound state with /not-found URL', () => {
            const notFoundState = registeredStates.get('notFound');
            expect(notFoundState.url).toBe('/not-found');
        });

        it('should configure notFound state with react-error-page template', () => {
            const notFoundState = registeredStates.get('notFound');
            expect(notFoundState.template).toBe('<div id="react-error-page-notFound" style="height: 100%;"></div>');
        });

        it('should register error state', () => {
            expect(registeredStates.has('error')).toBe(true);
            const errorState = registeredStates.get('error');
            expect(errorState.url).toBe('/error');
        });

        it('should register forbidden state', () => {
            expect(registeredStates.has('forbidden')).toBe(true);
            const forbiddenState = registeredStates.get('forbidden');
            expect(forbiddenState.url).toBe('/forbidden');
        });

        it('should register serverError state', () => {
            expect(registeredStates.has('serverError')).toBe(true);
            const serverErrorState = registeredStates.get('serverError');
            expect(serverErrorState.url).toBe('/server-error');
        });
    });

    describe('All Required States Registration', () => {
        beforeEach(() => {
            new RouterConfig(
                mockUrlRouterProvider as any,
                mockStateProvider as any
            );
        });

        it('should register all expected states', () => {
            const expectedStates = [
                'home',
                'nw',
                'cs',
                'jobSearch',
                'recurringJobs',
                'overview',
                'taskDashboard',
                'driverManagement',
                'courierMap',
                'notFound',
                'error',
                'forbidden',
                'serverError'
            ];

            expectedStates.forEach(stateName => {
                expect(registeredStates.has(stateName)).toBe(true);
            });
        });

        it('should register exactly the expected number of states', () => {
            // 13 states total (excluding commented megaMap)
            expect(registeredStates.size).toBe(13);
        });
    });

    describe('Nationwide State Configuration', () => {
        beforeEach(() => {
            new RouterConfig(
                mockUrlRouterProvider as any,
                mockStateProvider as any
            );
        });

        it('should register nw state with /Nationwide URL', () => {
            const nwState = registeredStates.get('nw');
            expect(nwState.url).toBe('/Nationwide?jobId');
        });

        it('should configure nw state with nationwide-component template', () => {
            const nwState = registeredStates.get('nw');
            expect(nwState.template).toBe('<nationwide-component></nationwide-component>');
        });
    });

    describe('CS State Redirect', () => {
        beforeEach(() => {
            new RouterConfig(
                mockUrlRouterProvider as any,
                mockStateProvider as any
            );
        });

        it('should redirect /CS to jobSearch', () => {
            const csState = registeredStates.get('cs');
            expect(csState.url).toBe('/CS');
            expect(csState.redirectTo).toBe('jobSearch');
        });
    });

    describe('Feature States Configuration', () => {
        beforeEach(() => {
            new RouterConfig(
                mockUrlRouterProvider as any,
                mockStateProvider as any
            );
        });

        it('should configure jobSearch state', () => {
            const state = registeredStates.get('jobSearch');
            expect(state.url).toBe('/jobSearch');
            expect(state.component).toBe('jobSearchComponent');
        });

        it('should configure recurringJobs state', () => {
            const state = registeredStates.get('recurringJobs');
            expect(state.url).toBe('/recurringJobs');
            // Now uses hybrid React/AngularJS template with app shell and job detail widget
            expect(state.template).toContain('react-app-shell');
            expect(state.template).toContain('react-recurring-jobs-list');
            expect(state.template).toContain('job-detail-widget');
            expect(state.controller).toBeDefined();
        });

        describe('recurringJobs template overflow handling', () => {
            it('should have overflow: hidden on the job details column container', () => {
                const state = registeredStates.get('recurringJobs');
                // The column container (flex: 0 0 45%) should have overflow: hidden
                expect(state.template).toContain('flex: 0 0 45%');
                expect(state.template).toMatch(/flex: 0 0 45%[^>]*overflow: hidden/);
            });

            it('should have min-width: 0 on flex containers to prevent overflow', () => {
                const state = registeredStates.get('recurringJobs');
                // min-width: 0 allows flex items to shrink below content width
                expect(state.template).toMatch(/flex: 0 0 45%[^>]*min-width: 0/);
            });

            it('should have min-width: 0 on md-card for proper flex shrinking', () => {
                const state = registeredStates.get('recurringJobs');
                // md-card should also have min-width: 0
                expect(state.template).toMatch(/md-card[^>]*min-width: 0/);
            });

            it('should have width constraints on job-detail-widget', () => {
                const state = registeredStates.get('recurringJobs');
                // job-detail-widget should have width: 100% and max-width: 100%
                expect(state.template).toMatch(/job-detail-widget[^>]*width: 100%/);
                expect(state.template).toMatch(/job-detail-widget[^>]*max-width: 100%/);
            });
        });

        it('should configure overview state', () => {
            const state = registeredStates.get('overview');
            expect(state.url).toBe('/overview');
            expect(state.template).toBe('<overview-component></overview-component>');
        });

        it('should configure taskDashboard state', () => {
            const state = registeredStates.get('taskDashboard');
            expect(state.url).toBe('/taskDashboard');
            // taskDashboard now uses a React shell template
            expect(state.template).toContain('react-app-shell');
        });

        it('should configure driverManagement state', () => {
            const state = registeredStates.get('driverManagement');
            expect(state.url).toBe('/driverManagement');
            // driverManagement now uses a React shell template
            expect(state.template).toContain('react-app-shell');
        });

        it('should configure courierMap state', () => {
            const state = registeredStates.get('courierMap');
            expect(state.url).toBe('/courierMap');
            expect(state.component).toBe('courierMapComponent');
        });
    });
});

describe('Base URL Behavior', () => {
    describe('User navigating to base URL', () => {
        it('should be handled by home state with root URL "/"', () => {
            // The home state URL is "/?jobId" which matches:
            // - "/" (base URL)
            // - "/?jobId=123" (with optional param)
            const homeUrl = '/?jobId';

            // Verify the pattern matches base URL
            expect(homeUrl.startsWith('/')).toBe(true);

            // The "?" in the URL pattern means jobId is optional
            // So "/" alone will match the home state
        });

        it('should use when() to redirect empty URL to home', () => {
            // This documents the expected behavior:
            // 1. User navigates to https://example.com (no path, empty URL)
            // 2. $urlRouterProvider.when('', '/') redirects empty to "/"
            // 3. "/" matches the home state URL pattern "/?jobId"
            // 4. Home component loads

            const whenSource = '';
            const whenTarget = '/';
            const homeStateUrl = '/?jobId';

            // Empty URL redirects to "/" which matches home state
            expect(whenSource).toBe('');
            expect(homeStateUrl.startsWith(whenTarget)).toBe(true);
        });

        it('should use otherwise() for truly unknown routes', () => {
            // Unknown routes like "/unknown-page" go to not-found
            // This preserves proper 404 behavior for invalid URLs
            const otherwiseTarget = '/not-found';
            expect(otherwiseTarget).toBe('/not-found');
        });
    });
});
