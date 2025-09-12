import {IDispatchJob} from "../../interfaces/job.interface";
import dayjs from "dayjs";
import {formatFullDate} from "../../functions/formatDates";
import IScanDetailResult from "./interfaces/IScanDetailResult";

class JobSearchService implements angular.IServiceProvider {
    static $inject = [
        "$http"
    ];

    constructor(
        private $http: angular.IHttpService
    ) {}

    $get() {
        return this;
    }

    async getPodJobs(
        fromDate: Date,
        toDate: Date,
        courierId?: number,
        clientId?: number,
        wild?: string,
        job?: string,
    ): Promise<IDispatchJob[]> {
        const response = await this.$http.get<IDispatchJob[]>(
            `/Job/PODSearch`, {
                params: {
                    courierId: courierId,
                    clientId: clientId,
                    wild: wild,
                    job: job,
                    fromDate: dayjs(fromDate).format(),
                    toDate: dayjs(toDate).format(),
                }
            }
        );

        return response.data;
    }

    async podJobsDownload(
        fromDate: Date,
        toDate: Date,
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
                    fromDate: dayjs(fromDate).format(),
                    toDate: dayjs(toDate).format()
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
        fromDate: Date,
        toDate: Date,
        courierId?: number,
        clientId?: number,
        job?: string,
        wild?: string,
    ): Promise<IDispatchJob[]> {
        const response = await this.$http.get<IDispatchJob[]>(
            `/Job/BulkSearch`,
            {
                params: {
                    courierId,
                    clientId,
                    job,
                    wild,
                    fromDate: dayjs(fromDate).format(),
                    toDate: dayjs(toDate).format()
                }
            }
        );
        return response.data;
    }

    async getScanDetail(runDate: Date, scan: string): Promise<IScanDetailResult[]> {
        const response = await this.$http.get<IScanDetailResult[]>(
            `/Job/ScanJobDetail`, {
                params: {
                    runDate: formatFullDate(runDate),
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

    async getActiveCouriersSearch(searchTerm: string) {
        const response = await this.$http.get(`/courier/AllActiveSearch`,
            {
                params: {
                    searchTerm
                }
            });
        return response.data;
    }
}

export default JobSearchService;
