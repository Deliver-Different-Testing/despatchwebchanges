import "./home.styles.less";
import ToastrService from "../../services/toastr.service";
import DispatchCoreService from "../../services/dispatch-core.service";
import DispatchExecutorService from "../../services/dispatch-executor.service";
import {IAppConfig} from "../../interfaces/app-config.interface";
import {
    IAreaClearList,
    IClearListViewModel,
    ICourierData,
    IDispatchJob,
    IDispatchMapItem,
    IJob,
    IJobQueryParams,
    ISuggestion,
} from "../../interfaces/job.interface";
import {IDriverWorkOverview, IPotentialCouriers, ITruckCourierStatus} from "../../interfaces/courier.interface";
import {IBox, IColumn, ILayout} from "../../interfaces/layout.interfaces";
import {DfrntPageViewModel} from "../../interfaces/dfrnt-page-view-model.interface";
import BaseController from "../base-controller";
import {ExtendedTask, ITask} from "../../interfaces/task.interfaces";
import AccessorialChargesDialogService from "../dialogs/accessorial-charges-dialog/accessorial-charges-dialog.service";
import {AppPage} from "../../enums/app-pages.enum";
import JobFileUploadDialogService from "../dialogs/job-file-upload-dialog/job-file-upload-dialog.service";
import {openAddEventDialog} from "../../react/components/dialogs/add-event-dialog";
import type {ToastType} from "../../react/services/toastService";
import {
    openInterCourierChargeDialog
} from "../../react/components/dialogs/inter-courier-charge-dialog/inter-courier-charge-dialog-react.module";
import {Coordinates} from "../../interfaces/coordinates.interface";
import {ContactID, TimeZone} from "../../contants";
import {getIanaTimezone} from "../../react/utils/dateUtils";
import {IJobReadChanged} from "../../interfaces/event-interfaces";
import {JobProperty} from "../../enums/job-property.enum";
import dayjs from "dayjs";
import TruckCourierStatusDialogService
    from "../dialogs/truck-courier-status-dialog/truck-courier-status-dialog.service";
import JobAddStopService from "../../services/job-add-stop.service";
import MessagingDialogService from "../dialogs/messaging-dialog/messaging-dialog.service";
import timezone from 'dayjs/plugin/timezone';
import {StatusFilter} from "../../enums/status-filter.enum";
import TasksService from "../../services/tasks.service";
import JobListType from "../../enums/job-list-type.enum";
import CreateJobDialogService from "../dialogs/create-job-dialog/create-job-dialog.service";
import IDateFilterData from "../../interfaces/date-filter-data.interface";
import setDateFilterDefaults from "../../functions/setDateFilterDefaults";
import utc from "dayjs/plugin/utc";
import {getMinsSelectionOptions} from "../../functions/MinsSelectionOptions";
import DispatchBoxes from "./enums/DispatchBoxes";
import DashboardSettingsDialogService from "../dialogs/dashboard-settings-dialog/dashboard-settings-dialog.service";
import {setAiEnabled} from "../../functions/aiSettings";
import CurrentWorkLists from "./enums/CurrentWorkLists";
import {fetchClearListJobs, fetchDispatchJobs} from "../../react/services/jobSearchApi";
import {
    getDispatchBetaEnabled,
    setDispatchBetaEnabled,
} from "../../react/pages/dispatch/lib/betaPreference";
import {queryKeys} from "../../react/query/queryClient";
import angular from "angular";
import {DispatchJob} from "../../react/interfaces";
import ITaskItemConfig from "../../interfaces/task-item-config";

dayjs.extend(utc);
dayjs.extend(timezone);

class HomeController extends BaseController {
    static $inject = [
        '$document',
        '$mdDialog',
        'toastrService',
        'DispatchData',
        'dispatchJobService',
        'APP_CONFIG',
        '$mdSidenav',
        '$stateParams',
        'accessorialChargesDialogService',
        'jobFileUploadDialogService',
        'truckCourierStatusDialogService',
        'jobAddStopService',
        'messagingDialogService',
        'tasksService',
        'createJobDialogService',
        'dashboardSettingsDialogService',
        '$scope',
        '$timeout',
        '$interval',
        '$state',
    ];

    private readonly MapZoomKey: string = `mapZoom-${AppPage.Dispatch}-${ContactID}`;
    private readonly SelectedViewsKey: string = `selectedViews-${AppPage.Dispatch}-${ContactID}`;
    private readonly DispatchFiltersKey: string = `disp-filters-${AppPage.Dispatch}-${ContactID}`;
    private readonly RefreshDurationIntervalKey: string = `refreshInterval-${AppPage.Dispatch}-${ContactID}`;
    private readonly DriverLocationRefreshIntervalKey: string = `driverLocationRefreshInterval-${AppPage.Dispatch}-${ContactID}`;
    private readonly DateFilterKey: string = `dateFilter-${AppPage.Dispatch}-${ContactID}`;
    private readonly LayoutKey: string = `layout-${ContactID}`;
    private readonly LastActiveLayoutKey: string = `lastActiveLayout-${ContactID}`;
    private readonly BoxVisibilityKey: string = `boxVisibility-${AppPage.Dispatch}-${ContactID}`;

    readonly currentWorkListName: JobListType = JobListType.CurrentWorkList;
    readonly dispatchListName: JobListType = JobListType.DispatchJobList;

    private readonly currentAppPage: AppPage = AppPage.Dispatch;

// Layout
    boxes?: Record<string, IBox>;
    currentLayoutName?: string;
    boxSortableOptions?: angular.ui.SortableOptions<any>;
    layouts: ILayout[] = [];
    defaultLayout?: ILayout;
    layout?: { columns: IColumn[] };

    dateFilterData: IDateFilterData;
    isLoadingData: boolean = false;
    showDriverLocationsNoData: boolean = false;
    showDriverLocationsData: boolean = false;
    mapJobList?: IDispatchMapItem[] = []
    mapJobListFull?: IDispatchMapItem[] = []
    currentJob?: IDispatchJob;
    currentJobId?: number;
    jobList: IDispatchJob[];
    mapZoom?: number;
    truckMode: string;
    queryParams: IJobQueryParams;
    isUsCustomer: boolean;
    selectedCourier?: ISuggestion;
    views: DfrntPageViewModel[];
    viewsInitialized: boolean = false;
    mapCenter: Coordinates;
    autoZoomEnabled: boolean;
    supports: ExtendedTask[];
    driverLocations?: IClearListViewModel;
    truckCourierStatus?: ITruckCourierStatus;
    driverLocationsLoading: boolean = false;
    supportsLoading: boolean = false;
    potentialCouriersLoading: boolean = false;
    currentListLoading: boolean = false;
    courierSearchText?: string;
    exactCourierMatchSearchText?: string;
    currentCourier?: ISuggestion;
    jobsCurrentList?: IDispatchJob[];
    potentialCouriers?: IPotentialCouriers[];
    currentWorkSelection?: string;
    currentSelection?: string;
    supportItemConfig: ITaskItemConfig = {
        showAssign: true,
        showClose: true,
        showDelete: true,
        onTaskClick: true
    };
    clearListId?: number;
    isDataLoading: boolean = false;
    unReadMessageCount: number = 0;
    defaultJobCategory?: string; // Track the default category for a job list

    // supportFilters
    staffList?: ISuggestion[];
    eventTypesList?: ISuggestion[];
    staffFilter: string = StatusFilter.All;
    eventTypeFilter: string = StatusFilter.All;
    supportsFilter: string = StatusFilter.All;
    filteredSupports: ExtendedTask[] = [];
    private supportsLoadingInBackground: boolean = false;

    refreshIntervalOptions?: ISuggestion[];
    selectedRefreshInterval?: ISuggestion;
    private refreshIntervalPromise?: angular.IPromise<any>;
    private isAutoRefreshEnabled: boolean = false;

    // Driver Location Auto-Refresh
    driverLocationRefreshIntervalOptions?: ISuggestion[];
    selectedDriverLocationRefreshInterval?: ISuggestion;
    private driverLocationRefreshIntervalPromise?: angular.IPromise<any>;
    private isDriverLocationAutoRefreshEnabled: boolean = false;

    totalJobCount: number = 0;
    private selectedClearListId?: number;
    currentJobListPage: number = 0;
    currentJobListPageSize: number = 50;

    currentWorkViewMode: CurrentWorkLists = CurrentWorkLists.Overview;
    driversWithJobCounts?: IDriverWorkOverview[];

    private _selectedViews: DfrntPageViewModel[] = [];
    initialViewSet: boolean = false;
    private jobChangedInProgress: boolean = false;

    get selectedViews(): DfrntPageViewModel[] {
        return this._selectedViews;
    }

    set selectedViews(newViews: DfrntPageViewModel[]) {
        this._selectedViews = newViews;
        if (newViews?.length) {
            this.initialViewSet = false;
            this.updateMapForSelectedViews();
        }
    }

    constructor(
        private $document: angular.IDocumentService,
        private $mdDialog: angular.material.IDialogService,
        private toastrService: ToastrService,
        private DispatchData: DispatchCoreService,
        private dispatchJobService: DispatchExecutorService,
        private APP_CONFIG: IAppConfig,
        private $mdSidenav: angular.material.ISidenavService,
        private $stateParams: angular.ui.IStateParamsService,
        private accessorialChargesDialog: AccessorialChargesDialogService,
        private jobFileUploadDialog: JobFileUploadDialogService,
        private truckCourierStatusDialog: TruckCourierStatusDialogService,
        private jobAddStopService: JobAddStopService,
        private messagingDialog: MessagingDialogService,
        private tasksService: TasksService,
        private createJobDialog: CreateJobDialogService,
        private dashboardSettingsDialog: DashboardSettingsDialogService,
        $scope: angular.IScope,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        private $state: angular.ui.IStateService,
    ) {
        super();
        this.initServices($timeout, $interval, $scope);

        this.isUsCustomer = this.APP_CONFIG.US_Customer;

        this.initializeBoxes();
        this.initializeLayout();

        // Date filter
        this.dateFilterData = setDateFilterDefaults();
        this.loadDateFilterFromStorage();

        // Views and Layout
        this.initialViewSet = false;

        this.watchEvent('jobChanged', async (_, newJob: IJob) => {
            if (this.currentJobId === newJob.id || this.jobChangedInProgress) return;
            this.jobChangedInProgress = true;
            try {
                const job = await this.DispatchData.getDispatchJobDetail(newJob.id);
                await this.selectJob(job);
            } finally {
                this.jobChangedInProgress = false;
            }
        });

        this.watchEvent('jobReadChanged', async (_, data: IJobReadChanged) => {
            await this.markJobReadStatus(data.jobId, data.isRead);
        });

        this.watchEvent('angular-resizable.resizeEnd', () => {
            this.saveCurrentLayout();
        });

        this.truckMode = "On";

        this.queryParams = {
            order: "-time",
            orderDirection: "desc",
            page: 0,
            pageSize: 50
        };

        this.views = [];
        this.selectedViews = [];

        // New map
        this.mapCenter = this.APP_CONFIG.US_Customer ?
            this.APP_CONFIG.US_Coordinates_Center :
            this.APP_CONFIG.NZ_Coordinates_Center;
        this.mapZoom = 4;
        this.autoZoomEnabled = true;

        if (Modernizr.localstorage) {
            const savedMapZoom = localStorage.getItem(this.MapZoomKey);
            if (savedMapZoom) {
                try {
                    const parsedMapZoom = JSON.parse(savedMapZoom);
                    this.autoZoomEnabled = parsedMapZoom.display;
                } catch (error) {
                    console.error("Error parsing saved map zoom:", error);
                    this.autoZoomEnabled = true;
                }
            }
        }

        this.jobList = [];
        this.supports = [];

        this.initRefreshIntervalOptions();
        this.loadSavedRefreshInterval();
        this.initDriverLocationRefreshIntervalOptions();
        this.loadSavedDriverLocationRefreshInterval();
        this.initializeTaskService();
    }

