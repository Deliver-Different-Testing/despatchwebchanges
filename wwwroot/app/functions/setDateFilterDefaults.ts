import IDateFilterData from "../components/common/date-filter-menu/IDateFilterData";
import dayjs from "dayjs";

function setDateFilterDefaults(): IDateFilterData {
    return {
        startDate: dayjs(0),
        endDate: dayjs().add(24, 'hours')
    };
}

export default setDateFilterDefaults;