import IDateFilterData from "../interfaces/date-filter-data.interface";
import dayjs from "dayjs";
import {getIanaTimezone} from "./formatDates";
import {TimeZone} from "../contants";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

function setDateFilterDefaults(timeZone?: string): IDateFilterData {
    if(!timeZone) timeZone = getIanaTimezone(TimeZone);
    
    return {
        startDate: dayjs(0).tz(timeZone),
        endDate: dayjs().tz(timeZone).add(24, 'hours')
    };
}
export default setDateFilterDefaults;