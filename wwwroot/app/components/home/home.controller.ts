import "./home.styles.less";
import GreetingService from "../../services/greeting.service";
import ToastrService from "../../services/ToastrService";
import DispatchCoreService from "../../services/dispatch-core.service";
import DispatchExecutorService from "../../services/dispatch-executor.service";
import {AppConfig} from "../../interfaces/app-config.interface";
import {
    AddressViewModel,
    AreaClearList,
    ClearListViewModel,
    CourierData,
    IJob, JobQueryParams,
    Suggestion,
    SupportViewModel
} from "../../interfaces/job.interface";
import {
    ActiveCourierViewModel,
    TruckCourierStatusViewModel
} from "../../interfaces/courier.interface";
import {IBox, IColumn, ILayout} from "../../interfaces/layout.interfaces";
import {DfrntPageViewModel} from "../../interfaces/dfrnt-page-view-model.interface";
import {JobStatus} from "../../enums/job-status.enum";
import BaseController from "../base-controller";
import {ITaskListItemConfig} from "../common/task-item-component/task-item.interfaces";
import {ExtendedTask} from "../task-dashboard/task-dashboard.interfaces";

interface ResendJobsRequest {
    call: string;
    jobs: number[];
    splitJobs: number[];
    jobNos: string[];
    courierId: number;
}

class HomeController extends BaseController {
    static $inject = [
        '$document',
        'greetingService',
        'JobDetailService',
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
        'AppPages',
        '$stateParams',
        '$filter'
    ];

    private readonly DOM_SELECTORS = {
        areaGroup: "#area-group .btn",
        driverLocations: "#driverLocations .listActive"
    } as const;

    mapJobList: IJob[] = []
    initialViewSet: any;
    currentJob?: IJob;
    jobList: IJob[];
    allCouriers: any;
    mapZoom: any;
    supportSettings: any;
    options: any;
    truckMode: any;
    supportChannel: any;
    showInput: any;
    isInternal?: boolean = false;
    queryParams: JobQueryParams;
    isUsCustomer: boolean;
    selectedCourier: any;
    jobRecordSearchText: any;
    dispatchCourierSearchTest: any;
    jobDetailFabIsOpen: any;
    courierListFabIsOpen: boolean;
    isCheckingAttachments: boolean;
    hasAttachedFile: boolean;
    views: DfrntPageViewModel[];
    selectedViews: DfrntPageViewModel[];
    mapCenter: any;
    autoZoomEnabled: boolean;
    filters: any;
    selectedFilter: any;
    selected: any;
    supports: any;
    driverLocations?: ClearListViewModel;
    truckCourierStatus?: TruckCourierStatusViewModel;
    boxes: any;
    dispatchState: any;
    pickService: any;
    pickClients: any;
    pickChannels: any;
    courierMenu: any;
    potentialCourierMenu: any;
    driverLocationsLoading: any;
    supportsLoading: any;
    potentialCouriersLoading: any;
    currentListLoading: any;
    supportListHeaders: any;
    currentListHeaders: any;
    potentialCouriersHeaders: any;
    layouts: any;
    defaultLayout: any;
    currentLayoutName: any;
    layout: any;
    map: any;
    courierSearchText: any;
    inputWidth: any;
    jobListPromise: any;
    refreshData: any;
    currentCourier: any;
    pickCouriers: any;
    pickAllCouriers?: ActiveCourierViewModel[];
    courier: any;
    lastjob: any;
    jobsCurrentList?: IJob[];
    potentialCouriers: any;
    currentWorkSelection: any;
    jobFilters: any;
    currentSupport: any;
    potentialCouriersSelection: any;
    currentSelection: any;
    selectedJobs: any;
    jobForDispatch: any;
    jobGroups: any;
    lateForm: any;
    eventForm: any;
    boxSortableOptions: {
        handle: string;
        connectWith: string;
        placeholder: string;
        tolerance: string;
        cursor: string;
        opacity: number;
        scroll: boolean;
        revert: number;
        delay: number;
        forcePlaceholderSize: boolean;
        start: (e: JQueryEventObject, ui: any) => void;
        over: (e: JQueryEventObject, ui: any) => void;
        out: (e: JQueryEventObject, ui: any) => void;
        stop: (e: JQueryEventObject, ui: any) => void
    };
    jobCutoffDate?: Date;
    supportItemConfig: ITaskListItemConfig = {
        showJobId: true,
        showAssignee: true,
        showJobType: false,
        showDateTime: true,
        showDescription: true,
        showStatusIndicators: false,
        maxDescriptionLength: 150,
        customClass: 'support-list-item',
        dateFormat: 'HH:mm',
        timeFormat: 'HH:mm',
        allowCompletion: true
    };

