import app from "../../app";
import {PaginatedResponse} from "../../interfaces/paginated-response.interface";
import {IJob, Suggestion} from "../../interfaces/job.interface";
import {
    MapConfig,
    MegaMapResponse, OpenJobResponse,
    OverviewQueryParams,
    OverviewStatsViewModel, OverviewTableParentJob
} from "./overview.interfaces";

class OverviewService implements angular.IServiceProvider {
    static $inject = ["$http"];

    constructor(private $http: angular.IHttpService) {
    }

    $get(): any {
        return this;
    }

    async getAllJobs(params: OverviewQueryParams): Promise<PaginatedResponse<OverviewTableParentJob>> {
        const regionIds = params.regions?.map(r => r.id).join(",");
        const speedIds = params.speeds?.map(s => s.id).join(",");

        const response = await this.$http.get<PaginatedResponse<OverviewTableParentJob>>("/overview", {
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

    async getAllRegions(): Promise<Suggestion[]> {
        const response = await this.$http.get<Suggestion[]>("/overview/GetAllRegions");
        return response.data;
    }

    async getAllSpeeds(): Promise<Suggestion[]> {
        const response = await this.$http.get<Suggestion[]>("/overview/GetAllSpeeds");
        return response.data;
    }

    async getStats(): Promise<OverviewStatsViewModel> {
        const response = await this.$http.get<OverviewStatsViewModel>("/overview/GetStats");
        return response.data;
    }

    async getParentJobMap(jobId: number): Promise<MapConfig> {
        const response = await this.$http.get<MapConfig>(`/overview/GetParentJobMap?jobId=${jobId}`);
        return response.data;
    }

    async getMegaMapData(): Promise<MegaMapResponse[]> {
        const response = await this.$http.get<MegaMapResponse[]>("/overview/GetJobsForMegaMap");
        return response.data;
    }

   async getOpenJobs(params: Pick<OverviewQueryParams, 'startDate' | 'endDate' | 'regions' | 'speeds'>): Promise<OpenJobResponse[]> {
        const regionIds = params.regions?.map(r => r.id).join(",");
        const speedIds = params.speeds?.map(s => s.id).join(",");

        const response = await this.$http.get<OpenJobResponse[]>("/overview/GetOpenJobs", {
            params: {
                startDate: params.startDate ? params.startDate.toISOString() : null,
                endDate: params.endDate ? params.endDate.toISOString() : null,
                regions: regionIds || null,
                speeds: speedIds || null
            }
        });

        return response.data;
    }

    async saveCollapseState(cardName: string, isCollapsed: boolean): Promise<Record<string, boolean> | null> {
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

    loadCollapseState(cardName: string): boolean {
        if (window.localStorage) {
            try {
                const saved = localStorage.getItem("cardCollapseStates");
                if (saved) {
                    const states = JSON.parse(saved);
                    return states[cardName] || false;
                }
            } catch (error) {
                console.error("Error loading collapse state:", error);
            }
        }

        return false;
    }
}

app.service("overviewService", OverviewService);
export default OverviewService;
