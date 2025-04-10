export interface ResendJobsRequest {
    call: string;
    jobs: number[];
    splitJobs: number[];
    jobNos: string[];
    courierId: number;
}
