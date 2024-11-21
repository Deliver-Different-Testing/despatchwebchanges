/**
 * Service for handling overview-related API requests
 */
class OverviewService {
    constructor($http) {
        this._http = $http;
    }

    /**
     * Get jobs with filtering, sorting, and pagination
     * @param {Object} params - Query parameters
     * @param {number} params.statusGroup - The status group enum value (1: Active, 2: Inactive, 3: Completed)
     * @param {number} params.page - Current page number (1-based)
     * @param {number} params.limit - Number of items per page
     * @param {string} params.order - Sort field and direction (e.g., 'jobName', '-jobName' for desc)
     * @param {string} [params.search] - Optional search term for filtering jobs
     * @param {string[]} [params.regions] - Optional array of region IDs to filter by
     * @param {Date} [params.dateStart] - Optional start date for filtering
     * @param {Date} [params.dateEnd] - Optional end date for filtering
     * @returns {Promise<{data: Array, total: number}>} Object containing jobs array and total count
     */
    async getAllJobs(params) {
        // Format dates for API if they exist
        const formattedParams = {
            ...params, dateStart: params.dateStart?.toISOString(), dateEnd: params.dateEnd?.toISOString()
        };

        const response = await this._http.get('/overview', {
            params: formattedParams
        });

        return {
            data: response.data.jobs, total: response.data.total
        };
    }

    /**
     * Get all available regions
     * @returns {Promise<Array<{id: string, name: string}>>} Array of region objects
     */
    async getAllRegions() {
        const response = await this._http.get('/overview/GetAllRegions');
        return response.data;
    }

    /**
     * Get overview statistics
     * @returns {Promise<{
     *   active: number,
     *   inactive: number,
     *   completed: number
     * }>} Statistics object containing counts for each status
     */
    async getStats() {
        const response = await this._http.get('/overview/GetStats');
        return response.data;
    }
}

angular.module('uDispatch').service('overviewService', ['$http', $http => new OverviewService($http)]);
