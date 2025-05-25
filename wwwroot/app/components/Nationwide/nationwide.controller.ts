import './nationwide.styles.less';
import NationwideService from "./nationwide.service";
import ToastrService from "../../services/toastr.service";
import DispatchCoreService from "../../services/dispatch-core.service";
import {AppPages} from "../../enums/app-pages.enum";
import {AppConfig} from "../../interfaces/app-config.interface";
import DispatchExecutorService from "../../services/dispatch-executor.service";
import {IAgent, IDispatchJob, JobQueryParams, Suggestion} from "../../interfaces/job.interface";
import {Coordinates} from "../overview/overview.interfaces";
import {HereMapsConfig, IFlightViewModel, StatusChangeEvent} from "./nationwide.interfaces";
import {IBox, IColumn, ILayout} from "../../interfaces/layout.interfaces";
import BaseController from "../base-controller";
import JobFileUploadDialogService from "../dialogs/job-file-upload-dialog/job-file-upload-dialog.service";
import JobDataType from "./enums/JobDataType";
import {DfrntPageViewModel} from "../../interfaces/dfrnt-page-view-model.interface";
import AddEventDialogService from "../dialogs/add-event-dialog/add-event-dialog.service";
import AdditionalServicesDialogService from "../dialogs/additional-services-dialog/additional-services-dialog.service";
import JobContextMenuService from "../../services/job-context-menu.service";
import {ExtendedTask, TaskTableFiltersRequest, TaskViewModel} from "../task-dashboard/task-dashboard.interfaces";
import {JobStatus} from "../../enums/job-status.enum";
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
import {isDeliveryJob} from "../../functions/isDeliveryJob";
import {isFlightJob} from "../../functions/isFlightJob";
import greetUser from '../../functions/greetUser';
import FlightAgentConfirmationDialogService
    from "../dialogs/flight-agent-conformation-dialog/flight-agent-confirmation-dialog.service";
