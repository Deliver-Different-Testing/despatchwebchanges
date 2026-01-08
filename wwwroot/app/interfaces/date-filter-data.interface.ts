import {Dayjs} from "dayjs";

/**
 * Interface for date filter data used across the application.
 * Represents a date range with optional time precision.
 */
export interface IDateFilterData {
    startDate: Dayjs;
    endDate: Dayjs;
    useTime?: boolean;
}

export default IDateFilterData;