    $onInit(): void {
        // Per-user opt-in for the React rebuild. When set, the home/dispatch
        // page sends the operator over to /dispatchV2 — preserving any
        // deep-link jobId — and skips the rest of this controller's work.
        // Toggled via the dispatch settings dialog (see
        // `wwwroot/app/react/pages/dispatch/lib/betaPreference.ts`).
        if (getDispatchBetaEnabled()) {
            const params = this.$stateParams.jobId ? {jobId: this.$stateParams.jobId} : {};
            this.$state.go('dispatchV2', params).catch((err: unknown) => {
                console.error('[Dispatch] Failed to redirect to beta route:', err);
            });
            return;
        }

        this.mountReactJobList();

        this.registerInterval(async () => {
            await this.getUnreadMessageCount();
        }, 60000);

        this.loadPageViews().then(async () => {
            console.debug("Loaded Page Views and Data!");

            const jobId = this.$stateParams.jobId;
            if (jobId) {
                try {
                    await this.getData();

                    const job = this.jobList.find((j) => j.id === jobId);
                    if (!job) return;

                    return this.selectJob(job);
                } catch (error) {
                    console.error("Error loading initial job:", error);
                    this.toastrService.showErrorToast("Error loading job details");
                }
            } else {
                return this.getData();
            }
        });

        this.driverLocationsLoading = true;
        this.supportsLoading = false;
        this.potentialCouriersLoading = false;
        this.currentListLoading = false;

        this.filteredSupports = this.supports;
    }

    $onDestroy(): void {
        super.$onDestroy();
        this.stopAutoRefresh();
        this.stopDriverLocationAutoRefresh();

        // Unmount React job list
        if (window.ReactJobList) {
            window.ReactJobList.unmount();
        }

        // Unmount React current work job list
        if (window.ReactCurrentWorkJobList) {
            window.ReactCurrentWorkJobList.unmount();
            this.reactCurrentWorkMounted = false;
        }
    }

    private initializeTaskService(): void {
        try {
            this.tasksService.loadLists().then(({staffList, eventTypesList}) => {
                this.staffList = staffList;
                this.eventTypesList = eventTypesList;
                this.applyScope();
            });

            // Load saved filters for this page
            const filters = this.tasksService.initializePageFilters(this.currentAppPage);
            this.staffFilter = filters.staffFilter;
            this.eventTypeFilter = filters.eventTypeFilter;
        } catch (error) {
            console.error('Error initializing task service:', error);
        }
    }

    private loadSavedRefreshInterval(): void {
        if (Modernizr.localstorage) {
            try {
                const savedIntervalString = localStorage.getItem(this.RefreshDurationIntervalKey);
                if (savedIntervalString) {
                    const refreshId = parseInt(savedIntervalString, 10) || 0;
                    this.selectedRefreshInterval = this.refreshIntervalOptions?.find(x => x.id == refreshId);

                    if (this.selectedRefreshInterval && this.selectedRefreshInterval.id > 0) {
                        this.startAutoRefresh();
                    }
                }
            } catch (error) {
                console.error('Error loading saved refresh interval:', error);
            }
        }
    }

    // Layout
    initializeLayout(): void {
        this.defaultLayout = {
            name: "Default",
            layout: {
                columns: [
                    {
                        id: "col1",
                        width: "50%",
                        boxes: [{name: DispatchBoxes.JobsList, height: "50%"}, {
                            name: DispatchBoxes.JobDetail,
                            height: "50%"
                        }],
                    },
                    {
                        id: "col2",
                        width: "25%",
                        boxes: [
                            {name: DispatchBoxes.CurrentWork, height: "50%"},
                            {name: DispatchBoxes.Supports, height: "50%"}
                        ],
                    },
                    {
                        id: "col3",
                        width: "25%",
                        boxes: [{name: DispatchBoxes.DriverLocations, height: "50%"}, {
                            name: DispatchBoxes.Map,
                            height: "50%"
                        }],
                    }
                ],
            },
        };

        // Load saved layouts or use default
        if (Modernizr.localstorage) {
            try {
                const storedLayouts: ILayout[] = JSON.parse(localStorage.getItem(this.LayoutKey) ?? '[]');
                const lastActiveLayout = localStorage.getItem(this.LastActiveLayoutKey);

                this.layouts = storedLayouts || [this.defaultLayout];
                this.layouts[0] = this.defaultLayout; // Ensure default is always up to date

                // Load last active layout or default
                const layoutToLoad = lastActiveLayout ? this.layouts.findIndex((l: ILayout) => l.name === lastActiveLayout) : 0;
                this.loadLayout(layoutToLoad >= 0 ? layoutToLoad : 0);
            } catch {
                this.layouts = [this.defaultLayout];
                this.loadLayout(0);
            }
        } else {
            this.layouts = [this.defaultLayout];
            this.loadLayout(0);
        }

        // Initialize boxSortableOptions for drag and drop
        this.boxSortableOptions = {
            handle: '.box-handle',
            connectWith: '.column-sortable',
            placeholder: 'box-placeholder',
            tolerance: 'pointer',
            cursor: 'move',
            opacity: 0.8,
            scroll: true,
            revert: 200,
            delay: 150,
            forcePlaceholderSize: true,
            distance: 5,
            disabled: false, // Will be updated when layout changes

            start: (e: any, ui: any) => {
                // Prevent drag on default layout
                if (this.isDefaultLayout()) {
                    return false;
                }
                ui.item.addClass('dragging');

                const dragInfo = angular.element('#draggingItems');
                dragInfo.text(`Moving: ${ui.item.find('.md-headline-title').text().trim()}`);
                dragInfo.css({
                    display: 'block',
                    top: e.pageY + 20 + 'px',
                    left: e.pageX + 10 + 'px'
                });

                this.$document.on('mousemove.sortable', (event) => {
                    dragInfo.css({
                        top: (event.pageY || 0) + 20 + 'px',
                        left: (event.pageX || 0) + 10 + 'px'
                    });
                });
            },

            over: (e: any, _: any) => {
                angular.element(e.target).addClass('ui-sortable-active');
            },

            out: (e: any, _: any) => {
                angular.element(e.target).removeClass('ui-sortable-active');
            },

            stop: (_: any, ui: any) => {
                angular.element(this.$document[0]).off('mousemove.sortable');
                angular.element('#draggingItems').css('display', 'none');
                ui.item.removeClass('dragging');
                angular.element('.column-sortable').removeClass('ui-sortable-active');

                // Updated the saved layout
                this.saveCurrentLayout();
            }
        };
    }

    loadLayout(index: number): void {
        const layout: ILayout = this.layouts[index] || this.layouts[0];
        this.currentLayoutName = layout.name;
        this.layout = angular.copy(layout.layout);

        this.applyLayoutDimensions();
        this.loadBoxVisibility();

        if (Modernizr.localstorage) {
            localStorage.setItem(this.LastActiveLayoutKey, layout.name);
        }

        this.applyScope();
    }

    saveLayout(): void {
        this.$mdDialog
            .show(this.$mdDialog
                .prompt()
                .title("Add Layout")
                .textContent("Please enter a name for this layout.")
                .required(true)
                .ok("Add")
                .cancel("Cancel"))
            .then((name) => {
                if (!name) return;

                const currentLayout: ILayout = {
                    name: name,
                    layout: {
                        columns: this.layout?.columns?.map((col: IColumn) => ({
                            ...col,
                            width: angular.element(`#co-${col.id}`).css("flex-basis"),
                            boxes: col.boxes.map((box: IBox) => ({
                                ...box, height: angular
                                    .element(`#box-${box.name}`)
                                    .css("flex-basis"),
                            })),
                        })) || [],
                    },
                };

                this.layouts.push(currentLayout);
                this.currentLayoutName = name;

                if (Modernizr.localstorage) {
                    localStorage.setItem(this.LayoutKey, JSON.stringify(this.layouts));
                    localStorage.setItem(this.LastActiveLayoutKey, name);
                }

                this.toastrService.showSuccessToast("Layout saved successfully");
            });
    }

    deleteLayout(index: number): void {
        if (index === 0) return; // Prevent deleting default layout

        this.$mdDialog
            .show(this.$mdDialog
                .confirm()
                .title("Delete Layout?")
                .textContent("Are you sure you want to delete this layout?")
                .ok("Delete")
                .cancel("Cancel"))
            .then(() => {
                this.layouts.splice(index, 1);
                if (Modernizr.localstorage) {
                    localStorage.setItem(this.LayoutKey, JSON.stringify(this.layouts));
                }
                this.loadLayout(0);
                this.toastrService.showSuccessToast("Layout deleted successfully");
            });
    }

    private updateBoxMetrics(): void {
        if (!this.layout || !this.layout.columns) return;

        this.layout.columns.forEach((column: IColumn) => {
            const columnEl = angular.element(`#co-${column.id}`);
            if (columnEl.length) {
                column.width = columnEl.css('flex-basis');

                column.boxes.forEach((box: IBox) => {
                    const boxEl = angular.element(`#box-${box.name}`);
                    if (boxEl.length) {
                        box.height = boxEl.css('flex-basis');
                    }
                });
            }
        });
    }

    private saveCurrentLayout(): void {
        if (!this.currentLayoutName || this.currentLayoutName === 'Default') {
            return;
        }

        this.updateBoxMetrics();

        const index = this.layouts.findIndex((l: ILayout) => l.name === this.currentLayoutName);
        if (index !== -1) {
            if (this.layout) {
                this.layouts[index].layout = angular.copy(this.layout);
            }

            if (Modernizr.localstorage) {
                localStorage.setItem(this.LayoutKey, JSON.stringify(this.layouts));
            }
        }
    }