import AgentInfoDialogService from "../dialogs/agent-info-dialog/agent-info-dialog.service";
import dayjs from "dayjs";

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
    ];

    public readonly nationwidePageId: number = AppPages.Domestic;
    public readonly isUsCustomer: boolean = false;

    layouts: any[] = [];
    defaultLayout?: any;
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
    jobFilters: JobQueryParams = {
        order: 'time',
        orderDirection: 'asc',
    };
    jobPodFilters: JobQueryParams = {
        order: 'time',
        orderDirection: 'asc',
    };
    jobRepriceFilters: JobQueryParams = {
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
    tasksLoading: boolean = false;
    filteredTasks: ExtendedTask[] = [];
    tasksFilter: string = 'all';
    tasks: ExtendedTask[] = [];
    taskItemConfig = {
        showAssign: true,
        showClose: true,
        showDelete: true,
        onTaskClick: true
    };
    currentSupport: any;
    activeAirlineOptions?: Suggestion[];
    timeZone: string;
    lastDepartureTime?: Date;
    airportOptions?: Suggestion[];
    selectedAirport?: Suggestion;
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
    dateSearchRange: number = 1;
    startDate: Date = dayjs(new Date(0)).toDate();
    endDate: Date = dayjs().add(24, 'hours').toDate();

    constructor(
        private $scope: angular.IScope,
        private nationwideService: NationwideService,
        $timeout: angular.ITimeoutService,
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
        private toastrService: ToastrService,
        private DispatchData: DispatchCoreService,
        private $mdSidenav: angular.material.ISidenavService,
        private appConfig: AppConfig,
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
    ) {
        super();
        this.initServices($timeout, $interval);

        this.isUsCustomer = this.appConfig.US_Customer;
        this.timeZone = TimeZone;
        this.browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        this.registerEvent(this.$scope, "angular-resizable.resizeEnd", (_, args: {
            id?: string,
            width: number,
            height: number
        }) => {
            const mapContainer = angular.element(args.id ? '#' + args.id : '').find('.here-map');
            if (mapContainer.length > 0) {
                this.$scope.$emit("map-container-resized", {
                    id: args.id,
                    width: args.width,
                    height: args.height
                });
                console.log("Map container resized: ", args.id);
            }
        });

        this.registerEvent<IJobReadChanged>(this.$scope, 'jobReadChanged', (_, data) => {
            this.markJobReadStatus(data.jobId, data.isRead);
        });

        this.registerEvent<IDispatchJob>(this.$scope, 'jobChanged', (_, newJob) => {
            if (this.currentJobId === newJob.id) {
                console.log(`Job ${newJob.jobNo} is already the current job, skipping reload`);
                return;
            }

            console.log(`Handling job changed event for job ${newJob.jobNo}`);

            // Set critical properties immediately
            this.currentJob = newJob;
            this.currentJobId = newJob.id;
            this.markJobReadStatus(newJob.id, true);
            this.isDeliveryJobType = this.isDeliveryJob(newJob);

            // Update UI first
            this.updateUIState(newJob);
            this.updateCurrentSelection(newJob.jobNo);

            // Then load related data asynchronously
            this.handleJobSelectionRelatedData(newJob).then(() => {
                console.log(`Data loaded for job ${newJob.jobNo}`);

                this.registerTimeout(() => {
                    try {
                        this.$scope.$applyAsync(() => {
                            this.updateUIState(newJob);
                        });
                    } catch (e) {
                        console.debug('Scope may be destroyed, ignoring update');
                    }
                }, 0);
            });
        });

        this.registerWatch(this.$scope, () => this.layout, () => {
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
                const storedLayouts: ILayout[] = JSON.parse(localStorage.getItem(`layoutsNW-${ContactID}`) || '[]');
                const lastActiveLayout = localStorage.getItem(`lastActiveLayoutNW-${ContactID}`);

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
        this.$scope.$watch("layout", (newValue: { columns: IColumn[] }, oldValue: { columns: IColumn[] }) => {
            if (newValue !== oldValue && this.currentLayoutName) {
                const index = this.layouts.findIndex((l: ILayout) => l.name === this.currentLayoutName);
                if (index !== -1) {
                    this.layouts[index].layout = angular.copy(newValue);
                    if (Modernizr.localstorage) {
                        localStorage.setItem(`layoutsNW-${ContactID}`, JSON.stringify(this.layouts));
                    }
                }
            }
        }, true);

        // Start loading data
        this.loadPageViews().then(() => {
            console.log('Loaded Page Views and Data!');
        });

        this.STATUS_TO_LIST_MAP = {
            1: [JobDataType.NEW],
            3: [JobDataType.POD],
            4: [JobDataType.REPRICE]
        };

        this.nationwideService.getActiveAirlines().then((response) => {
            console.log("[NationwideController] - Active Airlines:", response);
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
            "jobsList": {
                "title": "New Jobs",
                "icon": "new_releases",
                "templateUrl": "app/components/Nationwide/partials/jobList.html",
                "showSearch": 1,
                "showRefresh": 1
            },
            "jobsListPOD": {
                "title": "Awaiting POD",
                "icon": "pending_actions",
                "templateUrl": "app/components/Nationwide/partials/jobListPOD.html",
                "showSearch": 1,
                "showRefresh": 1
            },
            "tasksList": {
                "title": "Tasks",
                "icon": "support",
                "templateUrl": "app/components/Nationwide/partials/tasksList.html",
                "showSearch": 0,
                "showRefresh": 1
            },
            "jobsListReprice": {
                "title": "Reprice",
                "icon": "price_change",
                "templateUrl": "app/components/Nationwide/partials/jobListReprice.html",
                "showSearch": 1,
                "showRefresh": 1
            },
            "jobDetail": {
                "title": "Detail",
                "icon": "assignment",
                "templateUrl": "app/components/Nationwide/partials/jobDetail.html",
                "showSearch": 0,
                "showRefresh": 0,
                "showDetailButtons": 1
            },
            "map": {
                "title": "Map",
                "icon": "pin_drop",
                "templateUrl": "app/components/Nationwide/partials/map.html",
                "showSearch": 0,
                "showRefresh": 1
            },
            "flightAgentDataTable": {
                "title": "Available",
                "icon": "docs_add_on",
                "templateUrl": "app/components/Nationwide/partials/flightAgentDataTableBox.html",
                "showSearch": 0,
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

                // Update box metrics and save layout
                this.registerTimeout(() => {
                    this.updateBoxMetrics();
                    this.saveCurrentLayout();
                }, 100);
            }
        };
    }

    $onInit() {
        const jobId = this.$stateParams.jobId;
        if (jobId) {
            return this.loadPageViews()
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
            return this.loadPageViews();
        }
    }

    private updateBoxMetrics() {
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

    private saveCurrentLayout() {
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
                localStorage.setItem(`layoutsNW-${ContactID}`, JSON.stringify(this.layouts));
            }
        }
    }

    getJobStyle(assigned: boolean = false) {
        const normal = {
            "font-weight": "normal"
        }, bold = {
            "font-weight": "bold"
        };

        if (assigned) {
            return bold;
        } else {
            return normal;
        }
    }

    initHereMaps() {
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

    toggleSidenav() {
        this.$mdSidenav('right').toggle();
    }

    greetUser() {
        return greetUser(FirstName);
    }

    async loadPageViews() {
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

    initializeViews() {
        this.registerTimeout(() => {
            if (this.views && this.views.length > 0) {
                this.selectedViews = this.loadViewsFromStorage();

                this.views = this.views.map(view => ({
                    ...view, selected: this.selectedViews.some((v: DfrntPageViewModel) => v.id === view.id)
                }));

                if (this.selectedViews.length === 0) {
                    this.views[0].selected = true;
                    this.selectedViews.push(this.views[0]);
                    this.saveViewsToStorage(this.selectedViews);
                }

                this.viewsInitialized = true;
            }
        });
    }

    async toggleView(view: DfrntPageViewModel) {
        // Update the selectedViews array immediately instead of in a timeout
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

        // Save to storage after the changes
        this.saveViewsToStorage(this.selectedViews);

        // Now get data with the updated selectedViews
        await this.getData();
    }

    async jobRecordSearch(searchText: string) {
        if (!this.jobList) return;

        return this.jobList
            .filter(job => job.jobNo.toLowerCase().includes(searchText.toLowerCase()))
            .map(job => ({id: job.id, text: job.jobNo}));
    }

    jobRecordSelected(selectedJobId: number) {
        if (!this.jobList) return;

        const selectedJob = this.jobList.find(job => job.id === selectedJobId);
        if (!selectedJob) return;

        return this.selectJob(selectedJob);
    }

    loadLayout(index: number) {
        const layout: ILayout = this.layouts[index] || this.layouts[0];
        this.currentLayoutName = layout.name;
        this.currentLayoutIndex = index;
        this.layout = angular.copy(layout.layout);

        this.registerTimeout(() => {
            this.applyLayoutDimensions();

            if (Modernizr.localstorage) {
                localStorage.setItem(`lastActiveLayoutNW-${ContactID}`, layout.name);
            }
        });
    }

    async saveLayout() {
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
                localStorage.setItem(`layoutsNW-${ContactID}`, JSON.stringify(this.layouts));
                localStorage.setItem(`lastActiveLayoutNW-${ContactID}`, layoutName);
            }

            return currentLayout;
        } catch (error) {
            if (!error) {
                console.log("Save Layout Cancelled!");
            } else {
                console.error("Unable to save layout:", error);
            }

            return null;
        }
    }

    async deleteLayout(index: number) {
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
                localStorage.setItem(`layoutsNW-${ContactID}`, JSON.stringify(this.layouts));
            }

            if (this.currentLayoutName === this.layouts[index]?.name) {
                this.loadLayout(0);
            }

            this.toastrService.showSuccessToast("Layout deleted successfully");
        } catch (error) {
            this.handleError(error)
        }
    }

    private applyLayoutDimensions() {
        if (!this.layout || !this.layout.columns) return;

        this.registerTimeout(() => {
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
        }, 0, false);
    }

    saveViewsToStorage(views: any) {
        if (Modernizr.localstorage) {
            localStorage.setItem(`selectedViews-NW-${ContactID}`, JSON.stringify(views));
        }
    }

    loadViewsFromStorage() {
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

    async handleStatusChange(event: StatusChangeEvent) {
        try {
            console.log('Handle status change triggered!', {
                jobId: event.jobId,
                previousStatus: event.previousStatusId,
                newStatus: event.newStatusId
            });

            const listsToRefresh = new Set([
                ...(this.STATUS_TO_LIST_MAP[event.previousStatusId] || []),
                ...(this.STATUS_TO_LIST_MAP[event.newStatusId] || [])
            ]);
            console.log('Lists to refresh:', Array.from(listsToRefresh));

            await this.getJobList(Array.from(listsToRefresh));
            console.log('Job lists refreshed successfully');

            const relevantLists = [];
            if (listsToRefresh.has(JobDataType.NEW)) {
                relevantLists.push(...(this.jobList || []));
                console.log('Added NEW jobs list:', this.jobList?.length || 0, 'items');
            }
            if (listsToRefresh.has(JobDataType.POD)) {
                relevantLists.push(...(this.jobListPOD || []));
                console.log('Added POD jobs list:', this.jobListPOD?.length || 0, 'items');
            }
            if (listsToRefresh.has(JobDataType.REPRICE)) {
                relevantLists.push(...(this.jobListReprice || []));
                console.log('Added REPRICE jobs list:', this.jobListReprice?.length || 0, 'items');
            }
            console.log('Total relevant jobs collected:', relevantLists.length);

            // Find and reselect the updated job
            const refreshedJob = relevantLists.find(j => j.id === event.jobId);
            console.log(refreshedJob
                    ? 'Found updated job in refreshed lists'
                    : 'Updated job not found in refreshed lists',
                {jobId: event.jobId}
            );

            if (refreshedJob) {
                await this.selectJob(refreshedJob);
                console.log('Job reselected successfully');
            }

            this.registerTimeout(() => {
                console.log('UI update triggered after status change');
            });
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

    async onReorderJobList() {
        console.log('[onReorderJobList] Called with order:', this.jobFilters?.order);
        this.processOrderParam(this.jobFilters?.order, this.jobFilters);
        await this.getJobList(JobDataType.NEW);
    }

    async onReorderPodList() {
        console.log('[onReorderPodList] Called with order:', this.jobPodFilters?.order);
        this.processOrderParam(this.jobPodFilters?.order, this.jobPodFilters);
        await this.getJobList(JobDataType.POD);
    }

    async onReorderRepriceList() {
        console.log('[onReorderRepriceList] Called with order:', this.jobRepriceFilters?.order);
        this.processOrderParam(this.jobRepriceFilters?.order, this.jobRepriceFilters);
        await this.getJobList(JobDataType.REPRICE);
    }

    private processOrderParam(orderParam: string | undefined, filtersObj: JobQueryParams): void {
        let orderBy = orderParam || '';
        let orderDirection = "asc";

        if (orderBy && orderBy.startsWith("-")) {
            orderBy = orderBy.substring(1);
            orderDirection = "desc";
        }

        console.log(`Parsed order: ${orderBy}, direction: ${orderDirection}`);

        // Update filters with parsed values
        if (filtersObj) {
            filtersObj.order = orderBy;
            filtersObj.orderDirection = orderDirection;
        }
    }

    attention(job: IDispatchJob) {
        let temp = "";

        if (job.direct) {
            temp += "DIRECT ";
        }
        if (job.van) {
            temp += "VAN ";
        }
        if (job.truck || job.speedId === 45) {
            temp += "TRUCK ";
        }
        if (job.return) {
            temp += "RTN ";
        }
        if (job.size?.id === 2 && !job.van && !job.truck && job.speedId !== 45) {
            temp = "CAR " + temp;
        }
        if (job.size?.id === 5) {
            temp = "Scoot " + temp;
        }

        if (job.childNotes && job.childNotes?.length > 0) {
            temp += job.childNotes;
        }
        if (job.pickupFrom === 1) {
            temp += "R ";
        } else {
            if (job.pickupFrom === 2) {
                temp += "D ";
            }
        }

        if (job.saturdayDelivery) {
            temp += "Sat Del";
        }

        return temp.trim();
    }

    openSearch(boxName: string, index: number) {
        const boxID = boxName + '-' + index;
        if (this.showInput[boxID]) {
            this.showInput[boxID] = false;
            this.inputWidth[boxID] = 31;
        } else {
            this.inputWidth[boxID] = 200;
            this.showInput[boxID] = true;
        }
    }

    async unlockJob(currentJob: IDispatchJob) {
        await this.DispatchData.updateJobDetail(currentJob.id, JobProperty.Locked, false, currentJob.preBook ?? false)
    }

    async lockJob(currentJob: IDispatchJob) {
        await this.DispatchData.updateJobDetail(currentJob.id, JobProperty.Locked, true, currentJob.preBook ?? false)
    }

    async restoreJob(job: IDispatchJob) {
        try {
            await this.nationwideService.restoreJob(job.id);
            await this.getData();
        } catch (error) {
            console.error('Error restoring job:', error);
        }
    }

    async reAllocateJobs(job: IDispatchJob) {
        try {
            if (!job) return;

            await this.dispatchJobService.reallocateJob(job);
            await this.getData();
        } catch (error) {
            console.error('Error restoring job:', error);
        }
    }

    selectJobDetail(job: IDispatchJob) {
        this.currentJob = job;
    }

    async loadRelatedJobDetail(jobId: number, jobNumber: string) {
        try {
            const currentJob =
                this.jobList?.find(job => job.id === jobId) ||
                this.jobListPOD?.find(job => job.id === jobId) ||
                this.jobListReprice?.find(job => job.id === jobId);

            if (currentJob) {
                await this.selectJob(currentJob);
                this.currentSelection = ` for Job ${jobNumber}`;
            } else {
                console.warn(`Job with ID ${jobId} not found in any list`);
            }
        } catch (error) {
            console.error("Error in loadRelatedJobDetail:", error);
        }
    }

    async sendQuoteRequest($event: MouseEvent, agent: IAgent, job: IDispatchJob) {
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

    async selectJob(job: IDispatchJob) {
        try {
            if (!job) return;

            console.log(`Selecting job ${job.jobNo}`);

            this.markJobReadStatus(job.id, true);

            this.currentJob = job;
            this.currentJobId = job.id;

            // Set isDeliveryJobType flag
            this.isDeliveryJobType = this.isDeliveryJob(job);

            // Update UI first
            this.updateUIState(job);
            this.updateCurrentSelection(job.jobNo);

            // Display job on map before loading related data
            // Creating a slight delay can help ensure the UI is ready
            this.registerTimeout(() => {
                this.displayJobOnMap(job);
            }, 50);

            // Then load related data asynchronously
            await this.handleJobSelectionRelatedData(job);

            // Force another map update after all data is loaded
            this.registerTimeout(() => {
                console.log('Final UI update after job selection completed');
                this.updateUIState(job);

                // Update map again to ensure it's displaying correctly
                this.displayJobOnMap(job);
            }, 100);
        } catch (error) {
            console.error("Error in selectJob:", error);
        }
    }

    private async handleJobSelectionRelatedData(job: IDispatchJob) {
        // Reset data
        this.flightOptions = [];
        this.agentOptions = [];
        this.flightMessage = undefined;
        this.agentMessage = undefined;
        this.selected = null;
        this.selectedAirport = undefined;

        // Refresh tasks
        await this.loadTasks();

        // Pass job to updateUIState
        this.updateUIState(job);

        // Show flight table
        if (isFlightJob(job)) {
            console.log('[NationwideController] Getting nearby airports');
            this.airportOptions = await this.nationwideService.getNearbyAirports(job.id);
            console.log('[NationwideController] Got nearby airports:', this.airportOptions);

            if (this.airportOptions && this.airportOptions.length > 0) {
                const defaultAirport = this.airportOptions.find(airport => airport.id === job.fromAirportId);
                console.log('Default airport:', defaultAirport);
                if (defaultAirport) {
                    this.selectedAirport = defaultAirport;
                }
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

    private displayJobOnMap(job: IDispatchJob) {
        try {
            if (!job) {
                console.warn('No job provided to displayJobOnMap');
                return;
            }

            console.log(`Displaying job ${job.jobNo} on map`);

            // Create a completely new mapConfig object
            this.mapConfig = this.calculateMapBounds(job);

            // Force Angular to detect the change with $applyAsync
            this.$scope.$applyAsync(() => {
                console.log('Map config updated:', this.mapConfig);
            });
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
        return isDeliveryJob(job);
    }

    getFlightIcon(jobNumber: string) {
        if (!jobNumber) return '';

        const lastChar = jobNumber.toString().slice(-1);

        switch (lastChar) {
            case '1':
                return 'flight_takeoff';
            case '2':
                return 'local_airport';
            case '3':
                return 'flight_land';
            default:
                return '';
        }
    }

    private async processAgents(job: IDispatchJob) {
        console.log('Getting agents');

        // Clear existing agents while loading new ones
        this.agentOptions = [];
        this.agentMessage = undefined;

        this.agentsLoading = true;
        this.updateUIState(job);

        try {
            this.agentListPromise = this.nationwideService.getAgentOptions(job.id);
            const result = await this.agentListPromise;

            this.registerTimeout(() => {
                this.agentOptions = result.agents || [];
                this.agentMessage = result.message ||
                    (this.agentOptions.length === 0 ? "No agents available for this job" : undefined);

                // Update UI state after agents are loaded
                this.updateUIState(job);
            });

            console.log("Agent options loaded:", this.agentOptions.length);
        } catch (error) {
            console.error("Error fetching agents:", error);
            this.registerTimeout(() => {
                this.agentMessage = "An error occurred while loading agents. Please try again.";
                this.agentOptions = [];
                this.updateUIState(job);
            });
        } finally {
            this.registerTimeout(() => {
                this.agentsLoading = false;
                this.updateUIState(job);
            });
        }
    }

    async loadFlights(): Promise<void> {
        if (!this.currentJob) {
            this.flightOptions = [];
            this.flightMessage = "Please select a job to view flight options";
            this.updateUIState(); // No job parameter here will use currentJob
            return;
        }

        if (this.flightsLoading) {
            console.log("Flight loading already in progress, skipping duplicate request");
            return;
        }

        this.registerTimeout(() => {
            this.flightsLoading = true;
            this.updateUIState(this.currentJob);
        });

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

            // Filters
            const airlineId = this.selected?.airline?.id;
            const departureAirportId = this.selectedAirport?.id;
            const minimumLayoverMinutes = 60; // Set minimum layover minutes

            console.log('Loading flights with params:', {
                jobId: this.currentJob.id,
                departureDate: departureDate,
                airlineId: airlineId,
                departureAirportId: departureAirportId,
                minimumLayoverMinutes: minimumLayoverMinutes // Add minimum layover parameter
            });

            this.flightListPromise = this.nationwideService.getFlightOptions(
                this.currentJob.id,
                departureDate.toDate(),
                airlineId,
                departureAirportId,
                minimumLayoverMinutes // Pass minimum layover minutes
            );

            const result = await this.flightListPromise;

            this.registerTimeout(() => {
                this.flightOptions = result.flights || [];
                this.flightMessage = result.message || (result.flights.length === 0 ?
                    "No flights available for the selected criteria" : undefined);
                this.lastDepartureTime = result.lastDepartureTime;

                console.log(`Loaded ${this.flightOptions?.length} flights`);

                // Update UI state after flights are loaded
                this.updateUIState(this.currentJob);
            });
        } catch (error) {
            console.error("Error loading flights:", error);

            this.registerTimeout(() => {
                this.flightMessage = "An error occurred while loading flights. Please try again.";
                this.flightOptions = [];
                this.updateUIState(this.currentJob);
            });
        } finally {
            this.registerTimeout(() => {
                this.flightsLoading = false;
                this.updateUIState(this.currentJob);
            });
        }
    }

    resetAirportSelection() {
        this.selectedAirport = undefined;

        // Only trigger reload if we have a current job
        if (this.currentJob) {
            return this.onAirportSelectionChanged();
        }
    }

    async loadNextDayFlights() {
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

    async openFlightMoreInfo($event: MouseEvent, flight: IFlightViewModel) {
        await this.flightDetailsDialogService.openFlightDetailsDialog($event, flight);
    }

    async addFlightToJob($event: MouseEvent, flight: IFlightViewModel, job: IDispatchJob) {
        try {
            const result = await this.flightAgentConfirmationDialogService.flightConfirmationDialog($event, job, flight)
            if (!result.shouldAssign) return;

            console.log('Assigning to job');

            const previousInternalStatusId = job.internalStatusId ?? InternalJobStatus.NewJobs;
            const listsToRefresh = new Set([JobDataType.POD]);

            if (this.STATUS_TO_LIST_MAP[previousInternalStatusId]) {
                this.STATUS_TO_LIST_MAP[previousInternalStatusId].forEach((type: JobDataType) => listsToRefresh.add(type));
            }

            // Pass the full flight data including segments to the service
            await this.nationwideService.assignFlightToJob(
                job.id,
                flight.flightNumber,
                flight.departureTime,
                flight  // Pass the entire flight object with all segments
            );

            if (result.awb) {
                await this.DispatchData.updateJobDetail(job.id, JobProperty.ConNote, result.awb ?? '', false);
            }

            await this.getJobList(Array.from(listsToRefresh));

            let updatedJob = this.jobListPOD?.find(j => j.id === job.id);

            if (updatedJob) {
                await this.selectJob(updatedJob);
            }

            const successMessage = `Successfully assigned flight ${flight.flightNumber} to job ${job.jobNo}`;
            this.toastrService.showSuccessToast(successMessage);

            this.registerTimeout(() => {
                console.log('UI updated after flight assignment');
            });
        } catch (error) {
            this.handleError(error);

            this.registerTimeout(() => {
                console.log('UI updated after flight assignment error');
            });
        }
    }

    async addAgentToJob($event: MouseEvent, agent: IAgent, job: IDispatchJob) {
        const selectedAgent: Suggestion = {
            id: agent.agentId, text: agent.agentName
        };

        await this.addSelectedAgentToJob($event, selectedAgent, job)
    }

    async addSelectedAgentToJob($event: MouseEvent, agent: Suggestion, job: IDispatchJob) {
        try {
            const result = await this.flightAgentConfirmationDialogService.agentConfirmationDialog($event, job, agent)
            if (!result.shouldAssign) return;

            console.log('Assigning to job');

            await this.nationwideService.assignAgentToJob(job.id, agent.id);

            if (result.awb) {
                await this.DispatchData.updateJobDetail(job.id, JobProperty.ConNote, result.awb, false);
            }

            await this.getJobList([JobDataType.NEW, JobDataType.POD]);

            const successMessage = (`Successfully assigned agent ${agent.text} to job ${job.jobNo}`)
            this.toastrService.showSuccessToast(successMessage);

            this.registerTimeout(() => {
                console.log('UI updated after agent assignment');
            });
        } catch (error) {
            this.handleError(error);

            this.registerTimeout(() => {
                console.log('UI updated after agent assignment error');
            });
        }
    }

    async filterNewJobsByStatus(statusGroup: string) {
        console.log('filterNewJobsByStatus called with:', statusGroup);
        this.jobFilters.order = statusGroup;
        await this.getJobList(JobDataType.NEW);
        console.log(`Jobs filtered by status group: ${statusGroup}`);
    }

    async filterPodJobsByStatus(statusGroup: string) {
        console.log('filterPodJobsByStatus called with:', statusGroup);
        this.jobPodFilters.order = statusGroup;
        await this.getJobList(JobDataType.POD);
        console.log(`POD jobs filtered by status group: ${statusGroup}`);
    }

    async filterRepriceJobsByStatus(statusGroup: string) {
        console.log('filterRepriceJobsByStatus called with:', statusGroup);
        this.jobRepriceFilters.order = statusGroup;
        await this.getJobList(JobDataType.REPRICE);
        console.log(`Reprice jobs filtered by status group: ${statusGroup}`);
    }

    getNewJobsStatusCount(statusGroup: string): number {
        return this.getStatusCount(statusGroup, JobDataType.NEW);
    }

    getPodJobsStatusCount(statusGroup: string): number {
        return this.getStatusCount(statusGroup, JobDataType.POD);
    }

    getRepriceJobsStatusCount(statusGroup: string): number {
        return this.getStatusCount(statusGroup, JobDataType.REPRICE);
    }

    getStatusCount(statusType: string, jobDataType: JobDataType): number {
        let jobList: IDispatchJob[] | undefined;

        switch (jobDataType) {
            case JobDataType.NEW:
                jobList = this.jobList;
                break;
            case JobDataType.POD:
                jobList = this.jobListPOD;
                break;
            case JobDataType.REPRICE:
                jobList = this.jobListReprice;
                break;
            default:
                return 0;
        }

        if (!jobList || !Array.isArray(jobList)) {
            return 0;
        }

        const normalizedStatusType = statusType.toLowerCase().replace(/\s+/g, '-');

        const statusGroups: Record<string, JobStatus[]> = {
            'pending': [
                JobStatus.New,
                JobStatus.Dispatched,
                JobStatus.ReadyForPacking,
                JobStatus.ReadyToPickup,
                JobStatus.AwaitingProcessing,
                JobStatus.Preassigned
            ],
            'in-transit': [
                JobStatus.Accepted,
                JobStatus.PickedUp,
                JobStatus.InTransit,
                JobStatus.OutForDelivery
            ],
            'completed': [
                JobStatus.Completed,
                JobStatus.AssumingCompleted
            ],
            'problem': [
                JobStatus.Rejected,
                JobStatus.LatePickup,
                JobStatus.Warning,
                JobStatus.LateDelivery,
                JobStatus.AwaitingPod,
                JobStatus.Undeliverable
            ]
        };

        // Check if we're looking for a status group
        if (statusGroups[normalizedStatusType]) {
            return jobList.filter(job =>
                job.statusId !== undefined &&
                statusGroups[normalizedStatusType].includes(job.statusId)
            ).length;
        }

        // Otherwise, check for a specific status name match
        return jobList.filter(job => {
            if (!job.statusName) {
                return false;
            }
            const normalizedJobStatus = job.statusName.toLowerCase().replace(/\s+/g, '-');
            return normalizedJobStatus === normalizedStatusType;
        }).length;
    }

    private updateDateFilters(dataTypes: JobDataType | JobDataType[] = JobDataType.ALL) {
        if (dataTypes.includes(JobDataType.NEW)) {
            this.jobFilters.startDate = this.startDate;
            this.jobFilters.dateCutoff = this.endDate;
        }
        if (dataTypes.includes(JobDataType.POD)) {
            this.jobPodFilters.startDate = this.startDate;
            this.jobPodFilters.dateCutoff = this.endDate;
        }
        if (dataTypes.includes(JobDataType.REPRICE)) {
            this.jobRepriceFilters.startDate = this.startDate;
            this.jobRepriceFilters.dateCutoff = this.endDate;
        }
    }

    async getJobList(dataTypes: JobDataType | JobDataType[] = JobDataType.ALL): Promise<void> {

        // Ensure views are initialized before proceeding
        if (!this.viewsInitialized && this.selectedViews.length === 0) {
            console.log('Views not initialized yet, loading defaults');
            this.selectedViews = this.loadViewsFromStorage();

            // If still no views, add at least one default view
            if (this.selectedViews.length === 0 && this.views.length > 0) {
                this.selectedViews = [this.views[0]];
            }
        }

        const selectedClients = this.pickService.clients.map((a: { id: number }) => a.id);

        // Convert input to an array of types
        const types = Array.isArray(dataTypes) ? dataTypes : [dataTypes];

        // If ALL is included, convert it to all specific job types (NEW, POD, REPRICE)
        // This ensures that passing JobDataType.ALL will fetch all job types
        const requestedTypes = types.includes(JobDataType.ALL)
            ? [JobDataType.NEW, JobDataType.POD, JobDataType.REPRICE]
            : types;

        this.updateDateFilters(requestedTypes);

        // Set loading states
        this.registerTimeout(() => {
            if (requestedTypes.includes(JobDataType.NEW)) this.jobListLoading = true;
            if (requestedTypes.includes(JobDataType.POD)) this.podListLoading = true;
            if (requestedTypes.includes(JobDataType.REPRICE)) this.repriceListLoading = true;
        });

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
                this.registerTimeout(() => {
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
            });

            await tasksPromise;
        } catch (error) {
            console.error("Error fetching job data:", error);

            // Reset loading states
            this.registerTimeout(() => {
                if (requestedTypes.includes(JobDataType.NEW)) this.jobListLoading = false;
                if (requestedTypes.includes(JobDataType.POD)) this.podListLoading = false;
                if (requestedTypes.includes(JobDataType.REPRICE)) this.repriceListLoading = false;
            });
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

    async getData() {
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

    jobClass(job: IDispatchJob): string {
        if (!job || !job.followupTime) {
            return '';
        }

        const followupTime = dayjs(job.followupTime);
        const now = dayjs();
        const diffMinutes = followupTime.diff(now, 'minutes');

        if (diffMinutes > 30) {
            return 'status-future';
        } else if (diffMinutes < -30) {
            return 'status-past';
        } else {
            return 'status-current';
        }
    }

    private handleError(error: any) {
        if (!error) {
            console.log('User canceled!');
        } else {
            console.error('Error assigning flight to job:', error);
        }
    }

    async createEvent($event: MouseEvent, job: IDispatchJob) {
        await this.addEventDialogService.openAddEventDialog($event, job);
    }

    getContextMenuOptions(job: IDispatchJob) {
        if (!job) return [];

        const callbacks = {
            onRefresh: () => this.getData(),
            onSplitJob: (params: { job: IDispatchJob }) => this.handleSplitJob(params.job),
            onRefreshCourierJobs: (params: { courierId: number }) => {
                console.log('Refreshing courier jobs:', params.courierId);
            }
        };

        return this.jobContextMenuService.getMenuOptions(job, callbacks);
    }

    async handleSplitJob(job: IDispatchJob) {
        if (!job) return;

        try {
            console.log("Split job requested for:", job.id);

            await this.getData();
        } catch (error: any) {
            console.error("Error handling split job:", error);
        }
    }

    // Tasks
    private buildFilterRequest(filterType: string): TaskTableFiltersRequest {
        let filterRequest: TaskTableFiltersRequest = {};
        filterRequest.jobId = this.currentJobId;
        filterRequest.showCompleted = false;

        switch (filterType) {
            case 'mine':
                filterRequest.staffId = ContactID;
                filterRequest.orderBy = 'assignedTo';
                filterRequest.orderDirection = 'desc';
                break;
            case 'unassigned':
                filterRequest.staffId = -1;
                filterRequest.orderBy = 'assignedTo';
                filterRequest.orderDirection = 'desc';
                break;
            case 'newest':
                filterRequest.orderBy = 'created';
                filterRequest.orderDirection = 'desc';
                break;
            case 'oldest':
                filterRequest.orderBy = 'created';
                filterRequest.orderDirection = 'asc';
                break;
            default:
                filterRequest.orderBy = 'created';
                filterRequest.orderDirection = 'desc';
                break;
        }

        return filterRequest;
    }

    getTasksStatusCount(statusType: string): number {
        if (!this.tasks || !Array.isArray(this.tasks)) return 0;

        switch (statusType) {
            case 'mine':
                return this.tasks.filter(task => task.assignee.id === ContactID).length;
            case 'unassigned':
                return this.tasks.filter(task => !task.assignee.id).length;
            case 'newest':
                // For newest/oldest filters, we return the total count since they're
                // sorting options rather than filtering options
                return this.tasks.length;
            case 'oldest':
                return this.tasks.length;
            default:
                return this.tasks.length;
        }
    }

    async filterTasksByStatus(statusType: string): Promise<void> {
        this.tasksFilter = statusType;
        await this.loadTasks(statusType);
    }

    async loadTasks(filterType: string = this.tasksFilter) {
        try {
            this.registerTimeout(() => {
                this.tasksLoading = true;
            });

            // Build filter request based on a filter type
            const filterRequest = this.buildFilterRequest(filterType);

            try {
                this.tasks = await this.DispatchData.getAllTasks(filterRequest);

                this.registerTimeout(() => {
                    this.filteredTasks = this.tasks;

                    // Apply additional client-side filtering if needed
                    if (filterType === 'mine') {
                        this.filteredTasks = this.tasks.filter(task => task.assignee.id === ContactID);
                    } else if (filterType === 'unassigned') {
                        this.filteredTasks = this.tasks.filter(task => !task.assignee.id);
                    }
                });
            } catch (serviceError) {
                console.error("Service error getting tasks:", serviceError);
                this.toastrService.showErrorToast("Failed to load tasks");

                this.registerTimeout(() => {
                    this.tasks = [];
                    this.filteredTasks = [];
                });
            }

            this.tasksLoading = false;
        } catch (error) {
            console.error("Error loading tasks:", error);
            this.toastrService.showErrorToast("Error loading tasks");
            this.tasksLoading = false;
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
            // First, try to find the job in local lists
            let attachedJob = this.findJobInLocalLists(task.jobId);

            // If not found locally, fetch from a database
            if (!attachedJob) {
                attachedJob = await this.DispatchData.getDispatchJobDetail(task.jobId);
            }

            if (!attachedJob) {
                this.toastrService.showWarningToast("This task has no job attached");
                console.warn('[selectTaskJobDetail] No job found for jobId:', task.jobId);
                return;
            }

            await this.selectJob(attachedJob);
            console.log('[selectTaskJobDetail] Job selected successfully');

            this.updateCurrentSelection(attachedJob.jobNo);
        } catch (error) {
            this.handleError(error);
        }
    }

    private logTaskInfo(task: TaskViewModel): void {
        console.log('[selectTaskJobDetail] Starting with task:', {
            jobId: task.jobId,
            jobNumber: task.jobNumber,
            taskId: task.id
        });
    }

    private validateJobId(task: TaskViewModel): boolean {
        const hasJobId = !!task.jobId;
        if (!hasJobId) {
            const message = "This task has no job attached";
            this.toastrService.showWarningToast(message);
            console.warn('[selectTaskJobDetail] No jobId provided, returning early');
        }
        return hasJobId;
    }

    private findJobInLocalLists(jobId: number) {
        console.log('[selectTaskJobDetail] Fetching job details for jobId:', jobId);

        return this.jobList?.find((job) => job.id === jobId) ||
            this.jobListPOD?.find((job) => job.id === jobId) ||
            this.jobListReprice?.find((job) => job.id === jobId);
    }

    private updateCurrentSelection(jobNo: string): void {
        this.currentSelection = ` for Job ${jobNo}`;
    }

    async filterFlightsByAirline(airlineId?: number): Promise<void> {
        if (!this.currentJob) {
            return;
        }

        // Store the airline selection
        this.selected = {airline: {id: airlineId}};

        // Reset search
        this.lastDepartureTime = undefined;

        // Call loadFlights which will use the updated selected airline
        await this.loadFlights();
    }

    async onAirportSelectionChanged(): Promise<void> {
        // Reset search when changing airport filter
        this.lastDepartureTime = undefined;

        console.log('Airport selection changed to:',
            this.selectedAirport ? this.selectedAirport.text : 'All airports');

        // Add loading indicator
        this.registerTimeout(() => {
            this.flightsLoading = true;
        });

        try {
            // Reload flights with the new airport selection
            await this.loadFlights();
        } catch (error) {
            console.error('Error loading flights after airport change:', error);
        } finally {
            this.registerTimeout(() => {
                this.flightsLoading = false;
            });
        }
    }

    private markJobReadStatus(jobId: number, isRead: boolean) {
        const updateJobList = (list?: IDispatchJob[]) => {
            if (!list) return;

            const jobIndex = list.findIndex((job) => job.id === jobId);
            if (jobIndex !== -1) {
                list[jobIndex].hasBeenRead = isRead;
            }
        };

        this.$scope.$applyAsync(() => {
            updateJobList(this.jobList);
            updateJobList(this.jobListPOD);
            updateJobList(this.jobListReprice);
        });
    }

    getUnreadNewCount() {
        if (!this.jobList) return;
        return this.jobList.filter(job => !job.hasBeenRead).length;
    }

    getUnreadPodCount() {
        if (!this.jobListPOD) return;
        return this.jobListPOD.filter(job => !job.hasBeenRead).length;
    }

    getUnreadRepriceCount() {
        if (!this.jobListReprice) return;
        return this.jobListReprice.filter(job => !job.hasBeenRead).length;
    }

    async refreshJobLists(currentJobId?: number) {
        try {
            console.log("[NationwideRefresh] - Refreshing job lists");

            // Get updated job lists
            await this.getJobList(JobDataType.ALL);

            // Restore current job selection if applicable
            if (currentJobId) {
                // Find the refreshed job in any of the job lists
                const updatedJob = this.findJobInLocalLists(currentJobId);

                this.registerTimeout(() => {
                    if (updatedJob) {
                        this.currentJob = updatedJob;
                        console.log("[NationwideRefresh] - Current job selection maintained");
                    } else {
                        this.currentJob = undefined;
                        this.toastrService.showWarningToast("Job list has been refreshed, but the selected job is no longer available on this page");
                    }
                });
            }

            console.log("[NationwideRefresh] - Job lists refresh complete");
        } catch (error) {
            console.error("[NationwideRefresh] - Error refreshing job lists:", error);
        }
    }

    formatAirportCodeForDropdown(text: string) {
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

    async openHubUrl() {
        await this.navigationService.openHubUrl();
    }

    restoreJobAvaliable(job: IDispatchJob): boolean {
        if (!job) return false;
        if (job.assignedCourier) return true;
        if (job.assignedFlight) return true;

        return !!job.assignedAgent;
    }

    async openAgentSearchDialog($event: MouseEvent, job: IDispatchJob) {
        try {
            const url = "nationwideJob/GetAllAgentsSearch";
            const selectedAgent = await this.autoCompleteDialogService.showAutocompleteDialog($event, url, "Search all Agents", "Agent", "Agents", null);

            await this.addSelectedAgentToJob($event, selectedAgent, job);
        } catch (error) {
            this.handleError(error);
        }
    }

    private updateUIState(job?: IDispatchJob) {
        this.$scope.$applyAsync(() => {
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
        });
    }

    private resetAllFlags() {
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

    async refreshAction(boxName: string) {
        console.log('[NationwideController] refreshing ', boxName);
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
            default:
                break;
        }
    }

    async onSearchRangeChange(optionSelected: number) {
        if (optionSelected != 1) return;

        // Set for 24 hours
        this.startDate = dayjs(new Date(0)).toDate();
        this.endDate = dayjs().add(24, 'hours').toDate();

        await this.getData();
    }

    async addStopToJob($event: MouseEvent, job: IDispatchJob) {
        await this.jobAddStopService.addNewStop(job, $event);

        // Refresh job
        this.currentJobId = undefined;
        this.currentJobId = job.id;
        this.currentJob = job;
    }

    async openAgentMoreInfo($event: MouseEvent, agent: IAgent) {
        await this.agentInfoDialogService.openAgentInfoDialog($event, agent.agentId);
    }

    refreshMap() {
        if (this.currentJob) {
            console.log('Manually refreshing map for current job');
            this.displayJobOnMap(this.currentJob);
        } else {
            console.warn('No current job to display on map');
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
