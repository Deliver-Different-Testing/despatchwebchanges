class OverviewService {
    constructor($http) {
        this._http = $http;
    }

    /**
     * Get all jobs with optional status group filter
     * @param {number} statusGroup - The status group enum value (1: Active, 2: Inactive, 3: Completed)
     * @returns {Promise<Array>} Array of job objects
     */
    async getAllJobs(statusGroup) {
        const response = await this._http.get('/overview', {
            params: {
                statusGroup: statusGroup
            }
        });
        return response.data;
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
