import {
    IAgent,
    IAgentInfoDialog,
    IAirportSuggestion,
    IDispatchJob,
    IJobQueryParams, IJobSearchResult,
    ISuggestion
} from "../../interfaces/job.interface";
import {
    AssignFlightToJobRequest,
    IFlightViewModel,
    IFlightViewModelDto, IGetAgentOptionsResponse,
    IGetFlightOptionsResponse
} from "./nationwide.interfaces";
import {DfrntPageViewModel} from "../../interfaces/dfrnt-page-view-model.interface";
import {
    AddAgentRecoveryRequest,
    RecoveryAgentJobViewModel,
    RemoveAgentRecoveryRequest,
    UpdateAgentRecoveryRequest
} from "../dialogs/recovery-agent-management-dialog/recovery-agent-management-dialog.interfaces";
import IFlightCargoProcessing, {
    IFlightCargoProcessingDto
} from "../dialogs/flight-agent-conformation-dialog/interfaces/IFlightCargoProcessing";
import {formatDateForApiWithTzs} from "../../functions/formatDates";
import {Dayjs} from "dayjs";
import {transformCargoHoursDTO, transformFlightDTO} from "../../functions/dtoMappings";

class NationwideService implements angular.IServiceProvider {
    static $inject = [
        "$http",
    ];

    constructor(
        private $http: angular.IHttpService,
    ) {
        console.debug('NationwideService: Service instantiated');
    }

    $get(): any {
        return this;
    }

    async getNationwideJobs(
        endpoint: string,
        queryParams: IJobQueryParams,
        isInternal: boolean,
        selectedAreas: DfrntPageViewModel[]
    ): Promise<IJobSearchResult> {
        const despatchViewIds = selectedAreas.map(area => area.id);

        const url = `nationwidejob/${endpoint}`;
        const response = await this.$http.get<IJobSearchResult>(url, {
            params: {
                order: queryParams.order ?? 'time',
                orderDirection: queryParams.orderDirection ?? 'asc',
                startDate: queryParams.startDate ? formatDateForApiWithTzs(queryParams.startDate) : null,
                dateCutoff: queryParams.endDate ? formatDateForApiWithTzs(queryParams.endDate) : null,
                isInternal: isInternal,
                despatchViewIds,
                page: queryParams.page ?? 0,
                pageSize: queryParams.pageSize ?? 50,
                searchText: queryParams.searchText ?? '',
            }
        });
        
        return response.data;
    }
    
    async getNationwideJobsNew(
        queryParams: IJobQueryParams,
        internal: boolean,
        selectedAreas: DfrntPageViewModel[]
    ): Promise<IJobSearchResult> {
        return await this.getNationwideJobs("nationwideJobListNew", queryParams, internal, selectedAreas);
    }

    async getNationwideJobsPOD(
        queryParams: IJobQueryParams,
        internal: boolean,
        selectedAreas: DfrntPageViewModel[]
    ): Promise<IJobSearchResult> {
        return await this.getNationwideJobs("NationwideJobListPod", queryParams, internal, selectedAreas);
    }

    async getNationwideJobsReprice(
        queryParams: IJobQueryParams,
        internal: boolean,
        selectedAreas: DfrntPageViewModel[]
    ): Promise<IJobSearchResult> {
        return await this.getNationwideJobs("nationwideJobListReprice", queryParams, internal, selectedAreas);
    }

    async getFlightOptions(
        jobId: number,
        departureDate: Dayjs,
        timezone: string,
        airlineId?: number,
        departureAirportId?: number,
        arrivalAirportId?: number,
        minimumLayoverMinutes: number = 0,
    ): Promise<IGetFlightOptionsResponse> {
        const formattedDate = formatDateForApiWithTzs(departureDate, timezone);
        const response = await this.$http.get<IFlightViewModelDto[]>("nationwideJob/GetScheduledFlightOptions", {
            params: {
                departureDate: formattedDate,
                jobId,
                airlineId,
                departureAirportId,
                arrivalAirportId,
                minimumLayoverMinutes
            }
        });

        const flights = response.data.map(transformFlightDTO);

        return {
            flights,
            message: flights.length === 0 ? "Sorry, we couldn't find..." : undefined,
            lastDepartureTime: flights.length > 0 ? flights[flights.length - 1].departureTime : undefined
        };
    }

