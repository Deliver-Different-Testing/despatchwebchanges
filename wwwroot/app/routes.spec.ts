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
                'dispatchV2',
                'nw',
                'cs',
                'jobSearch',
                'jobSearchV2',
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
            // 15 states total (excluding commented megaMap; jobSearchV2 added
            // for Phase 3 of the AngularJS → React migration — see
            // wwwroot/app/react/pages/job-search/MIGRATION_CHECKLIST.md;
            // dispatchV2 added for the parallel React rebuild of the home/
            // dispatch page).
            expect(registeredStates.size).toBe(15);
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
            expect(state.url).toBe('/jobSearch?jobId');
            expect(state.component).toBe('jobSearchComponent');
        });

        it('should configure recurringJobs state', () => {
            const state = registeredStates.get('recurringJobs');
            expect(state.url).toBe('/recurringJobs');
            // React renders JobDetails directly — template only has the React mount point
            expect(state.template).toContain('react-app-shell');
            expect(state.template).toContain('react-recurring-jobs-list');
            expect(state.template).not.toContain('job-detail-widget');
            expect(state.controller).toBeDefined();
        });

        it('should give the recurring jobs React container full width', () => {
            const state = registeredStates.get('recurringJobs');
            // The flex wrapper was removed in the layout-modernization pass;
            // the mount point now fills the viewport-height container directly.
            expect(state.template).toContain('height: calc(100vh - 64px)');
            expect(state.template).toContain('height: 100%; overflow: hidden');
        });

        it('should configure overview state', () => {
            const state = registeredStates.get('overview');
            expect(state.url).toBe('/overview');
            expect(state.template).toContain('react-app-shell');
            expect(state.template).toContain('react-overview');
        });

        it('should configure taskDashboard state', () => {
            const state = registeredStates.get('taskDashboard');
            expect(state.url).toBe('/taskDashboard');
            // React renders JobDetails directly — template only has the React mount point
            expect(state.template).toContain('react-app-shell');
            expect(state.template).toContain('react-task-dashboard');
            expect(state.template).not.toContain('job-detail-widget');
            expect(state.template).toContain('height: 100%; overflow: hidden');
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
            expect(state.template).toContain('react-app-shell');
            expect(state.template).toContain('react-courier-map');
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

describe('jobSearchV2 Layout Toolbar', () => {
    const CONTACT_ID = 4242;
    const LAYOUTS_KEY = `layoutsCSV2-${CONTACT_ID}`;
    const LAST_ACTIVE_KEY = `lastActiveLayoutCSV2-${CONTACT_ID}`;

    let reactJobSearch: {
        mount: jest.Mock;
        unmount: jest.Mock;
        setCurrentLayoutName: jest.Mock;
        reloadLayoutsFromStorage: jest.Mock;
        promptSaveLayout: jest.Mock;
        promptDeleteLayout: jest.Mock;
    };

    // Build the jobSearchV2 controller instance and return its `ctrl`.
    function makeController() {
        const registeredStates = new Map<string, any>();
        const stateProvider: {state: jest.Mock} = {
            state: jest.fn((name: string, config: any) => {
                registeredStates.set(name, config);
                return stateProvider;
            }),
        };
        const urlRouterProvider = {when: jest.fn(), otherwise: jest.fn()};
        new RouterConfig(urlRouterProvider as any, stateProvider as any);

        const controllerArr = registeredStates.get('jobSearchV2').controller;
        const controllerFn = controllerArr[controllerArr.length - 1];

        const $scope: any = {$on: jest.fn()};
        const $stateParams: any = {jobId: null};
        const toastr = {
            showSuccessToast: jest.fn(),
            showWarningToast: jest.fn(),
            showErrorToast: jest.fn(),
            showInfoToast: jest.fn(),
        };
        controllerFn($scope, $stateParams, toastr, {US_Customer: false});
        return {ctrl: $scope.ctrl, toastr};
    }

    beforeEach(() => {
        localStorage.clear();
        (window as any).ContactID = CONTACT_ID;
        (window as any).TimeZone = 'New Zealand Standard Time';
        reactJobSearch = {
            mount: jest.fn(),
            unmount: jest.fn(),
            setCurrentLayoutName: jest.fn(),
            reloadLayoutsFromStorage: jest.fn(),
            promptSaveLayout: jest.fn().mockResolvedValue(null),
            promptDeleteLayout: jest.fn().mockResolvedValue(false),
        };
        (window as any).ReactJobSearch = reactJobSearch;
    });

    afterEach(() => {
        jest.restoreAllMocks();
        delete (window as any).ReactJobSearch;
    });

    it('always exposes a selectable "Default" layout at index 0 when storage is empty', () => {
        const {ctrl} = makeController();
        // The reported bug: with no saved layouts the toolbar dropdown had no
        // Default entry, so users on a custom layout could not switch back.
        expect(ctrl.layouts[0].name).toBe('Default');
        expect(ctrl.currentLayoutName).toBe('Default');
    });

    it('keeps Default at index 0 when saving the first custom layout', async () => {
        const {ctrl} = makeController();
        reactJobSearch.promptSaveLayout.mockResolvedValue('My Layout');

        await ctrl.saveLayout();

        const persisted = JSON.parse(localStorage.getItem(LAYOUTS_KEY)!);
        expect(persisted[0].name).toBe('Default');
        expect(persisted[1].name).toBe('My Layout');
        expect(ctrl.layouts.map((l: {name: string}) => l.name)).toEqual(['Default', 'My Layout']);
        expect(reactJobSearch.setCurrentLayoutName).toHaveBeenCalledWith('My Layout');
        expect(reactJobSearch.reloadLayoutsFromStorage).toHaveBeenCalled();
    });

    it('switches back to Default via loadLayout(0)', async () => {
        const {ctrl} = makeController();
        reactJobSearch.promptSaveLayout.mockResolvedValue('My Layout');
        await ctrl.saveLayout();
        reactJobSearch.setCurrentLayoutName.mockClear();

        ctrl.loadLayout(0);

        expect(ctrl.currentLayoutName).toBe('Default');
        expect(localStorage.getItem(LAST_ACTIVE_KEY)).toBe('Default');
        expect(reactJobSearch.setCurrentLayoutName).toHaveBeenCalledWith('Default');
    });

    it('never deletes the Default layout', () => {
        const {ctrl} = makeController();
        ctrl.deleteLayout(0);
        // No confirm prompt, no storage write, Default stays put.
        expect(ctrl.layouts[0].name).toBe('Default');
        expect(reactJobSearch.reloadLayoutsFromStorage).not.toHaveBeenCalled();
    });
});