    private applyLayoutDimensions(): void {
        if (!this.layout || !this.layout.columns) return;

        this.layout.columns.forEach((column: IColumn) => {
            const columnEl = angular.element(`#co-${column.id}`);
            if (columnEl.length) {
                columnEl.css('flex-basis', column.width);

                column.boxes.forEach((box: IBox) => {
                    const boxEl = angular.element(`#box-${box.name}`);
                    if (boxEl.length) {
                        boxEl.css('flex-basis', box.height || 'auto');
                    }
                });
            }
        });
    }

    private initializeBoxes(): void {
        this.boxes = {
            [DispatchBoxes.Map]: {
                name: DispatchBoxes.Map,
                title: 'Map',
                icon: "pin_drop",
                templateUrl: "app/components/home/partials/map.html",
                showRefresh: true,
                visible: true,
                description: "Interactive map view showing job locations and routes"
            },
            [DispatchBoxes.JobsList]: {
                name: DispatchBoxes.JobsList,
                title: 'Job List',
                icon: "list_alt",
                templateUrl: "app/components/home/partials/jobList.html",
                showRefresh: true,
                visible: true,
                description: "Sortable list of all active and pending jobs"
            },
            [DispatchBoxes.JobDetail]: {
                name: DispatchBoxes.JobDetail,
                title: 'Job Detail',
                icon: "assignment",
                templateUrl: "app/components/home/partials/jobDetail.html",
                showRefresh: true,
                showDetailButtons: true,
                visible: true,
                description: "Detailed information for selected job including status and actions"
            },
            [DispatchBoxes.DriverLocations]: {
                name: DispatchBoxes.DriverLocations,
                title: 'Driver Locations',
                icon: "person_pin_circle",
                // Uses React component directly in template, no templateUrl needed
                showRefresh: false,
                visible: true,
                description: "Real-time tracking of all driver positions"
            },
            [DispatchBoxes.CurrentWork]: {
                name: DispatchBoxes.CurrentWork,
                title: 'Current Work',
                icon: "local_shipping",
                templateUrl: "app/components/home/partials/currentWork.html",
                showRefresh: false,
                visible: true,
                description: "Overview of jobs currently in progress"
            },
            [DispatchBoxes.Supports]: {
                name: DispatchBoxes.Supports,
                title: 'Support Tasks',
                icon: "support",
                templateUrl: "app/components/home/partials/supports.html",
                showRefresh: true,
                visible: true,
                description: "Manage support requests and auxiliary tasks"
            }
        };

    }

    private getBoxVisibilityKey(layoutName: string): string {
        return `${this.BoxVisibilityKey}-${layoutName}`;
    }

    private saveBoxVisibility(): void {
        if (!Modernizr.localstorage || !this.boxes || !this.currentLayoutName) return;

        try {
            const boxState: Record<string, { visible: boolean; collapsed: boolean }> = {};
            Object.keys(this.boxes).forEach(boxName => {
                boxState[boxName] = {
                    visible: this.boxes![boxName].visible ?? true,
                    collapsed: this.boxes![boxName].collapsed ?? false
                };
            });
            const key = this.getBoxVisibilityKey(this.currentLayoutName);
            localStorage.setItem(key, JSON.stringify(boxState));
        } catch (error) {
            console.error('Error saving box visibility to storage:', error);
        }
    }

    private loadBoxVisibility(): void {
        if (!Modernizr.localstorage || !this.boxes || !this.currentLayoutName) return;

        try {
            const key = this.getBoxVisibilityKey(this.currentLayoutName);
            const savedState = localStorage.getItem(key);
            if (savedState) {
                const boxState = JSON.parse(savedState);
                Object.keys(boxState).forEach(boxName => {
                    if (this.boxes && this.boxes[boxName]) {
                        // Handle both old format (boolean) and new format (object)
                        if (typeof boxState[boxName] === 'boolean') {
                            // Old format - just visibility
                            this.boxes[boxName].visible = boxState[boxName];
                            this.boxes[boxName].collapsed = false;
                        } else {
                            // New format - object with visible and collapsed
                            this.boxes[boxName].visible = boxState[boxName].visible ?? true;
                            this.boxes[boxName].collapsed = boxState[boxName].collapsed ?? false;
                        }
                    }
                });
            } else {
                // No saved state for this layout - reset all boxes to visible and expanded
                Object.keys(this.boxes).forEach(boxName => {
                    this.boxes![boxName].visible = true;
                    this.boxes![boxName].collapsed = false;
                });
            }
        } catch (error) {
            console.error('Error loading box visibility from storage:', error);
        }
    }

    saveViewsToStorage(views: any): void {
        if (Modernizr.localstorage) {
            localStorage.setItem(this.SelectedViewsKey, JSON.stringify(views));
        }
    }

    loadViewsFromStorage(): any {
        if (Modernizr.localstorage) {
            try {
                const savedViews = JSON.parse(localStorage.getItem(this.SelectedViewsKey) ?? '');
                return savedViews || [];
            } catch (error) {
                console.error("Error loading views from storage:", error);
                return [];
            }
        }
        return [];
    }

    toggleSidenav(): void {
        try {
            this.$mdSidenav("right").toggle();
        } catch (error) {
            console.warn('Sidenav not available yet:', error);
            this.registerTimeout(() => {
                try {
                    this.$mdSidenav("right").toggle();
                } catch (retryError) {
                    console.error('Sidenav still not available:', retryError);
                }
            }, 100);
        }
    }

    async loadPageViews(): Promise<void> {
        try {
            this.views = await this.DispatchData.getSelectedViews(AppPage.Dispatch);
            await this.initializeViews();

            await this.fetchDriverLocations();
        } catch (error) {
            console.error("Error fetching dispatch views:", error);
            this.views = [];
            await this.initializeViews();
            await this.fetchDriverLocations();
        }
    }

    async initializeViews(): Promise<void> {
        if (this.views && this.views.length > 0) {
            const hasSavedState = localStorage.getItem(this.SelectedViewsKey) !== null;
            const savedViews = this.loadViewsFromStorage();
            const savedIds = new Set(savedViews.map((v: DfrntPageViewModel) => v.id));

            // Mark server views as selected based on saved IDs
            this.views = this.views.map((view) => ({
                ...view, selected: savedIds.has(view.id),
            }));

            // Rebuild selectedViews from fresh server view objects (not stale localStorage copies)
            this.selectedViews = this.views.filter(v => v.selected);

            // Only default to first view on first visit (no saved state).
            // If user explicitly cleared all views, respect that.
            if (this.selectedViews.length === 0 && !hasSavedState) {
                this.views[0].selected = true;
                this.selectedViews = [this.views[0]];
                this.saveViewsToStorage(this.selectedViews);
            }
        }

        // Always set viewsInitialized to true, even if views are empty
        // This prevents the loading spinner from staying forever
        this.viewsInitialized = true;
    }

    async selectAllViews(): Promise<void> {
        this.views.forEach((view: DfrntPageViewModel) => {
            view.selected = true;
        });

        this.selectedViews = this.views;

        this.saveViewsToStorage(this.selectedViews);
        this.updateMapForSelectedViews();

        await Promise.all([
            this.getData(),
            this.fetchDriverLocations()
        ]);
    }

    async clearAllViews(): Promise<void> {
        this.views.forEach((view: DfrntPageViewModel) => {
            view.selected = false;
        });

        this.selectedViews = [];

        this.saveViewsToStorage(this.selectedViews);
        this.updateMapForSelectedViews();

        await Promise.all([
            this.getData(),
            this.fetchDriverLocations()
        ]);
    }

    async toggleView(view: DfrntPageViewModel): Promise<void> {
        if (view.selected) {
            if (!this.selectedViews.some((v: DfrntPageViewModel) => v.id === view.id)) {
                this.selectedViews.push(view);
            }
        } else {
            const index = this.selectedViews.findIndex((v: DfrntPageViewModel) => v.id === view.id);
            if (index > -1) {
                this.selectedViews.splice(index, 1);
            }
        }

        // Save filtered views
        this.saveViewsToStorage(this.selectedViews);

        // Update map bounds for a new selection
        this.updateMapForSelectedViews();

        // Run both promises in parallel without debouncing
        await Promise.all([
            this.getData(),
            this.fetchDriverLocations()
        ]);
    }

    areAllViewsSelected(): boolean {
        return this.views && this.views.length > 0 && this.views.every((v: DfrntPageViewModel) => v.selected);
    }

    updateMapForSelectedViews(): void {
        if (this.initialViewSet) return;

        if (!this.selectedViews || this.selectedViews.length === 0) return;

        if (!this.autoZoomEnabled) {
            this.initialViewSet = true;
            return;
        }

        if (this.selectedViews.length === 1) {
            // For a single view, use its coordinates
            const view = this.selectedViews[0];
            if (view.centerLatitude && view.centerLongitude) {
                this.mapCenter = {
                    lat: view.centerLatitude, lng: view.centerLongitude,
                };
                this.mapZoom = 7; // Closer zoom for a single view
            }
        } else {
            // For multiple views, center on the tenant's country
            this.mapCenter = this.APP_CONFIG.US_Customer
                ? this.APP_CONFIG.US_Coordinates_Center
                : this.APP_CONFIG.NZ_Coordinates_Center;
            this.mapZoom = 4;
        }

        this.initialViewSet = true;
    }

    async unlockJob(currentJob: IDispatchJob): Promise<void> {
        await this.DispatchData.updateJobDetail(currentJob.id, JobProperty.Locked, false, currentJob.preBook ?? false)
    }

    async lockJob(currentJob: IDispatchJob): Promise<void> {
        await this.DispatchData.updateJobDetail(currentJob.id, JobProperty.Locked, true, currentJob.preBook ?? false)
    }

    private async processClearListJobs(selectedClearListId: number): Promise<void> {
        this.selectedClearListId = selectedClearListId;

        let orderBy = this.queryParams.order || 'time';
        let orderDirection = 'asc';
        if (orderBy.startsWith('-')) {
            orderBy = orderBy.substring(1);
            orderDirection = 'desc';
        }

        // Update React component to use clear list fetch with the selected clear list ID
        if (window.ReactJobList) {
            window.ReactJobList.updateSearchParams({
                order: orderBy,
                orderDirection: orderDirection,
                startDate: this.dateFilterData.startDate,
                endDate: this.dateFilterData.endDate,
                useTime: this.dateFilterData.useTime,
                page: this.currentJobListPage,
                pageSize: this.currentJobListPageSize,
                searchText: this.queryParams.searchText,
                statusFilter: this.queryParams.statusFilter,
                isInternal: ClientInternal ?? false,
                despatchViewIds: this.selectedViews.map(v => v.id),
                selectedClearListId: selectedClearListId,
            });
        }
    }

