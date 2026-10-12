export interface OverviewTableChildJob {
    jobId: number;
    jobName: string;
    status: string;
    completion: number;
    pickup: string;
    delivery: string;
    driver: string;
    region: string;
}

export interface OverviewTableParentJob {
    jobId: number;
    jobName: string;
    status: string;
    completion: number;
    pickup: string;
    delivery: string;
    driver: string;
    region: string;
    childJobs: OverviewTableChildJob[];
    expanded?: boolean;
}
