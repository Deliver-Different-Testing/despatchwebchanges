import "./home.styles.less";
import ToastrService from "../../services/toastr.service";
import DispatchCoreService from "../../services/dispatch-core.service";
import DispatchExecutorService from "../../services/dispatch-executor.service";
import {AppConfig} from "../../interfaces/app-config.interface";
import {
    AddressViewModel,
    AreaClearList,
    ClearListViewModel,
    CourierData,
    IDispatchJob,
    IJobNote,
    ILateCallRequest,
    JobQueryParams,
    Suggestion,
} from "../../interfaces/job.interface";
import {ActiveCourierViewModel, TruckCourierStatusViewModel} from "../../interfaces/courier.interface";
import {IBox, IColumn, ILayout} from "../../interfaces/layout.interfaces";
import {DfrntPageViewModel} from "../../interfaces/dfrnt-page-view-model.interface";
import {JobStatus} from "../../enums/job-status.enum";
import BaseController from "../base-controller";
import {ExtendedTask, TaskTableFiltersRequest, TaskViewModel} from "../task-dashboard/task-dashboard.interfaces";
import AdditionalServicesDialogService from "../dialogs/additional-services-dialog/additional-services-dialog.service";
import {EditAddressDialogService} from "../dialogs/edit-address-dialog/edit-address-dialog.service";
import {AppPages} from "../../enums/app-pages.enum";
import JobFileUploadDialogService from "../dialogs/job-file-upload-dialog/job-file-upload-dialog.service";
import AddEventDialogService from "../dialogs/add-event-dialog/add-event-dialog.service";
import {JobNoteType} from "../../enums/job-note-type.enum";
import NoteService from "../../services/notes.service";
import InterCourierChargeDialogService
    from "../dialogs/inter-courier-charge-dialog/inter-courier-charge-dialog.service";
import {Coordinates} from "../overview/overview.interfaces";
import JobContextMenuService from "../../services/job-context-menu.service";
import {LateEventType} from "../../enums/late-event-type.enum";
import {ContactID, FirstName} from "../../contants";
import {ResendJobsRequest} from "./home.interfaces";
import {IJobReadChanged} from "../../interfaces/event-interfaces";
import {JobProperty} from "../../enums/job-property.enum";
import NavigationService from "../../services/navigation.service";
import JobSearchService from "../jobSearch/jobSearch.service";
import greetUser from "../../functions/greetUser";
import dayjs from "dayjs";

class HomeController extends BaseController {
    static $inject = [
        '$document',
        '$mdDialog',
        '$scope',
        '$window',
        '$timeout',
        'toastrService',
        'DispatchData',
        'uCSData',
        'dispatchJobService',
        'APP_CONFIG',
        '$mdSidenav',
        '$stateParams',
        'additionalServicesDialogService',
        'editAddressDialogService',
        'jobFileUploadDialogService',
        'addEventDialogService',
        'noteService',
        'interCourierChargeDialogService',
        'jobContextMenuService',
        '$mdEditDialog',
        '$interval',
        'navigationService'
    ];

    private readonly DOM_SELECTORS = {
        areaGroup: "#area-group .btn",
        driverLocations: "#driverLocations .listActive"
    } as const;

    private refreshInterval?: angular.IPromise<any>;

    mapJobList: IDispatchJob[] = []
    initialViewSet: any;
    currentJob?: IDispatchJob;
    currentJobId?: number;
    jobList: IDispatchJob[];
    mapZoom?: number;
    truckMode: string;
    showInput: any;
    queryParams: JobQueryParams;
    isUsCustomer: boolean;
    selectedCourier: any;
    jobRecordSearchText: string;
    dispatchCourierSearchTest: string;
    jobDetailFabIsOpen: boolean;
    courierListFabIsOpen: boolean;
    isCheckingAttachments: boolean;
    hasAttachedFile: boolean;
    views: DfrntPageViewModel[];
    selectedViews: DfrntPageViewModel[];
    viewsInitialized: boolean = false;
    mapCenter: Coordinates;
    autoZoomEnabled: boolean;
    selected: any;
    supports: ExtendedTask[];
    driverLocations?: ClearListViewModel;
    truckCourierStatus?: TruckCourierStatusViewModel;
    boxes: any;
    dispatchState: any;
    pickService: any;
    pickClients: any;
    pickChannels: any;
    driverLocationsLoading: boolean = false;
    supportsLoading: boolean = false;
    potentialCouriersLoading: boolean = false;
    currentListLoading: boolean = false;
    layouts: ILayout[] = [];
    defaultLayout?: ILayout;
    currentLayoutName?: string;
    layout?: { columns: IColumn[] };
    map: any;
    courierSearchText: string;
    inputWidth: Record<string, number> = {};
    jobListPromise: any;
    currentCourier: any;
    courier: any;
    jobsCurrentList?: IDispatchJob[];
    potentialCouriers: any;
    currentWorkSelection: any;
    jobFilters: any;
    currentSupport: any;
    potentialCouriersSelection: any;
    currentSelection?: string;
    selectedJobs: any;
    boxSortableOptions: angular.ui.SortableOptions<any>;
    jobCutoffDate?: Date;
    supportsFilter: string = 'all';
    filteredSupports: ExtendedTask[] = [];
    supportItemConfig = {
        showAssign: true,
        showClose: true,
        showDelete: true,
        onTaskClick: true
    };
    timeZone: string;
    browserTimeZone: string;
    dateSearchRange: number = 1;
    startDate: Date = dayjs(new Date(0)).toDate();
    endDate: Date = dayjs().add(24, 'hours').toDate();

    constructor(
        private $document: angular.IDocumentService,
        private $mdDialog: angular.material.IDialogService,
        private $scope: angular.IScope,
        private $window: angular.IWindowService,
        private $timeout: angular.ITimeoutService,
        private toastrService: ToastrService,
        private DispatchData: DispatchCoreService,
        private uCSData: JobSearchService,
        private dispatchJobService: DispatchExecutorService,
        private APP_CONFIG: AppConfig,
        private $mdSidenav: angular.material.ISidenavService,
        private $stateParams: angular.ui.IStateParamsService,
        private additionalServicesDialogService: AdditionalServicesDialogService,
        private editAddressDialogService: EditAddressDialogService,
        private jobFileUploadDialogService: JobFileUploadDialogService,
        private addEventDialogService: AddEventDialogService,
        private noteService: NoteService,
        private interCourierChargeDialogService: InterCourierChargeDialogService,
        private jobContextMenuService: JobContextMenuService,
        private $mdEditDialog: any,
        private $interval: angular.IIntervalService,
        private navigationService: NavigationService,
    ) {
        super();

        this.initServices($timeout, $interval);

        this.timeZone = TimeZone;
        this.browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        // Views and Layout
        this.initialViewSet = false;
        this.mapJobList = [];

        $scope.$watch("selectedViews", (newViews) => {
            if (newViews) {
                this.initialViewSet = false;
                this.updateMapForSelectedViews();
            }
        }, true);

        this.registerEvent(this.$scope, 'jobChanged', (_, newJob: IDispatchJob) => {
            this.currentSelection = ` for Job ${newJob.jobNo}`;
        });

        this.registerEvent(this.$scope, 'jobReadChanged', (_, data: IJobReadChanged) => {
            this.markJobReadStatus(data.jobId, data.isRead);
        });

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

        this.truckMode = "On";
        this.showInput = {};

        if (!ClientInternal) {
            this.getClientContacts().then(() => console.log("Get Data Complete!"));
        }

        this.queryParams = {
            order: "time",
            orderDirection: "asc",
        };

        this.jobCutoffDate = new Date();
        this.isUsCustomer = this.APP_CONFIG.US_Customer;
        this.selectedCourier = null;

        this.courierSearchText = "";
        this.jobRecordSearchText = "";
        this.dispatchCourierSearchTest = "";

        this.jobDetailFabIsOpen = false;
        this.courierListFabIsOpen = false;
        this.isCheckingAttachments = false;
        this.hasAttachedFile = false;

        this.views = [];
        this.selectedViews = [];

        // New map
        this.mapCenter = this.APP_CONFIG.US_Customer ?
            this.APP_CONFIG.US_Coordinates_Center :
            this.APP_CONFIG.NZ_Coordinates_Center;
        this.mapZoom = 4;
        this.autoZoomEnabled = true;

        if (Modernizr.localstorage) {
            const savedMapZoom = localStorage.getItem("mapZoom-" + ContactID);
            if (savedMapZoom) {
                try {
                    const parsedMapZoom = JSON.parse(savedMapZoom);
                    this.autoZoomEnabled = parsedMapZoom.display;
                } catch (e) {
                    console.error("Error parsing saved map zoom:", e);
                    this.autoZoomEnabled = true;
                }
            }
        }

        this.selected = [];
        this.jobList = [];
        this.supports = [];

        this.boxes = {
            jobsList: {
                title: "Jobs List",
                icon: "list_alt",
                templateUrl: "app/components/home/partials/jobList.html",
                showSearch: 1,
                showRefresh: 1,
            }, jobDetail: {
                title: "Detail",
                icon: "assignment",
                templateUrl: "app/components/home/partials/jobDetail.html",
                showSearch: 0,
                showRefresh: 0,
                showDetailButtons: 1,
            }, potentialCouriers: {
                title: "Potential Couriers",
                icon: "groups",
                templateUrl: "app/components/home/partials/potentialCouriers.html",
                showSearch: 1,
            }, currentWork: {
                title: "Current Work",
                icon: "local_shipping",
                templateUrl: "app/components/home/partials/currentWork.html",
                showSearch: 1,
                showRefresh: 0,
            }, couriersMoveThrough: {
                title: "Couriers Movement Through List",
                templateUrl: "app/components/home/partials/couriersMovementThroughList.html",
                showSearch: 1,
                showRefresh: 0,
            }, courierMovePickedUp: {
                title: "Couriers Movement Picked Up Run",
                templateUrl: "app/components/home/partials/couriersMovementPickedUp.html",
                showSearch: 1,
                showRefresh: 0,
            }, courierMoveClear: {
                title: "Couriers Movement Clear List",
                templateUrl: "app/components/home/partials/couriersMovementClearList.html",
                showSearch: 1,
                showRefresh: 0,
            }, areaList: {
                title: "Area List",
                templateUrl: "app/components/home/partials/areaList.html",
                showSearch: 0,
                showRefresh: 0,
            }, jobUpdates: {
                title: "Job Updates",
                templateUrl: "app/components/home/partials/jobUpdates.html",
                showSearch: 0,
                showRefresh: 0,
            }, supports: {
                title: "Tasks",
                icon: "support",
                templateUrl: "app/components/home/partials/supports.html",
                showSearch: 0,
                showRefresh: 0,
            }, lateCalls: {
                title: "Late Calls",
                templateUrl: "app/components/home/partials/lateCalls.html",
                showSearch: 0,
                showRefresh: 0,
            }, map: {
                title: "Map",
                icon: "pin_drop",
                templateUrl: "app/components/home/partials/map.html",
                showSearch: 0,
                showRefresh: 1,
            }, driverLocations: {
                title: "Driver Locations",
                icon: "person_pin_circle",
                templateUrl: "app/components/home/partials/driverLocations.html",
                showSearch: 0,
                showRefresh: 0,
            },
        };

        this.dispatchState = {
            processing: false, selectedJobs: new Set(),
        };

        this.pickService = {
            clients: [], channel: [], channelTexts: {
                buttonDefaultText: "Select Channel...",
            }, settings: {
                enableSearch: true,
                selectedToTop: true,
                closeOnBlur: true,
                closeOnSelect: true,
                buttonClasses: "topBarActive btn-sm btn-clients",
            },
        };

        this.pickClients = [];
        this.pickChannels = [{
            id: "1", label: "City",
        }, {
            id: "2", label: "Main",
        }, {
            id: "3", label: "Trucks",
        },];
    }

