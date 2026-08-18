import './nationwide.styles.less';
import NationwideService from "./nationwide.service";
import ToastrService from "../../services/toastr.service";
import DispatchCoreService from "../../services/dispatch-core.service";
import {AppPage} from "../../enums/app-pages.enum";
import {IAppConfig} from "../../interfaces/app-config.interface";
import DispatchExecutorService from "../../services/dispatch-executor.service";
import {
    IAgent,
    IAirlineSuggestion,
    IAirportSuggestion,
    IDispatchJob,
    IJob,
    IJobQueryParams,
    IJobSearchResult,
    ISuggestion
} from "../../interfaces/job.interface";
import {Coordinates} from "../../interfaces/coordinates.interface";
import {
    AssignFlightToJobRequest,
    IFlightSegment,
    IFlightViewModel,
    IGetAgentOptionsResponse,
    IGetFlightOptionsResponse,
    StatusChangeEvent
} from "./nationwide.interfaces";
import {IBox, IColumn, ILayout} from "../../interfaces/layout.interfaces";
import BaseController from "../base-controller";
import JobFileUploadDialogService from "../dialogs/job-file-upload-dialog/job-file-upload-dialog.service";
import JobDataType from "./enums/JobDataType";
import {DfrntPageViewModel} from "../../interfaces/dfrnt-page-view-model.interface";
import {openAddEventDialog} from "../../react/components/dialogs/add-event-dialog";
import type {ToastType} from "../../react/services/toastService";
import type {DispatchJob, MountJobListConfig} from "../../react/interfaces";
import AccessorialChargesDialogService from "../dialogs/accessorial-charges-dialog/accessorial-charges-dialog.service";
import {ExtendedTask, ITask} from "../../interfaces/task.interfaces";
import {IJobReadChanged} from "../../interfaces/event-interfaces";
import {JobProperty} from "../../enums/job-property.enum";
import FlightDetailsDialogService from "../dialogs/flight-details-dialog/flight-details-dialog.service";
import ApiConfig from "../../interfaces/apiConfig.interface";
import ConfigService from "../../services/config.service";
import AutoCompleteDialogService from "../dialogs/auto-complete-dialog/auto-complete-dialog.service";
import NationwideBoxes from "./enums/NationwideBoxes";
import JobAddStopService from "../../services/job-add-stop.service";
import FlightAgentConfirmationDialogService
    from "../dialogs/flight-agent-conformation-dialog/flight-agent-confirmation-dialog.service";
import DispatchDialogService from "../dialogs/dispatch-dialog/dispatch-dialog.service";
import type {DispatchType} from "../../react/components/dialogs/dispatch-dialog/types";
import {openAgentInfoDialog} from "../../react/components/dialogs/agent-info-dialog";
import {openRecoveryAgentManagementDialog} from "../../react/components/dialogs/recovery-agent-management-dialog";
import dayjs, {Dayjs} from "dayjs";
import MessagingDialogService from "../dialogs/messaging-dialog/messaging-dialog.service";
import {ContactID, TimeZone} from "../../contants";
import {StatusFilter} from "../../enums/status-filter.enum";
import TasksService from "../../services/tasks.service";
import JobListType from "../../enums/job-list-type.enum";
import {formatDateForApiWithTzs, getIanaTimezone} from "../../react/utils/dateUtils";
import {
    fetchNationwideJobsNew,
    fetchNationwideJobsPod,
    fetchNationwideJobsReprice
} from "../../react/services/jobSearchApi";
import {queryKeys} from "../../react/query/queryClient";
import IDateFilterData from "../../interfaces/date-filter-data.interface";
import setDateFilterDefaults from "../../functions/setDateFilterDefaults";
import timezone from "dayjs/plugin/timezone";
import {transformFlightToDTO} from "../../functions/toDtoMappings";
import utc from "dayjs/plugin/utc";
import {HereMapConfig} from "../../interfaces/hereMapCredentials.interfaces";
import DashboardSettingsDialogService from "../dialogs/dashboard-settings-dialog/dashboard-settings-dialog.service";
import {setAiEnabled} from "../../functions/aiSettings";
import angular from 'angular';
import ITaskItemConfig from "../../interfaces/task-item-config";

dayjs.extend(utc);
dayjs.extend(timezone);

class NationwideControl extends BaseController {
    static $inject = [
        'NWData',
        '$mdDialog',
        '$document',
        'toastrService',
        'DispatchData',
        '$mdSidenav',
        'APP_CONFIG',
        'dispatchJobService',
        'jobFileUploadDialogService',
        'accessorialChargesDialogService',
        'flightDetailsDialogService',
        'configService',
        'autoCompleteDialogService',
        'jobAddStopService',
        '$stateParams',
        'flightAgentConfirmationDialogService',
        'dispatchDialogService',
        'messagingDialogService',
        'tasksService',
        'dashboardSettingsDialogService',
        '$scope',
        '$timeout',
        '$interval',
    ];

    private readonly refreshDurationIntervalKey: string = `refreshInterval-${AppPage.Domestic}-${ContactID}`;
    private readonly DateFilterKey: string = `dateFilter-${AppPage.Domestic}-${ContactID}`;
    private readonly SelectedViewsKey: string = `selectedViews-NW-${ContactID}`;
    private readonly NationwideLayoutKey: string = `layoutsNW-${ContactID}`;
    private readonly NationwideLastActiveLayoutKey: string = `lastActiveLayoutNW-${ContactID}`;
    private readonly BoxVisibilityKey: string = `boxVisibility-${AppPage.Domestic}-${ContactID}`;

    private static readonly FLIGHT_SPEED_ID = 415;

    readonly nationwideJobList: JobListType = JobListType.NationwideJobList;
    readonly nationwidePodJobList: JobListType = JobListType.NationwidePodJobList;
    readonly nationwideRepriceJobList: JobListType = JobListType.NationwideRepriceJobList;
    readonly nationwidePageId: number = AppPage.Domestic;

    // Gridster layout
    boxes?: Record<string, IBox>;
    currentLayoutName?: string;
    boxSortableOptions?: angular.ui.SortableOptions<any>;
    layouts: ILayout[] = [];
    defaultLayout?: ILayout;
    layout?: { columns: IColumn[] };

    private lastMapJobId?: number;
    private cachedMapConfig?: HereMapConfig;
    private isSelectingJob: boolean = false;

    private tasksLoadingInBackground: boolean = false;
    isUsCustomer: boolean;
    isDataLoading: boolean = false;
    currentJob?: IDispatchJob;
    flightAgentWidgetJob?: IDispatchJob;
    jobList?: IDispatchJob[] = [];
    jobListPOD?: IDispatchJob[] = [];
    jobListReprice?: IDispatchJob[] = [];
    STATUS_TO_LIST_MAP: Record<number, JobDataType[]>;
    totalJobCount: number = 0;
    totalPodCount: number = 0;
    totalRepriceCount: number = 0;
    mapCenter?: Coordinates;
    sort: Record<string, string> = {};
    flightOptions?: IFlightViewModel[] = [];
    flightMessage?: string;
    flightsLoading?: boolean = false;
    agentOptions?: IAgent[] = [];
    agentMessage?: string;
    views: DfrntPageViewModel[] = [];
    selectedViews: DfrntPageViewModel[] = [];
    viewsInitialized: boolean = false;
    showInput: Record<string, boolean> = {};
    inputWidth: Record<string, number> = {};
    jobListLoading: boolean = false;
    podListLoading: boolean = false;
    repriceListLoading: boolean = false;
    selectedAirline?: ISuggestion;
    jobFilters: IJobQueryParams = {
        order: 'time',
        orderDirection: 'asc',
        searchText: ''
    };
    jobPodFilters: IJobQueryParams = {
        order: 'time',
        orderDirection: 'asc',
        searchText: ''
    };
    jobRepriceFilters: IJobQueryParams = {
        order: 'time',
        orderDirection: 'asc',
        searchText: ''
    };
    hereCredentials?: ApiConfig;
    mapConfig?: HereMapConfig;
    currentSelection?: string;
    agentsLoading: boolean = false;
    agentListPromise?: Promise<IGetAgentOptionsResponse>;
    flightListPromise?: Promise<IGetFlightOptionsResponse>;
    taskItemConfig: ITaskItemConfig = {
        showAssign: true,
        showClose: true,
        showDelete: true,
        onTaskClick: true
    };
    currentSupport?: ITask;
    activeAirlineOptions?: IAirlineSuggestion[];
    timeZone: string;
    lastDepartureTime?: Dayjs;
    outboundAirportOptions?: IAirportSuggestion[];
    inboundAirportOptions?: IAirportSuggestion[];
    selectedOutboundAirport?: IAirportSuggestion;
    selectedInboundAirport?: IAirportSuggestion;
    isDeliveryJobType: boolean = false;

// Flight section visibility flags
    showNoJobSelectedMessage: boolean = false;
    showJobHasAssignedFlightMessage: boolean = false;
    showMissingAirportInfoMessage: boolean = false;
    showNoFlightsAvailableMessage: boolean = false;
    showFlightList: boolean = false;

// Agent section visibility flags
    showNoAgentJobSelectedMessage: boolean = false;
    showJobHasAssignedAgentMessage: boolean = false;
    showNotDeliveryJobMessage: boolean = false;
    showNoAgentsAvailableMessage: boolean = false;
    showAgentList: boolean = false;

    dateFilterData: IDateFilterData;
    unReadMessageCount: number = 0;

    refreshIntervalOptions?: ISuggestion[];
    selectedRefreshInterval?: ISuggestion;
    private refreshIntervalPromise?: angular.IPromise<any>;
    private isAutoRefreshEnabled: boolean = false;

    // supportFilters
    staffList?: ISuggestion[];
    eventTypesList?: ISuggestion[];
    staffFilter: string = StatusFilter.All;
    eventTypeFilter: string = StatusFilter.All;
    tasksLoading: boolean = false;
    filteredTasks: ExtendedTask[] = [];
    tasksFilter: string = 'all';
    tasks: ExtendedTask[] = [];

    // Flight Search
    flightSearchText: string = '';
    filteredFlightOptions?: IFlightViewModel[] = [];
    includeNearbyAirports: boolean = false;
    private isHandlingJobChange: boolean = false;
    private reactNationwideMounted = new Set<string>();

