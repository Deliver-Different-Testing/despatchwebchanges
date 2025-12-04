import OverviewService from "../overview.service";
import OverviewFiltersService from "../services/overview-filters.service";
import {DriverViewModel, IOpenJobResponse, OverviewQueryParams, ViewJob} from "../overview.interfaces";
import BaseController from "../../base-controller";
import dayjs from "dayjs";
import duration from 'dayjs/plugin/duration';
import {formatMins} from "../../../functions/formatDates";

class OpenJobsWidgetController extends BaseController {
    static $inject = [
        "overviewService",
        "overviewFiltersService",
        "$scope",
        "$timeout",
        "$interval",
    ];

    private static readonly OpenJobsViewModeKey = `openJobsViewMode_${ContactID}`;
    private static readonly LimitNameKey = `openJobsTableViewLimit${ContactID}`;
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
        private overviewService: OverviewService,
        private overviewFiltersService: OverviewFiltersService,
        $scope: angular.IScope,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
    ) {
        super();
        this.initServices($timeout, $interval, $scope)

        dayjs.extend(duration);

        this.sortBy = "jobId";

        this.watchScope(
            () => this.tableQuery.limit,
            (newValue: number, oldValue: number) => {
                if (newValue !== oldValue) {
                    if (Modernizr.localstorage) {
                        localStorage.setItem(OpenJobsWidgetController.LimitNameKey, `${this.tableQuery.limit}`);
                    }
                }
            }
        );
    }

    $onInit(): void {
        // Subscribe to filter changes
        this.overviewFiltersService.onFilterChange(() => this.loadOpenJobs());

        this.loadSavedLimit();
        this.loadOpenJobs();
        this.loadCardState();
        this.loadViewModeState();

        this.registerInterval(this.loadOpenJobs, 60000);
    }

    private loadSavedLimit() {
        const savedLimit = localStorage.getItem(OpenJobsWidgetController.LimitNameKey);
        console.log(`Saved limit is: ${savedLimit}`);
        if (savedLimit) {
            this.tableQuery.limit = parseInt(savedLimit);
        }
    }

    private loadOpenJobs() {
        const params: Pick<OverviewQueryParams, "startDate" | "endDate" | "regions" | "speeds" | "couriers"> = {
            startDate: this.overviewFiltersService.dateRange?.start || undefined,
            endDate: this.overviewFiltersService.dateRange?.end || undefined,
            regions: this.overviewFiltersService.selectedRegions?.map(region => region.id) || undefined,
            speeds: this.overviewFiltersService.selectedSpeeds?.map(speed => speed.id) || undefined,
            couriers: this.overviewFiltersService.selectedCouriers?.map(courier => courier.id) || undefined
        };
        
        this.overviewService.getOpenJobs(params)
            .then((jobs: IOpenJobResponse[]) => {
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
                               formatMins(job.lastCompleted) : "N/A",
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
                    this.tableJobs.push(viewJob); // Add to a flat list for table view
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
        const savedViewMode = localStorage.getItem(OpenJobsWidgetController.OpenJobsViewModeKey);
        if (savedViewMode === 'table') {
            this.isTableView = true;
        }
    }

    toggleViewMode() {
        localStorage.setItem(OpenJobsWidgetController.OpenJobsViewModeKey, this.isTableView ? 'table' : 'card');
    }

    async toggleCard(): Promise<void> {
        this.isCardCollapsed = !this.isCardCollapsed;
        await this.overviewService.saveCollapseState("openJobs", this.isCardCollapsed);
    }
    
    compareJobs(a: ViewJob, b: ViewJob): number {
        try {
            const order = this.tableQuery.order;
            const isDesc = order.charAt(0) === '-';
            const field = isDesc ? order.substring(1) : order;

            let comparison: number;

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

    getTimeSinceLastCompleted(lastCompletedTime: string): number {
        if (lastCompletedTime === "N/A") return 0;

        const lastCompleted = dayjs(lastCompletedTime, "HH:mm");
        const now = dayjs().tz(TimeZone);
        const duration = dayjs.duration(now.diff(lastCompleted));

        return Math.round(duration.asMinutes());
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
