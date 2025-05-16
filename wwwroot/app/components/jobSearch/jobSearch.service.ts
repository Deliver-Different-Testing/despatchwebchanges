import {IJob} from "../../interfaces/job.interface";
import PodSearchResponse from "./enums/podSearchResponse";

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

    async allocateJobs(courierId: number, dispatcherId: number, jobIds: number[]) {
        return this.$http.post(`job/Allocate?courierId=${courierId}&dispId=${dispatcherId}&jobIds=${jobIds}`, null);
    }

    async addRestoreEvent(
        jobNo: string,
        clientId: number,
        contact: number,
        staffId: number,
        courierId: number,
        jobId: number,
        jobType: number,
        despatcherName: string
    ) {
        const response = await this.$http.post(
            `job/AddRestoreEvent?jobNo=${jobNo}&clientId=${clientId}&contact=${contact}&staffId=${staffId}&courierId=${courierId}&jobId=${jobId}&jobType=${jobType
            }&despatcherName=${despatcherName}`, null
        );
        return response.data;
    }

    async getPodJobs(
        courierId: number,
        clientId: number,
        wild: string,
        job: string,
        fromDate: Date,
        toDate: Date,
        pageIndex: number,
        pageSize: number
    ): Promise<PodSearchResponse> {
        const response = await this.$http.get<PodSearchResponse>(
            `/Job/PODSearch`, {
                params: {
                    courierId: courierId,
                    clientId: clientId,
                    wild: wild,
                    job: job,
                    fromDate: fromDate.toISOString(),
                    toDate: toDate.toISOString(),
                    pageIndex: pageIndex,
                    pageSize: pageSize
                }
            }
        );

        return response.data;
    }

    async podJobsDownload(
        courierId: number,
        clientId: number,
        wild: string,
        job: string,
        fromDate: Date,
        toDate: Date
    ) {
        return this.$http.get(
            `/Job/PODSearchDownload?courierId=${courierId}&clientId=${clientId}&wild=${wild}&job=${job}&fromDate=${fromDate.toISOString()}&toDate=${toDate.toISOString()}`,
            {responseType: "blob"}
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
        courierId: number,
        clientId: number,
        job: string,
        wild: string,
        fromDate: Date,
        toDate: Date,
        pageIndex: number,
        pageSize: number
    ) {
        const response = await this.$http.get(
            `/Job/BulkSearch?courierId=${courierId}&clientId=${clientId}&job=${job}&wild=${wild}&fromDate=${fromDate.toISOString()}&toDate=${toDate.toISOString()}&pageIndex=${pageIndex}&pageSize=${pageSize}`
        );
        return response.data;
    }

    async getCourierRoute(code: string, start: Date, end: Date) {
        const response = await this.$http.get(
            `/courier/route?code=${code}&start=${start.toISOString()}&end=${end.toISOString()}`
        );
        return response.data;
    }

    async getJobDetail(jobId: number) {
        const response = await this.$http.get(`/Job/Detail?jobId=${jobId}`);
        return response.data;
    }

    async getRelatedJobs(parentId: number, clientId: number) {
        const response = await this.$http.get(`/Job/Related?parentId=${parentId}&clientId=${clientId}`);
        return response.data;
    }

    async getScanDetail(runDate: Date, scan: string) {
        const response = await this.$http.get(
            `/Job/ScanJobDetail?runDate=${runDate.toISOString()}&scan=${scan}`
        );
        return response.data;
    }

    async getBulkJobDetail(bulkJobId: number) {
        const response = await this.$http.get<IJob>(`/Job/BulkDetail?bulkJobId=${bulkJobId}`);
        return response.data;
    }

    async getActiveCouriers() {
        const response = await this.$http.get("courier/active");
        return response.data;
    }

    async getAllCouriers() {
        const response = await this.$http.get("courier/AllActive");
        return response.data;
    }


    async addEventNote(eventId: number, note: string) {
        const response = await this.$http.post(
            `CS/AddEventNote?eventId=${eventId}&note=${note}&userName=${FirstName}`, null
        );

        return response.data;
    }

    async validateSwapPOD(jobNumber: string) {
        const response = await this.$http.post<number>(`Job/ValidateSwapPOD?job=${jobNumber}`, null);
        return response.data;
    }

    async restoreJobs(courierId: number, dispatcherId: number, jobIds: number[]) {
        const response = await this.$http.post(
            `job/RestoreJobs?courierId=${courierId}&dispId=${dispatcherId}&jobIds=${jobIds}`, null
        );
        return response.data;
    }

    async restoreSplitJobs(courierId: number, dispatcherId: number, jobIds: number[]) {
        const response = await this.$http.post(
            `job/RestoreSplitJobs?courierId=${courierId}&dispId=${dispatcherId}&jobIds=${jobIds}`, null
        );
        return response.data;
    }

    async swapPOD(jobNumber1: string, jobNumber2: string) {
        const response = await this.$http.post(
            `Job/SwapPOD?job1=${jobNumber1}&job2=${jobNumber2}`, null
        );
        return response.data;
    }

    async closeEvent(eventId: number, userName: string) {
        const response = await this.$http.post(
            `CS/CloseEvent?eventId=${eventId}&userName=${`${FirstName}-${userName}`}`, null
        );
        return response.data;
    }

    async reSendJobs(jobIds: number[]) {
        const response = await this.$http.post(`job/ReSendSelected?jobIds=${jobIds}`, null);
        return response.data;
    }

    async reAssignJobs(jobIds: number[]) {
        const response = await this.$http.post(`job/ReAssignSelected?jobIds=${jobIds}`, null);
        return response.data;
    }

    async sendPOD(jobId: number, email: string) {
        const response = await this.$http.get(`job/SendPOD?jobId=${jobId}&toEmail=${email}`);
        return response.data;
    }

    async unSplitJob(jobId: number) {
        const response = await this.$http.post<string>(`job/UnSplitJob?jobId=${jobId}`, null);
        return response.data;
    }

    async generateDirectLink(eventId: number, clientId: number) {
        const response = await this.$http.get(`/CS/GenerateDirectLink?eventId=${eventId}&clientId=${clientId}`);
        return response.data;
    }

    async createEvent(data: any, notify: boolean) {
        try {
            const response1 = await this.$http({
                url: `book/CreateEvent?clientInternal=${ClientInternal}&notify=${notify}&clientName=${FirstName}`,
                method: "POST",
                data: data,
            });
            return response1.data;
        } catch (error) {
            console.error("Book/CreateEvent error", error);
        }
    }


    async getActiveClients(searchTerm: string) {
        const response = await this.$http.get(`/home/ActiveClients?searchTerm=${searchTerm}`);
        return response.data;
    }

    async getActiveCouriersSearch(searchTerm: string) {
        const response = await this.$http.get(`/courier/AllActiveSearch?searchTerm=${searchTerm}`);
        return response.data;
    }

    downloadJobs(params: any) {
        return this.$http.post("/Job/Download", params.data, {responseType: "blob"});
    }
}

export default JobSearchService;