    constructor(
        private $document: angular.IDocumentService,
        private greetingService: GreetingService,
        private JobDetailService: any,
        private $mdDialog: angular.material.IDialogService,
        private $scope: angular.IScope,
        private $window: angular.IWindowService,
        private $timeout: angular.ITimeoutService,
        private toastrService: ToastrService,
        private DispatchData: DispatchCoreService,
        private uCSData: any,
        private dispatchJobService: DispatchExecutorService,
        private APP_CONFIG: AppConfig,
        private $mdSidenav: angular.material.ISidenavService,
        private AppPages: any,
        private $stateParams: angular.ui.IStateParamsService,
        private $filter: angular.IFilterService
    ) {
        super();

        // Views and Layout
        this.initialViewSet = false;

        $scope.$watch("selectedViews", (newViews) => {
            if (newViews) {
                this.initialViewSet = false;
                this.updateMapForSelectedViews();
            }
        }, true);

        this.JobDetailService.setSelectJobDetail(async () => {
            const currentJob = this.currentJob;
            await this.JobDetailService.setJob(this.currentJob);

            await this.getData();
            if (!currentJob) {
                return;
            }

            const refreshedJob = this.jobList.find((jo) => jo.id === currentJob.id);
            if (!refreshedJob) return;
            await this.selectJob(refreshedJob);
        });

        this.allCouriers = {display: false, includeUA: false};
        this.mapZoom = {display: true};
        this.supportSettings = {autoRefresh: true};

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

            start: (e: JQueryEventObject, ui: any) => {
                ui.item.addClass('dragging');

                const dragInfo = angular.element('#draggingItems');
                dragInfo.html(`Moving: ${ui.item.find('.md-headline-title').text().trim()}`);
                dragInfo.css({
                    display: 'block',
                    top: e.pageY + 20 + 'px',
                    left: e.pageX + 10 + 'px'
                });

                angular.element(document).on('mousemove.sortable', (event) => {
                    dragInfo.css({
                        top: event.pageY + 20 + 'px',
                        left: event.pageX + 10 + 'px'
                    });
                });
            },

            over: (e: JQueryEventObject, _: any) => {
                angular.element(e.target).addClass('ui-sortable-active');
            },

            out: (e: JQueryEventObject, _: any) => {
                angular.element(e.target).removeClass('ui-sortable-active');
            },

            // When drag operation stops
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


        this.options = {
            detail: {
                size: [{
                    id: 1, label: "Bike",
                }, {
                    id: 2, label: "Car",
                }, {
                    id: 3, label: "Van",
                }, {
                    id: 4, label: "Truck",
                }, {
                    id: 5, label: "Scooter",
                },], tracking: [{
                    id: 1, label: "Email",
                }, {
                    id: 2, label: "Mobile",
                }, {
                    id: 3, label: "Email & Mobile",
                },], DGClass: [{
                    id: 0, label: "0",
                }, {
                    id: 1, label: "1",
                }, {
                    id: 2, label: "2",
                }, {
                    id: 3, label: "3",
                }, {
                    id: 4, label: "4",
                }, {
                    id: 5, label: "5",
                }, {
                    id: 6, label: "6",
                }, {
                    id: 7, label: "7",
                }, {
                    id: 8, label: "8",
                }, {
                    id: 9, label: "9",
                },],
            },
        };

        this.truckMode = "On";
        this.supportChannel = JSON.parse(localStorage.getItem("support-channel-" + ContactID) ?? "null") || "All";

        this.showInput = {};

        this.allCouriers.display = true;

        /*   ///////////////////////////
           // HOTKEYS
           //////////////////////////
           hotkeys.add({
               combo: "ctrl+d",
               description: "Dispatch selected jobs",
               allowIn: ["INPUT", "SELECT", "TEXTAREA"],
               callback: () => {
                   if (angular.element(".activeTable .active").length > 0) {
                       this.dispatchJobsForm();
                   }
               },
           });
   */

        if (!this.isInternal) {
            this.getClientContacts().then(() => console.log("Get Data Complete!"));
        }

        const runSupportsUpdate = () => {
            this.getSupports().then(() => {
                this.$timeout(runSupportsUpdate, 60000);
            });
        };
        runSupportsUpdate();

        this.isInternal = ClientInternal === "True";
        this.queryParams = {
            order: "time",
            orderDirection: "asc",
        };

        // Set default date to today
        this.jobCutoffDate = new Date();
        if (Modernizr.localstorage) {
            const savedDate = localStorage.getItem(`jobCutoffDate-${ContactID}`);
            if (savedDate) {
                try {
                    this.jobCutoffDate = new Date(JSON.parse(savedDate));
                    this.queryParams.dateCutoff = this.jobCutoffDate;
                } catch (e) {
                    console.error("Error parsing saved date filter:", e);
                    this.jobCutoffDate = new Date();
                }
            }
        }


        this.isUsCustomer = this.APP_CONFIG.US_Customer;
        this.selectedCourier = null;

        this.courierSearchText = "";
        this.jobRecordSearchText = "";
        this.dispatchCourierSearchTest = "";
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

        this.filters = [{value: 1, label: "New", icon: "fiber_new", active: false}, {
            value: 2, label: "NDA", icon: "local_shipping", active: false,
        }, {value: 3, label: "Active", icon: "sync", active: false}, {
            value: 4, label: "Done", icon: "task_alt", active: false,
        }, {value: 5, label: "All", icon: "list_alt", active: true},];

        this.selectedFilter = this.loadFilterFromStorage();
        this.filters.forEach((filter: any) => {
            filter.active = filter.value === this.selectedFilter;
        });

        this.selected = [];
        this.jobList = [];
        this.supports = [];

        this.driverLocations = undefined;
        this.truckCourierStatus = undefined;

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
                title: "Supports",
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
            }, channelEvents: {
                onSelectionChanged: async () => {
                    try {
                        const temp = this.pickService.channel.map((el: any) => el.label);
                        await this.setSupportChannel(String(temp) || "All");
                    } catch (error: any) {
                        console.log("Error in onSelectionChanged:", error);
                    }
                },
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

        this.courierMenu = [{
            text: "Dispatch Selected", click: async ($itemScope: any) => {
                try {
                    const courierId = $itemScope.courier.courier || $itemScope.courier.code;
                    await this.dispatchJobs(courierId);
                    console.log("Dispatch Selected completed successfully");
                } catch (error: any) {
                    console.log("Error in Dispatch Selected:", error);
                }
            },
        },];

        this.potentialCourierMenu = [{
            text: "Dispatch Selected", async click($itemScope: any) {
                try {
                    await this.dispatchJobService.dispatchJobsFromPotentialCouriers($itemScope.courier.code);
                    console.log("Dispatch from Potential Couriers completed successfully");
                } catch (error: any) {
                    console.log("Error in Dispatch from Potential Couriers:", error);
                }
            },
        },];

        this.init();
    }

    private init() {
        this.initLayoutSystem(ContactID);

        this.loadPageViews().then(async () => {
            console.log("Loaded Page Views and Data!");

            const jobId = this.$stateParams.jobId;
            if (jobId) {
                try {
                    await this.getData();
                    const job: IJob = await this.DispatchData.getJobDetail(jobId);
                    return this.selectJob(job);
                } catch (error) {
                    console.error("Error loading initial job:", error);
                    this.toastrService.showErrorToast("Error loading job details");
                }
            } else {
                return this.getData();
            }
        });

        // Set up a watch to apply dimensions when layout changes
        this.$scope.$watch(() => this.layout, () => {
            this.$timeout(() => this._applyLayoutDimensions());
        }, true);

        // Ensure draggingItems container exists
        if (angular.element('#draggingItems').length === 0) {
            angular.element('body').append('<div id="draggingItems"></div>');
        }

        this.initJobWatcher();
        this.initWidgetLoadingStates();
        this.initTableHeaders();
    }

