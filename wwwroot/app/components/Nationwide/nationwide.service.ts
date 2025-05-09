import {IAgent, IDispatchJob, JobQueryParams, Suggestion} from "../../interfaces/job.interface";
import {IFlightViewModel} from "./nationwide.interfaces";
import {DfrntPageViewModel} from "../../interfaces/dfrnt-page-view-model.interface";
import {FlightDetailsViewModel} from "../dialogs/flight-details-dialog/flight-details-dialog.interfaces";
import {JobEventData} from "../dialogs/add-event-dialog/add-event-dialog.interfaces";
import moment from "moment";

class NationwideService implements angular.IServiceProvider {
    static $inject = [
        "$http",
    ];

    private flightCache: Map<string, {timestamp: number, data: any}> = new Map();
    private CACHE_DURATION = 5 * 60 * 1000;

    constructor(
        private $http: angular.IHttpService,
    ) {
        console.log('NationwideService: Service instantiated');
    }

    $get(): any {
        return this;
    }

    async addEvent(eventData: JobEventData): Promise<void> {
            await this.$http.post('job/addEvent', eventData);
    }

    async exsalerateActivity(eventName: string, notes: string, clientId: number, jobNumber: string, despatcherName: string) {
        await this.$http.post(`job/ExsalerateActivity?eventName=${eventName}&notes=${notes}&clientId=${clientId}&jobNumber=${jobNumber}&despatcherName=${despatcherName}`, null);
    }

    async getNationwideJobs(
        endpoint: string,
        queryParams: JobQueryParams,
        selectedClients: string[],
        internal: boolean,
        selectedAreas: DfrntPageViewModel[]
    ): Promise<IDispatchJob[]> {
        const despatchViewIds = this._prepareViewIdsForRequest(selectedAreas);

        const defaultParams = {
            status: 'all',
            order: 'time',
            orderDirection: 'asc'
        };

        const paramObject = {
            order: String(queryParams.order ?? defaultParams.order),
            orderDirection: String(queryParams.orderDirection ?? defaultParams.orderDirection),
            isInternal: String(internal),
            cid: String(ContactID),
            clientIds: selectedClients.length ? selectedClients.join(',') : '',
        };
        const params = new URLSearchParams(paramObject);

        // Add despatch view IDs
        if (despatchViewIds.length) {
            despatchViewIds.forEach(id => {
                params.append('despatchViewIds', String(id));
            });
        }

        const url = `nationwidejob/${endpoint}?${params.toString()}`;
        const response = await this.$http.get<IDispatchJob[]>(url);
        return response.data;
    }

    async getNationwideJobsNew(queryParams: JobQueryParams, selectedClients: string[], internal: boolean, selectedAreas: DfrntPageViewModel[]) {
        return await this.getNationwideJobs("nationwideJobListNew", queryParams, selectedClients, internal, selectedAreas);
    }

    async getNationwideJobsPOD(queryParams: JobQueryParams, selectedClients: string[], internal: boolean, selectedAreas: DfrntPageViewModel[]) {
        return await this.getNationwideJobs("nationwideJobListPOD", queryParams, selectedClients, internal, selectedAreas);
    }

    async getNationwideJobsReprice(queryParams: JobQueryParams, selectedClients: string[], internal: boolean, selectedAreas: DfrntPageViewModel[]) {
        return await this.getNationwideJobs("nationwideJobListReprice", queryParams, selectedClients, internal, selectedAreas);
    }

    async getFlightOptions(
        jobId: number,
        departureDate: string | Date,
        airlineId?: number,
        departureAirportId?: number,
        minimumLayoverMinutes: number = 0
    ): Promise<{
        flights: IFlightViewModel[];
        message: string | null;
        lastDepartureTime: Date | null;
    }> {
        const startTime = performance.now();
        const formattedDate = moment(departureDate).format();

        // Create a cache key based on the parameters
        const cacheKey = `flights_${jobId}_${formattedDate}_${airlineId || 'all'}_${departureAirportId || 'default'}`;
        const cachedData = this.flightCache.get(cacheKey);

        // Return cached data if it's still valid
        if (cachedData && (Date.now() - cachedData.timestamp < this.CACHE_DURATION)) {
            console.log('Retrieved flight data from cache for job', jobId);
            return cachedData.data;
        }

        console.log(`Fetching flight data for job ${jobId} with departure ${formattedDate}`);

        try {
            const response = await this.$http.get<IFlightViewModel[]>("nationwideJob/GetScheduledFlightOptions", {
                params: {
                    departureDate: formattedDate,
                    jobId,
                    airlineId,
                    departureAirportId,
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
            console.log(`Flight request completed in ${(endTime - startTime).toFixed(2)}ms for job ${jobId}, received ${response.data.length} flights`);

            return result;
        } catch (error) {
            const endTime = performance.now();
            console.error(`Flight request failed after ${(endTime - startTime).toFixed(2)}ms`, error);
            throw error;
        }
    }

    async assignFlightToJob(jobId: number, flightNumber: string, departureDate: Date, flightData: IFlightViewModel) {
        try {
            const response = await this.$http.post("nationwideJob/AssignFlightToJob", {
                jobId,
                flightNumber,
                departureDate,
                flightSegments: flightData.flightSegments || []
            });

            return response.data;
        } catch (error) {
            console.error("Error assigning flight to job:", error);
        }
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

    async assignAgentToJob(jobId: number, agentId: number) {
        try {
            const response = await this.$http.post("nationwideJob/AssignAgentToJob", {
                jobId,
                agentId,
            });

            return response.data;
        } catch (error) {
            console.error("Error assigning agent to job:", error);
        }
    }

    async getActiveAirlines(): Promise<Suggestion[]> {
        const response = await this.$http.get<Suggestion[]>("nationwideJob/GetActiveAirlines");
        return response.data;
    }

    async getNearbyAirports(jobId: number): Promise<Suggestion[]> {
        const response = await this.$http.get<Suggestion[]>("nationwideJob/GetNearbyAirports", {
            params: {
                jobId,
            }
        });
        return response.data;
    }

    async getFlightConnectionsInfoForDialog(flightNumber: string, departureDate: Date): Promise<FlightDetailsViewModel[]> {
        const formattedDate = moment(departureDate).format();

        const response = await this.$http.get<FlightDetailsViewModel[]>("nationwideJob/GetFlightInfo", {
            params: {
                flightNumber: flightNumber,
                departureDate: formattedDate
            }
        });

        return response.data;
    }

    async sendAgentQuote(jobId: number, agentId: number) {
        await this.$http.post("nationwideJob/SendAgentQuote", {
            jobId,
            agentId,
        });
    }

    async restoreJob(jobId: number) {
        await this.$http.post("nationwideJob/RestoreJob", {
            jobId,
        });
    }

    private _prepareViewIdsForRequest(selectedAreas: DfrntPageViewModel[] | Suggestion[]): number[] {
        return selectedAreas.map(area => {
            return typeof area === "object" && area.id ? area.id : 0;
        });
    }
}

export default NationwideService;
