/**
 * @class OverviewController
 * @description Controller for delivery overview page
 */
class OverviewController {
    constructor($mdDialog, materialSidenavService, overviewService, versionUrl, $document, $scope, $timeout, toastrService, moment) {
        this.$mdDialog = $mdDialog;
        this.materialSidenavService = materialSidenavService;
        this.overviewService = overviewService;
        this.versionUrl = versionUrl;
        this.$document = $document;
        this.$timeout = $timeout;
        this.toastrService = toastrService;
        this.moment = moment;

        this.statistics = {
            active: 0,
            inactive: 0,
            completed: 0
        };

        this.selected = [];
        this.query = {
            order: 'jobName',    // Default sort field
            direction: 'asc',    // Default sort direction
            page: 1,            // Current page
            limit: 20,          // Items per page
            total: 0,           // Total items
        };

        // Loaders
        this.regionsLoading = false;
        this.speedsLoading = false;

        // Initialize data containers
        this.deliveries = [];
        this.regions = [];
        this.speeds = [];
        this.promise = null;

        // Search properties
        this.search = '';
        this.searchTimeout = null;
        this.isSearching = false;

        this.dateRange = {
            start: null, end: null
        };

        this.activeTab = 0;

        // Bind class methods to maintain 'this' context
        this.setTab = this.setTab.bind(this);
        this.getStatusLabel = this.getStatusLabel.bind(this);
        this.getStatusIcon = this.getStatusIcon.bind(this);
        this.onReorder = this.onReorder.bind(this);
        this.onPaginate = this.onPaginate.bind(this);
        this.refreshData = this.refreshData.bind(this);
        this.handleSearchChange = this.handleSearchChange.bind(this);
        this.showDateRangeDialog = this.showDateRangeDialog.bind(this);
        this.clearDateRange = this.clearDateRange.bind(this);

        // Initialize data and set up watchers
        this.initializeData($scope);
    }

    /**
     * Initialize data and set up watchers
     * @param {object} $scope Angular scope object
     */
    initializeData($scope) {
        // Watch for tab changes
        $scope.$watch(() => this.activeTab, (newValue, oldValue) => {
            if (newValue !== oldValue) {
                this.refreshData();
            }
        });

        // Watch for search changes with debounce
        $scope.$watch(() => this.search, (newValue, oldValue) => {
            if (newValue !== oldValue) {
                this.handleSearchChange();
            }
        });

        // Initial data load
        Promise.all([
            this.loadStats(),
            this.getRegions(),
            this.getSpeeds(),
            this.refreshData()
        ])
            .then(() => {
                console.log('All data loaded successfully');
            })
            .catch(error => {
                console.error('Error loading data:', error);
            });
    }

    /**
     * Load statistics data
     */
    async loadStats() {
        try {
            const stats = await this.overviewService.getStats();
            this.statistics = {
                active: stats.active || 0,
                inactive: stats.inactive || 0,
                completed: stats.completed || 0
            };
        } catch (error) {
            console.error('Error loading statistics:', error);
            this.statistics = {active: 0, inactive: 0, completed: 0};
        }
    }

    /**
     * Set active tab and trigger refresh
     * @param {number} tabIndex The tab index to set active
     */
    async setTab(tabIndex) {
        if (this.activeTab !== tabIndex) {
            this.activeTab = tabIndex;
            await this.refreshData();
        }
    }

    /**
     * Get the status label for a tab
     * @param {number} tabIndex The tab index
     * @returns {string} The status label
     */
    getStatusLabel(tabIndex) {
        const labels = ['Active', 'Inactive', 'Completed'];
        return labels[tabIndex] || '';
    }

    /**
     * Get the status icon for a tab
     * @param {number} tabIndex The tab index
     * @returns {string} The material icon name
     */
    getStatusIcon(tabIndex) {
        const icons = ['cycle', 'pause_circle', 'task_alt'];
        return icons[tabIndex] || '';
    }

    /**
     * Get the value for a statistics tab
     * @param {number} tabIndex The tab index
     * @returns {number} The statistics value
     */
    getStatValue(tabIndex) {
        const statKeys = ['active', 'inactive', 'completed'];
        return this.statistics[statKeys[tabIndex]] || 0;
    }

    /**
     * Get status group based on active tab
     * @returns {number} status group enum value
     */
    getStatusGroup() {
        return this.activeTab + 1; // Maps to JobStatusGroup enum (1-based)
    }

    /**
     * Handle sort order change
     * @param {string} order The new sort order
     */
    async onReorder(order) {
        if (!this.query) {
            this.query = {};
        }

        this.query.order = order;
        this.query.page = 1;
        await this.refreshData();
    }

    /**
     * Handle search input changes with debounce
     */
    handleSearchChange() {
        // Cancel any pending timeout
        if (this.searchTimeout) {
            this.$timeout.cancel(this.searchTimeout);
        }

        // Set new timeout
        this.searchTimeout = this.$timeout(async () => {
            this.query.page = 1; // Reset to first page on new search
            await this.refreshData();
        }, 300); // 300ms debounce
    }

    /**
     * Handle pagination changes
     * @param {number} page
     * @param {number} limit
     */
    async onPaginate(page, limit) {
        if (!this.query) {
            this.query = {};
        }

        this.query.page = page;
        this.query.limit = limit;
        await this.refreshData();
    }

    async getRegions() {
        try {
            this.regionsLoading = true;
            this.regions = await this.overviewService.getAllRegions();
        } catch (error) {
            console.error('An error occured getting regions.');
        } finally {
            this.regionsLoading = false;
        }
    }

    toggleRegion(region) {
        region.selected = !region.selected;
    }

