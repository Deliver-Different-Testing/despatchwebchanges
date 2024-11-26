/**
 * @class OverviewService
 * @description Service to handle api calls for Overview dashboard
 */
class OverviewService {
    constructor($http) {
        this._http = $http;
    }

    /**
     * Get paginated jobs with filters and sorting
     * @param {Object} params - Query parameters
     * @param {number} params.statusGroup - The status group enum value
     * @param {number} params.page - Current page number (1-based)
     * @param {number} params.limit - Number of items per page
     * @param {string} [params.search] - Search term
     * @param {Date} [params.startDate] - Start date filter
     * @param {Date} [params.endDate] - End date filter
     * @param {string} [params.orderBy] - Field to sort by
     * @param {string} [params.orderDirection] - Sort direction ('asc' or 'desc')
     * @param {Array} [params.regions] - Array of selected region IDs
     * @param {Array} [params.speeds] - Array of selected speed IDs
     * @returns {Promise<Object>} Object containing jobs array and pagination metadata
     */
    async getAllJobs(params) {
        // Convert regions and speeds arrays to comma-separated strings if present
        const regionIds = params.regions?.map(r => r.id).join(',');
        const speedIds = params.speeds?.map(s => s.id).join(',');

        const response = await this._http.get('/overview', {
            params: {
                statusGroup: params.statusGroup,
                page: params.page,
                limit: params.limit,
                search: params.search,
                startDate: params.startDate ? params.startDate.toISOString() : null,
                endDate: params.endDate ? params.endDate.toISOString() : null,
                orderBy: params.orderBy || 'jobName',
                orderDirection: params.orderDirection,
                regions: regionIds || null,
                speeds: speedIds || null
            }
        });

        return {
            items: response.data.items || [],
            total: response.data.total || 0,
            page: response.data.page || params.page,
            pages: response.data.pages || Math.ceil((response.data.total || 0) / params.limit)
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

    /**
     * Get all available regions
     * @returns {Promise<Array>} Array of region objects
     */
    async getAllSpeeds() {
        const response = await this._http.get('/overview/GetAllSpeeds');
        return response.data;
    }

    async getStats() {
        const response = await this._http.get('/overview/GetStats');
        return response.data;
    }

    /**
     * Get coordinate info for parent and child jobs to display on heremaps
     * @param {number} jobId - Id of the parent job
     * @returns {Promise<Object>} Object containing jobs array and pagination metadata
     */
    async getParentJobMap(jobId) {
        const response = await this._http.get('/overview/GetParentJobMap?jobId=' + jobId);
        return response.data;
    }
}

angular.module('uDispatch').service('overviewService', ['$http', $http => new OverviewService($http)]);
