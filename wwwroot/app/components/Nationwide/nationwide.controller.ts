import './nationwide.styles.less';
import NationwideService from "./nationwide.service";
import ToastrService from "../../services/toastr.service";
import DispatchCoreService from "../../services/dispatch-core.service";
import {AppPages} from "../../enums/app-pages.enum";
import {IAppConfig} from "../../interfaces/app-config.interface";
import DispatchExecutorService from "../../services/dispatch-executor.service";
import {IAgent, IDispatchJob, IJob, IJobQueryParams, ISuggestion} from "../../interfaces/job.interface";
import {Coordinates} from "../overview/overview.interfaces";
import {AssignFlightToJobRequest, IFlightViewModel, StatusChangeEvent} from "./nationwide.interfaces";
import {IBox, IColumn, ILayout} from "../../interfaces/layout.interfaces";
import BaseController from "../base-controller";
import JobFileUploadDialogService from "../dialogs/job-file-upload-dialog/job-file-upload-dialog.service";
import JobDataType from "./enums/JobDataType";
import {DfrntPageViewModel} from "../../interfaces/dfrnt-page-view-model.interface";
import AddEventDialogService from "../dialogs/add-event-dialog/add-event-dialog.service";
import AdditionalServicesDialogService from "../dialogs/additional-services-dialog/additional-services-dialog.service";
import JobContextMenuService from "../../services/job-context-menu.service";
import {ExtendedTask, TaskViewModel} from "../task-dashboard/task-dashboard.interfaces";
import {IJobReadChanged} from "../../interfaces/event-interfaces";
import {JobProperty} from "../../enums/job-property.enum";
import FlightDetailsDialogService from "../dialogs/flight-details-dialog/flight-details-dialog.service";
import NavigationService from '../../services/navigation.service';
import ApiConfig from "../../interfaces/apiConfig.interface";
import ConfigService from "../../services/config.service";
import AutoCompleteDialogService from "../dialogs/auto-complete-dialog/auto-complete-dialog.service";
import InternalJobStatus from "../../enums/job-internal-status.enum";
import NationwideBoxes from "./enums/NationwideBoxes";
import JobAddStopService from "../../services/job-add-stop.service";
import greetUser from '../../functions/greetUser';
import FlightAgentConfirmationDialogService
    from "../dialogs/flight-agent-conformation-dialog/flight-agent-confirmation-dialog.service";
import AgentInfoDialogService from "../dialogs/agent-info-dialog/agent-info-dialog.service";
import dayjs from "dayjs";
import MessagingDialogService from "../dialogs/messaging-dialog/messaging-dialog.service";
import MessagingService from "../../services/messaging.service";
import {ContactID, TimeZone} from "../../contants";
import {StatusFilter} from "../task-dashboard/enums/status-filter";
import TasksService from "../../services/tasks.service";
import JobListType from "../common/job-list/enums/jobListType";
import RecoveryAgentManagementService
    from "../dialogs/recovery-agent-management-dialog/recovery-agent-management-dialog.service";
import {formatDateForApiWithTzs} from "../../functions/formatDates";
import IContextMenuOption from "../../interfaces/context-menu-option.interface";
import IDateFilterData from "../common/date-filter-menu/IDateFilterData";
import setDateFilterDefaults from "../../functions/setDateFilterDefaults";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(timezone);

class NationwideControl extends BaseController {
    static $inject = [
        '$scope',
        'NWData',
        '$timeout',
        '$mdDialog',
        '$document',
        'toastrService',
        'DispatchData',
        '$mdSidenav',
        'APP_CONFIG',
        'dispatchJobService',
        'jobFileUploadDialogService',
        'addEventDialogService',
        'additionalServicesDialogService',
        'jobContextMenuService',
        '$interval',
        'flightDetailsDialogService',
        'navigationService',
        'configService',
        'autoCompleteDialogService',
        'jobAddStopService',
        '$stateParams',
        'flightAgentConfirmationDialogService',
        'agentInfoDialogService',
        'messagingDialogService',
        'messagingService',
        'tasksService',
        'recoveryAgentManagementService',
    ];
    
    private readonly NationwideLayoutKey: string = `layoutsNW-${ContactID}`;
    private readonly NationwideLastActiveLayoutKey: string = `lastActiveLayoutNW-${ContactID}`;
    private readonly refreshDurationIntervalKey: string = `refreshInterval-${AppPages.Domestic}-${ContactID}`;
    private readonly DateFilterKey: string = `dateFilter-${AppPages.Domestic}-${ContactID}`;

    readonly nationwideJobList: JobListType = JobListType.NationwideJobList;
    readonly nationwidePodJobList: JobListType = JobListType.NationwidePodJobList;
    readonly nationwideRepriceJobList: JobListType = JobListType.NationwideRepriceJobList;
    readonly nationwidePageId: number = AppPages.Domestic;


    readonly isUsCustomer: boolean = false;
    private tasksLoadingInBackground: boolean = false;
    greeting: string;
    isDataLoading: boolean = false;
    layouts: any[] = [];
    defaultLayout?: ILayout;
    currentLayoutIndex: number = 0;
    currentLayoutName: string = "Default";
    layout?: { columns: IColumn[] };
    currentJob?: IDispatchJob;
    currentJobId?: number;
    jobList?: IDispatchJob[] = [];
    jobListPOD?: IDispatchJob[] = [];
    jobListReprice?: IDispatchJob[] = [];
    STATUS_TO_LIST_MAP: any;
    totalJobCount: number = 0;
    totalPodCount: number = 0;
    totalRepriceCount: number = 0;
    jobRecordSearchText?: string;
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
    selected: any;
    jobFilters: IJobQueryParams = {
        order: 'time',
        orderDirection: 'asc',
    };
    jobPodFilters: IJobQueryParams = {
        order: 'time',
        orderDirection: 'asc',
    };
    jobRepriceFilters: IJobQueryParams = {
        order: 'time',
        orderDirection: 'asc',
    };
    boxes?: Record<string, IBox>;
    pickService: any;
    pickClients: any;
    boxSortableOptions: angular.ui.SortableOptions<any>;
    hereCredentials?: ApiConfig;
    mapConfig?: any;
    currentSelection?: string;
    agentsLoading: boolean = false;
    agentListPromise?: Promise<{ agents: IAgent[], message: string | null }>;
    flightListPromise?: any;
    jobListPromise?: Promise<IDispatchJob[]>;
    podListPromise?: Promise<IDispatchJob[]>;
    repriceListPromise?: Promise<IDispatchJob[]>;
    taskItemConfig = {
        showAssign: true,
        showClose: true,
        showDelete: true,
        onTaskClick: true
    };
    currentSupport: any;
    activeAirlineOptions?: ISuggestion[];
    timeZone: string;
    lastDepartureTime?: Date;
    outboundAirportOptions?: ISuggestion[];
    inboundAirportOptions?: ISuggestion[];
    selectedOutboundAirport?: ISuggestion;
    selectedInboundAirport?: ISuggestion;
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

