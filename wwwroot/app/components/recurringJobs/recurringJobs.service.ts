import {IPrebookListModel, IPrebookListModelDto, IRecurringJobQuery} from "./recurringJobs.interface";
import {transformPrebookListDTO} from "../../functions/dtoMappings";
import {IPaginatedResponse} from "../../interfaces/paginated-response.interface";

class RecurringJobsService {
    static $inject = [
        "$http"
    ];

    constructor(
        private $http: angular.IHttpService
    ) {
        console.log('RecurringJobsService: Service instantiated');
    }

    async getPreBookJobs(jobQuery: IRecurringJobQuery): Promise<IPaginatedResponse<IPrebookListModel>> {
        const response = await this.$http.post<IPaginatedResponse<IPrebookListModelDto>>(`job/PreBookJobs`, jobQuery);

        return {
            ...response.data,
            items: response.data.items.map(transformPrebookListDTO),
        };
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
