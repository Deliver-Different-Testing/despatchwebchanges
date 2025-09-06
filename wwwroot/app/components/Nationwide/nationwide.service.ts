import {IAgent, IAgentInfoDialog, IDispatchJob, IJobQueryParams, ISuggestion} from "../../interfaces/job.interface";
import {AssignFlightToJobRequest, IFlightViewModel} from "./nationwide.interfaces";
import {DfrntPageViewModel} from "../../interfaces/dfrnt-page-view-model.interface";
import {
    AddAgentRecoveryRequest,
    RecoveryAgentJobViewModel, RemoveAgentRecoveryRequest, UpdateAgentRecoveryRequest
} from "../dialogs/recovery-agent-management-dialog/recovery-agent-management-dialog.interfaces";
import IFlightCargoProcessing from "../dialogs/flight-agent-conformation-dialog/interfaces/IFlightCargoProcessing";
import {formatFullDate} from "../../functions/formatDates";

class NationwideService implements angular.IServiceProvider {
    static $inject = [
        "$http",
        "$log",
    ];

    private flightCache: Map<string, { timestamp: number, data: any }> = new Map();
    private CACHE_DURATION = 5 * 60 * 1000;

    constructor(
        private $http: angular.IHttpService,
        private $log: angular.ILogService
    ) {
        this.$log.debug('NationwideService: Service instantiated');
    }

    $get(): any {
        return this;
    }

    async getNationwideJobs(
        endpoint: string,
        queryParams: IJobQueryParams,
        selectedClients: string[],
        isInternal: boolean,
        selectedAreas: DfrntPageViewModel[]
    ): Promise<IDispatchJob[]> {
        const despatchViewIds = selectedAreas.map(area => area.id);

        const defaultParams = {
            status: 'all',
            order: 'time',
            orderDirection: 'asc'
        };

        const url = `nationwidejob/${endpoint}`;
        const response = await this.$http.get<IDispatchJob[]>(url, {
            params: {
                order: queryParams.order ?? defaultParams.order,
                orderDirection: queryParams.orderDirection ?? defaultParams.orderDirection,
                startDate: queryParams.startDate ? formatFullDate(queryParams.startDate) : null,
                dateCutoff: queryParams.dateCutoff ? formatFullDate(queryParams.dateCutoff) : null,
                isInternal: isInternal,
                cid: ContactID,
                clientIds: selectedClients,
                despatchViewIds
            }
        });
        return response.data;
    }

    async getNationwideJobsNew(queryParams: IJobQueryParams, selectedClients: string[], internal: boolean, selectedAreas: DfrntPageViewModel[]) {
        return await this.getNationwideJobs("nationwideJobListNew", queryParams, selectedClients, internal, selectedAreas);
    }

    async getNationwideJobsPOD(queryParams: IJobQueryParams, selectedClients: string[], internal: boolean, selectedAreas: DfrntPageViewModel[]) {
        return await this.getNationwideJobs("NationwideJobListPod", queryParams, selectedClients, internal, selectedAreas);
    }

    async getNationwideJobsReprice(queryParams: IJobQueryParams, selectedClients: string[], internal: boolean, selectedAreas: DfrntPageViewModel[]) {
        return await this.getNationwideJobs("nationwideJobListReprice", queryParams, selectedClients, internal, selectedAreas);
    }

    async getFlightOptions(
        jobId: number,
        departureDate: string | Date,
        airlineId?: number,
        departureAirportId?: number,
        arrivalAirportId?: number,
        minimumLayoverMinutes: number = 0
    ): Promise<{
        flights: IFlightViewModel[];
        message: string | null;
        lastDepartureTime: Date | null;
    }> {
        const startTime = performance.now();
        const formattedDate = formatFullDate(departureDate);

        // Create a cache key based on the parameters
        const cacheKey = `flights_${jobId}_${formattedDate}_${airlineId || 'all'}_${departureAirportId || 'default'}`;
        const cachedData = this.flightCache.get(cacheKey);

        // Return cached data if it's still valid
        if (cachedData && (Date.now() - cachedData.timestamp < this.CACHE_DURATION)) {
            this.$log.debug('Retrieved flight data from cache for job', jobId);
            return cachedData.data;
        }

        this.$log.debug(`Fetching flight data for job ${jobId} with departure ${formattedDate}`);

        try {
            const response = await this.$http.get<IFlightViewModel[]>("nationwideJob/GetScheduledFlightOptions", {
                params: {
                    departureDate: formattedDate,
                    jobId,
                    airlineId,
                    departureAirportId,
                    arrivalAirportId,
                    minimumLayoverMinutes
                }
            });

            const flights = response.data;

            let lastDepartureTime: Date | null = null;
            if (flights && flights.length > 0) {
                const lastFlight = flights[flights.length - 1];
                lastDepartureTime = lastFlight.departureTime;
            }

            const result = {
                flights,
                message: response.data.length === 0
                    ? "Sorry, we couldn't find any flights between these airports on the selected date. Please try different dates or airports."
                    : null,
                lastDepartureTime
            };

            // Store in cache
            this.flightCache.set(cacheKey, {
                timestamp: Date.now(),
                data: result
            });

            const endTime = performance.now();
            this.$log.debug(`Flight request completed in ${(endTime - startTime).toFixed(2)}ms for job ${jobId}, received ${response.data.length} flights`);

            return result;
        } catch (error) {
            const endTime = performance.now();
            console.error(`Flight request failed after ${(endTime - startTime).toFixed(2)}ms`, error);
            throw error;
        }
    }

    async assignFlightToJob(requestData: AssignFlightToJobRequest) {
        const response = await this.$http.post("nationwideJob/AssignFlightToJob", requestData);
        return response.data;
    }

    async getAgentOptions(jobId: number): Promise<{
        agents: IAgent[];
        message: "Sorry, we couldn't find any agents that applied to this specific job. Please check the job information is correct and try again." | null
    }> {
        const response = await this.$http.get<IAgent[]>("nationwideJob/GetAgentsForJob", {
            params: {
                jobId,
            }
        });

        return {
            agents: response.data,
            message: response.data.length === 0 ? "Sorry, we couldn't find any agents that applied to this specific job. Please check the job information is correct and try again." : null
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

    async getNearbyAirports(jobId: number, usePickup: boolean = true): Promise<ISuggestion[]> {
        const response = await this.$http.get<ISuggestion[]>("nationwideJob/GetNearbyAirports", {
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

    async relatedJobHasFlightAssigned(agentJobId: number): Promise<boolean> {
        const response = await this.$http.get<boolean>("nationwideJob/RelatedJobHasFlightAssigned", {
            params: {
                agentJobId
            }
        });

        return response.data;
    }

    async calculateCargoReadyTime(jobId: number, carrierFsCode: string, arrivalTime: Date): Promise<IFlightCargoProcessing> {
        const formattedArrivalTime =  formatFullDate(arrivalTime);
        this.$log.debug('formattedArrivalTime', formattedArrivalTime);
        const response = await this.$http.get<IFlightCargoProcessing>("nationwideJob/CalculateCargoReadyTime", {
            params: {
                jobId,
                carrierFsCode,
                arrivalTime: formattedArrivalTime
            }
        });
        return response.data;
    }
}

export default NationwideService;
