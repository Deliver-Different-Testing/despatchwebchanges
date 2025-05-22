import OverviewService from "../overview.service";
import OverviewFiltersService from "../services/overview-filters.service";
import {AppConfig} from "../../../interfaces/app-config.interface";
import {DriverViewModel, OpenJobResponse, OverviewQueryParams, ViewJob} from "../overview.interfaces";
import BaseController from "../../base-controller";
import dayjs from "dayjs";
import duration from 'dayjs/plugin/duration';

class OpenJobsWidgetController extends BaseController {
    static $inject = [
        "$scope",
        "overviewService",
        "APP_CONFIG",
        "overviewFiltersService",
        "$filter"
    ];

    private readonly isUsCustomer: boolean;
    private readonly limitName: string = "openJobsTableViewLimit";
    private readonly sortBy: string;

    private isCardCollapsed?: boolean;
    private drivers?: DriverViewModel[];

    isTableView: boolean = false;
    tableJobs: ViewJob[] = [];
    tableQuery = {
        order: 'jobId',
        limit: 5,
        page: 1
    };

    constructor(
        $scope: angular.IScope,
        private overviewService: OverviewService,
        APP_CONFIG: AppConfig,
        private overviewFiltersService: OverviewFiltersService,
        private $filter: angular.IFilterService,
    ) {
        super();

        dayjs.extend(duration);

        this.isUsCustomer = APP_CONFIG.US_Customer;
        this.sortBy = "jobId";

        $scope.$watch(
            () => this.tableQuery.limit,
            (newValue: number, oldValue: number) => {
                if (newValue !== oldValue) {
                    if (Modernizr.localstorage) {
                        localStorage.setItem(this.limitName, `${this.tableQuery.limit}`);
                    }
                }
            }
        );
    }

    $onInit() {
        // Subscribe to filter changes
        this.overviewFiltersService.onFilterChange(() => this._loadOpenJobs());

        this._loadSavedLimit();
        this._loadOpenJobs();
        this.loadCardState();

        setInterval(this._loadOpenJobs, 60000);
    }

    private _loadSavedLimit() {
        const savedLimit = localStorage.getItem(this.limitName);
        console.log(`Saved limit is: ${savedLimit}`);
        if (savedLimit) {
            this.tableQuery.limit = parseInt(savedLimit);
        }
    }

    private _loadOpenJobs() {
        const params: Pick<OverviewQueryParams, "startDate" | "endDate" | "regions" | "speeds"> = {
            startDate: this.overviewFiltersService.dateRange?.start || undefined,
            endDate: this.overviewFiltersService.dateRange?.end || undefined,
            regions: this.overviewFiltersService.selectedRegions || undefined,
            speeds: this.overviewFiltersService.selectedSpeeds || undefined
        };

        this.overviewService.getOpenJobs(params)
            .then((jobs: OpenJobResponse[]) => {
                // Group jobs by driver
                const groupedJobs: Record<string, DriverViewModel> = {};
                this.tableJobs = []; // Reset table jobs

                jobs.forEach(job => {
                    if (!groupedJobs[job.driverName]) {
                        groupedJobs[job.driverName] = {
                            name: job.driverName,
                            jobs: [],
                            completedToday: job.completedToday,
                            lastCompleted: job.lastCompleted ?
                                this._formatTime(job.lastCompleted) : "N/A",
                            expanded: false
                        };
                    }

                    const viewJob: ViewJob = {
                        jobId: job.jobId,
                        reference: job.reference,
                        status: job.status,
                        pickup: {
                            time: job.pickupTime,
                            name: job.pickupName,
                            address: job.pickupAddress
                        },
                        delivery: {
                            time: job.deliveryTime,
                            name: job.deliveryName,
                            address: job.deliveryAddress
                        },
                        quantity: job.quantity,
                        packageType: job.packageType,
                        mileage: job.mileage,
                        driverName: job.driverName,
                    };

                    groupedJobs[job.driverName].jobs.push(viewJob);
                    this.tableJobs.push(viewJob); // Add to flat list for table view
                });

                // Convert to array and sort jobs within each driver group
                this.drivers = Object.values(groupedJobs).map(driver => {
                    driver.jobs.sort(this.compareJobs);
                    return driver;
                });

                // Sort table jobs
                this.tableJobs.sort(this.compareJobs);
            })
            .catch(error => {
                console.error("Error loading open jobs:", error);
            });
    }