    private _updateBoxMetrics() {
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

    private _saveCurrentLayout() {
        if (!this.currentLayoutName || this.currentLayoutName === 'Default') {
            return;
        }

        this._updateBoxMetrics();

        const index = this.layouts.findIndex((l: ILayout) => l.name === this.currentLayoutName);
        if (index !== -1) {
            this.layouts[index].layout = angular.copy(this.layout);
            if (Modernizr.localstorage) {
                localStorage.setItem(`layouts-${ContactID}`, JSON.stringify(this.layouts));
            }
        }
    }

    getJobStyle(assigned: any) {
        const normal = {
            "font-weight": "normal",
        };

        const bold = {
            "font-weight": "bold",
        };

        if (assigned) {
            return bold;
        } else {
            return normal;
        }
    }

    initJobWatcher() {
        this.$scope.$on('refreshJobRequested', (_, jobId) => {
            console.log(`Parent received refresh request for jobId: ${jobId}`);

            this.DispatchData.getJobDetail(jobId)
                .then(updatedJob => {
                    console.log('Received updated job data:', updatedJob);

                    this.$timeout(() => {
                        this.currentJob = undefined;

                        this.$timeout(() => {
                            this.currentJob = updatedJob;
                            console.log('Job data refreshed successfully');
                        });
                    });
                })
                .catch(error => {
                    console.error('Failed to refresh job data:', error);
                    this.toastrService.showErrorToast('Failed to refresh job data');
                });
        });
    }

    initWidgetLoadingStates() {
        this.driverLocationsLoading = true;
        this.supportsLoading = false;
        this.potentialCouriersLoading = false;
        this.currentListLoading = false;
    }

    initTableHeaders() {
        this.supportListHeaders = [{key: "time", label: "Time"}, {key: "courier", label: "#"}, {
            key: "staff", label: "Staff",
        }, {key: "jobNum", label: "Job #"}, {key: "event", label: "Event"}, {
            key: "notes", label: "Notes",
        }, {key: "remain", label: "Remain"}, {key: "lockedBy", label: "Locked by"},];

        this.currentListHeaders = [{key: "time", label: "T"}, {key: "speed", label: "Speed"}, {
            key: "notify", label: "N",
        }, {key: "vehicle", label: "V"}, {key: "jobNo", label: "Job"}, {
            key: "client", label: "Client",
        }, {key: "from", label: "From"}, {key: "to", label: "To"}, {key: "", label: ""}, {
            key: "remain", label: "Remain",
        }, {key: "status", label: "S"}, {key: "lp", label: "LP"}, {key: "ld", label: "LD"}, {
            key: "runOrder", label: "RO",
        },];

        this.potentialCouriersHeaders = [{key: "courier", label: "Courier"}, {
            key: "rule", label: "Rule#",
        }, {key: "reason", label: "Reason"},];
    }

    // Layouts
    initLayoutSystem(ContactID: number) {
        this.layouts = [];
        this.defaultLayout = {
            name: "Default", layout: {
                columns: [{
                    id: "col1",
                    width: "65%",
                    boxes: [{name: "jobsList", height: "45%"}, {name: "jobDetail", height: "65%"},],
                }, {
                    id: "col2",
                    width: "17.5%",
                    boxes: [{name: "currentWork", height: "50%"}, {name: "supports", height: "50%"},],
                }, {
                    id: "col3",
                    width: "17.5%",
                    boxes: [{name: "driverLocations", height: "50%"}, {name: "map", height: "50%"},],
                },],
            },
        };

        // Load saved layouts or use default
        if (Modernizr.localstorage) {
            try {
                const storedLayouts = JSON.parse(localStorage.getItem(`layouts-${ContactID}`) || '[]');
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
        this.$scope.$watch("layout", (newValue, oldValue) => {
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
        const layout = this.layouts[index] || this.layouts[0];
        this.currentLayoutName = layout.name;
        this.layout = angular.copy(layout.layout);

        // Apply dimensions on next digest cycle
        this.$timeout(() => {
            this._applyLayoutDimensions();

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

                const currentLayout = {
                    name: name, layout: {
                        columns: this.layout.columns.map((col: IColumn) => ({
                            ...col,
                            width: angular.element(`#co-${col.id}`).css("flex-basis"),
                            boxes: col.boxes.map((box: IBox) => ({
                                ...box, height: angular
                                    .element(`#box-${box.name}`)
                                    .css("flex-basis"),
                            })),
                        })),
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

    saveFilterToStorage(filter: any) {
        if (Modernizr.localstorage) {
            localStorage.setItem(`selectedFilter-${ContactID}`, filter);
        }
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
        return this.greetingService.greetUser(FirstName);
    }

    async loadPageViews() {
        try {
            this.views = await this.DispatchData.getSelectedViews(ContactID, this.AppPages.Dispatch);

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

    supportChannelChanged() {
        console.log(this.pickService.channel);
    }

    onCourierSearchClick($event: MouseEvent) {
        const target = $event.target as HTMLElement;
        if (target?.tagName === "INPUT") {
            (target as HTMLInputElement).value = "";
            this.courierSearchText = "";
        }
    }

    attention(job: IJob) {
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
        if (job.childNotes?.length > 0) {
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
        if (this.showInput[boxID]) {
            this.showInput[boxID] = false;
            this.inputWidth[boxID] = 31;
        } else {
            this.inputWidth[boxID] = 200;
            this.showInput[boxID] = true;
        }
    }

    unlockJob(currentJob: IJob) {
        return this.JobDetailService.unlockJob(currentJob);
    }

    lockJob(currentJob: IJob) {
        return this.JobDetailService.lockJob(currentJob);
    }

    async selectClearList(selectedClearList: AreaClearList) {
        try {
            this._validateClearList(selectedClearList);

            this._updateUIElements();

            if (this._shouldProcessJobs()) {
                await this._processClearListJobs(selectedClearList.id);
            }
        } catch (error) {
            this._handleClearListError(error);
        }
    }

    private _validateClearList(clearList: AreaClearList) {
        if (!clearList) {
            throw new Error("Selected clear list is null or undefined");
        }
    }

    private _updateUIElements() {
        const areaGroupButtons = angular.element(this.DOM_SELECTORS.areaGroup);
        areaGroupButtons.removeClass("topBarActive");
    }

    private _shouldProcessJobs(): boolean {
        const activeLocations = angular.element(this.DOM_SELECTORS.driverLocations);
        return activeLocations.length <= 1;
    }

    private async _processClearListJobs(clearListId: number) {
        const envelope = await this.getClearListEnvelope(clearListId);
        if (!envelope) {
            throw new Error(`Failed to retrieve envelope for clear list ID: ${clearListId}`);
        }

        const selectedClients = this.pickService.clients.map((client: { id: number }) => client.id);
        this.jobListPromise = this.DispatchData.getClearListJobs(
            this.queryParams,
            selectedClients,
            this.isInternal ?? false,
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

    private _handleClearListError(error: unknown) {
        console.error("Clear list processing error:", error);
        this.jobList = [];
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

    async handleDispatchSelection(selectedCourier: Suggestion, job: IJob) {
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

    handleDispatchFieldClick(event: MouseEvent, job: IJob) {
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

    selectForDispatch(job: IJob) {
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
        await this.uCSData.reSendJobs(secondJobId);
        await this.uCSData.reAssignJobs(firstJobId);
        await this.uCSData.reSendJobs(firstJobId);
        await this.refreshData(true);
    }

    async voidJobForm(jobNumber: string, jobId: number) {
        try {
            const note = await this.$mdDialog
                .show(this.$mdDialog
                    .prompt()
                    .title("Void Job " + jobNumber)
                    .textContent("Add note to " + jobNumber)
                    .placeholder("Note")
                    .ariaLabel("Void job")
                    .required(true)
                    .ok("Void " + jobNumber)
                    .cancel("Cancel"));
            await this.DispatchData.addNote(jobId, note, FirstName, false);
            await this.DispatchData.voidJob(jobId);
            this.toastrService.showSuccessToast("Job voided successfully");
            return await this.getData();
        } catch (error: any) {
            console.error("Job void canceled or error occurred", error);
        }
    }

    messageClick($event: MouseEvent, job: IJob) {
        const selectedCourierId = this.selectedCourier ? this.selectedCourier.id : job.courierData.courierId;

        this.$mdDialog
            .show({
                controller: "SendMessageDialogController",
                controllerAs: "ctrl",
                parent: document.body,
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

    otherEventForm($event: MouseEvent, job: IJob) {
        this.$mdDialog
            .show({
                controller: "AddEventDialogController",
                controllerAs: "ctrl",
                templateUrl: "app/components/dialogs/add-event-dialog/add-event-dialog.html",
                parent: document.body,
                clickOutsideToClose: true,
                fullscreen: true,
                targetEvent: $event,
                locals: {
                    job: job, dispatcherName: FirstName, contactId: ContactID,
                },
                bindToController: true,
            })
            .then(() => {
                console.log("Pallet Dialog closed!");
            });
    }

    getSupportColorClass(support: SupportViewModel) {
        switch (support.eventType) {
            case 73:
                return "Yel";
            case 1:
            case 2:
                return "Gre";
            default:
                return "";
        }
    }

    selectAllContent($event: MouseEvent) {
        ($event.target as HTMLInputElement)?.select();
    }

    async lateOperation(minsAway: Date, job: IJob, obj: any, isPickup: boolean) {
        const operationType = isPickup ? "pickup" : "delivery";
        const currentValue = isPickup ? job.lp : job.ld;
        const lateType = isPickup ? 1 : 2;

        console.log(`Current ${operationType} = ${currentValue}`);
        console.log(`Param minsAway = ${minsAway}`);
        console.log(obj);

        try {
            await this.lateCall(minsAway.getTime(), lateType, job, true);
            console.log(`Late ${operationType} call completed successfully`);
        } catch (error) {
            console.error(`Error in late ${operationType} call:`, error);
        }
    }

    latePickup(minsAway: Date, job: IJob, obj: any) {
        return this.lateOperation(minsAway, job, obj, true);
    }

    lateDelivery(minsAway: Date, job: IJob, obj: any) {
        return this.lateOperation(minsAway, job, obj, false);
    }

    async lateCall(lateTime: number, lateType: number, job: IJob, calc: boolean): Promise<any> {
        try {
            if (!job.clientId) return;
            if (!job.jobType) return;
            const response = await this.DispatchData.lateCall(lateType, lateTime, job.minutes ?? 0, job.pickupTime ?? 0,
                job.alertLatePickup ?? 0, job.deliveryTime ?? 0, job.alertLateDelivery ?? 0, job.jobNo, job.clientId, job.contactName,
                ContactID, job.time ?? new Date(), job.id, job.jobType, job.speed, job.notify || job.speed, FirstName, calc);

            await this.getData();
            this.toastrService.showSuccessToast("Late call applied successfully");
            return response;
        } catch (error: any) {
            console.error("Error applying late call:", error);
        }
    }

    jobClass(job: IJob): string {
        if (!job) return "";

        const classes = [];

        // Add direct class if job is direct
        if (job.direct) {
            classes.push("direct");
        }

        // Add chilled class for specific speed types
        const chilledSpeedTypes = ["CT", "CTHIRE", "FT", "FTHIRE", "HC", "TC"];
        if (chilledSpeedTypes.includes(job.speed)) {
            classes.push("chilled");
        }

        // Add G class if job is dispatched (has a courier assigned)
        if (job.courier || job.assignedCourier) {
            classes.push("G");
        }

        return classes.join(" ");
    }

    async handleRowClick($event: MouseEvent, job: IJob) {
        if (!($event.target as HTMLElement)?.closest("md-autocomplete")) {
            try {
                await this.$timeout(async () => {
                    await this.selectJob(job);

                    const autocompleteContainer = angular.element(`#input_${job.id}`);
                    const inputElement = autocompleteContainer[0].querySelector("input");

                    if (inputElement) {
                        inputElement.focus();

                        const focusEvent = new Event("focus");
                        inputElement.dispatchEvent(focusEvent);

                        if (inputElement.value) {
                            inputElement.select();
                        }
                    }
                });
            } catch (error: any) {
                console.error("Error in handleRowClick:", error);
            }
        }
    }

    async dispatchJobs(courierId: number) {
        if (this.dispatchState.processing) {
            console.warn("Dispatch already in progress");
            return;
        }

        const jobsToDispatch = this._getJobsToDispatch();

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

    private _getJobsToDispatch() {
        return this.jobList.filter((job) => this.dispatchState.selectedJobs.has(job.id));
    }

    async reAllocateJobs(job: IJob) {
        if (!job) return;

        const callData = {
            call: "redespatchJobs",
            jobs: [] as number[],
            splitJobs: [] as number[],
            jobNos: [] as string[],
            courierId: null,
        };

        callData.jobs.push(job.id);

        if (!job.courierData?.courierId) return;
        const foundCourier = await this.DispatchData.getCourierById(job.courierData?.courierId);

        if (callData.jobs.length > 0) {
            await this.DispatchData.reAllocateJobs(foundCourier.courierId, ContactID, callData.jobs);
            this.toastrService.showSuccessToast("Jobs reallocated successfully");
        }

        await this.getData();
        this.courier = {gpsCourier: foundCourier.id};
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
            const foundCourier = this.pickCouriers.find((c: ActiveCourierViewModel) => c.courierId === lastJob.courierData.courierId)
            this.pickAllCouriers?.find((c: ActiveCourierViewModel) => c.courierId === this.lastjob.courierData.courierId);

            if (foundCourier) {
                this.courier = {gpsCourier: foundCourier.id};
                await this.searchCourier();
            }

        } catch (error: any) {
            console.log("Error updating data:", error);
        }
    }

    async restoreJob(job: IJob) {
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
            this.jobsCurrentList.forEach(job => {
                this.DispatchData.addRestoreEvent(job.id);

                if (callData.courierId === null) {
                    callData.courierId = job.courierData.courierId ?? null;
                    foundCourier = this.pickCouriers.find((c: ActiveCourierViewModel) => {
                        return c.courierId === job.courierData.courierId;
                    }) || this.pickAllCouriers?.find((c: ActiveCourierViewModel) => c.courierId === job.courierData.courierId);
                }

                if (job.displaySplitJobDetail) {
                    callData.splitJobs.push(job.id);
                } else {
                    callData.jobs.push(job.id);
                }
            });

            if (callData.splitJobs.length > 0 && foundCourier) {
                await this.DispatchData.restoreSplitJobs(callData.jobs);
                console.log("Restore split jobs complete");
            }
            if (callData.jobs.length > 0 && foundCourier) {
                await this.DispatchData.restoreJobs(callData.jobs);
                console.log("Restore Jobs complete");
            }

            this.$timeout(() => {
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
        const confirmDialog = this._createResendConfirmDialog($event);

        try {
            await this.$mdDialog.show(confirmDialog);
            const resendRequest: ResendJobsRequest = {
                call: "resendJobs",
                jobs: [],
                splitJobs: [],
                jobNos: [],
                courierId: this.currentCourier.courierId,
            };

            this._collectJobIds(resendRequest);
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

    private _createResendConfirmDialog($event: MouseEvent) {
        return this.$mdDialog
            .confirm()
            .title("Resend All Jobs")
            .textContent(`Are you sure you wish to resend all jobs for ${this.currentCourier.courier}`)
            .targetEvent($event)
            .ok("Yes")
            .cancel("No");
    }

    private _collectJobIds(request: ResendJobsRequest) {
        this.jobsCurrentList?.forEach((job: IJob) => {
            request.jobs.push(job.id);
        });
    }

    async restoreJobsFromCurrentWindow() {
        const callData = {
            call: "restoreJobs",
            jobs: [] as number[],
            splitJobs: [] as number[],
            jobNos: [] as string[],
            courierId: 0,
        };

        try {
            const activeJobs = this.jobsCurrentList?.filter(job => job.isActive);
            if (!activeJobs) return;

            for (let job of activeJobs) {
                await this.addRestoreEvent(job);
                this.updateCallData(callData, job, null);
            }

            const foundCourier = callData.courierId ? await this.DispatchData.getCourierById(callData.courierId) : null;
            if (!foundCourier) {
                await this.restoreJobs(callData);
            }

            await this.getData();
            this.courier = {gpsCourier: foundCourier?.id};
            await this.searchCourier();
        } catch (error: any) {
            console.log("Error in restoreJobsFromCurrentWindow:", error);
        }
    }

    async addRestoreEvent(job: IJob) {
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

    async setFirstJob(job: IJob) {
        try {
            await this.$mdDialog.show(this.$mdDialog
                .confirm()
                .title("Set First Job?")
                .textContent("Are you sure you wish to set this as the First Job?")
                .ok("Yes")
                .cancel("No"));
            await this.DispatchData.setFirstJob(job.id, this.currentCourier.courierId);
            await this.getCurrentJobs(this.currentCourier.courierId);
            this.toastrService.showSuccessToast("Job set as first job successfully");
        } catch (error: any) {
            console.log("Action cancelled or error occurred:", error);
        }
    }

    //////////////////////////////
    //  SPLIT JOB //
    /////////////////////////////
    async splitJob($event: MouseEvent, job: IJob) {
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
            .parent(document.body)
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
            classes: {"ui-droppable-hover": "active"}, drop: async function (event: MouseEvent, ui: any) {
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

        await this.getCurrentJobs(courierId);
        try {
            this.truckCourierStatus = await this.DispatchData.truckCourierStatus(courierId);
        } catch (error: any) {
            console.error("Error fetching truck courier status:", error);
        }
    }

    async selectedCourierChange(courier: Suggestion) {
        if (!courier) {
            this.currentCourier = null;
            this.mapJobList = this.jobList;
            return;
        }

        const courierId = courier.id;
        const courierName = courier.text;

        if (!courierId || !courierName) {
            console.error("Invalid courier data structure:", courier);
            return;
        }

        await this.updateCourierData(courierId, courierName);
        this.mapJobList = this.jobsCurrentList || [];
    }

    async searchCourier() {
        try {
            const foundCourier = await this.DispatchData.getCourierById(this.courier.gpsCourier);
            if (!foundCourier) {
                await this.showAlert("Attention", "Courier not found.");
                return;
            }

            await this.updateCourierData(foundCourier.courierId, foundCourier.name);

            this.mapJobList = this.jobsCurrentList || [];
        } catch (error: any) {
            console.error("Error searching courier:", error);
        }
    }

    async selectCourier(courier: CourierData) {
        try {
            // Set loading states
            await this.$timeout(() => {
                this.currentListLoading = true;
            });

            if (!courier || courier.courierId === undefined) return;
            const foundCourier = await this.DispatchData.getCourierById(courier.courierId);
            if (foundCourier) {
                // Update current courier information
                this.currentCourier = {
                    courierId: foundCourier.courierId,
                    courier: foundCourier.label || `${foundCourier.label} ${foundCourier.name}`,
                };

                this.currentWorkSelection = ` for Courier ${this.currentCourier.courier}`;
                await this.getCurrentJobs(foundCourier.courierId);

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
            // Reset loading states
            await this.$timeout(() => {
                this.currentListLoading = false;
            });
        }
    }

    async refreshTruckCourierStatus() {
        try {
            this.truckCourierStatus = await this.DispatchData.truckCourierStatus(this.currentCourier.courierId);
        } catch (error: any) {
            console.error("Error refreshing truck courier status:", error);
        }
    }

    async selectMapCourier(courier: ActiveCourierViewModel) {
        try {
            const foundCourier = await this.DispatchData.getCourierById(courier.courierId);
            this.currentCourier = {
                courierId: foundCourier?.courierId, courier: foundCourier?.label,
            };

            await this.getCurrentJobs(courier.courierId)
            await this.updateUIAfterCourierSelection(courier);
        } catch (error: any) {
            console.error("An error occurred:", error);
        }
    }

    clearCourierSearch() {
        this.jobsCurrentList = [];
        this.courier.gpsCourier = "";
        this.currentWorkSelection = "";
        this.mapJobList = this.jobList;
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
        if (courier.courier === undefined) {
            courier.courier = `${courier.courier} ${courier.courierName}`;
        }
    }

    async displayJobsForCourier(courier: CourierData) {
        const foundCourier = this.pickCouriers.find((x: ActiveCourierViewModel) => x.courierId === courier.courierId);
        const code = foundCourier?.id ?? '';
        if (courier.courierId === undefined) {
            throw new Error('Courier ID is required');
        }
        const data = await this.DispatchData.getJobsCurrent(courier.courierId, this.jobFilters.status === "done");

        if (this.currentJob !== null && this.currentJob?.courier !== code) {
            this.currentJob = undefined;
        }

        this.jobsCurrentList = data;
        await this.activateDrop();
    }

    private _isValidCoordinates(lat: number, lng: number) {
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

            this.jobsCurrentList = await this.DispatchData.getJobsCurrent(courierId, this.jobFilters && this.jobFilters.status === "done");
            this.mapJobList = this.jobsCurrentList || [];

            await this.activateDrop();
        } catch (error: any) {
            console.error("Error getting current jobs:", error);
            this.jobsCurrentList = [];
            this.mapJobList = [];
        } finally {
            this.currentListLoading = false;
        }
    }

    async selectJobDetail(job: IJob) {
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

    async selectSupportJobDetail(support: SupportViewModel) {
        console.log(`select Job ${support.jobId}`);

        // Set the current support before any other operations
        this.currentSupport = support;

        try {
            if (!support.jobId) return;
            const jobData = await this.DispatchData.getJobDetail(support.jobId);
            await this.selectJob(jobData);

            this.currentSelection = ` for Job ${support.jobNumber}`;

            if (this.currentJob && this.currentJob.rootParentId) {
                try {
                    if (!this.currentJob.clientId) return;
                    this.currentJob.relatedJobs = await this.DispatchData.getRelatedJobs(this.currentJob.rootParentId, this.currentJob.clientId);
                } catch (error: any) {
                    console.error("Error getting related jobs:", error);
                }
            }
        } catch (error: any) {
            console.error("Error selecting support job detail:", error);
            this.toastrService.showErrorToast("Error loading job details");
        }
    }

    async selectJob(job: IJob) {
        console.log("Selected job run...");
        console.log(job);

        if (!job) return;

        await this.$timeout(async () => {
            this.selectedJobs = [];
            this.currentSupport = null;

            // Create a new reference to trigger change detection
            this.currentJob = angular.copy(job);

            // Add watcher for currentJob changes
            const unwatchJob = this.$scope.$watch('currentJob', (newValue: IJob | null, oldValue: IJob | null) => {
                try {
                    if (!newValue || !oldValue) return;

                    if (!angular.equals(newValue, oldValue)) {
                        const jobIndex = this.jobList.findIndex(j => j.id === newValue.id);
                        if (jobIndex !== -1) {
                            if (this._isValidJob(newValue)) {
                                this.jobList[jobIndex] = angular.copy(newValue);
                            } else {
                                console.warn('Invalid job structure detected');
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error in currentJob watcher:', error);
                }
            }, true);

            // Clean up watcher when job changes
            this.$scope.$on('$destroy', unwatchJob);

            await this.JobDetailService.setJob(this.currentJob);
            await this.checkForAttachments(job.id);
            try {
                this.pickCouriers = await this.DispatchData.getActiveCouriers();
            } catch (error: any) {
                console.error("Error getting active couriers:", error);
            }

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
                    await this.handleUndispatchedJob(job);
                } else {
                    // Job is dispatched
                    this.potentialCouriers = false;
                    if (job.courierData) {
                        await this.selectCourier(job.courierData);

                        // Display route points for the single job
                        if (job.pickupAddress?.latitude != null && job.pickupAddress?.longitude != null &&
                            job.deliveryAddress?.latitude != null && job.deliveryAddress?.longitude != null &&
                            this._isValidCoordinates(job.pickupAddress.latitude, job.pickupAddress.longitude) &&
                            this._isValidCoordinates(job.deliveryAddress.latitude, job.deliveryAddress.longitude)) {
                            // Create bounds that include pickup and delivery points
                            const bounds = new this.$window.google.maps.LatLngBounds();
                            bounds.extend(new this.$window.google.maps.LatLng(job.pickupAddress.latitude, job.pickupAddress.longitude));
                            bounds.extend(new this.$window.google.maps.LatLng(job.deliveryAddress.latitude, job.deliveryAddress.longitude));

                            // If courier position is available, include it
                            if (job.courierData.latitude != null && job.courierData.longitude != null &&
                                this._isValidCoordinates(job.courierData.latitude, job.courierData.longitude)) {
                                bounds.extend(new this.$window.google.maps.LatLng(job.courierData.latitude, job.courierData.longitude));
                            }
                        } else {
                            console.warn("Invalid coordinates for job:", job);
                        }
                    } else {
                        console.warn("Missing courier data for job:", job);
                    }
                }
            } catch (error: any) {
                console.error("An error occurred finding couriers:", error);
            }

            // Only focus the dispatch field for the selected job, not all jobs
            this.focusDispatchField(job.id);
        }, 0);
    }

    private _isValidJob(job: any): job is IJob {
        return (
            job !== null &&
            typeof job === 'object' &&
            'id' in job &&
            typeof job.id !== 'undefined'
        );
    }

    async handleUndispatchedJob(job: IJob) {
        this.jobGroups = false;
        await this.getPotentialCouriers(job.id);
        this.potentialCouriersSelection = ` for Job ${job.jobNo}`;
        this.currentCourier = null;
        this.currentSelection = ` for Job ${job.jobNo}`;

        // Verify we have valid coordinates before displaying
        if (this.autoZoomEnabled && this.map) {
            if (job.pickupAddress?.latitude != null && job.pickupAddress?.longitude != null && this._isValidCoordinates(job.pickupAddress.latitude, job.pickupAddress.longitude)) {
                // Set bounds for pickup point
                const bounds = new this.$window.google.maps.LatLngBounds();
                bounds.extend(new this.$window.google.maps.LatLng(job.pickupAddress.latitude, job.pickupAddress.longitude));

                // If delivery coordinates are valid, include them too
                if (job.deliveryAddress?.latitude != null && job.deliveryAddress?.longitude != null && this._isValidCoordinates(job.deliveryAddress.latitude, job.deliveryAddress.longitude)) {
                    bounds.extend(new this.$window.google.maps.LatLng(job.deliveryAddress.latitude, job.deliveryAddress.longitude));
                }
            } else {
                console.warn("Invalid pickup coordinates for job:", job);
            }
        }
    }

    focusDispatchField(jobId: number) {
        this.$timeout(() => {
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

    async showJobContextMenu($event: MouseEvent, job: IJob) {
        try {
            await this.selectJob(job);

            const contextMenuElement = angular.element('context-menu');
            const contextMenuCtrl = contextMenuElement.controller('contextMenu');

            if (contextMenuCtrl) {
                contextMenuCtrl.showJobContextMenu($event, job);
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

    async setSupportChannel(channel: string) {
        this.supportChannel = channel;
        if (Modernizr.localstorage) {
            localStorage.setItem("support-channel-" + ContactID, JSON.stringify(this.supportChannel));
        }

        await this.getSupports();
    }

    async handleMarkerClick(job: IJob) {
        if (job) {
            await this.selectJob(job);
        }
    }

    private initializeJobSearchFields(jobs: IJob[]) {
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

            console.log('Params:', params);

            this.jobListPromise = this.dispatchJobService.getJobListWithCourierData(
                params,
                selectedClients,
                this.isInternal ?? false,
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
        await this.applyJobCutoffDate();
    }

   async resetJobCutoffDate() {
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

        if (Modernizr.localstorage) {
            localStorage.setItem(`jobCutoffDate-${ContactID}`, JSON.stringify(this.jobCutoffDate));
        }

        this.queryParams.dateCutoff = this.jobCutoffDate;
        await this.getJobList();
    }

    async lockSupport(support: SupportViewModel) {
        if (!support) return;

        console.log(support);
        try {
            if (support.lockedBy === FirstName) {
                if (support.eventId !== null) {
                    await this.DispatchData.unLockSupport(support.eventId, FirstName);
                }
                this.toastrService.showSuccessToast("Support unlocked successfully");
            } else {
                if (support.eventId !== null) {
                    await this.DispatchData.lockSupport(support.eventId, FirstName);
                }
                this.toastrService.showSuccessToast("Support locked successfully");
            }
            await this.getSupports();
        } catch (error: any) {
            console.log("Error locking/unlocking support:", error);
        }
    }

    setSelectedChannels(item: string) {
        const sr = this.pickChannels.find((obj: any) => obj.label === item);
        this.pickService.channel.push(sr);
    }

    async getSupports() {
        try {
            this.supportsLoading = true;
            const data = await this.DispatchData.getSupports(this.supportChannel);

            const first = this.supports === null || this.supports === undefined;

            this.supports = data;

            if (first) {
                this.supportChannel.split(",").forEach((channel: any) => this.setSelectedChannels(channel));
            }

            this.$timeout(() => {
                this.$document.ready(() => {
                    if (this.currentSupport) {
                        angular
                            .element("#supports tr[data-id='" + this.currentSupport.eventId + "']")
                            .addClass("active");
                    }
                });
            }, 100);
        } catch (error: any) {
            console.log("Error getting supports:", error);
        } finally {
            this.supportsLoading = false;
        }
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
            this.JobDetailService.currentJob = null;
            this.potentialCouriers = null;
            this.jobGroups = false;

            if (!this.courier) {
                this.currentCourier = null;
            }

            const [activeCouriers, allCouriers] = await Promise.all([
                this.DispatchData.getActiveCouriers(),
                this.DispatchData.getAllCouriers(),
            ]);

            this.pickCouriers = activeCouriers;
            this.pickAllCouriers = allCouriers;

            await this.getJobList();
            this.mapJobList = this.jobList;
        } catch (error: any) {
            console.error("Error in getData:", error);
            console.log("An error occurred while loading data. Please refresh the page.");
        }
    }

    async fetchDriverLocations() {
        this.driverLocationsLoading = true;

        await this.getDriverLocationsData();
        this.driverLocationsLoading = false;
    }

    async getDriverLocationsData() {
        try {
            // Filter views to only include selected ones
            const selectedViews = this.views.filter((view) => view.selected);
            if (!selectedViews) return;

            this.driverLocations = await this.DispatchData.getDriverLocations(selectedViews);

            console.log("Driver Locations: ", this.driverLocations);
            await this.activateDrop();
        } catch (error: any) {
            console.error("Error getting clear lists data:", error);
        }
    }

    async setSplitJobMeetingPoint($event: MouseEvent, currentJob: IJob) {
        const getDeliveryLocation = (job: IJob) => ({
            lat: job.deliveryLatitude || "", long: job.deliveryLongitude || "",
        });

        try {
            const location = getDeliveryLocation(currentJob);
            console.log("Retrieved job coordinates!");

            const selectedSuburbs = await this.DispatchData.getSuburbList();
            const dialogResult = await this.showEditAddressDialog($event, currentJob, selectedSuburbs, location);
            await this.handleDialogResult(dialogResult, currentJob);
        } catch (error: any) {
            console.log(error.message);
        } finally {
            console.log("Split jobs process completed.");
        }
    }

    showEditAddressDialog($event: MouseEvent, currentJob: IJob, selectedSuburbs: any, location: any) {
        return this.$mdDialog.show({
            controller: "EditAddressDialogController",
            controllerAs: "ctrl",
            templateUrl: "app/components/dialogs/edit-address-dialog/edit-address-dialog.html",
            parent: document.body,
            targetEvent: $event,
            clickOutsideToClose: false,
            fullscreen: true,
            locals: {
                addressDetails: {
                    address: currentJob.toAddress,
                    lat: location.lat,
                    long: location.long,
                    suburb: currentJob.toSuburbName,
                    postCode: currentJob.toPostCode,
                }, suburbOptions: selectedSuburbs, title: "Split Job Address and GPS", submitLabel: "Split Job",
            },
            bindToController: true,
        });
    }

    async handleDialogResult(addressDetails: AddressViewModel, currentJob: IJob) {
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

    addEvent() {
        let time = new Date();
        time.setSeconds(0);
        time.setMilliseconds(0);

        if (!this.currentJob) return;
        this.eventForm = {
            data: {
                jobNum: this.currentJob.jobNo,
                client: this.currentJob.client,
                event: "Other",
                date: new Date(),
                time: time,
            }, submit() {
            }, cancel() {
                angular.element(".eventForm").css("display", "none");
            },
        };

        angular.element(".eventForm").css("display", "");
    }

    async truckLoadingStatus($event: MouseEvent) {
        await this.$mdDialog
            .show({
                controller: "TruckCourierStatusDialogController",
                controllerAs: "ctrl",
                parent: document.body,
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
            parent: document.body,
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
        try {
            const job = await this.DispatchData.getJobDetail(newJobId);
            await this.getData();
            await this.selectJob(job);
            this.toastrService.showSuccessToast("New Job Created Successfully");
        } finally {
            // Any cleanup operations can go here
        }
    }

    async interCourierCharge($event: MouseEvent) {
        try {
            await this.$mdDialog.show({
                controller: "InterCourierChargeDialog",
                controllerAs: "ctrl",
                parent: document.body,
                targetEvent: $event,
                template: require("../dialogs/inter-courier-charge-dialog/inter-courier-charge-dialog.html"),
                clickOutsideToClose: false,
                fullscreen: true,
                locals: {
                    staffId: ContactID,
                },
                bindToController: true,
            });

            console.log("Inter-courier Charge Added!");
            this.toastrService.showSuccessToast("Inter-courier charge added successfully");
        } catch (error: any) {
            if (error === undefined) {
                console.log("Inter-courier Charge Canceled!");
            } else {
                throw error;
            }
        }
    }

    async createEvent($event: MouseEvent, job: IJob) {
        try {
            await this.$mdDialog.show({
                controller: "AddEventDialogController",
                controllerAs: "ctrl",
                template: require("../dialogs/add-event-dialog/add-event-dialog.html"),
                targetEvent: $event,
                parent: document.body,
                clickOutsideToClose: true,
                fullscreen: true,
                locals: {
                    job: job, dispatherName: FirstName, contactId: ContactID,
                },
                bindToController: true,
            });

            this.toastrService.showSuccessToast("Event created successfully");
            console.log("Pallet Dialog closed!");
        } catch (error: any) {
            if (error === undefined) {
                console.log("User canceled!");
            } else {
                throw error;
            }
        }
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

    async openFileAttachmentDialog($event: MouseEvent, job: IJob) {
        try {
            await this.$mdDialog.show({
                controller: "JobFileUploadController",
                controllerAs: "ctrl",
                parent: document.body,
                targetEvent: $event,
                template: require("../dialogs/job-file-upload-dialog/job-file-upload-dialog.html"),
                clickOutsideToClose: false,
                fullscreen: true,
                locals: {
                    jobId: job.id,
                },
                bindToController: true,
            });

            console.log("Job File Upload Dialog Closed!");
        } catch (error: any) {
            if (error === undefined) {
                console.log("User canceled!");
            } else {
                throw error;
            }
        }
    }

    async showAdditionalServicesMenu($event: MouseEvent, job: IJob) {
        try {
            if (!job.clientId || !job.speedId) {
                return;
            }

            const isClientItemsAvailable = await this.DispatchData.hasClientItemsAvailable(job.clientId, job.speedId);

            if (!isClientItemsAvailable) {
                await this.$mdDialog.show(this.$mdDialog
                    .alert()
                    .clickOutsideToClose(true)
                    .title("No Additional Services")
                    .targetEvent($event)
                    .textContent("No additional services has been set up for this client. Please add a service through Admin Manager and try again.")
                    .ok("OK"));
                return;
            }

            await this.$mdDialog.show({
                controller: "AdditionalServicesDialogController",
                controllerAs: "ctrl",
                template: require("../dialogs/additional-services-dialog/additional-services-dialog.html"),
                parent: document.body,
                clickOutsideToClose: false,
                fullscreen: true,
                locals: {
                    job: job,
                },
                bindToController: true,
            });

            console.log("Additional Services Dialog closed!");
        } catch (error: any) {
            if (error === undefined) {
                console.log("User canceled dialog!");
            } else {
                console.error("Error in showAdditionalServicesMenu:", error);
            }
        }
    }

    isJobSelected(jobId: number) {
        return this.dispatchState.selectedJobs.has(jobId);
    }

    updateCallData(callData: any, job: IJob, jobIdElement: any) {
        if (!callData.courierId) {
            callData.courierId = job.courierData.courierId;
        }

        if (job.displaySplitJobDetail) {
            callData.splitJobs.push(jobIdElement.data("jobid"));
        } else {
            callData.jobs.push(jobIdElement.attr("data-jobid"));
        }
    }

    async fetchAndDisplayCurrentJobs(jobs: IJob[]) {
        if (!Array.isArray(jobs)) {
            console.warn("Invalid jobs data received:", jobs);
            return [];
        }

        // Map numeric values to proper job objects if needed
        const processedJobs = jobs.map((job) => {
            return job;
        });

        this.jobList = processedJobs;

        await this.activateDrop();
        return processedJobs;
    }

    async updateUIAfterCourierSelection(courier: ActiveCourierViewModel) {
        this.currentWorkSelection = ` for Courier ${courier.label}`;

        this.truckCourierStatus = await this.DispatchData.truckCourierStatus(courier.courierId);
    }

    getStatusCount(statusType: string): number {
        if (!this.jobList || !Array.isArray(this.jobList)) {
            return 0;
        }

        // Convert status type to lowercase and replace spaces with hyphens
        const normalizedStatusType = statusType.toLowerCase().replace(/\s+/g, '-');

        // Map common category names to arrays of actual status IDs with proper typing
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

    async filterByStatus(statusGroup: string) {
        console.log('filterByStatus called with:', statusGroup);
        this.queryParams.order = statusGroup;

        await this.getJobList();
        console.log(`Jobs ordered by status group: ${statusGroup}`);
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
                        boxEl.css('flex-basis', box.height);
                    }
                });
            }
        });
    }

    supportToTaskModel(support: SupportViewModel): ExtendedTask {
        const priorityMap: { [key: number]: string } = {
            73: 'high',   // Yellow status
            1: 'low',     // Green status
            2: 'low',     // Green status
            0: 'medium'   // Default priority
        };

        // Get priority based on event type or default to medium
        const priority = support.eventType !== null ? priorityMap[support.eventType] || 'medium' : 'medium';

        // Determine appropriate icon based on support type
        let icon: string;
        if (support.description?.toLowerCase().includes('late')) {
            icon = 'schedule';
        } else if (support.description?.toLowerCase().includes('message')) {
            icon = 'message';
        } else if (support.description?.toLowerCase().includes('call')) {
            icon = 'phone';
        } else {
            icon = 'support';
        }

        return {
            id: support.eventId || 0,
            title: `${support.description || 'Support Event'}`,
            description: support.notes || '',
            dueDate: support.timeStamp ? new Date(support.timeStamp).toISOString() : new Date().toISOString(),
            closed: false,
            priority: priority,
            assignee: {
                id: support.eventId || 0,
                text: support.staff || 'Unassigned'
            },
            eventType: 'support',
            jobId: support.jobId || 0,
            jobNumber: support.jobNumber,
            icon: icon,
            isOverdue: false,
            dueTimeStr: support.timeStamp ? this.$filter('date')(support.timeStamp, 'HH:mm') : '',

            // Additional metadata for handling in callbacks
            _supportData: support
        };
    }

    async closeSupport(task: ExtendedTask) {
        const support = task._supportData || this.supports.find((s: SupportViewModel) => s.eventId === task.id);

        if (!support || !support.eventId) {
            console.error('Cannot close support: Invalid support data');
            this.toastrService.showErrorToast('Could not close support ticket: Invalid data');
            return;
        }

        try {
            await this.DispatchData.closeSupport(support.eventId, ContactID);
            await this.getSupports();
            this.currentSupport = null;
            this.toastrService.showSuccessToast('Support ticket closed successfully');
        } catch (error) {
            console.error('Error closing support:', error);
            this.toastrService.showErrorToast('Could not close support ticket');

            await this.getSupports();
        }
    }
    getSupportItemClass(support: SupportViewModel): string {
        const baseClass = this.getSupportColorClass(support);
        if (support.eventId === (this.currentSupport?.eventId || 0)) {
            return `${baseClass} selected-support-item`;
        }
        return baseClass;
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
