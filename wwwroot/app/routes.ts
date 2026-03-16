import IDfrntStateParams from "./interfaces/DfrntStateParams.interface";
import angular from 'angular';
import type {ErrorType} from './react/pages/error-page/ErrorPage';

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
                loadModule: ['$ocLazyLoad', 'manifest', ($ocLazyLoad: oc.ILazyLoad, manifest: Record<string, string>) => {
                    const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;
                    return $ocLazyLoad.load([
                        getAssetPath('home.js'),
                        getAssetPath('home.css')
                    ]);
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
                            'nationwide.css': 'nationwide.css'
                        };
                    }
                }],
                loadModule: ['$ocLazyLoad', 'manifest', ($ocLazyLoad: oc.ILazyLoad, manifest: Record<string, string>) => {
                    const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;
                    return $ocLazyLoad.load([
                        getAssetPath('nationwide.js'),
                        getAssetPath('nationwide.css')
                    ]);
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
            url: "/jobSearch",
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
                loadModule: ['$ocLazyLoad', 'manifest', ($ocLazyLoad: oc.ILazyLoad, manifest: Record<string, string>) => {
                    const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;
                    return $ocLazyLoad.load([
                        getAssetPath('jobSearch.js'),
                        getAssetPath('jobSearch.css')
                    ]);
                }]
            },
            component: "jobSearchComponent",
        });
        return this;
    }

    private configurePrebooksState(): this {
        this.$stateProvider.state("recurringJobs", {
            url: "/recurringJobs",
            template: `
                <md-content class="md-dense prebook-view">
                    <style>.prebook-view md-card { margin: 0; }</style>
                    <react-app-shell title="Recurring Jobs Dashboard"></react-app-shell>
                    <div class="dashboard-padding" style="height: calc(100vh - 64px);">
                        <div style="display: flex; height: 100%; gap: 16px; padding: 16px;">
                            <div id="react-recurring-jobs-list" style="flex: 0 0 55%; height: 100%; overflow: hidden;"></div>
                            <div style="flex: 0 0 45%; height: 100%; display: flex; flex-direction: column; overflow: hidden; min-width: 0;">
                                <md-card style="flex: 1; display: flex; flex-direction: column; overflow: hidden; border-radius: 4px; min-height: 0; min-width: 0;">
                                    <div style="min-height: 48px; height: 48px; width: 100%; background-color: var(--theme-primary); padding: 0 16px; box-sizing: border-box; line-height: 48px; text-align: left; flex-shrink: 0;">
                                        <md-icon md-font-set="material-symbols-outlined" style="vertical-align: middle; margin-right: 8px; color: rgba(0,0,0,0.87);">info</md-icon>
                                        <span style="font-size: 16px; font-weight: 500; color: rgba(0,0,0,0.87); vertical-align: middle;">Job Details</span>
                                        <span ng-if="selectedJobId" style="font-size: 16px; font-weight: 500; color: rgba(0,0,0,0.87); vertical-align: middle;"> - Job #{{selectedJobId}}</span>
                                    </div>
                                    <md-card-content style="flex: 1; overflow: auto; padding: 0; min-height: 0;">
                                        <job-detail-widget
                                            style="height: 100%; display: block; width: 100%; max-width: 100%;"
                                            job-id="selectedJobId"
                                            is-recurring-job="true"
                                            on-job-update="onJobUpdate()">
                                        </job-detail-widget>
                                    </md-card-content>
                                </md-card>
                            </div>
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
                    $scope: angular.IScope & { selectedJobId?: number; onJobUpdate: () => void },
                    toastrService: {
                        showSuccessToast: (m: string) => void;
                        showWarningToast: (m: string) => void;
                        showErrorToast: (m: string) => void;
                        showInfoToast: (m: string) => void
                    },
                    jobAddStopService: { addRecurringJobStop: (job: unknown, isPickup: boolean) => Promise<void> },
                    appConfig: { US_Customer: boolean }
                ) {
                    $scope.selectedJobId = undefined;
                    $scope.onJobUpdate = () => {
                        // Trigger React refresh
                        if (window.ReactRecurringJobs?.refresh) {
                            window.ReactRecurringJobs.refresh();
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

                    const onAddStop = async (job: unknown, isPickup: boolean) => {
                        await jobAddStopService.addRecurringJobStop(job, isPickup);
                    };

                    const onJobSelect = (jobId: number | null) => {
                        $scope.selectedJobId = jobId ?? undefined;
                        $scope.$apply();
                    };

                    window.ReactRecurringJobs!.mount('react-recurring-jobs-list', {
                        showToast,
                        isUsCustomer: appConfig.US_Customer,
                        onAddStop,
                        onJobSelect,
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
                    <react-app-shell title="Overview Dashboard"></react-app-shell>
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
            controller: ['$scope', 'toastrService', 'APP_CONFIG', 'navigationService',
                function (
                    $scope: angular.IScope,
                    toastrService: {
                        showSuccessToast: (m: string) => void;
                        showWarningToast: (m: string) => void;
                        showErrorToast: (m?: string) => void;
                        showInfoToast: (m: string) => void;
                    },
                    appConfig: { US_Customer: boolean },
                    navigationService: { openJobDetail: (jobId: number) => void }
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
                        onOpenJobDetail: (jobId: number) => navigationService.openJobDetail(jobId),
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
                        title="Task Dashboard"
                        layouts="layouts"
                        current-layout-name="currentLayoutName"
                        on-save-layout="saveLayout()"
                        on-load-layout="loadLayout(index)"
                        on-delete-layout="deleteLayout(index)">
                    </react-app-shell>
                    <div class="dashboard-padding" style="height: calc(100vh - 64px);">
                        <div style="display: flex; height: 100%; gap: 16px; padding: 16px;">
                            <div id="react-task-dashboard" style="flex: 0 0 60%; height: 100%; overflow: hidden;"></div>
                            <div style="flex: 0 0 40%; height: 100%; display: flex; flex-direction: column;">
                                <md-card style="flex: 1; display: flex; flex-direction: column; overflow: hidden; border-radius: 4px;">
                                    <div style="min-height: 48px; height: 48px; width: 100%; background-color: var(--theme-primary); padding: 0 16px; box-sizing: border-box; line-height: 48px; text-align: left;">
                                        <md-icon md-font-set="material-symbols-outlined" style="vertical-align: middle; margin-right: 8px; color: rgba(0,0,0,0.87);">info</md-icon>
                                        <span style="font-size: 16px; font-weight: 500; color: rgba(0,0,0,0.87); vertical-align: middle;">Job Details</span>
                                        <span ng-if="selectedJobId" style="font-size: 16px; font-weight: 500; color: rgba(0,0,0,0.87); vertical-align: middle;"> - Job #{{selectedJobId}}</span>
                                    </div>
                                    <md-card-content style="flex: 1; overflow: auto; padding: 0;">
                                        <job-detail-widget
                                            style="height: 100%; display: block;"
                                            job-id="selectedJobId">
                                        </job-detail-widget>
                                    </md-card-content>
                                </md-card>
                            </div>
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
                        selectedJobId?: number;
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
                    $scope.selectedJobId = undefined;

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

                    const onTaskSelect = (task: { jobId?: number } | null) => {
                        $scope.selectedJobId = task?.jobId;
                        $scope.$apply();
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
                        onTaskSelect,
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
                    <react-app-shell title="Driver Management"></react-app-shell>
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
                            case 'success': toastrService.showSuccessToast(message); break;
                            case 'warning': toastrService.showWarningToast(message); break;
                            case 'error': toastrService.showErrorToast(message); break;
                            case 'info': toastrService.showInfoToast(message); break;
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
                <react-app-shell title="Courier Map"></react-app-shell>
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
                    appConfig: { US_Customer: boolean; US_Coordinates_Center?: { lat: number; lng: number }; NZ_Coordinates_Center?: { lat: number; lng: number } },
                    hereMapsApiKey: string | null
                ) {
                    const isUsCustomer = appConfig?.US_Customer ?? false;
                    const mapCenter = isUsCustomer
                        ? appConfig?.US_Coordinates_Center ?? { lat: 39.8097343, lng: -98.5556199 }
                        : appConfig?.NZ_Coordinates_Center ?? { lat: -41.2865, lng: 174.7762 };

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
                        return { 'vendor-react.js': 'vendor-react.js', 'errorPageReact.js': 'errorPageReact.js' };
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