export interface UpdatePodDetailsRequest {
    jobId: number;
    jobStatus: string;
    podName: string;
    podTime: string;
}

export interface IAllocateJobsToCourierRequest {
    courierId: number;
    jobIds: number[];
}