    async getSpeeds() {
        try {
            this.speedsLoading = true;
            this.speeds = await this.overviewService.getAllSpeeds();
        } catch (error) {
            console.error('An error occured getting speeds.');
        } finally {
            this.speedsLoading = false;
        }
    }

    toggleSpeed(speed) {
        speed.selected = !speed.selected;
    }

    toggleSidenav() {
        this.materialSidenavService.toggle();
    }

    /**
     * Transform raw status to valid CSS class
     * @param {string} status
     * @returns {string}
     */
    transformStatus(status) {
        // Remove spaces and special characters, convert to uppercase
        return status.toUpperCase().replace(/[\s-]/g, '_');
    }

    /**
     * Get progress bar class based on completion percentage
     * @param {number} completion
     * @returns {string} md-class for progress bar
     */
    getProgressClass(completion) {
        if (completion < 30) {
            return 'md-warn';      // Red for low progress
        } else if (completion < 70) {
            return 'md-accent';    // Blue for medium progress
        }
        return 'md-primary';       // Green for high progress
    }

    async showDateRangeDialog($event) {
        try {
            this.dateRange = await this.$mdDialog.show({
                controller: 'DateRangeDialogController',
                controllerAs: 'ctrl',
                targetEvent: $event,
                templateUrl: this.versionUrl('app/components/dialogs/date-range-dialog/date-range-dialog.html'),
                parent: angular.element(this.$document.body),
                clickOutsideToClose: true,
                fullscreen: false,
                bindToController: true,
                locals: {
                    dateRange: this.dateRange
                }
            });
            await this.refreshData();
        } catch (error) {
            // Dialog was cancelled
            if (error !== undefined) {
                console.error('Error selecting date range:', error);
            }
        }
    }

    /**
     * Check if date filter is active
     * @returns {boolean}
     */
    hasDateFilter() {
        return this.dateRange.start !== null || this.dateRange.end !== null;
    }

    /**
     * Get formatted date range display
     * @returns {string}
     */
    getDateRangeDisplay() {
        if (!this.hasDateFilter()) return '';

        if (this.dateRange.start && this.dateRange.end) {
            return `${this.formatDate(this.dateRange.start)} - ${this.formatDate(this.dateRange.end)}`;
        } else if (this.dateRange.start) {
            return `From ${this.formatDate(this.dateRange.start)}`;
        } else {
            return `Until ${this.formatDate(this.dateRange.end)}`;
        }
    }

    /**
     * Format date for display
     * @param {Date} date
     * @returns {string}
     */
    formatDate(date) {
        return date ? this.moment(date).format('MMM D, YYYY') : '';
    }

    /**
     * Clear date range filter
     * @param {Event} $event
     */
    async clearDateRange($event) {
        if ($event) {
            $event.stopPropagation();
        }

        this.dateRange = {
            start: null, end: null
        };

        await this.refreshData();
    }

    async exportJobs() {
        // Show feature in development dialog
        await this.$mdDialog.show({
            controller: 'FeatureInDevelopmentDialogController',
            controllerAs: 'ctrl',
            templateUrl: this.versionUrl('app/components/dialogs/feature-in-development-dialog/feature-in-development-dialog.html'),
            parent: angular.element(this.$document.body),
            clickOutsideToClose: true,
            bindToController: true
        });
    }

    async showMap(delivery) {
        // Show feature in development dialog
        await this.$mdDialog.show({
            controller: 'MapDialogController',
            controllerAs: 'ctrl',
            templateUrl: this.versionUrl('app/components/dialogs/map-dialog/map-dialog.html'),
            parent: angular.element(this.$document.body),
            clickOutsideToClose: true,
            fullscreen: true,
            locals: {
                delivery
            },
            bindToController: true
        });
    }

    /**
     * Refresh data when tab changes
     */
    async refreshData() {
        try {
            const statusGroup = this.getStatusGroup();

            // Show loading state
            this.isLoading = true;

            // Parse sort order
            let orderBy = this.query.order || 'jobName';
            let orderDirection = 'asc';

            if (orderBy.startsWith('-')) {
                orderBy = orderBy.substring(1);
                orderDirection = 'desc';
            }

            // Set promise to trigger loading state in md-table
            this.promise = this.overviewService.getAllJobs({
                statusGroup,
                page: this.query.page || 1,
                limit: this.query.limit || 20,
                search: this.search,
                startDate: this.dateRange.start,
                endDate: this.dateRange.end,
                orderBy,
                orderDirection
            });

            const response = await this.promise;

            // Transform status for each delivery and child job
            this.deliveries = response.items.map(delivery => ({
                ...delivery,
                status: this.transformStatus(delivery.status),
                childJobs: Array.isArray(delivery.childJobs) ? delivery.childJobs.map(childJob => ({
                    ...childJob,
                    status: this.transformStatus(childJob.status)
                })) : []
            }));

            // Update query metadata
            this.query.total = response.total;

            // Refresh statistics after data load
            await this.loadStats();
        } catch (error) {
            console.error('Error loading deliveries:', error);
            this.toastrService.showErrorToast("An unexpected error occurred. Please try again.");
        } finally {
            this.isLoading = false;
        }
    }
}

angular.module('uDispatch').controller('deliveryOverview', ['$mdDialog', 'materialSidenavService', 'overviewService', 'versionUrl', '$document', '$scope', '$timeout', 'toastrService', 'moment', ($mdDialog, materialSidenavService, overviewService, versionUrl, $document, $scope, $timeout, toastrService, moment) => new OverviewController($mdDialog, materialSidenavService, overviewService, versionUrl, $document, $scope, $timeout, toastrService, moment)]);
