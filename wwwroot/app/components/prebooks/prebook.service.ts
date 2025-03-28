import {PrebookListViewModel} from "./prebooks.interfaces";
import {IJob} from "../../interfaces/job.interface";

class PrebookService {
    static $inject = ["$http"];

    constructor(private $http: angular.IHttpService) {
    }

    async getPreBookJobs(): Promise<PrebookListViewModel[]> {
        const response = await this.$http.get<PrebookListViewModel[]>("/Job/PreBookJobs");
        return response.data;
    }

    async sendPrebookJob(jobId: number): Promise<any> {
        const response = await this.$http.post(`/Job/SendPrebookJob?jobId=${jobId}`, null);
        return response.data;
    }

    async voidPrebookJob(jobId: number, despatcherName: string, staffId: number): Promise<any> {
        const response = await this.$http.post(
            `/Job/VoidPrebookJob?jobId=${jobId}&despatcher=${despatcherName}&staffId=${staffId}`,
            null
        );
        return response.data;
    }

    async getJobDetail(preBookJobId: number): Promise<IJob> {
        const response = await this.$http.get<IJob>(`/Job/PreBookDetail?preBookJobId=${preBookJobId}`);
        return response.data;
    }
}

export default PrebookService;
