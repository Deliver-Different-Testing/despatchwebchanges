export interface UpdateJobTimeRequest {
    jobId: number;
    dateTime: string;
    isRecurring: boolean;
    timeZoneId: number;
}
