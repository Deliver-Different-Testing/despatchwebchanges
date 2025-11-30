import {IPaginatedResponse} from "../../interfaces/paginated-response.interface";
import {ISuggestion} from "../../interfaces/job.interface";
import {
    MapConfig,
    MegaMapResponse, IOpenJobResponse,
    OverviewQueryParams,
    OverviewStatsViewModel, OverviewTableParentJob, IOpenJobResponseDto
} from "./overview.interfaces";
import dayjs from "dayjs";
import {formatDateForApiWithTzs} from "../../functions/formatDates";
import {transformOpenJobResponseDto} from "../../functions/dtoMappings";

class OverviewService implements angular.IServiceProvider {
    static $inject = [
        "$http",
    ];

    constructor(
        private $http: angular.IHttpService,
    ) {
        console.log('OverviewService: Service instantiated');
    }

    $get(): any {
        return this;
    }

    async getAllJobs(params: OverviewQueryParams): Promise<IPaginatedResponse<OverviewTableParentJob>> {
        const response = await this.$http.get<IPaginatedResponse<OverviewTableParentJob>>("/overview", {
            params: {
                statusGroup: params.statusGroup,
                page: params.page,
                limit: params.limit,
                search: params.search,
                startDate: params.startDate ? dayjs(params.startDate).format() : null,
                endDate: params.endDate ? dayjs(params.endDate).format() : null,
                orderBy: params.orderBy || "jobName",
                orderDirection: params.orderDirection,
                regions: params.regions,
                speeds: params.regions,
                couriers: params.couriers,
            }
        });

        return {
            items: response.data.items || [],
            total: response.data.total || 0,
            page: response.data.page || params.page,
            pages: response.data.pages || Math.ceil((response.data.total || 0) / params.limit)
        };
    }

    async getAllRegions(): Promise<ISuggestion[]> {
        const response = await this.$http.get<ISuggestion[]>("/overview/GetAllRegions");
        return response.data;
    }

    async getAllSpeeds(): Promise<ISuggestion[]> {
        const response = await this.$http.get<ISuggestion[]>("/overview/GetAllSpeeds");
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

    async getOpenJobs(params: Pick<OverviewQueryParams, 'startDate' | 'endDate' | 'regions' | 'speeds'>): Promise<IOpenJobResponse[]> {
        const response = await this.$http.get<IOpenJobResponseDto[]>("/overview/GetOpenJobs", {
            params: {
                startDate: params.startDate ? formatDateForApiWithTzs(params.startDate): null,
                endDate: params.endDate ? formatDateForApiWithTzs(params.endDate) : null,
                regions: params.regions,
                speeds: params.speeds
            }
        });

        return response.data.map(transformOpenJobResponseDto);
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

export default OverviewService;
