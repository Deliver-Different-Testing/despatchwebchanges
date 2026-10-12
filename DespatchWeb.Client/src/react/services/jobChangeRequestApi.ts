/**
 * Job Change Request API Service
 *
 * React-side wrapper for the inter-tenant job-change-request workflow.
 * Mirrors the eventApi pattern — thin axios calls, all routes return JSON.
 */

import {
    CreateJobChangeRequestPayload,
    DecisionPayload,
    JobChangeRequestDto, JobChangeRequestInboxItem,
    JobChangeRequestResult
} from "../interfaces/jobChangeRequest";
import {apiClient} from './apiClient';

export class JobChangeRequestApiService {
    create(payload: CreateJobChangeRequestPayload): Promise<JobChangeRequestResult> {
        return apiClient.post<JobChangeRequestResult>('JobChangeRequest/Create', payload);
    }

    approve(payload: DecisionPayload): Promise<JobChangeRequestResult> {
        return apiClient.post<JobChangeRequestResult>('JobChangeRequest/Approve', payload);
    }

    reject(payload: DecisionPayload): Promise<JobChangeRequestResult> {
        return apiClient.post<JobChangeRequestResult>('JobChangeRequest/Reject', payload);
    }

    cancel(payload: DecisionPayload): Promise<JobChangeRequestResult> {
        return apiClient.post<JobChangeRequestResult>('JobChangeRequest/Cancel', payload);
    }

    forJob(jobId: number): Promise<JobChangeRequestDto[]> {
        return apiClient.get<JobChangeRequestDto[]>('JobChangeRequest/ForJob', {jobId});
    }

    pendingForApproval(limit = 200): Promise<JobChangeRequestInboxItem[]> {
        return apiClient.get<JobChangeRequestInboxItem[]>('JobChangeRequest/PendingForApproval', {limit});
    }

    async hasActivePartners(): Promise<boolean> {
        const result = await apiClient.get<{hasActivePartners: boolean}>(
            'JobChangeRequest/HasActivePartners');
        return result.hasActivePartners;
    }
}

export const jobChangeRequestApi = new JobChangeRequestApiService();

export default jobChangeRequestApi;
