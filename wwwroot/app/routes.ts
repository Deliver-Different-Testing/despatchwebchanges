import IDfrntStateParams from "./interfaces/DfrntStateParams.interface";
import angular from 'angular';
import type {ErrorType} from './react/pages/error-page/ErrorPage';
import {openJobInSearch} from './react/services/navigationService';
import {
    getJobSearchBetaEnabled,
    setJobSearchBetaEnabled,
} from './react/pages/job-search/lib/betaPreference';

class RouterConfig {
    constructor(
        private $urlRouterProvider: angular.ui.IUrlRouterProvider,
        private $stateProvider: angular.ui.IStateProvider
    ) {
        this.configureRoutes();
    }

    private configureRoutes(): void {
        // Redirect empty URL to home
        this.$urlRouterProvider.when('', '/');

        // Unknown routes go to not-found
        this.$urlRouterProvider.otherwise("/not-found");

        // Configure routes
        this.configureHomeState()
            .configureNationwideState()
            .configureCSState()
            .configureJobSearchState()
            .configureJobSearchV2State()
            .configurePrebooksState()
            .configureOverviewState()

            .configureTaskDashboardState()
            .configureDriverManagementState()
            .configureCourierMapState()
            .configureErrorStates();
    }

    private configureHomeState(): this {
        this.$stateProvider.state("home", {
            url: "/?jobId",
            params: {
                jobId: {
                    value: null,
                    squash: true
                }
            },
            resolve: {
                jobId: ['$stateParams', ($stateParams: IDfrntStateParams) => {
                    return $stateParams.jobId ? parseInt($stateParams.jobId, 10) : null;
                }],
                manifest: ['$http', async ($http: angular.IHttpService) => {
                    try {
                        const response = await $http.get<Record<string, string>>('dist/manifest.json');
                        return response.data;
                    } catch {
                        console.warn('[ROUTES] Failed to load manifest for home state, using fallback names');
                        return {
                            'home.js': 'home.js',
                            'home.css': 'home.css'
                        };
                    }
                }],
                loadModule: ['$ocLazyLoad', 'manifest', async ($ocLazyLoad: oc.ILazyLoad, manifest: Record<string, string>) => {
                    try {
                        const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;
                        await $ocLazyLoad.load([
                            getAssetPath('home.js'),
                            getAssetPath('home.css')
                        ]);
                        // Load React job list for the dispatch page
                        if (!window.React) {
                            await $ocLazyLoad.load(getAssetPath('vendor-react.js'));
                        }
                        await $ocLazyLoad.load({
                            name: 'uDispatch.jobListReact',
                            files: [getAssetPath('jobListReact.js')]
                        });
                        await $ocLazyLoad.load({
                            name: 'uDispatch.currentWorkJobListReact',
                            files: [getAssetPath('currentWorkJobListReact.js')]
                        });
                    } catch (error) {
                        console.error('[ROUTES] Failed to load home modules:', error);
                        throw error;
                    }
                }]
            },
            component: "homeComponent"
        });
        return this;
    }

    private configureNationwideState(): this {
        this.$stateProvider.state("nw", {
            url: "/Nationwide?jobId",
            template: '<nationwide-component></nationwide-component>',
            params: {
                jobId: {
                    value: null,
                    squash: true
                }
            },
            resolve: {
                jobId: ['$stateParams', ($stateParams: IDfrntStateParams) => {
                    return $stateParams.jobId ? parseInt($stateParams.jobId, 10) : null;
                }],
                manifest: ['$http', async ($http: angular.IHttpService) => {
                    try {
                        const response = await $http.get<Record<string, string>>('dist/manifest.json');
                        return response.data;
                    } catch {
                        console.warn('[ROUTES] Failed to load manifest for nationwide state, using fallback names');
                        return {
                            'nationwide.js': 'nationwide.js',
                            'nationwide.css': 'nationwide.css',
                            'vendor-react.js': 'vendor-react.js',
                            'nationwideJobListReact.js': 'nationwideJobListReact.js'
                        };
                    }
                }],
                loadModule: ['$ocLazyLoad', 'manifest', async ($ocLazyLoad: oc.ILazyLoad, manifest: Record<string, string>) => {
                    const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;
                    await $ocLazyLoad.load([
                        getAssetPath('nationwide.js'),
                        getAssetPath('nationwide.css')
                    ]);
                    if (!window.React) {
                        await $ocLazyLoad.load(getAssetPath('vendor-react.js'));
                    }
                    await $ocLazyLoad.load({
                        name: 'uDispatch.nationwideJobListReact',
                        files: [getAssetPath('nationwideJobListReact.js')]
                    });
                }]
            }
        });
        return this;
    }

