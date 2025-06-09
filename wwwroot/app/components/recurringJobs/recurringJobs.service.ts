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

    async getPreBookJobs(active: boolean): Promise<IPrebookListModel[]> {
        const response = await this.$http.get<IPrebookListModel[]>(`job/PreBookJobs`, {
            params: {
                active
            }
        });
        return response.data;
    }

    async sendPrebookJob(jobId: number) {
        await this.$http.post(`job/SendPrebookJob`,
            null, {
                params: {
                    jobId,
                }
            });
    }

    async voidPrebookJob(jobId: number, despatcherName: string, staffId: number) {
        await this.$http.post(
            `job/VoidPrebookJob`,
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
