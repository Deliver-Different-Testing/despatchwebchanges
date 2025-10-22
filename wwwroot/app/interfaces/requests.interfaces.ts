export interface UpdatePodDetailsRequest {
    jobId: number;
    jobStatus: string;
    podName: string;
    podTime: string;
}

export interface IJobUpdateBaseRequest {
    jobId: number;
}

export interface IAllocateJobsToCourierRequest {
    courierId: number;
    jobIds: number[];
}