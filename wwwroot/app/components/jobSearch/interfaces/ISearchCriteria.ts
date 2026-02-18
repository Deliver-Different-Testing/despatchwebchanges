import {Dayjs} from "dayjs";
import {ISuggestion} from "../../../interfaces/job.interface";

interface ISearchCriteria {
    clients: ISuggestion[];
    couriers: ISuggestion[];
    speeds: ISuggestion[];
    date: Dayjs;
    from_date: Dayjs;
    to_date: Dayjs;
    followupClient: string;
    includeClosed: boolean;
    wild?: string;
    job?: string;
    jobId?: number;
}

export default ISearchCriteria;