    loadCardState() {
        this.isCardCollapsed = this.overviewService.loadCollapseState("openJobs");
    }

    loadViewModeState() {
        const savedViewMode = localStorage.getItem('openJobsViewMode');
        if (savedViewMode === 'table') {
            this.isTableView = true;
        }
    }

    toggleViewMode() {
        localStorage.setItem('openJobsViewMode', this.isTableView ? 'table' : 'card');
    }

    async toggleCard(): Promise<void> {
        this.isCardCollapsed = !this.isCardCollapsed;
        await this.overviewService.saveCollapseState("openJobs", this.isCardCollapsed);
    }

    private _formatTime(timestamp: Date): string {
        return dayjs(timestamp).format("HH:mm");
    }

    compareJobs(a: ViewJob, b: ViewJob): number {
        try {
            const order = this.tableQuery.order;
            const isDesc = order.charAt(0) === '-';
            const field = isDesc ? order.substring(1) : order;

            let comparison = 0;

            switch (field) {
                case "pickup":
                    comparison = dayjs(a.pickup.time).valueOf() -
                        dayjs(b.pickup.time).valueOf();
                    break;
                case "delivery":
                    comparison = dayjs(a.delivery.time).valueOf() -
                        dayjs(b.delivery.time).valueOf();
                    break;
                case "driverName":
                    comparison = (a.driverName || '').localeCompare(b.driverName || '');
                    break;
                case "status":
                    comparison = (a.status || '').localeCompare(b.status || '');
                    break;
                case "mileage":
                    comparison = a.mileage - b.mileage;
                    break;
                case "jobId":
                default:
                    // jobId is a number from backend
                    comparison = a.jobId - b.jobId;
                    break;
            }

            return isDesc ? -comparison : comparison;
        } catch (error) {
            console.error("Error comparing jobs:", error);
            return 0;
        }
    }

    getSortLabel(): string {
        switch (this.sortBy) {
            case "pickup":
                return "Pickup Time";
            case "delivery":
                return "Delivery Time";
            default:
                return "Job ID";
        }
    }

    async onSortChange(order: string): Promise<void> {
        try {
            this.tableQuery.order = order;

            if (!this.drivers) return;

            // For card view
            this.drivers.forEach(driver => {
                driver.jobs.sort((a, b) => this.compareJobs(a, b));
            });

            // For table view
            this.tableJobs.sort((a, b) => this.compareJobs(a, b));
        } catch (error) {
            console.error("Error during sort:", error);
        }
    }

    formatRegionalTime(timestamp: string | Date): string {
        if (!timestamp) return "";

        const format = this.isUsCustomer ? "MM/DD HH:mm" : "DD/MM HH:mm";

        // Get the formatted timezone using the filter
        const timezoneShort = this.$filter<(timezone: string) => string>('timezoneShort')(TimeZone);
        const timezoneDisplay = timezoneShort ? ` (${timezoneShort})` : '';

        return dayjs(timestamp).format(format) + timezoneDisplay;
    }

    getTimeSinceLastCompleted(lastCompletedTime: string): number {
        if (lastCompletedTime === "N/A") return 0;

        const lastCompleted = dayjs(lastCompletedTime, "HH:mm");
        const now = dayjs();
        const duration = dayjs.duration(dayjs(now).diff(lastCompleted));

        return Math.round(duration.asMinutes());
    }

    getStatusClass(status: string): string {
        const statusClasses: { [key: string]: string } = {
            'NEW': 'status-new',
            'DISPATCHED': 'status-dispatched',
            'ACCEPTED': 'status-accepted',
            'PICKEDUP': 'status-pickedup',
            'DELIVERED': 'status-delivered'
        };

        return statusClasses[status] || 'status-default';
    }

    onPaginate(page: number, limit: number) {
        this.tableQuery.page = page;
        this.tableQuery.limit = limit;
    }
}

export const openJobsComponent: angular.IComponentOptions = {
    template: require("./open-jobs.template.html"),
    controller: OpenJobsWidgetController,
    controllerAs: "ctrl"
}