    async assignFlightToJob(requestData: AssignFlightToJobRequest) {
        const response = await this.$http.post("nationwideJob/AssignFlightToJob", requestData);
        return response.data;
    }

    async getAgentOptions(jobId: number): Promise<IGetAgentOptionsResponse> {
        const response = await this.$http.get<IAgent[]>("nationwideJob/GetAgentsForJob", {
            params: {
                jobId
            }
        });

        return {
            agents: response.data,
            message: response.data.length === 0 
                ? "Sorry, we couldn't find any agents that applied to this specific job. Please check the job information is correct and try again." 
                : undefined
        };
    }

    async assignAgentToJob(jobId: number, agentId: number, includeStopJobs: boolean): Promise<any> {
        await this.$http.post("nationwideJob/AssignAgentToJob", {
            jobId,
            agentId,
            includeStopJobs
        });
    }

    async getActiveAirlines(): Promise<ISuggestion[]> {
        const response = await this.$http.get<ISuggestion[]>("nationwideJob/GetActiveAirlines");
        return response.data;
    }

    async getNearbyAirports(jobId: number, usePickup: boolean = true): Promise<IAirportSuggestion[]> {
        const response = await this.$http.get<IAirportSuggestion[]>("nationwideJob/GetNearbyAirports", {
            params: {
                jobId,
                usePickup
            }
        });

        return response.data;
    }

    async sendAgentQuote(jobId: number, agentId: number): Promise<void> {
        await this.$http.post("nationwideJob/SendAgentQuote", {
            jobId,
            agentId,
        });
    }

    async restoreJob(jobId: number): Promise<void> {
        await this.$http.post("nationwideJob/RestoreJob", {
            jobId,
        });
    }

    async getAgentInfoForDialog(agentId: number): Promise<IAgentInfoDialog> {
        const response = await this.$http.get<IAgentInfoDialog>("nationwideJob/GetAgentInfo", {
            params: {
                agentId,
            }
        });
        return response.data;
    }

    async getAgentRecoveryJobs(jobId: number): Promise<RecoveryAgentJobViewModel> {
        const response = await this.$http.get<RecoveryAgentJobViewModel>("nationwideJob/GetAgentRecoveryJobs", {
            params: {
                jobId,
            }
        });

        return response.data;
    }

    async addAgentRecoveryJob(data: AddAgentRecoveryRequest): Promise<void> {
        await this.$http.post("nationwideJob/AddAgentRecoveryJob", data);
    }

    async getAgentOptionsByAirport(airportId: number): Promise<ISuggestion[]> {
        const response = await this.$http.get<ISuggestion[]>("nationwideJob/GetAgentOptionsByAirport", {
            params: {
                airportId,
            }
        });

        return response.data;
    }

    async getAllActiveAirports(): Promise<ISuggestion[]> {
        const response = await this.$http.get<ISuggestion[]>("nationwideJob/GetAllActiveAirports");
        return response.data;
    }

    async updateAgentRecoveryJob(request: UpdateAgentRecoveryRequest): Promise<void> {
        await this.$http.post('nationwideJob/UpdateAgentRecoveryJob', request);
    }

    async removeAgentRecoveryJob(recoveryId: number): Promise<void> {
        const data: RemoveAgentRecoveryRequest = {
            recoveryId
        };

        await this.$http.post(`nationwideJob/RemoveAgentRecoveryJob`, data);
    }

    async calculateCargoReadyTime(jobId: number, carrierFsCode: string, arrivalTime: Dayjs, timezone?: string): Promise<IFlightCargoProcessing> {
        const formattedArrivalTime = formatDateForApiWithTzs(arrivalTime, timezone);
        console.debug('formattedArrivalTime', formattedArrivalTime);
        const response = await this.$http.get<IFlightCargoProcessingDto>("nationwideJob/CalculateCargoReadyTime", {
            params: {
                jobId,
                carrierFsCode,
                arrivalTime: formattedArrivalTime
            }
        });

        return transformCargoHoursDTO(response.data);
    }
}

export default NationwideService;
