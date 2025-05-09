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
exports.OverviewController = void 0;
const bindAllMethods_1 = require("../../bindAllMethods");
require("./overview.styles.less");
class OverviewController {
    constructor($mdDialog, $mdSidenav, overviewService, $scope, $timeout, toastrService, moment, $state, $window, greetingService, openJobDispatchService, overviewFiltersService) {
        this.$mdDialog = $mdDialog;
        this.$mdSidenav = $mdSidenav;
        this.overviewService = overviewService;
        this.$scope = $scope;
        this.$timeout = $timeout;
        this.toastrService = toastrService;
        this.moment = moment;
        this.$state = $state;
        this.$window = $window;
        this.openJobDispatchService = openJobDispatchService;
        this.overviewFiltersService = overviewFiltersService;
        this.OverviewJobLimitDisplay = "overviewJobLimitDisplay";
        bindAllMethods_1.bindAllMethods(this);
        // Initialize properties
        this.isLoading = false;
        this.greeting = greetingService.greetUser(FirstName);
        this.statistics = { active: 0, inactive: 0, completed: 0 };
        this.query = {
            order: "jobName",
            direction: "asc",
            page: 1,
            limit: 20,
            total: 0,
        };
        // Loaders
        this.regionsLoading = false;
        this.speedsLoading = false;
        // Card collapse state
        this.isOverviewCardCollapsed = false;
        // Initialize data containers
        this.deliveries = [];
        this.regions = [];
        this.speeds = [];
        this.promise = null;
        // Search properties
        this.search = "";
        this.searchTimeout = null;
        // Filters
        this.dateRange = { start: null, end: null };
        this.selectedRegions = [];
        this.allRegionsSelected = false;
        this.selectedSpeeds = [];
        this.allSpeedsSelected = false;
        this.activeTab = 0;
        this.loadOverviewCardState();
        this.setupWatchers();
        this.loadSavedLimit();
        this.initialDataLoad();
    }
    $onInit() {
        this.loadOverviewCardState();
        this.setupWatchers();
        this.loadSavedLimit();
        this.initialDataLoad();
    }
    setupWatchers() {
        // Watch for tab changes
        this.$scope.$watch(() => this.activeTab, (newValue, oldValue) => {
            if (newValue !== oldValue) {
                this.refreshData();
            }
        });
        // Watch for search changes with debounce
        this.$scope.$watch(() => this.search, (newValue, oldValue) => {
            if (newValue !== oldValue) {
                this.handleSearchChange();
            }
        });
        // Watch for changes to query limit
        this.$scope.$watch(() => this.query.limit, (newValue, oldValue) => {
            if (newValue !== oldValue) {
                if (Modernizr.localstorage) {
                    localStorage.setItem(this.OverviewJobLimitDisplay, `${this.query.limit}`);
                }
            }
        });
    }
    loadSavedLimit() {
        const savedLimit = localStorage.getItem(this.OverviewJobLimitDisplay);
        console.log(`Saved limit is: ${savedLimit}`);
        if (savedLimit) {
            this.query.limit = parseInt(savedLimit);
        }
    }
    initialDataLoad() {
        Promise.all([
            this.loadStats(),
            this.getRegions(),
            this.getSpeeds(),
            this.refreshData(),
        ])
            .then(() => {
            console.log("All data loaded successfully");
        })
            .catch((error) => {
            console.error("Error loading data:", error);
        });
    }
    loadOverviewCardState() {
        this.isOverviewCardCollapsed =
            this.overviewService.loadCollapseState("overview");
    }
    toggleOverviewCard() {
        return __awaiter(this, void 0, void 0, function* () {
            this.isOverviewCardCollapsed = !this.isOverviewCardCollapsed;
            yield this.overviewService.saveCollapseState("overview", this.isOverviewCardCollapsed);
        });
    }
    loadStats() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const stats = yield this.overviewService.getStats();
                this.statistics = {
                    active: stats.active || 0,
                    inactive: stats.inactive || 0,
                    completed: stats.completed || 0,
                };
            }
            catch (error) {
                console.error("Error loading statistics:", error);
                this.statistics = { active: 0, inactive: 0, completed: 0 };
            }
        });
    }
    setTab(tabIndex) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.activeTab !== tabIndex) {
                this.activeTab = tabIndex;
                yield this.refreshData();
            }
        });
    }
    getStatusGroup() {
        return this.activeTab + 1; // Maps to JobStatusGroup enum (1-based)
    }
    handleSearchChange() {
        // Cancel any pending timeout
        if (this.searchTimeout) {
            this.$timeout.cancel(this.searchTimeout);
        }
        // Set new timeout
        this.searchTimeout = this.$timeout(() => __awaiter(this, void 0, void 0, function* () {
            this.query.page = 1; // Reset to first page on new search
            yield this.refreshData();
        }), 300); // 300ms debounce
    }
    getRegions() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.regionsLoading = true;
                this.regions = yield this.overviewService.getAllRegions();
            }
            catch (error) {
                console.error("An error occured getting regions.");
            }
            finally {
                this.regionsLoading = false;
            }
        });
    }
    toggleRegion(region) {
        return __awaiter(this, void 0, void 0, function* () {
            const idx = this.selectedRegions.indexOf(region);
            if (region.selected && idx === -1) {
                this.selectedRegions.push(region);
            }
            else if (!region.selected && idx !== -1) {
                this.selectedRegions.splice(idx, 1);
            }
            this.allRegionsSelected =
                this.regions.length === this.selectedRegions.length;
            this.query.page = 1;
            // Update shared filter service
            this.overviewFiltersService.updateFilters({
                selectedRegions: this.selectedRegions,
            });
            yield this.refreshData();
        });
    }
    toggleAllRegions() {
        return __awaiter(this, void 0, void 0, function* () {
            this.regions.forEach((region) => {
                region.selected = this.allRegionsSelected;
            });
            if (this.allRegionsSelected) {
                this.selectedRegions = this.regions.slice();
            }
            else {
                this.selectedRegions = [];
            }
            this.query.page = 1;
            yield this.refreshData();
        });
    }
    getSpeeds() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.speedsLoading = true;
                this.speeds = yield this.overviewService.getAllSpeeds();
            }
            catch (error) {
                console.error("An error occured getting speeds.");
            }
            finally {
                this.speedsLoading = false;
            }
        });
    }
    toggleSpeed(speed) {
        return __awaiter(this, void 0, void 0, function* () {
            const idx = this.selectedSpeeds.indexOf(speed);
            if (speed.selected && idx === -1) {
                this.selectedSpeeds.push(speed);
            }
            else if (!speed.selected && idx !== -1) {
                this.selectedSpeeds.splice(idx, 1);
            }
            this.allSpeedsSelected = this.speeds.length === this.selectedSpeeds.length;
            this.query.page = 1;
            this.overviewFiltersService.updateFilters({
                selectedSpeeds: this.selectedSpeeds,
            });
            yield this.refreshData();
        });
    }
    toggleAllSpeeds() {
        return __awaiter(this, void 0, void 0, function* () {
            this.speeds.forEach((speed) => {
                speed.selected = this.allSpeedsSelected;
            });
            if (this.allSpeedsSelected) {
                this.selectedSpeeds = this.speeds.slice();
            }
            else {
                this.selectedSpeeds = [];
            }
            this.query.page = 1;
            yield this.refreshData();
        });
    }
    toggleSidenav() {
        this.$mdSidenav("right").toggle();
    }
    transformStatus(status) {
        // Remove spaces and special characters, convert to uppercase
        return status.toUpperCase().replace(/[\s-]/g, "_");
    }
    getProgressClass(completion) {
        if (completion < 30) {
            return "md-low"; // Light green for low progress
        }
        else if (completion < 70) {
            return "md-medium"; // Medium green for medium progress
        }
        return "md-high"; // Gray for high progress
    }
    showDateRangeDialog($event) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.dateRange = yield this.$mdDialog.show({
                    controller: "DateRangeDialogController",
                    controllerAs: "ctrl",
                    targetEvent: $event,
                    template: require("../dialogs/date-range-dialog/date-range-dialog.html"),
                    parent: document.body,
                    clickOutsideToClose: true,
                    fullscreen: false,
                    bindToController: true,
                    locals: {
                        dateRange: this.dateRange,
                    },
                });
                this.overviewFiltersService.updateFilters({
                    dateRange: this.dateRange,
                });
                yield this.refreshData();
            }
            catch (error) {
                if (error !== undefined) {
                    console.error("Error selecting date range:", error);
                }
            }
        });
    }
    hasDateFilter() {
        return this.dateRange.start !== null || this.dateRange.end !== null;
    }
    getDateRangeDisplay() {
        if (!this.hasDateFilter())
            return "";
        if (this.dateRange.start && this.dateRange.end) {
            return `${this.formatDate(this.dateRange.start)} - ${this.formatDate(this.dateRange.end)}`;
        }
        else if (this.dateRange.start) {
            return `From ${this.formatDate(this.dateRange.start)}`;
        }
        else {
            return `Until ${this.formatDate(this.dateRange.end)}`;
        }
    }
    formatDate(date) {
        return date ? this.moment(date).format("MMM D, YYYY") : "";
    }
    clearDateRange($event) {
        return __awaiter(this, void 0, void 0, function* () {
            if ($event) {
                $event.stopPropagation();
            }
            this.dateRange = {
                start: null,
                end: null,
            };
            this.overviewFiltersService.updateFilters({
                dateRange: this.dateRange,
            });
            yield this.refreshData();
        });
    }
    showMap(delivery) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$mdDialog.show({
                controller: "MapDialogController",
                controllerAs: "ctrl",
                template: require("../dialogs/map-dialog/map-dialog.template.html"),
                parent: document.body,
                clickOutsideToClose: true,
                fullscreen: true,
                locals: {
                    delivery,
                },
                bindToController: true,
            });
        });
    }
    openJobDetail(delivery) {
        if (delivery && delivery.jobId) {
            this.openJobDispatchService.openJobDetail(delivery.jobId);
        }
    }
    openMegaMap() {
        const url = this.$state.href("megaMap");
        this.$window.open(url, "_blank");
    }
    onReorder() {
        return __awaiter(this, void 0, void 0, function* () {
            this.query.page = 1;
            yield this.refreshData();
        });
    }
    refreshData() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const statusGroup = this.getStatusGroup();
                // Show loading state
                this.isLoading = true;
                // Parse sort order
                let orderBy = this.query.order || "jobName";
                let orderDirection = "asc";
                if (orderBy.startsWith("-")) {
                    orderBy = orderBy.substring(1);
                    orderDirection = "desc";
                }
                // Set promise to trigger loading state in md-table
                this.promise = this.overviewService.getAllJobs({
                    statusGroup,
                    page: this.query.page || 1,
                    limit: this.query.limit || 20,
                    search: this.search,
                    startDate: this.dateRange.start || undefined,
                    endDate: this.dateRange.end || undefined,
                    orderBy,
                    orderDirection,
                    regions: this.selectedRegions.length > 0 ? this.selectedRegions : undefined,
                    speeds: this.selectedSpeeds.length > 0 ? this.selectedSpeeds : undefined,
                });
                const response = yield this.promise;
                // Transform status for each delivery and child job
                this.deliveries = response.items.map((delivery) => (Object.assign(Object.assign({}, delivery), { status: this.transformStatus(delivery.status), childJobs: Array.isArray(delivery.childJobs)
                        ? delivery.childJobs.map((childJob) => (Object.assign(Object.assign({}, childJob), { status: this.transformStatus(childJob.status) })))
                        : [] })));
                // Update query metadata
                this.query.total = response.total;
                // Refresh statistics after data load
                yield this.loadStats();
            }
            catch (error) {
                console.error("Error loading deliveries:", error);
                this.toastrService.showErrorToast("An unexpected error occurred. Please try again.");
            }
            finally {
                this.isLoading = false;
            }
        });
    }
}
exports.OverviewController = OverviewController;
OverviewController.$inject = [
    "$mdDialog",
    "$mdSidenav",
    "overviewService",
    "$scope",
    "$timeout",
    "toastrService",
    "moment",
    "$state",
    "$window",
    "greetingService",
    "openJobDispatchService",
    "overviewFiltersService",
];