    private configureCSState(): this {
        this.$stateProvider.state("cs", {
            url: "/CS",
            redirectTo: "jobSearch"
        });
        return this;
    }

    private configureJobSearchState(): this {
        this.$stateProvider.state("jobSearch", {
            url: "/jobSearch?jobId",
            params: {
                jobId: {
                    value: null,
                    squash: true
                }
            },
            resolve: {
                manifest: ['$http', async ($http: angular.IHttpService) => {
                    try {
                        const response = await $http.get<Record<string, string>>('dist/manifest.json');
                        return response.data;
                    } catch {
                        console.warn('[ROUTES] Failed to load manifest for jobSearch state, using fallback names');
                        return {
                            'jobSearch.js': 'jobSearch.js',
                            'jobSearch.css': 'jobSearch.css'
                        };
                    }
                }],
                loadModule: ['$ocLazyLoad', 'manifest', async ($ocLazyLoad: oc.ILazyLoad, manifest: Record<string, string>) => {
                    const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;
                    await $ocLazyLoad.load([
                        getAssetPath('jobSearch.js'),
                        getAssetPath('jobSearch.css')
                    ]);
                    // Load React job list for the job search page
                    if (!window.React) {
                        await $ocLazyLoad.load(getAssetPath('vendor-react.js'));
                    }
                    await $ocLazyLoad.load({
                        name: 'uDispatch.jobSearchJobListReact',
                        files: [getAssetPath('jobSearchJobListReact.js')]
                    });
                }]
            },
            component: "jobSearchComponent",
        });
        return this;
    }

