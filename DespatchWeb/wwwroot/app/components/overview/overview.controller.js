/**
 * @class OverviewController
 * @description Controller for delivery overview page
 */
class OverviewController {
    constructor($mdDialog, materialSidenavService, overviewService) {
        this.$mdDialog = $mdDialog;
        this.materialSidenavService = materialSidenavService;
        this.overviewService = overviewService;

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

        this.dateRange = {
            start: null,
            end: null
        };

        this.activeTab = 0;
        this.tabs = ['Active', 'Inactive', 'Completed'];


        this.statistics = {
            active: 15,
            inactive: 3,
            completed: 28
        };

        // Initial data load
        this.refreshData();
    }

    /**
     * Refresh data with loading state
     */
    refreshData() {
        // Set promise to trigger loading state in md-table
        this.promise = this.overviewService.getAllJobs()
            .then(data => {
                this.deliveries = data;
                this.updateTable();
                return this.deliveries;
            })
            .catch(error => {
                console.error('Error loading deliveries:', error);
                // Show error dialog
                this.$mdDialog.show(
                    this.$mdDialog.alert()
                        .title('Error')
                        .textContent('Failed to load deliveries. Please try again.')
                        .ok('OK')
                );
                return [];
            });
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
            this.deliveries;

        // Apply sorting
        if (this.query.order) {
            const reverse = this.query.order.startsWith('-');
            const orderBy = reverse ? this.query.order.slice(1) : this.query.order;
            this.filteredData = [...this.filteredData].sort((a, b) => {
                return reverse ?
                    b[orderBy].localeCompare(a[orderBy]) :
                    a[orderBy].localeCompare(b[orderBy]);
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
        // Implement filtering logic here
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
}

angular.module('uDispatch').controller('deliveryOverview', ['$mdDialog', 'materialSidenavService', 'overviewService', ($mdDialog, materialSidenavService, overviewService) => new OverviewController($mdDialog, materialSidenavService, overviewService)]);
