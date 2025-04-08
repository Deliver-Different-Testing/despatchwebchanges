import {IDispatchJob, JobQueryParams, Suggestion} from "../../interfaces/job.interface";
import {AgentViewModel, FlightViewModel} from "./nationwide.interfaces";
import {DfrntPageViewModel} from "../../interfaces/dfrnt-page-view-model.interface";
import moment from "moment";

class NationwideService implements angular.IServiceProvider {
    static $inject = [
        "$http"
    ];

    constructor(
        private $http: angular.IHttpService
    ) {
    }

    $get(): any {
        return this;
    }

    async addEvent(staffId: number, jobId: number, despatcherName: string, notes: string, eventType: number) {
        await this.$http.post(`job/addEvent?staffId=${staffId}&jobId=${jobId}&despatcherName=${encodeURIComponent(despatcherName)}&notes=${encodeURIComponent(notes)}&eventType=${eventType}`, null);
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


    async getFlightOptions(jobId: number, departureDate: string | Date): Promise<{
        flights: FlightViewModel[];
        message: "Sorry, we couldn't find any flights between these airports on the selected date. Please try different dates or airports." | null
    }> {
        const formattedDate = moment(departureDate, moment.ISO_8601, true)
            .format("YYYY-MM-DDTHH:mm:ss");

        console.log(formattedDate);

        const response = await this.$http.get<FlightViewModel[]>("nationwideJob/GetScheduledFlightOptions", {
            params: {
                departureDate: formattedDate,
                jobId,
            }
        });

        return {
            flights: response.data,
            message: response.data.length === 0
                ? "Sorry, we couldn't find any flights between these airports on the selected date. Please try different dates or airports."
                : null
        };
    }

    async assignFlightToJob(jobId: number, flightNumber: string, departureDate: Date) {
        try {
            const response = await this.$http.post("nationwideJob/AssignFlightToJob", {
                jobId,
                flightNumber,
                departureDate,
            });

            return response.data;
        } catch (error) {
            console.error("Error assigning flight to job:", error);
        }
    }

    async getAgentOptions(jobId: number): Promise<{
        agents: AgentViewModel[];
        message: "Sorry, we couldn't find any agents that applied to this specific job. Please check the job information is correct and try again." | null
    }> {
        const response = await this.$http.get<AgentViewModel[]>("nationwideJob/GetAgentsForJob", {
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

    private _prepareViewIdsForRequest(selectedAreas: DfrntPageViewModel[] | Suggestion[]): number[] {
        return selectedAreas.map(area => {
            return typeof area === "object" && area.id ? area.id : 0;
        });
    }
}

export default NationwideService;