    private configureJobSearchV2State(): this {
        // Phase 3 of the AngularJS → React Job Search migration. Lives in
        // parallel with the existing `/jobSearch` route so we can QA the
        // React shell against staging data before cutting over. Phase 4
        // flips `/jobSearch` to mount this same React module and deletes
        // `wwwroot/app/components/jobSearch/`.
        // See `wwwroot/app/react/pages/job-search/MIGRATION_CHECKLIST.md`.
        this.$stateProvider.state("jobSearchV2", {
            url: "/jobSearchV2?jobId",
            params: {
                jobId: {value: null, squash: true}
            },
            template: `
                <md-content class="md-dense job-search-view" style="height: 100%;">
                    <react-app-shell
                            section="Dashboards"
                            title="Search"
                            messages-count="0"
                            on-messages-click="ctrl.openMessagingDialog($event)"
                            layouts="ctrl.layouts"
                            current-layout-name="ctrl.currentLayoutName"
                            on-save-layout="ctrl.saveLayout()"
                            on-load-layout="ctrl.loadLayout(index)"
                            on-delete-layout="ctrl.deleteLayout(index)"
                            on-settings-click="ctrl.openSettingsDialog($event)"
                            on-create-new-job="ctrl.createNewJob($event)"
                            on-inter-courier-charge="ctrl.interCourierCharge($event)">
                    </react-app-shell>
                    <div style="height: calc(100vh - 64px); overflow: hidden;">
                        <div id="react-job-search-v2" style="height: 100%; overflow: hidden;"></div>
                    </div>
                </md-content>
            `,
            resolve: {
                manifest: ['$http', async ($http: angular.IHttpService) => {
                    try {
                        const response = await $http.get<Record<string, string>>('dist/manifest.json');
                        return response.data;
                    } catch {
                        console.warn('[ROUTES] Failed to load manifest for jobSearchV2 state, using fallback names');
                        return {
                            'vendor-react.js': 'vendor-react.js',
                            'jobSearchReact.js': 'jobSearchReact.js',
                            'jobDetailsReact.js': 'jobDetailsReact.js',
                            'accessorialChargesDialogReact.js': 'accessorialChargesDialogReact.js',
                            'jobFileUploadDialogReact.js': 'jobFileUploadDialogReact.js',
                            'sendPodDialogReact.js': 'sendPodDialogReact.js',
                            'swapPodsDialogReact.js': 'swapPodsDialogReact.js',
                            'bulkPriceUploadDialogReact.js': 'bulkPriceUploadDialogReact.js',
                            'createJobDialogReact.js': 'createJobDialogReact.js',
                            'messagingDialogReact.js': 'messagingDialogReact.js',
                            'dashboardSettingsDialogReact.js': 'dashboardSettingsDialogReact.js'
                        };
                    }
                }],
                loadModule: ['$ocLazyLoad', 'manifest', async ($ocLazyLoad: oc.ILazyLoad, manifest: Record<string, string>) => {
                    const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;
                    if (!window.React) {
                        await $ocLazyLoad.load(getAssetPath('vendor-react.js'));
                    }
                    // Preload the dialog bundles the FAB and toolbar buttons call
                    // through `window.ReactXxx.open(...)`. Each bundle is small;
                    // Phase 4 will revisit the lazy-load strategy as part of the
                    // cutover.
                    const lazyLoads = [
                        {name: 'uDispatch.jobDetailsReact', file: 'jobDetailsReact.js'},
                        {name: 'uDispatch.accessorialChargesDialogReact', file: 'accessorialChargesDialogReact.js'},
                        {name: 'uDispatch.jobFileUploadDialogReact', file: 'jobFileUploadDialogReact.js'},
                        {name: 'uDispatch.sendPodDialogReact', file: 'sendPodDialogReact.js'},
                        {name: 'uDispatch.swapPodsDialogReact', file: 'swapPodsDialogReact.js'},
                        {name: 'uDispatch.bulkPriceUploadDialogReact', file: 'bulkPriceUploadDialogReact.js'},
                        {name: 'uDispatch.createJobDialogReact', file: 'createJobDialogReact.js'},
                        {name: 'uDispatch.messagingDialogReact', file: 'messagingDialogReact.js'},
                        {name: 'uDispatch.dashboardSettingsDialogReact', file: 'dashboardSettingsDialogReact.js'},
                    ];
                    await Promise.all(lazyLoads.map(d => $ocLazyLoad.load({
                        name: d.name,
                        files: [getAssetPath(d.file)],
                    })));
                    await $ocLazyLoad.load({
                        name: 'uDispatch.jobSearchReact',
                        files: [getAssetPath('jobSearchReact.js')]
                    });
                }]
            },
            controller: ['$scope', '$stateParams', 'toastrService', 'APP_CONFIG',
                function (
                    $scope: angular.IScope,
                    $stateParams: angular.ui.IStateParamsService,
                    toastrService: {
                        showSuccessToast: (m: string) => void;
                        showWarningToast: (m: string) => void;
                        showErrorToast: (m: string) => void;
                        showInfoToast: (m: string) => void;
                    },
                    appConfig: { US_Customer: boolean }
                ) {
                    const showToast = (message: string, type: 'success' | 'warning' | 'error' | 'info') => {
                        switch (type) {
                            case 'success': toastrService.showSuccessToast(message); break;
                            case 'warning': toastrService.showWarningToast(message); break;
                            case 'error': toastrService.showErrorToast(message); break;
                            case 'info': toastrService.showInfoToast(message); break;
                        }
                    };

                    // ── Layout storage keys — must match useBoxLayout in JobSearchPage ──
                    const LAYOUTS_KEY = `layoutsCS-${window.ContactID}`;
                    const LAST_ACTIVE_KEY = `lastActiveLayoutCS-${window.ContactID}`;

                    interface ILayoutPayload {
                        columns: Array<{
                            id: string;
                            width: string;
                            boxes: Array<{name: string; height: string}>;
                        }>;
                    }
                    interface ILayout {
                        name: string;
                        layout: ILayoutPayload;
                    }

                    function readLayouts(): ILayout[] {
                        try {
                            const raw = localStorage.getItem(LAYOUTS_KEY);
                            const stored = raw ? (JSON.parse(raw) as ILayout[]) : [];
                            return stored.length > 0 ? stored : [];
                        } catch {
                            return [];
                        }
                    }
                    function writeLayouts(list: ILayout[]): void {
                        localStorage.setItem(LAYOUTS_KEY, JSON.stringify(list));
                    }

                    const ctrl = {
                        layouts: [] as ILayout[],
                        currentLayoutName: undefined as string | undefined,

                        openMessagingDialog: ($event: MouseEvent) => {
                            const w = window as unknown as {
                                ReactMessagingDialog?: { open: (opts?: unknown) => Promise<void> };
                            };
                            void $event;
                            if (w.ReactMessagingDialog) {
                                w.ReactMessagingDialog.open().catch(err =>
                                    console.error('[jobSearchV2] messaging dialog error', err)
                                );
                            } else {
                                toastrService.showErrorToast('Messaging dialog is not loaded.');
                            }
                        },

                        openSettingsDialog: async ($event: MouseEvent) => {
                            void $event;
                            const w = window as unknown as {
                                ReactDashboardSettingsDialog?: {
                                    open: (
                                        config: {
                                            title: string;
                                            showRefreshInterval?: boolean;
                                            showDriverLocationRefresh?: boolean;
                                            showDashboards?: boolean;
                                            showAiToggle?: boolean;
                                            showJobSearchBetaToggle?: boolean;
                                        },
                                        boxes: Record<string, unknown>,
                                        selectedRefreshInterval?: {id: number; text: string},
                                        selectedDriverLocationRefreshInterval?: {id: number; text: string},
                                        aiEnabled?: boolean,
                                        jobSearchBetaEnabled?: boolean,
                                    ) => Promise<{jobSearchBetaEnabled?: boolean; aiEnabled?: boolean} | null>;
                                };
                            };
                            if (!w.ReactDashboardSettingsDialog) {
                                toastrService.showErrorToast('Settings dialog is not loaded.');
                                return;
                            }
                            try {
                                const wasOn = getJobSearchBetaEnabled();
                                const result = await w.ReactDashboardSettingsDialog.open(
                                    {
                                        title: 'Job Search Dashboard Settings',
                                        showJobSearchBetaToggle: true,
                                    },
                                    {},
                                    undefined,
                                    undefined,
                                    undefined,
                                    wasOn,
                                );
                                if (result && result.jobSearchBetaEnabled !== undefined
                                    && result.jobSearchBetaEnabled !== wasOn) {
                                    setJobSearchBetaEnabled(result.jobSearchBetaEnabled);
                                    if (!result.jobSearchBetaEnabled) {
                                        // Operator turned beta OFF — send them back to /jobSearch.
                                        const injector = (window as unknown as {
                                            angular?: {
                                                element: (el: Element) => {
                                                    injector: () => {
                                                        get: (name: string) => angular.ui.IStateService;
                                                    };
                                                };
                                            };
                                        }).angular?.element(document.body).injector();
                                        injector?.get('$state').go('jobSearch');
                                    }
                                }
                            } catch (err) {
                                console.error('[jobSearchV2] settings dialog error', err);
                            }
                        },

                        createNewJob: ($event: MouseEvent) => {
                            const w = window as unknown as {
                                ReactCreateJobDialog?: {
                                    open: (isUsTenant?: boolean, toastService?: unknown) => Promise<number | null>;
                                };
                            };
                            void $event;
                            if (w.ReactCreateJobDialog) {
                                w.ReactCreateJobDialog.open(appConfig.US_Customer).catch(err =>
                                    console.error('[jobSearchV2] create job dialog error', err)
                                );
                            } else {
                                toastrService.showErrorToast('Create job dialog is not loaded.');
                            }
                        },

                        interCourierCharge: ($event: MouseEvent) => {
                            void $event;
                            // The inter-courier dialog is bundled with whichever
                            // page first imports it; if no caller has loaded it
                            // yet, this gracefully degrades. Phase 4 will move
                            // it into the V2 preload bundle list.
                            const w = window as unknown as {
                                openInterCourierChargeDialog?: () => Promise<void>;
                            };
                            if (w.openInterCourierChargeDialog) {
                                w.openInterCourierChargeDialog().catch(err =>
                                    console.error('[jobSearchV2] inter-courier dialog error', err)
                                );
                            } else {
                                toastrService.showErrorToast('Inter-courier dialog is not loaded — open it once from /jobSearch first.');
                            }
                        },

                        saveLayout: () => {
                            const name = window.prompt('Layout name?');
                            if (!name) return;
                            const layouts = readLayouts();
                            const sourceLayout = layouts.find(l => l.name === ctrl.currentLayoutName);
                            const payload = sourceLayout?.layout ?? {columns: []};
                            const next: ILayout = {name, layout: JSON.parse(JSON.stringify(payload))};
                            const updated = [...layouts, next];
                            writeLayouts(updated);
                            localStorage.setItem(LAST_ACTIVE_KEY, name);
                            ctrl.layouts = updated;
                            ctrl.currentLayoutName = name;
                            window.ReactJobSearch?.setCurrentLayoutName(name);
                            window.ReactJobSearch?.reloadLayoutsFromStorage();
                            toastrService.showSuccessToast('Layout saved successfully');
                        },

                        loadLayout: (index: number) => {
                            const layouts = readLayouts();
                            const target = layouts[index];
                            if (!target) return;
                            localStorage.setItem(LAST_ACTIVE_KEY, target.name);
                            ctrl.currentLayoutName = target.name;
                            window.ReactJobSearch?.setCurrentLayoutName(target.name);
                        },

                        deleteLayout: (index: number) => {
                            const layouts = readLayouts();
                            const target = layouts[index];
                            if (!target) return;
                            // Default layout lives only in memory on the React
                            // side; the persisted array starts with custom
                            // layouts. Block index 0 only if it's named "Default".
                            if (target.name === 'Default') return;
                            if (!window.confirm(`Delete layout "${target.name}"?`)) return;
                            const updated = layouts.filter((_, i) => i !== index);
                            writeLayouts(updated);
                            localStorage.setItem(LAST_ACTIVE_KEY, 'Default');
                            ctrl.layouts = updated;
                            ctrl.currentLayoutName = 'Default';
                            window.ReactJobSearch?.setCurrentLayoutName('Default');
                            window.ReactJobSearch?.reloadLayoutsFromStorage();
                            toastrService.showSuccessToast('Layout deleted successfully');
                        },
                    };

                    // Seed the toolbar from localStorage on mount.
                    ctrl.layouts = readLayouts();
                    ctrl.currentLayoutName = localStorage.getItem(LAST_ACTIVE_KEY) ?? 'Default';

                    ($scope as angular.IScope & {ctrl: typeof ctrl}).ctrl = ctrl;

                    const deepLinkJobId = $stateParams.jobId
                        ? parseInt($stateParams.jobId as string, 10)
                        : undefined;

                    window.ReactJobSearch!.mount('react-job-search-v2', {
                        showToast,
                        isUsCustomer: appConfig.US_Customer,
                        timeZone: window.TimeZone || 'New Zealand Standard Time',
                        timeZoneShort: undefined,
                        deepLinkJobId,
                    });

                    $scope.$on('$destroy', () => {
                        window.ReactJobSearch!.unmount();
                    });
                }
            ],
        });
        return this;
    }

