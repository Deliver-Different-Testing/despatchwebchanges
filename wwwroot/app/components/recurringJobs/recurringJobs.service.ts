import {IPrebookListModel} from "./recurringJobs.interface";

class RecurringJobsService {
    static $inject = [
        "$http"
    ];

    constructor(
        private $http: angular.IHttpService
    ) {
    }

    async getPreBookJobs(active: boolean) {
        const response = await this.$http.get<IPrebookListModel[]>(`/Job/PreBookJobs?active=${active}`);
        return response.data;
    }

    async sendPrebookJob(jobId: number) {
        await this.$http.post(`/Job/SendPrebookJob?jobId=${jobId}`, null);
    }

    async voidPrebookJob(jobId: number, despatcherName: string, staffId: number) {
        await this.$http.post(
            `/Job/VoidPrebookJob?jobId=${jobId}&despatcher=${despatcherName}&staffId=${staffId}`,
            null
        );
    }
}

export default RecurringJobsService;
