import {ISuggestion} from "../../../interfaces/job.interface";

interface ISearchCriteria {
    client?: number;
    courier?: number;
    date: Date;
    from_date: Date;
    to_date: Date;
    followupClient: string;
    includeClosed: boolean;
    wild?: string;
    job?: string;
    regions?: ISuggestion[];
}

export default ISearchCriteria;