import {Dayjs} from "dayjs";

export interface ITodayActiveDrivers {
    courierId: number;
    code: string;
    name: string;
    fleet: string;
    loginTime: Dayjs;
    logoutTime?: Dayjs;
    duration: string;
    deliveries: number;
    status: string;
}

export interface ITodayActiveDriversDto {
    courierId: number;
    code: string;
    name: string;
    fleet: string;
    loginTime: string;
    logoutTime?: string;
    duration: string;
    deliveries: number;
    status: string;
}

