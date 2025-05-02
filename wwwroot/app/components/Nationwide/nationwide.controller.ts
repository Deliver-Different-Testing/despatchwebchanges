import './nationwide.styles.less';
import NationwideService from "./nationwide.service";
import GreetingService from "../../services/greeting.service";
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
import moment from "moment";
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

class NationwideControl extends BaseController {
    static $inject = [
        '$scope',
        'NWData',
        '$timeout',
        'greetingService',
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
    ];

    readonly nationwidePageId: number = AppPages.Domestic;
    readonly isUsCustomer: boolean = false;
    private refreshInterval?: angular.IPromise<any>;

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
    mapConfig?: HereMapsConfig;
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

    constructor(
        private $scope: angular.IScope,
        private nationwideService: NationwideService,
        private $timeout: angular.ITimeoutService,
        private greetingService: GreetingService,
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
        private $interval: angular.IIntervalService,
        private flightDetailsDialogService: FlightDetailsDialogService,
        private navigationService: NavigationService,
        private configService: ConfigService,
        private autoCompleteDialogService: AutoCompleteDialogService,
    ) {
        super();

        this.isUsCustomer = this.appConfig.US_Customer;
        this.timeZone = TimeZone;

        this.$scope.$on("angular-resizable.resizeEnd", (_, args) => {
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

        this.$scope.$on('jobReadChanged', (_, data: IJobReadChanged) => {
            this._markJobReadStatus(data.jobId, data.isRead);
        });

        this.$scope.$watch(() => this.layout, () => {
            this.$timeout(() => this._applyLayoutDimensions());
        }, true);

        if (angular.element('#draggingItems').length === 0) {
            angular.element('body').append('<div id="draggingItems"></div>');
        }

        this.initHereMaps();

        const jobsListBox: IBox = {name: "jobsList", height: "60%"};
        const jobsListPODBox: IBox = {name: "jobsListPOD", height: "40%"};
        const tasksListBox: IBox = {name: "tasksList", height: "50%"};
        const jobsListRepriceBox: IBox = {name: "jobsListReprice", height: "50%"};
        const mapBox: IBox = {name: "map", height: "30%"};
        const jobDetailBox: IBox = {name: "jobDetail", height: "60%"};
        const flightAgentDataTableBox: IBox = {name: "flightAgentDataTable", height: "30%"};

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
                this.layouts[0] = this.defaultLayout; // Ensure default is always up-to-date

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
                this.$timeout(() => {
                    this._updateBoxMetrics();
                    this._saveCurrentLayout();
                }, 100);
            }
        };
    }

    $onInit() {
        this.refreshInterval = this.$interval(async () => {
            console.log("[NationwideController] - Refreshing tasks and job lists");

            // Store current state before refresh
            const currentJobId = this.currentJob?.id;

            // Refresh tasks
            await this.loadTasks();

            // Refresh job lists while preserving selections
            await this.refreshJobLists(currentJobId);
        }, 60000);
    }

    $onDestroy() {
        if (this.refreshInterval) {
            this.$interval.cancel(this.refreshInterval);
        }
    }