    async handleDispatchSelection(selectedCourier: ISuggestion, _model: ISuggestion, _label: string, $event: MouseEvent, job: IDispatchJob): Promise<void> {
        // Prevent duplicate dispatch attempts
        if ($event === undefined) return;

        if (!selectedCourier || !selectedCourier.id) return;

        try {
            await this.dispatchJob(selectedCourier.id, job.id);

            // Clear the search text after successful dispatch
            job.searchText = '';

            // Update the job's assigned courier display
            job.assignedCourier = selectedCourier;

        } catch (error) {
            console.error("Error in dispatch:", error);
            job.assignedCourier = undefined;
        }
    }

    async swapPOD($event: MouseEvent): Promise<void> {
        try {
            const jobNumber = await this.promptForJobNumber($event);
            const secondJobId = await this.validateSwapPOD(jobNumber);
            if (!secondJobId) {
                await this.showInvalidJobAlert();
                return;
            }

            if (!this.currentJob) return;
            const firstJobId = this.currentJob.id;
            await this.confirmSwapPOD($event, this.currentJob.jobNo, jobNumber);
            await this.performSwapPOD(this.currentJob.jobNo, jobNumber);
            await this.showSuccessAlert();
            await this.updateJobsAfterSwap(secondJobId, firstJobId);
        } catch (error) {
            console.error("POD Swap Canceled or Error occurred", error);
        }
    }

    async promptForJobNumber($event: MouseEvent): Promise<angular.IPromise<any>> {
        return this.$mdDialog.show(this.$mdDialog
            .prompt()
            .title("Enter the other job number")
            .textContent("Please enter the Job Number to swap the POD.")
            .placeholder("Job Number")
            .ariaLabel("Job Number")
            .targetEvent($event)
            .required(true)
            .ok("Submit")
            .cancel("Cancel"));
    }

    validateSwapPOD(jobNumber: string): Promise<number> {
        return this.DispatchData.validateSwapPOD(jobNumber);
    }

    async showInvalidJobAlert(): Promise<void> {
        await this.$mdDialog.show(this.$mdDialog
            .alert()
            .clickOutsideToClose(true)
            .title("Invalid Job")
            .textContent("This job is invalid.")
            .ok("OK"));
    }

    async confirmSwapPOD(event: MouseEvent, currentJobNo: string, jobNumber: string): Promise<void> {
        await this.$mdDialog.show(this.$mdDialog
            .confirm()
            .title("Swap Delivery Info?")
            .textContent(`Are you sure you wish to swap delivery info between ${currentJobNo} and ${jobNumber}?`)
            .targetEvent(event)
            .ok("Yes")
            .cancel("No"));
    }

    async performSwapPOD(currentJobNo: string, jobNumber: string): Promise<void> {
        await this.DispatchData.swapPOD(currentJobNo, jobNumber);
        this.toastrService.showSuccessToast("POD swapped successfully");
    }

    async showSuccessAlert(): Promise<void> {
        await this.$mdDialog.show(this.$mdDialog
            .alert()
            .clickOutsideToClose(true)
            .title("Successful")
            .textContent("POD Swap Completed Successfully")
            .ok("OK"));
    }


    async updateJobsAfterSwap(secondJobId: number, firstJobId: number): Promise<void> {
        await this.DispatchData.reSendJobs([secondJobId, firstJobId]);
        await this.DispatchData.reAssignJobs([firstJobId]);
    }

    async otherEventForm(_$event: MouseEvent, job: IDispatchJob): Promise<void> {
        await openAddEventDialog({
            job: {
                id: job.id,
                jobNo: job.jobNo,
                client: job.client ?? '',
                clientId: job.clientId,
            },
            toastService: this.createToastAdapter(),
        });
    }

    private createToastAdapter() {
        return {
            showToast: (message: string, type: ToastType) => {
                switch (type) {
                    case 'success':
                        this.toastrService.showSuccessToast(message);
                        break;
                    case 'warning':
                        this.toastrService.showWarningToast(message);
                        break;
                    case 'error':
                        this.toastrService.showErrorToast(message);
                        break;
                    case 'info':
                        this.toastrService.showSuccessToast(message);
                        break;
                }
            },
        };
    }

    private async dispatchJob(courierId: number, jobId: number): Promise<void> {
        try {
            await this.dispatchJobService.assignSingleJobById(courierId, jobId);

            // Inform the user - get the actual courier name for the courier we dispatched to
            try {
                const courier = await this.DispatchData.getCourierById(courierId);
                if (courier) {
                    const courierDisplay = (courier.id && courier.id !== 'undefined' && courier.id.trim() !== '')
                        ? `${courier.id}: ${courier.name}`
                        : courier.name;
                    this.toastrService.showSuccessToast("Dispatched to " + courierDisplay);
                }
            } catch (error) {
                console.warn("Could not fetch courier name for toast:", error);
                this.toastrService.showSuccessToast("Job dispatched successfully");
            }

            // Save the job ID before getData() which clears currentJob
            const savedJobId = jobId;

            await this.getData();

            // Restore the job ID and refresh the job detail to show updated courier assignment
            this.currentJobId = savedJobId;
            this.refreshJobDetail();
        } catch (error) {
            console.error("Error dispatching jobs:", error);
            throw error;
        }
    }

    async reAllocateJobs(job: IDispatchJob): Promise<void> {
        if (!job) return;

        await this.dispatchJobService.reassignJob(job);
        await this.getData();
        await this.searchCourier();
    }

    async splitJob(_$event: MouseEvent, job: IDispatchJob): Promise<void> {
        if (!window.confirm('Are you sure you wish to split this job?')) return;
        try {
            const {executeSplitJobFlow} = await import(
                /* webpackChunkName: "splitJobFlow" */ '../../react/services/splitJobFlow'
                );
            const toastMap = {
                success: (m: string) => this.toastrService.showSuccessToast(m),
                error: (m: string) => this.toastrService.showErrorToast(m),
                warning: (m: string) => this.toastrService.showWarningToast(m),
                info: (m: string) => this.toastrService.showInfoToast(m),
            } as const;
            await executeSplitJobFlow({
                job: job as any,
                showToast: (msg, type) => toastMap[type](msg),
                onComplete: () => {
                    window.ReactJobList?.refresh();
                    this.getData();
                },
            });
        } catch (error) {
            console.error('Error in splitJob:', error);
        }
    }

    async getPotentialCouriers(jobId: number): Promise<void> {
        try {
            this.potentialCouriers = await this.DispatchData.getPotentialCouriers(jobId);
        } catch (error) {
            console.error("Error getting potential couriers:", error);
        }
    }

    async updateCourierData(courierId: number, courierName: string, courierCode?: string): Promise<void> {
        if (courierCode) {
            this.currentWorkSelection = ` for Courier ${courierCode}: ${courierName}`;
        } else {
            this.currentWorkSelection = ` for Courier ${courierName}`;
        }
        this.currentCourier = {id: courierId, text: courierName};

        // Get current jobs for the courier
        await this.getCurrentJobs(courierId);

        try {
            this.truckCourierStatus = await this.DispatchData.truckCourierStatus(courierId);
        } catch (error) {
            console.error("Error fetching truck courier status:", error);
        }
    }

    async searchCourier(): Promise<void> {
        try {
            if (!this.selectedCourier) return;
            const foundCourier = await this.DispatchData.getCourierById(this.selectedCourier.id);
            if (!foundCourier) {
                this.toastrService.showWarningToast("Courier not found");
                return;
            }

            // Set courier
            await this.updateCourierData(foundCourier.courierId, foundCourier.name, foundCourier.id);
        } catch (error) {
            console.error("Error searching courier:", error);
        }
    }

    async selectCourier(courier: ICourierData): Promise<void> {
        try {
            this.currentListLoading = true;
            this.currentWorkViewMode = CurrentWorkLists.SelectedDriver;
            this.applyScope();

            if (!courier || !courier.courierId) return;
            const foundCourier = await this.DispatchData.getCourierById(courier.courierId);
            if (foundCourier) {
                this.currentCourier = {
                    id: foundCourier.courierId,
                    text: foundCourier.name,
                };

                // Use courier code (id field) if available, otherwise fall back to name
                const courierDisplay = (foundCourier.id && foundCourier.id !== 'undefined' && foundCourier.id.trim() !== '')
                    ? `${foundCourier.id}: ${foundCourier.name}`
                    : foundCourier.name;
                this.currentWorkSelection = ` for Courier ${courierDisplay}`;
                await this.getCurrentJobs(foundCourier.courierId);

                try {
                    this.truckCourierStatus = await this.DispatchData.truckCourierStatus(foundCourier.courierId);
                } catch (error) {
                    console.warn("Error fetching truck courier status:", error);
                }
            } else {
                console.warn("Courier not found in active or all couriers list");
                this.toastrService.showErrorToast("An unexpected error occurred. Please contact support.");
            }
        } catch (error) {
            console.error("Error selecting courier:", error);
            this.toastrService.showErrorToast("Error loading courier information");
        } finally {
            this.currentListLoading = false;
            this.applyScope();
        }
    }

    async getCurrentJobs(courierId: number): Promise<void> {
        if (!courierId) {
            console.warn("No courier ID provided");
            return;
        }

        try {
            this.currentListLoading = true;
            this.applyScope();

            // Determine date range based on todayOnly toggle
            let startDate: dayjs.Dayjs;
            let endDate: dayjs.Dayjs;

            if (this.currentWorkTodayOnly) {
                // Today only: start of today to end of today in tenant timezone
                const tz = getIanaTimezone(TimeZone);
                startDate = dayjs().tz(tz).startOf('day');
                endDate = dayjs().tz(tz).endOf('day');
            } else if (this.dateFilterData) {
                // Use dispatch page's date filter range
                startDate = this.dateFilterData.startDate;
                endDate = this.dateFilterData.endDate;
            } else {
                // Fallback to defaults
                const defaultRange = setDateFilterDefaults();
                startDate = defaultRange.startDate;
                endDate = defaultRange.endDate;
            }

            const result = await this.DispatchData.getJobsCurrent(
                courierId,
                startDate,
                endDate
            );
            this.jobsCurrentList = result.jobs;

            if (this.jobsCurrentList && this.jobsCurrentList.length > 0) {
                console.debug(`Setting mapJobList for courier ${courierId} with ${this.jobsCurrentList.length} jobs`);
                this.mapJobList = this.getUndispatchedMapItems(result.jobs);
            } else {
                console.debug(`No jobs found for courier ${courierId}`);
                this.mapJobList = [];
            }

        } catch (error) {
            console.error("Error getting current jobs:", error);
            this.jobsCurrentList = [];
        } finally {
            this.currentListLoading = false;
            this.applyScope();

            // Push data to React current work panel after applyScope so the
            // ng-if="ctrl.jobsCurrentList" container is in the DOM.
            this.updateReactCurrentWorkJobList();
        }
    }

