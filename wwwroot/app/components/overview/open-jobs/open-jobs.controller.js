import app from "../../../app";

/**
 * Controller for the Open Jobs Widget component.
 * Manages the display and sorting of open delivery jobs grouped by driver.
 */
class OpenJobsWidgetController {
    static $inject = ["overviewService", "moment", "APP_CONFIG", "overviewFiltersService"];

    constructor(overviewService, moment, APP_CONFIG, overviewFiltersService) {
        this.overviewService = overviewService;
        this.moment = moment;
        this.overviewFiltersService = overviewFiltersService;

        // Initialize properties
        /** @type {boolean} */
        this.isUsCustomer = APP_CONFIG.US_Customer;
        /** @type {DriverViewModel[]} */
        this.drivers = [];
        /** @type {'jobId'|'pickup'|'delivery'} */
        this.sortBy = "jobId";

        // Bind methods
        this.loadOpenJobs = this.loadOpenJobs.bind(this);
        this.onSortChange = this.onSortChange.bind(this);
        this.formatTime = this.formatTime.bind(this);
        this.compareJobs = this.compareJobs.bind(this);
        this.toggleCard = this.toggleCard.bind(this);

        // Subscribe to filter changes
        this.overviewFiltersService.onFilterChange(() => this.loadOpenJobs());

        // Initial load
        this.loadOpenJobs();
        this.loadCardState();

        // Refresh data every minute
        setInterval(this.loadOpenJobs, 60000);
    }

    /**
     * @returns {Promise<void>}
     */
    async loadCardState() {
        this.isCardCollapsed = this.overviewService.loadCollapseState("openJobs");
    }

    /**
     * @returns {Promise<void>}
     */
    async toggleCard() {
        this.isCardCollapsed = !this.isCardCollapsed;
        await this.overviewService.saveCollapseState("openJobs", this.isCardCollapsed);
    }

    /**
     * @returns {Promise<void>}
     */
    async loadOpenJobs() {
        try {
            /** @type {OverviewQueryParams} */
            const params = {
                limit: 0,
                page: 0,
                statusGroup: 0,
                startDate: this.overviewFiltersService.dateRange?.start,
                endDate: this.overviewFiltersService.dateRange?.end,
                regions: this.overviewFiltersService.selectedRegions,
                speeds: this.overviewFiltersService.selectedSpeeds
            };


            /** @type {OpenJobResponse[]} */
            const jobs = await this.overviewService.getOpenJobs(params);

            // Group jobs by driver
            /** @type {Object.<string, DriverViewModel>} */
            const groupedJobs = {};

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

                /** @type {ViewJob} */
                const viewJob = {
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
        } catch (error) {
            console.error("Error loading open jobs:", error);
        }
    }

    /**
     * @param {Date} timestamp
     * @returns {string}
     */
    formatTime(timestamp) {
        return this.moment(timestamp).format("HH:mm");
    }

    /**
     * @param {ViewJob} a
     * @param {ViewJob} b
     * @returns {number}
     */
    compareJobs(a, b) {
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

    /**
     * @returns {string}
     */
    getSortLabel() {
        switch (this.sortBy) {
            case "pickup":
                return "Pickup Time";
            case "delivery":
                return "Delivery Time";
            default:
                return "Job ID";
        }
    }

    /**
     * @returns {Promise<void>}
     */
    async onSortChange() {
        try {
            this.drivers.forEach(driver => {
                driver.jobs.sort(this.compareJobs);
            });
        } catch (error) {
            console.error("Error during sort:", error);
        }
    }

    /**
     * @param {string|Date} timestamp
     * @returns {string}
     */
    formatRegionalTime(timestamp) {
        if (!timestamp) return "";

        const format = this.isUsCustomer ? "MM/DD HH:mm" : "DD/MM HH:mm";
        return this.moment(timestamp).format(format);
    }

    /**
     * @param {string} lastCompletedTime
     * @returns {number}
     */
    getTimeSinceLastCompleted(lastCompletedTime) {
        if (lastCompletedTime === "N/A") return "";

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
