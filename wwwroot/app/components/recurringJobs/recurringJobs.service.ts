import {IPrebookListModel} from "./recurringJobs.interface";

class RecurringJobsService {
    static $inject = [
        "$http"
    ];

    constructor(
        private $http: angular.IHttpService
    ) {
        console.log('RecurringJobsService: Service instantiated');
    }

    async getPreBookJobs(active: boolean) {
        const response = await this.$http.get<IPrebookListModel[]>(`/Job/PreBookJobs`, {
            params: {
                active
            }
        });
        return response.data;
    }

    async sendPrebookJob(jobId: number) {
        await this.$http.post(`/Job/SendPrebookJob`,
            null, {
                params: {
                    jobId,
                }
            });
    }

    async voidPrebookJob(jobId: number, despatcherName: string, staffId: number) {
        await this.$http.post(
            `/Job/VoidPrebookJob`,
            null, {
                params: {
                    jobId,
                    despatcherName,
                    staffId,
                }
            }
        );
    }
}

export default RecurringJobsService;