    constructor(
        private nationwideService: NationwideService,
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
        private toastrService: ToastrService,
        private DispatchData: DispatchCoreService,
        private $mdSidenav: angular.material.ISidenavService,
        private appConfig: IAppConfig,
        private dispatchJobService: DispatchExecutorService,
        private jobFileUploadDialogService: JobFileUploadDialogService,
        private accessorialChargesDialogService: AccessorialChargesDialogService,
        private flightDetailsDialogService: FlightDetailsDialogService,
        private configService: ConfigService,
        private autoCompleteDialogService: AutoCompleteDialogService,
        private jobAddStopService: JobAddStopService,
        private $stateParams: angular.ui.IStateParamsService,
        private flightAgentConfirmationDialogService: FlightAgentConfirmationDialogService,
        private dispatchDialogService: DispatchDialogService,
        private messagingDialogService: MessagingDialogService,
        private tasksService: TasksService,
        private dashboardSettingsDialog: DashboardSettingsDialogService,
        $scope: angular.IScope,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
    ) {
        super();
        this.initServices($timeout, $interval, $scope);

        this.isUsCustomer = this.appConfig.US_Customer;
        this.timeZone = getIanaTimezone(TimeZone);

        this.initializeBoxes();
        this.initializeLayoutSystem();

        // Date filter
        this.dateFilterData = setDateFilterDefaults();
        this.loadDateFilterFromStorage();

        this.watchEvent<IJobReadChanged>('jobReadChanged', (_, data) => {
            this.markJobReadStatus(data.jobId, data.isRead);
        });

        this.watchEvent('jobChanged', async (_, newJob: IJob) => {
            if (this.isHandlingJobChange) {
                return;
            }

            if (this.currentJob?.id === newJob.id) {
                return;
            }

            this.isHandlingJobChange = true;

            try {
                const job = await this.DispatchData.getDispatchJobDetail(newJob.id);
                await this.selectJob(job);
            } finally {
                this.isHandlingJobChange = false;
            }
        });

        this.initHereMaps();

        // Data loading is initiated in $onInit to avoid duplicate calls
        this.STATUS_TO_LIST_MAP = {
            1: [JobDataType.NEW],
            3: [JobDataType.POD],
            4: [JobDataType.REPRICE]
        };

        this.nationwideService.getActiveAirlines().then((response: IAirlineSuggestion[]) => {
            this.activeAirlineOptions = response;
        });

        // New map
        this.mapCenter = this.appConfig.US_Customer
            ? this.appConfig.US_Coordinates_Center
            : this.appConfig.NZ_Coordinates_Center
        this.showInput = {};
        this.inputWidth = {};

        this.initRefreshIntervalOptions();
        this.loadSavedRefreshInterval();
        this.initializeTaskService();
    }

    $onInit(): void {
        const jobId = this.$stateParams.jobId;

        this.loadPageViews();
        this.mountAllNationwideReactJobLists();

        if (jobId) {
            this.registerTimeout(async () => {
                if (!this.jobList) return;

                const job = this.jobList.find((j: IDispatchJob) => j.id === jobId);
                if (!job) return;

                await this.selectJob(job);
            });
        }

        this.registerInterval(async () => {
            await this.getUnreadMessageCount();
        }, 10000);

        // Show initial "No Job Selected" state in the flight/agent component
        this.updateUIState();
    }

    $onDestroy(): void {
        super.$onDestroy();
        this.stopAutoRefresh();
        if (window.ReactNationwideJobList) {
            window.ReactNationwideJobList.unmountAll();
        }
        this.reactNationwideMounted.clear();
    }

    // Layout system 
    private initializeLayoutSystem(): void {
        // Ensure draggingItems container exists
        if (angular.element('#draggingItems').length === 0) {
            angular.element('body').append('<div id="draggingItems"></div>');
        }

        const jobsListBox: IBox = {name: NationwideBoxes.NewJobs, height: "60%"};
        const jobsListPODBox: IBox = {name: NationwideBoxes.PodJobs, height: "40%"};
        const tasksListBox: IBox = {name: NationwideBoxes.Tasks, height: "50%"};
        const jobsListRepriceBox: IBox = {name: NationwideBoxes.RepriceJobs, height: "50%"};
        const mapBox: IBox = {name: NationwideBoxes.Map, height: "30%"};
        const jobDetailBox: IBox = {name: NationwideBoxes.JobDetail, height: "60%"};
        const flightAgentDataTableBox: IBox = {name: NationwideBoxes.FlightAgents, height: "30%"};

        // Define columns
        const column1: IColumn = {
            id: "col1",
            width: "35%",
            boxes: [jobsListBox, flightAgentDataTableBox]
        };

        const column2: IColumn = {
            id: "col2",
            width: "35%",
            boxes: [jobDetailBox, mapBox]
        };

        const column3: IColumn = {
            id: "col3",
            width: "30%",
            boxes: [jobsListPODBox, tasksListBox, jobsListRepriceBox]
        };

        // Create default layout
        this.defaultLayout = {
            name: "Default",
            layout: {
                columns: [column1, column2, column3]
            }
        };

        // Load saved layouts or use default
        try {
            const storedLayouts: ILayout[] = JSON.parse(localStorage.getItem(this.NationwideLayoutKey) || '[]');
            const lastActiveLayout = localStorage.getItem(this.NationwideLastActiveLayoutKey);

            this.layouts = storedLayouts || [this.defaultLayout];
            this.layouts[0] = this.defaultLayout; // Ensure default is always up to date

            // Load last active layout or default
            const layoutToLoad = lastActiveLayout
                ? this.layouts.findIndex((l: ILayout) => l.name === lastActiveLayout)
                : 0;
            this.loadLayout(layoutToLoad >= 0 ? layoutToLoad : 0);
        } catch (error) {
            console.error('Error loading stored layouts:', error);
            this.layouts = [this.defaultLayout];
            this.loadLayout(0);
        }

        // Initialize box-sortable options
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

            start: (e: JQueryEventObject, ui: any) => {
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

                this.updateBoxMetrics();
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

        localStorage.setItem(this.NationwideLastActiveLayoutKey, layout.name);
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

                localStorage.setItem(this.NationwideLayoutKey, JSON.stringify(this.layouts));
                localStorage.setItem(this.NationwideLastActiveLayoutKey, name);

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
                localStorage.setItem(this.NationwideLayoutKey, JSON.stringify(this.layouts));
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

            localStorage.setItem(this.NationwideLayoutKey, JSON.stringify(this.layouts));
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
            [NationwideBoxes.Map]: {
                name: NationwideBoxes.Map,
                title: 'Map',
                icon: "pin_drop",
                templateUrl: "app/components/Nationwide/partials/map.html",
                showRefresh: true,
                visible: true,
                description: "Geographic view of nationwide job locations and coverage areas"
            },
            [NationwideBoxes.NewJobs]: {
                name: NationwideBoxes.NewJobs,
                title: 'New Jobs',
                icon: "new_releases",
                templateUrl: "app/components/Nationwide/partials/jobList.html",
                showRefresh: true,
                visible: true,
                description: "Recently created jobs requiring assignment or review"
            },
            [NationwideBoxes.JobDetail]: {
                name: NationwideBoxes.JobDetail,
                title: 'Job Detail',
                icon: "assignment",
                templateUrl: "app/components/Nationwide/partials/jobDetail.html",
                showRefresh: true,
                showDetailButtons: true,
                visible: true,
                description: "Complete job information with management actions"
            },
            [NationwideBoxes.PodJobs]: {
                name: NationwideBoxes.PodJobs,
                title: 'Awaiting POD',
                icon: "pending_actions",
                templateUrl: "app/components/Nationwide/partials/jobListPOD.html",
                showRefresh: true,
                visible: true,
                description: "Jobs pending proof of delivery documentation"
            },
            [NationwideBoxes.RepriceJobs]: {
                name: NationwideBoxes.RepriceJobs,
                title: 'Reprice',
                icon: "price_change",
                templateUrl: "app/components/Nationwide/partials/jobListReprice.html",
                showRefresh: true,
                visible: true,
                description: "Jobs flagged for pricing adjustment or review"
            },
            [NationwideBoxes.Tasks]: {
                name: NationwideBoxes.Tasks,
                title: 'Tasks',
                icon: "support",
                templateUrl: "app/components/Nationwide/partials/tasksList.html",
                showRefresh: true,
                visible: true,
                description: "Administrative tasks and follow-up items"
            },
            [NationwideBoxes.FlightAgents]: {
                name: NationwideBoxes.FlightAgents,
                title: 'Available',
                icon: "docs_add_on",
                templateUrl: "app/components/Nationwide/partials/flightAgentDataTableBox.html",
                showRefresh: true,
                visible: true,
                description: "List of available agents or flights ready for job assignment"
            },
        };
    }

    private getBoxVisibilityKey(layoutName: string): string {
        return `${this.BoxVisibilityKey}-${layoutName}`;
    }

