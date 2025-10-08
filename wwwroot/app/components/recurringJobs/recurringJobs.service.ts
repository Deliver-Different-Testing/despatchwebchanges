import {IPrebookListModel, IPrebookListModelDto} from "./recurringJobs.interface";
import {transformPrebookListDTO} from "../../functions/dtoMappings";

class RecurringJobsService {
    static $inject = [
        "$http"
    ];

    constructor(
        private $http: angular.IHttpService
    ) {
    }

    async getPreBookJobs(active: boolean): Promise<IPrebookListModel[]> {
        const response = await this.$http.get<IPrebookListModelDto[]>(`job/PreBookJobs`, {
            params: {
                active
            }
        });
        return response.data.map(transformPrebookListDTO);
    }

    async sendPrebookJob(jobId: number): Promise<void> {
        await this.$http.post(`job/SendPrebookJob`,
            null, {
                params: {
                    jobId,
                }
            });
    }

    async voidPrebookJob(jobId: number): Promise<void> {
        await this.$http.post(
            `job/VoidPrebookJob`,
            null, {
                params: {
                    jobId,
                }
            }
        );
    }
}

export default RecurringJobsService;