    private configurePrebooksState(): this {
        this.$stateProvider.state("recurringJobs", {
            url: "/recurringJobs",
            template: `
                <md-content class="md-dense prebook-view">
                    <style>.prebook-view md-card { margin: 0; }</style>
                    <react-app-shell section="Dashboards" title="Recurring Jobs"></react-app-shell>
                    <div class="dashboard-padding" style="height: calc(100vh - 64px);">
                        <div style="display: flex; height: 100%; padding: 16px;">
                            <div id="react-recurring-jobs-list" style="flex: 1; height: 100%; overflow: hidden;"></div>
                        </div>
                    </div>
                </md-content>
            `,
            resolve: {
                manifest: ['$http', async ($http: angular.IHttpService) => {
                    try {
                        const response = await $http.get<Record<string, string>>('dist/manifest.json');
                        return response.data;
                    } catch {
                        console.warn('[ROUTES] Failed to load manifest for recurringJobs state, using fallback names');
                        return {
                            'vendor-react.js': 'vendor-react.js',
                            'recurringJobsReact.js': 'recurringJobsReact.js'
                        };
                    }
                }],
                loadModule: ['$ocLazyLoad', 'manifest', async ($ocLazyLoad: oc.ILazyLoad, manifest: Record<string, string>) => {
                    const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;
                    // Load vendor-react first (React, ReactDOM, React Query)
                    await $ocLazyLoad.load(getAssetPath('vendor-react.js'));
                    // Then load the recurring jobs React module
                    return $ocLazyLoad.load(getAssetPath('recurringJobsReact.js'));
                }]
            },
            controller: ['$scope', 'toastrService', 'jobAddStopService', 'APP_CONFIG',
                function (
                    $scope: angular.IScope,
                    toastrService: {
                        showSuccessToast: (m: string) => void;
                        showWarningToast: (m: string) => void;
                        showErrorToast: (m: string) => void;
                        showInfoToast: (m: string) => void
                    },
                    jobAddStopService: { addRecurringJobStop: (job: unknown, isPickup: boolean) => Promise<void> },
                    appConfig: { US_Customer: boolean }
                ) {
                    const showToast = (message: string, type: 'success' | 'warning' | 'error' | 'info') => {
                        switch (type) {
                            case 'success':
                                toastrService.showSuccessToast(message);
                                break;
                            case 'warning':
                                toastrService.showWarningToast(message);
                                break;
                            case 'error':
                                toastrService.showErrorToast(message);
                                break;
                            case 'info':
                                toastrService.showInfoToast(message);
                                break;
                        }
                    };

                    const onAddStop = async (job: unknown, isPickup: boolean) => {
                        await jobAddStopService.addRecurringJobStop(job, isPickup);
                    };

                    window.ReactRecurringJobs!.mount('react-recurring-jobs-list', {
                        showToast,
                        isUsCustomer: appConfig.US_Customer,
                        onAddStop,
                    });

                    $scope.$on('$destroy', () => {
                        window.ReactRecurringJobs!.unmount();
                    });
                }
            ],
        });
        return this;
    }

