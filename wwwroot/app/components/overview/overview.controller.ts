import OverviewService from "./overview.service";
import ToastrService from "../../services/toastr.service";
import NavigationService from "../../services/navigation.service";
import OverviewFiltersService from "./services/overview-filters.service";
import {
    IOverViewDateSearchRange, IOverviewQuery, IOverviewStatistics,
    OverviewQueryParams,
    OverviewTableChildJob,
    OverviewTableParentJob
} from "./overview.interfaces";
import "./overview.styles.less";
import BaseController from "../base-controller";
import {ISuggestion} from "../../interfaces/job.interface";
import greetUser from "../../functions/greetUser";
import {Dayjs} from "dayjs";
import {DateRangeDialogController} from "../dialogs/date-range-dialog/date-range-dialog.controller";
import MapDialogService from "../dialogs/map-dialog/map-dialog.service";
import {IPaginatedResponse} from "../../interfaces/paginated-response.interface";
import DispatchCoreService from "../../services/dispatch-core.service";
import {IDataTableColumn, IDataTableSort} from "../common/data-table/data-table.interfaces";

class OverviewController extends BaseController {
    static $inject = [
        "$mdDialog",
        "$mdSidenav",
        "overviewService",
        "DispatchData",
        "toastrService",
        "navigationService",
        "overviewFiltersService",
        "mapDialogService",
        "$document",
        "$scope",
        "$timeout",
        "$interval",
    ];

    private readonly OverviewJobLimitDisplay: string = `overviewJobLimitDisplay-${ContactID}`;

    isLoading: boolean;
    greeting: string;
    statistics: IOverviewStatistics;
    query: IOverviewQuery;

    regionsLoading: boolean;
    speedsLoading: boolean;
    isOverviewCardCollapsed: boolean;

    deliveries: any[];
    regions: ISuggestion[];
    speeds: ISuggestion[];
    promise?: Promise<IPaginatedResponse<OverviewTableParentJob>>;

    search: string;

    // Data table configuration
    tableColumns: IDataTableColumn[] = [];
    tableSort: IDataTableSort = { column: 'jobName', direction: 'asc' };

    dateRange: IOverViewDateSearchRange;
    selectedRegions: ISuggestion[];
    allRegionsSelected: boolean;
    selectedSpeeds: ISuggestion[];
    allSpeedsSelected: boolean;

    couriersLoading: boolean;
    selectedCouriers: ISuggestion[];
    selectedCourier: ISuggestion | null;
    courierSearchText: string;

    activeTab: number;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $mdSidenav: angular.material.ISidenavService,
        private overviewService: OverviewService,
        private DispatchData: DispatchCoreService,
        private toastrService: ToastrService,
        private navigationService: NavigationService,
        private overviewFiltersService: OverviewFiltersService,
        private mapDialogService: MapDialogService,
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

        // Search properties
        this.search = "";

        // Filters
        this.dateRange = {};
        this.selectedRegions = [];
        this.allRegionsSelected = false;
        this.selectedSpeeds = [];
        this.allSpeedsSelected = false;

        // Courier filter
        this.couriersLoading = false;
        this.selectedCouriers = [];
        this.selectedCourier = null;
        this.courierSearchText = '';

        this.activeTab = 0;

        this.initTableColumns();
        this.loadOverviewCardState();
        this.loadSavedLimit();
        this.initialDataLoad();
    }

    private initTableColumns(): void {
        this.tableColumns = [
            { key: 'expand', label: '', sortable: false, width: '48px' },
            { key: 'jobName', label: 'Job Number', sortable: true },
            { key: 'status', label: 'Status', sortable: true },
            { key: 'completion', label: 'Completion', sortable: true },
            { key: 'pickup', label: 'Pickup', sortable: true },
            { key: 'delivery', label: 'Delivery', sortable: true },
            { key: 'driver', label: 'Driver', sortable: true },
            { key: 'region', label: 'Region', sortable: true },
            { key: 'actions', label: 'Actions', sortable: false }
        ];
    }

    $onInit() {
        this.loadOverviewCardState();
        this.loadSavedLimit();
        this.initialDataLoad();
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
            this.query.page = 1; // Reset to the first page when changing tabs
            await this.refreshData();
        }
    }

    getStatusGroup(): number {
        return this.activeTab + 1; // Maps to JobStatusGroup enum (1-based)
    }

    async handleSearchChange() {
        this.query.page = 1;
        await this.refreshData();
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

    async toggleRegion(region: ISuggestion) {
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

    async toggleSpeed(speed: ISuggestion) {
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
                start: this.dateRange.start,
                end: this.dateRange.end
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
                start: result.start,
                end: result.end
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

    formatDate(date: Dayjs | undefined): string {
        return date ? date.format("MMM D, YYYY") : "";
    }

    async clearDateRange($event: MouseEvent | undefined) {
        if ($event) {
            $event.stopPropagation();
        }

        this.dateRange = {};

        this.overviewFiltersService.updateFilters({
            dateRange: this.dateRange,
        });

        await this.refreshData();
    }

    async showMap($event: MouseEvent, delivery: OverviewTableParentJob) {
        await this.mapDialogService.openMapDialog($event, delivery);
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

    onSort(sort: IDataTableSort): void {
        this.tableSort = sort;
        this.query.order = sort.direction === 'desc' ? `-${sort.column}` : sort.column;
        this.query.page = 1;
        this.refreshData();
    }

    onPaginate(page: number, limit: number): void {
        this.query.page = page;
        this.query.limit = limit;
        this.saveLimit();
        this.refreshData();
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
            const couriers = this.selectedCouriers.map(courier => courier.id);

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
                couriers: couriers.length > 0 ? couriers : undefined,
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
            this.applyScope();
        }
    }

    async searchCouriers(searchText: string): Promise<ISuggestion[] | undefined> {
        try {
            const results = await this.DispatchData.autocompleteSearch(searchText, 'courier/AllActiveSearch');
            console.log('Courier Search Results: ', results);
            return results;
        } catch (error) {
            this.toastrService.showErrorToast();
            console.log(error);
        }
    }

    async addCourier(courier: ISuggestion | null): Promise<void> {
        if (courier && !this.selectedCouriers.some(c => c.id === courier.id)) {
            this.selectedCouriers.push(courier);
            this.selectedCourier = null;
            this.courierSearchText = '';
            this.query.page = 1;

            this.overviewFiltersService.updateFilters({
                selectedCouriers: this.selectedCouriers,
            });

            await this.refreshData();
        }
    }

    onCourierRemoved(): void {
        this.query.page = 1;

        this.overviewFiltersService.updateFilters({
            selectedCouriers: this.selectedCouriers,
        });

        // Use $timeout to ensure the chip removal completes first
        this.registerTimeout(async () => {
            await this.refreshData();
        }, 0);
    }

    private saveLimit(): void {
        if (Modernizr.localstorage) {
            localStorage.setItem(this.OverviewJobLimitDisplay, `${this.query.limit}`);
        }
    }
}

const OverviewComponent: angular.IComponentOptions = {
    template: require("./overview.template.html"),
    controller: OverviewController,
    controllerAs: "ctrl",
};
export default OverviewComponent;
