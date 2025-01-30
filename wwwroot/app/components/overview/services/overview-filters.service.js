class OverviewFiltersService {
    constructor() {
        this.selectedRegions = [];
        this.selectedSpeeds = [];
        this.dateRange = {
            start: null,
            end: null
        };
        this.filterChangeCallbacks = [];
    }

    onFilterChange(callback) {
        this.filterChangeCallbacks.push(callback);
    }

    updateFilters(filters) {
        Object.assign(this, filters);
        this.filterChangeCallbacks.forEach(callback => callback());
    }
}

angular.module('uDispatch').service('overviewFiltersService', OverviewFiltersService);
