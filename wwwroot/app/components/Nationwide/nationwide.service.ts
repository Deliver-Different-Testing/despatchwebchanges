import {
    IAgent,
    IAgentInfoDialog, IAirlineSuggestion,
    IAirportSuggestion,
    IJobQueryParams, IJobSearchResult, IJobSearchResultDto
} from "../../interfaces/job.interface";
import {
    AssignFlightToJobRequest,
    IFlightSearchResponseDto,
    IGetAgentOptionsResponse,
    IGetFlightOptionsResponse
} from "./nationwide.interfaces";
import {DfrntPageViewModel} from "../../interfaces/dfrnt-page-view-model.interface";
import IFlightCargoProcessing, {
    IFlightCargoProcessingDto
} from "../../interfaces/flight-cargo-processing.interface";
import {formatDateForApiWithTzs} from "../../react/utils/dateUtils";
import {Dayjs} from "dayjs";
import {transformCargoHoursDTO, transformDispatchJobDTO, transformFlightDTO} from "../../functions/dtoMappings";
import angular from 'angular';

class NationwideService {
    static $inject = [
        "$http",
    ];

    constructor(
        private $http: angular.IHttpService,
    ) {
    }

    async getNationwideJobs(
        endpoint: string,
        queryParams: IJobQueryParams,
        isInternal: boolean,
        selectedAreas: DfrntPageViewModel[]
    ): Promise<IJobSearchResult> {
        const despatchViewIds = selectedAreas.map(area => area.id);

        const url = `nationwidejob/${endpoint}`;
        const response = await this.$http.get<IJobSearchResultDto>(url, {
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
                useTime: queryParams.useTime ?? false,
            }
        });

        return {
            ...response.data,
            jobs: response.data.jobs.map(transformDispatchJobDTO)
        }
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
        const response = await this.$http.get<IFlightSearchResponseDto>("nationwideJob/GetScheduledFlightOptions", {
            params: {
                departureDate: formattedDate,
                jobId,
                airlineId,
                departureAirportId,
                arrivalAirportId,
                minimumLayoverMinutes
            }
        });

        const data = response.data;
        const flightDtos = data.flights ?? [];
        const flights = flightDtos.map(transformFlightDTO);

        return {
            flights,
            message: data.message || (flights.length === 0 ? "No flights available for the selected criteria." : undefined),
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

    async getActiveAirlines(): Promise<IAirlineSuggestion[]> {
        const response = await this.$http.get<IAirlineSuggestion[]>("nationwideJob/GetActiveAirlines");
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

    async calculateCargoReadyTime(jobId: number, carrierFsCode: string, arrivalTime: Dayjs, timezone?: string): Promise<IFlightCargoProcessing> {
        const formattedArrivalTime = formatDateForApiWithTzs(arrivalTime, timezone);
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
