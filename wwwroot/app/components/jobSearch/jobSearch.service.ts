import {IJobSearchResult, IDispatchJob, ISuggestion} from "../../interfaces/job.interface";
import dayjs, {Dayjs} from "dayjs";
import {formatDateForApi, formatDateForApiWithTzs} from "../../functions/formatDates";
import IScanDetailResult from "./interfaces/IScanDetailResult";

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
        courierId?: number,
        clientId?: number,
        wild?: string,
        job?: string,
    ): Promise<IJobSearchResult> {
        const response = await this.$http.get<IJobSearchResult>(
            `/Job/PODSearch`, {
                params: {
                    courierId,
                    clientId,
                    wild,
                    job,
                    page,
                    pageSize,
                    fromDate: formatDateForApiWithTzs(fromDate),
                    toDate: formatDateForApiWithTzs(toDate)
                }
            }
        );

        return response.data;
    }

    async podJobsDownload(
        fromDate: Dayjs,
        toDate: Dayjs,
        courierId?: number,
        clientId?: number,
        wild?: string,
        job?: string
    ) {
        return this.$http.get(
            `/Job/PODSearchDownload`,
            {
                params: {
                    courierId,
                    clientId,
                    wild,
                    job,
                    fromDate: formatDateForApiWithTzs(fromDate),
                    toDate: formatDateForApiWithTzs(toDate)
                },
                responseType: "blob"
            }
        );
    }

    async clientJobsReportDownload(
        fromDate: Dayjs,
        toDate: Dayjs,
        courierId?: number,
        clientId?: number,
        wild?: string,
        job?: string
    ) {
        return this.$http.get(
            `/Job/ClientJobsReportDownload`,
            {
                params: {
                    startDate: formatDateForApiWithTzs(fromDate),
                    endDate: formatDateForApiWithTzs(toDate),
                    courierId,
                    clientId,
                    wild,
                    job
                },
                responseType: "blob"
            }
        );
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
        courierId?: number,
        clientId?: number,
        job?: string,
        wild?: string,
    ): Promise<IJobSearchResult> {
        const response = await this.$http.get<IJobSearchResult>(`/Job/BulkSearch`, {
                params: {
                    courierId,
                    clientId,
                    job,
                    wild,
                    page,
                    pageSize,
                    fromDate: formatDateForApiWithTzs(fromDate),
                    toDate: formatDateForApiWithTzs(toDate)
                }
            }
        );
        return response.data;
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
