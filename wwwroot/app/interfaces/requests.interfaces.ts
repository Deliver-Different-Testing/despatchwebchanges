export interface UpdateJobTimeRequest {
    jobId: number;
    dateTime: string | Date | number | boolean;
    isRecurring: boolean;
    timeZoneId: number;
}

export interface UpdatePodDetailsRequest {
    jobId: number;
    jobStatus: string;
    podName: string;
    podTime: string;
}
