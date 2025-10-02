import {IPrebookListModel} from "./recurringJobs.interface";
import dayjs, {Dayjs} from "dayjs";
import {formatDateForApiWithTzs} from "../../functions/formatDates";

class RecurringJobsService {
    static $inject = [
        "$http"
    ];

    constructor(
        private $http: angular.IHttpService
    ) {
    }

    async getPreBookJobs(active: boolean, startDate: Dayjs, endDate: Dayjs): Promise<IPrebookListModel[]> {
        const response = await this.$http.get<IPrebookListModel[]>(`job/PreBookJobs`, {
            params: {
                active,
                startDate: formatDateForApiWithTzs(startDate),
                endDate: formatDateForApiWithTzs(endDate),
            }
        });
        return response.data;
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
