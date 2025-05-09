"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HomeController = void 0;
require("./home.styles.less");
const bindAllMethods_1 = require("../../bindAllMethods");
const job_status_enum_1 = require("../../enums/job-status.enum");
class HomeController {
    constructor($document, greetingService, JobDetailService, $mdDialog, $scope, $window, $timeout, toastrService, DispatchData, uCSData, dispatchJobService, hotkeys, APP_CONFIG, $mdSidenav, AppPages, $stateParams, NgMap) {
        var _a;
        this.$document = $document;
        this.greetingService = greetingService;
        this.JobDetailService = JobDetailService;
        this.$mdDialog = $mdDialog;
        this.$scope = $scope;
        this.$window = $window;
        this.$timeout = $timeout;
        this.toastrService = toastrService;
        this.DispatchData = DispatchData;
        this.uCSData = uCSData;
        this.dispatchJobService = dispatchJobService;
        this.hotkeys = hotkeys;
        this.APP_CONFIG = APP_CONFIG;
        this.$mdSidenav = $mdSidenav;
        this.AppPages = AppPages;
        this.$stateParams = $stateParams;
        this.NgMap = NgMap;
        this.DOM_SELECTORS = {
            areaGroup: "#area-group .btn",
            driverLocations: "#driverLocations .listActive"
        };
        this.isInternal = false;
        this.initialViewSet = false;
        bindAllMethods_1.bindAllMethods(this);
        $scope.$watch("selectedViews", (newViews) => {
            if (newViews) {
                this.initialViewSet = false;
                this.updateMapForSelectedViews();
            }
        }, true);
        this.JobDetailService.setSelectJobDetail(() => __awaiter(this, void 0, void 0, function* () {
            const currentJob = this.currentJob;
            yield this.JobDetailService.setJob(this.currentJob);
            yield this.getData();
            if (!currentJob) {
                return;
            }
            const refreshedJob = this.jobList.find((jo) => jo.id === currentJob.id);
            if (!refreshedJob)
                return;
            yield this.selectJob(refreshedJob);
        }));
        this.allCouriers = { display: false, includeUA: false };
        this.mapZoom = { display: true };
        this.supportSettings = { autoRefresh: true };
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
        this.supportChannel = JSON.parse((_a = localStorage.getItem("support-channel-" + ContactID)) !== null && _a !== void 0 ? _a : "null") || "All";
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
            status: "all"
        };
        this.isUsCustomer = this.APP_CONFIG.US_Customer;
        this.selectedCourier = null;
        // Init job table limit
        this.initTableLimit();
        // Loading States
        this.initWidgetLoadingStates();
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
        this.courierPositions = [];
        this.mapZoom = 4;
        this.autoZoomEnabled = true;
        if (Modernizr.localstorage) {
            const savedMapZoom = localStorage.getItem("mapZoom-" + ContactID);
            if (savedMapZoom) {
                try {
                    const parsedMapZoom = JSON.parse(savedMapZoom);
                    this.autoZoomEnabled = parsedMapZoom.display;
                }
                catch (e) {
                    console.error("Error parsing saved map zoom:", e);
                    this.autoZoomEnabled = true;
                }
            }
        }
        this.filters = [{ value: 1, label: "New", icon: "fiber_new", active: false }, {
                value: 2, label: "NDA", icon: "local_shipping", active: false,
            }, { value: 3, label: "Active", icon: "sync", active: false }, {
                value: 4, label: "Done", icon: "task_alt", active: false,
            }, { value: 5, label: "All", icon: "list_alt", active: true },];
        this.selectedFilter = this.loadFilterFromStorage();
        this.filters.forEach((filter) => {
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
                onSelectionChanged: () => __awaiter(this, void 0, void 0, function* () {
                    try {
                        const temp = this.pickService.channel.map((el) => el.label);
                        yield this.setSupportChannel(String(temp) || "All");
                    }
                    catch (error) {
                        console.log("Error in onSelectionChanged:", error);
                    }
                }),
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
        // Set up table headers
        this.initTableHeaders();
        //Job Detail Watcher
        this.initJobWatcher();
        this.courierMenu = [{
                text: "Dispatch Selected", click: ($itemScope) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        const courierId = $itemScope.courier.courier || $itemScope.courier.code;
                        yield this.dispatchJobs(courierId);
                        console.log("Dispatch Selected completed successfully");
                    }
                    catch (error) {
                        console.log("Error in Dispatch Selected:", error);
                    }
                }),
            },];
        this.potentialCourierMenu = [{
                text: "Dispatch Selected", click($itemScope) {
                    return __awaiter(this, void 0, void 0, function* () {
                        try {
                            yield this.dispatchJobService.dispatchJobsFromPotentialCouriers($itemScope.courier.code);
                            console.log("Dispatch from Potential Couriers completed successfully");
                        }
                        catch (error) {
                            console.log("Error in Dispatch from Potential Couriers:", error);
                        }
                    });
                },
            },];
        this.$scope.$on('courierLocationsNeedRefresh', () => {
            return this.getAvailableCourierLocation();
        });
        this.init();
    }
    getJobStyle(assigned) {
        const normal = {
            "font-weight": "normal",
        };
        const bold = {
            "font-weight": "bold",
        };
        if (assigned) {
            return bold;
        }
        else {
            return normal;
        }
    }
    initJobWatcher() {
        this.$scope.$on('refreshJobRequested', (event, jobId) => {
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
    initTableLimit() {
        // Watcher for job table limit to save value
        this.$scope.$watch(() => this.queryParams.limit, (newValue, oldValue) => {
            if (newValue !== oldValue) {
                if (Modernizr.localstorage) {
                    localStorage.setItem(`despatchJobLimitDisplay`, this.queryParams.limit);
                }
            }
        });
        // Get saved limit
        const savedLimit = localStorage.getItem(`despatchJobLimitDisplay`);
        console.log(`Saved limit is: ${savedLimit}`);
        if (savedLimit) {
            this.queryParams.limit = savedLimit;
        }
    }
    initWidgetLoadingStates() {
        this.driverLocationsLoading = true;
        this.supportsLoading = false;
        this.potentialCouriersLoading = false;
        this.currentListLoading = false;
    }
    initTableHeaders() {
        this.supportListHeaders = [{ key: "time", label: "Time" }, { key: "courier", label: "#" }, {
                key: "staff", label: "Staff",
            }, { key: "jobNum", label: "Job #" }, { key: "event", label: "Event" }, {
                key: "notes", label: "Notes",
            }, { key: "remain", label: "Remain" }, { key: "lockedBy", label: "Locked by" },];
        this.currentListHeaders = [{ key: "time", label: "T" }, { key: "speed", label: "Speed" }, {
                key: "notify", label: "N",
            }, { key: "vehicle", label: "V" }, { key: "jobNo", label: "Job" }, {
                key: "client", label: "Client",
            }, { key: "from", label: "From" }, { key: "to", label: "To" }, { key: "", label: "" }, {
                key: "remain", label: "Remain",
            }, { key: "status", label: "S" }, { key: "lp", label: "LP" }, { key: "ld", label: "LD" }, {
                key: "runOrder", label: "RO",
            },];
        this.potentialCouriersHeaders = [{ key: "courier", label: "Courier" }, {
                key: "rule", label: "Rule#",
            }, { key: "reason", label: "Reason" },];
    }
    // Layouts
    initLayoutSystem(ContactID) {
        this.layouts = [];
        this.defaultLayout = {
            name: "Default", layout: {
                columns: [{
                        id: "col1",
                        width: "65%",
                        boxes: [{ name: "jobsList", height: "45%" }, { name: "jobDetail", height: "65%" },],
                    }, {
                        id: "col2",
                        width: "17.5%",
                        boxes: [{ name: "currentWork", height: "50%" }, { name: "supports", height: "50%" },],
                    }, {
                        id: "col3",
                        width: "17.5%",
                        boxes: [{ name: "driverLocations", height: "50%" }, { name: "map", height: "50%" },],
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
                const layoutToLoad = lastActiveLayout ? this.layouts.findIndex((l) => l.name === lastActiveLayout) : 0;
                this.loadLayout(layoutToLoad >= 0 ? layoutToLoad : 0);
            }
            catch (error) {
                this.layouts = [this.defaultLayout];
                this.loadLayout(0);
            }
        }
        else {
            this.layouts = [this.defaultLayout];
            this.loadLayout(0);
        }
        // Auto-save changes
        this.$scope.$watch("layout", (newValue, oldValue) => {
            if (newValue !== oldValue && this.currentLayoutName) {
                const index = this.layouts.findIndex((l) => l.name === this.currentLayoutName);
                if (index !== -1) {
                    this.layouts[index].layout = angular.copy(newValue);
                    if (Modernizr.localstorage) {
                        localStorage.setItem(`layouts-${ContactID}`, JSON.stringify(this.layouts));
                    }
                }
            }
        }, true);
    }
    loadLayout(index) {
        const layout = this.layouts[index] || this.layouts[0];
        this.currentLayoutName = layout.name;
        this.layout = angular.copy(layout.layout);
        // Apply dimensions
        this.layout.columns.forEach((column) => {
            const columnEl = angular.element(`#co-${column.id}`);
            if (columnEl.length) {
                columnEl.css("flex-basis", column.width);
                column.boxes.forEach((box) => {
                    const boxEl = angular.element(`#box-${box.name}`);
                    if (boxEl.length) {
                        boxEl.css("flex-basis", box.height);
                    }
                });
            }
        });
        if (Modernizr.localstorage) {
            localStorage.setItem(`lastActiveLayout-${ContactID}`, layout.name);
        }
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
            if (!name)
                return;
            const currentLayout = {
                name: name, layout: {
                    columns: this.layout.columns.map((col) => (Object.assign(Object.assign({}, col), { width: angular.element(`#co-${col.id}`).css("flex-basis"), boxes: col.boxes.map((box) => (Object.assign(Object.assign({}, box), { height: angular
                                .element(`#box-${box.name}`)
                                .css("flex-basis") }))) }))),
                },
            };
            this.layouts.push(currentLayout);
            if (Modernizr.localstorage) {
                localStorage.setItem(`layouts-${ContactID}`, JSON.stringify(this.layouts));
                localStorage.setItem(`lastActiveLayout-${ContactID}`, name);
            }
        });
    }
    deleteLayout(index) {
        if (index === 0)
            return; // Prevent deleting default layout
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
    saveFilterToStorage(filter) {
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
    saveViewsToStorage(views) {
        if (Modernizr.localstorage) {
            localStorage.setItem(`selectedViews-${ContactID}`, JSON.stringify(views));
        }
    }
    loadViewsFromStorage() {
        if (Modernizr.localstorage) {
            try {
                const savedViews = JSON.parse(localStorage.getItem(`selectedViews-${ContactID}`) || "");
                return savedViews || [];
            }
            catch (error) {
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
    loadPageViews() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.views = yield this.DispatchData.getSelectedViews(ContactID, this.AppPages.Dispatch);
                yield this.initializeViews();
                yield this.updateDashboardFilters(this.selectedFilter);
                yield this.fetchDriverLocations();
            }
            catch (error) {
                console.error("Error fetching dispatch views:", error);
                this.views = [];
                yield this.initializeViews();
            }
        });
    }
    initializeViews() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.views && this.views.length > 0) {
                // Load saved views or initialize empty array
                this.selectedViews = this.loadViewsFromStorage();
                // Set selected property on each view
                this.views = this.views.map((view) => (Object.assign(Object.assign({}, view), { selected: this.selectedViews.some((v) => v.id === view.id) })));
                // If no views are selected, select the first one by default
                if (this.selectedViews.length === 0) {
                    this.views[0].selected = true;
                    this.selectedViews.push(this.views[0]);
                    this.saveViewsToStorage(this.selectedViews);
                }
            }
        });
    }
    toggleView(view) {
        return __awaiter(this, void 0, void 0, function* () {
            if (view.selected) {
                if (!this.selectedViews.some((v) => v.id === view.id)) {
                    this.selectedViews.push(view);
                }
            }
            else {
                const index = this.selectedViews.findIndex((v) => v.id === view.id);
                if (index > -1) {
                    this.selectedViews.splice(index, 1);
                }
            }
            // Save filtered views
            this.saveViewsToStorage(this.selectedViews);
            // Update map bounds for new selection
            this.updateMapForSelectedViews();
            // Run both promises in parallel with filtered views
            yield Promise.all([this.fetchDriverLocations(), this.getData()]);
        });
    }
    updateMapForSelectedViews() {
        if (this.initialViewSet)
            return;
        if (!this.selectedViews || this.selectedViews.length === 0)
            return;
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
        }
        else {
            // For multiple views, center on continental US
            this.mapCenter = this.APP_CONFIG.US_Coordinates_Center;
            this.mapZoom = 4; // Zoom level to show most of continental US
        }
        this.initialViewSet = true;
    }
    updateDashboardFilters(selectedFilter) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('updateFilters started with filter:', selectedFilter);
            try {
                // Set all filters to inactive
                console.log('Current filters state:', JSON.stringify(this.filters));
                this.filters.forEach((filter) => {
                    filter.active = false;
                });
                this.queryParams.status = selectedFilter;
                console.log('Updated query params:', this.queryParams);
                console.log('Fetching job list...');
                yield this.getJobList();
                console.log('Job list fetched successfully');
                // Save the selected filter
                this.saveFilterToStorage(selectedFilter);
                // Set the selected filter to active
                const selectedFilterObj = this.filters.find((filter) => filter.value === selectedFilter);
                console.log('Selected filter object:', selectedFilterObj);
                if (selectedFilterObj) {
                    selectedFilterObj.active = true;
                    console.log('Filter activated:', selectedFilterObj.label);
                }
            }
            catch (error) {
                console.error('Error updating filters:', error);
                console.error('Error details:', {
                    message: error.message,
                    stack: error.stack
                });
            }
        });
    }
    setActiveArea(selectedArea) {
        var _a;
        if (!this.driverLocations)
            return;
        (_a = this.driverLocations) === null || _a === void 0 ? void 0 : _a.areas.forEach((area) => {
            area.isActive = area === selectedArea;
        });
    }
    storeMapZoomDisplay() {
        return __awaiter(this, void 0, void 0, function* () {
            if (Modernizr.localstorage) {
                localStorage.setItem("mapZoom-" + ContactID, JSON.stringify({ display: this.autoZoomEnabled }));
            }
            // If map is available, trigger a re-render with current auto zoom setting
            if (this.map && this.autoZoomEnabled) {
                yield this.getAvailableCourierLocation();
            }
        });
    }
    supportChannelChanged() {
        console.log(this.pickService.channel);
    }
    onCourierSearchClick($event) {
        const target = $event.target;
        if ((target === null || target === void 0 ? void 0 : target.tagName) === "INPUT") {
            document.getElementsByName("courierSearch")[0].value = "";
            this.courierSearchText = "";
        }
    }
    attention(job) {
        var _a, _b;
        const components = [];
        // Add DIRECT if applicable
        if (job.direct) {
            components.push("DIRECT");
        }
        // Size label is always included (capitalized) if present
        if ((_a = job.size) === null || _a === void 0 ? void 0 : _a.text) {
            components.push(job.size.text.toUpperCase());
        }
        // Add RTN for return jobs
        if (job.return) {
            components.push("RTN");
        }
        // Add child notes if present
        if (((_b = job.childNotes) === null || _b === void 0 ? void 0 : _b.length) > 0) {
            components.push(job.childNotes);
        }
        // Add pickup location indicator
        const pickupMap = {
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
    openSearch(boxName, index) {
        const boxID = boxName + "-" + index;
        if (this.showInput[boxID]) {
            this.showInput[boxID] = false;
            this.inputWidth[boxID] = 31;
        }
        else {
            this.inputWidth[boxID] = 200;
            this.showInput[boxID] = true;
        }
    }
    unlockJob(currentJob) {
        return this.JobDetailService.unlockJob(currentJob);
    }
    lockJob(currentJob) {
        return this.JobDetailService.lockJob(currentJob);
    }
    selectClearList(selectedClearList) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this._validateClearList(selectedClearList);
                this._updateUIElements();
                if (this._shouldProcessJobs()) {
                    yield this._processClearListJobs(selectedClearList.id);
                }
            }
            catch (error) {
                this._handleClearListError(error);
            }
        });
    }
    _validateClearList(clearList) {
        if (!clearList) {
            throw new Error("Selected clear list is null or undefined");
        }
    }
    _updateUIElements() {
        const areaGroupButtons = angular.element(this.DOM_SELECTORS.areaGroup);
        areaGroupButtons.removeClass("topBarActive");
    }
    _shouldProcessJobs() {
        const activeLocations = angular.element(this.DOM_SELECTORS.driverLocations);
        return activeLocations.length <= 1;
    }
    _processClearListJobs(clearListId) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const envelope = yield this.getClearListEnvelope(clearListId);
            if (!envelope) {
                throw new Error(`Failed to retrieve envelope for clear list ID: ${clearListId}`);
            }
            const selectedClients = this.pickService.clients.map((client) => client.id);
            this.jobListPromise = this.DispatchData.getClearListJobs(this.queryParams, selectedClients, (_a = this.isInternal) !== null && _a !== void 0 ? _a : false, this.selectedViews, envelope);
            const rawJobs = yield this.jobListPromise;
            yield this.fetchAndDisplayCurrentJobs(rawJobs);
        });
    }
    _handleClearListError(error) {
        console.error("Clear list processing error:", error);
        this.jobList = [];
    }
    getClearListEnvelope(clearListId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const data = yield this.DispatchData.getDriverDestinationEnvelope(clearListId);
                if (data) {
                    // Update map bounds with envelope data
                    if (this.map) {
                        const swll = new this.$window.google.maps.LatLng(data.minimumLatitude, data.minimumLongitude);
                        const nell = new this.$window.google.maps.LatLng(data.maximumLatitude, data.maximumLongitude);
                        this.map.fitBounds(new this.$window.google.maps.LatLngBounds(swll, nell));
                        this.map.setZoom(13);
                    }
                    // Update available courier locations if method exists
                    if (this.getAvailableCourierLocation) {
                        yield this.getAvailableCourierLocation();
                    }
                }
                return data;
            }
            catch (error) {
                console.error("Error getting clear list envelope:", error);
                throw error;
            }
        });
    }
    handleDispatchSelection(selectedCourier, job) {
        return __awaiter(this, void 0, void 0, function* () {
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
                yield this.dispatchJobs(selectedCourier.id);
                this.dispatchState.selectedJobs.clear();
            }
            catch (error) {
                console.error("Error in dispatch:", error);
                this.dispatchState.selectedJobs.delete(job.id);
            }
        });
    }
    handleDispatchFieldClick(event, job) {
        // Prevent the job row click event
        event.stopPropagation();
        // Clear the courierSearchText
        this.courierSearchText = "";
        // Select the job
        this.selectForDispatch(job);
    }
    handleDispatchKeydown(event) {
        return __awaiter(this, void 0, void 0, function* () {
            if (event.key === 'Enter') {
                const target = event.target;
                const courierId = parseInt(target.value, 10);
                yield this.dispatchJobs(courierId);
            }
        });
    }
    selectForDispatch(job) {
        const jobId = job.id;
        if (this.dispatchState.selectedJobs.has(jobId)) {
            this.dispatchState.selectedJobs.delete(jobId);
            angular.element(`tr[data-jobid="${jobId}"]`).removeClass("active");
        }
        else {
            this.dispatchState.selectedJobs.add(jobId);
            angular.element(`tr[data-jobid="${jobId}"]`).addClass("active");
        }
    }
    swapPOD($event) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const jobNumber = yield this.promptForJobNumber($event);
                const secondJobId = yield this.validateSwapPOD(jobNumber);
                if (!secondJobId) {
                    yield this.showInvalidJobAlert();
                    return;
                }
                if (!this.currentJob)
                    return;
                const firstJobId = this.currentJob.id;
                yield this.confirmSwapPOD($event, this.currentJob.jobNo, jobNumber);
                yield this.performSwapPOD(this.currentJob.jobNo, jobNumber);
                yield this.showSuccessAlert();
                yield this.updateJobsAfterSwap(secondJobId, firstJobId);
            }
            catch (error) {
                console.error("POD Swap Canceled or Error occurred", error);
            }
        });
    }
    promptForJobNumber($event) {
        return __awaiter(this, void 0, void 0, function* () {
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
        });
    }
    validateSwapPOD(jobNumber) {
        return this.uCSData.validateSwapPOD(jobNumber);
    }
    showInvalidJobAlert() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$mdDialog.show(this.$mdDialog
                .alert()
                .clickOutsideToClose(true)
                .title("Invalid Job")
                .textContent("This job is invalid.")
                .ok("OK"));
        });
    }
    confirmSwapPOD(event, currentJobNo, jobNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$mdDialog.show(this.$mdDialog
                .confirm()
                .title("Swap Delivery Info?")
                .textContent(`Are you sure you wish to swap delivery info between ${currentJobNo} and ${jobNumber}?`)
                .targetEvent(event)
                .ok("Yes")
                .cancel("No"));
        });
    }
    performSwapPOD(currentJobNo, jobNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.uCSData.swapPOD(currentJobNo, jobNumber);
            this.toastrService.showSuccessToast("POD swapped successfully");
        });
    }
    showSuccessAlert() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$mdDialog.show(this.$mdDialog
                .alert()
                .clickOutsideToClose(true)
                .title("Successful")
                .textContent("POD Swap Completed Successfully")
                .ok("OK"));
        });
    }
    updateJobsAfterSwap(secondJobId, firstJobId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.uCSData.reSendJobs(secondJobId);
            yield this.uCSData.reAssignJobs(firstJobId);
            yield this.uCSData.reSendJobs(firstJobId);
            yield this.refreshData(true);
        });
    }
    voidJobForm(jobNumber, jobId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const note = yield this.$mdDialog
                    .show(this.$mdDialog
                    .prompt()
                    .title("Void Job")
                    .textContent("Add Note")
                    .placeholder("Note")
                    .ariaLabel("Void job")
                    .required(true)
                    .ok("Void")
                    .cancel("Cancel"));
                yield this.DispatchData.addNote(jobId, note, FirstName, false);
                yield this.DispatchData.voidJob(jobId);
                this.toastrService.showSuccessToast("Job voided successfully");
                return yield this.getData();
            }
            catch (error) {
                console.error("Job void canceled or error occurred", error);
            }
        });
    }
    messageClick($event, job) {
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
    otherEventForm($event, job) {
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
    getSupportColorClass(support) {
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
    selectAllContent($event) {
        var _a;
        (_a = $event.target) === null || _a === void 0 ? void 0 : _a.select();
    }
    lateOperation(minsAway, job, obj, isPickup) {
        const operationType = isPickup ? "pickup" : "delivery";
        const currentValue = isPickup ? job.lp : job.ld;
        const lateType = isPickup ? 1 : 2;
        console.log(`Current ${operationType} = ${currentValue}`);
        console.log(`Param minsAway = ${minsAway}`);
        console.log(obj);
        return this.lateCall(minsAway.getTime(), lateType, job, true)
            .then(() => {
            console.log(`Late ${operationType} call completed successfully`);
        })
            .catch((error) => {
            console.error(`Error in late ${operationType} call:`, error);
        });
    }
    latePickup(minsAway, job, obj) {
        return this.lateOperation(minsAway, job, obj, true);
    }
    lateDelivery(minsAway, job, obj) {
        return this.lateOperation(minsAway, job, obj, false);
    }
    lateCall(lateTime, lateType, job, calc) {
        var _a, _b, _c, _d, _e, _f;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!job.clientId)
                    return;
                if (!job.jobType)
                    return;
                const response = yield this.DispatchData.lateCall(lateType, lateTime, (_a = job.minutes) !== null && _a !== void 0 ? _a : 0, (_b = job.pickupTime) !== null && _b !== void 0 ? _b : 0, (_c = job.alertLatePickup) !== null && _c !== void 0 ? _c : 0, (_d = job.deliveryTime) !== null && _d !== void 0 ? _d : 0, (_e = job.alertLateDelivery) !== null && _e !== void 0 ? _e : 0, job.jobNo, job.clientId, job.contactName, ContactID, (_f = job.time) !== null && _f !== void 0 ? _f : new Date(), job.id, job.jobType, job.speed, job.notify || job.speed, FirstName, calc);
                yield this.getData();
                this.toastrService.showSuccessToast("Late call applied successfully");
                return response;
            }
            catch (error) {
                console.error("Error applying late call:", error);
            }
        });
    }
    jobClass(job) {
        if (!job)
            return "";
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
    handleRowClick($event, job) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (!((_a = $event.target) === null || _a === void 0 ? void 0 : _a.closest("md-autocomplete"))) {
                try {
                    yield this.$timeout(() => __awaiter(this, void 0, void 0, function* () {
                        yield this.selectJob(job);
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
                    }));
                }
                catch (error) {
                    console.error("Error in handleRowClick:", error);
                }
            }
        });
    }
    dispatchJobs(courierId) {
        return __awaiter(this, void 0, void 0, function* () {
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
                const courier = yield this.DispatchData.getCourierById(courierId);
                if (!courier) {
                    console.error("Invalid courierId");
                }
                // Perform dispatch operation
                yield this.dispatchJobService.dispatchJobsByCourierId(courierId, jobsToDispatch);
                // Clear selection state
                this.dispatchState.selectedJobs.clear();
                // If we have a current courier, update their job list
                if (this.currentCourier) {
                    yield this.getCurrentJobs(this.currentCourier.courierId);
                }
                // Inform the user
                this.toastrService.showSuccessToast(jobsToDispatch.length + " job(s) dispatched to " + courier.name);
                // Update courier locations
                yield this.getAvailableCourierLocation();
                yield this.getJobList();
            }
            catch (error) {
                console.error("Error dispatching jobs:", error);
                throw error;
            }
            finally {
                this.dispatchState.processing = false;
            }
        });
    }
    _getJobsToDispatch() {
        return this.jobList.filter((job) => this.dispatchState.selectedJobs.has(job.id));
    }
    reAllocateJobs(job) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            if (!job)
                return;
            const callData = {
                call: "redespatchJobs",
                jobs: [],
                splitJobs: [],
                jobNos: [],
                courierId: null,
            };
            callData.jobs.push(job.id);
            if (!((_a = job.courierData) === null || _a === void 0 ? void 0 : _a.courierId))
                return;
            const foundCourier = yield this.DispatchData.getCourierById((_b = job.courierData) === null || _b === void 0 ? void 0 : _b.courierId);
            if (callData.jobs.length > 0) {
                yield this.DispatchData.reAllocateJobs(foundCourier.courierId, ContactID, callData.jobs);
                this.toastrService.showSuccessToast("Jobs reallocated successfully");
            }
            yield this.getData();
            this.courier = { gpsCourier: foundCourier.id };
            yield this.searchCourier();
        });
    }
    resendJobs() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const activeJobElements = angular.element("#jobList .active");
            const jobIds = Array.from(activeJobElements).map(element => parseInt(angular.element(element).attr("data-jobid") || "0", 10));
            if (jobIds.length === 0) {
                return;
            }
            try {
                yield this.DispatchData.resendJobs(jobIds.filter(id => id !== 0));
                this.toastrService.showSuccessToast("Jobs resent successfully");
                yield this.getData();
                const lastJobElement = activeJobElements[activeJobElements.length - 1];
                const lastJobId = parseInt(angular.element(lastJobElement).attr("data-jobid") || "0", 10);
                const lastJob = this.jobList.find((job) => job.id === lastJobId);
                if (!lastJob)
                    return;
                const foundCourier = this.pickCouriers.find((c) => c.courierId === lastJob.courierData.courierId);
                (_a = this.pickAllCouriers) === null || _a === void 0 ? void 0 : _a.find((c) => c.courierId === this.lastjob.courierData.courierId);
                if (foundCourier) {
                    this.courier = { gpsCourier: foundCourier.id };
                    yield this.searchCourier();
                }
            }
            catch (error) {
                console.log("Error updating data:", error);
            }
        });
    }
    restoreJob(job) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.dispatchJobService.restoreJob(job);
                this.courier = { gpsCourier: result.gpsCourier };
                yield this.getData();
                if (this.searchCourier) {
                    yield this.searchCourier();
                }
            }
            catch (error) {
                console.error("Error restoring job:", error);
            }
        });
    }
    restoreAll($event) {
        return __awaiter(this, void 0, void 0, function* () {
            let confirm = this.$mdDialog
                .confirm()
                .title("Restore All Jobs")
                .textContent("Are you sure you wish to restore all jobs for " + this.currentCourier.courier)
                .targetEvent($event)
                .ok("Yes")
                .cancel("No");
            try {
                yield this.$mdDialog.show(confirm);
                let callData = {
                    call: "restoreJobs",
                    jobs: [],
                    splitJobs: [],
                    jobNos: [],
                    courierId: null,
                };
                let foundCourier = null;
                if (!this.jobsCurrentList)
                    return;
                this.jobsCurrentList.forEach(job => {
                    var _a, _b;
                    this.DispatchData.addRestoreEvent(job.id);
                    if (callData.courierId === null) {
                        callData.courierId = (_a = job.courierData.courierId) !== null && _a !== void 0 ? _a : null;
                        foundCourier = this.pickCouriers.find((c) => {
                            return c.courierId === job.courierData.courierId;
                        }) || ((_b = this.pickAllCouriers) === null || _b === void 0 ? void 0 : _b.find((c) => c.courierId === job.courierData.courierId));
                    }
                    if (job.displaySplitJobDetail) {
                        callData.splitJobs.push(job.id);
                    }
                    else {
                        callData.jobs.push(job.id);
                    }
                });
                if (callData.splitJobs.length > 0 && foundCourier) {
                    yield this.DispatchData.restoreSplitJobs(callData.jobs);
                    console.log("Restore split jobs complete");
                }
                if (callData.jobs.length > 0 && foundCourier) {
                    yield this.DispatchData.restoreJobs(callData.jobs);
                    console.log("Restore Jobs complete");
                }
                this.$timeout(() => {
                    if (foundCourier) {
                        this.getCurrentJobs(foundCourier.courierId);
                        this.getData();
                    }
                }, 1000);
            }
            catch (error) {
                if (error === undefined) {
                    console.log("User canceled dialog");
                }
                else {
                    console.error("Error occured restoring jobs");
                }
            }
        });
    }
    redispatchAll($event) {
        return __awaiter(this, void 0, void 0, function* () {
            const confirm = this.$mdDialog
                .confirm()
                .title("Restore All Jobs")
                .textContent("Are you sure you wish to redispatch all jobs for " + this.currentCourier.courier)
                .targetEvent($event)
                .ok("Yes")
                .cancel("No");
            try {
                yield this.$mdDialog.show(confirm);
                let callData = {
                    call: "redespatchJobs",
                    jobs: [],
                    splitJobs: [],
                    jobNos: [],
                    courierId: this.currentCourier.courierId,
                };
                let foundCourier = null;
                if (!this.jobsCurrentList)
                    return;
                for (const job of this.jobsCurrentList) {
                    callData.jobs.push(job.id);
                    foundCourier = yield this.DispatchData.getCourierById(callData.courierId);
                }
                if (callData.jobs.length > 0) {
                    yield this.DispatchData.reAllocateJobs(callData.courierId, ContactID, callData.jobs);
                }
                yield this.getData();
                this.courier = { gpsCourier: foundCourier === null || foundCourier === void 0 ? void 0 : foundCourier.id };
                yield this.searchCourier();
            }
            catch (_a) {
                // Cancelled dialog.
            }
        });
    }
    resendAll($event) {
        return __awaiter(this, void 0, void 0, function* () {
            const confirmDialog = this._createResendConfirmDialog($event);
            try {
                yield this.$mdDialog.show(confirmDialog);
                const resendRequest = {
                    call: "resendJobs",
                    jobs: [],
                    splitJobs: [],
                    jobNos: [],
                    courierId: this.currentCourier.courierId,
                };
                this._collectJobIds(resendRequest);
                const foundCourier = yield this.DispatchData.getCourierById(resendRequest.courierId);
                if (resendRequest.jobs.length > 0) {
                    yield this.DispatchData.resendAllJobs(resendRequest.courierId);
                }
                yield this.getData();
                this.courier = { gpsCourier: foundCourier === null || foundCourier === void 0 ? void 0 : foundCourier.id };
                yield this.searchCourier();
            }
            catch (_a) {
                // User cancelled the operation
            }
        });
    }
    _createResendConfirmDialog($event) {
        return this.$mdDialog
            .confirm()
            .title("Resend All Jobs")
            .textContent(`Are you sure you wish to resend all jobs for ${this.currentCourier.courier}`)
            .targetEvent($event)
            .ok("Yes")
            .cancel("No");
    }
    _collectJobIds(request) {
        var _a;
        (_a = this.jobsCurrentList) === null || _a === void 0 ? void 0 : _a.forEach((job) => {
            request.jobs.push(job.id);
        });
    }
    restoreJobsFromCurrentWindow() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const callData = {
                call: "restoreJobs",
                jobs: [],
                splitJobs: [],
                jobNos: [],
                courierId: 0,
            };
            try {
                const activeJobs = (_a = this.jobsCurrentList) === null || _a === void 0 ? void 0 : _a.filter(job => job.isActive);
                if (!activeJobs)
                    return;
                for (let job of activeJobs) {
                    yield this.addRestoreEvent(job);
                    this.updateCallData(callData, job, null);
                }
                const foundCourier = callData.courierId ? yield this.DispatchData.getCourierById(callData.courierId) : null;
                if (!foundCourier) {
                    yield this.restoreJobs(callData);
                }
                yield this.getData();
                this.courier = { gpsCourier: foundCourier === null || foundCourier === void 0 ? void 0 : foundCourier.id };
                yield this.searchCourier();
            }
            catch (error) {
                console.log("Error in restoreJobsFromCurrentWindow:", error);
            }
        });
    }
    addRestoreEvent(job) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.DispatchData.addRestoreEvent(job.id);
                console.log("Restore event added successfully");
            }
            catch (error) {
                console.log("Error adding restore event:", error);
                throw error;
            }
        });
    }
    restoreJobs(callData) {
        return __awaiter(this, void 0, void 0, function* () {
            const promises = [];
            if (callData.splitJobs.length > 0) {
                promises.push(this.DispatchData.restoreSplitJobs(callData.splitJobs));
            }
            if (callData.jobs.length > 0) {
                promises.push(this.DispatchData.restoreJobs(callData.jobs));
            }
            try {
                yield Promise.all(promises);
                this.toastrService.showSuccessToast("Jobs restored successfully");
            }
            catch (error) {
                console.log("Error restoring jobs:", error);
                throw error;
            }
        });
    }
    setFirstJob(job) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.$mdDialog.show(this.$mdDialog
                    .confirm()
                    .title("Set First Job?")
                    .textContent("Are you sure you wish to set this as the First Job?")
                    .ok("Yes")
                    .cancel("No"));
                yield this.DispatchData.setFirstJob(job.id, this.currentCourier.courierId);
                yield this.getCurrentJobs(this.currentCourier.courierId);
                this.toastrService.showSuccessToast("Job set as first job successfully");
            }
            catch (error) {
                console.log("Action cancelled or error occurred:", error);
            }
        });
    }
    //////////////////////////////
    //  SPLIT JOB //
    /////////////////////////////
    splitJob($event, job) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!job.allowSplit) {
                yield this.showAlert("Unable to split job", `Can not split ${job.jobNo}.`);
                return;
            }
            try {
                const result = yield this.showConfirm($event, "Split Job?", "Are you sure you wish to split this job?");
                if (result) {
                    yield this.DispatchData.splitJob(job.id, FirstName);
                    yield this.setSplitJobMeetingPoint($event, job);
                }
            }
            catch (error) {
                if (error instanceof Error) {
                    console.log(error.message);
                }
                console.log("Splitting job failed:", error);
            }
        });
    }
    showAlert(title, content) {
        return this.$mdDialog.show(this.$mdDialog
            .alert()
            .parent(document.body)
            .clickOutsideToClose(true)
            .title(title)
            .textContent(content)
            .ariaLabel("Alert")
            .ok("OK"));
    }
    showConfirm($event, title, content) {
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
    activateDrop() {
        return __awaiter(this, void 0, void 0, function* () {
            const self = this;
            yield this.$timeout(0);
            yield new Promise((resolve) => {
                this.$document.ready(resolve);
            });
            angular.element(".droppable-row").droppable({
                classes: { "ui-droppable-hover": "active" }, drop: function (event, ui) {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield self.handleDroppedJob(self);
                    });
                },
            });
        });
    }
    handleDroppedJob($element) {
        return __awaiter(this, void 0, void 0, function* () {
            const parentOffset = $element.parents(".box").offset();
            const rowOffset = $element.offset();
            if (this.isWithinDropZone(parentOffset, rowOffset, $element)) {
                yield this.animateDroppedJob($element);
                yield this.dispatchDroppedJob($element);
            }
        });
    }
    isWithinDropZone(parentOffset, rowOffset, $element) {
        const parentTop = parentOffset.top;
        const parentBottom = parentTop + $element.parents(".box").outerHeight();
        const rowTop = rowOffset.top;
        const rowBottom = rowTop + $element.outerHeight();
        return rowTop < parentBottom && rowBottom > parentTop;
    }
    animateDroppedJob($element) {
        return __awaiter(this, void 0, void 0, function* () {
            $element.css({ "background-color": "#c6dfad" });
            yield new Promise((resolve) => {
                $element.animate({ backgroundColor: "inherit" }, 300, () => {
                    $element.removeAttr("style");
                    resolve();
                });
            });
        });
    }
    dispatchDroppedJob($element) {
        return __awaiter(this, void 0, void 0, function* () {
            const courierId = $element.attr("data-courier").replace(/[^\d.-]/g, "");
            try {
                yield this.dispatchJobs(courierId);
                console.log("Dispatch complete");
                yield this.fetchDriverLocations();
            }
            catch (error) {
                console.error("Error in drop handler:", error);
            }
        });
    }
    getPotentialCouriers(jobId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.potentialCouriers = yield this.DispatchData.getPotentialCouriers(jobId);
                yield this.activateDrop();
            }
            catch (error) {
                console.error("Error getting potential couriers:", error);
            }
        });
    }
    courierSearch(searchText) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = "/courier/AllActiveSearch";
            try {
                return yield this.DispatchData.autocompleteSearch(searchText, url);
            }
            catch (error) {
                console.error(error.message);
                throw error;
            }
        });
    }
    jobRecordSearch(searchText) {
        return this.jobList
            .filter((job) => job.jobNo.toLowerCase().includes(searchText.toLowerCase()))
            .map((job) => ({ id: job.id, text: job.jobNo }));
    }
    JobRecordSelected(selectedJobId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const selectedJob = this.jobList.find((job) => job.id === selectedJobId);
                if (!selectedJob)
                    return;
                yield this.selectJob(selectedJob);
                console.log("Job selection complete");
            }
            catch (error) {
                console.error("Error in JobRecordSelected:", error);
            }
        });
    }
    updateCourierData(courierId, courierName) {
        return __awaiter(this, void 0, void 0, function* () {
            this.currentWorkSelection = ` for Courier ${courierName}`;
            this.currentCourier = { courierId: courierId, courier: courierName };
            yield this.getCurrentJobs(courierId);
            try {
                this.truckCourierStatus = yield this.DispatchData.truckCourierStatus(courierId);
            }
            catch (error) {
                console.error("Error fetching truck courier status:", error);
            }
        });
    }
    selectedCourierChange(courier) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._isValidCourier(courier)) {
                this.currentCourier = null;
                return;
            }
            const { courierId, courierName } = courier;
            yield this.updateCourierData(courierId, courierName);
        });
    }
    _isValidCourier(courier) {
        return courier != null
            && typeof courier.courierId === 'number'
            && courier.courierName.length > 0;
    }
    searchCourier() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const foundCourier = yield this.DispatchData.getCourierById(this.courier.gpsCourier);
                if (!foundCourier) {
                    yield this.showAlert("Attention", "Courier not found.");
                    return;
                }
                yield this.updateCourierData(foundCourier.courierId, foundCourier.name);
            }
            catch (error) {
                console.error("Error searching courier:", error);
            }
        });
    }
    selectCourier(courier) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Set loading states
                yield this.$timeout(() => {
                    this.currentListLoading = true;
                });
                if (!courier || courier.courierId === undefined)
                    return;
                const foundCourier = yield this.DispatchData.getCourierById(courier.courierId);
                if (foundCourier) {
                    // Update current courier information
                    this.currentCourier = {
                        courierId: foundCourier.courierId,
                        courier: foundCourier.label || `${foundCourier.label} ${foundCourier.name}`,
                    };
                    // Update current work selection text
                    this.currentWorkSelection = ` for Courier ${this.currentCourier.courier}`;
                    // Get current jobs for the courier
                    yield this.getCurrentJobs(foundCourier.courierId);
                    // Update truck courier status if available
                    try {
                        this.truckCourierStatus = yield this.DispatchData.truckCourierStatus(foundCourier.courierId);
                    }
                    catch (error) {
                        console.warn("Error fetching truck courier status:", error);
                    }
                }
                else {
                    console.warn("Courier not found in active or all couriers list");
                    this.toastrService.showErrorToast("An unexpected occur occured. Please contact support.");
                }
            }
            catch (error) {
                console.error("Error selecting courier:", error);
                this.toastrService.showErrorToast("Error loading courier information");
            }
            finally {
                // Reset loading states
                yield this.$timeout(() => {
                    this.currentListLoading = false;
                });
            }
        });
    }
    refreshTruckCourierStatus() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.truckCourierStatus = yield this.DispatchData.truckCourierStatus(this.currentCourier.courierId);
            }
            catch (error) {
                console.error("Error refreshing truck courier status:", error);
            }
        });
    }
    selectMapCourier(courier) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const foundCourier = yield this.DispatchData.getCourierById(courier.courierId);
                this.currentCourier = {
                    courierId: foundCourier === null || foundCourier === void 0 ? void 0 : foundCourier.courierId, courier: foundCourier === null || foundCourier === void 0 ? void 0 : foundCourier.label,
                };
                yield this.getCurrentJobs(courier.courierId);
                yield this.updateUIAfterCourierSelection(courier);
            }
            catch (error) {
                console.error("An error occurred:", error);
            }
        });
    }
    clearCourierSearch() {
        this.jobsCurrentList = [];
        this.courier.gpsCourier = "";
        this.currentWorkSelection = "";
    }
    selectPotentialCourier(courier) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.updateCourierInfo(courier);
                yield this.displayJobsForCourier(courier);
                yield this.updateUIForPotentialCourier(courier);
            }
            catch (error) {
                console.error("Error in selectPotentialCourier:", error);
            }
        });
    }
    updateCourierInfo(courier) {
        if (courier.courier === undefined) {
            courier.courier = `${courier.courier} ${courier.courierName}`;
        }
    }
    displayJobsForCourier(courier) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const foundCourier = this.pickCouriers.find((x) => x.courierId === courier.courierId);
            const code = (_a = foundCourier === null || foundCourier === void 0 ? void 0 : foundCourier.id) !== null && _a !== void 0 ? _a : '';
            if (courier.courierId === undefined) {
                throw new Error('Courier ID is required');
            }
            const data = yield this.DispatchData.getJobsCurrent(courier.courierId, this.jobFilters.status === "done");
            if (this.currentJob !== null && ((_b = this.currentJob) === null || _b === void 0 ? void 0 : _b.courier) !== code) {
                this.currentJob = undefined;
            }
            this.jobsCurrentList = data;
            yield this.activateDrop();
        });
    }
    _isValidCoordinates(lat, lng) {
        return (lat && lng && !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0 && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180);
    }
    updateUIForPotentialCourier(courier) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.getAvailableCourierLocation();
            this.currentWorkSelection = ` for Courier ${courier.courier}`;
            this.currentCourier = courier;
        });
    }
    getCurrentJobs(courierId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!courierId) {
                console.warn("No courier ID provided");
                return;
            }
            try {
                this.currentListLoading = true;
                // Load jobs for the courier
                this.jobsCurrentList = yield this.DispatchData.getJobsCurrent(courierId, this.jobFilters && this.jobFilters.status === "done");
                // Set up droppable functionality for job rows
                yield this.activateDrop();
            }
            catch (error) {
                console.error("Error getting current jobs:", error);
                this.jobsCurrentList = [];
            }
            finally {
                this.currentListLoading = false;
            }
        });
    }
    selectJobDetail(job) {
        return __awaiter(this, void 0, void 0, function* () {
            this.currentJob = job;
            this.currentSupport = null;
            this.potentialCouriers = false;
            this.potentialCouriersSelection = ` for Job ${job.jobNo}`;
            this.currentSelection = ` for Job ${job.jobNo}`;
            yield this.checkForAttachments(job.id);
            if (job.rootParentId && job.clientId) {
                try {
                    job.relatedJobs = yield this.DispatchData.getRelatedJobs(job.rootParentId, job.clientId);
                }
                catch (error) {
                    console.error("Error getting related jobs:", error);
                }
            }
        });
    }
    selectSupportJobDetail(support) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`select Job ${support.jobId}`);
            // Set the current support before any other operations
            this.currentSupport = support;
            try {
                if (!support.jobId)
                    return;
                const jobData = yield this.DispatchData.getJobDetail(support.jobId);
                yield this.selectJob(jobData);
                this.currentSelection = ` for Job ${support.jobNumber}`;
                if (this.currentJob && this.currentJob.rootParentId) {
                    try {
                        if (!this.currentJob.clientId)
                            return;
                        this.currentJob.relatedJobs = yield this.DispatchData.getRelatedJobs(this.currentJob.rootParentId, this.currentJob.clientId);
                    }
                    catch (error) {
                        console.error("Error getting related jobs:", error);
                    }
                }
            }
            catch (error) {
                console.error("Error selecting support job detail:", error);
                this.toastrService.showErrorToast("Error loading job details");
            }
        });
    }
    selectJob(job) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("Selected job run...");
            console.log(job);
            if (!job)
                return;
            yield this.$timeout(() => __awaiter(this, void 0, void 0, function* () {
                var _a, _b, _c, _d, _e, _f;
                this.selectedJobs = [];
                this.currentSupport = null;
                // Create a new reference to trigger change detection
                this.currentJob = angular.copy(job);
                // Add watcher for currentJob changes
                const unwatchJob = this.$scope.$watch('currentJob', (newValue, oldValue) => {
                    try {
                        if (!newValue || !oldValue)
                            return;
                        if (!angular.equals(newValue, oldValue)) {
                            const jobIndex = this.jobList.findIndex(j => j.id === newValue.id);
                            if (jobIndex !== -1) {
                                if (this._isValidJob(newValue)) {
                                    this.jobList[jobIndex] = angular.copy(newValue);
                                }
                                else {
                                    console.warn('Invalid job structure detected');
                                }
                            }
                        }
                    }
                    catch (error) {
                        console.error('Error in currentJob watcher:', error);
                    }
                }, true);
                // Clean up watcher when job changes
                this.$scope.$on('$destroy', unwatchJob);
                yield this.JobDetailService.setJob(this.currentJob);
                yield this.checkForAttachments(job.id);
                try {
                    this.pickCouriers = yield this.DispatchData.getActiveCouriers();
                }
                catch (error) {
                    console.error("Error getting active couriers:", error);
                }
                if (job.rootParentId) {
                    try {
                        if (((_a = this.currentJob) === null || _a === void 0 ? void 0 : _a.rootParentId) && ((_b = this.currentJob) === null || _b === void 0 ? void 0 : _b.clientId)) {
                            this.currentJob.relatedJobs = yield this.DispatchData.getRelatedJobs(this.currentJob.rootParentId, this.currentJob.clientId);
                        }
                    }
                    catch (error) {
                        console.error("Error getting related jobs:", error);
                    }
                }
                // Set the currentSelection to job-specific information
                this.currentSelection = ` for Job ${job.jobNo}`;
                try {
                    if (!job.courier && !job.assignedCourier) {
                        yield this.handleUndispatchedJob(job);
                    }
                    else {
                        // Job is dispatched
                        this.potentialCouriers = false;
                        if (job.courierData) {
                            yield this.selectCourier(job.courierData);
                            // Display route points for the single job
                            if (((_c = job.pickupAddress) === null || _c === void 0 ? void 0 : _c.latitude) != null && ((_d = job.pickupAddress) === null || _d === void 0 ? void 0 : _d.longitude) != null &&
                                ((_e = job.deliveryAddress) === null || _e === void 0 ? void 0 : _e.latitude) != null && ((_f = job.deliveryAddress) === null || _f === void 0 ? void 0 : _f.longitude) != null &&
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
                            }
                            else {
                                console.warn("Invalid coordinates for job:", job);
                            }
                        }
                        else {
                            console.warn("Missing courier data for job:", job);
                        }
                    }
                    // Always update available courier locations after handling the job
                    yield this.getAvailableCourierLocation();
                }
                catch (error) {
                    console.error("An error occurred finding couriers:", error);
                }
                // Only focus the dispatch field for the selected job, not all jobs
                this.focusDispatchField(job.id);
            }), 0);
        });
    }
    _isValidJob(job) {
        return (job !== null &&
            typeof job === 'object' &&
            'id' in job &&
            typeof job.id !== 'undefined');
    }
    handleUndispatchedJob(job) {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function* () {
            this.jobGroups = false;
            yield this.getPotentialCouriers(job.id);
            this.potentialCouriersSelection = ` for Job ${job.jobNo}`;
            this.currentCourier = null;
            this.currentSelection = ` for Job ${job.jobNo}`;
            // Verify we have valid coordinates before displaying
            if (this.autoZoomEnabled && this.map) {
                if (((_a = job.pickupAddress) === null || _a === void 0 ? void 0 : _a.latitude) != null && ((_b = job.pickupAddress) === null || _b === void 0 ? void 0 : _b.longitude) != null && this._isValidCoordinates(job.pickupAddress.latitude, job.pickupAddress.longitude)) {
                    // Set bounds for pickup point
                    const bounds = new this.$window.google.maps.LatLngBounds();
                    bounds.extend(new this.$window.google.maps.LatLng(job.pickupAddress.latitude, job.pickupAddress.longitude));
                    // If delivery coordinates are valid, include them too
                    if (((_c = job.deliveryAddress) === null || _c === void 0 ? void 0 : _c.latitude) != null && ((_d = job.deliveryAddress) === null || _d === void 0 ? void 0 : _d.longitude) != null && this._isValidCoordinates(job.deliveryAddress.latitude, job.deliveryAddress.longitude)) {
                        bounds.extend(new this.$window.google.maps.LatLng(job.deliveryAddress.latitude, job.deliveryAddress.longitude));
                    }
                }
                else {
                    console.warn("Invalid pickup coordinates for job:", job);
                }
            }
        });
    }
    focusDispatchField(jobId) {
        this.$timeout(() => {
            const inputField = angular.element(`#input_${jobId}`);
            if (inputField.length) {
                const inputElement = inputField.find('input');
                if (inputElement.length) {
                    const htmlInputElement = inputElement[0];
                    htmlInputElement.focus();
                    const job = this.jobList.find(j => j.id === jobId);
                    if (job && !job.courier && !job.assignedCourier) {
                        htmlInputElement.select();
                    }
                }
            }
        }, 100);
    }
    showJobContextMenu($event, job) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.selectJob(job);
                const contextMenuElement = angular.element('context-menu');
                const contextMenuCtrl = contextMenuElement.controller('contextMenu');
                if (contextMenuCtrl) {
                    contextMenuCtrl.showJobContextMenu($event, job);
                }
                else {
                    console.error('Context menu controller not found');
                }
            }
            catch (error) {
                console.error('Error selecting job:', error);
            }
        });
    }
    createMenuItem(text, action) {
        return __awaiter(this, void 0, void 0, function* () {
            return {
                text, click: ($itemScope, $event) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        yield action($itemScope, $event);
                        console.log(`${text} completed successfully`);
                    }
                    catch (error) {
                        console.log(`Error in ${text}:`, error);
                    }
                })
            };
        });
    }
    setTruckMode(mode) {
        return __awaiter(this, void 0, void 0, function* () {
            this.truckMode = mode;
            yield this.getData();
        });
    }
    setSupportChannel(channel) {
        return __awaiter(this, void 0, void 0, function* () {
            this.supportChannel = channel;
            if (Modernizr.localstorage) {
                localStorage.setItem("support-channel-" + ContactID, JSON.stringify(this.supportChannel));
            }
            yield this.getSupports();
        });
    }
    getAvailableCourierLocation() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.allCouriers.display) {
                this.courierPositions = [];
                return;
            }
            try {
                // Get the map instance first
                const map = yield this.NgMap.getMap();
                const bounds = map.getBounds();
                // If we don't have bounds yet (map not fully initialized), try to get a reasonable default area
                if (!bounds) {
                    // Use default bounds or the current map center with a reasonable radius
                    const center = this.mapCenter || { lat: -36.8485, lng: 174.7633 }; // Default to Auckland, NZ
                    // Get courier positions without specific bounds
                    const returnData = yield this.DispatchData.getAvailableCourierLocation(center.lng - 0.5, // Approximate 50km radius bounds
                    center.lat - 0.5, center.lng + 0.5, center.lat + 0.5);
                    this.courierPositions = returnData.map((courier) => ({
                        latitude: courier.latitude,
                        longitude: courier.longitude,
                        code: courier.code,
                        totalJobs: courier.totalJobs
                    }));
                    return;
                }
                // If we have bounds, use them to get courier positions
                const sw = bounds.getSouthWest();
                const ne = bounds.getNorthEast();
                const returnData = yield this.DispatchData.getAvailableCourierLocation(sw.lng(), sw.lat(), ne.lng(), ne.lat());
                // Update courier positions with enhanced data
                this.courierPositions = returnData.map((courier) => ({
                    latitude: courier.latitude,
                    longitude: courier.longitude,
                    code: courier.code,
                    totalJobs: courier.totalJobs
                }));
                // Emit an event to refresh the map
                this.$scope.$broadcast('refreshCourierMarkers', this.courierPositions);
            }
            catch (error) {
                console.error("Error getting available courier locations:", error);
                this.courierPositions = [];
            }
        });
    }
    handleMarkerClick(job) {
        return __awaiter(this, void 0, void 0, function* () {
            if (job) {
                yield this.selectJob(job);
            }
        });
    }
    initializeJobSearchFields(jobs) {
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
    getJobList() {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (Modernizr.localstorage) {
                    localStorage.setItem("disp-filters-" + ContactID, JSON.stringify(this.queryParams));
                }
                const selectedClients = this.pickService.clients.map((a) => a.id);
                let orderBy = this.queryParams.order;
                let orderDirection = "asc";
                if (orderBy.startsWith("-")) {
                    orderBy = orderBy.substring(1);
                    orderDirection = "desc";
                }
                const params = {
                    status: this.queryParams.status,
                    order: orderBy,
                    orderDirection: orderDirection,
                    statusFilter: this.queryParams.statusFilter
                };
                console.log('Params:', params);
                this.jobListPromise = this.dispatchJobService.getJobListWithCourierData(params, selectedClients, (_a = this.isInternal) !== null && _a !== void 0 ? _a : false, this.selectedViews);
                const result = yield this.jobListPromise;
                if (((_b = result.items) === null || _b === void 0 ? void 0 : _b.length) > 0) {
                    this.jobList = this.initializeJobSearchFields(result.items);
                }
                else {
                    this.jobList = [];
                }
                yield this.getAvailableCourierLocation();
            }
            catch (error) {
                console.error("Error getting job list:", error);
                this.toastrService.showErrorToast("Failed to get job list. Please try again.");
                this.jobList = [];
            }
        });
    }
    jobPageChanged(page, limit) {
        return __awaiter(this, void 0, void 0, function* () {
            this.queryParams.page = page;
            this.queryParams.limit = limit;
            yield this.getJobList();
        });
    }
    closeSupport(support) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!support.eventId) {
                throw new Error('Cannot close support with null eventId');
            }
            try {
                yield this.DispatchData.closeSupport(support.eventId, ContactID);
                yield this.getSupports();
                this.currentSupport = null;
                this.toastrService.showSuccessToast('Support ticket closed successfully');
            }
            catch (error) {
                this._handleSupportClosureError(error, support);
            }
        });
    }
    _handleSupportClosureError(error, support) {
        const errorMessage = error instanceof Error
            ? error.message
            : 'An unexpected error occurred while closing support';
        console.error('Support closure failed:', {
            error: errorMessage,
            supportId: support.eventId,
            jobNumber: support.jobNumber
        });
        throw new Error(errorMessage);
    }
    lockSupport(support) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!support)
                return;
            console.log(support);
            try {
                if (support.lockedBy === FirstName) {
                    if (support.eventId !== null) {
                        yield this.DispatchData.unLockSupport(support.eventId, FirstName);
                    }
                    this.toastrService.showSuccessToast("Support unlocked successfully");
                }
                else {
                    if (support.eventId !== null) {
                        yield this.DispatchData.lockSupport(support.eventId, FirstName);
                    }
                    this.toastrService.showSuccessToast("Support locked successfully");
                }
                yield this.getSupports();
            }
            catch (error) {
                console.log("Error locking/unlocking support:", error);
            }
        });
    }
    setSelectedChannels(item) {
        const sr = this.pickChannels.find((obj) => obj.label === item);
        this.pickService.channel.push(sr);
    }
    getSupports() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.supportsLoading = true;
                const data = yield this.DispatchData.getSupports(this.supportChannel);
                const first = this.supports === null || this.supports === undefined;
                this.supports = data;
                if (first) {
                    this.supportChannel.split(",").forEach((channel) => this.setSelectedChannels(channel));
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
            }
            catch (error) {
                console.log("Error getting supports:", error);
            }
            finally {
                this.supportsLoading = false;
            }
        });
    }
    getClientContacts() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.pickClients = yield this.DispatchData.getClientContacts(ContactID);
            }
            catch (error) {
                console.log("Error getting client contacts:", error);
            }
        });
    }
    getData() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Only reset current selections, not the full job list
                this.currentJob = undefined;
                this.JobDetailService.currentJob = null;
                this.potentialCouriers = null;
                this.jobGroups = false;
                if (!this.courier) {
                    this.currentCourier = null;
                }
                // Fetch data concurrently
                const [activeCouriers, allCouriers] = yield Promise.all([this.DispatchData.getActiveCouriers(), this.DispatchData.getAllCouriers(),]);
                this.pickCouriers = activeCouriers;
                this.pickAllCouriers = allCouriers;
                // Get job list only once - this function manages its own loading state
                yield this.getJobList();
            }
            catch (error) {
                console.error("Error in getData:", error);
                console.log("An error occurred while loading data. Please refresh the page.");
            }
        });
    }
    fetchDriverLocations() {
        return __awaiter(this, void 0, void 0, function* () {
            this.driverLocationsLoading = true;
            yield this.getDriverLocationsData();
            this.driverLocationsLoading = false;
        });
    }
    getDriverLocationsData() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Filter views to only include selected ones
                const selectedViews = this.views.filter((view) => view.selected);
                if (!selectedViews)
                    return;
                this.driverLocations = yield this.DispatchData.getDriverLocations(selectedViews);
                console.log("Driver Locations: ", this.driverLocations);
                yield this.activateDrop();
            }
            catch (error) {
                console.error("Error getting clear lists data:", error);
            }
        });
    }
    setSplitJobMeetingPoint($event, currentJob) {
        return __awaiter(this, void 0, void 0, function* () {
            const getDeliveryLocation = (job) => ({
                lat: job.deliveryLatitude || "", long: job.deliveryLongitude || "",
            });
            try {
                const location = getDeliveryLocation(currentJob);
                console.log("Retrieved job coordinates!");
                const selectedSuburbs = yield this.DispatchData.getSuburbList();
                const dialogResult = yield this.showEditAddressDialog($event, currentJob, selectedSuburbs, location);
                yield this.handleDialogResult(dialogResult, currentJob);
            }
            catch (error) {
                console.log(error.message);
            }
            finally {
                console.log("Split jobs process completed.");
            }
        });
    }
    showEditAddressDialog($event, currentJob, selectedSuburbs, location) {
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
    handleDialogResult(addressDetails, currentJob) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!addressDetails) {
                console.log("Split jobs canceled!");
                return;
            }
            const updatedJob = Object.assign(Object.assign({}, currentJob), { toAddress: addressDetails.address, toSuburbID: addressDetails.toSuburbId });
            const callData = {
                jobID: updatedJob.id,
                lat: Number(addressDetails.latitude),
                long: Number(addressDetails.longitude),
                toSuburbId: Number(updatedJob.toSuburbID),
                toAddress: updatedJob.toAddress,
            };
            if (!callData.toAddress || !callData.toSuburbId)
                return;
            yield this.DispatchData.updateSplitJobAddress(callData.jobID, callData.toSuburbId, callData.toAddress, callData.lat, callData.long);
            yield this.DispatchData.reRateSplitJob(callData.jobID);
            yield this.DispatchData.finishSplitJobProcess(callData.jobID, FirstName);
            yield this.getData();
            this.toastrService.showSuccessToast("Job Successfully Split");
            console.log("Job splitting complete!");
            console.log("Dialog closed!");
            return this.getJobList();
        });
    }
    addEvent() {
        let time = new Date();
        time.setSeconds(0);
        time.setMilliseconds(0);
        if (!this.currentJob)
            return;
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
    truckLoadingStatus($event) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$mdDialog
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
        });
    }
    createNewJob() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const newJobId = yield this.showCreateJobDialog();
                if (newJobId) {
                    yield this.processNewJob(newJobId);
                }
            }
            catch (error) {
                console.log("Error in createNewJob:", error);
            }
        });
    }
    showCreateJobDialog() {
        return __awaiter(this, void 0, void 0, function* () {
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
        });
    }
    processNewJob(newJobId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const job = yield this.DispatchData.getJobDetail(newJobId);
                yield this.getData();
                yield this.selectJob(job);
                this.toastrService.showSuccessToast("New Job Created Successfully");
            }
            finally {
                // Any cleanup operations can go here
            }
        });
    }
    interCourierCharge($event) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.$mdDialog.show({
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
            }
            catch (error) {
                if (error === undefined) {
                    console.log("Inter-courier Charge Canceled!");
                }
                else {
                    throw error;
                }
            }
        });
    }
    createEvent($event, job) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.$mdDialog.show({
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
            }
            catch (error) {
                if (error === undefined) {
                    console.log("User canceled!");
                }
                else {
                    throw error;
                }
            }
        });
    }
    checkForAttachments(jobId) {
        return __awaiter(this, void 0, void 0, function* () {
            this.isCheckingAttachments = true;
            this.hasAttachedFile = false;
            try {
                const response = yield this.DispatchData.isFilesAttachedToJob(jobId);
                this.hasAttachedFile = response;
                return response;
            }
            catch (error) {
                console.log("Error checking for attachments:", error);
                this.hasAttachedFile = false;
                throw error;
            }
            finally {
                this.isCheckingAttachments = false;
            }
        });
    }
    openFileAttachmentDialog($event, job) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.$mdDialog.show({
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
            }
            catch (error) {
                if (error === undefined) {
                    console.log("User canceled!");
                }
                else {
                    throw error;
                }
            }
        });
    }
    showAdditionalServicesMenu($event, job) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!job.clientId || !job.speedId) {
                    return;
                }
                const isClientItemsAvailable = yield this.DispatchData.hasClientItemsAvailable(job.clientId, job.speedId);
                if (!isClientItemsAvailable) {
                    yield this.$mdDialog.show(this.$mdDialog
                        .alert()
                        .clickOutsideToClose(true)
                        .title("No Additional Services")
                        .targetEvent($event)
                        .textContent("No additional services has been set up for this client. Please add a service through Admin Manager and try again.")
                        .ok("OK"));
                    return;
                }
                yield this.$mdDialog.show({
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
            }
            catch (error) {
                if (error === undefined) {
                    console.log("User canceled dialog!");
                }
                else {
                    console.error("Error in showAdditionalServicesMenu:", error);
                }
            }
        });
    }
    init() {
        this.initLayoutSystem(ContactID);
        this.loadPageViews().then(() => __awaiter(this, void 0, void 0, function* () {
            console.log("Loaded Page Views and Data!");
            const jobId = this.$stateParams.jobId;
            if (jobId) {
                try {
                    yield this.getData();
                    const job = yield this.DispatchData.getJobDetail(jobId);
                    yield this.selectJob(job);
                }
                catch (error) {
                    console.error("Error loading initial job:", error);
                    this.toastrService.showErrorToast("Error loading job details");
                }
            }
            else {
                yield this.getData();
            }
        }));
    }
    isJobSelected(jobId) {
        return this.dispatchState.selectedJobs.has(jobId);
    }
    updateCallData(callData, job, jobIdElement) {
        if (!callData.courierId) {
            callData.courierId = job.courierData.courierId;
        }
        if (job.displaySplitJobDetail) {
            callData.splitJobs.push(jobIdElement.data("jobid"));
        }
        else {
            callData.jobs.push(jobIdElement.attr("data-jobid"));
        }
    }
    fetchAndDisplayCurrentJobs(jobs) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(jobs)) {
                console.warn("Invalid jobs data received:", jobs);
                return [];
            }
            // Map numeric values to proper job objects if needed
            const processedJobs = jobs.map((job) => {
                return job;
            });
            this.jobList = processedJobs;
            yield this.activateDrop();
            return processedJobs;
        });
    }
    updateUIAfterCourierSelection(courier) {
        return __awaiter(this, void 0, void 0, function* () {
            this.currentWorkSelection = ` for Courier ${courier.label}`;
            this.truckCourierStatus = yield this.DispatchData.truckCourierStatus(courier.courierId);
        });
    }
    getStatusCount(statusType) {
        if (!this.jobList || !Array.isArray(this.jobList)) {
            return 0;
        }
        // Convert status type to lowercase and replace spaces with hyphens
        const normalizedStatusType = statusType.toLowerCase().replace(/\s+/g, '-');
        // Map common category names to arrays of actual status IDs with proper typing
        const statusGroups = {
            'pending': [
                job_status_enum_1.JobStatus.New,
                job_status_enum_1.JobStatus.Dispatched,
                job_status_enum_1.JobStatus.ReadyForPacking,
                job_status_enum_1.JobStatus.ReadyToPickup,
                job_status_enum_1.JobStatus.AwaitingProcessing,
                job_status_enum_1.JobStatus.Preassigned
            ],
            'in-transit': [
                job_status_enum_1.JobStatus.Accepted,
                job_status_enum_1.JobStatus.PickedUp,
                job_status_enum_1.JobStatus.InTransit,
                job_status_enum_1.JobStatus.OutForDelivery
            ],
            'completed': [
                job_status_enum_1.JobStatus.Completed,
                job_status_enum_1.JobStatus.AssumingCompleted
            ],
            'problem': [
                job_status_enum_1.JobStatus.Rejected,
                job_status_enum_1.JobStatus.LatePickup,
                job_status_enum_1.JobStatus.Warning,
                job_status_enum_1.JobStatus.LateDelivery,
                job_status_enum_1.JobStatus.AwaitingPod,
                job_status_enum_1.JobStatus.Undeliverable
            ]
        };
        // Check if we're looking for a status group
        if (statusGroups[normalizedStatusType]) {
            return this.jobList.filter(job => job.statusId !== undefined &&
                statusGroups[normalizedStatusType].includes(job.statusId)).length;
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
    filterByStatus(statusGroup) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('filterByStatus called with:', statusGroup);
            this.queryParams.order = statusGroup;
            yield this.getJobList();
            console.log(`Jobs ordered by status group: ${statusGroup}`);
        });
    }
}
exports.HomeController = HomeController;
HomeController.$inject = [
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
    'hotkeys',
    'APP_CONFIG',
    '$mdSidenav',
    'AppPages',
    '$stateParams',
    'NgMap',
];
