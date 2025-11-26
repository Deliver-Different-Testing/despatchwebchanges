import {Dayjs} from "dayjs";

interface ISearchCriteria {
    client?: number;
    courier?: number;
    date: Dayjs;
    from_date: Dayjs;
    to_date: Dayjs;
    followupClient: string;
    includeClosed: boolean;
    wild?: string;
    job?: string;
    speedId?: number;
}

export default ISearchCriteria;