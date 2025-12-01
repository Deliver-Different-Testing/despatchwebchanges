import {IPrebookListModel, IPrebookListModelDto, IRecurringJobQuery} from "./recurringJobs.interface";
import {transformPrebookListDTO} from "../../functions/dtoMappings";
import {IPaginatedResponse} from "../../interfaces/paginated-response.interface";
import {IAppConfig} from "../../interfaces/app-config.interface";

class RecurringJobsService {
    static $inject = [
        "$http",
        "APP_CONFIG",
    ];

    constructor(
        private $http: angular.IHttpService,
        private appConfig: IAppConfig,
    ) {
        console.log('RecurringJobsService: Service instantiated');
    }

    async getPreBookJobs(jobQuery: IRecurringJobQuery): Promise<IPaginatedResponse<IPrebookListModel>> {
        const response = await this.$http.post<IPaginatedResponse<IPrebookListModelDto>>(`job/PreBookJobs`, jobQuery);

        return {
            ...response.data,
            items: response.data.items.map(dto => transformPrebookListDTO(dto, this.appConfig.US_Customer)),
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
