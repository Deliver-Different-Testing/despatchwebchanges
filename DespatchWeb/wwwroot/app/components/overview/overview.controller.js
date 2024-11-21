/**
 * @class OverviewController
 * @description Controller for delivery overview page
 */
class OverviewController {
    constructor($mdDialog, materialSidenavService, overviewService, versionUrl, $document, toastrService) {
        this.$mdDialog = $mdDialog;
        this.materialSidenavService = materialSidenavService;
        this.overviewService = overviewService;
        this.versionUrl = versionUrl;
        this.$document = $document;
        this.toastrService = toastrService;

        this.selected = [];
        this.query = {
            order: 'jobName',  // default ordering
            limit: 20,
            page: 1,
            search: '',
            regions: []
        };

        // Loaders
        this.regionsLoading = false;

        // Initialize data containers
        this.deliveries = [];
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
        this.loadStats().then(r => console.log('Load stats completed'));
        this.refreshData().then(r => console.log('Refresh data completed'));
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
        // Reset pagination when changing tabs
        this.query.page = 1;
        await this.refreshData();
    }

    /**
     * Handle order change from md-table
     * @param {string} order - The order string from md-table
     */
    async onReorder(order) {
        if (!order) return;  // Don't proceed if order is undefined

        this.query.order = order;
        await this.refreshData();
    }

    /**
     * Refresh data with loading state and status filter
     */
    async refreshData() {
        try {
            const statusGroup = this.getStatusGroup();
            console.log('Fetching jobs for status group:', statusGroup);

            const params = {
                statusGroup,
                page: this.query.page,
                limit: this.query.limit,
                order: this.query.order,
                search: this.query.search,
                regions: this.query.regions,
                dateStart: this.dateRange.start,
                dateEnd: this.dateRange.end
            };

            // Set promise to trigger loading state in md-table
            this.promise = this.overviewService.getAllJobs(params);
            const response = await this.promise;

            // Assuming the API returns { data: [...], total: number }
            this.deliveries = response.data;
            this.totalItems = response.total;

            return this.deliveries;
        } catch (error) {
            console.error('Error loading deliveries:', error);
            this.toastrService.showErrorToast("An unexpected error occured loading deliveries");
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
     * @param {string} searchText
     */
    async onSearch(searchText) {
        this.query.search = searchText;
        this.query.page = 1; // Reset to first page when searching
        await this.refreshData();
    }

    /**
     * @param {number} page
     * @param {number} limit
     */
    async onPaginate(page, limit) {
        this.query.page = page;
        this.query.limit = limit;
        await this.refreshData();
    }

    /**
     * @param {string} order
     */
    async onOrderChange(order) {
        this.query.order = order;
        await this.refreshData();
    }

    async toggleRegion(region) {
        region.selected = !region.selected;
        this.query.regions = this.regions
            .filter(r => r.selected)
            .map(r => r.id);
        await this.refreshData();
    }

    /**
     * @param {Date} start
     * @param {Date} end
     */
    async onDateRangeChange(start, end) {
        this.dateRange.start = start;
        this.dateRange.end = end;
        await this.refreshData();
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