    private configureOverviewState(): this {
        this.$stateProvider.state("overview", {
            url: "/overview",
            template: `
                <md-content class="md-dense" style="height: 100%;">
                    <react-app-shell section="Dashboards" title="Overview"></react-app-shell>
                    <div class="scrollable-container" style="height: calc(100vh - 64px); overflow: auto;">
                        <div id="react-overview"></div>
                    </div>
                </md-content>
            `,
            resolve: {
                manifest: ['$http', async ($http: angular.IHttpService) => {
                    try {
                        const response = await $http.get<Record<string, string>>('dist/manifest.json');
                        return response.data;
                    } catch {
                        console.warn('[ROUTES] Failed to load manifest for overview state, using fallback names');
                        return {
                            'vendor-react.js': 'vendor-react.js',
                            'overviewReact.js': 'overviewReact.js'
                        };
                    }
                }],
                loadModule: ['$ocLazyLoad', 'manifest', async ($ocLazyLoad: oc.ILazyLoad, manifest: Record<string, string>) => {
                    const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;
                    // Load vendor-react first (React, ReactDOM)
                    await $ocLazyLoad.load(getAssetPath('vendor-react.js'));
                    // Then load the overview React module
                    return $ocLazyLoad.load(getAssetPath('overviewReact.js'));
                }]
            },
            controller: ['$scope', 'toastrService', 'APP_CONFIG',
                function (
                    $scope: angular.IScope,
                    toastrService: {
                        showSuccessToast: (m: string) => void;
                        showWarningToast: (m: string) => void;
                        showErrorToast: (m?: string) => void;
                        showInfoToast: (m: string) => void;
                    },
                    appConfig: { US_Customer: boolean }
                ) {
                    const showToast = {
                        showSuccessToast: (m: string) => toastrService.showSuccessToast(m),
                        showWarningToast: (m: string) => toastrService.showWarningToast(m),
                        showErrorToast: (m?: string) => toastrService.showErrorToast(m),
                        showInfoToast: (m: string) => toastrService.showInfoToast(m),
                    };

                    window.ReactOverview!.mount('react-overview', {
                        showToast,
                        isUsCustomer: appConfig.US_Customer,
                        onOpenJobDetail: (jobId: number) => openJobInSearch(jobId),
                    });

                    $scope.$on('$destroy', () => {
                        window.ReactOverview!.unmount();
                    });
                }
            ],
        });
        return this;
    }

