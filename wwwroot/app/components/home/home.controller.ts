import "./home.styles.less";
import ToastrService from "../../services/toastr.service";
import DispatchCoreService from "../../services/dispatch-core.service";
import DispatchExecutorService from "../../services/dispatch-executor.service";
import {IAppConfig} from "../../interfaces/app-config.interface";
import {
    IAddressViewModel,
    IAreaClearList,
    IClearListViewModel,
    ICourierData,
    IDispatchJob,
    IDispatchMapItem,
    IJob,
    IJobQueryParams,
    IJobSearchResult,
    ISuggestion,
} from "../../interfaces/job.interface";
import {IDriverWorkOverview, IPotentialCouriers, ITruckCourierStatus} from "../../interfaces/courier.interface";
import {IBox, IColumn, ILayout} from "../../interfaces/layout.interfaces";
import {DfrntPageViewModel} from "../../interfaces/dfrnt-page-view-model.interface";
import BaseController from "../base-controller";
import {ExtendedTask, ITask} from "../task-dashboard/task-dashboard.interfaces";
import AdditionalServicesDialogService from "../dialogs/additional-services-dialog/additional-services-dialog.service";
import {EditAddressDialogService} from "../dialogs/edit-address-dialog/edit-address-dialog.service";
import {AppPage} from "../../enums/app-pages.enum";
import JobFileUploadDialogService from "../dialogs/job-file-upload-dialog/job-file-upload-dialog.service";
import AddEventDialogService from "../dialogs/add-event-dialog/add-event-dialog.service";
import InterCourierChargeDialogService
    from "../dialogs/inter-courier-charge-dialog/inter-courier-charge-dialog.service";
import {Coordinates} from "../overview/overview.interfaces";
import JobContextMenuService from "../../services/job-context-menu.service";
import {ContactID, FirstName} from "../../contants";
import {IJobReadChanged} from "../../interfaces/event-interfaces";
import {JobProperty} from "../../enums/job-property.enum";
import NavigationService from "../../services/navigation.service";
import greetUser from "../../functions/greetUser";
import dayjs from "dayjs";
import TruckCourierStatusDialogService
    from "../dialogs/truck-courier-status-dialog/truck-courier-status-dialog.service";
