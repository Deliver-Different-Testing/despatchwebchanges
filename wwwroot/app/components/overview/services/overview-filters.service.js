"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
    $get() {
        return this;
    }
    onFilterChange(callback) {
        this.filterChangeCallbacks.push(callback);
    }
    updateFilters(filters) {
        Object.assign(this, filters);
        this.filterChangeCallbacks.forEach(callback => callback());
    }
}
exports.default = OverviewFiltersService;
