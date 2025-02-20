import app from "../../app";

class OverviewService {
    static $inject = ["$http"];

    /**
     * @param {Object} $http
     */
    constructor($http) {
        this.$http = $http;
    }

    /**
     * Get all jobs with pagination and filtering
     * @param {OverviewQueryParams} params
     * @returns {Promise<PaginatedResponse<Job>>}
     */
    async getAllJobs(params) {
        // Convert regions and speeds arrays to comma-separated strings if present
        const regionIds = params.regions?.map(r => r.id).join(",");
        const speedIds = params.speeds?.map(s => s.id).join(",");

        const response = await this.$http.get("/overview", {
            params: {
                statusGroup: params.statusGroup,
                page: params.page,
                limit: params.limit,
                search: params.search,
                startDate: params.startDate ? params.startDate.toISOString() : null,
                endDate: params.endDate ? params.endDate.toISOString() : null,
                orderBy: params.orderBy || "jobName",
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
     * @returns {Promise<Array<Suggestion>>}
     */
    async getAllRegions() {
        const response = await this.$http.get("/overview/GetAllRegions");
        return response.data;
    }

    /**
     * Get all available speeds
     * @returns {Promise<Array<Suggestion>>}
     */
    async getAllSpeeds() {
        const response = await this.$http.get("/overview/GetAllSpeeds");
        return response.data;
    }

    /**
     * Get overview statistics
     * @returns {Promise<any>}
     */
    async getStats() {
        const response = await this.$http.get("/overview/GetStats");
        return response.data;
    }

    /**
     * Get map configuration for parent job
     * @param {number} jobId
     * @returns {Promise<MapConfig>}
     */
    async getParentJobMap(jobId) {
        const response = await this.$http.get(`/overview/GetParentJobMap?jobId=${jobId}`);
        return response.data;
    }

    /**
     * Get data for mega map visualization
     * @returns {Promise<Array<MegaMapResponse>>}
     */
    async getMegaMapData() {
        const response = await this.$http.get("/overview/GetJobsForMegaMap");
        return response.data;
    }

    /**
     * Get open jobs with filtering
     * @param {Pick<OverviewQueryParams, 'startDate' | 'endDate' | 'regions' | 'speeds'>} params
     * @returns {Promise<Array<OpenJobResponse>>}
     */
    async getOpenJobs(params) {
        const regionIds = params.regions?.map(r => r.id).join(",");
        const speedIds = params.speeds?.map(s => s.id).join(",");

        const response = await this.$http.get("/overview/GetOpenJobs", {
            params: {
                startDate: params.startDate ? params.startDate.toISOString() : null,
                endDate: params.endDate ? params.endDate.toISOString() : null,
                regions: regionIds || null,
                speeds: speedIds || null
            }
        });

        return response.data;
    }

    /**
     * Get statistics for a specific driver
     * @param {string} driverName - Name of the driver
     * @returns {Promise<DriverStats>} Driver statistics including completed jobs
     */
    async getDriverStats(driverName) {
        const response = await this.$http.get(`/overview/GetDriverStats/${encodeURIComponent(driverName)}`);
        return response.data;
    }

    /**
     * Save collapse state to localStorage
     * @param {string} cardName
     * @param {boolean} isCollapsed
     * @returns {Promise<Record<string, boolean> | null>}
     */
    async saveCollapseState(cardName, isCollapsed) {
        if (window.localStorage) {
            try {
                const saved = localStorage.getItem("cardCollapseStates");
                const states = saved ? JSON.parse(saved) : {};

                // Update the state for the specific card
                states[cardName] = isCollapsed;

                localStorage.setItem("cardCollapseStates", JSON.stringify(states));
                return states;
            } catch (error) {
                console.error("Error saving collapse state:", error);
                throw error;
            }
        }
        return null;
    }

    /**
     * Load collapse state from localStorage
     * @param {string} cardName
     * @returns {boolean}
     */
    loadCollapseState(cardName) {
        if (window.localStorage) {
            try {
                const saved = localStorage.getItem("cardCollapseStates");
                if (saved) {
                    const states = JSON.parse(saved);
                    // Return the specific card's state or default to false
                    return states[cardName] || false;
                }
            } catch (error) {
                console.error("Error loading collapse state:", error);
            }
        }
        return false; // Default collapse state if no local storage or error occurs
    }
}

app.service("overviewService", OverviewService);