import JobAddStopService from "../../services/job-add-stop.service";
import getJobTableRowClass from "../../functions/getJobTableRowClass";
import MessagingDialogService from "../dialogs/messaging-dialog/messaging-dialog.service";
import timezone from 'dayjs/plugin/timezone';
import MessagingService from "../../services/messaging.service";
import {StatusFilter} from "../task-dashboard/enums/status-filter";
import TasksService from "../../services/tasks.service";
import JobListType from "../common/job-list/enums/jobListType";
import IContextMenuOption from "../../interfaces/context-menu-option.interface";
import CreateJobDialogService from "../dialogs/create-job-dialog/create-job-dialog.service";
import IDateFilterData from "../common/date-filter-menu/IDateFilterData";
import setDateFilterDefaults from "../../functions/setDateFilterDefaults";
import utc from "dayjs/plugin/utc";
import {getMinsSelectionOptions} from "../../functions/MinsSelectionOptions";
import DispatchBoxes from "./enums/DispatchBoxes";
import DashboardSettingsDialogService from "../dialogs/dashboard-settings-dialog/dashboard-settings-dialog.service";
import ITaskItemConfig from "../../enums/task-item-config";
import CurrentWorkLists from "./enums/CurrentWorkLists";

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
        'additionalServicesDialogService',
        'editAddressDialogService',
        'jobFileUploadDialogService',
        'addEventDialogService',
        'interCourierChargeDialogService',
        'jobContextMenuService',
        'navigationService',
        'truckCourierStatusDialogService',
        'jobAddStopService',
        'messagingDialogService',
        'messagingService',
        'tasksService',
        'createJobDialogService',
        'dashboardSettingsDialogService',
        '$scope',
        '$timeout',
        '$interval',
    ];

    private readonly MapZoomKey: string = `mapZoom-${AppPage.Dispatch}-${ContactID}`;
    private readonly SelectedViewsKey: string = `selectedViews-${AppPage.Dispatch}-${ContactID}`;
    private readonly DispatchFiltersKey: string = `disp-filters-${AppPage.Dispatch}-${ContactID}`;
    private readonly RefreshDurationIntervalKey: string = `refreshInterval-${AppPage.Dispatch}-${ContactID}`;
    private readonly DriverLocationRefreshIntervalKey: string = `driverLocationRefreshInterval-${AppPage.Dispatch}-${ContactID}`;
    private readonly DateFilterKey: string = `dateFilter-${AppPage.Dispatch}-${ContactID}`;
    private readonly LayoutKey: string = `layout-${ContactID}`;
    private readonly LastActiveLayoutKey: string = `lastActiveLayout-${ContactID}`;

    readonly currentWorkListName: JobListType = JobListType.CurrentWorkList;
    readonly dispatchListName: JobListType = JobListType.DispatchJobList;

    private readonly currentAppPage: AppPage = AppPage.Dispatch;
    private readonly COURIER_URL: string = "/courier/AllActiveSearch";

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
    greeting: string;
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
    currentJobListTotalCount: number = 0;

    currentWorkViewMode: CurrentWorkLists = CurrentWorkLists.Overview;
    driversWithJobCounts?: IDriverWorkOverview[];

    private _selectedViews: DfrntPageViewModel[] = [];
    initialViewSet: boolean = false;

    get selectedViews(): DfrntPageViewModel[] {
        return this._selectedViews;
    }

    set selectedViews(newViews: DfrntPageViewModel[]) {
        this._selectedViews = newViews;
        if (newViews) {
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
        private additionalServicesDialog: AdditionalServicesDialogService,
        private editAddressDialog: EditAddressDialogService,
        private jobFileUploadDialog: JobFileUploadDialogService,
        private addEventDialog: AddEventDialogService,
        private interCourierChargeDialog: InterCourierChargeDialogService,
        private jobContextMenuService: JobContextMenuService,
        private navigationService: NavigationService,
        private truckCourierStatusDialog: TruckCourierStatusDialogService,
        private jobAddStopService: JobAddStopService,
        private messagingDialog: MessagingDialogService,
        private messagingService: MessagingService,
        private tasksService: TasksService,
        private createJobDialog: CreateJobDialogService,
        private dashboardSettingsDialog: DashboardSettingsDialogService,
        $scope: angular.IScope,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
    ) {
        super();
        this.initServices($timeout, $interval, $scope);

        this.greeting = greetUser(FirstName);
        this.isUsCustomer = this.APP_CONFIG.US_Customer;

        this.initializeBoxes();
        this.initializeLayout();

        // Date filter
        this.dateFilterData = setDateFilterDefaults();
        this.loadDateFilterFromStorage();

        // Views and Layout
        this.initialViewSet = false;

        this.watchEvent('jobChanged', async (_, newJob: IJob) => {
            if (this.currentJobId === newJob.id) {
                console.log(`Job ${newJob.jobNo} is already the current job, skipping reload`);
                return;
            }

            console.log(`Handling job changed event for job ${newJob.jobNo}`);

            const job = await this.DispatchData.getDispatchJobDetail(newJob.id);
            await this.selectJob(job)
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
        this.registerInterval(async () => {
            await this.getUnreadMessageCount();
        }, 60000);

        this.loadPageViews().then(async () => {
            console.log("Loaded Page Views and Data!");

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
                    const refreshId = parseInt(savedIntervalString, 10) ?? 0;
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
                const storedLayouts: ILayout[] = JSON.parse(localStorage.getItem(this.LayoutKey) ?? '');
                const lastActiveLayout = localStorage.getItem(this.LastActiveLayoutKey);

                this.layouts = storedLayouts || [this.defaultLayout];
                this.layouts[0] = this.defaultLayout; // Ensure default is always up to date

                // Load last active layout or default
                const layoutToLoad = lastActiveLayout ? this.layouts.findIndex((l: ILayout) => l.name === lastActiveLayout) : 0;
                this.loadLayout(layoutToLoad >= 0 ? layoutToLoad : 0);
            } catch (error: any) {
                this.layouts = [this.defaultLayout];
                this.loadLayout(0);
            }
        } else {
            this.layouts = [this.defaultLayout];
            this.loadLayout(0);
        }

        // Initialize boxSortableOptions for an old system
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

            start: (e: JQueryEventObject, ui: any) => {
                ui.item.addClass('dragging');

                const dragInfo = angular.element('#draggingItems');
                dragInfo.html(`Moving: ${ui.item.find('.md-headline-title').text().trim()}`);
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

            over: (e: JQueryEventObject, _: any) => {
                angular.element(e.target).addClass('ui-sortable-active');
            },

            out: (e: JQueryEventObject, _: any) => {
                angular.element(e.target).removeClass('ui-sortable-active');
            },

            stop: (_: JQueryEventObject, ui: any) => {
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

        if (Modernizr.localstorage) {
            localStorage.setItem(this.LastActiveLayoutKey, layout.name);
        }

        this.applyScope();
    }

    saveLayout(): void {
        this.$mdDialog
            .show(this.$mdDialog
                .prompt()
                .title("Save Layout")
                .textContent("Please enter a name for this layout.")
                .required(true)
                .ok("Save")
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
                templateUrl: "app/components/home/partials/driverLocations.html",
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
            } catch (error: any) {
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
        } catch (error: any) {
            console.error("Error fetching dispatch views:", error);
            this.views = [];
            await this.initializeViews();
            await this.fetchDriverLocations();
        }
    }

    async initializeViews(): Promise<void> {
        if (this.views && this.views.length > 0) {
            this.selectedViews = this.loadViewsFromStorage();

            // Set a selected property on each view
            this.views = this.views.map((view) => ({
                ...view, selected: this.selectedViews.some((v: DfrntPageViewModel) => v.id === view.id),
            }));

            // If no views are selected, select the first one by default
            if (this.selectedViews.length === 0) {
                this.views[0].selected = true;
                this.selectedViews.push(this.views[0]);
                this.saveViewsToStorage(this.selectedViews);
            }

            // Set the flag to indicate views are initialized
            this.viewsInitialized = true;
        }
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
            // For multiple views, center on continental US
            this.mapCenter = this.APP_CONFIG.US_Coordinates_Center;
            this.mapZoom = 4; // Zoom level to show most of the continental US
        }

        this.initialViewSet = true;
    }

    setActiveArea(selectedArea: IAreaClearList): void {
        if (!this.driverLocations) return;

        // Set isActive for the selected area and clear others
        this.driverLocations.areas.forEach((area: IAreaClearList) => {
            area.isActive = area === selectedArea;
        });

        // Apply scope to trigger Angular Material's ng-class updates
        this.applyScope();
    }

    async unlockJob(currentJob: IDispatchJob): Promise<void> {
        await this.DispatchData.updateJobDetail(currentJob.id, JobProperty.Locked, false, currentJob.preBook ?? false)
    }

    async lockJob(currentJob: IDispatchJob): Promise<void> {
        await this.DispatchData.updateJobDetail(currentJob.id, JobProperty.Locked, true, currentJob.preBook ?? false)
    }

    async selectClearList(selectedClearList: IAreaClearList): Promise<void> {
        try {
            if (!selectedClearList) {
                this.toastrService.showErrorToast("An error occurred while selecting a clear list. Please try again.");
                return;
            }

            // Set the status filter to 'needs-dispatch' when ClearListArea is clicked
            this.queryParams.statusFilter = 'needs-dispatch';

            await this.processClearListJobs(selectedClearList.id);
        } catch (error) {
            console.error("Clear list processing error:", error);
            this.jobList = [];
        }
    }

    private async processClearListJobs(selectedClearListId: number): Promise<void> {
        try {
            this.selectedClearListId = selectedClearListId; // Save for later use

            const result = await this.dispatchJobService.getJobsWithDispatchInfo(
                {
                    ...this.queryParams,
                    startDate: this.dateFilterData.startDate,
                    endDate: this.dateFilterData.endDate,
                    useTime: this.dateFilterData.useTime,
                    page: this.currentJobListPage,
                    pageSize: this.currentJobListPageSize,
                    statusFilter: this.queryParams.statusFilter
                },
                ClientInternal ?? false,
                this.selectedViews,
                selectedClearListId,
            );

            if (result.jobs?.length > 0) {
                this.jobList = this.initializeJobSearchFields(result.jobs);

                if (!this.currentCourier) {
                    // Only show undispatched jobs on the map for performance
                    this.mapJobList = this.getUndispatchedMapItems(result.jobs);
                    this.mapJobListFull = angular.copy(this.mapJobList);
                }
            } else {
                this.jobList = [];

                if (!this.currentCourier) {
                    this.mapJobList = [];
                }
            }

            // Only clear jobsCurrentList if we're not viewing a specific courier's jobs
            if (!this.currentCourier) {
                this.jobsCurrentList = undefined;
            }
            this.totalJobCount = result.totalCount;

        } catch (error) {
            console.error("Error fetching jobs for clear list:", error);
            this.jobList = [];
        }
    }

    async handleDispatchSelection(selectedCourier: ISuggestion, model: ISuggestion, label: string, $event: MouseEvent, job: IDispatchJob): Promise<void> {
        console.log("DISPATCH CALLED FROM:", new Error().stack);
        console.log("Typeahead params:", {selectedCourier, model, label});

        // Prevent duplicate dispatch attempts
        if ($event === undefined) return;

        if (!selectedCourier || !selectedCourier.id) return;

        try {
            await this.dispatchJob(selectedCourier.id, job.id);

            // Clear the search text after successful dispatch
            job.searchText = '';

            // Update the job's assigned courier display
            job.assignedCourier = selectedCourier;

        } catch (error: any) {
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
        } catch (error: any) {
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

    async otherEventForm($event: MouseEvent, job: IDispatchJob): Promise<void> {
        await this.addEventDialog.openAddEventDialog($event, job);
    }

    jobClass(job: IDispatchJob): string {
        return getJobTableRowClass(job, this.currentJob);
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
            await this.refreshJobDetail();
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

    async splitJob($event: MouseEvent, job: IDispatchJob): Promise<void> {
        if (!job.allowSplit) {
            await this.showAlert("Unable to split job", `Can not split ${job.jobNo}.`);
            return;
        }

        try {
            const result = await this.showConfirm($event, "Split Job?", "Are you sure you wish to split this job?");
            if (result) {
                await this.DispatchData.splitJob(job.id);
                await this.setSplitJobMeetingPoint($event, job);
            }
        } catch (error: any) {
            if (error instanceof Error) {
                console.log(error.message);
            }
            console.log("Splitting job failed:", error);
        }
    }

    showAlert(title: string, content: string): angular.IPromise<any> {
        return this.$mdDialog.show(this.$mdDialog
            .alert()
            .parent(this.$document.parent())
            .clickOutsideToClose(true)
            .title(title)
            .textContent(content)
            .ariaLabel("Alert")
            .ok("OK"));
    }

    showConfirm($event: MouseEvent, title: string, content: string): angular.IPromise<any> {
        const confirm = this.$mdDialog
            .confirm()
            .title(title)
            .textContent(content)
            .ariaLabel("Confirm")
            .targetEvent($event)
            .ok("Yes")
            .cancel("No");

        return this.$mdDialog.show(confirm);
    }

    async getPotentialCouriers(jobId: number): Promise<void> {
        try {
            this.potentialCouriers = await this.DispatchData.getPotentialCouriers(jobId);
        } catch (error: any) {
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
        } catch (error: any) {
            console.error("Error fetching truck courier status:", error);
        }
    }

    async getCourierOptions(searchTerm: string): Promise<ISuggestion[]> {
        return await this.DispatchData.autocompleteSearch(searchTerm, this.COURIER_URL);
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
        } catch (error: any) {
            console.error("Error searching courier:", error);
        }
    }

    async selectCourier(courier: ICourierData): Promise<void> {
        try {
            this.currentListLoading = true;
            this.applyScope();

            if (!courier || !courier.courierId) return;
            const foundCourier = await this.DispatchData.getCourierById(courier.courierId);
            if (foundCourier) {
                this.currentCourier = {
                    id: foundCourier.courierId,
                    text: foundCourier.label || `${foundCourier.label} ${foundCourier.name}`,
                };

                // Use courier code (id field) if available, otherwise use text/label
                const courierDisplay = (foundCourier.id && foundCourier.id !== 'undefined' && foundCourier.id.trim() !== '')
                    ? `${foundCourier.id}: ${foundCourier.name}`
                    : (foundCourier.text || foundCourier.label);
                this.currentWorkSelection = ` for Courier ${courierDisplay}`;
                await this.getCurrentJobs(foundCourier.courierId);

                try {
                    this.truckCourierStatus = await this.DispatchData.truckCourierStatus(foundCourier.courierId);
                } catch (error: any) {
                    console.warn("Error fetching truck courier status:", error);
                }
            } else {
                console.warn("Courier not found in active or all couriers list");
                this.toastrService.showErrorToast("An unexpected error occurred. Please contact support.");
            }
        } catch (error: any) {
            console.error("Error selecting courier:", error);
            this.toastrService.showErrorToast("Error loading courier information");
        } finally {
            this.currentListLoading = false;
            this.applyScope();
        }
    }

    updateCourierInfo(courier: ICourierData): void {
        if (!courier.courier) {
            courier.courier = `${courier.courier} ${courier.courierName}`;
        }
    }

    async displayJobsForCourier(courier: ICourierData): Promise<void> {
        if (!courier.courierId) return;

        const foundCourier = await this.DispatchData.getCourierById(courier.courierId);
        const code = foundCourier?.id ?? '';
        if (!courier.courierId) {
            throw new Error('Courier ID is required');
        }
        const data = await this.DispatchData.getJobsCurrent(courier.courierId,
            this.queryParams.startDate,
            this.queryParams.endDate);

        if (this.currentJob !== null && this.currentJob?.courier !== code) {
            this.currentJob = undefined;
        }

        this.jobsCurrentList = data.jobs;
        this.currentJobListTotalCount = data.totalCount;
    }

    async getCurrentJobs(courierId: number): Promise<void> {
        if (!courierId) {
            console.warn("No courier ID provided");
            return;
        }

        try {
            this.currentListLoading = true;
            this.applyScope();

            const result = await this.DispatchData.getJobsCurrent(
                courierId,
                this.queryParams.startDate,
                this.queryParams.endDate
            );
            this.jobsCurrentList = result.jobs;

            if (this.jobsCurrentList && this.jobsCurrentList.length > 0) {
                console.log(`Setting mapJobList for courier ${courierId} with ${this.jobsCurrentList.length} jobs`);
                this.mapJobList = this.getUndispatchedMapItems(result.jobs);
            } else {
                console.log(`No jobs found for courier ${courierId}`);
            }
        } catch (error: any) {
            console.error("Error getting current jobs:", error);
            this.jobsCurrentList = [];
        } finally {
            this.currentListLoading = false;
            this.applyScope();
        }
    }

    async selectSupportJobDetail(task: ITask): Promise<void> {
        console.log(' Starting with task:', {
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
            console.log(' Fetching job details for jobId:', task.jobId);

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
            console.log(' Job selected successfully');

            this.currentSelection = ` for Job ${attachedJob.jobNo}`;
        } catch (error) {
            this.toastrService.showErrorToast("Error loading job information");
            console.error(' Error loading job information', error);
        }
    }

    async selectJob(job: IDispatchJob): Promise<void> {
        console.log("Selected job run...");
        console.log(job);

        if (!job) return;

        // Cancel any existing task loading for a previous job
        if (this.currentJobId && this.currentJobId !== job.id) {
            this.tasksService.cancelJobTaskLoading(this.currentAppPage, this.currentJobId);
        }

        // Only switch to the Selected Driver view if not in All Drivers (Overview) mode
        if (this.currentWorkViewMode !== CurrentWorkLists.Overview) {
            this.currentWorkViewMode = CurrentWorkLists.SelectedDriver;
        }

        await this.markJobReadStatus(job.id, true);

        // Load tasks in the background without blocking job selection
        this.loadSupportsInBackground(undefined, job.id);

        // Create a new reference to trigger change detection
        this.currentJob = angular.copy(job);
        this.currentJobId = job.id;

        // Set the currentSelection to job-specific information
        this.currentSelection = ` for Job ${job.jobNo}`;
        console.log('currentSelection:', this.currentSelection);

        try {
            if (!job.courier && !job.assignedCourier) {
                // Scenario 2: Job has no courier assigned - show only this job
                console.log("Selected job has no courier - showing only this job on map");

                const mapJobItem = this.mapToDispatchMapItem(job);
                this.mapJobList = [mapJobItem]

                // Get potential couriers for this job but preserve the current courier context if one exists
                await this.getPotentialCouriers(job.id);
                // Note: We don't clear the currentCourier here to preserve the courier's current work list
            } else {
                // Scenario 3: Job has a courier assigned - show this courier's jobs
                console.log("Selected job has courier assigned - loading courier's jobs");
                this.potentialCouriers = undefined;

                if (job.courierData && job.courierData.courierId) {
                    // Set the current courier context first
                    this.currentCourier = {
                        id: job.courierData.courierId,
                        text: job.courierData.courierName || job.courier || job.assignedCourier?.text || 'Unknown Courier'
                    };

                    if (!this.currentCourier) return;
                    this.currentWorkSelection = ` for Courier ${job.courierData.courier}: ${job.courierData.courierName}`;

                    // Get all jobs for this courier
                    await this.getCurrentJobs(job.courierData.courierId);

                    try {
                        this.truckCourierStatus = await this.DispatchData.truckCourierStatus(job.courierData.courierId);
                    } catch (error: any) {
                        console.warn("Error fetching truck courier status:", error);
                    }
                } else {
                    // Fallback if no courier data available
                    console.warn("Job has courier assigned but missing courierData");
                    const mapJobItem = this.mapToDispatchMapItem(job);
                    this.mapJobList = [mapJobItem]
                }
            }
        } catch (error: any) {
            console.error("Error in selectJob:", error);
            // Fallback to showing just the current job
            const mapJobItem = this.mapToDispatchMapItem(job);
            this.mapJobList = [mapJobItem]
        }

        // Only focus the dispatch field for the selected job
        this.focusDispatchField(job.id);
        this.applyScope();
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
            console.log("Supports already loading in background, cancelling previous");
            this.tasksService.cancelJobTaskLoading(this.currentAppPage, this.currentJobId);
        }

        this.supportsLoadingInBackground = true;

        const filterRequest = this.tasksService.buildFilterRequest(
            filterType,
            effectiveJobId,
            this.staffFilter,
            this.eventTypeFilter,
            this.currentAppPage
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
                console.log(`Ignoring task results for old job ${effectiveJobId}, current is ${this.currentJobId}`);
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

    private initializeJobSearchFields(jobs: IDispatchJob[]): IDispatchJob[] {
        if (!Array.isArray(jobs)) {
            return jobs;
        }

        return jobs.map(job => {
            // Initialize search text if not present
            if (!job.hasOwnProperty('searchText')) {
                job.searchText = '';
            }

            // Initialize typeahead loading states
            if (!job.hasOwnProperty('courierSearchLoading')) {
                job.courierSearchLoading = false;
            }

            return job;
        });
    }

    handleBackendFilter = async (column: string, direction: string): Promise<void> => {
        this.queryParams.order = (direction == 'desc' ? '-' : '') + column;

        // Actually fetch the data with the new sort order
        await this.getJobList();
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
        try {
            this.isLoadingData = true;

            if (!this.viewsInitialized && this.selectedViews.length === 0) {
                console.log('Views not initialized yet, loading defaults');
                this.selectedViews = this.loadViewsFromStorage();

                // If still no views, add at least one default view
                if (this.selectedViews.length === 0 && this.views.length > 0) {
                    this.selectedViews = [this.views[0]];
                }
            }

            if (Modernizr.localstorage) {
                localStorage.setItem(this.DispatchFiltersKey, JSON.stringify(this.queryParams));
            }

            let orderBy = this.queryParams.order || '';
            let orderDirection: string;

            if (orderBy && orderBy.startsWith("-")) {
                orderBy = orderBy.substring(1);
                orderDirection = "desc";
            } else {
                orderDirection = "asc";
            }

            const params: IJobQueryParams = {
                order: orderBy,
                orderDirection: orderDirection,
                startDate: this.dateFilterData.startDate,
                endDate: this.dateFilterData.endDate,
                page: this.currentJobListPage,
                pageSize: this.currentJobListPageSize,
                useTime: this.dateFilterData.useTime,
                searchText: this.queryParams.searchText,
                statusFilter: this.queryParams.statusFilter,
            };

            const result = await this.dispatchJobService.getJobsWithDispatchInfo(
                params,
                ClientInternal ?? false,
                this.selectedViews
            );

            if (result.jobs?.length > 0) {
                this.jobList = this.initializeJobSearchFields(result.jobs);

                if (!this.currentCourier) {
                    // Only show undispatched jobs on map for performance
                    const undispatchedMapItems = this.getUndispatchedMapItems(result.jobs);
                    this.mapJobListFull = angular.copy(undispatchedMapItems);
                    this.mapJobList = undispatchedMapItems;
                }
            } else {
                this.jobList = [];

                if (!this.currentCourier) {
                    this.mapJobList = [];
                }
            }

            // Only clear jobsCurrentList if we're not viewing a specific courier's jobs
            if (!this.currentCourier) {
                this.jobsCurrentList = undefined;
            }
            this.totalJobCount = result.totalCount;
        } catch (error: any) {
            console.error("Error getting job list:", error);

            const statusCode = error?.status || error?.response?.status;
            const errorMessage = error?.data?.message || error?.message || 'Unknown error';

            let toastMessage = "Failed to get job list.";
            if (statusCode === 500) {
                toastMessage = `Server error (500): ${errorMessage}`;
            } else if (statusCode === 503 || errorMessage.toLowerCase().includes('timeout') || errorMessage.toLowerCase().includes('connection')) {
                toastMessage = "Database connection issue. Server may be under heavy load.";
            } else if (statusCode === 401 || statusCode === 403) {
                toastMessage = "Access denied. Please refresh and try again.";
            } else if (statusCode) {
                toastMessage = `Failed to get job list (${statusCode}): ${errorMessage}`;
            }

            this.toastrService.showErrorToast(toastMessage);

            this.jobList = [];

            if (!this.currentCourier) {
                this.mapJobList = [];
            }
        } finally {
            this.isLoadingData = false;
            this.applyScope();
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
        } catch (error: any) {
            console.error("Error in getData:", error);
            this.toastrService.showErrorToast("An error occurred while loading data. Please refresh the page.");
        }
    }

    async refreshBox(boxName: string): Promise<void> {
        console.log("'Refresh box called. ", boxName);

        switch (boxName) {
            case DispatchBoxes.JobDetail:
                await this.refreshJobDetail();
                break;
            case DispatchBoxes.Supports:
                await this.getSupports();
                break;
            case DispatchBoxes.JobsList:
            case DispatchBoxes.Map:
            default:
                await this.getData();
                break;
        }
    }

    async refreshJobDetail(): Promise<void> {
        if (!this.currentJobId) {
            console.log("No job selected to refresh");
            return;
        }

        console.log('refreshing job detail!');

        try {
            const jobId = this.currentJobId;

            // Trigger change detection by clearing and restoring the jobId
            this.currentJobId = undefined;
            this.applyScope();

            // Use $timeout to ensure digest cycle completes before restoring jobId
            this.$timeoutService?.(() => {
                this.currentJobId = jobId;
                this.applyScope();
            }, 50);
        } catch (error: any) {
            console.error("Error refreshing job detail:", error);
            this.toastrService.showErrorToast("Failed to refresh job details");
        }
    }


    async fetchDriverLocations(): Promise<void> {
        this.driverLocationsLoading = true;
        this.updateDriverLocationsDisplay();

        await this.getDriverLocationsData();

        this.driverLocationsLoading = false;
        this.updateDriverLocationsDisplay();
    }

    async getDriverLocationsData(): Promise<void> {
        try {
            if (!this.selectedViews || this.selectedViews.length === 0) {
                console.log('No selected views available for driver locations');
                this.driverLocations = {areas: []};
                this.updateDriverLocationsDisplay();
                return;
            }

            console.log('Fetching driver locations for views:', this.selectedViews);
            this.driverLocations = await this.DispatchData.getDriverLocations(this.selectedViews);
            console.log('Driver locations received:', this.driverLocations);
            this.updateDriverLocationsDisplay();
        } catch (error: any) {
            console.error("Error getting driver locations data:", error);
            this.driverLocations = {areas: []};
            this.updateDriverLocationsDisplay();
        }
    }

    async setSplitJobMeetingPoint($event: MouseEvent, currentJob: IDispatchJob): Promise<void> {
        try {
            if (!currentJob.deliveryAddress) return;

            const newAddress = await this.editAddressDialog.openEditAddressDialog(currentJob.deliveryAddress, $event)
            if (!newAddress) return;

            await this.handleNewAddressForSplitJobs(newAddress, currentJob);
        } catch (error: any) {
            console.log(error.message);
        } finally {
            console.log("Split jobs process completed.");
        }
    }

    async handleNewAddressForSplitJobs(addressDetails: IAddressViewModel, currentJob: IDispatchJob): Promise<void> {
        if (!addressDetails) {
            console.log("Split jobs canceled!");
            return;
        }

        const updatedJob = {
            ...currentJob, toAddress: addressDetails.address, toSuburbID: addressDetails.toSuburbId,
        };

        const callData = {
            jobID: updatedJob.id,
            lat: Number(addressDetails.latitude),
            long: Number(addressDetails.longitude),
            toSuburbId: Number(updatedJob.toSuburbID),
            toAddress: updatedJob.toAddress,
        };

        if (!callData.toAddress || !callData.toSuburbId) return;
        await this.DispatchData.updateSplitJobAddress(callData.jobID, callData.toSuburbId, callData.toAddress, callData.lat, callData.long);
        await this.DispatchData.reRateSplitJob(callData.jobID);
        await this.DispatchData.finishSplitJobProcess(callData.jobID);
        await this.getData();

        this.toastrService.showSuccessToast("Job Successfully Split");
        console.log("Job splitting complete!");
        console.log("Dialog closed!");

        return this.getJobList();
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
                console.log("Create new job process completed.");
            }
        } catch (error: any) {
            console.log("Error in createNewJob:", error);
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

    async interCourierCharge($event: MouseEvent): Promise<void> {
        await this.interCourierChargeDialog.showInterCourierCharge($event);
    }

    async openFileAttachmentDialog($event: MouseEvent, job: IDispatchJob): Promise<void> {
        await this.jobFileUploadDialog.openJobFileUploadDialog($event, job);
    }

    async showAdditionalServicesMenu($event: MouseEvent, job: IDispatchJob): Promise<void> {
        await this.additionalServicesDialog.showAdditionalServicesDialog($event, job);
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

            console.log('Filter request:', filterRequest);

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

    getContextMenuOptions(job: IDispatchJob): any[] | IContextMenuOption[] {
        if (!job) return [];

        const callbacks = {
            onRefresh: async () => {
                // getData() now automatically handles courier context and refreshes courier jobs if needed
                if (this.currentCourier) {
                    this.currentListLoading = true;
                    this.applyScope();
                    try {
                        await this.getData();
                    } finally {
                        this.currentListLoading = false;
                        this.applyScope();
                    }
                } else {
                    return this.getData();
                }
            },
            onSplitJob: (params: { job: IDispatchJob }) => this.handleSplitJob(params.job),
            onRefreshCourierJobs: (params: { courierId: number }) => {
                if (this.currentCourier) {
                    return this.getCurrentJobs(params.courierId);
                }
            }
        };

        return this.jobContextMenuService.getMenuOptions(job, callbacks, AppPage.Dispatch);
    }

    async handleSplitJob(job: IDispatchJob): Promise<void> {
        if (!job) return;

        try {
            await this.setSplitJobMeetingPoint(new MouseEvent('click'), job);
            await this.getData();
        } catch (error: any) {
            console.error("Error handling split job:", error);
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

    async openHubUrl(): Promise<void> {
        await this.navigationService.openHubUrl();
    }

    private updateDriverLocationsDisplay(): void {
        const hasAreas = this.driverLocations && this.driverLocations.areas && this.driverLocations.areas.length > 0;

        console.log('Updating driver locations display:', {
            loading: this.driverLocationsLoading,
            hasDriverLocations: !!this.driverLocations,
            areasCount: this.driverLocations?.areas?.length || 0,
            hasAreas: hasAreas
        });

        this.showDriverLocationsNoData = !this.driverLocationsLoading && !hasAreas;
        this.showDriverLocationsData = (!this.driverLocationsLoading && hasAreas) ?? true;
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
                let newStopJob = this.jobList.find(j => j.id === newStopJobId) ||
                    await this.DispatchData.getDispatchJobDetail(newStopJobId);

                if (newStopJob) {
                    await this.selectJob(newStopJob);
                }
            } else {
                this.currentJobId = job.id;
                this.currentJob = job;
            }
        } catch (error: any) {
            console.error('Error in addStopToJob:', error);
            this.toastrService.showErrorToast(
                error.message?.includes('loading') ? 'Error loading new stop job details' : 'Failed to add stop to job'
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
        this.unReadMessageCount = await this.messagingService.getUnreadMessageCount();
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
        } catch (error: any) {
            console.error("Error in dispatch:", error);
            throw error;
        }
    }

    getJobContextMenuOptions(): (data: any) => any[] | IContextMenuOption[] {
        return (data: any) => this.getContextMenuOptions(data.job);
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
        console.log('Refresh interval changed to:', selectedInterval, 'seconds');

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

        console.log(`Starting auto refresh every ${this.selectedRefreshInterval.id} seconds (${this.selectedRefreshInterval.text})`);

        this.isAutoRefreshEnabled = true;

        this.refreshIntervalPromise = this.registerInterval(async () => {
            if (this.isAutoRefreshEnabled) {
                console.log('Auto refreshing job lists...');
                try {
                    await this.getData();

                    // Also refresh tasks if a job is selected
                    if (this.currentJobId) {
                        await this.loadSupports();
                    }

                    console.log('Auto refresh completed successfully');
                } catch (error) {
                    console.error('Error during auto refresh:', error);
                }
            }
        }, this.selectedRefreshInterval.id * 1000);

        this.applyScope();
    }

    private stopAutoRefresh(): void {
        console.log('Stopping auto refresh');
        this.isAutoRefreshEnabled = false;

        if (this.refreshIntervalPromise) {
            const cancelled = this.cancelInterval(this.refreshIntervalPromise);
            if (cancelled) {
                console.log('Successfully cancelled refresh interval');
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
                    const refreshId = parseInt(savedIntervalString, 10) ?? 0;
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
        console.log('Driver location refresh interval changed to:', selectedInterval, 'seconds');

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

        console.log(`Starting driver location auto refresh every ${this.selectedDriverLocationRefreshInterval.id} seconds (${this.selectedDriverLocationRefreshInterval.text})`);

        this.isDriverLocationAutoRefreshEnabled = true;

        this.driverLocationRefreshIntervalPromise = this.registerInterval(async () => {
            if (this.isDriverLocationAutoRefreshEnabled) {
                console.log('Auto refreshing driver locations and map...');
                try {
                    // fetchDriverLocations() will automatically trigger map refresh
                    await this.fetchDriverLocations();
                    console.log('Driver location auto refresh completed successfully');
                } catch (error) {
                    console.error('Error during driver location auto refresh:', error);
                }
            }
        }, this.selectedDriverLocationRefreshInterval.id * 1000);

        this.applyScope();
    }

    private stopDriverLocationAutoRefresh(): void {
        console.log('Stopping driver location auto refresh');
        this.isDriverLocationAutoRefreshEnabled = false;

        if (this.driverLocationRefreshIntervalPromise) {
            const cancelled = this.cancelInterval(this.driverLocationRefreshIntervalPromise);
            if (cancelled) {
                console.log('Successfully cancelled driver location refresh interval');
            } else {
                console.warn('Failed to cancel driver location refresh interval');
            }

            this.driverLocationRefreshIntervalPromise = undefined;
        }
    }

    getCurrentDriverLocationRefreshIntervalText(): string {
        if (!this.selectedDriverLocationRefreshInterval || this.selectedDriverLocationRefreshInterval.id === 0) {
            return 'Driver location auto refresh disabled';
        }
        return `Driver location auto refresh: ${this.selectedDriverLocationRefreshInterval.text}`;
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
        console.log('refreshDataTimeSpan called with data ', dateFilterData);
        this.dateFilterData = dateFilterData;

        this.saveDateFilterToStorage();
        await this.getData();
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
                    this.dateFilterData = {
                        startDate: dayjs(parsedDateFilter.startDate),
                        endDate: dayjs(parsedDateFilter.endDate)
                    };
                }
            } catch (error) {
                console.error('Error loading date filter from storage:', error);
                // Keep default values if parsing fails
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

    async handleLoadMoreJobs(page: number, pageSize: number): Promise<IJobSearchResult> {
        try {
            if (this.queryParams.order && this.queryParams.order.startsWith("-")) {
                this.queryParams.order = this.queryParams.order.substring(1);
                this.queryParams.orderDirection = "desc";
            } else if (this.queryParams.order) {
                this.queryParams.orderDirection = "asc";
            }

            return await this.dispatchJobService.getJobsWithDispatchInfo(
                {
                    ...this.queryParams,
                    startDate: this.dateFilterData.startDate,
                    endDate: this.dateFilterData.endDate,
                    useTime: this.dateFilterData.useTime,
                    page: page,
                    pageSize: pageSize
                },
                ClientInternal ?? false,
                this.selectedViews,
                this.selectedClearListId,
            );
        } catch (error) {
            console.error('Error loading more POD jobs:', error);
            this.toastrService.showErrorToast('Failed to load more POD jobs');
            throw error;
        }
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

            if (result.boxes) this.boxes = result.boxes;

            this.saveCurrentLayout();
            this.applyScope();
            this.toastrService.showSuccessToast('Settings saved and applied successfully');
        } catch (error) {
            if (!error) return;
            console.error('Error opening settings dialog:', error);
            this.toastrService.showErrorToast('Failed to open settings dialog');
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
        } catch (error: any) {
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
            // Refresh driver job counts when switching to All Drivers view
            await this.loadDriversWithJobCounts();
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
