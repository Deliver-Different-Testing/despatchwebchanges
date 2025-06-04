export interface ResendJobsRequest {
    call: string;
    jobs: number[];
    splitJobs: number[];
    jobNos: string[];
    courierId: number;
}

export interface DispatchState {
    processing: boolean;
    selectedJobs: Set<number>;
}