    private configureTaskDashboardState(): this {
        this.$stateProvider.state("taskDashboard", {
            url: "/taskDashboard",
            template: `
                <md-content class="md-dense task-dashboard-view">
                    <react-app-shell
                        section="Dashboards"
                        title="Task Dashboard"
                        layouts="layouts"
                        current-layout-name="currentLayoutName"
                        on-save-layout="saveLayout()"
                        on-load-layout="loadLayout(index)"
                        on-delete-layout="deleteLayout(index)">
                    </react-app-shell>
                    <div class="dashboard-padding" style="height: calc(100vh - 64px);">
                        <div style="display: flex; height: 100%; padding: 16px;">
                            <div id="react-task-dashboard" style="flex: 1; height: 100%; overflow: hidden;"></div>
                        </div>
                    </div>
                </md-content>
            `,
            resolve: {
                manifest: ['$http', async ($http: angular.IHttpService) => {
                    try {
                        const response = await $http.get<Record<string, string>>('dist/manifest.json');
                        return response.data;
                    } catch {
                        console.warn('[ROUTES] Failed to load manifest for taskDashboard state, using fallback names');
                        return {
                            'vendor-react.js': 'vendor-react.js',
                            'taskDashboardReact.js': 'taskDashboardReact.js'
                        };
                    }
                }],
                loadModule: ['$ocLazyLoad', 'manifest', async ($ocLazyLoad: oc.ILazyLoad, manifest: Record<string, string>) => {
                    const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;
                    // Load vendor-react first (React, ReactDOM)
                    await $ocLazyLoad.load(getAssetPath('vendor-react.js'));
                    // Then load the task dashboard React module
                    return $ocLazyLoad.load(getAssetPath('taskDashboardReact.js'));
                }]
            },
            controller: ['$scope', 'toastrService', 'APP_CONFIG',
                function (
                    $scope: angular.IScope & {
                        layouts: { name: string }[];
                        currentLayoutName: string;
                        saveLayout: () => void;
                        loadLayout: (index: number) => void;
                        deleteLayout: (index: number) => void;
                    },
                    toastrService: {
                        showSuccessToast: (m: string) => void;
                        showWarningToast: (m: string) => void;
                        showErrorToast: (m: string) => void;
                        showInfoToast: (m: string) => void
                    },
                    appConfig: { US_Customer: boolean }
                ) {
                    // Layout state - will be updated by React component
                    $scope.layouts = [];
                    $scope.currentLayoutName = 'Default';

                    // Layout action callbacks - will be set by React component
                    let reactSaveLayout: (() => void) | null = null;
                    let reactLoadLayout: ((index: number) => void) | null = null;
                    let reactDeleteLayout: ((index: number) => void) | null = null;

                    // Callbacks exposed to template that delegate to React
                    $scope.saveLayout = () => {
                        console.log('[TaskDashboard] saveLayout called, reactSaveLayout:', !!reactSaveLayout);
                        if (reactSaveLayout) {
                            reactSaveLayout();
                        } else {
                            console.warn('[TaskDashboard] reactSaveLayout not set yet');
                        }
                    };

                    $scope.loadLayout = (index: number) => {
                        console.log('[TaskDashboard] loadLayout called, index:', index);
                        if (reactLoadLayout) {
                            reactLoadLayout(index);
                        }
                    };

                    $scope.deleteLayout = (index: number) => {
                        console.log('[TaskDashboard] deleteLayout called, index:', index);
                        if (reactDeleteLayout) {
                            reactDeleteLayout(index);
                        }
                    };

                    const showToast = (message: string, type: 'success' | 'warning' | 'error' | 'info') => {
                        switch (type) {
                            case 'success':
                                toastrService.showSuccessToast(message);
                                break;
                            case 'warning':
                                toastrService.showWarningToast(message);
                                break;
                            case 'error':
                                toastrService.showErrorToast(message);
                                break;
                            case 'info':
                                toastrService.showInfoToast(message);
                                break;
                        }
                    };

                    // Called by React component when layout actions change
                    const onLayoutActionsChange = (actions: {
                        layouts: { name: string }[];
                        currentLayoutName: string;
                        onSaveLayout: () => void;
                        onLoadLayout: (index: number) => void;
                        onDeleteLayout: (index: number) => void;
                    }) => {
                        console.log('[TaskDashboard] onLayoutActionsChange called with', actions.layouts.length, 'layouts');

                        // Update scope with layout data
                        $scope.layouts = actions.layouts;
                        $scope.currentLayoutName = actions.currentLayoutName;

                        // Store React callbacks
                        reactSaveLayout = actions.onSaveLayout;
                        reactLoadLayout = actions.onLoadLayout;
                        reactDeleteLayout = actions.onDeleteLayout;

                        // Trigger Angular digest cycle if not already in one
                        if (!$scope.$$phase && !$scope.$root.$$phase) {
                            $scope.$apply();
                        }
                    };

                    window.ReactTaskDashboard!.mount('react-task-dashboard', {
                        showToast,
                        isUsCustomer: appConfig.US_Customer,
                        onLayoutActionsChange,
                    });

                    $scope.$on('$destroy', () => {
                        window.ReactTaskDashboard!.unmount();
                    });
                }
            ],
        });
        return this;
    }

