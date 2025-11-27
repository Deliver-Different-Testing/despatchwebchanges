import {ISuggestion} from "../../../interfaces/job.interface";
import {IOverViewDateSearchRange} from "../overview.interfaces";

class OverviewFiltersService implements angular.IServiceProvider {
    selectedRegions: ISuggestion[];
    selectedSpeeds: ISuggestion[];
    selectedCouriers: ISuggestion[];
    dateRange: IOverViewDateSearchRange;
    filterChangeCallbacks: Array<() => void>;

    constructor() {
        this.selectedRegions = [];
        this.selectedSpeeds = [];
        this.selectedCouriers = [];

        this.dateRange = {};
        this.filterChangeCallbacks = [];
    }

    $get(): any {
        return this;
    }

    onFilterChange(callback: () => void): void {
        this.filterChangeCallbacks.push(callback);
    }

    updateFilters(filters: {
        selectedRegions?: ISuggestion[],
        selectedSpeeds?: ISuggestion[],
        selectedCouriers?: ISuggestion[],
        dateRange?: IOverViewDateSearchRange,
    }): void {
        Object.assign(this, filters);
        this.filterChangeCallbacks.forEach(callback => callback());
    }
}

export default OverviewFiltersService;