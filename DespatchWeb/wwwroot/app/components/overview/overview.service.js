class OverviewService {
    constructor($http) {
        this._http = $http;
    }

    /**
     * Get paginated jobs with optional status group filter
     * @param {number} statusGroup - The status group enum value (1: Active, 2: Inactive, 3: Completed)
     * @param {number} page - Current page number (1-based)
     * @param {number} limit - Number of items per page
     * @returns {Promise<Object>} Object containing jobs array and pagination metadata
     */
    async getAllJobs(statusGroup, page = 1, limit = 20) {
        const response = await this._http.get('/overview', {
            params: {
                statusGroup: statusGroup,
                page: page,
                limit: limit
            }
        });

        return {
            items: response.data.items || [],
            total: response.data.total || 0,
            page: response.data.page || page,
            pages: response.data.pages || Math.ceil((response.data.total || 0) / limit)
        };
    }


    /**
     * Get all available regions
     * @returns {Promise<Array>} Array of region objects
     */
    async getAllRegions() {
        const response = await this._http.get('/overview/GetAllRegions');
        return response.data;
    }

    async getStats() {
        const response = await this._http.get('/overview/GetStats');
        return response.data;
    }
}

angular.module('uDispatch').service('overviewService', ['$http', $http => new OverviewService($http)]);
