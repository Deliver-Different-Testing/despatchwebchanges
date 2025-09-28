import {IPrebookListModel} from "./recurringJobs.interface";
import dayjs, {Dayjs} from "dayjs";
import {formatDayJsForApi} from "../../functions/formatDates";

class RecurringJobsService {
    static $inject = [
        "$http"
    ];

    constructor(
        private $http: angular.IHttpService
    ) {
    }

    async getPreBookJobs(active: boolean, startDate: Date, endDate: Date): Promise<IPrebookListModel[]> {
        const response = await this.$http.get<IPrebookListModel[]>(`job/PreBookJobs`, {
            params: {
                active,
                startDate: dayjs(startDate).format(),
                endDate: dayjs(endDate).format()
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

    async voidPrebookJob(jobId: number, despatcherName: string, staffId: number): Promise<void> {
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