    private configureDriverManagementState(): this {
        this.$stateProvider.state("driverManagement", {
            url: "/driverManagement",
            template: `
                <md-content class="md-dense" style="height: 100%;">
                    <react-app-shell section="Operations" title="Drivers"></react-app-shell>
                    <div id="react-driver-management" style="height: calc(100vh - 64px);"></div>
                </md-content>
            `,
            resolve: {
                manifest: ['$http', async ($http: angular.IHttpService) => {
                    try {
                        const response = await $http.get<Record<string, string>>('dist/manifest.json');
                        return response.data;
                    } catch {
                        console.warn('[ROUTES] Failed to load manifest for driverManagement state, using fallback names');
                        return {
                            'vendor-react.js': 'vendor-react.js',
                            'driverManagementReact.js': 'driverManagementReact.js',
                            'composeEmailDialogReact.js': 'composeEmailDialogReact.js',
                            'editAfterhoursDialogReact.js': 'editAfterhoursDialogReact.js'
                        };
                    }
                }],
                loadModule: ['$ocLazyLoad', 'manifest', async ($ocLazyLoad: oc.ILazyLoad, manifest: Record<string, string>) => {
                    const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;
                    await $ocLazyLoad.load(getAssetPath('vendor-react.js'));
                    await $ocLazyLoad.load(getAssetPath('composeEmailDialogReact.js'));
                    await $ocLazyLoad.load(getAssetPath('editAfterhoursDialogReact.js'));
                    return $ocLazyLoad.load(getAssetPath('driverManagementReact.js'));
                }]
            },
            controller: ['$scope', 'toastrService', 'APP_CONFIG',
                function (
                    $scope: angular.IScope,
                    toastrService: {
                        showSuccessToast: (m: string) => void;
                        showWarningToast: (m: string) => void;
                        showErrorToast: (m: string) => void;
                        showInfoToast: (m: string) => void
                    },
                    appConfig: { US_Customer: boolean }
                ) {
                    const showToast = (message: string, type: 'success' | 'warning' | 'error' | 'info') => {
                        switch (type) {
                            case 'success':
                                toastrService.showSuccessToast(message);
                                break;
                            case 'warning':
                                toastrService.showWarningToast(message);
                                break;
                            case 'error':
                                toastrService.showErrorToast(message);
                                break;
                            case 'info':
                                toastrService.showInfoToast(message);
                                break;
                        }
                    };

                    window.ReactDriverManagement!.mount('react-driver-management', {
                        showToast,
                        isUsCustomer: appConfig.US_Customer,
                    });

                    $scope.$on('$destroy', () => {
                        window.ReactDriverManagement!.unmount();
                    });
                }
            ],
        });
        return this;
    }