    $onInit() {
        this.initLayoutSystem(ContactID);

        this.loadPageViews().then(async () => {
            console.log("Loaded Page Views and Data!");

            this.dateSearchRange = 1; // Default to 24 Hours
            this.startDate = dayjs(new Date(0)).toDate(); // Unix epoch start date
            this.endDate = dayjs().add(24, 'hours').toDate(); // 24 hours from now
            this.jobCutoffDate = new Date(); // Current date for backward compatibility


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

        this.refreshInterval = this.$interval(async () => {
            console.log("[HomeRefresh] - Refreshing tasks and job list");

            // Store current state before refresh
            const currentJobId = this.currentJob?.id;
            const currentCourierId = this.currentCourier?.courierId;

            // Refresh job list
            await this.refreshJobList(currentJobId, currentCourierId);
        }, 60000);

        // Set up a watch to apply dimensions when the layout changes
        this.registerWatch(this.$scope, () => this.layout, () => {
            this.registerTimeout(() => this.applyLayoutDimensions());
        }, true);

        // Ensure draggingItems container exists
        if (angular.element('#draggingItems').length === 0) {
            angular.element('body').append('<div id="draggingItems"></div>');
        }

        this.driverLocationsLoading = true;
        this.supportsLoading = false;
        this.potentialCouriersLoading = false;
        this.currentListLoading = false;

        this.filteredSupports = this.supports;
    }

    $onDestroy() {
        if (this.refreshInterval) {
            this.$interval.cancel(this.refreshInterval);
        }
    }

    private updateBoxMetrics() {
        if (!this.layout || !this.layout.columns) return;

        this.layout.columns.forEach((column: IColumn) => {
            // Get column width from DOM
            const columnEl = angular.element(`#co-${column.id}`);
            if (columnEl.length) {
                column.width = columnEl.css('flex-basis');

                // Update heights for all boxes in this column
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
                localStorage.setItem(`layouts-${ContactID}`, JSON.stringify(this.layouts));
            }
        }
    }

    // Layouts
    initLayoutSystem(ContactID: number) {
        this.layouts = [];
        this.defaultLayout = {
            name: "Default",
            layout: {
                columns: [
                    {
                        id: "col1",
                        width: "65%",
                        boxes: [{name: "jobsList", height: "45%"}, {name: "jobDetail", height: "65%"}],
                    },
                    {
                        id: "col2",
                        width: "17.5%",
                        boxes: [{name: "currentWork", height: "50%"}, {name: "supports", height: "50%"}],
                    },
                    {
                        id: "col3",
                        width: "17.5%",
                        boxes: [{name: "driverLocations", height: "50%"}, {name: "map", height: "50%"}],
                    }
                ],
            },
        };

        // Load saved layouts or use default
        if (Modernizr.localstorage) {
            try {
                const storedLayouts: ILayout[] = JSON.parse(localStorage.getItem(`layouts-${ContactID}`) || '[]');
                const lastActiveLayout = localStorage.getItem(`lastActiveLayout-${ContactID}`);

                this.layouts = storedLayouts || [this.defaultLayout];
                this.layouts[0] = this.defaultLayout; // Ensure default is always up-to-date

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

        // Auto-save changes
        this.$scope.$watch("layout", (newValue: { columns: IColumn[] }, oldValue: { columns: IColumn[] }) => {
            if (newValue !== oldValue && this.currentLayoutName) {
                const index = this.layouts.findIndex((l: ILayout) => l.name === this.currentLayoutName);
                if (index !== -1) {
                    this.layouts[index].layout = angular.copy(newValue);
                    if (Modernizr.localstorage) {
                        localStorage.setItem(`layouts-${ContactID}`, JSON.stringify(this.layouts));
                    }
                }
            }
        }, true);
    }

    loadLayout(index: number) {
        const layout: ILayout = this.layouts[index] || this.layouts[0];
        this.currentLayoutName = layout.name;
        this.layout = angular.copy(layout.layout);

        // Apply dimensions on next digest cycle
        this.registerTimeout(() => {
            this.applyLayoutDimensions();

            if (Modernizr.localstorage) {
                localStorage.setItem(`lastActiveLayout-${ContactID}`, layout.name);
            }
        });
    }

    saveLayout() {
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

                if (Modernizr.localstorage) {
                    localStorage.setItem(`layouts-${ContactID}`, JSON.stringify(this.layouts));
                    localStorage.setItem(`lastActiveLayout-${ContactID}`, name);
                }
            });
    }

    deleteLayout(index: number) {
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
                    localStorage.setItem(`layouts-${ContactID}`, JSON.stringify(this.layouts));
                }
                this.loadLayout(0);
                this.toastrService.showSuccessToast("Layout deleted successfully");
            });
    }

    loadFilterFromStorage() {
        if (Modernizr.localstorage) {
            const savedFilter = localStorage.getItem(`selectedFilter-${ContactID}`);
            return savedFilter ? parseInt(savedFilter) : 2; // Default to 2 if not found
        }

        return 2; // Default value if localStorage not available
    }

    saveViewsToStorage(views: any) {
        if (Modernizr.localstorage) {
            localStorage.setItem(`selectedViews-${ContactID}`, JSON.stringify(views));
        }
    }

    loadViewsFromStorage() {
        if (Modernizr.localstorage) {
            try {
                const savedViews = JSON.parse(localStorage.getItem(`selectedViews-${ContactID}`) || "");
                return savedViews || [];
            } catch (error: any) {
                console.error("Error loading views from storage:", error);
                return [];
            }
        }
        return [];
    }

    toggleSidenav() {
        this.$mdSidenav("right").toggle();
    }

    greetUser() {
        return greetUser(FirstName);
    }

    async loadPageViews() {
        try {
            this.views = await this.DispatchData.getSelectedViews(ContactID, AppPages.Dispatch);

            await this.initializeViews();
            await this.fetchDriverLocations();
        } catch (error: any) {
            console.error("Error fetching dispatch views:", error);
            this.views = [];
            await this.initializeViews();
        }
    }

