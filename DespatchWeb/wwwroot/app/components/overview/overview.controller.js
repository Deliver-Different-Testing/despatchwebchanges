/**
 * @class OverviewController
 * @description Controller for delivery overview page
 */
class OverviewController {
    constructor($mdDialog, materialSidenavService) {
        this.$mdDialog = $mdDialog;
        this.materialSidenavService = materialSidenavService;

        this.selected = [];
        this.query = {
            order: 'jobName',
            limit: 5,
            page: 1
        };

        this.dateRange = {
            start: null,
            end: null
        };

        this.activeTab = 0;
        this.tabs = ['Active', 'Inactive', 'Completed'];

        this.regions = [
            {name: 'West Coast', selected: false},
            {name: 'Midwest', selected: false}
        ];

        this.statistics = {
            active: 15,
            inactive: 3,
            completed: 28
        };

        this.deliveries = [
            {
                jobName: 'Cross-Country Delivery',
                status: 'on-track',
                completion: 75,
                pickup: 'New York, NY',
                delivery: 'Los Angeles, CA',
                driver: 'John Smith',
                region: 'West Coast'
            },
            {
                jobName: 'Regional Distribution',
                status: 'delayed',
                completion: 45,
                pickup: 'Chicago, IL',
                delivery: 'Detroit, MI',
                driver: 'Sarah Johnson',
                region: 'Midwest'
            }
        ];
    }

    toggleRegion(region) {
        region.selected = !region.selected;
        // Implement filtering logic here
    }

    toggleSidenav() {
        this.materialSidenavService.toggle();
    }

}

angular.module('uDispatch').controller('deliveryOverview', ['$mdDialog', 'materialSidenavService', ($mdDialog, materialSidenavService) => new OverviewController($mdDialog, materialSidenavService)]);
