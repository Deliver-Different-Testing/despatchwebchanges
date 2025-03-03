import app from "../../../app";
import OverviewService from "../overview.service";
import OverviewFiltersService from "../services/overview-filters.service";
import {AppConfig} from "../../../interfaces/app-config.interface";
import {DriverViewModel, OpenJobResponse, OverviewQueryParams, ViewJob} from "../overview.interfaces";

class OpenJobsWidgetController implements angular.IController {
    static $inject = ["overviewService", "moment", "APP_CONFIG", "overviewFiltersService"];

    private readonly isUsCustomer: boolean;
    private readonly sortBy: string;

    private isCardCollapsed?: boolean;
    private drivers?: DriverViewModel[];

    constructor(private overviewService: OverviewService,
                private moment: any,
                APP_CONFIG: AppConfig,
                private overviewFiltersService: OverviewFiltersService) {
        this.isUsCustomer = APP_CONFIG.US_Customer;
        this.sortBy = "jobId";

        // Bind methods
        this.loadOpenJobs = this.loadOpenJobs.bind(this);
        this.onSortChange = this.onSortChange.bind(this);
        this.formatTime = this.formatTime.bind(this);
        this.compareJobs = this.compareJobs.bind(this);
        this.toggleCard = this.toggleCard.bind(this);
    }

    $onInit() {
        // Subscribe to filter changes
        this.overviewFiltersService.onFilterChange(() => this.loadOpenJobs());

        this.loadOpenJobs();
        this.loadCardState();

        setInterval(this.loadOpenJobs, 60000);
    }

    loadOpenJobs(): void {
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

                jobs.forEach(job => {
                    if (!groupedJobs[job.driverName]) {
                        groupedJobs[job.driverName] = {
                            name: job.driverName,
                            jobs: [],
                            completedToday: job.completedToday,
                            lastCompleted: job.lastCompleted ?
                                this.formatTime(job.lastCompleted) : "N/A",
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
                        mileage: job.mileage
                    };

                    groupedJobs[job.driverName].jobs.push(viewJob);
                });

                // Convert to array and sort jobs within each driver group
                this.drivers = Object.values(groupedJobs).map(driver => {
                    driver.jobs.sort(this.compareJobs);
                    return driver;
                });
            })
            .catch(error => {
                console.error("Error loading open jobs:", error);
            });
    }

    loadCardState(): void {
        this.isCardCollapsed = this.overviewService.loadCollapseState("openJobs");
    }

    async toggleCard(): Promise<void> {
        this.isCardCollapsed = !this.isCardCollapsed;
        await this.overviewService.saveCollapseState("openJobs", this.isCardCollapsed);
    }

    formatTime(timestamp: Date): string {
        return this.moment(timestamp).format("HH:mm");
    }

    compareJobs(a: ViewJob, b: ViewJob): number {
        try {
            switch (this.sortBy) {
                case "pickup":
                    return this.moment(a.pickup.time).valueOf() -
                        this.moment(b.pickup.time).valueOf();
                case "delivery":
                    return this.moment(a.delivery.time).valueOf() -
                        this.moment(b.delivery.time).valueOf();
                case "jobId":
                default:
                    // jobId is a number from backend
                    return a.jobId - b.jobId;
            }
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

    async onSortChange(): Promise<void> {
        try {
            if(!this.drivers) return;

            this.drivers.forEach(driver => {
                driver.jobs.sort(this.compareJobs);
            });
        } catch (error) {
            console.error("Error during sort:", error);
        }
    }

    formatRegionalTime(timestamp: string | Date): string {
        if (!timestamp) return "";

        const format = this.isUsCustomer ? "MM/DD HH:mm" : "DD/MM HH:mm";
        return this.moment(timestamp).format(format);
    }

    getTimeSinceLastCompleted(lastCompletedTime: string): number {
        if (lastCompletedTime === "N/A") return 0;

        const lastCompleted = this.moment(lastCompletedTime, "HH:mm");
        const now = this.moment();
        const duration = this.moment.duration(now.diff(lastCompleted));

        return Math.round(duration.asMinutes());
    }
}

app.component("openJobsWidget", {
    templateUrl: "app/components/overview/open-jobs/open-jobs.template.html",
    controller: OpenJobsWidgetController,
    controllerAs: "ctrl"
});
