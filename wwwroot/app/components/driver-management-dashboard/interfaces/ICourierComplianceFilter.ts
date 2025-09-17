export interface ICourierComplianceFilter {
    type: string;
    status: string;
    fleet: string;
}

export interface IAfterHoursFilter {
    day: string;
}

export interface IDriverEmailFilter {
    fleet: string;
}
