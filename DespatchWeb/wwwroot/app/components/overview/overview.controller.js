/**
 * @class OverviewController
 * @description Controller for delivery overview page
 */
class OverviewController {
    constructor($mdDialog, materialSidenavService, overviewService, versionUrl, $document, $scope, $timeout, toastrService) {
        this.$mdDialog = $mdDialog;
        this.materialSidenavService = materialSidenavService;
        this.overviewService = overviewService;
        this.versionUrl = versionUrl;
        this.$document = $document;
        this.$timeout = $timeout;
        this.toastrService = toastrService;

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

        // Initialize data containers
        this.deliveries = [];
        this.regions = [];
        this.promise = null;

        // Search properties
        this.search = '';
        this.searchTimeout = null;
        this.isSearching = false;

        this.dateRange = {
            start: null, end: null
        };

        this.activeTab = 0;
        this.tabs = ['Active', 'Inactive', 'Completed'];

        // Bind class methods to maintain 'this' context
        this.onReorder = this.onReorder.bind(this);
        this.onPaginate = this.onPaginate.bind(this);
        this.refreshData = this.refreshData.bind(this);
        this.handleSearchChange = this.handleSearchChange.bind(this);
        this.showDateRangeDialog = this.showDateRangeDialog.bind(this);
        this.clearDateRange = this.clearDateRange.bind(this);

        // Watch for tab changes
        $scope.$watch(() => this.activeTab, (newValue, oldValue) => {
            if (newValue !== oldValue) {
                console.log('Tab changed to:', newValue + 1);
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
        this.loadStats();
        this.refreshData();
    }

    async loadStats() {
        try {
            this.statistics = await this.overviewService.getStats();
        } catch (error) {
            console.error('Error loading statistics:', error);
        }
    }

    /**
     * Get status group based on active tab
     * @returns {number} status group enum value
     */
    getStatusGroup() {
        return this.activeTab + 1; // Maps to JobStatusGroup enum (1-based)
    }

    /**
     * Handle tab selection
     * @param {number} tabIndex
     */
    async onTabSelected(tabIndex) {
        console.log('Tab selected:', tabIndex + 1);
        this.activeTab = tabIndex;
        await this.refreshData();
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
        return date ? moment(date).format('MMM D, YYYY') : '';
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

    async refreshData() {
        try {
            const statusGroup = this.getStatusGroup();

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
                    ...childJob, status: this.transformStatus(childJob.status)
                })) : []
            }));

            // Update query metadata
            this.query.total = response.total;
        } catch (error) {
            console.error('Error loading deliveries:', error);
            this.toastrService.showErrorToast("An unexpected error occurred. Please try again.");
        }
    }
}

angular.module('uDispatch').controller('deliveryOverview', ['$mdDialog', 'materialSidenavService', 'overviewService', 'versionUrl', '$document', '$scope', '$timeout', 'toastrService', ($mdDialog, materialSidenavService, overviewService, versionUrl, $document, $scope, $timeout, toastrService) => new OverviewController($mdDialog, materialSidenavService, overviewService, versionUrl, $document, $scope, $timeout, toastrService)]);