    browserTimeZone: string;
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

    constructor(
        $scope: angular.IScope,
        private nationwideService: NationwideService,
        $timeout: angular.ITimeoutService,
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
        private toastrService: ToastrService,
        private DispatchData: DispatchCoreService,
        private $mdSidenav: angular.material.ISidenavService,
        private appConfig: IAppConfig,
        private dispatchJobService: DispatchExecutorService,
        private jobFileUploadDialogService: JobFileUploadDialogService,
        private addEventDialogService: AddEventDialogService,
        private additionalServicesDialogService: AdditionalServicesDialogService,
        private jobContextMenuService: JobContextMenuService,
        $interval: angular.IIntervalService,
        private flightDetailsDialogService: FlightDetailsDialogService,
        private navigationService: NavigationService,
        private configService: ConfigService,
        private autoCompleteDialogService: AutoCompleteDialogService,
        private jobAddStopService: JobAddStopService,
        private $stateParams: angular.ui.IStateParamsService,
        private flightAgentConfirmationDialogService: FlightAgentConfirmationDialogService,
        private agentInfoDialogService: AgentInfoDialogService,
        private messagingDialogService: MessagingDialogService,
        private messagingService: MessagingService,
        private tasksService: TasksService,
        private recoveryAgentManagementService: RecoveryAgentManagementService,
    ) {
        super();
        this.initServices($timeout, $interval, $scope);

        this.greeting = greetUser(FirstName);
        this.isUsCustomer = this.appConfig.US_Customer;
        this.timeZone = TimeZone;
        this.browserTimeZone = dayjs.tz.guess()

        // Date filter
        this.dateFilterData = setDateFilterDefaults();
        this.loadDateFilterFromStorage();
        
        this.watchEvent("angular-resizable.resizeEnd", (_, args: {
            id?: string,
            width: number,
            height: number
        }) => {
            const mapContainer = angular.element(args.id ? '#' + args.id : '').find('.here-map');
            if (mapContainer.length > 0) {
                $scope.$emit("map-container-resized", {
                    id: args.id,
                    width: args.width,
                    height: args.height
                });
                console.info("Map container resized: ", args.id);
            }
        });

        this.watchEvent<IJobReadChanged>('jobReadChanged', (_, data) => {
            this.markJobReadStatus(data.jobId, data.isRead);
        });

        this.watchEvent('jobChanged', async (_, newJob: IJob) => {
            if (this.currentJobId === newJob.id) {
                console.info(`Job ${newJob.jobNo} is already the current job, skipping reload`);
                return;
            }

            console.info(`Handling job changed event for job ${newJob.jobNo}`);

            const job = await this.DispatchData.getDispatchJobDetail(newJob.id);
            await this.selectJob(job)
        });

        this.watchScope(() => this.layout, () => {
            this.registerTimeout(() => this.applyLayoutDimensions());
        }, true);

        if (angular.element('#draggingItems').length === 0) {
            angular.element('body').append('<div id="draggingItems"></div>');
        }

        this.initHereMaps();

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
        if (Modernizr.localstorage) {
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
            } catch (error: any) {
                console.error('Error loading stored layouts:', error);
                this.layouts = [this.defaultLayout];
                this.loadLayout(0);
            }
        } else {
            this.layouts = [this.defaultLayout];
            this.loadLayout(0);
        }

        // Auto-save changes
        this.watchScope("layout", (newValue: { columns: IColumn[] }, oldValue: { columns: IColumn[] }) => {
            if (newValue !== oldValue && this.currentLayoutName) {
                const index = this.layouts.findIndex((l: ILayout) => l.name === this.currentLayoutName);
                if (index !== -1) {
                    this.layouts[index].layout = angular.copy(newValue);
                    if (Modernizr.localstorage) {
                        localStorage.setItem(this.NationwideLayoutKey, JSON.stringify(this.layouts));
                    }
                }
            }
        }, true);

        // Start loading data
        this.loadPageViews().then(() => {
            console.info('Loaded Page Views and Data!');
        });

        this.STATUS_TO_LIST_MAP = {
            1: [JobDataType.NEW],
            3: [JobDataType.POD],
            4: [JobDataType.REPRICE]
        };

        this.nationwideService.getActiveAirlines().then((response) => {
            console.info("[NationwideController] - Active Airlines:", response);
            this.activeAirlineOptions = response;
        });

        this.jobRecordSearchText = "";

        // New map
        this.mapCenter = this.appConfig.US_Customer
            ? this.appConfig.US_Coordinates_Center
            : this.appConfig.NZ_Coordinates_Center
        this.showInput = {};
        this.inputWidth = {};

        this.selected = [];

