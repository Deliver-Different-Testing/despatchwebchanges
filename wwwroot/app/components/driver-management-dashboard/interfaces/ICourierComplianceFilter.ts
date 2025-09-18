export interface ICourierComplianceFilter {
    type: string;
    status: string;
    fleet: number;
}

export interface IAfterHoursFilter {
    day: string;
}

export interface ITodayActiveDriverFilter {
    location: string;
    status: string;
    fleet: number;
}