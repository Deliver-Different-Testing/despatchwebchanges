import {Dayjs} from "dayjs";

interface IDateFilterData {
    startDate: Dayjs;
    endDate: Dayjs;
    useTime?: boolean;
}

export default IDateFilterData;