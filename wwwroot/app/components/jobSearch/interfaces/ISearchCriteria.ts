import dayjs from "dayjs";

interface ISearchCriteria {
    client?: number;
    courier?: number;
    date: dayjs.Dayjs;
    from_date: dayjs.Dayjs;
    to_date: dayjs.Dayjs;
    followupClient: string;
    includeClosed: boolean;
    wild?: string;
    job?: string;
}

export default ISearchCriteria;