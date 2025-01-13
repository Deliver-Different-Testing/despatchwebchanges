/**
 * Controller for the Open Jobs Widget component.
 * Manages the display and sorting of open delivery jobs grouped by driver.
 */
class OpenJobsWidgetController {
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
        this.sortBy = 'jobId';

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
     * Loads the Open Jobs card's collapsed state from localStorage
     */
    async loadCardState() {
        this.isCardCollapsed = this.overviewService.loadCollapseState('openJobs');
    }

    /**
     * Toggles the Open Jobs card's collapsed state and saves it
     */
    async toggleCard() {
        this.isCardCollapsed = !this.isCardCollapsed;
        await this.overviewService.saveCollapseState('openJobs', this.isCardCollapsed);
    }

    /**
     * Loads and processes open jobs from the backend.
     * Groups jobs by driver and applies current sorting.
     * @returns {Promise<void>}
     */
    async loadOpenJobs() {
        try {
            const params = {
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
                            this.formatTime(job.lastCompleted) : 'N/A',
                        expanded: false
                    };
                }

                // Transform backend model to view model
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
            console.error('Error loading open jobs:', error);
        }
    }

    /**
     * Formats a timestamp into HH:mm format.
     * @param {Date} timestamp - The timestamp to format
     * @returns {string} Formatted time string
     */
    formatTime(timestamp) {
        return this.moment(timestamp).format('HH:mm');
    }

    /**
     * Compares two jobs for sorting based on the current sort criteria.
     * @param {ViewJob} a - First job to compare
     * @param {ViewJob} b - Second job to compare
     * @returns {number} Comparison result (-1, 0, or 1)
     */
    compareJobs(a, b) {
        try {
            switch (this.sortBy) {
                case 'pickup':
                    return this.moment(a.pickup.time).valueOf() -
                        this.moment(b.pickup.time).valueOf();
                case 'delivery':
                    return this.moment(a.delivery.time).valueOf() -
                        this.moment(b.delivery.time).valueOf();
                case 'jobId':
                default:
                    // jobId is a number from backend
                    return a.jobId - b.jobId;
            }
        } catch (error) {
            console.error('Error comparing jobs:', error);
            return 0;
        }
    }

    /**
     * Gets the display label for the current sort option
     * @returns {string} The formatted label for display
     */
    getSortLabel() {
        switch (this.sortBy) {
            case 'pickup':
                return 'Pickup Time';
            case 'delivery':
                return 'Delivery Time';
            default:
                return 'Job ID';
        }
    }

    /**
     * Handles changes to the sort criteria.
     * Re-sorts all jobs in each driver group.
     * @returns {Promise<void>}
     */
    async onSortChange() {
        try {
            this.drivers.forEach(driver => {
                driver.jobs.sort(this.compareJobs);
            });
        } catch (error) {
            console.error('Error during sort:', error);
        }
    }

    /**
     * Formats time display based on customer region preference
     * @param {string|Date} timestamp - The timestamp to format
     * @returns {string} Formatted time string in regional format
     */
    formatRegionalTime(timestamp) {
        if (!timestamp) return '';

        const format = this.isUsCustomer ? 'MM/DD HH:mm' : 'DD/MM HH:mm';
        return this.moment(timestamp).format(format);
    }

    /**
     * @param {string} lastCompletedTime
     * @returns {number}
     */
    getTimeSinceLastCompleted(lastCompletedTime) {
        if (lastCompletedTime === 'N/A') return '';

        const lastCompleted = this.moment(lastCompletedTime, 'HH:mm');
        const now = this.moment();
        const duration = this.moment.duration(now.diff(lastCompleted));

        return Math.round(duration.asMinutes());
    }
}

// Register the component
angular.module('uDispatch').component('openJobsWidget', {
    templateUrl: 'app/components/overview/open-jobs/open-jobs.template.html',
    controller: ['overviewService', 'moment', 'APP_CONFIG', 'overviewFiltersService',
        (overviewService, moment, APP_CONFIG, overviewFiltersService) =>
            new OpenJobsWidgetController(overviewService, moment, APP_CONFIG, overviewFiltersService)
    ],
    controllerAs: 'ctrl'
});
