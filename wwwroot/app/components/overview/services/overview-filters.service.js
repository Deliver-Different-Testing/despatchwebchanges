import app from "../../../app";

/**
 * @typedef {Object} Region
 * @property {number} id
 */

/**
 * @typedef {Object} Speed
 * @property {number} id
 */

/**
 * @typedef {Object} DateRange
 * @property {Date|null} start
 * @property {Date|null} end
 */

/**
 * Service for managing overview filters
 */
class OverviewFiltersService {
    constructor() {
        /** @type {Array<Region>} */
        this.selectedRegions = [];

        /** @type {Array<Speed>} */
        this.selectedSpeeds = [];

        /** @type {DateRange} */
        this.dateRange = {
            start: null,
            end: null
        };

        /** @type {Array<Function>} */
        this.filterChangeCallbacks = [];
    }

    /**
     * Register a callback to be called when filters change
     * @param {Function} callback - Function to be called when filters change
     */
    onFilterChange(callback) {
        this.filterChangeCallbacks.push(callback);
    }

    /**
     * Update filters and trigger callbacks
     * @param {Object} filters - Object containing filter updates
     * @param {Array<Region>} [filters.selectedRegions] - Selected regions
     * @param {Array<Speed>} [filters.selectedSpeeds] - Selected speeds
     * @param {DateRange} [filters.dateRange] - Date range
     */
    updateFilters(filters) {
        Object.assign(this, filters);
        this.filterChangeCallbacks.forEach(callback => callback());
    }
}

app.service("overviewFiltersService", OverviewFiltersService);