        this.boxes = {
            [NationwideBoxes.NewJobs]: {
                "title": "New Jobs",
                "icon": "new_releases",
                "templateUrl": "app/components/Nationwide/partials/jobList.html",
                "showRefresh": 1
            }, [NationwideBoxes.PodJobs]: {
                "title": "Awaiting POD",
                "icon": "pending_actions",
                "templateUrl": "app/components/Nationwide/partials/jobListPOD.html",
                "showRefresh": 1
            }, [NationwideBoxes.Tasks]: {
                "title": "Tasks",
                "icon": "support",
                "templateUrl": "app/components/Nationwide/partials/tasksList.html",
                "showRefresh": 1
            }, [NationwideBoxes.RepriceJobs]: {
                "title": "Reprice",
                "icon": "price_change",
                "templateUrl": "app/components/Nationwide/partials/jobListReprice.html",
                "showRefresh": 1
            }, [NationwideBoxes.JobDetail]: {
                "title": "Detail",
                "icon": "assignment",
                "templateUrl": "app/components/Nationwide/partials/jobDetail.html",
                "showRefresh": 1,
                "showDetailButtons": 1
            }, [NationwideBoxes.Map]: {
                "title": "Map",
                "icon": "pin_drop",
                "templateUrl": "app/components/Nationwide/partials/map.html",
                "showRefresh": 1
            }, [NationwideBoxes.FlightAgents]: {
                "title": "Available",
                "icon": "docs_add_on",
                "templateUrl": "app/components/Nationwide/partials/flightAgentDataTableBox.html",
                "showRefresh": 1
            }
        };

        this.pickService = {
            "clients": [], "settings": {
                "enableSearch": true,
                "selectedToTop": true,
                "closeOnBlur": true,
                "closeOnSelect": true,
                "buttonClasses": "topBarActive btn-sm btn-clients"
            }
        };
        this.pickClients = [];

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

