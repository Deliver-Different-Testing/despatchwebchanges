/**
 * @class OverviewController
 * @description Controller for delivery overview page
 */
class OverviewController {
    constructor($mdDialog, materialSidenavService, overviewService, versionUrl, $document, $scope) {
        this.$mdDialog = $mdDialog;
        this.materialSidenavService = materialSidenavService;
        this.overviewService = overviewService;
        this.versionUrl = versionUrl;
        this.$document = $document;

        this.selected = [];
        this.query = {
            order: 'jobName',
            limit: 20,
            page: 1
        };

        // Loaders
        this.regionsLoading = false;

        // Initialize data containers
        this.deliveries = [];
        this.filteredData = [];
        this.regions = [];
        this.promise = null;
        this.search = '';

        this.dateRange = {
            start: null,
            end: null
        };

        this.activeTab = 0;
        this.tabs = ['Active', 'Inactive', 'Completed'];


        // Watch for tab changes
        $scope.$watch(() => this.activeTab, (newValue, oldValue) => {
            if (newValue !== oldValue) {
                console.log('Tab changed to:', newValue + 1);
                this.refreshData();
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
     * Refresh data with loading state and status filter
     */
    async refreshData() {
        try {
            const statusGroup = this.getStatusGroup();
            console.log('Fetching jobs for status group:', statusGroup);

            // Set promise to trigger loading state in md-table
            this.promise = this.overviewService.getAllJobs(statusGroup);
            this.deliveries = await this.promise;

            // Reset page to 1 when switching tabs
            this.query.page = 1;

            // Set filtered data to all deliveries
            this.filteredData = [...this.deliveries];

            return this.filteredData;
        } catch (error) {
            console.error('Error loading deliveries:', error);
            const dialog = this.$mdDialog.alert()
                .title('Error')
                .textContent('Failed to load deliveries. Please try again.')
                .ok('OK');
            await this.$mdDialog.show(dialog);
            return [];
        }
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

    /**
     * Handle pagination changes
     * @param {number} page
     * @param {number} limit
     */
    onPaginate(page, limit) {
        this.query.page = page;
        this.query.limit = limit;
    }

    toggleRegion(region) {
        region.selected = !region.selected;
    }

    toggleSidenav() {
        this.materialSidenavService.toggle();
    }

    getProgressClass(completion) {
        if (completion < 34) {
            return 'md-warn';
        } else if (completion < 67) {
            return 'md-accent';
        }
        return 'md-primary';
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
    ($mdDialog, materialSidenavService, overviewService, versionUrl, $document, $scope) =>
        new OverviewController($mdDialog, materialSidenavService, overviewService, versionUrl, $document, $scope)
]);
