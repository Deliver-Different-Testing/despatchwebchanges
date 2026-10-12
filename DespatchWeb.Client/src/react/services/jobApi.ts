/**
 * Job API Service
 *
 * Axios-based API service for job-related operations.
 */

import {apiClient} from './apiClient';
import {RelatedJobDto, VoidJobRequest, VoidBulkJobRequest, CreateJobRequest, QuickCreateJobResult, Suggestion} from '../interfaces';
import {RequestOptions} from "./requestOptions";

/**
 * Get related jobs for multi-select void operation
 */
export async function getRelatedJobsMultiSelectList(
    jobId: number,
    isArchived: boolean,
    isBulkJob: boolean = false,
    options?: RequestOptions
): Promise<RelatedJobDto[]> {
    return apiClient.get<RelatedJobDto[]>('job/GetRelatedJobsMultiSelectList', {
        jobId,
        isArchived,
        isBulkJob,
    }, options);
}

/**
 * Void a single job or multiple related jobs
 */
export async function voidJob(request: VoidJobRequest): Promise<void> {
    await apiClient.post('job/Void', request);
}

/**
 * Void a bulk job or multiple related jobs
 */
export async function voidBulkJob(request: VoidBulkJobRequest): Promise<void> {
    await apiClient.post('job/VoidBulkJob', request);
}

/**
 * Quick create a new job
 */
export async function quickCreateJob(job: CreateJobRequest): Promise<QuickCreateJobResult> {
    return apiClient.post<QuickCreateJobResult>('job/QuickCreateJob', job);
}

/**
 * Search for active clients
 */
export async function searchActiveClients(searchText: string, options?: RequestOptions): Promise<Suggestion[]> {
    return apiClient.get<Suggestion[]>('home/ActiveClients', {searchTerm: searchText}, options);
}

/**
 * Get available vehicle sizes
 */
export async function getVehicleSizes(options?: RequestOptions): Promise<Suggestion[]> {
    return apiClient.get<Suggestion[]>('courier/GetVehicleSizes', undefined, options);
}

/**
 * Allocate a job to a courier
 */
export async function allocateJobToCourier(courierId: number, jobIds: number[]): Promise<void> {
    await apiClient.post('job/Allocate', {courierId, jobIds});
}

/**
 * Validate that a job is eligible for a POD swap
 */
export async function validateSwapPod(jobNo: string, options?: RequestOptions): Promise<boolean> {
    return apiClient.get<boolean>('Job/ValidateSwapPod', {job: jobNo}, options);
}

export interface SwapPodCandidate {
    jobId: number;
    number: string;
    statusId: number;
    statusName: string;
    customer: string;
    fromSuburb: string;
    toSuburb: string;
    courier: string | null;
    date: string;
    hasPod: boolean;
}

export interface SwapPodCandidateQuery {
    term?: string;
    statusId?: number;
    customer?: string;
    date?: string;
    excludeJobNumber?: string;
}

export interface SwapPodResult {
    movedPhotos: number;
    failedPhotos: number;
}

/**
 * Search jobs that can receive a POD swap
 */
export async function searchSwapPodCandidates(
    query: SwapPodCandidateQuery,
    options?: RequestOptions
): Promise<SwapPodCandidate[]> {
    return apiClient.get<SwapPodCandidate[]>('Job/SearchSwapPodCandidates', {...query}, options);
}

/**
 * Swap the POD between two jobs
 */
export async function swapPod(job1: string, job2: string): Promise<SwapPodResult> {
    return apiClient.post<SwapPodResult>('Job/SwapPod', {job1, job2});
}

export const jobApi = {
    getRelatedJobsMultiSelectList,
    voidJob,
    voidBulkJob,
    quickCreateJob,
    searchActiveClients,
    getVehicleSizes,
    allocateJobToCourier,
    validateSwapPod,
    searchSwapPodCandidates,
    swapPod,
};

export default jobApi;