    private saveBoxVisibility(): void {
        if (!this.boxes || !this.currentLayoutName) return;

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
        if (!this.boxes || !this.currentLayoutName) return;

        try {
            const key = this.getBoxVisibilityKey(this.currentLayoutName);
            const savedState = localStorage.getItem(key);
            if (savedState) {
                const boxState = JSON.parse(savedState);
                Object.keys(boxState).forEach(boxName => {
                    if (this.boxes && this.boxes[boxName]) {
                        // Handle both old format (boolean) and new format (object)
                        if (typeof boxState[boxName] === 'boolean') {
                            this.boxes[boxName].visible = boxState[boxName];
                            this.boxes[boxName].collapsed = false;
                        } else {
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

    toggleBoxCollapse(boxName: string): void {
        if (!this.boxes || !this.boxes[boxName]) return;
        if (this.isDefaultLayout()) return; // Don't allow collapse on default layout

        this.boxes[boxName].collapsed = !this.boxes[boxName].collapsed;
        this.saveBoxVisibility();
        this.applyScope();

        // Re-mount React lists when job list boxes are expanded
        if (!this.boxes[boxName].collapsed) {
            this.remountNationwideReactJobList(boxName);
        }
    }

    isDefaultLayout(): boolean {
        return this.currentLayoutName === 'Default';
    }

    private loadSavedRefreshInterval(): void {
        try {
            const savedIntervalString = localStorage.getItem(this.refreshDurationIntervalKey);
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

    private initializeTaskService(): void {
        try {
            this.tasksService.loadLists().then(({staffList, eventTypesList}) => {
                this.staffList = staffList;
                this.eventTypesList = eventTypesList;
                this.applyScope();
            });

            const filters = this.tasksService.initializePageFilters(this.nationwidePageId);
            this.staffFilter = filters.staffFilter;
            this.eventTypeFilter = filters.eventTypeFilter;
        } catch (error) {
            console.error('Error initializing task service:', error);
        }
    }

    initHereMaps(): void {
        this.configService.getHereMapsKey().then((response: string) => {
            this.hereCredentials = {
                apiKey: response
            };
        });

        this.mapConfig = {
            center: this.appConfig.US_Customer ?
                this.appConfig.US_Coordinates_Center :
                this.appConfig.NZ_Coordinates_Center,
            zoom: 7,
            selectedJobIndex: 0 // Default to parent job view
        };
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

    loadPageViews(): void {
        this.DispatchData.getSelectedViews(AppPage.Domestic)
            .then(views => {
                this.views = views;
                this.initializeViews();
                return this.getData();
            })
            .catch(error => {
                console.error('Error fetching dispatch views:', error);
                this.views = [];
                this.initializeViews();
            });
    }

    initializeViews(): void {
        if (this.views && this.views.length > 0) {
            const hasSavedState = localStorage.getItem(this.SelectedViewsKey) !== null;
            const savedViews = this.loadViewsFromStorage();
            const savedIds = new Set(savedViews.map((v: DfrntPageViewModel) => v.id));

            // Mark server views as selected based on saved IDs
            this.views = this.views.map(view => ({
                ...view, selected: savedIds.has(view.id)
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
        await this.getData();
    }

    async clearAllViews() {
        this.views.forEach((view: DfrntPageViewModel) => {
            view.selected = false;
        });

        this.selectedViews = [];
        this.saveViewsToStorage(this.selectedViews);
        await this.getData();
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

        this.saveViewsToStorage(this.selectedViews);
        await this.getData();
    }

    private saveViewsToStorage(views: DfrntPageViewModel[]): void {
        localStorage.setItem(this.SelectedViewsKey, JSON.stringify(views));
    }

    loadViewsFromStorage(): DfrntPageViewModel[] {
        try {
            const savedViews = JSON.parse(localStorage.getItem(this.SelectedViewsKey) || '[]');
            return savedViews || [];
        } catch (error) {
            console.error('Error loading views from storage:', error);
            return [];
        }
    }

    async handleStatusChange(event: StatusChangeEvent): Promise<void> {
        try {
            const listsToRefresh = new Set([
                ...(this.STATUS_TO_LIST_MAP[event.previousStatusId] || []),
                ...(this.STATUS_TO_LIST_MAP[event.newStatusId] || [])
            ]);

            await this.getJobList(Array.from(listsToRefresh));

            const refreshedJob = this.findJobInLocalLists(event.jobId);

            if (refreshedJob) {
                await this.selectJob(refreshedJob);
            }

            this.applyScope();
        } catch (error) {
            console.error("Error in handleStatusChange:", {
                error,
                jobId: event?.jobId,
                previousStatus: event?.previousStatusId,
                newStatus: event?.newStatusId
            });
            throw error;
        }
    }

    async unlockJob(currentJob: IDispatchJob): Promise<void> {
        await this.DispatchData.updateJobDetail(currentJob.id, JobProperty.Locked, false, currentJob.preBook ?? false)
    }

    async lockJob(currentJob: IDispatchJob): Promise<void> {
        await this.DispatchData.updateJobDetail(currentJob.id, JobProperty.Locked, true, currentJob.preBook ?? false)
    }

    async restoreJob(job: IDispatchJob): Promise<void> {
        try {
            await this.nationwideService.restoreJob(job.id);
            await this.getData();
            window.ReactJobDetails?.refresh?.();
        } catch (error) {
            console.error('Error restoring job:', error);
        }
    }

    async reAllocateJobs(job: IDispatchJob): Promise<void> {
        try {
            if (!job) return;

            await this.dispatchJobService.reassignJob(job);
            await this.getData();
        } catch (error) {
            console.error('Error restoring job:', error);
        }
    }

    async sendQuoteRequest($event: MouseEvent, agent: IAgent, job: IDispatchJob): Promise<void> {
        try {
            // Show confirmation dialog
            const confirm = this.$mdDialog.confirm()
                .title('Send Quote Request')
                .textContent(`Are you sure you want to send a quote request to ${agent.agentName} for job ${job.jobNo}?`)
                .ariaLabel('confirm send quote request')
                .targetEvent($event)
                .ok('Send')
                .cancel('Cancel');

            await this.$mdDialog.show(confirm);

            await this.nationwideService.sendAgentQuote(job.id, agent.agentId);
            this.toastrService.showSuccessToast(`Quote request sent to ${agent.agentName}`);
        } catch (error) {
            if (error) {
                console.error('Error sending quote request:', error);
                this.toastrService.showErrorToast('Failed to send quote request');
            }
        }
    }

    async selectJob(job: IDispatchJob): Promise<void> {
        try {
            if (!job) return;

            if (this.isSelectingJob) {
                return;
            }

            this.isSelectingJob = true;

            // Cancel any existing task loading for a previous job
            if (this.currentJob?.id && this.currentJob?.id !== job.id) {
                this.tasksService.cancelJobTaskLoading(this.nationwidePageId, this.currentJob?.id);
            }

            this.markJobReadStatus(job.id, true);

            this.currentJob = job;
            this.flightAgentWidgetJob = job;
            this.isDeliveryJobType = this.isDeliveryJob(job);

            if (window.ReactNationwideJobList) {
                window.ReactNationwideJobList.selectJob('newJobs', job.id);
                window.ReactNationwideJobList.selectJob('podJobs', job.id);
                window.ReactNationwideJobList.selectJob('repriceJobs', job.id);
            }

            // Update UI first
            this.updateUIState(job);
            this.updateCurrentSelection(job.jobNo);

            // Propagate binding to React job detail immediately, before async work
            this.applyScope();

            await this.handleJobSelectionRelatedData(job);

            this.loadTasksInBackground(undefined, job.id);

            this.updateUIState(job);
            this.displayJobOnMap(job);

        } catch (error) {
            console.error("Error in selectJob:", error);
        } finally {
            this.isSelectingJob = false;
            this.applyScope();
        }
    }

    async onRelatedJobChange(jobId: number): Promise<void> {
        try {
            const job = await this.DispatchData.getDispatchJobDetail(jobId);
            if (!job) return;

            // Only update the flight/agent widget — don't replace currentJob or
            // refresh tasks/map/job-lists, as the job detail tabs handle their
            // own display and the rest of the page should stay on the parent job.
            this.flightAgentWidgetJob = job;
            this.isDeliveryJobType = this.isDeliveryJob(job);
            await this.handleJobSelectionRelatedData(job);
            this.updateUIState(job);
            this.applyScope();
        } catch (error) {
            console.error("Error in onRelatedJobChange:", error);
        }
    }

    private loadTasksInBackground(filterType: string = this.tasksFilter, jobId?: number): void {
        const effectiveJobId = jobId || this.currentJob?.id;

        // Don't load tasks if no job is selected
        if (!effectiveJobId) {
            this.tasks = [];
            this.filteredTasks = [];
            return;
        }

        if (this.tasksLoadingInBackground) {
            this.tasksService.cancelJobTaskLoading(this.nationwidePageId, this.currentJob?.id);
        }

        this.tasksLoadingInBackground = true;

        const filterRequest = this.tasksService.buildFilterRequest(
            filterType,
            effectiveJobId,
            this.staffFilter,
            this.eventTypeFilter
        );

        this.tasksService.loadTasksInBackground(filterRequest, (tasks, error) => {
            // Only process if this is still the current job
            if (effectiveJobId === this.currentJob?.id) {
                this.tasksLoadingInBackground = false;

                if (error) {
                    console.error("Error loading tasks in background:", error);
                    this.tasks = [];
                    this.filteredTasks = [];
                } else {
                    this.tasks = tasks;
                    this.filteredTasks = tasks;
                }

                this.applyScope();
            }
        }, this.nationwidePageId, effectiveJobId);
    }

    private async handleJobSelectionRelatedData(job: IDispatchJob): Promise<void> {
        // Reset data
        this.flightOptions = [];
        this.agentOptions = [];
        this.flightMessage = undefined;
        this.agentMessage = undefined;
        this.selectedAirline = undefined;
        this.selectedOutboundAirport = undefined;
        this.selectedInboundAirport = undefined;

        // Tasks are loaded in background by selectJob after this method returns

        // Skip flight loading if flight is already assigned
        if (job.isFlightJob && !job.assignedFlight) {
            this.outboundAirportOptions = await this.nationwideService.getNearbyAirports(job.id, true);
            this.inboundAirportOptions = await this.nationwideService.getNearbyAirports(job.id, false);

            if (this.outboundAirportOptions && this.outboundAirportOptions.length > 0) {
                const defaultOutboundAirport = this.outboundAirportOptions.find(airport => airport.id === job.fromAirportId);
                if (defaultOutboundAirport) this.selectedOutboundAirport = defaultOutboundAirport;
            }

            if (this.inboundAirportOptions && this.inboundAirportOptions.length > 0) {
                const defaultInboundAirport = this.inboundAirportOptions.find(airport => airport.id === job.toAirportId);
                if (defaultInboundAirport) this.selectedInboundAirport = defaultInboundAirport;
            }

            // Reset search parameters
            this.lastDepartureTime = undefined;
            await this.loadFlights();
        } else if (job.isFlightJob && job.assignedFlight) {
            this.flightMessage = "Flight already assigned to this job";
        }

        // Skip agent loading if the agent is already assigned
        if (this.isDeliveryJob(job) && !job.assignedAgent) {
            await this.processAgents(job);
        } else if (this.isDeliveryJob(job) && job.assignedAgent) {
            this.agentMessage = "Agent already assigned to this job";
        }

        this.updateUIState(job);
    }

    private displayJobOnMap(job: IDispatchJob): void {
        try {
            if (!job) {
                console.warn('No job provided to displayJobOnMap');
                return;
            }

            if (this.lastMapJobId === job.id && this.cachedMapConfig) {
                return;
            }

            this.cachedMapConfig = this.calculateMapBounds(job);
            this.mapConfig = this.cachedMapConfig;
            this.lastMapJobId = job.id;

        } catch (error) {
            console.error('Error in displayJobOnMap:', error);
            this.toastrService.showErrorToast('An unexpected error occurred displaying this job on the map');
        } finally {
            this.applyScope();
        }
    }

    private calculateMapBounds(job: IDispatchJob) {
        // Early validation
        if (!job || !job.pickupAddress || !job.deliveryAddress) {
            console.warn('Invalid job data in calculateMapBounds', {
                hasJob: !!job,
                hasPickupAddress: job ? !!job.pickupAddress : false,
                hasDeliveryAddress: job ? !!job.deliveryAddress : false
            });

            // Return default map config
            return {
                center: this.appConfig.US_Customer ?
                    this.appConfig.US_Coordinates_Center :
                    this.appConfig.NZ_Coordinates_Center,
                zoom: 7,
                selectedJobIndex: 0
            };
        }

        const pickupCoords: Coordinates = {
            lat: job.pickupAddress?.latitude ?? 0,
            lng: job.pickupAddress?.longitude ?? 0
        };

        const deliveryCoords: Coordinates = {
            lat: job.deliveryAddress?.latitude ?? 0,
            lng: job.deliveryAddress?.longitude ?? 0
        };

        // Calculate the center point between pickup and delivery
        const centerLat = (pickupCoords.lat + deliveryCoords.lat) / 2;
        const centerLng = (pickupCoords.lng + deliveryCoords.lng) / 2;

        // Calculate the appropriate zoom level
        const latDiff = Math.abs(pickupCoords.lat - deliveryCoords.lat);
        const lngDiff = Math.abs(pickupCoords.lng - deliveryCoords.lng);

        // Use the larger difference to determine zoom
        const maxDiff = Math.max(latDiff, lngDiff);

        // Zoom calculation - adjusted for larger distances
        let zoom;
        if (maxDiff > 40) zoom = 3; else if (maxDiff > 20) zoom = 4;
        else if (maxDiff > 10) zoom = 5; else if (maxDiff > 5) zoom = 6;
        else if (maxDiff > 2) zoom = 7; else if (maxDiff > 1) zoom = 8;
        else if (maxDiff > 0.5) zoom = 9; else if (maxDiff > 0.1) zoom = 10; else zoom = 12;

        return {
            center: {
                lat: centerLat,
                lng: centerLng
            },
            zoom: zoom,
            job: {
                id: job.id,
                pickup: pickupCoords,
                delivery: deliveryCoords,
                childJobs: [],
                flight: job.speedId === NationwideControl.FLIGHT_SPEED_ID,
            },
            selectedJobIndex: 0
        };
    }

    isDeliveryJob(job: IDispatchJob): boolean {
        return job.isAgentJob;
    }

    getFlightIcon(job: IDispatchJob): string {
        if (job.isFlightJob) return 'flight';
        if ((job.toAirportId && !job.fromAirportId) && job.isAgentJob) return 'flight_takeoff';
        if ((job.fromAirportId && !job.toAirportId) && job.isAgentJob) return 'flight_land';
        return '';
    }

    private async processAgents(job: IDispatchJob): Promise<void> {
        // Clear existing agents while loading new ones
        this.agentOptions = [];
        this.agentMessage = undefined;
        this.agentsLoading = true;

        try {
            this.agentListPromise = this.nationwideService.getAgentOptions(job.id);
            const result = await this.agentListPromise;

            this.agentOptions = result.agents || [];
            this.agentMessage = result.message ||
                (this.agentOptions.length === 0 ? "No agents available for this job" : undefined);
        } catch (error) {
            console.error("Error fetching agents:", error);
            this.agentMessage = "An error occurred while loading agents. Please try again.";
            this.agentOptions = [];
        } finally {
            this.agentsLoading = false;
            this.updateUIState(job);
            this.applyScope();
        }
    }

    async loadFlights(): Promise<void> {
        if (!this.currentJob) {
            this.flightOptions = [];
            this.flightMessage = "Please select a job to view flight options";
            return;
        }

        if (this.currentJob.assignedFlight) {
            return;
        }

        if (this.flightsLoading) {
            return;
        }

        if (!this.selectedOutboundAirport || !this.selectedInboundAirport) {
            this.flightOptions = [];
            this.flightMessage = "Please select both outbound and inbound airports to search for flights";
            this.updateUIState(this.currentJob);
            return;
        }

        this.flightsLoading = true;
        this.updateUIState(this.currentJob);

        try {
            let departureDate;

            if (this.lastDepartureTime) {
                departureDate = dayjs(this.lastDepartureTime);
            } else if (this.currentJob.booked) {
                departureDate = dayjs(this.currentJob.booked);
            } else if (this.currentJob.pickUpTimeZone) {
                departureDate = dayjs.tz(this.currentJob.pickUpTimeZone.text);
            } else {
                departureDate = dayjs.tz(this.timeZone);
            }

            const airlineId = this.selectedAirline?.id;
            const departureAirportId = this.selectedOutboundAirport?.id;
            const arrivalAirportId = this.selectedInboundAirport?.id;
            const minimumLayoverMinutes = 60;

            this.flightListPromise = this.nationwideService.getFlightOptions(
                this.currentJob.id,
                departureDate,
                this.currentJob.pickUpTimeZone?.text ?? this.timeZone,
                airlineId,
                departureAirportId,
                arrivalAirportId,
                minimumLayoverMinutes,
                this.includeNearbyAirports
            );

            const result = await this.flightListPromise;

            this.flightOptions = result.flights || [];
            this.flightMessage = result.message || (result.flights.length === 0 ?
                "No flights available for the selected criteria" : undefined);
            this.lastDepartureTime = result.lastDepartureTime;
            this.filteredFlightOptions = this.flightOptions;
        } catch (error: any) {
            console.error("Error loading flights:", error);
            const serverMessage = error?.data || error?.message;
            this.flightMessage = serverMessage
                ? `Flight search failed: ${serverMessage}`
                : "An error occurred while loading flights. Please try again.";
            this.flightOptions = [];
        } finally {
            this.flightsLoading = false;
            this.updateUIState(this.currentJob);
            this.applyScope();
        }
    }

    async loadNextDayFlights(): Promise<void> {
        if (!this.currentJob) {
            this.toastrService.showWarningToast("Please select a job to view flight options");
            return;
        }

        if (this.lastDepartureTime) {
            this.lastDepartureTime = this.lastDepartureTime
                .add(1, 'day')
                .startOf('day')
        } else {
            this.lastDepartureTime = this.currentJob.booked
                .add(1, 'day')
                .startOf('day')
        }

        return this.loadFlights();
    }

    async openFlightMoreInfo($event: MouseEvent, flight: IFlightViewModel): Promise<void> {
        await this.flightDetailsDialogService.openFlightDetailsDialog($event, flight);
    }

    async addFlightToJob($event: MouseEvent, flight: IFlightViewModel, job: IDispatchJob): Promise<void> {
        try {
            if (job.assignedFlight) {
                this.toastrService.showErrorToast("A flight is already assigned to this job");
                return;
            }

            const result = await this.flightAgentConfirmationDialogService.flightConfirmationDialog($event, job, flight)
            if (!result.shouldAssign) return;

            this.isDataLoading = true;

            this.flightOptions = [];
            this.showJobHasAssignedFlightMessage = true;
            this.showFlightList = false;
            this.updateUIState(job);

            this.applyScope();

            // Always refresh both NEW and POD lists when assigning a flight
            //  jobs can appear in either list depending on status, so refresh both to avoid stale data
            const listsToRefresh = new Set([JobDataType.NEW, JobDataType.POD]);

            const requestData: AssignFlightToJobRequest = {
                jobId: job.id,
                fromAirportId: this.selectedOutboundAirport?.id,
                toAirportId: this.selectedInboundAirport?.id,
                flightNumber: flight.flightNumber,
                departureDate: formatDateForApiWithTzs(flight.departureTime, flight.departureTimeZone),
                packageReadyTime: result.packageReadyTime ? formatDateForApiWithTzs(result.packageReadyTime, flight.arrivalTimeZone) : undefined,
                packageDeliverByTime: result.packageDeliverByTime ? formatDateForApiWithTzs(result.packageDeliverByTime, flight.arrivalTimeZone) : undefined,
                packageDeliveryNotes: result.packageDeliveryNotes,
                flightSegments: flight.flightSegments.map(transformFlightToDTO)
            };

            // Pass the full flight data including segments to the service
            await this.nationwideService.assignFlightToJob(requestData);

            if (result.awb) {
                await this.DispatchData.updateJobDetail(job.id, JobProperty.ConNote, result.awb ?? '', false);
            }

            await this.getJobList(Array.from(listsToRefresh));

            // Clear current job and fetch fresh data to ensure flight info is loaded
            this.currentJob = undefined;
            this.flightAgentWidgetJob = undefined;
            const freshJobData = await this.DispatchData.getDispatchJobDetail(job.id);
            await this.selectJob(freshJobData);

            const successMessage = `Successfully assigned flight ${flight.flightNumber} to job ${job.jobNo}`;
            this.toastrService.showSuccessToast(successMessage);
        } catch (error) {
            this.handleError(error);
        } finally {
            this.isDataLoading = false;
            this.applyScope();
        }
    }

    async addAgentToJob($event: MouseEvent, agent: IAgent, job: IDispatchJob): Promise<void> {
        const selectedAgent: ISuggestion = {
            id: agent.agentId, text: agent.agentName
        };

        await this.addSelectedAgentToJob($event, selectedAgent, job)
    }

    /**
     * Opens the shared dispatch modal with the picked agent pre-filled. The modal
     * covers Courier / Agent / NP / DFRNT Partner and performs the assignment itself,
     * so this only has to refresh afterwards. The flight pre-check stays here to give
     * the operator the explanatory alert before the modal opens rather than an inline
     * error after they have filled it in.
     */
    async addSelectedAgentToJob($event: MouseEvent, agent: ISuggestion, job: IDispatchJob): Promise<void> {
        try {
            const isAllowedToAssignAgent = await this.DispatchData.canAssignAgentToJob(job.id);
            if (!isAllowedToAssignAgent) {
                await this.$mdDialog.show(
                    this.$mdDialog.alert()
                        .parent(this.$document.parent())
                        .clickOutsideToClose(true)
                        .title('Flight Assignment Required')
                        .textContent('A flight must be assigned to the flight portion before an agent can be assigned.')
                        .ariaLabel('Flight Assignment Alert')
                        .ok('Got it!')
                        .targetEvent($event)
                );
                return;
            }

            await this.openDispatchDialogForJob(job, 'Agent', agent);
        } catch (error) {
            this.handleError(error);
            this.isDataLoading = false;
        } finally {
            this.applyScope();
        }
    }

    /**
     * Shared tail for any assignment made through the modal: refresh the lists and
     * reload the selected job so the widgets pick up the new agent/courier.
     */
    async openDispatchDialogForJob(
        job: IDispatchJob,
        initialType: DispatchType = 'Courier',
        preselected?: ISuggestion,
    ): Promise<void> {
        const outcome = await this.dispatchDialogService.openDispatchDialog(job, initialType, preselected);
        if (!outcome) return;

        this.isDataLoading = true;

        if (outcome.type === 'Agent') {
            this.agentOptions = [];
            this.showJobHasAssignedAgentMessage = true;
            this.showAgentList = false;
            this.updateUIState(job);
        }

        this.applyScope();

        await this.getJobList([JobDataType.NEW, JobDataType.POD]);

        // Clear current job and fetch fresh data so the widgets reload the assignment.
        this.currentJob = undefined;
        this.flightAgentWidgetJob = undefined;
        const freshJobData = await this.DispatchData.getDispatchJobDetail(job.id);
        await this.selectJob(freshJobData);

        this.isDataLoading = false;
        this.toastrService.showSuccessToast(outcome.message);
    }

    private updateDateFilters(dataTypes: JobDataType | JobDataType[] = JobDataType.ALL): void {
        if (!this.dateFilterData?.startDate || !this.dateFilterData?.endDate) return;

        if (dataTypes.includes(JobDataType.NEW)) {
            this.jobFilters.startDate = this.dateFilterData.startDate;
            this.jobFilters.endDate = this.dateFilterData.endDate;
            this.jobFilters.useTime = this.dateFilterData.useTime;
        }
        if (dataTypes.includes(JobDataType.POD)) {
            this.jobPodFilters.startDate = this.dateFilterData.startDate;
            this.jobPodFilters.endDate = this.dateFilterData.endDate;
            this.jobPodFilters.useTime = this.dateFilterData.useTime;
        }
        if (dataTypes.includes(JobDataType.REPRICE)) {
            this.jobRepriceFilters.startDate = this.dateFilterData.startDate;
            this.jobRepriceFilters.endDate = this.dateFilterData.endDate;
            this.jobRepriceFilters.useTime = this.dateFilterData.useTime;
        }
    }

    async getJobList(dataTypes: JobDataType | JobDataType[] = JobDataType.ALL): Promise<void> {
        if (!this.viewsInitialized && this.selectedViews.length === 0) {
            this.selectedViews = this.loadViewsFromStorage();

            // If still no views, add at least one default view
            if (this.selectedViews.length === 0 && this.views.length > 0) {
                this.selectedViews = [this.views[0]];
            }
        }

        const types: JobDataType[] = Array.isArray(dataTypes) ? dataTypes : [dataTypes];

        const requestedTypes = types.includes(JobDataType.ALL)
            ? [JobDataType.NEW, JobDataType.POD, JobDataType.REPRICE]
            : types;

        this.updateDateFilters(requestedTypes);

        const despatchViewIds = this.selectedViews.map(v => v.id);

        // Push updated params to React — React Query handles the fetch
        if (window.ReactNationwideJobList) {
            if (requestedTypes.includes(JobDataType.NEW)) {
                window.ReactNationwideJobList.updateSearchParams('newJobs', {
                    order: this.jobFilters.order ?? 'time',
                    orderDirection: this.jobFilters.orderDirection ?? 'asc',
                    startDate: this.jobFilters.startDate,
                    endDate: this.jobFilters.endDate,
                    useTime: this.jobFilters.useTime,
                    searchText: this.jobFilters.searchText,
                    isInternal: ClientInternal,
                    despatchViewIds,
                    page: this.jobFilters.page ?? 0,
                    pageSize: this.jobFilters.pageSize ?? 50,
                });
                window.ReactNationwideJobList.refresh('newJobs');
            }
            if (requestedTypes.includes(JobDataType.POD)) {
                window.ReactNationwideJobList.updateSearchParams('podJobs', {
                    order: this.jobPodFilters.order ?? 'time',
                    orderDirection: this.jobPodFilters.orderDirection ?? 'asc',
                    startDate: this.jobPodFilters.startDate,
                    endDate: this.jobPodFilters.endDate,
                    useTime: this.jobPodFilters.useTime,
                    searchText: this.jobPodFilters.searchText,
                    isInternal: ClientInternal,
                    despatchViewIds,
                    page: this.jobPodFilters.page ?? 0,
                    pageSize: this.jobPodFilters.pageSize ?? 50,
                });
                window.ReactNationwideJobList.refresh('podJobs');
            }
            if (requestedTypes.includes(JobDataType.REPRICE)) {
                window.ReactNationwideJobList.updateSearchParams('repriceJobs', {
                    order: this.jobRepriceFilters.order ?? 'time',
                    orderDirection: this.jobRepriceFilters.orderDirection ?? 'asc',
                    startDate: this.jobRepriceFilters.startDate,
                    endDate: this.jobRepriceFilters.endDate,
                    useTime: this.jobRepriceFilters.useTime,
                    searchText: this.jobRepriceFilters.searchText,
                    isInternal: ClientInternal,
                    despatchViewIds,
                    page: this.jobRepriceFilters.page ?? 0,
                    pageSize: this.jobRepriceFilters.pageSize ?? 50,
                });
                window.ReactNationwideJobList.refresh('repriceJobs');
            }
        }

        this.applyScope();
    }

    async openFileAttachmentDialog($event: MouseEvent, job: IDispatchJob) {
        await this.jobFileUploadDialogService.openJobFileUploadDialog($event, job);
    }

    async showAccessorialChargesMenu($event: MouseEvent, job: IDispatchJob): Promise<void> {
        await this.accessorialChargesDialogService.showAccessorialChargesDialog($event, job);
    }

    async getData(): Promise<void> {
        // Clear data at once
        this.jobList = [];
        this.jobListPOD = [];
        this.currentJob = undefined;
        this.flightAgentWidgetJob = undefined;

        try {
            await this.getJobList(JobDataType.ALL);
        } catch (error) {
            console.error("Error in getData:", error);
        }
    }

    private handleError(error: any) {
        if (!error) {
            // User canceled the dialog
        } else {
            console.error('Error assigning flight to job:', error);
        }
    }

    async createEvent(_$event: MouseEvent, job: IDispatchJob) {
        await openAddEventDialog({
            job: {
                id: job.id,
                jobNo: job.jobNo,
                client: job.client ?? '',
                clientId: job.clientId,
            },
            toastService: {
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
            },
        });
    }

    // Tasks
    getTasksStatusCount(statusType: string): number {
        return this.tasksService.getTasksStatusCount(this.tasks, statusType);
    }

    async filterTasksByStatus(statusType: string): Promise<void> {
        this.tasksFilter = statusType;
        await this.loadTasks(statusType);
    }

    async loadTasks(filterType: string = this.tasksFilter): Promise<void> {
        // Don't load tasks if no job is selected
        if (!this.currentJob?.id) {
            this.tasks = [];
            this.filteredTasks = [];
            return;
        }

        try {
            this.tasksLoading = true;

            const filterRequest = this.tasksService.buildFilterRequest(
                filterType,
                this.currentJob.id,
                this.staffFilter,
                this.eventTypeFilter
            );

            try {
                this.tasks = await this.tasksService.loadTasks(filterRequest);
                this.filteredTasks = this.tasks;
            } catch (serviceError) {
                console.error("Service error getting tasks:", serviceError);
                this.toastrService.showErrorToast("Failed to load tasks");
                this.tasks = [];
                this.filteredTasks = [];
            }

            this.tasksLoading = false;
        } catch (error) {
            console.error("Error loading tasks:", error);
            this.toastrService.showErrorToast("Error loading tasks");
            this.tasksLoading = false;
        } finally {
            this.applyScope();
        }
    }

    async filterTasks(filterType: string): Promise<void> {
        this.tasksFilter = filterType;
        await this.loadTasks(filterType);
    }

    async selectTaskJobDetail(task: ITask): Promise<void> {
        this.currentSupport = task;

        if (!this.validateJobId(task)) {
            return;
        }

        try {
            if (!this.jobList || !this.jobListPOD || !this.jobListReprice) return;

            // Use TasksService to find a job in local lists first
            let attachedJob = this.tasksService.findTaskJobInLists(task.jobId, [
                {list: this.jobList, name: 'jobList'},
                {list: this.jobListPOD, name: 'jobListPOD'},
                {list: this.jobListReprice, name: 'jobListReprice'}
            ]);

            // If not found in local lists, fetch from database
            if (!attachedJob) {
                attachedJob = await this.DispatchData.getDispatchJobDetail(task.jobId);
            }

            if (!attachedJob) {
                this.toastrService.showWarningToast("This task has no job attached");
                console.warn('[selectTaskJobDetail] No job found for jobId:', task.jobId);
                return;
            }

            await this.selectJob(attachedJob);
            this.updateCurrentSelection(attachedJob.jobNo);
        } catch (error) {
            this.handleError(error);
        }
    }

    private validateJobId(task: ITask): boolean {
        return this.tasksService.validateTaskJobId(task, (message) => {
            this.toastrService.showWarningToast(message);
        });
    }

    private findJobInLocalLists(jobId: number): IDispatchJob | undefined {
        return this.jobList?.find((job) => job.id === jobId) ||
            this.jobListPOD?.find((job) => job.id === jobId) ||
            this.jobListReprice?.find((job) => job.id === jobId);
    }

    private updateCurrentSelection(jobNo: string): void {
        this.currentSelection = ` for Job ${jobNo}`;
    }

    async filterFlightsByAirline(selectedAirline?: ISuggestion): Promise<void> {
        if (!this.currentJob) return;

        // Store the airline selection\
        this.selectedAirline = selectedAirline;

        // Reset search
        this.lastDepartureTime = undefined;

        // Call loadFlights which will use the updated selected airline
        await this.loadFlights();
    }

    async onToggleNearbyAirportsReact(value: boolean): Promise<void> {
        if (!this.currentJob) return;

        this.includeNearbyAirports = value;

        // Reset search so the toggle re-queries from the start of the window
        this.lastDepartureTime = undefined;
        await this.loadFlights();
    }

    async onOutboundAirportSelectionChanged(): Promise<void> {
        try {
            // Reset search when changing airport filter
            this.lastDepartureTime = undefined;
            await this.loadFlights();
        } catch (error) {
            console.error('Error loading flights after airport change:', error);
        }
    }

    async onInboundAirportSelectionChanged(): Promise<void> {
        try {
            // Reset search when changing airport filter
            this.lastDepartureTime = undefined;
            await this.loadFlights();
        } catch (error) {
            console.error('Error loading flights after airport change:', error);
        } finally {
            this.applyScope();
        }
    }

    private markJobReadStatus(jobId: number, isRead: boolean): void {
        const updateJobList = (list?: IDispatchJob[]) => {
            if (!list) return;

            const jobIndex = list.findIndex((job) => job.id === jobId);
            if (jobIndex !== -1) {
                list[jobIndex].hasBeenRead = isRead;
            }
        };

        updateJobList(this.jobList);
        updateJobList(this.jobListPOD);
        updateJobList(this.jobListReprice);

        this.applyScope();
    }

    async refreshJobLists(currentJobId?: number): Promise<void> {
        try {
            await this.getJobList(JobDataType.ALL);

            if (currentJobId) {
                const updatedJob = this.findJobInLocalLists(currentJobId);

                if (updatedJob) {
                    this.currentJob = updatedJob;
                } else {
                    this.currentJob = undefined;
                    this.flightAgentWidgetJob = undefined;
                    this.toastrService.showWarningToast("Job list has been refreshed, but the selected job is no longer available on this page");
                }
            }
        } catch (error) {
            console.error("Error refreshing job lists:", error);
        } finally {
            this.applyScope();
        }
    }

    formatAirportCodeForDropdown(text: string): string {
        if (!text) return '';

        const spaceIndex = text.indexOf(' ');
        if (spaceIndex === -1) return text;
        return text.substring(0, spaceIndex + 1);
    }

    getConnectionTime(firstSegment: IFlightSegment, secondSegment: IFlightSegment): string {
        if (!firstSegment || !secondSegment) return '';

        // Calculate time difference in minutes
        const firstArrival = dayjs(firstSegment.arrivalTime);
        const secondDeparture = dayjs(secondSegment.departureTime);
        const diffMinutes = secondDeparture.diff(firstArrival, 'minutes');

        // Format as hours and minutes
        const hours = Math.floor(diffMinutes / 60);
        const mins = diffMinutes % 60;

        if (hours > 0) {
            return hours + 'h ' + (mins < 10 ? '0' + mins : mins) + 'm';
        } else {
            return mins + 'm';
        }
    }

    async openAgentSearchDialog($event: MouseEvent, job: IDispatchJob): Promise<void> {
        try {
            const url = "nationwideJob/GetAllAgentsSearch";
            const selectedAgent = await this.autoCompleteDialogService.showAutocompleteDialog($event, url, "Search all Agents", "Agent", "Agents", undefined);
            if (!selectedAgent) return;

            await this.addSelectedAgentToJob($event, selectedAgent, job);
        } catch (error) {
            this.handleError(error);
        }
    }

    private updateUIState(job?: IDispatchJob): void {
        // Reset all flags first
        this.resetAllFlags();

        // Use a provided job or fell back to the currentJob
        const activeJob = job || this.currentJob;

        // Determine if this is a delivery job
        this.isDeliveryJobType = activeJob ? this.isDeliveryJob(activeJob) : false;

        if (!this.isDeliveryJobType) {
            // Handle flight job UI states
            if (!activeJob) {
                this.showNoJobSelectedMessage = true;
            } else if (activeJob.assignedFlight) {
                this.showJobHasAssignedFlightMessage = true;
            } else if (!activeJob.toAirportId || !activeJob.fromAirportId) {
                this.showMissingAirportInfoMessage = true;
            } else if (!this.flightsLoading && (!this.flightOptions || this.flightOptions.length === 0)) {
                this.showNoFlightsAvailableMessage = true;
            } else if (!this.flightsLoading && this.flightOptions && this.flightOptions.length > 0) {
                this.showFlightList = true;
            }
        } else {
            // Handle delivery job UI states
            if (!activeJob) {
                this.showNoAgentJobSelectedMessage = true;
            } else if (activeJob.assignedAgent) {
                this.showJobHasAssignedAgentMessage = true;
            } else if (!this.agentsLoading && (!this.agentOptions || this.agentOptions.length === 0)) {
                this.showNoAgentsAvailableMessage = true;
            } else if (!this.agentsLoading && this.agentOptions && this.agentOptions.length > 0) {
                this.showAgentList = true;
            }
        }
    }

    private resetAllFlags(): void {
        // Flight section flags
        this.showNoJobSelectedMessage = false;
        this.showJobHasAssignedFlightMessage = false;
        this.showMissingAirportInfoMessage = false;
        this.showNoFlightsAvailableMessage = false;
        this.showFlightList = false;

        // Agent section flags
        this.showNoAgentJobSelectedMessage = false;
        this.showJobHasAssignedAgentMessage = false;
        this.showNoAgentsAvailableMessage = false;
        this.showAgentList = false;
    }

    async refreshAction(boxName: string): Promise<void> {
        switch (boxName) {
            case NationwideBoxes.Tasks:
                await this.loadTasks();
                break;
            case NationwideBoxes.NewJobs:
                window.ReactNationwideJobList?.refresh('newJobs');
                break;
            case NationwideBoxes.RepriceJobs:
                window.ReactNationwideJobList?.refresh('repriceJobs');
                break;
            case NationwideBoxes.PodJobs:
                window.ReactNationwideJobList?.refresh('podJobs');
                break;
            case NationwideBoxes.Map:
                this.refreshMap();
                break;
            case NationwideBoxes.FlightAgents:
                if (this.currentJob) {
                    await this.handleJobSelectionRelatedData(this.currentJob);
                }
                break;
            case NationwideBoxes.JobDetail: {
                if (!this.currentJob?.id) return;

                // Clear job
                const jobIdToRefresh = this.currentJob?.id;
                this.currentJob = undefined;
                this.flightAgentWidgetJob = undefined;

                // Reselect to trigger refresh
                const job = await this.DispatchData.getDispatchJobDetail(jobIdToRefresh);
                await this.selectJob(job);
                break;
            }
            default:
                break;
        }
    }

    async addStopToJob($event: MouseEvent, job: IDispatchJob): Promise<void> {
        const setLoadingState = (isLoading: boolean) => {
            this.isDataLoading = isLoading;
            this.applyScope();
        };

        try {
            setLoadingState(true);

            const newStopJobId = await this.jobAddStopService.addNewStop(job, $event);
            if (!newStopJobId) {
                setLoadingState(false);
                this.toastrService.showWarningToast("Failed to add stop to job");
                return;
            }

            const newStopJob = await this.DispatchData.getDispatchJobDetail(newStopJobId);
            await this.selectJob(newStopJob);
        } catch (error: unknown) {
            console.error('Error in addStopToJob:', error);
            this.toastrService.showErrorToast(
                error instanceof Error && error.message?.includes('loading') ? 'Error loading new stop job details' : 'Failed to add stop to job'
            );
        } finally {
            setLoadingState(false);
        }
    }

    async openAgentMoreInfo(_$event: MouseEvent, agent: IAgent): Promise<void> {
        await openAgentInfoDialog({
            agentId: agent.agentId,
        });
    }

    // React wrapper methods for FlightAgentDataTable component
    onFlightSearchChange(searchText: string): void {
        this.flightSearchText = searchText;
        this.filterFlights();
        this.applyScope();
    }

    async onOutboundAirportSelectionChangedReact(airport: IAirportSuggestion | null): Promise<void> {
        this.selectedOutboundAirport = airport ?? undefined;
        await this.onOutboundAirportSelectionChanged();
    }

    async onInboundAirportSelectionChangedReact(airport: IAirportSuggestion | null): Promise<void> {
        this.selectedInboundAirport = airport ?? undefined;
        await this.onInboundAirportSelectionChanged();
    }

    async addFlightToJobReact($event: MouseEvent | undefined, flight: IFlightViewModel): Promise<void> {
        const job = this.flightAgentWidgetJob ?? this.currentJob;
        if (!job) return;
        const mouseEvent = $event || new MouseEvent('click');
        await this.addFlightToJob(mouseEvent, flight, job);
    }

    async addAgentToJobReact($event: MouseEvent | undefined, agent: IAgent): Promise<void> {
        const job = this.flightAgentWidgetJob ?? this.currentJob;
        if (!job) return;
        const mouseEvent = $event || new MouseEvent('click');
        await this.addAgentToJob(mouseEvent, agent, job);
    }

    async sendQuoteRequestReact($event: MouseEvent | undefined, agent: IAgent): Promise<void> {
        const job = this.flightAgentWidgetJob ?? this.currentJob;
        if (!job) return;
        const mouseEvent = $event || new MouseEvent('click');
        await this.sendQuoteRequest(mouseEvent, agent, job);
    }

    async openAgentSearchDialogReact($event: MouseEvent | undefined): Promise<void> {
        const job = this.flightAgentWidgetJob ?? this.currentJob;
        if (!job) return;
        const mouseEvent = $event || new MouseEvent('click');
        await this.openAgentSearchDialog(mouseEvent, job);
    }

    async openRecoveryAgentDialogReact($event: MouseEvent | undefined): Promise<void> {
        const job = this.flightAgentWidgetJob ?? this.currentJob;
        if (!job) return;
        const mouseEvent = $event || new MouseEvent('click');
        await this.openRecoveryAgentDialog(mouseEvent, job);
    }

    formatMinutesToTimeReact(minutes: number): string {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0) {
            return `${hours}h ${mins < 10 ? '0' + mins : mins}m`;
        }
        return `${mins}m`;
    }

    refreshMap(): void {
        if (this.currentJob) {
            this.displayJobOnMap(this.currentJob);
        }
    }

    async openMessagingDialog($event: MouseEvent): Promise<void> {
        await this.messagingDialogService.openMessagingDialog($event);
    }

    private async getUnreadMessageCount(): Promise<void> {
        this.unReadMessageCount = await this.messagingDialogService.getUnreadMessageCount();
        this.applyScope();
    }

    async filterByStaff(selectedStaff: string | ISuggestion): Promise<void> {
        if (typeof selectedStaff === 'string') {
            this.staffFilter = selectedStaff;
        } else {
            this.staffFilter = selectedStaff.id?.toString() || 'all';
        }

        this.tasksService.saveStaffFilter(this.staffFilter, this.nationwidePageId);
        await this.loadTasks();
    }


    async filterBySupportType(selectedType: string | ISuggestion): Promise<void> {
        if (typeof selectedType === 'string') {
            this.eventTypeFilter = selectedType;
        } else {
            this.eventTypeFilter = selectedType.id?.toString() || 'all';
        }

        this.tasksService.saveEventTypeFilter(this.eventTypeFilter, this.nationwidePageId);
        await this.loadTasks();
    }

    getActiveTaskFilterNames(): string {
        return this.tasksService.getActiveFilterNames(
            this.staffFilter,
            this.eventTypeFilter,
            this.staffList,
            this.eventTypesList
        );
    }

    handleJobSelection(job: IDispatchJob): Promise<void> {
        return this.selectJob(job);
    }

    async handleJobAction(action: string, job: IDispatchJob, _params?: any): Promise<void> {
        switch (action) {
            case 'restore':
                return await this.restoreJob(job);
            case 'reallocate':
                return await this.reAllocateJobs(job);
            default:
                console.warn(`Unknown job action: ${action}`);
        }
    }

    async openRecoveryAgentDialog(_$event: MouseEvent, job: IDispatchJob): Promise<void> {
        await openRecoveryAgentManagementDialog({jobId: job.id});
    }

    initRefreshIntervalOptions(): void {
        const disabledOption: ISuggestion = {id: 0, text: "Disabled"};
        this.selectedRefreshInterval = disabledOption;

        const options: ISuggestion[] = [
            disabledOption
        ];

        const maxSeconds = 15 * 60; // 15 minutes in seconds

        for (let seconds = 30; seconds <= maxSeconds; seconds += 30) {
            options.push({
                id: seconds,
                text: NationwideControl.formatDuration(seconds)
            });
        }

        this.refreshIntervalOptions = options;
    }

    private static formatDuration(seconds: number): string {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        if (minutes === 0) {
            return `${seconds} seconds`;
        } else if (remainingSeconds === 0) {
            return minutes === 1 ? `${minutes} min` : `${minutes} mins`;
        } else {
            const minText = minutes === 1 ? 'min' : 'mins';
            return `${minutes} ${minText} ${remainingSeconds} seconds`;
        }
    }

    onRefreshIntervalChange(selectedInterval: ISuggestion): void {

        this.selectedRefreshInterval = selectedInterval;

        if (this.selectedRefreshInterval) {
            localStorage.setItem(this.refreshDurationIntervalKey, this.selectedRefreshInterval.id.toString());
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

        this.isAutoRefreshEnabled = true;

        this.refreshIntervalPromise = this.registerInterval(async () => {
            if (this.isAutoRefreshEnabled) {
                try {
                    await this.getData();

                    // Also refresh tasks if a job is selected
                    if (this.currentJob?.id) {
                        await this.loadTasks();
                    }
                } catch (error) {
                    console.error('Error during auto refresh:', error);
                }
            }
        }, this.selectedRefreshInterval.id * 1000);

        this.applyScope();
    }

    private stopAutoRefresh(): void {
        this.isAutoRefreshEnabled = false;

        if (this.refreshIntervalPromise) {
            this.cancelInterval(this.refreshIntervalPromise);
            this.refreshIntervalPromise = undefined;
        }
    }


    getCurrentRefreshIntervalText(): string {
        if (!this.selectedRefreshInterval || this.selectedRefreshInterval.id === 0) {
            return 'Auto refresh disabled';
        }
        return `Auto refresh: ${this.selectedRefreshInterval.text}`;
    }

    isAutoRefreshActive(): boolean {
        return this.isAutoRefreshEnabled &&
            !!this.selectedRefreshInterval &&
            this.selectedRefreshInterval.id > 0;
    }

    filterFlights(): void {
        if (!this.flightOptions) {
            this.filteredFlightOptions = [];
            return;
        }

        if (!this.flightSearchText || this.flightSearchText.trim() === '') {
            this.filteredFlightOptions = this.flightOptions;
            return;
        }

        const searchTerm = this.flightSearchText.toLowerCase().trim();

        this.filteredFlightOptions = this.flightOptions.filter(flight =>
            flight.flightNumber?.toLowerCase().includes(searchTerm) ||
            flight.airline?.toLowerCase().includes(searchTerm) ||
            flight.departureAirport?.toLowerCase().includes(searchTerm) ||
            flight.arrivalAirport?.toLowerCase().includes(searchTerm) ||
            flight.aircraft?.toLowerCase().includes(searchTerm)
        );
    }

    async refreshDataTimeSpan(dateFilterData: IDateFilterData) {
        this.dateFilterData = dateFilterData;

        this.saveDateFilterToStorage();
        await this.getJobList();
    }

    private saveDateFilterToStorage(): void {
        if (!this.dateFilterData) return;

        try {
            localStorage.setItem(this.DateFilterKey, JSON.stringify(this.dateFilterData));
        } catch (error) {
            console.error('Error saving date filter to storage:', error);
        }
    }

    private loadDateFilterFromStorage(): void {
        try {
            const savedDateFilter = localStorage.getItem(this.DateFilterKey);
            if (savedDateFilter) {
                const parsedDateFilter = JSON.parse(savedDateFilter);
                const startDate = dayjs(parsedDateFilter.startDate);
                let endDate = dayjs(parsedDateFilter.endDate);

                // If "all time" is selected (startDate is epoch), always recalculate
                // endDate to be 24 hours from now to include future jobs
                if (startDate.valueOf() === 0) {
                    endDate = dayjs().tz(this.timeZone).add(24, 'hours');
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

    async handleJobDispatch(job: IDispatchJob, courierId: number) {
        if (this.isUsCustomer) {
            this.toastrService.showWarningToast("Courier dispatch is not supported for US customers");
            return false;
        }

        try {
            await this.dispatchJobService.dispatchJobs(courierId, [job]);
            const courier = await this.DispatchData.getCourierById(courierId);

            // Update the job's assigned courier display
            job.assignedCourier = {id: courier.courierId, text: courier.name};

            this.toastrService.showSuccessToast(`${job.jobNo} dispatched to ${courier.name}`);
        } catch (error) {
            console.error("Error in dispatch:", error);
        }
    }

    // Scroll job data
    private async handleLoadMore(
        filters: IJobQueryParams,
        fetchFn: (params: IJobQueryParams, internal: boolean, views: DfrntPageViewModel[]) => Promise<IJobSearchResult>,
        page: number,
        pageSize: number,
        errorMessage: string
    ): Promise<{ jobs: IDispatchJob[], totalCount: number, hasMore: boolean }> {
        try {
            filters.useTime = this.dateFilterData.useTime;

            const result = await fetchFn.call(
                this.nationwideService,
                { ...filters, page, pageSize },
                ClientInternal,
                this.selectedViews
            );

            return {
                jobs: result.jobs || [],
                totalCount: result.totalCount || 0,
                hasMore: result.hasMore || false
            };
        } catch (error) {
            console.error(errorMessage, error);
            this.toastrService.showErrorToast(errorMessage);
            throw error;
        }
    }

    async handleLoadMoreNationwideJobs(page: number, pageSize: number) {
        return this.handleLoadMore(this.jobFilters, this.nationwideService.getNationwideJobsNew, page, pageSize, 'Failed to load more jobs');
    }

    async handleLoadMorePodJobs(page: number, pageSize: number) {
        return this.handleLoadMore(this.jobPodFilters, this.nationwideService.getNationwideJobsPOD, page, pageSize, 'Failed to load more POD jobs');
    }

    async handleLoadMoreRepriceJobs(page: number, pageSize: number) {
        return this.handleLoadMore(this.jobRepriceFilters, this.nationwideService.getNationwideJobsReprice, page, pageSize, 'Failed to load more reprice jobs');
    }

    async updateJobSearchText(searchText: string, jobListType: JobListType): Promise<void> {
        switch (jobListType) {
            case JobListType.NationwideJobList:
                this.jobFilters.searchText = searchText || '';
                await this.getJobList([JobDataType.NEW]);
                break;

            case JobListType.NationwidePodJobList:
                this.jobPodFilters.searchText = searchText || '';
                await this.getJobList([JobDataType.POD]);
                break;

            case JobListType.NationwideRepriceJobList:
                this.jobRepriceFilters.searchText = searchText || '';
                await this.getJobList([JobDataType.REPRICE]);
                break;
        }
    }

    async openSettingsDialog($event: MouseEvent): Promise<void> {
        if (!this.boxes) return;

        try {
            const result = await this.dashboardSettingsDialog.openSettingsDialog(
                $event,
                AppPage.Domestic,
                this.currentLayoutName ?? 'Default',
                this.boxes,
                this.selectedRefreshInterval
            );

            if (!result) return;

            // Panel visibility now lives in the Customize Panels dialog
            // (openCustomizePanelsDialog); the gear no longer returns boxes.
            if (result.aiEnabled !== undefined) {
                setAiEnabled(result.aiEnabled);
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

    // ── React Nationwide Job List Integration ─────────────────────────

    private mountNationwideReactJobList(instanceId: string, containerId: string, config: MountJobListConfig): void {
        if (!window.ReactNationwideJobList) {
            console.warn('[NationwideController] ReactNationwideJobList not loaded');
            return;
        }

        let attempts = 0;
        const maxAttempts = 100; // 100 × 50ms = 5s

        const tryMount = () => {
            const container = document.getElementById(containerId);
            if (!container) {
                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(tryMount, 50);
                } else {
                    console.error(`[NationwideController] ${containerId} not found after 5s`);
                }
                return;
            }

            window.ReactNationwideJobList!.mount(instanceId, containerId, config);
            this.reactNationwideMounted.add(instanceId);
        };

        tryMount();
    }

    private mountAllNationwideReactJobLists(): void {
        if (!window.ReactNationwideJobList) {
            console.warn('[NationwideController] ReactNationwideJobList not loaded');
            return;
        }

        const showToast = (message: string, type: 'success' | 'warning' | 'error' | 'info') => {
            switch (type) {
                case 'success': this.toastrService.showSuccessToast(message); break;
                case 'warning': this.toastrService.showWarningToast(message); break;
                case 'error': this.toastrService.showErrorToast(message); break;
                case 'info': this.toastrService.showInfoToast(message); break;
            }
        };

        const sharedConfig: Partial<MountJobListConfig> = {
            showToast,
            isUsCustomer: this.isUsCustomer,
            appPage: AppPage.Domestic,
            onJobSelect: async (job: DispatchJob) => {
                await this.selectJob(job as IDispatchJob);
                this.applyScope();
            },
            onJobDispatch: async (job, courierId) => {
                await this.handleJobDispatch(job as any, courierId);
                this.applyScope();
            },
            onAddStop: async (job: DispatchJob) => {
                await this.jobAddStopService.addNewStop(job as IDispatchJob);
            },
        };

        const baseNwParams = {
            isInternal: ClientInternal,
            despatchViewIds: this.selectedViews.map(v => v.id),
            page: 0,
            pageSize: 50,
        };

        // New Jobs
        this.mountNationwideReactJobList('newJobs', 'react-nationwide-new-jobs', {
            ...sharedConfig,
            storagePrefix: 'nwNewJobList',
            fetchConfig: {
                fetchFn: fetchNationwideJobsNew,
                queryKeyFn: (params) => queryKeys.nationwide.newJobs(params),
                initialParams: {
                    ...baseNwParams,
                    order: this.jobFilters.order ?? 'time',
                    orderDirection: this.jobFilters.orderDirection ?? 'asc',
                    startDate: this.dateFilterData.startDate,
                    endDate: this.dateFilterData.endDate,
                    useTime: this.dateFilterData.useTime,
                    searchText: this.jobFilters.searchText,
                },
            },
            onRefresh: () => {
                // React handles data refresh via React Query
            },
            onSearchChange: async (searchText: string) => {
                await this.updateJobSearchText(searchText, JobListType.NationwideJobList);
            },
        } as MountJobListConfig);

        // Awaiting POD
        this.mountNationwideReactJobList('podJobs', 'react-nationwide-pod-jobs', {
            ...sharedConfig,
            storagePrefix: 'nwPodJobList',
            fetchConfig: {
                fetchFn: fetchNationwideJobsPod,
                queryKeyFn: (params) => queryKeys.nationwide.podJobs(params),
                initialParams: {
                    ...baseNwParams,
                    order: this.jobPodFilters.order ?? 'time',
                    orderDirection: this.jobPodFilters.orderDirection ?? 'asc',
                    startDate: this.dateFilterData.startDate,
                    endDate: this.dateFilterData.endDate,
                    useTime: this.dateFilterData.useTime,
                    searchText: this.jobPodFilters.searchText,
                },
            },
            onRefresh: () => {
                // React handles data refresh via React Query
            },
            onSearchChange: async (searchText: string) => {
                await this.updateJobSearchText(searchText, JobListType.NationwidePodJobList);
            },
        } as MountJobListConfig);

        // Reprice
        this.mountNationwideReactJobList('repriceJobs', 'react-nationwide-reprice-jobs', {
            ...sharedConfig,
            storagePrefix: 'nwRepriceJobList',
            fetchConfig: {
                fetchFn: fetchNationwideJobsReprice,
                queryKeyFn: (params) => queryKeys.nationwide.repriceJobs(params),
                initialParams: {
                    ...baseNwParams,
                    order: this.jobRepriceFilters.order ?? 'time',
                    orderDirection: this.jobRepriceFilters.orderDirection ?? 'asc',
                    startDate: this.dateFilterData.startDate,
                    endDate: this.dateFilterData.endDate,
                    useTime: this.dateFilterData.useTime,
                    searchText: this.jobRepriceFilters.searchText,
                },
            },
            onRefresh: () => {
                // React handles data refresh via React Query
            },
            onSearchChange: async (searchText: string) => {
                await this.updateJobSearchText(searchText, JobListType.NationwideRepriceJobList);
            },
        } as MountJobListConfig);
    }

    private updateNationwideReactJobList(instanceId: string, _jobs: IDispatchJob[], _totalCount: number): void {
        if (!window.ReactNationwideJobList) return;

        if (this.reactNationwideMounted.has(instanceId)) {
            // React manages its own data via fetchConfig — just trigger a refresh
            window.ReactNationwideJobList.refresh(instanceId);
        } else {
            // Not yet mounted (box may have just expanded) — re-mount with fetchConfig
            const configMap: Record<string, { containerId: string; storagePrefix: string; fetchFn: any; queryKeyFn: any; filters: any; onSearchChange: (searchText: string) => void }> = {
                newJobs: {
                    containerId: 'react-nationwide-new-jobs',
                    storagePrefix: 'nwNewJobList',
                    fetchFn: fetchNationwideJobsNew,
                    queryKeyFn: (params: any) => queryKeys.nationwide.newJobs(params),
                    filters: this.jobFilters,
                    onSearchChange: async (searchText: string) => {
                        await this.updateJobSearchText(searchText, JobListType.NationwideJobList);
                    },
                },
                podJobs: {
                    containerId: 'react-nationwide-pod-jobs',
                    storagePrefix: 'nwPodJobList',
                    fetchFn: fetchNationwideJobsPod,
                    queryKeyFn: (params: any) => queryKeys.nationwide.podJobs(params),
                    filters: this.jobPodFilters,
                    onSearchChange: async (searchText: string) => {
                        await this.updateJobSearchText(searchText, JobListType.NationwidePodJobList);
                    },
                },
                repriceJobs: {
                    containerId: 'react-nationwide-reprice-jobs',
                    storagePrefix: 'nwRepriceJobList',
                    fetchFn: fetchNationwideJobsReprice,
                    queryKeyFn: (params: any) => queryKeys.nationwide.repriceJobs(params),
                    filters: this.jobRepriceFilters,
                    onSearchChange: async (searchText: string) => {
                        await this.updateJobSearchText(searchText, JobListType.NationwideRepriceJobList);
                    },
                },
            };

            const cfg = configMap[instanceId];
            if (!cfg) return;

            const showToast = (message: string, type: 'success' | 'warning' | 'error' | 'info') => {
                switch (type) {
                    case 'success': this.toastrService.showSuccessToast(message); break;
                    case 'warning': this.toastrService.showWarningToast(message); break;
                    case 'error': this.toastrService.showErrorToast(message); break;
                    case 'info': this.toastrService.showInfoToast(message); break;
                }
            };

            this.mountNationwideReactJobList(instanceId, cfg.containerId, {
                showToast,
                isUsCustomer: this.isUsCustomer,
                appPage: AppPage.Domestic,
                storagePrefix: cfg.storagePrefix,
                fetchConfig: {
                    fetchFn: cfg.fetchFn,
                    queryKeyFn: cfg.queryKeyFn,
                    initialParams: {
                        order: cfg.filters.order ?? 'time',
                        orderDirection: cfg.filters.orderDirection ?? 'asc',
                        startDate: this.dateFilterData.startDate,
                        endDate: this.dateFilterData.endDate,
                        useTime: this.dateFilterData.useTime,
                        searchText: cfg.filters.searchText,
                        isInternal: ClientInternal,
                        despatchViewIds: this.selectedViews.map(v => v.id),
                        page: 0,
                        pageSize: 50,
                    },
                },
                onJobSelect: async (job: DispatchJob) => {
                    await this.selectJob(job as IDispatchJob);
                    this.applyScope();
                },
                onJobDispatch: async (job: DispatchJob, courierId: number) => {
                    await this.handleJobDispatch(job as any, courierId);
                    this.applyScope();
                },
                onAddStop: async (job: DispatchJob) => {
                    await this.jobAddStopService.addNewStop(job as any);
                },
                onRefresh: () => {
                    // React handles data refresh via React Query
                },
                onSearchChange: cfg.onSearchChange,
            });
        }
    }

    private remountNationwideReactJobList(boxName: string): void {
        const boxToInstanceMap: Record<string, { instanceId: string; jobs: IDispatchJob[]; totalCount: number }> = {
            [NationwideBoxes.NewJobs]: { instanceId: 'newJobs', jobs: this.jobList || [], totalCount: this.totalJobCount },
            [NationwideBoxes.PodJobs]: { instanceId: 'podJobs', jobs: this.jobListPOD || [], totalCount: this.totalPodCount },
            [NationwideBoxes.RepriceJobs]: { instanceId: 'repriceJobs', jobs: this.jobListReprice || [], totalCount: this.totalRepriceCount },
        };

        const mapping = boxToInstanceMap[boxName];
        if (!mapping) return;

        // Clear from mounted set so updateNationwideReactJobList will re-mount
        this.reactNationwideMounted.delete(mapping.instanceId);
        if (window.ReactNationwideJobList) {
            window.ReactNationwideJobList.unmount(mapping.instanceId);
        }

        // Delay to allow ng-include to render the container
        setTimeout(() => {
            this.updateNationwideReactJobList(mapping.instanceId, mapping.jobs, mapping.totalCount);
        }, 100);
    }
}

const NationwideComponent: angular.IComponentOptions = {
    template: require('./nationwide.template.html'),
    controller: NationwideControl,
    controllerAs: "ctrl",
    bindings: {
        jobId: '<'
    }
}
export default NationwideComponent;