    private configureCourierMapState(): this {
        this.$stateProvider.state("courierMap", {
            url: "/courierMap",
            template: `
                <react-app-shell section="Operations" title="Courier Map"></react-app-shell>
                <div id="react-courier-map" style="height: calc(100vh - 64px);"></div>
            `,
            resolve: {
                manifest: ['$http', async ($http: angular.IHttpService) => {
                    try {
                        const response = await $http.get<Record<string, string>>('dist/manifest.json');
                        return response.data;
                    } catch {
                        console.warn('[ROUTES] Failed to load manifest for courierMap state, using fallback names');
                        return {
                            'vendor-react.js': 'vendor-react.js',
                            'courierMapReact.js': 'courierMapReact.js'
                        };
                    }
                }],
                loadModule: ['$ocLazyLoad', 'manifest', async ($ocLazyLoad: oc.ILazyLoad, manifest: Record<string, string>) => {
                    const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;
                    // Load vendor-react first (React, ReactDOM, React Query)
                    await $ocLazyLoad.load(getAssetPath('vendor-react.js'));
                    // Then load the courier map React module + CSS
                    const files = [getAssetPath('courierMapReact.js')];
                    const cssFile = manifest['courierMapReact.css'];
                    if (cssFile) files.push(`dist/${cssFile}`);
                    return $ocLazyLoad.load(files);
                }],
                hereMapsApiKey: ['configService', async (configService: any) => {
                    try {
                        return await configService.getHereMapsKey();
                    } catch (error) {
                        console.error('[ROUTES] Failed to get HERE Maps API key:', error);
                        return null;
                    }
                }]
            },
            controller: ['$scope', 'APP_CONFIG', 'hereMapsApiKey',
                function (
                    $scope: angular.IScope,
                    appConfig: {
                        US_Customer: boolean;
                        US_Coordinates_Center?: { lat: number; lng: number };
                        NZ_Coordinates_Center?: { lat: number; lng: number }
                    },
                    hereMapsApiKey: string | null
                ) {
                    const isUsCustomer = appConfig?.US_Customer ?? false;
                    const mapCenter = isUsCustomer
                        ? appConfig?.US_Coordinates_Center ?? {lat: 39.8097343, lng: -98.5556199}
                        : appConfig?.NZ_Coordinates_Center ?? {lat: -41.2865, lng: 174.7762};

                    window.ReactCourierMap!.mount('react-courier-map', {
                        isUsCustomer,
                        mapCenter,
                        apiKey: hereMapsApiKey,
                    });

                    $scope.$on('$destroy', () => {
                        window.ReactCourierMap!.unmount();
                    });
                }
            ],
        });
        return this;
    }

    private buildErrorState(errorType: ErrorType, url: string): angular.ui.IState {
        return {
            url,
            template: `<div id="react-error-page-${errorType}" style="height: 100%;"></div>`,
            resolve: {
                manifest: ['$http', async ($http: angular.IHttpService) => {
                    try {
                        const response = await $http.get<Record<string, string>>('dist/manifest.json');
                        return response.data;
                    } catch {
                        return {'vendor-react.js': 'vendor-react.js', 'errorPageReact.js': 'errorPageReact.js'};
                    }
                }],
                loadModule: ['$ocLazyLoad', 'manifest', async ($ocLazyLoad: oc.ILazyLoad, manifest: Record<string, string>) => {
                    const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;
                    await $ocLazyLoad.load(getAssetPath('vendor-react.js'));
                    return $ocLazyLoad.load(getAssetPath('errorPageReact.js'));
                }]
            },
            controller: ['$scope', '$state', function ($scope: angular.IScope, $state: angular.ui.IStateService) {
                const containerId = `react-error-page-${errorType}`;
                window.ReactErrorPage!.mount(containerId, {
                    errorType,
                    onGoHome: () => $state.go('home'),
                    onGoBack: () => window.history.back(),
                });
                $scope.$on('$destroy', () => {
                    window.ReactErrorPage!.unmount();
                });
            }]
        };
    }

    private configureErrorStates(): this {
        this.$stateProvider.state("notFound", this.buildErrorState("notFound", "/not-found"));
        this.$stateProvider.state("error", this.buildErrorState("error", "/error"));
        this.$stateProvider.state("forbidden", this.buildErrorState("forbidden", "/forbidden"));
        this.$stateProvider.state("serverError", this.buildErrorState("serverError", "/server-error"));
        return this;
    }
}

export default RouterConfig;