    async selectSupportJobDetail(task: ITask): Promise<void> {
        console.debug(' Starting with task:', {
            jobId: task.jobId,
            jobNumber: task.jobNumber,
            taskId: task.id
        });

        if (!this.tasksService.validateTaskJobId(task, (message) => {
            this.toastrService.showWarningToast(message);
        })) {
            return;
        }

        try {
            console.debug(' Fetching job details for jobId:', task.jobId);

            const jobLists = [
                {list: this.jobList, name: 'jobList'}
            ];

            let attachedJob = this.tasksService.findTaskJobInLists(task.jobId, jobLists);

            if (!attachedJob) {
                attachedJob = await this.DispatchData.getDispatchJobDetail(task.jobId);
            }

            if (!attachedJob) {
                this.toastrService.showWarningToast("This task has no job attached");
                console.warn(' No job found for jobId:', task.jobId);
                return;
            }

            await this.selectJob(attachedJob);
            console.debug(' Job selected successfully');

            this.currentSelection = ` for Job ${attachedJob.jobNo}`;
        } catch (error) {
            this.toastrService.showErrorToast("Error loading job information");
            console.error(' Error loading job information', error);
        }
    }

    async selectJob(job: IDispatchJob): Promise<void> {
        if (!job) return;

        // Cancel any existing task loading for a previous job
        if (this.currentJobId && this.currentJobId !== job.id) {
            this.tasksService.cancelJobTaskLoading(this.currentAppPage, this.currentJobId);
        }

        // Only switch to the Selected Driver view if not in All Drivers (Overview) mode
        if (this.currentWorkViewMode !== CurrentWorkLists.Overview) {
            this.currentWorkViewMode = CurrentWorkLists.SelectedDriver;
        }

        // Set jobId and trigger digest IMMEDIATELY — before any async work
        // so the React job detail component receives the binding and starts fetching
        this.currentJob = angular.copy(job);
        this.currentJobId = job.id;
        this.currentSelection = ` for Job ${job.jobNo}`;
        console.debug('currentSelection:', this.currentSelection);

        // Sync selection to React job list
        if (window.ReactJobList) {
            window.ReactJobList.selectJob(job.id);
        }

        this.applyScope();

        // Fire-and-forget: mark read status without blocking job detail loading
        await this.markJobReadStatus(job.id, true);

        // Load tasks in the background without blocking job selection
        this.loadSupportsInBackground(undefined, job.id);

        try {
            if (!job.courier && !job.assignedCourier) {
                // Scenario 2: Job has no courier assigned - show only this job
                console.debug("Selected job has no courier - showing only this job on map");

                const mapJobItem = this.mapToDispatchMapItem(job);
                this.mapJobList = [mapJobItem]

                // Get potential couriers for this job but preserve the current courier context if one exists
                await this.getPotentialCouriers(job.id);
                // Note: We don't clear the currentCourier here to preserve the courier's current work list
            } else {
                // Scenario 3: Job has a courier assigned - show this courier's jobs
                console.debug("Selected job has courier assigned - loading courier's jobs");
                this.potentialCouriers = undefined;

                if (job.courierData && job.courierData.courierId) {
                    const isSameCourier = this.currentCourier?.id === job.courierData.courierId;

                    // Set the current courier context first
                    this.currentCourier = {
                        id: job.courierData.courierId,
                        text: job.courierData.courierName || job.courier || job.assignedCourier?.text || 'Unknown Courier'
                    };

                    this.currentWorkSelection = ` for Courier ${job.courierData.courier}: ${job.courierData.courierName}`;

                    // Only reload the current work list if the courier changed
                    if (!isSameCourier) {
                        await this.getCurrentJobs(job.courierData.courierId);
                    }

                    try {
                        this.truckCourierStatus = await this.DispatchData.truckCourierStatus(job.courierData.courierId);
                    } catch (error) {
                        console.warn("Error fetching truck courier status:", error);
                    }
                } else {
                    // Fallback if no courier data available
                    console.warn("Job has courier assigned but missing courierData");
                    const mapJobItem = this.mapToDispatchMapItem(job);
                    this.mapJobList = [mapJobItem]
                }
            }
        } catch (error) {
            console.error("Error in selectJob:", error);
            // Fallback to showing just the current job
            const mapJobItem = this.mapToDispatchMapItem(job);
            this.mapJobList = [mapJobItem]
        }

        // Only focus the dispatch field for the selected job
        this.focusDispatchField(job.id);
        this.applyScope();
    }

    /**
     * Handle job selection from map marker click.
     * Map items use jobId instead of id, so we need to look up the full job.
     */
    async selectJobFromMap(mapItem: IDispatchMapItem): Promise<void> {
        if (!mapItem || !mapItem.jobId) {
            console.warn('selectJobFromMap: Invalid map item', mapItem);
            return;
        }

        // Try to find the job in our loaded list first
        let job = this.jobList.find(j => j.id === mapItem.jobId);

        // If not found in list, fetch from server
        if (!job) {
            try {
                job = await this.DispatchData.getDispatchJobDetail(mapItem.jobId);
            } catch (error) {
                console.error('Error fetching job details for map selection:', error);
                this.toastrService.showErrorToast('Error loading job details');
                return;
            }
        }

        if (job) {
            await this.selectJob(job);
        }
    }

    private mapToDispatchMapItem(job: IDispatchJob): IDispatchMapItem {
        return {
            jobId: job.id,
            jobNo: job.jobNo,
            pickupAddress: job.pickupAddress,
            deliveryAddress: job.deliveryAddress,
            statusId: job.statusId
        }
    }

    /**
     * Filters jobs to only undispatched (statusId = 0) and converts to map items
     * This improves map performance by only showing jobs that need dispatching
     */
    private getUndispatchedMapItems(jobs: IDispatchJob[]): IDispatchMapItem[] {
        if (!jobs || jobs.length === 0) return [];

        return jobs
            .filter(job => job.statusId === 0) // Only New/Undispatched jobs
            .map(job => this.mapToDispatchMapItem(job));
    }

    private loadSupportsInBackground(filterType: string = this.supportsFilter, jobId?: number): void {
        const effectiveJobId = jobId || this.currentJobId;

        // Don't load tasks if no job is selected
        if (!effectiveJobId) {
            this.supports = [];
            this.filteredSupports = [];
            return;
        }

        if (this.supportsLoadingInBackground) {
            console.debug("Supports already loading in background, cancelling previous");
            this.tasksService.cancelJobTaskLoading(this.currentAppPage, this.currentJobId);
        }

        this.supportsLoadingInBackground = true;

        const filterRequest = this.tasksService.buildFilterRequest(
            filterType,
            effectiveJobId,
            this.staffFilter,
            this.eventTypeFilter
        );

        this.tasksService.loadTasksInBackground(filterRequest, (tasks, error) => {
            // Only process if this is still the current job
            if (effectiveJobId === this.currentJobId) {
                this.supportsLoadingInBackground = false;

                if (error) {
                    console.error("Error loading supports in background:", error);
                    this.supports = [];
                    this.filteredSupports = [];
                } else {
                    this.supports = tasks;
                    this.filteredSupports = tasks;
                }

                this.applyScope();
            } else {
                console.debug(`Ignoring task results for old job ${effectiveJobId}, current is ${this.currentJobId}`);
            }
        }, this.currentAppPage, effectiveJobId);
    }

    async handleUndispatchedJob(job: IDispatchJob): Promise<void> {
        await this.getPotentialCouriers(job.id);
        this.currentCourier = undefined;
        this.currentSelection = ` for Job ${job.jobNo}`;
    }

    focusDispatchField(jobId: number): void {
        const inputField = angular.element(`#input_${jobId}`);
        if (inputField.length) {
            const inputElement = inputField.find('input');
            if (inputElement.length) {
                const htmlInputElement = (inputElement as any)[0] as HTMLInputElement;
                htmlInputElement.focus();

                const job = this.jobList.find(j => j.id === jobId);
                if (job && !job.courier && !job.assignedCourier) {
                    htmlInputElement.select();
                }
            }
        }

        this.applyScope();
    }

    async setTruckMode(mode: string): Promise<void> {
        this.truckMode = mode;
        await this.getData();
    }

    handleBackendFilter = async (column: string, direction: string): Promise<void> => {
        this.queryParams.order = (direction == 'desc' ? '-' : '') + column;
        // Sort is now handled by the React hook via updateSort — no need to call getJobList
    }

    handleCategoryChange = async (category: string): Promise<void> => {
        // Only update the backend filter if a ClearListArea is active
        if (!this.selectedClearListId) {
            return;
        }

        // Update the status filter based on category
        this.queryParams.statusFilter = category;

        // Re-fetch jobs with the new filter
        await this.processClearListJobs(this.selectedClearListId);
    }

    async getJobList(): Promise<void> {
        if (!this.viewsInitialized && this.selectedViews.length === 0) {
            console.debug('Views not initialized yet, loading defaults');
            this.selectedViews = this.loadViewsFromStorage();

            // If still no views, add at least one default view
            if (this.selectedViews.length === 0 && this.views.length > 0) {
                this.selectedViews = [this.views[0]];
            }
        }

        if (Modernizr.localstorage) {
            localStorage.setItem(this.DispatchFiltersKey, JSON.stringify(this.queryParams));
        }

        let orderBy = this.queryParams.order || 'time';
        let orderDirection = 'asc';
        if (orderBy.startsWith('-')) {
            orderBy = orderBy.substring(1);
            orderDirection = 'desc';
        }

        // Push updated params to React — React Query handles the fetch
        if (window.ReactJobList) {
            window.ReactJobList.updateSearchParams({
                order: orderBy,
                orderDirection: orderDirection,
                startDate: this.dateFilterData.startDate,
                endDate: this.dateFilterData.endDate,
                useTime: this.dateFilterData.useTime,
                page: this.currentJobListPage,
                pageSize: this.currentJobListPageSize,
                searchText: this.queryParams.searchText,
                statusFilter: this.queryParams.statusFilter,
                isInternal: ClientInternal ?? false,
                despatchViewIds: this.selectedViews.map(v => v.id),
                selectedClearListId: this.selectedClearListId,
            });
        }
    }

    async getData(): Promise<void> {
        try {
            this.currentJob = undefined;
            this.potentialCouriers = undefined;

            // If there's a current courier, preserve it and refresh their jobs
            const hasCourier = !!this.currentCourier;
            const courierId = this.currentCourier?.id;

            // Only clear currentCourier if no courier is selected
            if (!hasCourier) {
                this.currentCourier = undefined;
            }

            this.loadSupportsInBackground();
            await this.getJobList();

            if (this.isUsCustomer) await this.loadDriversWithJobCounts();

            // If we had a courier selected, refresh their current work list
            if (hasCourier && courierId) {
                await this.getCurrentJobs(courierId);
            }
        } catch (error) {
            console.error("Error in getData:", error);
            this.toastrService.showErrorToast("An error occurred while loading data. Please refresh the page.");
        }
    }

