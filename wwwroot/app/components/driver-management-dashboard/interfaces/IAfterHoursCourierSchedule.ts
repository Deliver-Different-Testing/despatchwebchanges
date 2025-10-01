import { Dayjs } from "dayjs";

export interface IAfterHoursCourierSchedule {
    afterHoursScheduleId: number;
    courierId: number;
    courierName: string;
    courierCode: string;
    day: string;
    startTime?: Dayjs;
    endTime?: Dayjs;
    timezone?: string;
    duration: string;
}