    private _updateBoxMetrics() {
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

    private _saveCurrentLayout() {
        if (!this.currentLayoutName || this.currentLayoutName === 'Default') {
            return;
        }

        this._updateBoxMetrics();

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
        this.configService.getHereMapsKey().then((response) => {
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
        return this.greetingService.greetUser(FirstName);
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
        this.$timeout(() => {
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
            }
        });
    }

    async toggleView(view: DfrntPageViewModel) {
        this.$timeout(() => {
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
        });

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

        this.$timeout(() => {
            this._applyLayoutDimensions();

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

            this._updateBoxMetrics();

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
            this._handleError(error)
        }
    }

    private _applyLayoutDimensions() {
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

            this.$timeout(() => {
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
        this._processOrderParam(this.jobFilters?.order, this.jobFilters);
        await this.getJobList(JobDataType.NEW);
    }

    async onReorderPodList() {
        console.log('[onReorderPodList] Called with order:', this.jobPodFilters?.order);
        this._processOrderParam(this.jobPodFilters?.order, this.jobPodFilters);
        await this.getJobList(JobDataType.POD);
    }

    async onReorderRepriceList() {
        console.log('[onReorderRepriceList] Called with order:', this.jobRepriceFilters?.order);
        this._processOrderParam(this.jobRepriceFilters?.order, this.jobRepriceFilters);
        await this.getJobList(JobDataType.REPRICE);
    }

    private _processOrderParam(orderParam: string | undefined, filtersObj: JobQueryParams): void {
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
        if (job.truck || job.speedID === 45) {
            temp += "TRUCK ";
        }
        if (job.return) {
            temp += "RTN ";
        }
        if (job.size?.id === 2 && !job.van && !job.truck && job.speedID !== 45) {
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

            this._markJobReadStatus(job.id, true);

            this.currentJob = job;
            this.currentJobId = job.id;

            // Reset data
            this.flightOptions = [];
            this.agentOptions = [];
            this.flightMessage = undefined;
            this.agentMessage = undefined;
            this.selected = null;
            this.selectedAirport = undefined;

            // Show flight table
            if (job.toAirportId && job.fromAirportId) {
                this.airportOptions = await this.nationwideService.getNearbyAirports(job.id);

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
            if (this.isDeliveryJob()) {
                await this._processAgents(job);
            }

            this._displayJobOnMap(job);

            this.$timeout(() => {
                console.log('Final UI update after job selection completed');
            });
        } catch (error) {
            console.error("Error in selectJob:", error);
        }
    }

    private _displayJobOnMap(job: IDispatchJob) {
        try {
            this.mapConfig = this._calculateMapBounds(job);
            console.log('Calculated map bounds!');
            console.log(this.mapConfig);
        } catch (error) {
            console.error(error);
            this.toastrService.showErrorToast('An unexpected error occured displaying this job on the map');
        }
    }

    private _calculateMapBounds(job: IDispatchJob) {
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
        if (maxDiff > 40) zoom = 3; else if (maxDiff > 20) zoom = 4; else if (maxDiff > 10) zoom = 5; else if (maxDiff > 5) zoom = 6; else if (maxDiff > 2) zoom = 7; else if (maxDiff > 1) zoom = 8; else if (maxDiff > 0.5) zoom = 9; else if (maxDiff > 0.1) zoom = 10; else zoom = 12;

        return {
            center: {
                lat: centerLat, lng: centerLng
            }, zoom: zoom, job: {
                id: job.id, pickup: pickupCoords, delivery: deliveryCoords, childJobs: {}
            }, selectedJobIndex: 0
        };
    }

    isDeliveryJob(): boolean {
        if (!this.currentJob || !this.currentJob.jobNo) {
            return false;
        }

        const jobNumber = this.currentJob.jobNo;
        const isDeliveryJob = jobNumber.charAt(jobNumber.length - 1) === '1' || jobNumber.charAt(jobNumber.length - 1) === '3';

        console.log(jobNumber + " is delivery job!");
        return isDeliveryJob;
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

    private async _processAgents(job: IDispatchJob) {
        console.log('Getting agents');

        // Clear existing agents while loading new ones
        this.agentOptions = [];
        this.agentMessage = undefined;

        this.agentsLoading = true;

        try {
            this.agentListPromise = this.nationwideService.getAgentOptions(job.id);
            const result = await this.agentListPromise;

            this.$timeout(() => {
                this.agentOptions = result.agents || [];
                this.agentMessage = result.message ||
                    (this.agentOptions.length === 0 ? "No agents available for this job" : undefined);
            });

            console.log("Agent options loaded:", this.agentOptions.length);
        } catch (error) {
            console.error("Error fetching agents:", error);
            this.$timeout(() => {
                this.agentMessage = "An error occurred while loading agents. Please try again.";
                this.agentOptions = [];
            });
        } finally {
            this.$timeout(() => {
                this.agentsLoading = false;
            });
        }
    }

    async loadFlights(): Promise<void> {
        if (!this.currentJob) {
            this.flightOptions = [];
            this.flightMessage = "Please select a job to view flight options";
            return;
        }

        if (this.flightsLoading) {
            console.log("Flight loading already in progress, skipping duplicate request");
            return;
        }

        this.$timeout(() => {
            this.flightsLoading = true;
        });

        try {
            // Get either the saved departure time, last departure time, or current time
            const departureDate = this.lastDepartureTime ||
                this.currentJob.departureTime ||
                new Date();

            // Filters
            const airlineId = this.selected?.airline?.id;
            const departureAirportId = this.selectedAirport?.id;

            console.log('Loading flights with params:', {
                jobId: this.currentJob.id,
                departureDate: departureDate,
                airlineId: airlineId,
                departureAirportId: departureAirportId
            });

            this.flightListPromise = this.nationwideService.getFlightOptions(
                this.currentJob.id,
                departureDate,
                airlineId,
                departureAirportId
            );

            const result = await this.flightListPromise;

            this.$timeout(() => {
                this.flightOptions = result.flights || [];
                this.flightMessage = result.message || (result.flights.length === 0 ?
                    "No flights available for the selected criteria" : undefined);
                this.lastDepartureTime = result.lastDepartureTime;

                console.log(`Loaded ${this.flightOptions?.length} flights`);
            });
        } catch (error) {
            console.error("Error loading flights:", error);

            this.$timeout(() => {
                this.flightMessage = "An error occurred while loading flights. Please try again.";
                this.flightOptions = [];
            });
        } finally {
            this.$timeout(() => {
                this.flightsLoading = false;
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
        if (this.lastDepartureTime) {
            const nextDay = new Date(this.lastDepartureTime);
            nextDay.setHours(0, 0, 0, 0);
            nextDay.setDate(nextDay.getDate() + 1);
            this.lastDepartureTime = nextDay;
        } else {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            this.lastDepartureTime = tomorrow;
        }

        return this.loadFlights();
    }

    async openFlightMoreInfo($event: MouseEvent, flight: IFlightViewModel) {
        await this.flightDetailsDialogService.openFlightDetailsDialog($event, flight.flightNumber, flight.departureTime, flight.stops);
    }

    async addFlightToJob($event: MouseEvent, flight: IFlightViewModel, job: IDispatchJob) {
        try {
            const confirm = this.$mdDialog.confirm()
                .title('Assign Flight')
                .textContent(`You are assigning to Job ${job.jobNo} to ${flight.flightNumber}. Please confirm this is correct.`)
                .ariaLabel('confirm assign flight to job')
                .targetEvent($event)
                .ok('Confirm')
                .cancel('Cancel');

            await this.$mdDialog.show(confirm);
            console.log('Assigning to job');

            const previousInternalStatusId = job.internalStatusId ?? 1;
            const listsToRefresh = new Set([JobDataType.POD]);

            if (this.STATUS_TO_LIST_MAP[previousInternalStatusId]) {
                this.STATUS_TO_LIST_MAP[previousInternalStatusId].forEach((type: JobDataType) => listsToRefresh.add(type));
            }

            await this.nationwideService.assignFlightToJob(job.id, flight.flightNumber, flight.departureTime);
            await this.getJobList(Array.from(listsToRefresh));

            let updatedJob = this.jobListPOD?.find(j => j.id === job.id);

            if (updatedJob) {
                await this.selectJob(updatedJob);
            }

            const successMessage = `Successfully assigned flight ${flight.flightNumber} to job ${job.jobNo}`;
            this.toastrService.showSuccessToast(successMessage);

            this.$timeout(() => {
                console.log('UI updated after flight assignment');
            });
        } catch (error) {
            this._handleError(error);

            this.$timeout(() => {
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
            const confirm = this.$mdDialog.confirm()
                .title('Assign Agent')
                .textContent(`You are assigning Job ${job.jobNo} to ${agent.text}. Please confirm this is correct.`)
                .ariaLabel('confirm assign flight to job')
                .targetEvent($event)
                .ok('Confirm')
                .cancel('Cancel');

            await this.$mdDialog.show(confirm);
            console.log('Assigning to job');

            await this.nationwideService.assignAgentToJob(job.id, agent.id);

            await this.getJobList([JobDataType.NEW, JobDataType.POD]);

            const successMessage = (`Successfully assigned agent ${agent.text} to job ${job.jobNo}`)
            this.toastrService.showSuccessToast(successMessage);

            this.$timeout(() => {
                console.log('UI updated after agent assignment');
            });
        } catch (error) {
            this._handleError(error);

            this.$timeout(() => {
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


    async getJobList(dataTypes: JobDataType | JobDataType[] = JobDataType.ALL) {
        const selectedClients = this.pickService.clients.map((a: { id: number }) => a.id);
        const types = Array.isArray(dataTypes) ? dataTypes : [dataTypes];
        const requestedTypes = types.includes(JobDataType.ALL) ?
            Object.values(JobDataType).filter(type => type !== JobDataType.ALL) :
            types;

        try {
            this.$timeout(() => {
                if (requestedTypes.includes(JobDataType.NEW)) {
                    this.jobListLoading = true;
                }
                if (requestedTypes.includes(JobDataType.POD)) {
                    this.podListLoading = true;
                }
                if (requestedTypes.includes(JobDataType.REPRICE)) {
                    this.repriceListLoading = true;
                }
            });

            const loadingStates: Record<JobDataType.NEW | JobDataType.POD | JobDataType.REPRICE, () => void> = {
                [JobDataType.NEW]: () => {
                    this.jobListPromise = this.nationwideService.getNationwideJobsNew(
                        this.jobFilters || {},
                        selectedClients,
                        ClientInternal,
                        this.selectedViews
                    );
                },
                [JobDataType.POD]: () => {
                    this.podListPromise = this.nationwideService.getNationwideJobsPOD(
                        this.jobPodFilters || {},
                        selectedClients,
                        ClientInternal,
                        this.selectedViews
                    );
                },
                [JobDataType.REPRICE]: () => {
                    this.repriceListPromise = this.nationwideService.getNationwideJobsReprice(
                        this.jobRepriceFilters || {},
                        selectedClients,
                        ClientInternal,
                        this.selectedViews
                    );
                }
            };

            requestedTypes.forEach((type) => {
                if (type === JobDataType.NEW || type === JobDataType.POD || type === JobDataType.REPRICE) {
                    loadingStates[type]?.();
                }
            });

            const fetchMap: Record<Exclude<JobDataType, JobDataType.ALL>, {
                fetch: () => Promise<IDispatchJob[]>;
                updateScope: (result: IDispatchJob[]) => void;
            }> = {
                [JobDataType.NEW]: {
                    fetch: () => {
                        if (!this.jobListPromise) {
                            throw new Error('Job list promise not initialized');
                        }
                        return this.jobListPromise;
                    },
                    updateScope: (result: IDispatchJob[]) => {
                        this.$timeout(() => {
                            this.jobList = result || [];
                            this.totalJobCount = result.length | 0;
                            this.jobListLoading = false;
                        });
                    }
                },
                [JobDataType.POD]: {
                    fetch: () => {
                        if (!this.podListPromise) {
                            throw new Error('Job pod list promise not initialized');
                        }
                        return this.podListPromise;
                    },
                    updateScope: (result: IDispatchJob[]) => {
                        this.$timeout(() => {
                            this.jobListPOD = result || [];
                            this.totalPodCount = result.length | 0;
                            this.podListLoading = false;
                        });
                    }
                },
                [JobDataType.REPRICE]: {
                    fetch: () => {
                        if (!this.repriceListPromise) {
                            throw new Error('Job reprice list promise not initialized');
                        }
                        return this.repriceListPromise;
                    },
                    updateScope: (result: IDispatchJob[]) => {
                        this.$timeout(() => {
                            this.jobListReprice = result || [];
                            this.totalRepriceCount = result.length;
                            this.repriceListLoading = false;
                        });
                    }
                }
            };

            const promises = requestedTypes.map(async (type: JobDataType) => {
                if (type !== JobDataType.ALL) {
                    return {type, data: await fetchMap[type].fetch()};
                }
                return null;
            }).filter((promise): promise is Promise<{
                type: Exclude<JobDataType, JobDataType.ALL>;
                data: IDispatchJob[]
            }> => promise !== null);

            const tasksPromise = this.loadTasks();
            const results = await Promise.all(promises);

            results.forEach(({type, data}) => {
                fetchMap[type].updateScope(data);
            });

            await tasksPromise;
        } catch (error) {
            console.error("Error fetching job data:", error);

            // Reset loading states with $timeout
            this.$timeout(() => {
                requestedTypes.forEach(type => {
                    switch (type) {
                        case JobDataType.NEW:
                            this.jobListLoading = false;
                            break;

                        case JobDataType.POD:
                            this.podListLoading = false;
                            break;
                        case JobDataType.REPRICE:
                            this.repriceListLoading = false;
                            break;
                    }
                });
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
        // Clear data once
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

        const followupTime = moment(job.followupTime);
        const now = moment();
        const diffMinutes = followupTime.diff(now, 'minutes');

        if (diffMinutes > 30) {
            return 'status-future';
        } else if (diffMinutes < -30) {
            return 'status-past';
        } else {
            return 'status-current';
        }
    }

    private _handleError(error: any) {
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
    private _buildFilterRequest(filterType: string): TaskTableFiltersRequest {
        let filterRequest: TaskTableFiltersRequest = {};
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
            this.$timeout(() => {
                this.tasksLoading = true;
            });

            // Build filter request based on filter type
            const filterRequest = this._buildFilterRequest(filterType);

            try {
                this.tasks = await this.DispatchData.getAllTasks(filterRequest);

                this.$timeout(() => {
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

                this.$timeout(() => {
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
        this._logTaskInfo(task);
        this.currentSupport = task;

        if (!this._validateJobId(task)) {
            return;
        }

        try {
            // First try to find the job in local lists
            let attachedJob = this._findJobInLocalLists(task.jobId);

            // If not found locally, fetch from database
            if (!attachedJob) {
                attachedJob = await this.DispatchData.getJobDetail(task.jobId) as IDispatchJob;
            }

            if (!attachedJob) {
                this.toastrService.showWarningToast("This task has no job attached");
                console.warn('[selectTaskJobDetail] No job found for jobId:', task.jobId);
                return;
            }

            await this.selectJob(attachedJob);
            console.log('[selectTaskJobDetail] Job selected successfully');

            this._updateCurrentSelection(attachedJob.jobNo);
        } catch (error) {
            this._handleError(error);
        }
    }

    private _logTaskInfo(task: TaskViewModel): void {
        console.log('[selectTaskJobDetail] Starting with task:', {
            jobId: task.jobId,
            jobNumber: task.jobNumber,
            taskId: task.id
        });
    }

    private _validateJobId(task: TaskViewModel): boolean {
        const hasJobId = !!task.jobId;
        if (!hasJobId) {
            const message = "This task has no job attached";
            this.toastrService.showWarningToast(message);
            console.warn('[selectTaskJobDetail] No jobId provided, returning early');
        }
        return hasJobId;
    }

    private _findJobInLocalLists(jobId: number) {
        console.log('[selectTaskJobDetail] Fetching job details for jobId:', jobId);

        return this.jobList?.find((job) => job.id === jobId) ||
            this.jobListPOD?.find((job) => job.id === jobId) ||
            this.jobListReprice?.find((job) => job.id === jobId);
    }

    private _updateCurrentSelection(jobNo: string): void {
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
        this.$timeout(() => {
            this.flightsLoading = true;
        });

        try {
            // Reload flights with the new airport selection
            await this.loadFlights();
        } catch (error) {
            console.error('Error loading flights after airport change:', error);
        } finally {
            this.$timeout(() => {
                this.flightsLoading = false;
            });
        }
    }

    private _markJobReadStatus(jobId: number, isRead: boolean) {
        this.$timeout(() => {
            // Check the main jobList
            if (this.jobList) {
                const jobIndex = this.jobList.findIndex((job) => job.id === jobId);
                if (jobIndex !== -1) {
                    this.jobList[jobIndex] = {
                        ...this.jobList[jobIndex],
                        hasBeenRead: isRead
                    };
                }
            }

            // Check the POD job list
            if (this.jobListPOD) {
                const jobIndexPOD = this.jobListPOD?.findIndex((job) => job.id === jobId);
                if (jobIndexPOD !== -1 && this.jobListPOD) {
                    this.jobListPOD[jobIndexPOD] = {
                        ...this.jobListPOD[jobIndexPOD],
                        hasBeenRead: isRead
                    };
                }
            }

            // Check the Reprice job list
            if (this.jobListReprice) {
                const jobIndexReprice = this.jobListReprice?.findIndex((job) => job.id === jobId);
                if (jobIndexReprice !== -1 && this.jobListReprice) {
                    this.jobListReprice[jobIndexReprice] = {
                        ...this.jobListReprice[jobIndexReprice],
                        hasBeenRead: isRead
                    };
                }
            }
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
                const updatedJob = this._findJobInLocalLists(currentJobId);

                this.$timeout(() => {
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
            this._handleError(error);
        }
    }
}

const NationwideComponent: angular.IComponentOptions = {
    template: require('./nationwide.template.html'),
    controller: NationwideControl,
    controllerAs: "ctrl"
}
export default NationwideComponent;
