/**
 * @class OverviewController
 * @description Controller for delivery overview page
 */
class OverviewController {
    constructor($mdDialog, materialSidenavService, overviewService, versionUrl, $document, $scope, $timeout) {
        this.$mdDialog = $mdDialog;
        this.materialSidenavService = materialSidenavService;
        this.overviewService = overviewService;
        this.versionUrl = versionUrl;
        this.$document = $document;
        this.$timeout = $timeout;

        this.selected = [];
        this.query = {
            order: 'jobName',
            total: 0,
            pages: 0,
            limit: 20
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
            start: null,
            end: null
        };

        this.activeTab = 0;
        this.tabs = ['Active', 'Inactive', 'Completed'];

        // Watch for tab changes
        $scope.$watch(() => this.activeTab, async (newValue, oldValue) => {
            if (newValue !== oldValue) {
                console.log('Tab changed to:', newValue + 1);
                await this.refreshData();
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
     * Refresh data with loading state and filters
     */
    async refreshData() {
        try {
            const statusGroup = this.getStatusGroup();

            // Set promise to trigger loading state in md-table
            this.promise = this.overviewService.getAllJobs({
                statusGroup,
                page: this.query.page,
                limit: this.query.limit,
                search: this.search,
                startDate: this.dateRange.start,
                endDate: this.dateRange.end
            });

            const response = await this.promise;

            // Update the deliveries and query metadata
            this.deliveries = response.items;
            this.query.total = response.total;
            this.query.pages = response.pages;

        } catch (error) {
            console.error('Error loading deliveries:', error);
            const dialog = this.$mdDialog.alert()
                .title('Error')
                .textContent('Failed to load deliveries. Please try again.')
                .ok('OK');
            await this.$mdDialog.show(dialog);
        }
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
     * @param {number} completion
     */
    getProgressClass(completion) {
        if (completion < 34) {
            return 'md-warn';
        } else if (completion < 67) {
            return 'md-accent';
        }
        return 'md-primary';
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
}

angular.module('uDispatch').controller('deliveryOverview', [
    '$mdDialog',
    'materialSidenavService',
    'overviewService',
    'versionUrl',
    '$document',
    '$scope',
    '$timeout',
    ($mdDialog, materialSidenavService, overviewService, versionUrl, $document, $scope, $timeout) =>
        new OverviewController($mdDialog, materialSidenavService, overviewService, versionUrl, $document, $scope, $timeout)
]);
