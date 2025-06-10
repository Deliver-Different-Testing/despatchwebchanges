import {Suggestion} from "../../../interfaces/job.interface";
import {Dayjs} from "dayjs";

class OverviewFiltersService implements angular.IServiceProvider {
    selectedRegions: Suggestion[];
    selectedSpeeds: Suggestion[];
    dateRange: { start: Dayjs | null, end: Dayjs | null };
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
        dateRange?: { start: Dayjs | null, end: Dayjs | null }
    }): void {
        Object.assign(this, filters);
        this.filterChangeCallbacks.forEach(callback => callback());
    }
}

export default OverviewFiltersService;
