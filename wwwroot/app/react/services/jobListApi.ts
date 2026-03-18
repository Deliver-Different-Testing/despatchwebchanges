/**
 * Job List API Service
 *
 * Handles API calls for context menu actions in the React job list.
 * Uses the same endpoints as the AngularJS dispatch-core.service.ts.
 */

import {apiClient} from './apiClient';
import {JobStatus} from '../../enums/job-status.enum';
import InternalJobStatus from "../../enums/job-internal-status.enum";

// ── Read Status ──────────────────────────────────────────────────────

export async function updateJobReadStatus(jobId: number, hasBeenRead: boolean): Promise<void> {
    await apiClient.post('job/UpdateJobReadStatus', null, {
        params: {jobId, hasBeenRead},
    });
}

export async function bulkUpdateReadStatus(jobIds: number[], shouldMarkAsRead: boolean): Promise<void> {
    await apiClient.post('job/BulkUpdateReadStatus', {jobIds, shouldMarkAsRead});
}

// ── Nationwide / Flight / Agent ──────────────────────────────────────

export async function restoreNationwideJob(jobId: number): Promise<void> {
    await apiClient.post('nationwideJob/RestoreJob', {jobId});
}

// ── Job Updates ──────────────────────────────────────────────────────

export async function updateJobDetail(
    jobId: number,
    field: string,
    value: unknown,
    isRecurring: boolean = false,
): Promise<void> {
    const url = isRecurring ? 'job/UpdateRecurringJob' : 'job/UpdateJob';
    await apiClient.post(url, null, {
        params: {jobId, field, value, isRecurring},
    });
}

// ── Late Call ────────────────────────────────────────────────────────

export interface LateCallRequest {
    jobId: number;
    lateType: number; // 1 = Pickup, 2 = Delivery
    lateTime: number;
    calculationRequired: boolean;
}

export async function lateCall(request: LateCallRequest): Promise<void> {
    await apiClient.post('job/LateCall', request);
}

// ── Dispatch / Re-dispatch ───────────────────────────────────────────

export async function allocateJobs(courierId: number, jobIds: number[]): Promise<void> {
    await apiClient.post('job/Allocate', {courierId, jobIds});
}

export async function reAllocateJobs(courierId: number, jobIds: number[]): Promise<void> {
    await apiClient.post('job/ReAllocate', {courierId, jobIds});
}

// ── Restore ──────────────────────────────────────────────────────────

export async function restoreJobs(jobIds: number[]): Promise<void> {
    await apiClient.post('job/RestoreJobs', {jobIds});
}

// ── First Job ────────────────────────────────────────────────────────

export async function setFirstJob(jobId: number, courierId: number): Promise<void> {
    await apiClient.post('job/SetFirstJob', null, {params: {jobId, courierId}});
}

// ── Bulk Job ─────────────────────────────────────────────────────────

export async function releaseBulkJob(bulkJobId: number): Promise<void> {
    await apiClient.post('job/ReleaseBulkJob', null, {params: {bulkJobId}});
}

// ── Split Job ────────────────────────────────────────────────────────

export async function splitJob(
    jobId: number,
    meetingPointAddress: unknown,
): Promise<{taskId: string}> {
    return apiClient.post<{ taskId: string }>('job/splitJob', {
        jobId,
        meetingPointAddress,
    });
}

export async function getSplitJobStatus(
    taskId: string,
): Promise<{status: string; errorMessage: string | null}> {
    return apiClient.get<{ status: string; errorMessage: string | null }>(
        'job/splitJobStatus',
        {taskId},
    );
}

// ── Event Groups ─────────────────────────────────────────────────────

export interface EventGroupItem {
    id: number;
    text: string;
}

export async function getEventGroups(): Promise<EventGroupItem[]> {
    return apiClient.get<EventGroupItem[]>('task/GetEventGroups');
}

// ── Mark Missing ─────────────────────────────────────────────────────

export async function markJobMissing(jobId: number): Promise<void> {
    await updateJobDetail(jobId, 'Status', JobStatus.Missing);
}

// ── Reprice ──────────────────────────────────────────────────────────
export async function moveJobToReprice(jobId: number): Promise<void> {
    await updateJobDetail(jobId, 'InternalStatusID', InternalJobStatus.Reprice);
}

// ── Aggregate Export ─────────────────────────────────────────────────

export const jobListApi = {
    updateJobReadStatus,
    bulkUpdateReadStatus,
    restoreNationwideJob,
    updateJobDetail,
    lateCall,
    allocateJobs,
    reAllocateJobs,
    restoreJobs,
    setFirstJob,
    releaseBulkJob,
    splitJob,
    getSplitJobStatus,
    getEventGroups,
    markJobMissing,
    moveJobToReprice,
};

export default jobListApi;
