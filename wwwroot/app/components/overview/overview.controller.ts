import OverviewService from "./overview.service";
import ToastrService from "../../services/toastr.service";
import NavigationService from "../../services/navigation.service";
import OverviewFiltersService from "./services/overview-filters.service";
import {OverviewQueryParams, OverviewTableChildJob, OverviewTableParentJob} from "./overview.interfaces";
import "./overview.styles.less";
import BaseController from "../base-controller";
import {Suggestion} from "../../interfaces/job.interface";
import greetUser from "../../functions/greetUser";
import dayjs, {Dayjs} from "dayjs";
import {DateRangeDialogController} from "../dialogs/date-range-dialog/date-range-dialog.controller";
import {MapDialogController} from "../dialogs/map-dialog/map-dialog.controller";

class OverviewController extends BaseController {
    static $inject = [
        "$mdDialog",
        "$mdSidenav",
        "overviewService",
        "toastrService",
        "$state",
        "$window",
        "navigationService",
        "overviewFiltersService",
        "$document",
        "$scope",
        "$timeout",
        "$interval",
    ];

    private readonly OverviewJobLimitDisplay: string = "overviewJobLimitDisplay";
    isLoading: boolean;
    greeting: string;
    statistics: { active: number; inactive: number; completed: number };
    query: {
        order: string;
        direction: string;
        page: number;
        limit: number;
        total: number;
    };

    regionsLoading: boolean;
    speedsLoading: boolean;
    isOverviewCardCollapsed: boolean;

    deliveries: any[];
    regions: Suggestion[];
    speeds: Suggestion[];
    promise: Promise<any> | null;

    search: string;

    dateRange: { start: Dayjs | null; end: Dayjs | null };
    selectedRegions: Suggestion[];
    allRegionsSelected: boolean;
    selectedSpeeds: Suggestion[];
    allSpeedsSelected: boolean;