    async refreshBox(boxName: string): Promise<void> {
        console.debug("'Refresh box called. ", boxName);

        switch (boxName) {
            case DispatchBoxes.JobDetail:
                this.refreshJobDetail();
                break;
            case DispatchBoxes.Supports:
                await this.getSupports();
                break;
            case DispatchBoxes.JobsList:
                if (window.ReactJobList) {
                    window.ReactJobList.refresh();
                }
                break;
            case DispatchBoxes.Map:
            default:
                await this.getData();
                break;
        }
    }

    toggleBoxCollapse(boxName: string): void {
        if (!this.boxes || !this.boxes[boxName]) return;
        if (this.isDefaultLayout()) return; // Don't allow collapse on default layout

        this.boxes[boxName].collapsed = !this.boxes[boxName].collapsed;
        this.saveBoxVisibility();
        this.applyScope();
    }

    isDefaultLayout(): boolean {
        return this.currentLayoutName === 'Default';
    }

    refreshJobDetail(): void {
        if (!this.currentJobId) {
            console.debug("No job selected to refresh");
            return;
        }

        console.debug('refreshing job detail!');

        if (window.ReactJobDetails?.refresh) {
            window.ReactJobDetails.refresh();
        }
    }


    async fetchDriverLocations(): Promise<void> {
        this.driverLocationsLoading = true;
        this.updateDriverLocationsDisplay();

        await this.getDriverLocationsData();

        this.driverLocationsLoading = false;
        this.updateDriverLocationsDisplay();
        this.applyScope();
    }

    async getDriverLocationsData(): Promise<void> {
        try {
            if (!this.selectedViews || this.selectedViews.length === 0) {
                console.debug('No selected views available for driver locations');
                this.driverLocations = {areas: []};
                this.updateDriverLocationsDisplay();
                return;
            }

            console.debug('Fetching driver locations for views:', this.selectedViews);
            this.driverLocations = await this.DispatchData.getDriverLocations(
                this.selectedViews,
                this.dateFilterData
            );
            console.debug('Driver locations received:', this.driverLocations);
            this.updateDriverLocationsDisplay();
        } catch (error) {
            console.error("Error getting driver locations data:", error);
            this.driverLocations = {areas: []};
            this.updateDriverLocationsDisplay();
        }
    }

    async openTruckLoadingStatus($event: MouseEvent): Promise<void> {
        if (!this.truckCourierStatus) {
            console.error("No truck courier status available");
            return
        }
        await this.truckCourierStatusDialog.showTruckLoadingStatus($event, this.truckCourierStatus);
    }

    async createNewJob($event: MouseEvent): Promise<void> {
        try {
            const newJobId = await this.createJobDialog.showCreateJobDialog($event);
            if (newJobId) {
                await this.processNewJob(newJobId);
                console.debug("Create new job process completed.");
            }
        } catch (error) {
            console.error("Error in createNewJob:", error);
        } finally {
            this.applyScope();
        }
    }

    async processNewJob(newJobId: number): Promise<void> {
        await this.getData();

        const job = this.jobList.find(j => j.id === newJobId);
        if (!job) return;

        await this.selectJob(job);
        this.toastrService.showSuccessToast("New Job Created Successfully");
    }

    async interCourierCharge(): Promise<void> {
        await openInterCourierChargeDialog(this.createToastAdapter());
    }

    async openFileAttachmentDialog($event: MouseEvent, job: IDispatchJob): Promise<void> {
        await this.jobFileUploadDialog.openJobFileUploadDialog($event, job);
    }

    async showAccessorialChargesMenu($event: MouseEvent, job: IDispatchJob): Promise<void> {
        await this.accessorialChargesDialog.showAccessorialChargesDialog($event, job);
    }

    async loadSupports(filterType: string = this.supportsFilter): Promise<void> {
        // Don't load tasks if no job is selected
        if (!this.currentJobId) {
            this.supports = [];
            this.filteredSupports = [];
            return;
        }

        try {
            this.supportsLoading = true;
            this.applyScope();

            const filterRequest = this.tasksService.buildFilterRequest(
                filterType,
                this.currentJobId,
                this.staffFilter,
                this.eventTypeFilter
            );

            console.debug('Filter request:', filterRequest);

            const tasks = await this.tasksService.loadTasks(filterRequest);
            this.supports = tasks;
            this.filteredSupports = tasks;

        } catch (error) {
            console.error("Error loading supports:", error);
            this.toastrService.showErrorToast("Error loading support tasks");
            this.supports = [];
            this.filteredSupports = [];
        } finally {
            this.supportsLoading = false;
            this.applyScope();
        }
    }

    getTasksStatusCount(statusType: string): number {
        return this.tasksService.getTasksStatusCount(this.supports, statusType);
    }

    async filterTasks(filterType: string): Promise<void> {
        this.supportsFilter = filterType;
        await this.loadSupports(filterType);
    }

    async getSupports(): Promise<void> {
        await this.loadSupports(this.supportsFilter);
    }

    private async markJobReadStatus(jobId: number, isRead: boolean) {
        const jobIndex = this.jobList.findIndex((job) => job.id === jobId);
        if (jobIndex !== -1) {
            this.jobList[jobIndex] = {
                ...this.jobList[jobIndex],
                hasBeenRead: isRead
            };
        }

        await this.DispatchData.updateJobReadStatus(jobId, isRead);
    }

    private updateDriverLocationsDisplay(): void {
        const hasAreas = this.driverLocations && this.driverLocations.areas && this.driverLocations.areas.length > 0;

        console.debug('Updating driver locations display:', {
            loading: this.driverLocationsLoading,
            hasDriverLocations: !!this.driverLocations,
            areasCount: this.driverLocations?.areas?.length || 0,
            hasAreas: hasAreas
        });

        this.showDriverLocationsNoData = !this.driverLocationsLoading && !hasAreas;
        this.showDriverLocationsData = !this.driverLocationsLoading && !!hasAreas;
    }

    isDeliveryJob(job: IDispatchJob): boolean {
        return job.isAgentJob;
    }

    async addStopToJob($event: MouseEvent, job: IDispatchJob): Promise<void> {
        const setLoadingState = (isLoading: boolean) => {
            this.isDataLoading = isLoading;
            this.applyScope();
        };

        try {
            setLoadingState(true);

            const newStopJobId = await this.jobAddStopService.addNewStop(job, $event);

            if (newStopJobId) {
                const newStopJob = this.jobList.find(j => j.id === newStopJobId) ||
                    (await this.DispatchData.getDispatchJobDetail(newStopJobId));

                if (newStopJob) {
                    await this.selectJob(newStopJob);
                }
            } else {
                this.currentJobId = job.id;
                this.currentJob = job;
            }
        } catch (error: unknown) {
            console.error('Error in addStopToJob:', error);
            this.toastrService.showErrorToast(
                error instanceof Error && error.message?.includes('loading') ? 'Error loading new stop job details' : 'Failed to add stop to job'
            );
        } finally {
            setLoadingState(false);
            this.applyScope();
        }
    }

    async openMessagingDialog($event: MouseEvent): Promise<void> {
        await this.messagingDialog.openMessagingDialog($event);
    }

    private async getUnreadMessageCount(): Promise<void> {
        this.unReadMessageCount = await this.messagingDialog.getUnreadMessageCount();
        this.applyScope();
    }


    async filterByStaff(selectedStaff: string | ISuggestion): Promise<void> {
        if (typeof selectedStaff === 'string') {
            this.staffFilter = selectedStaff;
        } else {
            this.staffFilter = selectedStaff.id?.toString() || 'all';
        }

        this.tasksService.saveStaffFilter(this.staffFilter, this.currentAppPage);
        await this.loadSupports();
    }

    async filterBySupportType(selectedType: string | ISuggestion): Promise<void> {
        if (typeof selectedType === 'string') {
            this.eventTypeFilter = selectedType;
        } else {
            this.eventTypeFilter = selectedType.id?.toString() || 'all';
        }

        this.tasksService.saveEventTypeFilter(this.eventTypeFilter, this.currentAppPage);
        await this.loadSupports();
    }

    getActiveSupportFilterNames(): string {
        return this.tasksService.getActiveFilterNames(
            this.staffFilter,
            this.eventTypeFilter,
            this.staffList,
            this.eventTypesList
        );
    }

    async handleJobDispatch(job: IDispatchJob, courierId: number): Promise<boolean> {
        try {
            await this.dispatchJob(courierId, job.id);

            job.assignedCourier = {id: courierId, text: ''};

            if (this.currentJobId === job.id) {
                const updatedJob = await this.DispatchData.getDispatchJobDetail(job.id);
                this.currentJob = angular.copy(updatedJob);
                this.applyScope();
            }

            return true;
        } catch (error) {
            console.error("Error in dispatch:", error);
            throw error;
        }
    }

    initRefreshIntervalOptions(): void {
        const disabledOption: ISuggestion = {id: 0, text: "Disabled"};

        this.refreshIntervalOptions = [
            disabledOption,
            ...getMinsSelectionOptions()
        ];
        this.selectedRefreshInterval = this.refreshIntervalOptions[0];
    }

    onRefreshIntervalChange(selectedInterval: ISuggestion): void {
        console.debug('Refresh interval changed to:', selectedInterval, 'seconds');

        this.selectedRefreshInterval = selectedInterval;

        if (Modernizr.localstorage && this.selectedRefreshInterval) {
            localStorage.setItem(this.RefreshDurationIntervalKey, this.selectedRefreshInterval?.id.toString());
        }

        this.stopAutoRefresh();

        if (this.selectedRefreshInterval && this.selectedRefreshInterval.id > 0) {
            this.startAutoRefresh();
        }

        this.applyScope();
    }

    private startAutoRefresh(): void {
        if (!this.selectedRefreshInterval || this.selectedRefreshInterval.id <= 0) {
            return;
        }

        // Always stop any existing refresh first
        this.stopAutoRefresh();

        console.debug(`Starting auto refresh every ${this.selectedRefreshInterval.id} seconds (${this.selectedRefreshInterval.text})`);

        this.isAutoRefreshEnabled = true;

        this.refreshIntervalPromise = this.registerInterval(async () => {
            if (this.isAutoRefreshEnabled) {
                console.debug('Auto refreshing job lists...');
                try {
                    await this.getData();

                    // Also refresh tasks if a job is selected
                    if (this.currentJobId) {
                        await this.loadSupports();
                    }

                    console.debug('Auto refresh completed successfully');
                } catch (error) {
                    console.error('Error during auto refresh:', error);
                }
            }
        }, this.selectedRefreshInterval.id * 1000);

        this.applyScope();
    }