                this.updateBoxMetrics();
                this.saveCurrentLayout();
            }
        };

        this.initRefreshIntervalOptions();
        this.loadSavedRefreshInterval();
        this.initializeTaskService();
    }

    $onInit(): void {
        const jobId = this.$stateParams.jobId;
        if (jobId) {
            this.loadPageViews()
                .then(() => {
                    if (!this.jobList) return;

                    const job = this.jobList.find((j) => j.id === jobId);
                    if (!job) return;

                    return this.selectJob(job);
                })
                .catch((error) => {
                    console.error("Error loading initial job:", error);
                    this.toastrService.showErrorToast("Error loading job details");
                });
        } else {
            this.loadPageViews().then(_ => console.info("Loaded Page Views!"));
        }

        this.registerInterval(async () => {
            await this.getUnreadMessageCount();
        }, 10000);
    }

    $onDestroy(): void {
        super.$onDestroy();
        this.stopAutoRefresh();
    }

    private loadSavedRefreshInterval(): void {
        if (Modernizr.localstorage) {
            try {
                const savedIntervalString = localStorage.getItem(`${this.refreshDurationIntervalKey}-${ContactID}`);
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
                localStorage.setItem(this.NationwideLayoutKey, JSON.stringify(this.layouts));
            }
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

    async loadPageViews(): Promise<void> {
        try {
            this.views = await this.DispatchData.getSelectedViews(ContactID, AppPages.Domestic);
            this.initializeViews();

            if (!ClientInternal) {
                await this.getClientContacts();
            }

            await this.getData();
        } catch (error) {
            console.error('Error fetching dispatch views:', error);
            this.views = [];
            this.initializeViews();
        }
    }

    initializeViews(): void {
        if (this.views && this.views.length > 0) {
            this.selectedViews = this.loadViewsFromStorage();

            this.views = this.views.map(view => ({
                ...view, selected: this.selectedViews.some((v: DfrntPageViewModel) => v.id === view.id)
            }));

            if (this.selectedViews.length === 0) {
                this.views[0].selected = true;
                this.selectedViews.push(this.views[0]);
                NationwideControl.saveViewsToStorage(this.selectedViews);
            }

            this.viewsInitialized = true;
        }
    }

    async selectAllViews(): Promise<void> {
        this.views.forEach((view: DfrntPageViewModel) => {
            view.selected = true;
        });

        this.selectedViews = this.views;
        NationwideControl.saveViewsToStorage(this.selectedViews);
        await this.getData();
    }
    
    async clearAllViews() {
        this.views.forEach((view: DfrntPageViewModel) => {
            view.selected = false;
        });

        this.selectedViews = [];
        NationwideControl.saveViewsToStorage(this.selectedViews);
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

        NationwideControl.saveViewsToStorage(this.selectedViews);
        await this.getData();
    }

    async jobRecordSearch(searchText: string): Promise<ISuggestion[]> {
        if (!this.jobList) return [];

        return this.jobList
            .filter(job => job.jobNo.toLowerCase().includes(searchText.toLowerCase()))
            .map(job => ({id: job.id, text: job.jobNo}));
    }

    jobRecordSelected(selectedJobId: number) {
        if (!selectedJobId) return;

        const selectedJob = this.findJobInLocalLists(selectedJobId);
        if (!selectedJob) {
            console.warn(`Job with ID ${selectedJobId} not found`);
            return;
        }

        return this.selectJob(selectedJob);
    }

    loadLayout(index: number): void {
        const layout: ILayout = this.layouts[index] || this.layouts[0];
        this.currentLayoutName = layout.name;
        this.currentLayoutIndex = index;
        this.layout = angular.copy(layout.layout);

        this.applyLayoutDimensions();

        if (Modernizr.localstorage) {
            localStorage.setItem(this.NationwideLastActiveLayoutKey, layout.name);
        }

        this.applyScope();
    }

    async saveLayout(): Promise<ILayout | null> {
        try {
            const layoutName = await this.$mdDialog.show(
                this.$mdDialog
                    .prompt()
                    .title("Save Layout")
                    .textContent("Please enter a name for this layout.")
                    .ariaLabel("Layout name")
                    .required(true)
                    .ok("Save")
                    .cancel("Cancel")
            );

            this.updateBoxMetrics();

            const currentLayout: ILayout = {
                name: layoutName,
                layout: {
                    columns: this.layout?.columns?.map((col: IColumn) => ({
                        ...col,
                        width: angular.element(`#co-${col.id}`).css("flex-basis"),
                        boxes: col.boxes.map((box: IBox) => ({
                            ...box,
                            height: angular.element(`#box-${box.name}`).css("flex-basis"),
                        })),
                    })) || []
                }
            };

            this.layouts.push(currentLayout);
            this.currentLayoutName = layoutName;
            this.layout = currentLayout.layout;

            if (Modernizr.localstorage) {
                localStorage.setItem(this.NationwideLayoutKey, JSON.stringify(this.layouts));
                localStorage.setItem(this.NationwideLastActiveLayoutKey, layoutName);
            }

            this.applyScope();
            return currentLayout;
        } catch (error) {
            if (!error) {
                console.info("Save Layout Cancelled!");
            } else {
                console.error("Unable to save layout:", error);
            }
            this.applyScope();
            return null;
        }
    }

    async deleteLayout(index: number): Promise<void> {
        if (index === 0) return; // Prevent deleting default layout

        try {
            await this.$mdDialog.show(
                this.$mdDialog
                    .confirm()
                    .title("Delete Layout?")
                    .textContent("Are you sure you would like to delete this layout?")
                    .ok("Delete")
                    .cancel("Cancel")
            );

            this.layouts.splice(index, 1);

            if (Modernizr.localstorage) {
                localStorage.setItem(this.NationwideLayoutKey, JSON.stringify(this.layouts));
            }

            if (this.currentLayoutName === this.layouts[index]?.name) {
                this.loadLayout(0);
            }

            this.applyScope();
            this.toastrService.showSuccessToast("Layout deleted successfully");
        } catch (error) {
            this.handleError(error);
            this.applyScope();
        }
    }

    private applyLayoutDimensions(): void {
        if (!this.layout || !this.layout.columns) return;

        const updates: (() => void)[] = [];

        this.layout?.columns?.forEach((column: IColumn) => {
            const columnEl = angular.element(`#co-${column.id}`);
            if (columnEl.length) {
                updates.push(() => columnEl.css('flex-basis', column.width));

                column.boxes.forEach((box: IBox) => {
                    const boxEl = angular.element(`#box-${box.name}`);
                    if (boxEl.length) {
                        updates.push(() => boxEl.css('flex-basis', box.height || 'auto'));
                    }
                });
            }
        });

        // Execute all updates in a single frame
        updates.forEach(update => update());

        this.applyScope();
    }

    static saveViewsToStorage(views: any): void {
        if (Modernizr.localstorage) {
            localStorage.setItem(`selectedViews-NW-${ContactID}`, JSON.stringify(views));
        }
    }

    loadViewsFromStorage(): any {
        if (Modernizr.localstorage) {
            try {
                const savedViews = JSON.parse(localStorage.getItem(`selectedViews-NW-${ContactID}`) || '[]');
                return savedViews || [];
            } catch (error) {
                console.error('Error loading views from storage:', error);
                return [];
            }
        }
        return [];
    }

    async handleStatusChange(event: StatusChangeEvent): Promise<void> {
        try {
            console.info('Handle status change triggered!', {
                jobId: event.jobId,
                previousStatus: event.previousStatusId,
                newStatus: event.newStatusId
            });

            const listsToRefresh = new Set([
                ...(this.STATUS_TO_LIST_MAP[event.previousStatusId] || []),
                ...(this.STATUS_TO_LIST_MAP[event.newStatusId] || [])
            ]);
            console.info('Lists to refresh:', Array.from(listsToRefresh));

            await this.getJobList(Array.from(listsToRefresh));
            console.info('Job lists refreshed successfully');

            const refreshedJob = this.findJobInLocalLists(event.jobId);
            console.info(refreshedJob
                    ? 'Found updated job in refreshed lists via lookup map'
                    : 'Updated job not found in refreshed lists',
                {jobId: event.jobId}
            );

            if (refreshedJob) {
                await this.selectJob(refreshedJob);
                console.info('Job reselected successfully');
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

    openSearch(boxName: string, index: number): void {
        const boxID = boxName + '-' + index;
        if (this.showInput[boxID]) {
            this.showInput[boxID] = false;
            this.inputWidth[boxID] = 31;
        } else {
            this.inputWidth[boxID] = 200;
            this.showInput[boxID] = true;
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
        } catch (error) {
            console.error('Error restoring job:', error);
        }
    }

    async reAllocateJobs(job: IDispatchJob): Promise<void> {
        try {
            if (!job) return;

            await this.dispatchJobService.reallocateJob(job);
            await this.getData();
        } catch (error) {
            console.error('Error restoring job:', error);
        }
    }

    async loadRelatedJobDetail(jobId: number, jobNumber: string): Promise<void> {
        try {
            console.info(`Loading related job detail for ID: ${jobId}, Number: ${jobNumber}`);

            // Use optimized job lookup
            const currentJob = this.findJobInLocalLists(jobId);

            if (currentJob) {
                console.info(`Found job ${jobNumber} in local lists`);
                await this.selectJob(currentJob);
                this.currentSelection = ` for Job ${jobNumber}`;
            } else {
                console.warn(`Job with ID ${jobId} not found in any list, may need to refresh data`);
            }
        } catch (error) {
            console.error("Error in loadRelatedJobDetail:", error);
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

            console.info(`Selecting job ${job.jobNo}`);

            // Cancel any existing task loading for a previous job
            if (this.currentJobId && this.currentJobId !== job.id) {
                this.tasksService.cancelJobTaskLoading(this.nationwidePageId, this.currentJobId);
            }

            this.markJobReadStatus(job.id, true);

            this.currentJob = job;
            this.currentJobId = job.id;

            // Set isDeliveryJobType flag
            this.isDeliveryJobType = this.isDeliveryJob(job);

            // Update UI first
            this.updateUIState(job);
            this.updateCurrentSelection(job.jobNo);

            await this.handleJobSelectionRelatedData(job);

            this.loadTasksInBackground(undefined, job.id);

            this.updateUIState(job);
            this.displayJobOnMap(job);

            this.applyScope();
        } catch (error) {
            console.error("Error in selectJob:", error);
        }
    }

    private loadTasksInBackground(filterType: string = this.tasksFilter, jobId?: number): void {
        const effectiveJobId = jobId || this.currentJobId;

        if (this.tasksLoadingInBackground) {
            this.tasksService.cancelJobTaskLoading(this.nationwidePageId, this.currentJobId);
        }

        this.tasksLoadingInBackground = true;

        const filterRequest = this.tasksService.buildFilterRequest(
            filterType,
            effectiveJobId,
            this.staffFilter,
            this.eventTypeFilter,
            this.nationwidePageId
        );

        this.tasksService.loadTasksInBackground(filterRequest, (tasks, error) => {
            // Only process if this is still the current job
            if (effectiveJobId === this.currentJobId) {
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
        this.selected = null;
        this.selectedOutboundAirport = undefined;
        this.selectedInboundAirport = undefined;

        // Refresh tasks
        await this.loadTasks();

        // Show flight table
        if (job.isFlightJob) {
            console.info('[NationwideController] Getting nearby airports');
            this.outboundAirportOptions = await this.nationwideService.getNearbyAirports(job.id, true);
            this.inboundAirportOptions = await this.nationwideService.getNearbyAirports(job.id, false);
            console.info('[NationwideController] Got nearby airports:', this.outboundAirportOptions);

            if (this.outboundAirportOptions && this.outboundAirportOptions.length > 0) {
                const defaultOutboundAirport = this.outboundAirportOptions.find(airport => airport.id === job.fromAirportId);
                console.info('Default Outbound Airport:', defaultOutboundAirport);
                if (defaultOutboundAirport) this.selectedOutboundAirport = defaultOutboundAirport;
            }

            if (this.inboundAirportOptions && this.inboundAirportOptions.length > 0) {
                const defaultInboundAirport = this.inboundAirportOptions.find(airport => airport.id === job.toAirportId);
                console.info('Default Inbound Airport:', defaultInboundAirport);
                if (defaultInboundAirport) this.selectedInboundAirport = defaultInboundAirport;
            }

            // Reset search parameters
            this.lastDepartureTime = undefined;
            await this.loadFlights();
        }

        // Show agent table
        if (this.isDeliveryJob(job)) {
            await this.processAgents(job);
        }

        this.updateUIState(job);
    }

    private displayJobOnMap(job: IDispatchJob): void {
        try {
            if (!job) {
                console.warn('No job provided to displayJobOnMap');
                return;
            }

            console.info(`Displaying job ${job.jobNo} on map`);

            this.mapConfig = this.calculateMapBounds(job);
            this.applyScope();
        } catch (error) {
            console.error('Error in displayJobOnMap:', error);
            this.toastrService.showErrorToast('An unexpected error occurred displaying this job on the map');
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
                childJobs: {},
                flight: job.speedId === 415,
                timestamp: Date.now()
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
        console.info('Getting agents');

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

            console.info("Agent options loaded:", this.agentOptions.length);
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

        if (this.flightsLoading) {
            console.info("Flight loading already in progress, skipping duplicate request");
            return;
        }

        this.flightsLoading = true;
        this.updateUIState(this.currentJob);

        try {
            const now = dayjs();
            let departureDate;

            if (this.lastDepartureTime) {
                departureDate = dayjs(this.lastDepartureTime);
            } else if (this.currentJob.booked) {
                departureDate = dayjs(this.currentJob.booked);
            } else {
                departureDate = now;
            }

            const airlineId = this.selected?.airline?.id;
            const departureAirportId = this.selectedOutboundAirport?.id;
            const arrivalAirportId = this.selectedInboundAirport?.id;
            const minimumLayoverMinutes = 60;

            console.info('Loading flights with params:', {
                jobId: this.currentJob.id,
                departureDate: departureDate,
                airlineId: airlineId,
                departureAirportId: departureAirportId,
                arrivalAirportId: arrivalAirportId,
                minimumLayoverMinutes: minimumLayoverMinutes
            });

            this.flightListPromise = this.nationwideService.getFlightOptions(
                this.currentJob.id,
                departureDate,
                this.currentJob.pickUpTimeZone?.text ??  this.browserTimeZone,
                airlineId,
                departureAirportId,
                arrivalAirportId,
                minimumLayoverMinutes
            );

            const result = await this.flightListPromise;

            this.flightOptions = result.flights || [];
            this.flightMessage = result.message || (result.flights.length === 0 ?
                "No flights available for the selected criteria" : undefined);
            this.lastDepartureTime = result.lastDepartureTime;
            this.filteredFlightOptions = this.flightOptions;

            console.info(`Loaded ${this.flightOptions?.length} flights`);
        } catch (error) {
            console.error("Error loading flights:", error);
            this.flightMessage = "An error occurred while loading flights. Please try again.";
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
            const nextDay = new Date(this.lastDepartureTime);
            nextDay.setHours(0, 0, 0, 0);
            nextDay.setDate(nextDay.getDate() + 1);
            this.lastDepartureTime = nextDay;
        } else {
            const tomorrow = new Date(this.currentJob.booked);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            this.lastDepartureTime = tomorrow;
        }

        return this.loadFlights();
    }

    async openFlightMoreInfo($event: MouseEvent, flight: IFlightViewModel): Promise<void> {
        await this.flightDetailsDialogService.openFlightDetailsDialog($event, flight);
    }

    async addFlightToJob($event: MouseEvent, flight: IFlightViewModel, job: IDispatchJob): Promise<void> {
        try {
            const result = await this.flightAgentConfirmationDialogService.flightConfirmationDialog($event, job, flight)
            if (!result.shouldAssign) return;

            this.isDataLoading = true;
            this.applyScope();
            console.info('Assigning to job');

            const previousInternalStatusId = job.internalStatusId ?? InternalJobStatus.NewJobs;
            const listsToRefresh = new Set([JobDataType.POD]);

            if (this.STATUS_TO_LIST_MAP[previousInternalStatusId]) {
                this.STATUS_TO_LIST_MAP[previousInternalStatusId].forEach((type: JobDataType) => listsToRefresh.add(type));
            }

            const requestData: AssignFlightToJobRequest = {
                jobId: job.id,
                fromAirportId: this.selectedOutboundAirport?.id,
                toAirportId: this.selectedInboundAirport?.id,
                flightNumber: flight.flightNumber,
                departureDate: formatDateForApiWithTzs(flight.departureTime, flight.departureTimeZone),
                flightSegments: flight.flightSegments,
                packageReadyTime: result.packageReadyTime ? formatDateForApiWithTzs(result.packageReadyTime, flight.arrivalTimeZone) : undefined,
                packageDeliverByTime: result.packageDeliverByTime ? formatDateForApiWithTzs(result.packageDeliverByTime, flight.arrivalTimeZone) : undefined,
                packageDeliveryNotes: result.packageDeliveryNotes
            };
            
            console.info('Assigning flight to job:', requestData);

            // Pass the full flight data including segments to the service
            await this.nationwideService.assignFlightToJob(requestData);

            if (result.awb) {
                await this.DispatchData.updateJobDetail(job.id, JobProperty.ConNote, result.awb ?? '', false);
            }

            await this.getJobList(Array.from(listsToRefresh));

            const updatedJob = this.jobListPOD?.find(j => j.id === job.id);

            if (updatedJob) {
                await this.selectJob(updatedJob);
            }

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

    async addSelectedAgentToJob($event: MouseEvent, agent: ISuggestion, job: IDispatchJob): Promise<void> {
        try {
            // Check flight is assigned first
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


            const result = await this.flightAgentConfirmationDialogService.agentConfirmationDialog($event, job, agent)
            if (!result.shouldAssign) return;

            this.isDataLoading = true;
            this.applyScope();

            console.info('Assigning to job');

            await this.nationwideService.assignAgentToJob(job.id, agent.id, result.shouldAssignToStopJobs ?? false);

            if (result.awb) {
                await this.DispatchData.updateJobDetail(job.id, JobProperty.ConNote, result.awb, false);
            }
            
            this.showJobHasAssignedAgentMessage = true;
            await this.getJobList([JobDataType.NEW, JobDataType.POD]);
            this.currentJob = this.findJobInLocalLists(job.id);
            
            this.isDataLoading = false;

            const successMessage = (`Successfully assigned agent ${agent.text} to job ${job.jobNo}`)
            this.toastrService.showSuccessToast(successMessage);
        } catch (error) {
            this.handleError(error);
            this.isDataLoading = false;
        } finally {
            this.applyScope();
        }
    }

    private updateDateFilters(dataTypes: JobDataType | JobDataType[] = JobDataType.ALL): void {
        if(!this.dateFilterData?.startDate || !this.dateFilterData?.endDate) return;
        
        if (dataTypes.includes(JobDataType.NEW)) {
            this.jobFilters.startDate = this.dateFilterData.startDate;
            this.jobFilters.endDate = this.dateFilterData.endDate;
        }
        if (dataTypes.includes(JobDataType.POD)) {
            this.jobPodFilters.startDate = this.dateFilterData.startDate;
            this.jobPodFilters.endDate = this.dateFilterData.endDate;
        }
        if (dataTypes.includes(JobDataType.REPRICE)) {
            this.jobRepriceFilters.startDate = this.dateFilterData.startDate;
            this.jobRepriceFilters.endDate = this.dateFilterData.endDate;
        }
    }

    async getJobList(dataTypes: JobDataType | JobDataType[] = JobDataType.ALL): Promise<void> {
        if (!this.viewsInitialized && this.selectedViews.length === 0) {
            console.info('Views not initialized yet, loading defaults');
            this.selectedViews = this.loadViewsFromStorage();

            // If still no views, add at least one default view
            if (this.selectedViews.length === 0 && this.views.length > 0) {
                this.selectedViews = [this.views[0]];
            }
        }

        const selectedClients = this.pickService.clients.map((a: { id: number }) => a.id);
        const types = Array.isArray(dataTypes) ? dataTypes : [dataTypes];

        const requestedTypes = types.includes(JobDataType.ALL)
            ? [JobDataType.NEW, JobDataType.POD, JobDataType.REPRICE]
            : types;

        this.updateDateFilters(requestedTypes);

        if (requestedTypes.includes(JobDataType.NEW)) this.jobListLoading = true;
        if (requestedTypes.includes(JobDataType.POD)) this.podListLoading = true;
        if (requestedTypes.includes(JobDataType.REPRICE)) this.repriceListLoading = true;

        try {
            // Initialize promises
            if (requestedTypes.includes(JobDataType.NEW)) {
                this.jobListPromise = this.nationwideService.getNationwideJobsNew(
                    this.jobFilters || {},
                    selectedClients,
                    ClientInternal,
                    this.selectedViews
                );
            }

            if (requestedTypes.includes(JobDataType.POD)) {
                this.podListPromise = this.nationwideService.getNationwideJobsPOD(
                    this.jobPodFilters || {},
                    selectedClients,
                    ClientInternal,
                    this.selectedViews
                );
            }

            if (requestedTypes.includes(JobDataType.REPRICE)) {
                this.repriceListPromise = this.nationwideService.getNationwideJobsReprice(
                    this.jobRepriceFilters || {},
                    selectedClients,
                    ClientInternal,
                    this.selectedViews
                );
            }

            // Create fetch promises
            const fetchPromises = [];

            if (requestedTypes.includes(JobDataType.NEW) && this.jobListPromise) {
                fetchPromises.push(this.jobListPromise.then(data => ({type: JobDataType.NEW, data})));
            }

            if (requestedTypes.includes(JobDataType.POD) && this.podListPromise) {
                fetchPromises.push(this.podListPromise.then(data => ({type: JobDataType.POD, data})));
            }

            if (requestedTypes.includes(JobDataType.REPRICE) && this.repriceListPromise) {
                fetchPromises.push(this.repriceListPromise.then(data => ({type: JobDataType.REPRICE, data})));
            }

            // Execute in parallel
            const tasksPromise = this.loadTasks();
            const results = await Promise.all(fetchPromises);

            // Update state with results
            results.forEach(({type, data}) => {
                if (type === JobDataType.NEW) {
                    this.jobList = data || [];
                    this.totalJobCount = data.length || 0;
                    this.jobListLoading = false;
                } else if (type === JobDataType.POD) {
                    this.jobListPOD = data || [];
                    this.totalPodCount = data.length || 0;
                    this.podListLoading = false;
                } else if (type === JobDataType.REPRICE) {
                    this.jobListReprice = data || [];
                    this.totalRepriceCount = data.length;
                    this.repriceListLoading = false;
                }
            });

            await tasksPromise;
            this.applyScope();
        } catch (error) {
            console.error("Error fetching job data:", error);

            // Reset loading states
            if (requestedTypes.includes(JobDataType.NEW)) this.jobListLoading = false;
            if (requestedTypes.includes(JobDataType.POD)) this.podListLoading = false;
            if (requestedTypes.includes(JobDataType.REPRICE)) this.repriceListLoading = false;

            this.applyScope();
        }
    }

    async openFileAttachmentDialog($event: MouseEvent, job: IDispatchJob) {
        await this.jobFileUploadDialogService.openJobFileUploadDialog($event, job);
    }

    async showAdditionalServicesMenu($event: MouseEvent, job: IDispatchJob) {
        await this.additionalServicesDialogService.showAdditionalServicesDialog($event, job);
    }

    async getClientContacts() {
        try {
            this.pickClients = await this.DispatchData.getClientContacts(ContactID);
        } catch (error) {
            console.error("Error fetching client contacts:", error);
        }
    }

    async getData(): Promise<void> {
        // Clear data at once
        this.jobList = [];
        this.jobListPOD = [];
        this.currentJob = undefined;

        try {
            await this.getJobList(JobDataType.ALL);
        } catch (error) {
            console.error("Error in getData:", error);
        }
    }

    private handleError(error: any) {
        if (!error) {
            console.info('User canceled!');
        } else {
            console.error('Error assigning flight to job:', error);
        }
    }

    async createEvent($event: MouseEvent, job: IDispatchJob) {
        await this.addEventDialogService.openAddEventDialog($event, job);
    }

    getContextMenuOptions(job: IDispatchJob): any[] | IContextMenuOption[] {
        if (!job) return [];

        const callbacks = {
            onRefresh: () => this.getData(),
            onSplitJob: (params: { job: IDispatchJob }) => this.handleSplitJob(params.job),
            onRefreshCourierJobs: (params: { courierId: number }) => {
                console.info('Refreshing courier jobs:', params.courierId);
            }
        };

        return this.jobContextMenuService.getMenuOptions(job, callbacks, AppPages.Domestic);
    }

    async handleSplitJob(job: IDispatchJob): Promise<void> {
        if (!job) return;

        try {
            console.info("Split job requested for:", job.id);

            await this.getData();
        } catch (error: any) {
            console.error("Error handling split job:", error);
        }
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
        try {
            this.tasksLoading = true;

            const filterRequest = this.tasksService.buildFilterRequest(
                filterType,
                this.currentJobId,
                this.staffFilter,
                this.eventTypeFilter,
                this.nationwidePageId
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
            this.applyScope();
        } catch (error) {
            console.error("Error loading tasks:", error);
            this.toastrService.showErrorToast("Error loading tasks");
            this.tasksLoading = false;
            this.applyScope();
        }
    }

    async filterTasks(filterType: string): Promise<void> {
        this.tasksFilter = filterType;
        await this.loadTasks(filterType);
    }

    async selectTaskJobDetail(task: TaskViewModel): Promise<void> {
        this.logTaskInfo(task);
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

            // If not found in local lists, fetch from a database
            if (!attachedJob) {
                console.info(`Job ${task.jobId} not found in local lists, fetching from database`);
                attachedJob = await this.DispatchData.getDispatchJobDetail(task.jobId);
            }

            if (!attachedJob) {
                this.toastrService.showWarningToast("This task has no job attached");
                console.warn('[selectTaskJobDetail] No job found for jobId:', task.jobId);
                return;
            }

            await this.selectJob(attachedJob);
            console.info('[selectTaskJobDetail] Job selected successfully');

            this.updateCurrentSelection(attachedJob.jobNo);
        } catch (error) {
            this.handleError(error);
        }
    }

    private logTaskInfo(task: TaskViewModel): void {
        console.info('[selectTaskJobDetail] Starting with task:', {
            jobId: task.jobId,
            jobNumber: task.jobNumber,
            taskId: task.id
        });
    }

    private validateJobId(task: TaskViewModel): boolean {
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

    async filterFlightsByAirline(airlineId?: number): Promise<void> {
        if (!this.currentJob) return;

        // Store the airline selection
        this.selected = {airline: {id: airlineId}};

        // Reset search
        this.lastDepartureTime = undefined;

        // Call loadFlights which will use the updated selected airline
        await this.loadFlights();
    }

    async onOutboundAirportSelectionChanged(): Promise<void> {
        try {
            // Reset search when changing airport filter
            this.lastDepartureTime = undefined;

            console.info('Airport selection changed to:',
                this.selectedOutboundAirport ? this.selectedOutboundAirport.text : 'All airports');

            // Reload flights with the new airport selection
            await this.loadFlights();
        } catch (error) {
            console.error('Error loading flights after airport change:', error);
        }
    }

    async onInboundAirportSelectionChanged(): Promise<void> {
        try {
            // Reset search when changing airport filter
            this.lastDepartureTime = undefined;

            console.info('Airport selection changed to:',
                this.selectedInboundAirport ? this.selectedInboundAirport.text : 'All airports');

            // Reload flights with the new airport selection
            await this.loadFlights();
            this.applyScope();
        } catch (error) {
            console.error('Error loading flights after airport change:', error);
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
            console.info("[NationwideRefresh] - Refreshing job lists");

            await this.getJobList(JobDataType.ALL);

            if (currentJobId) {
                const updatedJob = this.findJobInLocalLists(currentJobId);

                if (updatedJob) {
                    this.currentJob = updatedJob;
                    console.info("[NationwideRefresh] - Current job selection maintained via lookup map");
                } else {
                    this.currentJob = undefined;
                    this.toastrService.showWarningToast("Job list has been refreshed, but the selected job is no longer available on this page");
                }
            }

            console.info("[NationwideRefresh] - Job lists refresh complete");
            this.applyScope();
        } catch (error) {
            console.error("[NationwideRefresh] - Error refreshing job lists:", error);
            this.applyScope();
        }
    }

    static formatAirportCodeForDropdown(text: string): string {
        if (!text) return '';

        const spaceIndex = text.indexOf(' ');
        if (spaceIndex === -1) return text;
        return text.substring(0, spaceIndex + 1);
    }

    getConnectionTime(firstSegment: any, secondSegment: any): string {
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

    async openHubUrl(): Promise<void> {
        await this.navigationService.openHubUrl();
    }

    restoreJobAvaliable(job: IDispatchJob): boolean {
        if (!job) return false;
        if (job.assignedCourier) return true;
        if (job.assignedFlight) return true;

        return !!job.assignedAgent;
    }

    async openAgentSearchDialog($event: MouseEvent, job: IDispatchJob): Promise<void> {
        try {
            const url = "nationwideJob/GetAllAgentsSearch";
            const selectedAgent = await this.autoCompleteDialogService.showAutocompleteDialog($event, url, "Search all Agents", "Agent", "Agents", undefined);

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
            } else if (!this.isDeliveryJob(activeJob)) {
                this.showNotDeliveryJobMessage = true;
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
        this.showNotDeliveryJobMessage = false;
        this.showNoAgentsAvailableMessage = false;
        this.showAgentList = false;
    }

    async refreshAction(boxName: string): Promise<void> {
        console.info('[NationwideController] refreshing ', boxName);
        switch (boxName) {
            case NationwideBoxes.Tasks:
                await this.loadTasks();
                break;
            case NationwideBoxes.NewJobs:
                await this.getJobList(JobDataType.NEW);
                break;
            case NationwideBoxes.RepriceJobs:
                await this.getJobList(JobDataType.REPRICE);
                break;
            case NationwideBoxes.PodJobs:
                await this.getJobList(JobDataType.POD);
                break;
            case NationwideBoxes.JobDetail:
                if(!this.currentJobId) return;

                // Clear job
                const jobIdToRefresh = this.currentJobId;
                this.currentJobId = undefined;
                this.currentJob = undefined;

                // Reselect to trigger refresh
                const job = await this.DispatchData.getDispatchJobDetail(jobIdToRefresh);
                await this.selectJob(job);
                break;
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
            if(!newStopJobId) {
                setLoadingState(false);
                this.toastrService.showWarningToast("Failed to add stop to job");
                return;
            }
            
            const newStopJob = await this.DispatchData.getDispatchJobDetail(newStopJobId);
            await this.selectJob(newStopJob);
        } catch (error: any) {
            console.error('Error in addStopToJob:', error);
            this.toastrService.showErrorToast(
                error.message?.includes('loading') ? 'Error loading new stop job details' : 'Failed to add stop to job'
            );
        } finally {
            setLoadingState(false);
        }
    }

    async openAgentMoreInfo($event: MouseEvent, agent: IAgent): Promise<void> {
        await this.agentInfoDialogService.openAgentInfoDialog($event, agent.agentId);
    }

    refreshMap(): void {
        if (this.currentJob) {
            console.info('Manually refreshing map for current job');
            this.displayJobOnMap(this.currentJob);
        } else {
            console.warn('No current job to display on map');
        }
    }

    async openMessagingDialog($event: MouseEvent): Promise<void> {
        await this.messagingDialogService.openMessagingDialog($event);
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

    getJobContextMenuOptions(): (data: any) => any[] | IContextMenuOption[] {
        return (data: any) => this.getContextMenuOptions(data.job);
    }

    async openRecoveryAgentDialog($event: MouseEvent, job: IDispatchJob): Promise<void> {
        await this.recoveryAgentManagementService.openRecoveryAgentManagementDialog($event, job.id);
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
        console.info('Refresh interval changed to:', selectedInterval, 'seconds');

        this.selectedRefreshInterval = selectedInterval;

        if (Modernizr.localstorage && this.selectedRefreshInterval) {
            localStorage.setItem(`${this.refreshDurationIntervalKey}-${ContactID}`, this.selectedRefreshInterval?.id.toString());
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

        console.info(`Starting auto refresh every ${this.selectedRefreshInterval.id} seconds (${this.selectedRefreshInterval.text})`);

        this.isAutoRefreshEnabled = true;

        this.refreshIntervalPromise = this.registerInterval(async () => {
            if (this.isAutoRefreshEnabled) {
                console.info('Auto refreshing job lists...');
                try {
                    await this.getData();

                    // Also refresh tasks if a job is selected
                    if (this.currentJobId) {
                        await this.loadTasks();
                    }

                    console.info('Auto refresh completed successfully');
                } catch (error) {
                    console.error('Error during auto refresh:', error);
                }
            }
        }, this.selectedRefreshInterval.id * 1000);

        this.applyScope();
    }

    private stopAutoRefresh(): void {
        console.info('Stopping auto refresh');
        this.isAutoRefreshEnabled = false;

        if (this.refreshIntervalPromise) {
            const cancelled = this.cancelInterval(this.refreshIntervalPromise);
            if (cancelled) {
                console.info('Successfully cancelled refresh interval');
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
        console.log('refreshDataTimeSpan called with data ', dateFilterData);
        this.dateFilterData = dateFilterData;
        
        this.saveDateFilterToStorage();
        await this.getJobList();
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
