/**
 * @class OverviewController
 * @description Controller for delivery overview page
 */
class OverviewController {
    constructor($mdDialog, materialSidenavService, overviewService, versionUrl, $document) {
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
    onTabSelected(tabIndex) {
        console.log('Tab selected:', tabIndex + 1); // Debug log
        this.activeTab = tabIndex;
        this.refreshData();
    }

    /**
     * Refresh data with loading state and status filter
     */
    async refreshData() {
        try {
            const statusGroup = this.getStatusGroup();
            console.log('Fetching jobs for status group:', statusGroup); // Debug log

            // Set promise to trigger loading state in md-table
            this.promise = this.overviewService.getAllJobs(statusGroup);

            this.deliveries = await this.promise;
            this.updateTable();

            return this.filteredData;
        } catch (error) {
            console.error('Error loading deliveries:', error);
            this.$mdDialog.show(
                this.$mdDialog.alert()
                    .title('Error')
                    .textContent('Failed to load deliveries. Please try again.')
                    .ok('OK')
            );
            return [];
        }
    }

    /**
     * Update table with current filters and pagination
     */
    updateTable() {
        // Apply search filter if exists
        this.filteredData = this.search ?
            this.deliveries.filter(delivery =>
                delivery.jobName.toLowerCase().includes(this.search.toLowerCase())
            ) :
            [...this.deliveries];

        // Apply sorting
        if (this.query.order) {
            const reverse = this.query.order.startsWith('-');
            const orderBy = reverse ? this.query.order.slice(1) : this.query.order;
            this.filteredData.sort((a, b) => {
                const aVal = a[orderBy] || '';
                const bVal = b[orderBy] || '';
                return reverse ?
                    bVal.localeCompare(aVal) :
                    aVal.localeCompare(bVal);
            });
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
        this.updateTable();
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

angular.module('uDispatch').controller('deliveryOverview', ['$mdDialog', 'materialSidenavService', 'overviewService', 'versionUrl', '$document', ($mdDialog, materialSidenavService, overviewService, versionUrl, $document) => new OverviewController($mdDialog, materialSidenavService, overviewService, versionUrl, $document)]);
