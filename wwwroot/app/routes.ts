import IDfrntStateParams from "./interfaces/DfrntStateParams.interface";

/**
 * The JS bundle for an island plus its stylesheet, when the build emitted one.
 *
 * Islands that use a `*.module.css` (the job-list table, for one) get a sibling
 * CSS entry in the manifest; loading only the `.js` leaves them unstyled.
 */
function islandFiles(manifest: Record<string, string>, entry: string): string[] {
    const asset = (filename: string) => `dist/${manifest[filename] || filename}`;
    const files = [asset(`${entry}.js`)];
    if (manifest[`${entry}.css`]) {
        files.push(asset(`${entry}.css`));
    }
    return files;
}
import angular from 'angular';
import type {ErrorType} from './react/pages/error-page/ErrorPage';
import {openJobInSearch} from './react/services/navigationService';
import {BELOW_APP_BAR_HEIGHT} from './react/components/common/app-toolbar/appBarMetrics';
import {getNationwideBetaEnabled, setNationwideBetaEnabled} from './react/pages/nationwide/lib/betaPreference';
import {createDefaultNationwideLayout, createNationwideBoxes} from './react/pages/nationwide/lib/boxDefinitions';
import {buildRefreshIntervalOptions, resolveSavedInterval} from './react/pages/nationwide/lib/refreshInterval';
import {
    loadBoxVisibility,
    saveBoxVisibility,
    mergeBoxVisibility,
} from './react/components/common/box-shell/layoutPersistence';
import {createLayoutToolbarActions} from './functions/layoutToolbarActions';
import {createDefaultJobSearchLayout, createJobSearchBoxes} from './react/pages/job-search/lib/boxDefinitions';
import {createDefaultDispatchLayout, createDispatchBoxes} from './react/pages/dispatch/lib/boxDefinitions';
import {
    loadDateFilter as loadDispatchDateFilter,
    DATE_FILTER_KEY as DISPATCH_DATE_FILTER_KEY,
    REFRESH_INTERVAL_KEY as DISPATCH_REFRESH_INTERVAL_KEY,
    DRIVER_LOCATION_REFRESH_KEY as DISPATCH_DRIVER_LOC_REFRESH_KEY,
    TASK_REFRESH_KEY as DISPATCH_TASK_REFRESH_KEY,
} from './react/pages/dispatch/lib/dispatchFilters';
import type {DfrntPageViewModel} from './interfaces/dfrnt-page-view-model.interface';
import type IDateFilterData from './interfaces/date-filter-data.interface';
import type {IBox, ILayout} from './interfaces/layout.interfaces';
import {AppPage} from './enums/app-pages.enum';
import {isAiEnabled, setAiEnabled} from './functions/aiSettings';
import isDefaultLayout from './functions/isDefaultLayout';

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
            .configureDispatchState()
            .configureDispatchV2RedirectState()
            .configureNationwideState()
            .configureNationwideV2State()
            .configureCSState()
            .configureJobSearchState()
            .configureJobSearchV2RedirectState()
            .configurePrebooksState()
            .configureOverviewState()

            .configureTaskDashboardState()
            .configureDriverManagementState()
            .configureCourierMapState()
            .configureErrorStates();
    }

    private configureHomeState(): this {
        // Kept as a thin redirect so bookmarks to `/` and `/?jobId=123` keep
        // working — the classic AngularJS dispatch page has been deleted and
        // React is the only implementation now.
        this.$stateProvider.state("home", {
            url: "/?jobId",
            params: {
                jobId: {
                    value: null,
                    squash: true
                }
            },
            redirectTo: (trans: any) => {
                const jobId = trans.params()?.jobId;
                return {state: 'dispatch', params: jobId ? {jobId} : {}};
            }
        });
        return this;
    }

    private configureDispatchState(): this {
        // React rebuild of the main dispatch page (`home`/`/`). The classic
        // AngularJS `home` state now redirects here unconditionally — see
        // `configureHomeState`.
        this.$stateProvider.state("dispatch", {
            url: "/dispatch?jobId",
            params: {
                jobId: {value: null, squash: true}
            },
            template: `
                <div class="dispatch-view" style="height: 100%; position: relative;">
                    <react-app-shell
                            section="Dashboards"
                            title="Dispatch"
                            messages-count="ctrl.unreadMessageCount"
                            on-messages-click="ctrl.openMessagingDialog($event)"
                            views="ctrl.views"
                            views-loading="!ctrl.viewsInitialized"
                            on-toggle-view="ctrl.toggleView(view)"
                            on-clear-all-views="ctrl.clearAllViews()"
                            layouts="ctrl.layouts"
                            current-layout-name="ctrl.currentLayoutName"
                            on-save-layout="ctrl.saveLayout()"
                            on-load-layout="ctrl.loadLayout(index)"
                            on-delete-layout="ctrl.deleteLayout(index)"
                            on-rename-layout="ctrl.renameLayout(index)"
                            on-import-layouts="ctrl.importLayouts()"
                            on-settings-click="ctrl.openSettingsDialog($event)"
                            on-customize-panels="ctrl.openCustomizePanelsDialog()"
                            on-reset-layout="ctrl.resetLayout()"
                            column-edit-mode="ctrl.columnEditMode"
                            on-toggle-column-edit-mode="ctrl.toggleColumnEditMode()"
                            date-filter-data="ctrl.dateFilterData"
                            app-page="home"
                            on-date-filter-refresh="ctrl.refreshDataTimeSpan(dateFilterData)"
                            on-create-new-job="ctrl.createNewJob($event)"
                            on-inter-courier-charge="ctrl.interCourierCharge($event)">
                    </react-app-shell>
                    <div style="height: ${BELOW_APP_BAR_HEIGHT}; overflow: hidden;">
                        <div id="react-dispatch-v2" style="height: 100%; overflow: hidden;"></div>
                    </div>
                </div>
            `,
            resolve: {
                manifest: ['$http', async ($http: angular.IHttpService) => {
                    try {
                        const response = await $http.get<Record<string, string>>('dist/manifest.json');
                        return response.data;
                    } catch {
                        console.warn('[ROUTES] Failed to load manifest for dispatch state, using fallback names');
                        return {
                            'vendor-react.js': 'vendor-react.js',
                            'dispatchReact.js': 'dispatchReact.js',
                            'jobDetailsReact.js': 'jobDetailsReact.js',
                            'messagingDialogReact.js': 'messagingDialogReact.js',
                            'createJobDialogReact.js': 'createJobDialogReact.js',
                            'dashboardSettingsDialogReact.js': 'dashboardSettingsDialogReact.js',
                            'accessorialChargesDialogReact.js': 'accessorialChargesDialogReact.js',
                            'jobFileUploadDialogReact.js': 'jobFileUploadDialogReact.js',
                            'swapPodsDialogReact.js': 'swapPodsDialogReact.js'
                        };
                    }
                }],
                loadModule: ['$ocLazyLoad', 'manifest', async ($ocLazyLoad: oc.ILazyLoad, manifest: Record<string, string>) => {
                    const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;
                    if (!window.React) {
                        await $ocLazyLoad.load(getAssetPath('vendor-react.js'));
                    }
                    const lazyLoads = [
                        {name: 'uDispatch.jobDetailsReact', file: 'jobDetailsReact.js'},
                        {name: 'uDispatch.messagingDialogReact', file: 'messagingDialogReact.js'},
                        {name: 'uDispatch.createJobDialogReact', file: 'createJobDialogReact.js'},
                        {name: 'uDispatch.dashboardSettingsDialogReact', file: 'dashboardSettingsDialogReact.js'},
                        {name: 'uDispatch.accessorialChargesDialogReact', file: 'accessorialChargesDialogReact.js'},
                        {name: 'uDispatch.jobFileUploadDialogReact', file: 'jobFileUploadDialogReact.js'},
                        {name: 'uDispatch.swapPodsDialogReact', file: 'swapPodsDialogReact.js'},
                    ];
                    await Promise.all(lazyLoads.map(d => $ocLazyLoad.load({
                        name: d.name,
                        files: islandFiles(manifest, d.file.replace(/\.js$/, '')),
                    })));
                    const dispatchFiles = [getAssetPath('dispatchReact.js')];
                    if (manifest['dispatchReact.css']) {
                        dispatchFiles.push(getAssetPath('dispatchReact.css'));
                    }
                    await $ocLazyLoad.load({
                        name: 'uDispatch.dispatchReact',
                        files: dispatchFiles
                    });
                }]
            },
            controller: ['$scope', '$stateParams', 'toastrService', 'APP_CONFIG', '$http', '$interval',
                function (
                    $scope: angular.IScope,
                    $stateParams: angular.ui.IStateParamsService,
                    toastrService: {
                        showSuccessToast: (m: string) => void;
                        showWarningToast: (m: string) => void;
                        showErrorToast: (m: string) => void;
                        showInfoToast: (m: string) => void;
                    },
                    appConfig: { US_Customer: boolean },
                    $http: angular.IHttpService,
                    $interval: angular.IIntervalService
                ) {
                    const showToast = (message: string, type: 'success' | 'warning' | 'error' | 'info') => {
                        switch (type) {
                            case 'success': toastrService.showSuccessToast(message); break;
                            case 'warning': toastrService.showWarningToast(message); break;
                            case 'error': toastrService.showErrorToast(message); break;
                            case 'info': toastrService.showInfoToast(message); break;
                        }
                    };

                    // ── Layout storage keys — must match useBoxLayout in DispatchPage ──
                    const layoutStorageKeys = {
                        layoutsKey: `layoutV2-${window.ContactID}`,
                        lastActiveLayoutKey: `lastActiveLayoutV2-${window.ContactID}`,
                        boxVisibilityKeyBase: `boxVisibilityV2-${AppPage.Dispatch}-${window.ContactID}`,
                    };
                    const defaultLayout = createDefaultDispatchLayout();

                    // ── Date filter — scopes the job list & driver locations,
                    // pushed into React via window.ReactDispatch.updateFilters.
                    // Persisted under the same key V1 home uses. The view
                    // selection is owned by React (the job list's views rail);
                    // the toolbar menu below is a mirror of it. ──
                    const initialDate = loadDispatchDateFilter();
                    const pushFilters = () => {
                        window.ReactDispatch?.updateFilters({
                            startDate: ctrl.dateFilterData.startDate,
                            endDate: ctrl.dateFilterData.endDate,
                            useTime: ctrl.dateFilterData.useTime,
                        });
                    };

                    const ctrl = {
                        layouts: [] as ILayout[],
                        currentLayoutName: undefined as string | undefined,
                        views: [] as DfrntPageViewModel[],
                        viewsInitialized: false,
                        unreadMessageCount: 0,
                        columnEditMode: false,

                        toggleColumnEditMode: () => {
                            ctrl.columnEditMode = !ctrl.columnEditMode;
                            window.ReactDispatch?.setColumnEditMode(ctrl.columnEditMode);
                        },

                        resetLayout: () => {
                            const layoutName = ctrl.currentLayoutName ?? 'Default';
                            if (!window.confirm(
                                `Reset "${layoutName}" to the default arrangement? Panel sizes, order and visibility will be restored.`,
                            )) return;
                            window.ReactDispatch?.resetCurrentLayout();
                        },

                        interCourierCharge: ($event: MouseEvent) => {
                            void $event;
                            window.ReactDispatch?.openInterCourierCharge();
                        },
                        dateFilterData: {
                            startDate: initialDate.startDate,
                            endDate: initialDate.endDate,
                            useTime: initialDate.useTime,
                        } as IDateFilterData,

                        toggleView: (_view: DfrntPageViewModel) => {
                            // The directive has already flipped `selected` on the
                            // matching ctrl.views item; hand the new selection to
                            // React, which owns it and echoes it back below.
                            window.ReactDispatch?.setViewSelection(
                                ctrl.views.filter(v => v.selected).map(v => v.id),
                            );
                        },

                        clearAllViews: () => {
                            window.ReactDispatch?.setViewSelection([]);
                        },

                        refreshDataTimeSpan: (dateFilterData: IDateFilterData) => {
                            ctrl.dateFilterData = dateFilterData;
                            try {
                                localStorage.setItem(DISPATCH_DATE_FILTER_KEY, JSON.stringify(dateFilterData));
                            } catch { /* ignore */ }
                            pushFilters();
                        },

                        openMessagingDialog: ($event: MouseEvent) => {
                            const w = window as unknown as {
                                ReactMessagingDialog?: { open: (opts?: unknown) => Promise<void> };
                            };
                            void $event;
                            if (w.ReactMessagingDialog) {
                                w.ReactMessagingDialog.open().catch(err =>
                                    console.error('[dispatch] messaging dialog error', err)
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
                                            showTaskRefresh?: boolean;
                                            showAiToggle?: boolean;
                                        },
                                        selectedRefreshInterval?: {id: number; text: string},
                                        selectedDriverLocationRefreshInterval?: {id: number; text: string},
                                        selectedTaskRefreshInterval?: {id: number; text: string},
                                        aiEnabled?: boolean,
                                    ) => Promise<{
                                        aiEnabled?: boolean;
                                        selectedRefreshInterval?: {id: number; text: string};
                                        selectedDriverLocationRefreshInterval?: {id: number; text: string};
                                        selectedTaskRefreshInterval?: {id: number; text: string};
                                    } | null>;
                                };
                            };
                            if (!w.ReactDashboardSettingsDialog) {
                                toastrService.showErrorToast('Settings dialog is not loaded.');
                                return;
                            }
                            const readIntervalSeconds = (key: string): number => {
                                const raw = localStorage.getItem(key);
                                const n = raw == null ? 0 : parseInt(raw, 10);
                                return Number.isFinite(n) && n > 0 ? n : 0;
                            };
                            // On first run the Tasks dropdown inherits the job-list
                            // cadence (matches loadRefreshIntervals) so the dialog
                            // reflects what the panel is actually doing.
                            const taskSeedSeconds = localStorage.getItem(DISPATCH_TASK_REFRESH_KEY) != null
                                ? readIntervalSeconds(DISPATCH_TASK_REFRESH_KEY)
                                : readIntervalSeconds(DISPATCH_REFRESH_INTERVAL_KEY);
                            try {
                                const result = await w.ReactDashboardSettingsDialog.open(
                                    {
                                        title: 'Dispatch Dashboard Settings',
                                        showRefreshInterval: true,
                                        showDriverLocationRefresh: true,
                                        showTaskRefresh: true,
                                        showAiToggle: true,
                                    },
                                    {id: readIntervalSeconds(DISPATCH_REFRESH_INTERVAL_KEY), text: ''},
                                    {id: readIntervalSeconds(DISPATCH_DRIVER_LOC_REFRESH_KEY), text: ''},
                                    {id: taskSeedSeconds, text: ''},
                                    isAiEnabled(),
                                );
                                if (!result) return;

                                if (result.aiEnabled !== undefined) {
                                    setAiEnabled(result.aiEnabled);
                                }

                                // Persist + apply auto-refresh intervals (seconds in
                                // storage; React Query uses ms, 0 = off).
                                const toMs = (secs?: number) => (secs && secs > 0 ? secs * 1000 : false);
                                if (result.selectedRefreshInterval) {
                                    localStorage.setItem(DISPATCH_REFRESH_INTERVAL_KEY, String(result.selectedRefreshInterval.id));
                                }
                                if (result.selectedDriverLocationRefreshInterval) {
                                    localStorage.setItem(DISPATCH_DRIVER_LOC_REFRESH_KEY, String(result.selectedDriverLocationRefreshInterval.id));
                                }
                                if (result.selectedTaskRefreshInterval) {
                                    localStorage.setItem(DISPATCH_TASK_REFRESH_KEY, String(result.selectedTaskRefreshInterval.id));
                                }
                                window.ReactDispatch?.updateRefreshIntervals({
                                    jobsMs: toMs(result.selectedRefreshInterval?.id),
                                    driverLocationsMs: toMs(result.selectedDriverLocationRefreshInterval?.id),
                                    tasksMs: toMs(result.selectedTaskRefreshInterval?.id),
                                });
                            } catch (err) {
                                console.error('[dispatch] settings dialog error', err);
                            }
                        },

                        openCustomizePanelsDialog: async () => {
                            const w = window as unknown as {
                                ReactCustomizePanelsDialog?: {
                                    open: (
                                        boxes: Record<string, IBox>,
                                        title?: string,
                                        layoutEditable?: boolean,
                                    ) => Promise<Record<string, IBox> | null>;
                                };
                            };
                            if (!w.ReactCustomizePanelsDialog) {
                                toastrService.showErrorToast('Customize panels dialog is not loaded.');
                                return;
                            }
                            try {
                                const layoutName = ctrl.currentLayoutName ?? 'Default';
                                const boxes = mergeBoxVisibility(
                                    createDispatchBoxes(),
                                    loadBoxVisibility(layoutStorageKeys, layoutName),
                                );
                                const editable = !isDefaultLayout(layoutName);
                                const result = await w.ReactCustomizePanelsDialog.open(boxes, layoutName, editable);
                                // The Default layout is read-only, so its panel visibility
                                // is never written even if a stale bundle returns a result.
                                if (!result || !editable) return;

                                saveBoxVisibility(layoutStorageKeys, layoutName, result);
                                window.ReactDispatch?.reloadLayoutsFromStorage();
                            } catch (err) {
                                console.error('[dispatch] customize panels dialog error', err);
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
                                w.ReactCreateJobDialog.open(appConfig.US_Customer).then(newJobId => {
                                    if (newJobId) window.ReactDispatch?.jobCreated(newJobId);
                                }).catch(err =>
                                    console.error('[dispatch] create job dialog error', err)
                                );
                            } else {
                                toastrService.showErrorToast('Create job dialog is not loaded.');
                            }
                        },
                    };

                    const layoutToolbar = createLayoutToolbarActions({
                        getBridge: () => window.ReactDispatch,
                        host: ctrl,
                        storageKeys: layoutStorageKeys,
                        defaultLayout,
                        toastr: toastrService,
                    });
                    // Merged in rather than spread into the literal above so
                    // `ctrl` stays free of a circular type reference.
                    Object.assign(ctrl, layoutToolbar);
                    layoutToolbar.initialize();

                    ($scope as angular.IScope & {ctrl: typeof ctrl}).ctrl = ctrl;

                    const deepLinkJobId = $stateParams.jobId
                        ? parseInt($stateParams.jobId as string, 10)
                        : undefined;

                    window.ReactDispatch!.mount('react-dispatch-v2', {
                        showToast,
                        isUsCustomer: appConfig.US_Customer,
                        timeZone: window.TimeZone || 'New Zealand Standard Time',
                        timeZoneShort: undefined,
                        deepLinkJobId,
                        onExitColumnEditMode: () => {
                            ctrl.columnEditMode = false;
                            window.ReactDispatch?.setColumnEditMode(false);
                            $scope.$applyAsync();
                        },
                    });

                    // Mirror React's view list + selection into the toolbar's
                    // Views menu. React loads the views and owns the selection
                    // (the job list's views rail); this keeps the menu's
                    // checkboxes and badge in step with it.
                    const unregisterViews = window.ReactDispatch!.registerViewsListener(views => {
                        ctrl.views = views;
                        ctrl.viewsInitialized = true;
                        $scope.$applyAsync();
                    });
                    pushFilters();

                    // Unread-messages badge — poll every 60s (mirrors home's
                    // getUnreadMessageCount interval).
                    const pollUnreadCount = () => {
                        $http.get<number>('messages/GetUnreadMessageCount').then(res => {
                            ctrl.unreadMessageCount = res.data ?? 0;
                        }).catch(err => console.error('[dispatch] unread count error', err));
                    };
                    pollUnreadCount();
                    const unreadPoll = $interval(pollUnreadCount, 60000);

                    $scope.$on('$destroy', () => {
                        $interval.cancel(unreadPoll);
                        unregisterViews();
                        window.ReactDispatch!.unmount();
                    });
                }
            ],
        });
        return this;
    }

    private configureDispatchV2RedirectState(): this {
        // Kept as a thin redirect so old `/dispatchV2` bookmarks keep working
        // now that the route has been renamed to `/dispatch` — see
        // `configureDispatchState`.
        this.$stateProvider.state("dispatchV2", {
            url: "/dispatchV2?jobId",
            params: {
                jobId: {
                    value: null,
                    squash: true
                }
            },
            redirectTo: (trans: any) => {
                const jobId = trans.params()?.jobId;
                return {state: 'dispatch', params: jobId ? {jobId} : {}};
            }
        });
        return this;
    }

    private configureNationwideState(): this {
        this.$stateProvider.state("nw", {
            url: "/Nationwide?jobId",
            template: '<nationwide-component></nationwide-component>',
            // Opt-in, unlike /(dispatch) and /jobSearch: the classic AngularJS
            // page stays the default and this only redirects for operators who
            // turned the new page on themselves. Handled at the route level so
            // the React bundle is not fetched for everyone else.
            redirectTo: (trans: any) => {
                if (!getNationwideBetaEnabled()) return undefined;
                const jobId = trans.params()?.jobId;
                return {state: 'nwV2', params: jobId ? {jobId} : {}};
            },
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
                        files: islandFiles(manifest, 'nationwideJobListReact')
                    });
                }]
            }
        });
        return this;
    }

    /**
     * Parallel React rebuild of `/Nationwide`, running alongside the AngularJS
     * page so it can be QA'd against real data before the classic page is
     * deleted. Per-user opt-out via the dashboard settings dialog
     * (`react/pages/nationwide/lib/betaPreference.ts`).
     */
    private configureNationwideV2State(): this {
        this.$stateProvider.state("nwV2", {
            url: "/NationwideV2?jobId",
            params: {
                jobId: {value: null, squash: true}
            },
            template: `
                <div style="height: 100%; position: relative;">
                    <react-app-shell
                            section="Operations" title="Nationwide" beta="true"
                            views="ctrl.views" views-loading="!ctrl.viewsInitialized"
                            on-toggle-view="ctrl.toggleView(view)" on-clear-all-views="ctrl.clearAllViews()"
                            layouts="ctrl.layouts" current-layout-name="ctrl.currentLayoutName"
                            on-save-layout="ctrl.saveLayout()" on-load-layout="ctrl.loadLayout(index)"
                            on-delete-layout="ctrl.deleteLayout(index)" on-rename-layout="ctrl.renameLayout(index)"
                            on-import-layouts="ctrl.importLayouts()"
                            on-settings-click="ctrl.openSettingsDialog($event)"
                            on-customize-panels="ctrl.openCustomizePanelsDialog()" on-reset-layout="ctrl.resetLayout()">
                    </react-app-shell>
                    <div id="react-nationwide-v2" style="height: ${BELOW_APP_BAR_HEIGHT};"></div>
                </div>
            `,
            resolve: {
                manifest: ['$http', async ($http: angular.IHttpService) => {
                    try {
                        const response = await $http.get<Record<string, string>>('dist/manifest.json');
                        return response.data;
                    } catch {
                        console.warn('[ROUTES] Failed to load manifest for nwV2 state, using fallback names');
                        return {
                            'nationwideReact.js': 'nationwideReact.js',
                            'dashboardSettingsDialogReact.js': 'dashboardSettingsDialogReact.js',
                        };
                    }
                }],
                loadModule: ['$ocLazyLoad', 'manifest', async ($ocLazyLoad: oc.ILazyLoad, manifest: Record<string, string>) => {
                    if (!window.React) {
                        await $ocLazyLoad.load(`dist/${manifest['vendor-react.js'] || 'vendor-react.js'}`);
                    }
                    // islandFiles pairs the JS with its stylesheet; this page
                    // emits one, so loading the bundle alone would render it
                    // unstyled.
                    await $ocLazyLoad.load({
                        name: 'uDispatch.dashboardSettingsDialogReact',
                        files: islandFiles(manifest, 'dashboardSettingsDialogReact'),
                    });
                    // islandFiles pairs the JS with its stylesheet; this page
                    // emits one, so loading the bundle alone would render it
                    // unstyled.
                    await $ocLazyLoad.load({
                        name: 'uDispatch.nationwideReact',
                        files: islandFiles(manifest, 'nationwideReact')
                    });
                }]
            },
            controller: ['$scope', '$stateParams', '$state', 'toastrService', 'APP_CONFIG',
                function (
                    $scope: angular.IScope,
                    $stateParams: IDfrntStateParams,
                    $state: angular.ui.IStateService,
                    toastrService: {
                        showSuccessToast: (m: string) => void;
                        showWarningToast: (m: string) => void;
                        showErrorToast: (m: string) => void;
                        showInfoToast: (m: string) => void;
                    },
                    appConfig: { US_Customer: boolean }
                ) {
                    const jobId = $stateParams.jobId ? parseInt($stateParams.jobId, 10) : undefined;

                    const layoutStorageKeys = {
                        layoutsKey: `layoutsNWV2-${window.ContactID}`,
                        lastActiveLayoutKey: `lastActiveLayoutNWV2-${window.ContactID}`,
                        boxVisibilityKeyBase: `boxVisibilityV2-${AppPage.Domestic}-${window.ContactID}`,
                    };
                    const defaultLayout = createDefaultNationwideLayout();
                    const refreshIntervalKey = `refreshInterval-${AppPage.Domestic}-${window.ContactID}`;

                    const ctrl = {
                        layouts: [] as ILayout[],
                        currentLayoutName: undefined as string | undefined,
                        views: [] as DfrntPageViewModel[],
                        viewsInitialized: false,

                        toggleView: (_view: DfrntPageViewModel) => {
                            window.ReactNationwide?.setViewSelection(
                                ctrl.views.filter(v => v.selected).map(v => v.id),
                            );
                        },

                        clearAllViews: () => {
                            window.ReactNationwide?.setViewSelection([]);
                        },

                        resetLayout: () => {
                            const layoutName = ctrl.currentLayoutName ?? 'Default';
                            if (!window.confirm(
                                `Reset "${layoutName}" to the default arrangement? Panel sizes, order and visibility will be restored.`,
                            )) return;
                            window.ReactNationwide?.resetCurrentLayout();
                        },

                        openCustomizePanelsDialog: async () => {
                            const w = window as unknown as {
                                ReactCustomizePanelsDialog?: {
                                    open: (
                                        boxes: Record<string, IBox>,
                                        title?: string,
                                        layoutEditable?: boolean,
                                    ) => Promise<Record<string, IBox> | null>;
                                };
                            };
                            if (!w.ReactCustomizePanelsDialog) {
                                toastrService.showErrorToast('Customize panels dialog is not loaded.');
                                return;
                            }
                            try {
                                const layoutName = ctrl.currentLayoutName ?? 'Default';
                                const boxes = mergeBoxVisibility(
                                    createNationwideBoxes(),
                                    loadBoxVisibility(layoutStorageKeys, layoutName),
                                );
                                const editable = !isDefaultLayout(layoutName);
                                const result = await w.ReactCustomizePanelsDialog.open(boxes, layoutName, editable);
                                if (!result || !editable) return;

                                saveBoxVisibility(layoutStorageKeys, layoutName, result);
                                window.ReactNationwide?.reloadLayoutsFromStorage();
                            } catch (err) {
                                console.error('[nationwide] customize panels dialog error', err);
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
                                            showNationwideBetaToggle?: boolean;
                                        },
                                        selectedRefreshInterval?: {id: number; text: string},
                                        selectedDriverLocationRefreshInterval?: {id: number; text: string},
                                        selectedTaskRefreshInterval?: {id: number; text: string},
                                        aiEnabled?: boolean,
                                        nationwideBetaEnabled?: boolean,
                                    ) => Promise<{
                                        selectedRefreshInterval?: {id: number; text: string};
                                        nationwideBetaEnabled?: boolean;
                                    } | null>;
                                };
                            };
                            
                            if (!w.ReactDashboardSettingsDialog) {
                                toastrService.showErrorToast('Settings dialog is not loaded.');
                                return;
                            }
                            
                            const currentInterval = resolveSavedInterval(
                                localStorage.getItem(refreshIntervalKey),
                                buildRefreshIntervalOptions(),
                            );
                            
                            try {
                                const result = await w.ReactDashboardSettingsDialog.open(
                                    {
                                        title: 'Nationwide Dashboard Settings',
                                        showRefreshInterval: true,
                                        showNationwideBetaToggle: true,
                                    },
                                    currentInterval ?? {id: 0, text: ''},
                                    undefined,
                                    undefined,
                                    undefined,
                                    getNationwideBetaEnabled(),
                                );
                                if (!result) return;

                                if (result.selectedRefreshInterval) {
                                    localStorage.setItem(refreshIntervalKey, String(result.selectedRefreshInterval.id));
                                    window.ReactNationwide?.updateRefreshIntervalMs(
                                        result.selectedRefreshInterval.id > 0
                                            ? result.selectedRefreshInterval.id * 1000
                                            : false,
                                    );
                                }
                                
                                if (result.nationwideBetaEnabled === false && getNationwideBetaEnabled()) {
                                    setNationwideBetaEnabled(false);
                                    $state.go('nw').catch((err: unknown) => {
                                        console.error('[nationwide] Failed to switch to the classic page', err);
                                    });
                                    return;
                                }

                                toastrService.showSuccessToast('Settings saved and applied successfully');
                            } catch (err) {
                                console.error('[nationwide] settings dialog error', err);
                            }
                        },
                    };

                    const layoutToolbar = createLayoutToolbarActions({
                        getBridge: () => window.ReactNationwide,
                        host: ctrl,
                        storageKeys: layoutStorageKeys,
                        defaultLayout,
                        toastr: toastrService,
                    });
                    Object.assign(ctrl, layoutToolbar);
                    layoutToolbar.initialize();

                    ($scope as angular.IScope & {ctrl: typeof ctrl}).ctrl = ctrl;

                    window.ReactNationwide?.mount('react-nationwide-v2', {
                        isUsCustomer: appConfig.US_Customer,
                        timeZone: window.TimeZone || 'New Zealand Standard Time',
                        deepLinkJobId: Number.isFinite(jobId) ? jobId : undefined,
                    } as any);
                    
                    const unregisterViews = window.ReactNationwide!.registerViewsListener(views => {
                        ctrl.views = views;
                        ctrl.viewsInitialized = true;
                        $scope.$applyAsync();
                    });

                    $scope.$on('$destroy', () => {
                        unregisterViews();
                        window.ReactNationwide?.unmount();
                    });
                }]
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
        // React rebuild of the Job Search page. The classic AngularJS
        // `jobSearch` page has been deleted and React is the only
        // implementation now.
        this.$stateProvider.state("jobSearch", {
            url: "/jobSearch?jobId",
            params: {
                jobId: {value: null, squash: true}
            },
            template: `
                <div class="job-search-view" style="height: 100%; position: relative;">
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
                            on-rename-layout="ctrl.renameLayout(index)"
                            on-import-layouts="ctrl.importLayouts()"
                            on-settings-click="ctrl.openSettingsDialog($event)"
                            on-customize-panels="ctrl.openCustomizePanelsDialog()"
                            on-reset-layout="ctrl.resetLayout()"
                            column-edit-mode="ctrl.columnEditMode"
                            on-toggle-column-edit-mode="ctrl.toggleColumnEditMode()"
                            on-create-new-job="ctrl.createNewJob($event)"
                            on-inter-courier-charge="ctrl.interCourierCharge($event)">
                    </react-app-shell>
                    <div style="height: ${BELOW_APP_BAR_HEIGHT}; overflow: hidden;">
                        <div id="react-job-search-v2" style="height: 100%; overflow: hidden;"></div>
                    </div>
                </div>
            `,
            resolve: {
                manifest: ['$http', async ($http: angular.IHttpService) => {
                    try {
                        const response = await $http.get<Record<string, string>>('dist/manifest.json');
                        return response.data;
                    } catch {
                        console.warn('[ROUTES] Failed to load manifest for jobSearch state, using fallback names');
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
                        files: islandFiles(manifest, d.file.replace(/\.js$/, '')),
                    })));
                    
                    const jobSearchFiles = [getAssetPath('jobSearchReact.js')];
                    
                    if (manifest['jobSearchReact.css']) {
                        jobSearchFiles.push(getAssetPath('jobSearchReact.css'));
                    }
                    
                    await $ocLazyLoad.load({
                        name: 'uDispatch.jobSearchReact',
                        files: jobSearchFiles
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
                    const layoutStorageKeys = {
                        layoutsKey: `layoutsCSV2-${window.ContactID}`,
                        lastActiveLayoutKey: `lastActiveLayoutCSV2-${window.ContactID}`,
                        boxVisibilityKeyBase: `boxVisibilityV2-${AppPage.JobSearch}-${window.ContactID}`,
                    };
                    const defaultLayout = createDefaultJobSearchLayout();

                    const ctrl = {
                        layouts: [] as ILayout[],
                        currentLayoutName: undefined as string | undefined,
                        columnEditMode: false,

                        toggleColumnEditMode: () => {
                            ctrl.columnEditMode = !ctrl.columnEditMode;
                            window.ReactJobSearch?.setColumnEditMode(ctrl.columnEditMode);
                        },

                        resetLayout: () => {
                            const layoutName = ctrl.currentLayoutName ?? 'Default';
                            if (!window.confirm(
                                `Reset "${layoutName}" to the default arrangement? Panel sizes, order and visibility will be restored.`,
                            )) return;
                            window.ReactJobSearch?.resetCurrentLayout();
                        },

                        openMessagingDialog: ($event: MouseEvent) => {
                            const w = window as unknown as {
                                ReactMessagingDialog?: { open: (opts?: unknown) => Promise<void> };
                            };
                            void $event;
                            if (w.ReactMessagingDialog) {
                                w.ReactMessagingDialog.open().catch(err =>
                                    console.error('[jobSearch] messaging dialog error', err)
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
                                            showAiToggle?: boolean;
                                        },
                                        selectedRefreshInterval?: {id: number; text: string},
                                        selectedDriverLocationRefreshInterval?: {id: number; text: string},
                                        selectedTaskRefreshInterval?: {id: number; text: string},
                                        aiEnabled?: boolean,
                                    ) => Promise<{
                                        aiEnabled?: boolean;
                                    } | null>;
                                };
                            };
                            if (!w.ReactDashboardSettingsDialog) {
                                toastrService.showErrorToast('Settings dialog is not loaded.');
                                return;
                            }
                            try {
                                const result = await w.ReactDashboardSettingsDialog.open(
                                    {
                                        title: 'Job Search Dashboard Settings',
                                        showAiToggle: true,
                                    },
                                    undefined,
                                    undefined,
                                    undefined, // selectedTaskRefreshInterval — not used on Job Search
                                    isAiEnabled(),
                                );
                                if (!result) return;

                                if (result.aiEnabled !== undefined) {
                                    setAiEnabled(result.aiEnabled);
                                }
                            } catch (err) {
                                console.error('[jobSearch] settings dialog error', err);
                            }
                        },

                        openCustomizePanelsDialog: async () => {
                            const w = window as unknown as {
                                ReactCustomizePanelsDialog?: {
                                    open: (
                                        boxes: Record<string, IBox>,
                                        title?: string,
                                        layoutEditable?: boolean,
                                    ) => Promise<Record<string, IBox> | null>;
                                };
                            };
                            if (!w.ReactCustomizePanelsDialog) {
                                toastrService.showErrorToast('Customize panels dialog is not loaded.');
                                return;
                            }
                            try {
                                const layoutName = ctrl.currentLayoutName ?? 'Default';
                                // Build the live box list from definitions + persisted
                                // visibility so operators can show/hide panels.
                                const boxes = mergeBoxVisibility(
                                    createJobSearchBoxes(),
                                    loadBoxVisibility(layoutStorageKeys, layoutName),
                                );
                                const editable = !isDefaultLayout(layoutName);
                                const result = await w.ReactCustomizePanelsDialog.open(boxes, layoutName, editable);
                                // The Default layout is read-only, so its panel visibility
                                // is never written even if a stale bundle returns a result.
                                if (!result || !editable) return;

                                // Persist box visibility and push it into the live React
                                // page (reloadLayoutsFromStorage re-reads visibility and
                                // bumps the layout version).
                                saveBoxVisibility(layoutStorageKeys, layoutName, result);
                                window.ReactJobSearch?.reloadLayoutsFromStorage();
                            } catch (err) {
                                console.error('[jobSearch] customize panels dialog error', err);
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
                                w.ReactCreateJobDialog.open(appConfig.US_Customer).then(newJobId => {
                                    if (newJobId) window.ReactJobSearch?.jobCreated(newJobId);
                                }).catch(err =>
                                    console.error('[jobSearch] create job dialog error', err)
                                );
                            } else {
                                toastrService.showErrorToast('Create job dialog is not loaded.');
                            }
                        },

                        interCourierCharge: ($event: MouseEvent) => {
                            void $event;
                            // The dialog component is statically bundled into
                            // jobSearchReact.js (imported by JobSearchPage), so it
                            // is always available once the page has mounted. The
                            // bridge wires it to the page's toast service.
                            if (window.ReactJobSearch?.openInterCourierCharge) {
                                window.ReactJobSearch.openInterCourierCharge().catch(err =>
                                    console.error('[jobSearch] inter-courier dialog error', err)
                                );
                            } else {
                                toastrService.showErrorToast('Inter-courier dialog is not loaded.');
                            }
                        },
                    };

                    const layoutToolbar = createLayoutToolbarActions({
                        getBridge: () => window.ReactJobSearch,
                        host: ctrl,
                        storageKeys: layoutStorageKeys,
                        defaultLayout,
                        toastr: toastrService,
                    });
                    // Merged in rather than spread into the literal above so
                    // `ctrl` stays free of a circular type reference.
                    Object.assign(ctrl, layoutToolbar);
                    layoutToolbar.initialize();

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
                        onExitColumnEditMode: () => {
                            ctrl.columnEditMode = false;
                            window.ReactJobSearch?.setColumnEditMode(false);
                            $scope.$applyAsync();
                        },
                    });

                    $scope.$on('$destroy', () => {
                        window.ReactJobSearch!.unmount();
                    });
                }
            ],
        });
        return this;
    }

    private configureJobSearchV2RedirectState(): this {
        // Kept as a thin redirect so old `/jobSearchV2` bookmarks keep working
        // now that the route has been renamed to `/jobSearch` — see
        // `configureJobSearchState`.
        this.$stateProvider.state("jobSearchV2", {
            url: "/jobSearchV2?jobId",
            params: {
                jobId: {
                    value: null,
                    squash: true
                }
            },
            redirectTo: (trans: any) => {
                const jobId = trans.params()?.jobId;
                return {state: 'jobSearch', params: jobId ? {jobId} : {}};
            }
        });
        return this;
    }

    private configurePrebooksState(): this {
        this.$stateProvider.state("recurringJobs", {
            url: "/recurringJobs",
            template: `
                <div class="prebook-view" style="position: relative;">
                    <react-app-shell section="Dashboards" title="Recurring Jobs"></react-app-shell>
                    <div style="height: ${BELOW_APP_BAR_HEIGHT}; overflow: hidden;">
                        <div id="react-recurring-jobs-list" style="height: 100%; overflow: hidden;"></div>
                    </div>
                </div>
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
                    return $ocLazyLoad.load({
                        name: 'uDispatch.recurringJobsReact',
                        files: islandFiles(manifest, 'recurringJobsReact'),
                    });
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
                <div style="height: 100%; position: relative;">
                    <react-app-shell section="Dashboards" title="Overview"></react-app-shell>
                    <div class="scrollable-container" style="height: ${BELOW_APP_BAR_HEIGHT}; overflow: auto;">
                        <div id="react-overview"></div>
                    </div>
                </div>
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
                    // Then load the overview React module — via islandFiles so its
                    // emitted stylesheet is fetched too (the HERE-map wrapper's
                    // isolation: isolate lives there; without the CSS the map's own
                    // z-index covers the control rails).
                    return $ocLazyLoad.load(islandFiles(manifest, 'overviewReact'));
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
                <div class="task-dashboard-view" style="position: relative;">
                    <react-app-shell
                        section="Dashboards"
                        title="Task Dashboard">
                    </react-app-shell>
                    <div style="height: ${BELOW_APP_BAR_HEIGHT}; overflow: hidden;">
                        <div id="react-task-dashboard" style="height: 100%; overflow: hidden;"></div>
                    </div>
                </div>
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
                    return $ocLazyLoad.load({
                        name: 'uDispatch.taskDashboardReact',
                        files: islandFiles(manifest, 'taskDashboardReact'),
                    });
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

                    window.ReactTaskDashboard!.mount('react-task-dashboard', {
                        showToast,
                        isUsCustomer: appConfig.US_Customer,
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
                <div style="height: 100%; position: relative;">
                    <react-app-shell section="Operations" title="Drivers"></react-app-shell>
                    <div id="react-driver-management" style="height: ${BELOW_APP_BAR_HEIGHT};"></div>
                </div>
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
                    await $ocLazyLoad.load({
                        name: 'uDispatch.composeEmailDialogReact',
                        files: islandFiles(manifest, 'composeEmailDialogReact')
                    });
                    await $ocLazyLoad.load({
                        name: 'uDispatch.editAfterhoursDialogReact',
                        files: islandFiles(manifest, 'editAfterhoursDialogReact')
                    });
                    return $ocLazyLoad.load({
                        name: 'uDispatch.driverManagementReact',
                        files: islandFiles(manifest, 'driverManagementReact')
                    });
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
                <div id="react-courier-map" style="height: ${BELOW_APP_BAR_HEIGHT};"></div>
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