    private stopAutoRefresh(): void {
        console.debug('Stopping auto refresh');
        this.isAutoRefreshEnabled = false;

        if (this.refreshIntervalPromise) {
            const cancelled = this.cancelInterval(this.refreshIntervalPromise);
            if (cancelled) {
                console.debug('Successfully cancelled refresh interval');
            } else {
                console.warn('Failed to cancel refresh interval');
            }

            this.refreshIntervalPromise = undefined;
        }
    }

    getCurrentRefreshIntervalText(): string {
        if (!this.selectedRefreshInterval || this.selectedRefreshInterval.id === 0) {
            return 'Auto refresh disabled';
        }
        return `Auto refresh: ${this.selectedRefreshInterval.text}`;
    }

    // Driver Location Auto-Refresh Methods
    initDriverLocationRefreshIntervalOptions(): void {
        const disabledOption: ISuggestion = {id: 0, text: "Disabled"};

        this.driverLocationRefreshIntervalOptions = [
            disabledOption,
            ...getMinsSelectionOptions()
        ];
        this.selectedDriverLocationRefreshInterval = this.driverLocationRefreshIntervalOptions[0];
    }

    private loadSavedDriverLocationRefreshInterval(): void {
        if (Modernizr.localstorage) {
            try {
                const savedIntervalString = localStorage.getItem(this.DriverLocationRefreshIntervalKey);
                if (savedIntervalString) {
                    const refreshId = parseInt(savedIntervalString, 10) || 0;
                    this.selectedDriverLocationRefreshInterval = this.driverLocationRefreshIntervalOptions?.find(x => x.id == refreshId);

                    if (this.selectedDriverLocationRefreshInterval && this.selectedDriverLocationRefreshInterval.id > 0) {
                        this.startDriverLocationAutoRefresh();
                    }
                }
            } catch (error) {
                console.error('Error loading saved driver location refresh interval:', error);
            }
        }
    }

    onDriverLocationRefreshIntervalChange(selectedInterval: ISuggestion): void {
        console.debug('Driver location refresh interval changed to:', selectedInterval, 'seconds');

        this.selectedDriverLocationRefreshInterval = selectedInterval;

        if (Modernizr.localstorage && this.selectedDriverLocationRefreshInterval) {
            localStorage.setItem(this.DriverLocationRefreshIntervalKey, this.selectedDriverLocationRefreshInterval?.id.toString());
        }

        this.stopDriverLocationAutoRefresh();

        if (this.selectedDriverLocationRefreshInterval && this.selectedDriverLocationRefreshInterval.id > 0) {
            this.startDriverLocationAutoRefresh();
        }

        this.applyScope();
    }

    private startDriverLocationAutoRefresh(): void {
        if (!this.selectedDriverLocationRefreshInterval || this.selectedDriverLocationRefreshInterval.id <= 0) {
            return;
        }

        // Always stop any existing refresh first
        this.stopDriverLocationAutoRefresh();

        console.debug(`Starting driver location auto refresh every ${this.selectedDriverLocationRefreshInterval.id} seconds (${this.selectedDriverLocationRefreshInterval.text})`);

        this.isDriverLocationAutoRefreshEnabled = true;

        this.driverLocationRefreshIntervalPromise = this.registerInterval(async () => {
            if (this.isDriverLocationAutoRefreshEnabled) {
                console.debug('Auto refreshing driver locations and map...');
                try {
                    // fetchDriverLocations() will automatically trigger map refresh
                    await this.fetchDriverLocations();
                    console.debug('Driver location auto refresh completed successfully');
                } catch (error) {
                    console.error('Error during driver location auto refresh:', error);
                }
            }
        }, this.selectedDriverLocationRefreshInterval.id * 1000);

        this.applyScope();
    }

    private stopDriverLocationAutoRefresh(): void {
        console.debug('Stopping driver location auto refresh');
        this.isDriverLocationAutoRefreshEnabled = false;

        if (this.driverLocationRefreshIntervalPromise) {
            const cancelled = this.cancelInterval(this.driverLocationRefreshIntervalPromise);
            if (cancelled) {
                console.debug('Successfully cancelled driver location refresh interval');
            } else {
                console.warn('Failed to cancel driver location refresh interval');
            }

            this.driverLocationRefreshIntervalPromise = undefined;
        }
    }

    async onCourierSearchSelect(selectedCourier: ISuggestion): Promise<void> {
        try {
            await this.getCurrentJobs(selectedCourier.id);
            this.courierSearchText = undefined;
        } catch (error) {
            console.error("Error in onCourierSearchClick:", error);
        } finally {
            this.applyScope();
        }
    }

    async refreshDataTimeSpan(dateFilterData: IDateFilterData): Promise<void> {
        console.debug('refreshDataTimeSpan called with data ', dateFilterData);
        this.dateFilterData = dateFilterData;

        this.saveDateFilterToStorage();
        const tasks: Promise<void>[] = [
            this.getData(),
            this.fetchDriverLocations(),
        ];

        // When using page dates for current work, re-fetch with updated date range
        if (!this.currentWorkTodayOnly && this.currentCourier) {
            tasks.push(this.getCurrentJobs(this.currentCourier.id));
        }

        await Promise.all(tasks);
    }

    private saveDateFilterToStorage(): void {
        if (Modernizr.localstorage && this.dateFilterData) {
            try {
                localStorage.setItem(this.DateFilterKey, JSON.stringify(this.dateFilterData));
            } catch (error) {
                console.error('Error saving date filter to storage:', error);
            }
        }
    }

    private loadDateFilterFromStorage(): void {
        if (Modernizr.localstorage) {
            try {
                const savedDateFilter = localStorage.getItem(this.DateFilterKey);
                if (savedDateFilter) {
                    const parsedDateFilter = JSON.parse(savedDateFilter);
                    const startDate = dayjs(parsedDateFilter.startDate);
                    let endDate = dayjs(parsedDateFilter.endDate);

                    // If "all time" is selected (startDate is epoch), always recalculate
                    // endDate to be 24 hours from now to include future jobs
                    if (startDate.valueOf() === 0) {
                        endDate = dayjs().add(24, 'hours');
                    }

                    this.dateFilterData = {
                        startDate,
                        endDate,
                        useTime: parsedDateFilter.useTime ?? false
                    };
                }
            } catch (error) {
                console.error('Error loading date filter from storage:', error);
                this.dateFilterData = setDateFilterDefaults();
            }
        }
    }

    async selectAndActivateArea(selectedArea: IAreaClearList): Promise<void> {
        if (!selectedArea || !this.driverLocations) return;

        // Update map
        this.clearListId = selectedArea.id;

        // First, set the active state
        this.driverLocations.areas.forEach((area: IAreaClearList) => {
            area.isActive = area === selectedArea;
        });

        // Set status filter to 'needs-dispatch' when ClearListArea is clicked
        this.queryParams.statusFilter = 'needs-dispatch';

        // Force the category to update by setting to undefined first, then to needs-dispatch
        // This ensures $onChanges fires even if it was already needs-dispatch
        this.defaultJobCategory = undefined;
        if (this.$timeoutService) {
            this.$timeoutService(() => {
                this.defaultJobCategory = 'needs-dispatch';
            }, 0);
        }

        // Then process jobs if needed
        try {
            await this.processClearListJobs(selectedArea.id);
        } catch (error) {
            console.error("Clear list processing error:", error);
            this.jobList = [];
        }

        this.applyScope();
    }

    async clearDriverLocationFilter(): Promise<void> {
        if (!this.driverLocations) return;

        // Deactivate all areas
        this.driverLocations.areas.forEach((area: IAreaClearList) => {
            area.isActive = false;
        });

        // Clear the selected clear list and status filter
        this.selectedClearListId = undefined;
        this.clearListId = undefined;
        this.queryParams.statusFilter = undefined;
        this.defaultJobCategory = undefined; // Reset job list UI category

        // Reset to show all jobs (not filtered by clear list)
        try {
            await this.getJobList();

            if (this.currentCourier) {
                await this.getCurrentJobs(this.currentCourier.id);
            } else if (!this.currentJob) {
                this.mapJobList = this.mapJobListFull;
            }
        } catch (error) {
            console.error("Error clearing driver location filter:", error);
            this.toastrService.showErrorToast("Error clearing filter. Please try again.");
        }

        this.applyScope();
    }

    async updateJobSearchText(searchText: string): Promise<void> {
        this.queryParams.searchText = searchText || '';
        await this.getJobList();
    }

    async openSettingsDialog($event: MouseEvent): Promise<void> {
        if (!this.boxes) return;

        try {
            const result = await this.dashboardSettingsDialog.openSettingsDialog(
                $event,
                AppPage.Dispatch,
                this.currentLayoutName ?? 'Default',
                this.boxes,
                this.selectedRefreshInterval,
                this.selectedDriverLocationRefreshInterval
            );

            if (!result) return;

            // Handle refresh interval changes
            if (result.selectedRefreshInterval && result.selectedRefreshInterval.id !== this.selectedRefreshInterval?.id) {
                this.onRefreshIntervalChange(result.selectedRefreshInterval);
            }

            // Handle driver location refresh interval changes
            if (result.selectedDriverLocationRefreshInterval &&
                result.selectedDriverLocationRefreshInterval.id !== this.selectedDriverLocationRefreshInterval?.id) {
                this.onDriverLocationRefreshIntervalChange(result.selectedDriverLocationRefreshInterval);
            }

            // Panel visibility now lives in the Customize Panels dialog
            // (openCustomizePanelsDialog); the gear no longer returns boxes.
            if (result.aiEnabled !== undefined) {
                setAiEnabled(result.aiEnabled);
            }

            // Beta opt-in changed: persist and (if turned on) flip to the new
            // route immediately. Operators staying on V1 stay put.
            if (result.dispatchBetaEnabled !== undefined
                && result.dispatchBetaEnabled !== getDispatchBetaEnabled()) {
                setDispatchBetaEnabled(result.dispatchBetaEnabled);
                if (result.dispatchBetaEnabled) {
                    this.$state.go('dispatchV2').catch((err: unknown) => {
                        console.error('[Dispatch] Failed to switch to beta route:', err);
                    });
                    return;
                }
            }

            this.saveCurrentLayout();
            this.applyScope();
            this.toastrService.showSuccessToast('Settings saved and applied successfully');
        } catch (error) {
            if (!error) return;
            console.error('Error opening settings dialog:', error);
            this.toastrService.showErrorToast('Failed to open settings dialog');
        }
    }

    async openCustomizePanelsDialog(): Promise<void> {
        if (!this.boxes) return;

        try {
            const result = await this.dashboardSettingsDialog.openCustomizePanelsDialog(
                this.currentLayoutName ?? 'Default',
                this.boxes,
            );

            if (!result) return;

            this.boxes = result;
            this.saveBoxVisibility();
            this.saveCurrentLayout();
            this.applyScope();
        } catch (error) {
            if (!error) return;
            console.error('Error opening customize panels dialog:', error);
            this.toastrService.showErrorToast('Failed to open customize panels dialog');
        }
    }

