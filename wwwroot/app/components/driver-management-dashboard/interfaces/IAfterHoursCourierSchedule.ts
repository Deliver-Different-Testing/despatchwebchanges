import { Dayjs } from "dayjs";

export interface IAfterHoursCourierSchedule {
    afterHoursScheduleId: number;
    courierId: number;
    courierName: string;
    courierCode: string;
    days: string[];
    startTime?: Dayjs;
    endTime?: Dayjs;
    timezone?: string;
    duration: string;
}

export interface IAfterHoursCourierScheduleDto {
    afterHoursScheduleId: number;
    courierId: number;
    courierName: string;
    courierCode: string;
    days: string[];
    startTime?: string;
    endTime?: string;
    timezone?: string;
    duration: string;
}