    activeTab: number;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $mdSidenav: angular.material.ISidenavService,
        private overviewService: OverviewService,
        private toastrService: ToastrService,
        private $state: angular.ui.IStateService,
        private $window: angular.IWindowService,
        private navigationService: NavigationService,
        private overviewFiltersService: OverviewFiltersService,
        private $document: angular.IDocumentService,
        $scope: angular.IScope,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
    ) {
        super();
        this.initServices($timeout, $interval, $scope)

        // Initialize properties
        this.isLoading = false;
        this.greeting = greetUser(FirstName);
        this.statistics = {active: 0, inactive: 0, completed: 0};
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

        // Filters
        this.dateRange = {start: null, end: null};
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

    private setupWatchers(): void {
        // Watch for tab changes
        this.watchScope(
            () => this.activeTab,
            (newValue: number, oldValue: number) => {
                if (newValue !== oldValue) {
                    return this.refreshData();
                }
            }
        );

        // Watch for search changes with debouncing
        this.watchScope(
            () => this.search,
            (newValue: string, oldValue: string) => {
                if (newValue !== oldValue) {
                    this.handleSearchChange();
                }
            }
        );

        // Watch for changes to the query limit
        this.watchScope(
            () => this.query.limit,
            (newValue: number, oldValue: number) => {
                if (newValue !== oldValue) {
                    if (Modernizr.localstorage) {
                        localStorage.setItem(this.OverviewJobLimitDisplay, `${this.query.limit}`);
                    }
                }
            }
        );
    }

    private loadSavedLimit(): void {
        const savedLimit = localStorage.getItem(this.OverviewJobLimitDisplay);
        console.log(`Saved limit is: ${savedLimit}`);
        if (savedLimit) {
            this.query.limit = parseInt(savedLimit);
        }
    }

    private initialDataLoad(): void {
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

    loadOverviewCardState(): void {
        this.isOverviewCardCollapsed =
            this.overviewService.loadCollapseState("overview");
    }

    async toggleOverviewCard(): Promise<void> {
        this.isOverviewCardCollapsed = !this.isOverviewCardCollapsed;
        await this.overviewService.saveCollapseState(
            "overview",
            this.isOverviewCardCollapsed
        );
    }

    async loadStats() {
        try {
            const stats = await this.overviewService.getStats();
            this.statistics = {
                active: stats.active || 0,
                inactive: stats.inactive || 0,
                completed: stats.completed || 0,
            };
        } catch (error) {
            console.error("Error loading statistics:", error);
            this.statistics = {active: 0, inactive: 0, completed: 0};
        }
    }

    async setTab(tabIndex: number) {
        if (this.activeTab !== tabIndex) {
            this.activeTab = tabIndex;
            await this.refreshData();
        }
    }

    getStatusGroup(): number {
        return this.activeTab + 1; // Maps to JobStatusGroup enum (1-based)
    }

    handleSearchChange() {
        this.debounce(async () => {
            this.query.page = 1;
            await this.refreshData();
        }, 300);
    }

    async getRegions() {
        try {
            this.regionsLoading = true;
            this.regions = await this.overviewService.getAllRegions();
        } catch (error) {
            console.error("An error occured getting regions.");
        } finally {
            this.regionsLoading = false;
        }
    }

    async toggleRegion(region: Suggestion) {
        const idx = this.selectedRegions.indexOf(region);

        if (region.selected && idx === -1) {
            this.selectedRegions.push(region);
        } else if (!region.selected && idx !== -1) {
            this.selectedRegions.splice(idx, 1);
        }

        this.allRegionsSelected =
            this.regions.length === this.selectedRegions.length;
        this.query.page = 1;

        // Update shared filter service
        this.overviewFiltersService.updateFilters({
            selectedRegions: this.selectedRegions,
        });

        await this.refreshData();
    }

    async toggleAllRegions() {
        this.regions.forEach((region) => {
            region.selected = this.allRegionsSelected;
        });

        if (this.allRegionsSelected) {
            this.selectedRegions = this.regions.slice();
        } else {
            this.selectedRegions = [];
        }

        this.query.page = 1;

        await this.refreshData();
    }

    async getSpeeds() {
        try {
            this.speedsLoading = true;
            this.speeds = await this.overviewService.getAllSpeeds();
        } catch (error) {
            console.error("An error occured getting speeds.");
        } finally {
            this.speedsLoading = false;
        }
    }

    async toggleSpeed(speed: Suggestion) {
        const idx = this.selectedSpeeds.indexOf(speed);

        if (speed.selected && idx === -1) {
            this.selectedSpeeds.push(speed);
        } else if (!speed.selected && idx !== -1) {
            this.selectedSpeeds.splice(idx, 1);
        }

        this.allSpeedsSelected = this.speeds.length === this.selectedSpeeds.length;
        this.query.page = 1;

        this.overviewFiltersService.updateFilters({
            selectedSpeeds: this.selectedSpeeds,
        });

        await this.refreshData();
    }

    async toggleAllSpeeds() {
        this.speeds.forEach((speed) => {
            speed.selected = this.allSpeedsSelected;
        });

        if (this.allSpeedsSelected) {
            this.selectedSpeeds = this.speeds.slice();
        } else {
            this.selectedSpeeds = [];
        }

        this.query.page = 1;
        await this.refreshData();
    }

    toggleSidenav() {
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

    transformStatus(status: string): string {
        return status.toUpperCase().replace(/[\s-]/g, "_");
    }

    getProgressClass(completion: number): string {
        if (completion < 30) {
            return "md-low"; // Light green for low progress
        } else if (completion < 70) {
            return "md-medium"; // Medium green for medium progress
        }
        return "md-high"; // Gray for high progress
    }

    async showDateRangeDialog($event: MouseEvent) {
        try {
            const dialogDateRange = {
                start: this.dateRange.start ? this.dateRange.start.toDate() : null,
                end: this.dateRange.end ? this.dateRange.end.toDate() : null,
            };

            const result = await this.$mdDialog.show({
                controller: DateRangeDialogController,
                controllerAs: "ctrl",
                targetEvent: $event,
                template: require("../dialogs/date-range-dialog/date-range-dialog.html"),
                parent: this.$document.parent(),
                clickOutsideToClose: true,
                fullscreen: false,
                bindToController: true,
                locals: {
                    dateRange: dialogDateRange,
                },
            });

            this.dateRange = {
                start: result.start ? dayjs(result.start) : null,
                end: result.end ? dayjs(result.end) : null,
            };

            this.overviewFiltersService.updateFilters({
                dateRange: this.dateRange,
            });

            await this.refreshData();
        } catch (error) {
            if (error !== undefined) {
                console.error("Error selecting date range:", error);
            }
        }
    }

    hasDateFilter(): boolean {
        return this.dateRange.start !== null || this.dateRange.end !== null;
    }

    getDateRangeDisplay(): string {
        if (!this.hasDateFilter()) return "";

        if (this.dateRange.start && this.dateRange.end) {
            return `${this.formatDate(this.dateRange.start)} - ${this.formatDate(
                this.dateRange.end
            )}`;
        } else if (this.dateRange.start) {
            return `From ${this.formatDate(this.dateRange.start)}`;
        } else {
            return `Until ${this.formatDate(this.dateRange.end)}`;
        }
    }

    formatDate(date: Dayjs | null): string {
        return date ? date.format("MMM D, YYYY") : "";
    }

    async clearDateRange($event: MouseEvent | undefined) {
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

        await this.refreshData();
    }

    async showMap(delivery: OverviewTableParentJob) {
        await this.$mdDialog.show({
            controller: MapDialogController,
            controllerAs: "ctrl",
            template: require("../dialogs/map-dialog/map-dialog.template.html"),
            parent: this.$document.parent(),
            clickOutsideToClose: true,
            fullscreen: true,
            locals: {
                delivery,
            },
            bindToController: true,
        });
    }

    openJobDetail(delivery: OverviewTableParentJob) {
        if (delivery && delivery.jobId) {
            this.navigationService.openJobDetail(delivery.jobId);
        }
    }

    async onReorder() {
        this.query.page = 1;
        await this.refreshData();
    }

    async refreshData() {
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

            const regions = this.selectedRegions.map(region => region.id);
            const speeds = this.selectedSpeeds.map(speed => speed.id);

            const params: OverviewQueryParams = {
                statusGroup,
                page: this.query.page || 1,
                limit: this.query.limit || 20,
                search: this.search,
                startDate: this.dateRange.start ? this.dateRange.start : undefined,
                endDate: this.dateRange.end ? this.dateRange.end : undefined,
                orderBy,
                orderDirection,
                regions: regions.length > 0 ? regions : undefined,
                speeds: speeds.length > 0 ? speeds : undefined,
            }

            // Set promise to trigger loading state in md-table
            this.promise = this.overviewService.getAllJobs(params);
            const response = await this.promise;

            // Transform status for each delivery and child job
            this.deliveries = response.items.map((delivery: OverviewTableParentJob) => ({
                ...delivery,
                status: this.transformStatus(delivery.status),
                childJobs: Array.isArray(delivery.childJobs)
                    ? delivery.childJobs.map((childJob: OverviewTableChildJob) => ({
                        ...childJob,
                        status: this.transformStatus(childJob.status),
                    }))
                    : [],
            }));

            // Update query metadata
            this.query.total = response.total;

            // Refresh statistics after a data load
            await this.loadStats();
        } catch (error) {
            console.error("Error loading deliveries:", error);
            this.toastrService.showErrorToast(
                "An unexpected error occurred. Please try again."
            );
        } finally {
            this.isLoading = false;
        }
    }
}

const OverviewComponent: angular.IComponentOptions = {
    template: require("./overview.template.html"),
    controller: OverviewController,
    controllerAs: "ctrl",
};
export default OverviewComponent;