    async initializeViews() {
        if (this.views && this.views.length > 0) {
            // Load saved views or initialize empty array
            this.selectedViews = this.loadViewsFromStorage();

            // Set selected property on each view
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

    async toggleView(view: DfrntPageViewModel) {
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

        // Update map bounds for new selection
        this.updateMapForSelectedViews();

        // Run both promises in parallel with filtered views
        await Promise.all([this.fetchDriverLocations(), this.getData()]);
    }

    updateMapForSelectedViews() {
        if (this.initialViewSet) return;

        if (!this.selectedViews || this.selectedViews.length === 0) return;

        if (!this.autoZoomEnabled) {
            this.initialViewSet = true;
            return;
        }

        if (this.selectedViews.length === 1) {
            // For single view, use its coordinates
            const view = this.selectedViews[0];
            if (view.centerLatitude && view.centerLongitude) {
                this.mapCenter = {
                    lat: view.centerLatitude, lng: view.centerLongitude,
                };
                this.mapZoom = 7; // Closer zoom for single view
            }
        } else {
            // For multiple views, center on continental US
            this.mapCenter = this.APP_CONFIG.US_Coordinates_Center;
            this.mapZoom = 4; // Zoom level to show most of continental US
        }

        this.initialViewSet = true;
    }

    setActiveArea(selectedArea: AreaClearList) {
        if (!this.driverLocations) return;
        this.driverLocations?.areas.forEach((area: AreaClearList) => {
            area.isActive = area === selectedArea;
        });
    }

    onCourierSearchClick($event: MouseEvent) {
        const target = $event.target as HTMLElement;
        if (target?.tagName === "INPUT") {
            (target as HTMLInputElement).value = "";
            this.courierSearchText = "";
        }
    }

    attention(job: IDispatchJob) {
        const components = [];

        // Add DIRECT if applicable
        if (job.direct) {
            components.push("DIRECT");
        }

        // Size label is always included (capitalized) if present
        if (job.size?.text) {
            components.push(job.size.text.toUpperCase());
        }

        // Add RTN for return jobs
        if (job.return) {
            components.push("RTN");
        }

        // Add child notes if present
        if (job.childNotes && Array.isArray(job.childNotes) && job.childNotes.length > 0) {
            components.push(job.childNotes);
        }

        // Add pickup location indicator
        const pickupMap: { [key: number]: string } = {
            1: "R", 2: "D",
        };
        if (job.pickupFrom && job.pickupFrom in pickupMap) {
            components.push(pickupMap[job.pickupFrom]);
        }

        // Add Saturday delivery indicator
        if (job.saturdayDelivery) {
            components.push("Sat Del");
        }

        // Join all components with spaces and trim
        return components.join(" ").trim();
    }

    openSearch(boxName: string, index: number) {
        const boxID = boxName + "-" + index;

        if (!this.inputWidth) {
            this.inputWidth = {};
        }

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

    async selectClearList(selectedClearList: AreaClearList) {
        try {
            if (!selectedClearList) return;

            const areaGroupButtons = angular.element(this.DOM_SELECTORS.areaGroup);
            areaGroupButtons.removeClass("topBarActive");

            if (this.shouldProcessJobs()) {
                await this.processClearListJobs(selectedClearList.id);
            }
        } catch (error) {
            console.error("Clear list processing error:", error);
            this.jobList = [];
        }
    }

    private shouldProcessJobs(): boolean {
        const activeLocations = angular.element(this.DOM_SELECTORS.driverLocations);
        return activeLocations.length <= 1;
    }

    private async processClearListJobs(clearListId: number) {
        const envelope = await this.getClearListEnvelope(clearListId);
        if (!envelope) {
            throw new Error(`Failed to retrieve envelope for clear list ID: ${clearListId}`);
        }

        const selectedClients = this.pickService.clients.map((client: { id: number }) => client.id);
        this.jobListPromise = this.DispatchData.getClearListJobs(
            this.queryParams,
            selectedClients,
            ClientInternal ?? false,
            this.selectedViews,
            envelope
        );

        try {
            const jobs = await this.jobListPromise;
            this.jobList = this.initializeJobSearchFields(jobs);
        } catch (error) {
            console.error("Error fetching jobs for clear list:", error);
            this.jobList = [];
        }
    }

    async getClearListEnvelope(clearListId: number) {
        try {
            const data = await this.DispatchData.getDriverDestinationEnvelope(clearListId);

            if (data) {
                // Update map bounds with envelope data
                if (this.map) {
                    const swll = new this.$window.google.maps.LatLng(data.minimumLatitude, data.minimumLongitude);
                    const nell = new this.$window.google.maps.LatLng(data.maximumLatitude, data.maximumLongitude);
                    this.map.fitBounds(new this.$window.google.maps.LatLngBounds(swll, nell));
                    this.map.setZoom(13);
                }
            }

            return data;
        } catch (error: any) {
            console.error("Error getting clear list envelope:", error);
            throw error;
        }
    }

    async handleDispatchSelection(selectedCourier: Suggestion, job: IDispatchJob) {
        if (this.dispatchState.processing) {
            console.log("Dispatch already in progress");
            return;
        }

        if (!selectedCourier) {
            console.log("Unchecked Courier Selection Clicked!");
            return;
        }

        try {
            this.dispatchState.selectedJobs.add(job.id);
            await this.dispatchJobs(selectedCourier.id);

            this.dispatchState.selectedJobs.clear();
        } catch (error: any) {
            console.error("Error in dispatch:", error);
            this.dispatchState.selectedJobs.delete(job.id);
        }
    }

    handleDispatchFieldClick(event: MouseEvent, job: IDispatchJob) {
        // Prevent the job row click event
        event.stopPropagation();

        // Clear the courierSearchText
        this.courierSearchText = "";

        // Select the job
        this.selectForDispatch(job);
    }

    async handleDispatchKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            const target = event.target as HTMLInputElement;
            const courierId = parseInt(target.value, 10);
            await this.dispatchJobs(courierId);
        }
    }

    selectForDispatch(job: IDispatchJob) {
        const jobId = job.id;

        if (this.dispatchState.selectedJobs.has(jobId)) {
            this.dispatchState.selectedJobs.delete(jobId);
            angular.element(`tr[data-jobid="${jobId}"]`).removeClass("active");
        } else {
            this.dispatchState.selectedJobs.add(jobId);
            angular.element(`tr[data-jobid="${jobId}"]`).addClass("active");
        }
    }

    async swapPOD($event: MouseEvent) {
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

    async promptForJobNumber($event: MouseEvent) {
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

    validateSwapPOD(jobNumber: string) {
        return this.uCSData.validateSwapPOD(jobNumber);
    }

    async showInvalidJobAlert() {
        await this.$mdDialog.show(this.$mdDialog
            .alert()
            .clickOutsideToClose(true)
            .title("Invalid Job")
            .textContent("This job is invalid.")
            .ok("OK"));
    }

    async confirmSwapPOD(event: MouseEvent, currentJobNo: string, jobNumber: string) {
        await this.$mdDialog.show(this.$mdDialog
            .confirm()
            .title("Swap Delivery Info?")
            .textContent(`Are you sure you wish to swap delivery info between ${currentJobNo} and ${jobNumber}?`)
            .targetEvent(event)
            .ok("Yes")
            .cancel("No"));
    }

    async performSwapPOD(currentJobNo: string, jobNumber: string) {
        await this.uCSData.swapPOD(currentJobNo, jobNumber);
        this.toastrService.showSuccessToast("POD swapped successfully");
    }

    async showSuccessAlert() {
        await this.$mdDialog.show(this.$mdDialog
            .alert()
            .clickOutsideToClose(true)
            .title("Successful")
            .textContent("POD Swap Completed Successfully")
            .ok("OK"));
    }


    async updateJobsAfterSwap(secondJobId: number, firstJobId: number) {
        await this.uCSData.reSendJobs([secondJobId]);
        await this.uCSData.reAssignJobs([firstJobId]);
        await this.uCSData.reSendJobs([firstJobId]);
    }

    async voidJobForm(jobNumber: string, jobId: number) {
        try {
            const note: string = await this.$mdDialog
                .show(this.$mdDialog
                    .prompt()
                    .title("Void Job " + jobNumber)
                    .textContent("Add note to " + jobNumber)
                    .placeholder("Note")
                    .ariaLabel("Void job")
                    .required(true)
                    .ok("Void " + jobNumber)
                    .cancel("Cancel"));

            const jobNote: IJobNote = {
                jobId: jobId,
                createdDate: new Date(),
                createdBy: ContactID,
                noteText: note,
                noteTypeId: JobNoteType.InternalNote,
                isImportant: false
            };

            await this.noteService.createNote(jobNote);
            await this.DispatchData.voidJob(jobId);
            this.toastrService.showSuccessToast("Job voided successfully");
            return await this.getData();
        } catch (error: any) {
            console.error("Job void canceled or error occurred", error);
        }
    }

    messageClick($event: MouseEvent, job: IDispatchJob) {
        const selectedCourierId = this.selectedCourier ? this.selectedCourier.id : job.courierData?.courierId;

        this.$mdDialog
            .show({
                controller: "SendMessageDialogController",
                controllerAs: "ctrl",
                parent: this.$document.parent(),
                templateUrl: "app/components/dialogs/send-message-dialog/send-message-dialog.html",
                clickOutsideToClose: false,
                fullscreen: true,
                targetEvent: $event,
                locals: {
                    selectedCourierId, contactId: ContactID, dispatcherName: FirstName,
                },
                bindToController: true,
            })
            .then(() => {
                console.log("Dialog closed!");
            });
    }

    async otherEventForm($event: MouseEvent, job: IDispatchJob) {
        await this.addEventDialogService.openAddEventDialog($event, job);
    }

    selectAllContent($event: MouseEvent) {
        ($event.target as HTMLInputElement)?.select();
    }

    async latePickup(minsAway: number, job: IDispatchJob, obj: any): Promise<void> {
        return await this.handleLateOperation(minsAway, job, obj, LateEventType.Pickup);
    }

    async lateDelivery(minsAway: number, job: IDispatchJob, obj: any): Promise<void> {
        return await this.handleLateOperation(minsAway, job, obj, LateEventType.Delivery);
    }

    private async handleLateOperation(minsAway: number, job: IDispatchJob, obj: any, lateType: LateEventType): Promise<void> {
        const isPickup = lateType === LateEventType.Pickup;
        const operationType = isPickup ? "pickup" : "delivery";
        const currentValue = isPickup ? job.lp : job.ld;

        console.log(`Current ${operationType} = ${currentValue}`);
        console.log(`Param minsAway = ${minsAway}`);
        console.log(obj);

        try {
            const lateCallRequest: ILateCallRequest = {
                jobId: job.id,
                lateType,
                lateTime: minsAway,
                calculationRequired: true,
                staffId: ContactID,
                despatcherName: FirstName
            };

            await this.DispatchData.lateCall(lateCallRequest);

            await this.getData();
            this.toastrService.showSuccessToast("Late call applied successfully");

            console.log(`Late ${operationType} call completed successfully`);
        } catch (error) {
            console.error(`Error in late ${operationType} call:`, error);
        }
    }

    jobClass(job: IDispatchJob): string {
        if (!job) return "";

        const classes = [];

        // Add direct class if job is direct
        if (job.direct) {
            classes.push("direct");
        }

        // Add chilled class for specific speed types
        const chilledSpeedTypes = ["CT", "CTHIRE", "FT", "FTHIRE", "HC", "TC"];
        if (chilledSpeedTypes.includes(job.speed ?? '')) {
            classes.push("chilled");
        }

        // Add G class if job is dispatched (has a courier assigned)
        if (job.courier || job.assignedCourier) {
            classes.push("G");
        }

        return classes.join(" ");
    }

    async dispatchJobs(courierId: number) {
        if (this.dispatchState.processing) {
            console.warn("Dispatch already in progress");
            return;
        }

        const jobsToDispatch = this.getJobsToDispatch();

        if (!jobsToDispatch.length) {
            console.warn("No jobs selected for dispatch");
            return;
        }

        try {
            this.dispatchState.processing = true;

            // Validate courier number
            const courier = await this.DispatchData.getCourierById(courierId);
            if (!courier) {
                console.error("Invalid courierId");
            }

            // Perform dispatch operation
            await this.dispatchJobService.dispatchJobsByCourierId(courierId, jobsToDispatch);

            // Clear selection state
            this.dispatchState.selectedJobs.clear();

            // If we have a current courier, update their job list
            if (this.currentCourier) {
                await this.getCurrentJobs(this.currentCourier.courierId);
            }

            // Inform the user
            this.toastrService.showSuccessToast(jobsToDispatch.length + " job(s) dispatched to " + courier.name);
            await this.getJobList();
        } catch (error: any) {
            console.error("Error dispatching jobs:", error);
            throw error;
        } finally {
            this.dispatchState.processing = false;
        }
    }

    private getJobsToDispatch() {
        return this.jobList.filter((job) => this.dispatchState.selectedJobs.has(job.id));
    }

    async reAllocateJobs(job: IDispatchJob) {
        if (!job) return;

        const data = await this.dispatchJobService.reallocateJob(job);

        await this.getData();
        this.courier = {gpsCourier: data};
        await this.searchCourier();
    }

    async resendJobs() {
        const activeJobElements = angular.element("#jobList .active");
        const jobIds: number[] = Array.from(activeJobElements).map(element =>
            parseInt(angular.element(element).attr("data-jobid") || "0", 10)
        );

        if (jobIds.length === 0) {
            return;
        }

        try {
            await this.DispatchData.resendJobs(jobIds.filter(id => id !== 0));
            this.toastrService.showSuccessToast("Jobs resent successfully");
            await this.getData();

            const lastJobElement = activeJobElements[activeJobElements.length - 1];
            const lastJobId = parseInt(angular.element(lastJobElement).attr("data-jobid") || "0", 10);
            const lastJob = this.jobList.find((job) => job.id === lastJobId);

            if (!lastJob) return;
            const foundCourier = await this.DispatchData.getCourierById(lastJob.courierData?.courierId ?? 0);

            if (foundCourier) {
                this.courier = {gpsCourier: foundCourier.id};
                await this.searchCourier();
            }

        } catch (error: any) {
            console.log("Error updating data:", error);
        }
    }

    async restoreJob(job: IDispatchJob) {
        try {
            const result = await this.dispatchJobService.restoreJob(job);
            this.courier = {gpsCourier: result.gpsCourier};

            await this.getData();

            if (this.searchCourier) {
                await this.searchCourier();
            }
        } catch (error: any) {
            console.error("Error restoring job:", error);
        }
    }

    async restoreAll($event: MouseEvent) {
        let confirm = this.$mdDialog
            .confirm()
            .title("Restore All Jobs")
            .textContent("Are you sure you wish to restore all jobs for " + this.currentCourier.courier)
            .targetEvent($event)
            .ok("Yes")
            .cancel("No");

        try {
            await this.$mdDialog.show(confirm);

            let callData = {
                call: "restoreJobs",
                jobs: [] as number[],
                splitJobs: [] as number[],
                jobNos: [] as string[],
                courierId: null as number | null,
            };

            let foundCourier: ActiveCourierViewModel | null = null;

            if (!this.jobsCurrentList) return;
            for (const job of this.jobsCurrentList) {
                await this.DispatchData.addRestoreEvent(job.id);

                if (callData.courierId === null) {
                    callData.courierId = job.courierData?.courierId ?? null;
                    foundCourier = await this.DispatchData.getCourierById(callData.courierId ?? 0);
                }

                if (job.displaySplitJobDetail) {
                    callData.splitJobs.push(job.id);
                } else {
                    callData.jobs.push(job.id);
                }
            }

            if (callData.splitJobs.length > 0 && foundCourier) {
                await this.DispatchData.restoreSplitJobs(callData.jobs);
                console.log("Restore split jobs complete");
            }
            if (callData.jobs.length > 0 && foundCourier) {
                await this.DispatchData.restoreJobs(callData.jobs);
                console.log("Restore Jobs complete");
            }

            this.registerTimeout(() => {
                if (foundCourier) {
                    this.getCurrentJobs(foundCourier.courierId);
                    this.getData();
                }
            }, 1000);
        } catch (error: any) {
            if (error === undefined) {
                console.log("User canceled dialog");
            } else {
                console.error("Error occured restoring jobs");
            }
        }
    }


    async redispatchAll($event: MouseEvent) {
        const confirm = this.$mdDialog
            .confirm()
            .title("Restore All Jobs")
            .textContent("Are you sure you wish to redispatch all jobs for " + this.currentCourier.courier)
            .targetEvent($event)
            .ok("Yes")
            .cancel("No");

        try {
            await this.$mdDialog.show(confirm);
            let callData = {
                call: "redespatchJobs",
                jobs: [] as number[],
                splitJobs: [] as number[],
                jobNos: [] as string[],
                courierId: this.currentCourier.courierId,
            };

            let foundCourier = null;

            if (!this.jobsCurrentList) return;
            for (const job of this.jobsCurrentList) {
                callData.jobs.push(job.id);
                foundCourier = await this.DispatchData.getCourierById(callData.courierId);
            }

            if (callData.jobs.length > 0) {
                await this.DispatchData.reAllocateJobs(callData.courierId, ContactID, callData.jobs);
            }

            await this.getData();
            this.courier = {gpsCourier: foundCourier?.id};
            await this.searchCourier();
        } catch {
            // Cancelled dialog.
        }
    }

    async resendAll($event: MouseEvent) {
        const confirmDialog = this.createResendConfirmDialog($event);

        try {
            await this.$mdDialog.show(confirmDialog);
            const resendRequest: ResendJobsRequest = {
                call: "resendJobs",
                jobs: [],
                splitJobs: [],
                jobNos: [],
                courierId: this.currentCourier.courierId,
            };

            this.collectJobIds(resendRequest);
            const foundCourier = await this.DispatchData.getCourierById(resendRequest.courierId);

            if (resendRequest.jobs.length > 0) {
                await this.DispatchData.resendAllJobs(resendRequest.courierId);
            }

            await this.getData();
            this.courier = {gpsCourier: foundCourier?.id};
            await this.searchCourier();
        } catch {
            // User cancelled the operation
        }
    }

    private createResendConfirmDialog($event: MouseEvent) {
        return this.$mdDialog
            .confirm()
            .title("Resend All Jobs")
            .textContent(`Are you sure you wish to resend all jobs for ${this.currentCourier.courier}`)
            .targetEvent($event)
            .ok("Yes")
            .cancel("No");
    }

    private collectJobIds(request: ResendJobsRequest) {
        this.jobsCurrentList?.forEach((job: IDispatchJob) => {
            request.jobs.push(job.id);
        });
    }

    async addRestoreEvent(job: IDispatchJob) {
        try {
            await this.DispatchData.addRestoreEvent(job.id);
            console.log("Restore event added successfully");
        } catch (error: any) {
            console.log("Error adding restore event:", error);
            throw error;
        }
    }

    async restoreJobs(callData: any) {
        const promises = [];

        if (callData.splitJobs.length > 0) {
            promises.push(this.DispatchData.restoreSplitJobs(callData.splitJobs));
        }
        if (callData.jobs.length > 0) {
            promises.push(this.DispatchData.restoreJobs(callData.jobs));
        }

        try {
            await Promise.all(promises);
            this.toastrService.showSuccessToast("Jobs restored successfully");
        } catch (error: any) {
            console.log("Error restoring jobs:", error);
            throw error;
        }
    }

    async splitJob($event: MouseEvent, job: IDispatchJob) {
        if (!job.allowSplit) {
            await this.showAlert("Unable to split job", `Can not split ${job.jobNo}.`);
            return;
        }

        try {
            const result = await this.showConfirm($event, "Split Job?", "Are you sure you wish to split this job?");
            if (result) {
                await this.DispatchData.splitJob(job.id, FirstName);
                await this.setSplitJobMeetingPoint($event, job);
            }
        } catch (error: any) {
            if (error instanceof Error) {
                console.log(error.message);
            }
            console.log("Splitting job failed:", error);
        }
    }

    showAlert(title: string, content: string) {
        return this.$mdDialog.show(this.$mdDialog
            .alert()
            .parent(this.$document.parent())
            .clickOutsideToClose(true)
            .title(title)
            .textContent(content)
            .ariaLabel("Alert")
            .ok("OK"));
    }

    showConfirm($event: MouseEvent, title: string, content: string) {
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

    async activateDrop() {
        const self = this;
        await this.$timeout(0);
        await new Promise((resolve) => {
            this.$document.ready(resolve);
        });

        (angular.element(".droppable-row") as any).droppable({
            classes: {"ui-droppable-hover": "active"}, drop: async (event: MouseEvent, ui: any) => {
                await self.handleDroppedJob(self);
            },
        });
    }

    async handleDroppedJob($element: any) {
        const parentOffset = $element.parents(".box").offset();
        const rowOffset = $element.offset();

        if (this.isWithinDropZone(parentOffset, rowOffset, $element)) {
            await this.animateDroppedJob($element);
            await this.dispatchDroppedJob($element);
        }
    }

    isWithinDropZone(parentOffset: any, rowOffset: any, $element: any) {
        const parentTop = parentOffset.top;
        const parentBottom = parentTop + $element.parents(".box").outerHeight();
        const rowTop = rowOffset.top;
        const rowBottom = rowTop + $element.outerHeight();

        return rowTop < parentBottom && rowBottom > parentTop;
    }

    async animateDroppedJob($element: any) {
        $element.css({"background-color": "#c6dfad"});
        await new Promise<void>((resolve) => {
            $element.animate({backgroundColor: "inherit"}, 300, () => {
                $element.removeAttr("style");
                resolve();
            });
        });
    }

    async dispatchDroppedJob($element: any) {
        const courierId = $element.attr("data-courier").replace(/[^\d.-]/g, "");

        try {
            await this.dispatchJobs(courierId);
            console.log("Dispatch complete");
            await this.fetchDriverLocations();
        } catch (error: any) {
            console.error("Error in drop handler:", error);
        }
    }

    async getPotentialCouriers(jobId: number) {
        try {
            this.potentialCouriers = await this.DispatchData.getPotentialCouriers(jobId);

            await this.activateDrop();
        } catch (error: any) {
            console.error("Error getting potential couriers:", error);
        }
    }

    courierSearch(searchText: string) {
        try {
            const url = "/courier/AllActiveSearch";
            return this.DispatchData.autocompleteSearch(searchText, url);
        } catch (error: any) {
            console.error(error.message);
            throw error;
        }
    }

    jobRecordSearch(searchText: string) {
        return this.jobList
            .filter((job) => job.jobNo.toLowerCase().includes(searchText.toLowerCase()))
            .map((job) => ({id: job.id, text: job.jobNo}));
    }

    async JobRecordSelected(selectedJobId: number) {
        try {
            const selectedJob = this.jobList.find((job) => job.id === selectedJobId);
            if (!selectedJob) return;

            await this.selectJob(selectedJob);
            console.log("Job selection complete");
        } catch (error: any) {
            console.error("Error in JobRecordSelected:", error);
        }
    }

    async updateCourierData(courierId: number, courierName: string) {
        this.currentWorkSelection = ` for Courier ${courierName}`;
        this.currentCourier = {courierId: courierId, courier: courierName};

        // Get current jobs for the courier
        await this.getCurrentJobs(courierId);

        try {
            this.truckCourierStatus = await this.DispatchData.truckCourierStatus(courierId);
        } catch (error: any) {
            console.error("Error fetching truck courier status:", error);
        }
    }

    async selectedCourierChange(courier: Suggestion) {
        if (!courier) {
            // When courier is cleared, show all jobs
            this.currentCourier = null;
            this.mapJobList = [...this.jobList];
            return;
        }

        const courierId = courier.id;
        const courierName = courier.text;

        if (!courierId || !courierName) {
            console.error("Invalid courier data structure:", courier);
            return;
        }

        // Update courier data and get their jobs
        this.currentWorkSelection = ` for Courier ${courierName}`;
        this.currentCourier = {courierId: courierId, courier: courierName};

        // Get current jobs for the courier
        await this.getCurrentJobs(courierId);

        try {
            this.truckCourierStatus = await this.DispatchData.truckCourierStatus(courierId);
        } catch (error: any) {
            console.error("Error fetching truck courier status:", error);
        }
    }

    async searchCourier() {
        try {
            const foundCourier = await this.DispatchData.getCourierById(this.courier.gpsCourier);
            if (!foundCourier) {
                this.toastrService.showWarningToast("Courier not found");
                return;
            }

            await this.updateCourierData(foundCourier.courierId, foundCourier.name);
            this.mapJobList = [...(this.jobsCurrentList || [])];
        } catch (error: any) {
            console.error("Error searching courier:", error);
        }
    }

    async selectCourier(courier: CourierData) {
        try {
            await this.registerTimeout(() => {
                this.currentListLoading = true;
            });

            if (!courier || !courier.courierId) return;
            const foundCourier = await this.DispatchData.getCourierById(courier.courierId);
            if (foundCourier) {
                this.currentCourier = {
                    courierId: foundCourier.courierId,
                    courier: foundCourier.label || `${foundCourier.label} ${foundCourier.name}`,
                };

                this.currentWorkSelection = ` for Courier ${this.currentCourier.courier}`;
                await this.getCurrentJobs(foundCourier.courierId);

                // Update map to show only this courier's jobs
                this.mapJobList = [...(this.jobsCurrentList || [])];

                try {
                    this.truckCourierStatus = await this.DispatchData.truckCourierStatus(foundCourier.courierId);
                } catch (error: any) {
                    console.warn("Error fetching truck courier status:", error);
                }
            } else {
                console.warn("Courier not found in active or all couriers list");
                this.toastrService.showErrorToast("An unexpected occur occured. Please contact support.");
            }
        } catch (error: any) {
            console.error("Error selecting courier:", error);
            this.toastrService.showErrorToast("Error loading courier information");
        } finally {
            await this.registerTimeout(() => {
                this.currentListLoading = false;
            });
        }
    }

    async selectPotentialCourier(courier: CourierData) {
        try {
            this.updateCourierInfo(courier);
            await this.displayJobsForCourier(courier);
            await this.updateUIForPotentialCourier(courier);
        } catch (error: any) {
            console.error("Error in selectPotentialCourier:", error);
        }
    }

    updateCourierInfo(courier: CourierData) {
        if (!courier.courier) {
            courier.courier = `${courier.courier} ${courier.courierName}`;
        }
    }

    async displayJobsForCourier(courier: CourierData) {
        if (!courier.courierId) return;

        const foundCourier = await this.DispatchData.getCourierById(courier.courierId);
        const code = foundCourier?.id ?? '';
        if (!courier.courierId) {
            throw new Error('Courier ID is required');
        }
        const data = await this.DispatchData.getJobsCurrent(courier.courierId, this.jobFilters.status === "done");

        if (this.currentJob !== null && this.currentJob?.courier !== code) {
            this.currentJob = undefined;
        }

        this.jobsCurrentList = data;
        await this.activateDrop();
    }

    private isValidCoordinates(lat: number, lng: number) {
        return (lat && lng && !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0 && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180);
    }

    async updateUIForPotentialCourier(courier: CourierData) {
        this.currentWorkSelection = ` for Courier ${courier.courier}`;
        this.currentCourier = courier;
    }

    async getCurrentJobs(courierId: number) {
        if (!courierId) {
            console.warn("No courier ID provided");
            return;
        }

        try {
            this.currentListLoading = true;

            this.jobsCurrentList = await this.DispatchData.getJobsCurrent(courierId, false);

            if (this.jobsCurrentList && this.jobsCurrentList.length > 0) {
                console.log(`Setting mapJobList for courier ${courierId} with ${this.jobsCurrentList.length} jobs`);
                this.mapJobList = [...this.jobsCurrentList];
            } else {
                console.log(`No jobs found for courier ${courierId}`);
                this.mapJobList = [];
            }

            await this.activateDrop();
        } catch (error: any) {
            console.error("Error getting current jobs:", error);
            this.jobsCurrentList = [];
            this.mapJobList = [];
        } finally {
            this.currentListLoading = false;
        }
    }

    async selectJobDetail(job: IDispatchJob) {
        this.currentJob = job;
        this.currentSupport = null;
        this.potentialCouriers = false;
        this.potentialCouriersSelection = ` for Job ${job.jobNo}`;
        this.currentSelection = ` for Job ${job.jobNo}`;

        await this.checkForAttachments(job.id);

        if (job.rootParentId && job.clientId) {
            try {
                job.relatedJobs = await this.DispatchData.getRelatedJobs(job.rootParentId, job.clientId);
            } catch (error: any) {
                console.error("Error getting related jobs:", error);
            }
        }
    }

    async selectSupportJobDetail(task: TaskViewModel) {
        console.log('[selectSupportJobDetail] Starting with task:', {
            jobId: task.jobId,
            jobNumber: task.jobNumber,
            taskId: task.id
        });

        this.currentSupport = task;

        try {
            if (!task.jobId) {
                this.toastrService.showWarningToast("No job is attached to this support.");
                console.warn('[selectSupportJobDetail] No jobId provided, returning early');
                return;
            }

            console.log('[selectSupportJobDetail] Fetching job details for jobId:', task.jobId);

            let attachedJob = this.jobList.find((job) => job.id === task.jobId);

            // If not found locally, fetch from database
            if (!attachedJob) {
                attachedJob = await this.DispatchData.getDispatchJobDetail(task.jobId);
            }

            if (!attachedJob) {
                this.toastrService.showWarningToast("This task has no job attached");
                console.warn('[selectTaskJobDetail] No job found for jobId:', task.jobId);
                return;
            }

            await this.selectJob(attachedJob);
            console.log('[selectSupportJobDetail] Job selected successfully');

            this.currentSelection = ` for Job ${attachedJob.jobNo}`;
        } catch (error) {
            this.toastrService.showErrorToast("Error loading job information");
            console.error('[selectSupportJobDetail] Error loading job information', error);
        }
    }

    async selectJob(job: IDispatchJob) {
        console.log("Selected job run...");
        console.log(job);

        if (!job) return;

        this.markJobReadStatus(job.id, true);

        await this.$timeout(async () => {
            // Refresh tasks
            await this.loadSupports();


            this.selectedJobs = [];
            this.currentSupport = null;

            // Create a new reference to trigger change detection
            this.currentJob = angular.copy(job);
            this.currentJobId = job.id;

            await this.checkForAttachments(job.id);

            if (job.rootParentId) {
                try {
                    if (this.currentJob?.rootParentId && this.currentJob?.clientId) {
                        this.currentJob.relatedJobs = await this.DispatchData.getRelatedJobs(this.currentJob.rootParentId, this.currentJob.clientId);
                    }
                } catch (error: any) {
                    console.error("Error getting related jobs:", error);
                }
            }

            // Set the currentSelection to job-specific information
            this.currentSelection = ` for Job ${job.jobNo}`;

            try {
                if (!job.courier && !job.assignedCourier) {
                    // Scenario 2: Job has no courier assigned - show only this job
                    console.log("Selected job has no courier - showing only this job on map");
                    this.mapJobList = [job];
                    await this.handleUndispatchedJob(job);
                } else {
                    // Scenario 3: Job has a courier assigned - show this courier's jobs
                    console.log("Selected job has courier assigned - loading courier's jobs");
                    this.potentialCouriers = false;

                    if (job.courierData && job.courierData.courierId) {
                        // Set the current courier context first
                        this.currentCourier = {
                            courierId: job.courierData.courierId,
                            courier: job.courierData.courierName || job.courier || job.assignedCourier || 'Unknown Courier'
                        };

                        this.currentWorkSelection = ` for Courier ${this.currentCourier.courier}`;

                        // Get all jobs for this courier
                        await this.getCurrentJobs(job.courierData.courierId);

                        // Make sure the current job is in the list if not already
                        const jobInList = this.mapJobList.some(j => j.id === job.id);
                        if (!jobInList) {
                            this.mapJobList = [...this.mapJobList, job];
                        }

                        try {
                            this.truckCourierStatus = await this.DispatchData.truckCourierStatus(job.courierData.courierId);
                        } catch (error: any) {
                            console.warn("Error fetching truck courier status:", error);
                        }

                        // Set map bounds to include pickup, delivery and courier positions if available
                        if (job.pickupAddress?.latitude != null && job.pickupAddress?.longitude != null &&
                            job.deliveryAddress?.latitude != null && job.deliveryAddress?.longitude != null &&
                            this.isValidCoordinates(job.pickupAddress.latitude, job.pickupAddress.longitude) &&
                            this.isValidCoordinates(job.deliveryAddress.latitude, job.deliveryAddress.longitude)) {

                            if (this.map) {
                                // Create bounds that include pickup and delivery points
                                const bounds = new this.$window.google.maps.LatLngBounds();
                                bounds.extend(new this.$window.google.maps.LatLng(job.pickupAddress.latitude, job.pickupAddress.longitude));
                                bounds.extend(new this.$window.google.maps.LatLng(job.deliveryAddress.latitude, job.deliveryAddress.longitude));

                                // If courier position is available, include it
                                if (job.courierData.latitude != null && job.courierData.longitude != null &&
                                    this.isValidCoordinates(job.courierData.latitude, job.courierData.longitude)) {
                                    bounds.extend(new this.$window.google.maps.LatLng(job.courierData.latitude, job.courierData.longitude));
                                }
                            }
                        }
                    } else {
                        // Fallback if no courier data available
                        console.warn("Job has courier assigned but missing courierData");
                        this.mapJobList = [job];
                    }
                }
            } catch (error: any) {
                console.error("Error in selectJob:", error);
                // Fallback to showing just the current job
                this.mapJobList = [job];
            }

            // Only focus the dispatch field for the selected job
            this.focusDispatchField(job.id);
        }, 0);
    }

    async handleUndispatchedJob(job: IDispatchJob) {
        await this.getPotentialCouriers(job.id);
        this.potentialCouriersSelection = ` for Job ${job.jobNo}`;
        this.currentCourier = null;
        this.currentSelection = ` for Job ${job.jobNo}`;

        // Verify we have valid coordinates before displaying
        if (this.autoZoomEnabled && this.map) {
            if (job.pickupAddress?.latitude != null && job.pickupAddress?.longitude != null &&
                this.isValidCoordinates(job.pickupAddress.latitude, job.pickupAddress.longitude)) {
                // Set bounds for pickup point
                const bounds = new this.$window.google.maps.LatLngBounds();
                bounds.extend(new this.$window.google.maps.LatLng(job.pickupAddress.latitude, job.pickupAddress.longitude));

                // If delivery coordinates are valid, include them too
                if (job.deliveryAddress?.latitude != null && job.deliveryAddress?.longitude != null &&
                    this.isValidCoordinates(job.deliveryAddress.latitude, job.deliveryAddress.longitude)) {
                    bounds.extend(new this.$window.google.maps.LatLng(job.deliveryAddress.latitude, job.deliveryAddress.longitude));
                }
            } else {
                console.warn("Invalid pickup coordinates for job:", job);
            }
        }
    }

    focusDispatchField(jobId: number) {
        this.registerTimeout(() => {
            const inputField = angular.element(`#input_${jobId}`);
            if (inputField.length) {
                const inputElement = inputField.find('input');
                if (inputElement.length) {
                    const htmlInputElement = inputElement[0] as HTMLInputElement;
                    htmlInputElement.focus();

                    const job = this.jobList.find(j => j.id === jobId);
                    if (job && !job.courier && !job.assignedCourier) {
                        htmlInputElement.select();
                    }
                }
            }
        }, 100);
    }

    async showJobContextMenu($event: MouseEvent, job: IDispatchJob) {
        try {
            await this.selectJob(job);

            const contextMenuElement = angular.element('context-menu');
            const contextMenuCtrl = contextMenuElement.controller('contextMenu');

            if (contextMenuCtrl) {
                await contextMenuCtrl.showJobContextMenu($event, job);
            } else {
                console.error('Context menu controller not found');
            }
        } catch (error) {
            console.error('Error selecting job:', error);
        }
    }

    async createMenuItem(text: string, action: any) {
        return {
            text, click: async ($itemScope: any, $event: MouseEvent) => {
                try {
                    await action($itemScope, $event);
                    console.log(`${text} completed successfully`);
                } catch (error: any) {
                    console.log(`Error in ${text}:`, error);
                }
            }
        };
    }

    async setTruckMode(mode: string) {
        this.truckMode = mode;
        await this.getData();
    }

    async handleMarkerClick(job: IDispatchJob) {
        if (job) {
            await this.selectJob(job);
        }
    }

    private initializeJobSearchFields(jobs: IDispatchJob[]) {
        if (!Array.isArray(jobs)) {
            return jobs;
        }

        return jobs.map(job => {
            if (!job.hasOwnProperty('searchText')) {
                job.searchText = '';
            }
            return job;
        });
    }

    async getJobList() {
        try {
            // Ensure views are initialized before proceeding
            if (!this.viewsInitialized && this.selectedViews.length === 0) {
                console.log('Views not initialized yet, loading defaults');
                this.selectedViews = this.loadViewsFromStorage();

                // If still no views, add at least one default view
                if (this.selectedViews.length === 0 && this.views.length > 0) {
                    this.selectedViews = [this.views[0]];
                }
            }

            if (Modernizr.localstorage) {
                localStorage.setItem("disp-filters-" + ContactID, JSON.stringify(this.queryParams));
            }

            const selectedClients = this.pickService.clients.map((a: any) => a.id);

            let orderBy = this.queryParams.order || '';
            let orderDirection = "asc";

            if (orderBy && orderBy.startsWith("-")) {
                orderBy = orderBy.substring(1);
                orderDirection = "desc";
            }

            const params: JobQueryParams = {
                order: orderBy,
                orderDirection: orderDirection,
                dateCutoff: this.jobCutoffDate
            };

            // Apply date filters based on dateSearchRange
            if (this.dateSearchRange == 1) {
                // 24 Hours mode - use startDate and endDate for 24-hour range
                params.startDate = dayjs(new Date(0)).toDate(); // Unix epoch start date
                params.endDate = dayjs().add(24, 'hours').toDate(); // 24 hours from now
            } else if (this.dateSearchRange == 2) {
                // Custom range mode - use startDate and endDate
                params.startDate = this.startDate;
                params.endDate = this.endDate;
            }

            this.jobListPromise = this.dispatchJobService.getJobListWithCourierData(
                params,
                selectedClients,
                ClientInternal ?? false,
                this.selectedViews
            );
            const result = await this.jobListPromise;

            if (result.items?.length > 0) {
                this.jobList = this.initializeJobSearchFields(result.items);

                if (!this.currentCourier) {
                    this.mapJobList = this.jobList;
                }
            } else {
                this.jobList = [];

                if (!this.currentCourier) {
                    this.mapJobList = [];
                }
            }

            this.jobsCurrentList = undefined;
        } catch (error: any) {
            console.error("Error getting job list:", error);
            this.toastrService.showErrorToast("Failed to get job list. Please try again.");

            this.jobList = [];

            if (!this.currentCourier) {
                this.mapJobList = [];
            }
        }
    }

    async changeJobCutoffDate(days: number) {
        if (!this.jobCutoffDate) {
            this.jobCutoffDate = new Date();
        }

        const newDate = new Date(this.jobCutoffDate);
        newDate.setDate(newDate.getDate() + days);

        this.jobCutoffDate = newDate;

        // If we're in custom date mode, update the end date
        if (this.dateSearchRange == 2) {
            this.endDate = newDate;
        }

        await this.applyJobCutoffDate();
    }

    async resetJobCutoffDate() {
        //this.jobCutoffDate = new Date();
        this.dateSearchRange = 1;
        this.startDate = dayjs(new Date(0)).toDate();
        this.endDate = dayjs().add(24, 'hours').toDate();

        // For backward compatibility
        this.jobCutoffDate = new Date();

        if (Modernizr.localstorage) {
            localStorage.setItem(`jobCutoffDate-${ContactID}`, JSON.stringify(this.jobCutoffDate));
        }

        this.queryParams.dateCutoff = this.jobCutoffDate;

        await this.getJobList();
        this.toastrService.showSuccessToast("Date filter set to today");
    }

    async applyJobCutoffDate() {
        if (!this.jobCutoffDate) {
            return;
        }

        // If we're in custom date mode (2), update the end date
        if (this.dateSearchRange == 2) {
            this.endDate = this.jobCutoffDate;
        } else {
            // Otherwise, use the jobCutoffDate directly
            this.queryParams.dateCutoff = this.jobCutoffDate;
        }
        await this.getJobList();
    }

    async getClientContacts() {
        try {
            this.pickClients = await this.DispatchData.getClientContacts(ContactID);
        } catch (error: any) {
            console.log("Error getting client contacts:", error);
        }
    }

    async getData() {
        try {
            this.currentJob = undefined;
            this.potentialCouriers = null;

            if (!this.courier) {
                this.currentCourier = null;
            }

            await this.loadSupports();
            await this.getJobList();

            if (!this.currentCourier && !this.currentJob) {
                console.log("Initial load: showing all jobs on map");
                this.mapJobList = [...this.jobList];
            }
        } catch (error: any) {
            console.error("Error in getData:", error);
            this.toastrService.showErrorToast("An error occurred while loading data. Please refresh the page.");
        }
    }


    async fetchDriverLocations() {
        this.driverLocationsLoading = true;

        await this.getDriverLocationsData();
        this.driverLocationsLoading = false;
    }

    async getDriverLocationsData() {
        try {
            const selectedViews = this.views.filter((view) => view.selected);
            if (!selectedViews) return;

            this.driverLocations = await this.DispatchData.getDriverLocations(selectedViews);

            console.log("Driver Locations: ", this.driverLocations);
            await this.activateDrop();
        } catch (error: any) {
            console.error("Error getting clear lists data:", error);
        }
    }

    async setSplitJobMeetingPoint($event: MouseEvent, currentJob: IDispatchJob) {
        try {
            if (!currentJob.deliveryAddress) return;

            const newAddress = await this.editAddressDialogService.openEditAddressDialog(currentJob.deliveryAddress, $event)
            if (!newAddress) return;

            await this.handleNewAddressForSplitJobs(newAddress, currentJob);
        } catch (error: any) {
            console.log(error.message);
        } finally {
            console.log("Split jobs process completed.");
        }
    }

    async handleNewAddressForSplitJobs(addressDetails: AddressViewModel, currentJob: IDispatchJob) {
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
        await this.DispatchData.finishSplitJobProcess(callData.jobID, FirstName);
        await this.getData();

        this.toastrService.showSuccessToast("Job Successfully Split");
        console.log("Job splitting complete!");
        console.log("Dialog closed!");

        return this.getJobList();
    }

    async truckLoadingStatus($event: MouseEvent) {
        await this.$mdDialog
            .show({
                controller: "TruckCourierStatusDialogController",
                controllerAs: "ctrl",
                parent: this.$document.parent(),
                targetEvent: $event,
                templateUrl: "app/components/dialogs/truck-courier-status-dialog/truck-courier-status-dialog.html",
                clickOutsideToClose: false,
                fullscreen: true,
                locals: {
                    data: Array.isArray(this.truckCourierStatus) ? this.truckCourierStatus[0] : this.truckCourierStatus,
                },
                bindToController: true,
            });
    }

    async createNewJob() {
        try {
            const newJobId = await this.showCreateJobDialog();
            if (newJobId) {
                await this.processNewJob(newJobId);
            }
        } catch (error: any) {
            console.log("Error in createNewJob:", error);
        }
    }

    async showCreateJobDialog() {
        return this.$mdDialog.show({
            controller: "CreateJobDialogController",
            controllerAs: "ctrl",
            parent: this.$document.parent(),
            template: require("../dialogs/create-job-dialog/create-job-dialog.html"),
            clickOutsideToClose: false,
            fullscreen: true,
            locals: {
                staffId: ContactID, despatcherName: FirstName,
            },
            bindToController: true,
        });
    }

    async processNewJob(newJobId: number) {
        await this.getData();

        const job = this.jobList.find(j => j.id === newJobId);
        if (!job) return;

        await this.selectJob(job);
        this.toastrService.showSuccessToast("New Job Created Successfully");
    }

    async interCourierCharge($event: MouseEvent) {
        await this.interCourierChargeDialogService.showInterCourierCharge($event);
    }

    async createEvent($event: MouseEvent, job: IDispatchJob) {
        await this.addEventDialogService.openAddEventDialog($event, job);
    }

    async checkForAttachments(jobId: number) {
        this.isCheckingAttachments = true;
        this.hasAttachedFile = false;

        try {
            const response = await this.DispatchData.isFilesAttachedToJob(jobId);
            this.hasAttachedFile = response;
            return response;
        } catch (error: any) {
            console.log("Error checking for attachments:", error);
            this.hasAttachedFile = false;
            throw error;
        } finally {
            this.isCheckingAttachments = false;
        }
    }

    async openFileAttachmentDialog($event: MouseEvent, job: IDispatchJob) {
        await this.jobFileUploadDialogService.openJobFileUploadDialog($event, job);
    }

    async showAdditionalServicesMenu($event: MouseEvent, job: IDispatchJob) {
        await this.additionalServicesDialogService.showAdditionalServicesDialog($event, job);
    }

    isJobSelected(jobId: number) {
        return this.dispatchState.selectedJobs.has(jobId);
    }

    updateCallData(callData: any, job: IDispatchJob, jobIdElement: any) {
        if (!callData.courierId) {
            callData.courierId = job.courierData?.courierId ?? 0;
        }

        if (job.displaySplitJobDetail) {
            callData.splitJobs.push(jobIdElement.data("jobid"));
        } else {
            callData.jobs.push(jobIdElement.attr("data-jobid"));
        }
    }

    async updateUIAfterCourierSelection(courier: ActiveCourierViewModel) {
        this.currentWorkSelection = ` for Courier ${courier.label}`;
        this.mapJobList = [...(this.jobsCurrentList || [])];
        this.truckCourierStatus = await this.DispatchData.truckCourierStatus(courier.courierId);
    }

    getStatusCount(statusType: string): number {
        if (!this.jobList || !Array.isArray(this.jobList)) {
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
            return this.jobList.filter(job =>
                job.statusId !== undefined &&
                statusGroups[normalizedStatusType].includes(job.statusId)
            ).length;
        }

        // Otherwise, check for a specific status name match
        return this.jobList.filter(job => {
            if (!job.statusName) {
                return false;
            }
            const normalizedJobStatus = job.statusName.toLowerCase().replace(/\s+/g, '-');
            return normalizedJobStatus === normalizedStatusType;
        }).length;
    }

    getUnreadCount() {
        return this.jobList.filter(job => !job.hasBeenRead).length;
    }

    async filterByStatus(statusGroup: string) {
        console.log('filterByStatus called with:', statusGroup);
        this.queryParams.order = statusGroup;

        await this.getJobList();
        console.log(`Jobs ordered by status group: ${statusGroup}`);
    }

    private applyLayoutDimensions() {
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

    getSupportsFilterLabel(): string {
        switch (this.supportsFilter) {
            case 'all':
                return 'All Supports';
            case 'mine':
                return 'My Supports';
            case 'unassigned':
                return 'Unassigned';
            case 'newest':
                return 'Newest First';
            case 'oldest':
                return 'Oldest First';
            default:
                return 'All Supports';
        }
    }

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

    async loadSupports(filterType: string = this.supportsFilter): Promise<void> {
        try {
            this.supportsLoading = true;

            // Build filter request based on filter type
            const filterRequest = this.buildFilterRequest(filterType);
            console.log('Filter request:', filterRequest);

            try {
                this.supports = await this.DispatchData.getAllTasks(filterRequest);
                this.filteredSupports = this.supports;
            } catch (serviceError) {
                console.error("Service error getting supports:", serviceError);
                this.toastrService.showErrorToast("Failed to load support items");

                this.supports = [];
                this.filteredSupports = [];
            }
        } catch (error) {
            console.error("Error loading supports:", error);
            this.toastrService.showErrorToast("Error loading support tasks");
        } finally {
            this.supportsLoading = false;
        }
    }

    async filterSupports(filterType: string): Promise<void> {
        this.supportsFilter = filterType;
        await this.loadSupports(filterType);
    }

    getContextMenuOptions(job: IDispatchJob) {
        if (!job) return [];

        const callbacks = {
            onRefresh: () => this.getData(),
            onSplitJob: (params: { job: IDispatchJob }) => this.handleSplitJob(params.job),
            onRefreshCourierJobs: (params: { courierId: number }) => {
                if (this.currentCourier) {
                    return this.getCurrentJobs(params.courierId);
                }
            }
        };

        return this.jobContextMenuService.getMenuOptions(job, callbacks);
    }

    async handleSplitJob(job: IDispatchJob) {
        if (!job) return;

        try {
            await this.setSplitJobMeetingPoint(new MouseEvent('click'), job);
            await this.getData();
        } catch (error: any) {
            console.error("Error handling split job:", error);
        }
    }

    openEditDialog($event: MouseEvent, job: IDispatchJob, field: 'lp' | 'ld', fieldName: string) {
        $event.stopPropagation(); // Prevent row selection

        const isLatePickup = field === 'lp';

        try {
            this.$mdEditDialog.small({
                modelValue: job[field] || '',
                placeholder: fieldName,
                save: (input: any) => {
                    const minutes = input.$modelValue;
                    if (!minutes) return;

                    try {
                        // Convert to a Date object if it's a string
                        const minAway: number = typeof minutes === 'string' ? parseInt(minutes) : minutes;

                        // Call the appropriate late call function
                        if (isLatePickup) {
                            return this.latePickup(minAway, job, null);
                        } else {
                            return this.lateDelivery(minAway, job, null);
                        }
                    } catch (error) {
                        console.error(`Error saving ${fieldName}:`, error);
                        this.toastrService.showErrorToast(`Failed to save ${fieldName}`);
                    }
                },
                targetEvent: $event,
                validators: {
                    'pattern': '[0-9]*'
                },
                type: 'number'
            });
        } catch (error) {
            console.error('Error opening edit dialog:', error);
            this.toastrService.showErrorToast(`Failed to open ${fieldName} dialog`);
        }
    }

    getTasksStatusCount(statusType: string): number {
        if (!this.supports || !Array.isArray(this.supports)) {
            return 0;
        }

        switch (statusType) {
            case 'mine':
                return this.supports.filter(support => support.assignee.id === ContactID).length;
            case 'unassigned':
                return this.supports.filter(support => !support.assignee.id).length;
            case 'newest':
                // For newest/oldest filters, we return the total count since they're
                // sorting options rather than filtering options
                return this.supports.length;
            case 'oldest':
                return this.supports.length;
            default:
                return this.supports.length;
        }
    }

    async filterTasks(filterType: string): Promise<void> {
        this.supportsFilter = filterType;
        await this.loadSupports(filterType);
    }

    private markJobReadStatus(jobId: number, isRead: boolean) {
        const jobIndex = this.jobList.findIndex((job) => job.id === jobId);
        if (jobIndex !== -1) {
            this.jobList[jobIndex] = {
                ...this.jobList[jobIndex],
                hasBeenRead: isRead
            };
        }
    }

    async refreshJobList(currentJobId?: number, currentCourierId?: number) {
        try {
            console.log("[HomeRefresh] - Refreshing job list");

            await this.getJobList();

            // Restore current job selection if applicable
            if (currentJobId) {
                const updatedJob = this.jobList.find(job => job.id === currentJobId);
                if (updatedJob) {
                    // Update currentJob with fresh data while maintaining the selection
                    this.currentJob = updatedJob;

                    // Mark as read since it was previously selected
                    this.markJobReadStatus(updatedJob.id, true);
                }
            }

            if (currentCourierId && this.currentCourier) {
                await this.getCurrentJobs(currentCourierId);
            }

            console.log("[HomeRefresh] - Job list refresh complete");
        } catch (error) {
            console.error("[HomeRefresh] - Error refreshing job list:", error);
        }
    }

    async openHubUrl() {
        await this.navigationService.openHubUrl();
    }

    async onSearchRangeChange(optionSelected: number) {
        this.dateSearchRange = optionSelected;

        if (optionSelected == 1) {
            // 24 Hours mode - reset to defaults
            this.startDate = dayjs(new Date(0)).toDate();
            this.endDate = dayjs().add(24, 'hours').toDate();

            // Use current date for dateCutoff (backward compatibility)
            this.jobCutoffDate = new Date();
        }

        await this.getData();
    }
}

const HomeComponent: angular.IComponentOptions = {
    template: require("./home.template.html"),
    controller: HomeController,
    controllerAs: "ctrl",
    bindings: {
        jobId: '<'
    }
}
export default HomeComponent;