    async onExactCourierMatchSearch(exactCourierMatchSearchText: string): Promise<void> {
        if (!exactCourierMatchSearchText) return;

        const courierMatch = await this.DispatchData.getExactCourierMatch(exactCourierMatchSearchText);
        if (!courierMatch) {
            this.toastrService.showWarningToast(`No courier found with code: ${exactCourierMatchSearchText}. Please try again.`);
            return;
        }

        this.currentCourier = courierMatch;
        this.currentWorkSelection = ` for Courier ${courierMatch.text}`;

        await this.getCurrentJobs(courierMatch.id);

        try {
            this.truckCourierStatus = await this.DispatchData.truckCourierStatus(courierMatch.id);
        } catch (error) {
            console.warn("Error fetching truck courier status:", error);
        }

        // Clear the search text after a successful search
        this.exactCourierMatchSearchText = '';
        this.applyScope();
    }

    private async loadDriversWithJobCounts(): Promise<void> {
        try {
            this.driversWithJobCounts = await this.DispatchData.getDriverWorkOverview();
            this.applyScope();
        } catch (error) {
            console.error('Error loading drivers with job counts:', error);
            this.driversWithJobCounts = [];
        }
    }

    async selectDriverFromOverview(driver: IDriverWorkOverview): Promise<void> {
        this.currentWorkViewMode = CurrentWorkLists.SelectedDriver;

        const selectedCourier: ISuggestion = {
            id: driver.courierId,
            text: driver.name
        };

        await this.onCourierSearchSelect(selectedCourier);
        this.applyScope();
    }

    async switchCurrentWorkViewMode(): Promise<void> {
        if (this.currentWorkViewMode === CurrentWorkLists.Overview) {
            this.currentWorkSelection = '';

            // Unmount React current work panel when switching to overview
            if (window.ReactCurrentWorkJobList && this.reactCurrentWorkMounted) {
                window.ReactCurrentWorkJobList.unmount();
                this.reactCurrentWorkMounted = false;
            }

            // Refresh driver job counts when switching to All Drivers view
            await this.loadDriversWithJobCounts();
        } else if (this.jobsCurrentList) {
            // Switching to selected driver mode with data — mount and push
            this.updateReactCurrentWorkJobList();
        }
    }

    // ── React Job List Integration ───────────────────────────────────

    private reactJobListMounted = false;

    /**
     * Mounts the React job list once the container element exists in the DOM.
     * The container lives inside an ng-include template that loads async,
     * so we poll until it appears (up to ~5 seconds).
     */
    private mountReactJobList(): void {
        if (this.reactJobListMounted) return;

        if (!window.ReactJobList) {
            console.warn('[HomeController] ReactJobList not loaded');
            return;
        }

        let attempts = 0;
        const maxAttempts = 100; // 100 × 50ms = 5s

        const tryMount = () => {
            const container = document.getElementById('react-dispatch-job-list');
            if (!container) {
                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(tryMount, 50);
                } else {
                    console.error('[HomeController] react-dispatch-job-list not found after 5s');
                }
                return;
            }

            this.doMountReactJobList();
        };

        tryMount();
    }

    private doMountReactJobList(): void {
        if (this.reactJobListMounted || !window.ReactJobList) return;

        const showToast = (message: string, type: 'success' | 'warning' | 'error' | 'info') => {
            switch (type) {
                case 'success':
                    this.toastrService.showSuccessToast(message);
                    break;
                case 'warning':
                    this.toastrService.showWarningToast(message);
                    break;
                case 'error':
                    this.toastrService.showErrorToast(message);
                    break;
                case 'info':
                    this.toastrService.showInfoToast(message);
                    break;
            }
        };

        // Parse existing sort order
        let orderBy = this.queryParams.order || 'time';
        let orderDirection = 'asc';
        if (orderBy.startsWith('-')) {
            orderBy = orderBy.substring(1);
            orderDirection = 'desc';
        }

        window.ReactJobList.mount('react-dispatch-job-list', {
            showToast,
            isUsCustomer: this.isUsCustomer,
            appPage: AppPage.Dispatch,
            defaultCategory: this.defaultJobCategory as any,
            fetchConfig: {
                fetchFn: (params, options) => params.selectedClearListId
                    ? fetchClearListJobs(params, options)
                    : fetchDispatchJobs(params, options),
                queryKeyFn: (params) => params.selectedClearListId
                    ? queryKeys.dispatch.clearList(params)
                    : queryKeys.dispatch.jobs(params),
                initialParams: {
                    order: orderBy,
                    orderDirection: orderDirection,
                    startDate: this.dateFilterData.startDate,
                    endDate: this.dateFilterData.endDate,
                    useTime: this.dateFilterData.useTime,
                    page: this.currentJobListPage,
                    pageSize: this.currentJobListPageSize,
                    searchText: this.queryParams.searchText,
                    statusFilter: this.queryParams.statusFilter,
                    isInternal: ClientInternal ?? false,
                    despatchViewIds: this.selectedViews.map(v => v.id),
                },
            },
            onJobSelect: async (job: DispatchJob) => {
                // Bridge back to AngularJS job selection
                await this.selectJob(job as IDispatchJob);
                this.applyScope();
            },
            onJobDispatch: async (job: DispatchJob, courierId: number) => {
                await this.handleJobDispatch(job as IDispatchJob, courierId);
                this.applyScope();
            },
            onRefresh: async () => {
                // React handles data refresh; also refresh AngularJS-owned data (map, supports)
                this.loadSupportsInBackground();
                if (this.isUsCustomer) await this.loadDriversWithJobCounts();
            },
            onSearchChange: async (searchText: string) => {
                await this.updateJobSearchText(searchText);
            },
            onCategoryChange: async (category: string) => {
                await this.handleCategoryChange(category);
            },
            onAddStop: async (job: DispatchJob) => {
                await this.jobAddStopService.addNewStop(job as IDispatchJob);
            },
            onJobsLoaded: (jobs: DispatchJob[]) => {
                // Populate map with all undispatched jobs when no job is selected
                if (!this.currentJob) {
                    this.mapJobList = (jobs as IDispatchJob[])
                        .filter(j => j.statusId === 0)
                        .map(j => this.mapToDispatchMapItem(j));
                    this.mapJobListFull = [...this.mapJobList];
                    this.applyScope();
                }
            },
        });

        this.reactJobListMounted = true;

        // Sync initial selection if a job was already selected
        if (this.currentJobId) {
            window.ReactJobList!.selectJob(this.currentJobId);
        }

        console.log('[HomeController] React job list mounted');
    }

    // updateReactJobList removed — React manages its own data via fetchConfig

    // ── React Current Work Job List Integration ─────────────────────

    private reactCurrentWorkMounted = false;
    private currentWorkTodayOnly = true;

    /**
     * Mounts the React current work job list once the container element exists in the DOM.
     * The container lives inside ng-if="ctrl.jobsCurrentList", so we poll until it appears.
     */
    private mountReactCurrentWorkJobList(): void {
        if (this.reactCurrentWorkMounted) return;

        if (!window.ReactCurrentWorkJobList) {
            console.warn('[HomeController] ReactCurrentWorkJobList not loaded');
            return;
        }

        let attempts = 0;
        const maxAttempts = 100; // 100 × 50ms = 5s

        const tryMount = () => {
            const container = document.getElementById('react-current-work-job-list');
            if (!container) {
                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(tryMount, 50);
                } else {
                    console.error('[HomeController] react-current-work-job-list not found after 5s');
                }
                return;
            }

            this.doMountReactCurrentWorkJobList();
        };

        tryMount();
    }

    private doMountReactCurrentWorkJobList(): void {
        if (this.reactCurrentWorkMounted || !window.ReactCurrentWorkJobList) return;

        const showToast = (message: string, type: 'success' | 'warning' | 'error' | 'info') => {
            switch (type) {
                case 'success':
                    this.toastrService.showSuccessToast(message);
                    break;
                case 'warning':
                    this.toastrService.showWarningToast(message);
                    break;
                case 'error':
                    this.toastrService.showErrorToast(message);
                    break;
                case 'info':
                    this.toastrService.showInfoToast(message);
                    break;
            }
        };

        window.ReactCurrentWorkJobList.mount('react-current-work-job-list', {
            showToast,
            isUsCustomer: this.isUsCustomer,
            appPage: AppPage.Dispatch,
            defaultCategory: 'in-progress',
            storagePrefix: 'currentWorkJobList',
            onJobSelect: async (job: DispatchJob) => {
                await this.selectJob(job as any);
                this.applyScope();
            },
            onJobDispatch: async (job: DispatchJob, courierId: number) => {
                await this.handleJobDispatch(job as any, courierId);
                this.applyScope();
            },
            onRefresh: async () => {
                if (this.currentCourier) {
                    await this.getCurrentJobs(this.currentCourier.id);
                }
            },
            onAddStop: async (job: DispatchJob) => {
                await this.jobAddStopService.addNewStop(job as any);
            },
            onDateFilterModeChange: async (todayOnly: boolean) => {
                this.currentWorkTodayOnly = todayOnly;
                if (this.currentCourier) {
                    await this.getCurrentJobs(this.currentCourier.id);
                }
            },
        });

        this.reactCurrentWorkMounted = true;
        console.log('[HomeController] React current work job list mounted');
    }

    /**
     * Pushes current work job data to the React panel.
     * If not yet mounted (ng-if timing), triggers mount first.
     */
    private updateReactCurrentWorkJobList(): void {
        if (!this.jobsCurrentList) return;

        if (!this.reactCurrentWorkMounted) {
            // Container just appeared via ng-if — mount first, then push data
            this.mountReactCurrentWorkJobList();

            // Wait for mount to complete before pushing data
            let attempts = 0;
            const pushData = () => {
                if (this.reactCurrentWorkMounted && window.ReactCurrentWorkJobList) {
                    window.ReactCurrentWorkJobList.updateJobs(
                        this.jobsCurrentList as any,
                        this.jobsCurrentList!.length
                    );
                } else if (attempts < 100) {
                    attempts++;
                    setTimeout(pushData, 50);
                }
            };
            setTimeout(pushData, 100);
        } else if (window.ReactCurrentWorkJobList) {
            window.ReactCurrentWorkJobList.updateJobs(
                this.jobsCurrentList as any,
                this.jobsCurrentList.length
            );
        }
    }
}

const HomeComponent: angular.IComponentOptions = {
    template: require("./home.template.html"),
    controller: HomeController,
    controllerAs: "ctrl",
    bindings: {
        jobId: '<'
    },
}
export default HomeComponent;
