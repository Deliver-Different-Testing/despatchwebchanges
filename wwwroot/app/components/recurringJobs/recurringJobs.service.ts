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

    async exportToCsv(jobQuery: IRecurringJobQuery): Promise<void> {
        const response = await this.$http.post<Blob>(
            `job/RecurringJobsExportCsv`,
            jobQuery,
            {responseType: 'blob'}
        );

        // Extract filename from content-disposition header if available
        const contentDisposition = response.headers('content-disposition');
        let filename = `recurring-jobs-${jobQuery.active ? 'active' : 'inactive'}.csv`;
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch && filenameMatch[1]) {
                filename = filenameMatch[1].replace(/['"]/g, '');
            }
        }

        // Create download link and trigger download
        const blob = new Blob([response.data], {type: 'text/csv;charset=utf-8;'});
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

export default RecurringJobsService;
