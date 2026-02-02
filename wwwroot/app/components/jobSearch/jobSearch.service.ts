import {IJobSearchResult, IDispatchJob, ISuggestion, IJobSearchResultDto} from "../../interfaces/job.interface";
import {Dayjs} from "dayjs";
import {formatDateForApiWithTzs} from "../../functions/formatDates";
import IScanDetailResult from "./interfaces/IScanDetailResult";
import {transformDispatchJobDTO} from "../../functions/dtoMappings";

class JobSearchService implements angular.IServiceProvider {
    static $inject = [
        "$http"
    ];

    constructor(
        private $http: angular.IHttpService
    ) {
        console.log('JobSearchService: Service instantiated');
    }

    $get() {
        return this;
    }

    async getPodJobs(
        fromDate: Dayjs,
        toDate: Dayjs,
        page: number,
        pageSize: number,
        courierIds?: number[],
        clientIds?: number[],
        speedIds?: number[],
        wild?: string,
        job?: string,
        sortColumn?: string,
        sortDirection?: string,
    ): Promise<IJobSearchResult> {
        const response = await this.$http.get<IJobSearchResultDto>(
            `/Job/PODSearch`, {
                params: {
                    courierIds,
                    clientIds,
                    speedIds,
                    wild,
                    job,
                    page,
                    pageSize,
                    fromDate: formatDateForApiWithTzs(fromDate),
                    toDate: formatDateForApiWithTzs(toDate),
                    sortColumn,
                    sortDirection
                }
            }
        );

        return {
            ...response.data,
            jobs: response.data.jobs.map(transformDispatchJobDTO)
        }
    }

    getPodJobsDownloadUrl(
        fromDate: Dayjs,
        toDate: Dayjs,
        courierIds?: number[],
        clientIds?: number[],
        speedIds?: number[],
        wild?: string,
        job?: string
    ): string {
        const params = new URLSearchParams();
        params.append('fromDate', formatDateForApiWithTzs(fromDate));
        params.append('toDate', formatDateForApiWithTzs(toDate));
        if (courierIds?.length) {
            courierIds.forEach(id => params.append('courierIds', id.toString()));
        }
        if (clientIds?.length) {
            clientIds.forEach(id => params.append('clientIds', id.toString()));
        }
        if (speedIds?.length) {
            speedIds.forEach(id => params.append('speedIds', id.toString()));
        }
        if (wild) params.append('wild', wild);
        if (job) params.append('job', job);
        return `/Job/PodSearchDownload?${params.toString()}`;
    }

    getClientJobsReportDownloadUrl(
        fromDate: Dayjs,
        toDate: Dayjs,
        clientIds?: number[],
    ): string {
        const params = new URLSearchParams();
        params.append('startDate', formatDateForApiWithTzs(fromDate));
        params.append('endDate', formatDateForApiWithTzs(toDate));
        if (clientIds?.length) {
            clientIds.forEach(id => params.append('clientIds', id.toString()));
        }
        return `/Job/ClientJobsReportDownload?${params.toString()}`;
    }

    async uploadJobList(file: File) {
        let fd = new FormData();
        fd.append("file", file);
        await this.$http.post("/Job/Upload", fd, {
            transformRequest: angular.identity,
            headers: {'Content-Type': undefined},
        });
    }

    async searchBulkJobs(
        fromDate: Dayjs,
        toDate: Dayjs,
        page: number,
        pageSize: number,
        courierIds?: number[],
        clientIds?: number[],
        speedIds?: number[],
        job?: string,
        wild?: string,
    ): Promise<IJobSearchResult> {
        const response = await this.$http.get<IJobSearchResultDto>(`/Job/BulkSearch`, {
                params: {
                    courierIds,
                    clientIds,
                    speedIds,
                    job,
                    wild,
                    page,
                    pageSize,
                    fromDate: formatDateForApiWithTzs(fromDate),
                    toDate: formatDateForApiWithTzs(toDate)
                }
            }
        );

        return {
            ...response.data,
            jobs: response.data.jobs.map(transformDispatchJobDTO)
        }
    }

    async getScanDetail(runDate: Dayjs, scan: string): Promise<IScanDetailResult[]> {
        const response = await this.$http.get<IScanDetailResult[]>(
            `/Job/ScanJobDetail`, {
                params: {
                    runDate: formatDateForApiWithTzs(runDate),
                    scan
                }
            }
        );

        return response.data;
    }

    async getDispatchBulkJobDetail(bulkJobId: number): Promise<IDispatchJob> {
        const response = await this.$http.get<IDispatchJob>(`/Job/DispatchBulkJobDetail`, {
            params: {
                bulkJobId
            }
        });
        return response.data;
    }

    async validateSwapPOD(jobNumber: string) {
        const response = await this.$http.post<number>(`Job/ValidateSwapPOD`, null, {
            params: {
                jobNumber
            }
        });
        return response.data;
    }

    async swapPOD(jobNumber1: string, jobNumber2: string) {
        const response = await this.$http.post(
            `Job/SwapPOD`, null, {
                params: {
                    jobNumber1,
                    jobNumber2
                }
            }
        );
        return response.data;
    }

    async reSendJobs(jobIds: number[]) {
        const response = await this.$http.post(`job/ReSendSelected`, null, {
            params: {
                jobIds
            }
        });
        return response.data;
    }

    async reAssignJobs(jobIds: number[]) {
        const response = await this.$http.post(`job/ReAssignSelected`, null, {
            params: {
                jobIds
            }
        });
        return response.data;
    }

    async sendPOD(jobId: number, email: string) {
        const response = await this.$http.get(`job/SendPOD`, {
            params: {
                jobId,
                email
            }
        });
        return response.data;
    }

    async unSplitJob(jobId: number) {
        const response = await this.$http.post<string>(`job/UnSplitJob`, null, {
            params: {
                jobId
            }
        });
        return response.data;
    }

    async getActiveClients(searchTerm: string) {
        const response = await this.$http.get(`/home/ActiveClients`, {
            params: {
                searchTerm
            }
        });
        return response.data;
    }

    async getActiveCouriersSearch(searchTerm: string): Promise<ISuggestion[]> {
        const response = await this.$http.get<ISuggestion[]>(`/courier/AllActiveSearch`,
            {
                params: {
                    searchTerm
                }
            });
        return response.data;
    }
}

export default JobSearchService;
