import app from "../../../app";

class OverviewFiltersService implements angular.IServiceProvider {
    selectedRegions: Array<{ id: number }>;
    selectedSpeeds: Array<{ id: number }>;
    dateRange: { start: Date | null, end: Date | null };
    filterChangeCallbacks: Array<() => void>;

    constructor() {
        this.selectedRegions = [];
        this.selectedSpeeds = [];

        this.dateRange = {
            start: null,
            end: null
        };

        this.filterChangeCallbacks = [];
    }

    $get(): any {
        return this;
    }

    onFilterChange(callback: () => void): void {
        this.filterChangeCallbacks.push(callback);
    }

    updateFilters(filters: {
        selectedRegions?: Array<{ id: number }>,
        selectedSpeeds?: Array<{ id: number }>,
        dateRange?: { start: Date | null, end: Date | null }
    }): void {
        Object.assign(this, filters);
        this.filterChangeCallbacks.forEach(callback => callback());
    }
}

export default OverviewFiltersService;
