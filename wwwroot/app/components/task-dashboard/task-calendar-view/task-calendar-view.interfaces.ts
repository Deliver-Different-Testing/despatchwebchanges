import dayjs from "dayjs";
import {ExtendedTask} from "../task-dashboard.interfaces";

export interface CalendarDay {
    date: dayjs.Dayjs;
    isToday: boolean;
    isCurrentMonth: boolean;
    dayNumber: number;
    monthName: string;
    tasks: ExtendedTask[];
}

export interface CalendarWeek {
    weekNumber: number;
    days: CalendarDay[];
}
