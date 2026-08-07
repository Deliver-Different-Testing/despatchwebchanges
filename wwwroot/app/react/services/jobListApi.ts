/**
 * Job List API Service
 *
 * Handles API calls for context menu actions in the React job list.
 * Uses the same endpoints as the AngularJS dispatch-core.service.ts.
 */

import {apiClient} from './apiClient';
import {JobStatus} from '../../enums/job-status.enum';
import InternalJobStatus from "../../enums/job-internal-status.enum";
import type {EditAddressDialogViewModel} from '../interfaces';

// ── Add Stop ─────────────────────────────────────────────────────────

/**
 * Add a pick-up or delivery stop to a job, creating a linked job. Mirrors
 * V1 DispatchCoreService.addStopToJob (`POST job/AddStopToJob`). Returns the
 * new (linked) job id.
 */
export async function addStopToJob(
    jobId: number,
    pickUpAddress?: EditAddressDialogViewModel,
    deliveryAddress?: EditAddressDialogViewModel,
): Promise<number> {
    return apiClient.post<number>('job/AddStopToJob', {jobId, pickUpAddress, deliveryAddress});
}

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

export async function restoreJobs(jobIds: number[], removeCapturedImages = false): Promise<void> {
    await apiClient.post('job/RestoreJobs', {jobIds, removeCapturedImages});
}

export async function restoreSplitJobs(jobIds: number[]): Promise<void> {
    await apiClient.post('job/RestoreSplitJobs', {jobIds});
}

export async function addRestoreEvent(jobId: number): Promise<void> {
    await apiClient.post('job/AddRestoreEvent', null, {params: {jobId}});
}

// ── Lock / Unlock ────────────────────────────────────────────────────

export async function setJobLocked(jobId: number, locked: boolean, isRecurring: boolean): Promise<void> {
    await updateJobDetail(jobId, 'Locked', locked, isRecurring);
}

// ── Un-Split ─────────────────────────────────────────────────────────

export async function unSplitJob(jobId: number): Promise<string> {
    return apiClient.post<string>('job/UnSplitJob', null, {params: {jobId}});
}

// ── First Job ────────────────────────────────────────────────────────

export async function setFirstJob(jobId: number, courierId: number): Promise<void> {
    await apiClient.post('job/SetFirstJob', null, {params: {jobId, courierId}});
}

// ── Bulk Job ─────────────────────────────────────────────────────────

export interface ReleaseBulkJobResult {
    jobNumbers: string[];
}

export async function releaseBulkJob(bulkJobId: number): Promise<ReleaseBulkJobResult> {
    return apiClient.post<ReleaseBulkJobResult>('job/ReleaseBulkJob', null, {params: {bulkJobId}});
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

// ── Partner Dispatch ────────────────────────────────────────────────

export async function getActivePartnerOptions(): Promise<EventGroupItem[]> {
    return apiClient.get<EventGroupItem[]>('job/GetActivePartnerOptions');
}

export interface SendToPartnerResponse {
    success: boolean;
    trackingNumber: string | null;
    message: string;
}

export async function sendToPartner(jobId: number, partnerId: number, agreedRate: number): Promise<SendToPartnerResponse> {
    return apiClient.post<SendToPartnerResponse>('job/SendToPartner', {jobId, partnerId, agreedRate});
}

export interface PartnerRateQuote {
    serviceCode: string;
    serviceName: string;
    totalCharge: number;
    currency: string;
    transitDays: number | null;
}

export interface PartnerRateForJobResponse {
    rateCardRate: number | null;
    liveQuotes: PartnerRateQuote[];
    /**
     * Which rate-resolution strategy IM used:
     *   'none'        — no mapping / not enough data; operator types from scratch
     *   'rate_card'   — legacy pre-negotiated rate (currently dormant)
     *   'live_quote'  — Mode 1 with a live partner quote (pick from liveQuotes)
     *   'percentage'  — Mode 2; rate will be A.UcjbAmount × percentageOfClientCharge
     *   'cost_plus'   — Mode 3; rate is partner-quoted, A.UcjbAmount is rewritten
     *                   to cost × (1 + marginPercent)
     */
    source: 'rate_card' | 'live_quote' | 'none' | 'percentage' | 'cost_plus';
    /** Mode 2: percentage IM will apply to UcjbAmount. */
    percentageOfClientCharge?: number | null;
    /** Mode 3: margin IM will apply on top of the partner quote. */
    marginPercent?: number | null;
    /** Mode 2: the rate IM will send to the partner (= UcjbAmount × pct). */
    derivedRate?: number | null;
    /** Mode 3: the UcjbAmount IM will stamp on A's local job (= cost × (1 + margin)). */
    derivedRevenue?: number | null;
    /** Optional human-readable hint or error explanation. */
    message?: string | null;
    /**
     * Whether the partner can carry this route under the mapped service code.
     * null = IM couldn't find out (partner unreachable). Only warn on an explicit false —
     * a peer outage must not read as "the lane is closed".
     */
    serviceAvailable?: boolean | null;
    /** Why serviceAvailable is false. */
    serviceabilityMessage?: string | null;
    /** What the partner CAN carry on this route. */
    alternatives?: PartnerServiceabilityAlternative[];
}

export interface PartnerServiceabilityAlternative {
    /** Local speed id, where the operator can switch the job to this service. */
    jobTypeId: number | null;
    partnerServiceCode: string;
    serviceName: string;
    totalCharge: number | null;
    currency: string | null;
    transitDays: number | null;
}

export async function getPartnerRateForJob(pairingId: number, jobId: number): Promise<PartnerRateForJobResponse> {
    return apiClient.post<PartnerRateForJobResponse>('job/GetPartnerRateForJob', {pairingId, jobId});
}

// ─── Mode 1 rate-acceptance gate (B side) ───────────────────────────────────

export interface PartnerInboundJobAcceptanceState {
    /** "Allowed" | "PendingAcceptance" | "Accepted" | "Rejected". */
    status: 'Allowed' | 'PendingAcceptance' | 'Accepted' | 'Rejected';
    proposedAgreedRate: number | null;
    rejectionReason: string | null;
    actionedAtUtc: string | null;
    partnerJobGuid: string | null;
}

export interface PartnerInboundJobActionResponse {
    success: boolean;
    errorMessage: string | null;
    newState: PartnerInboundJobAcceptanceState | null;
}

export async function getPartnerInboundRateAcceptance(jobId: number): Promise<PartnerInboundJobAcceptanceState> {
    return apiClient.get<PartnerInboundJobAcceptanceState>(`job/GetPartnerInboundRateAcceptance/${jobId}`);
}

export async function acceptPartnerRate(jobId: number): Promise<PartnerInboundJobActionResponse> {
    return apiClient.post<PartnerInboundJobActionResponse>('job/AcceptPartnerRate', {jobId});
}

export async function rejectPartnerRate(jobId: number, reason: string): Promise<PartnerInboundJobActionResponse> {
    return apiClient.post<PartnerInboundJobActionResponse>('job/RejectPartnerRate', {jobId, reason});
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
    restoreSplitJobs,
    addRestoreEvent,
    setJobLocked,
    unSplitJob,
    setFirstJob,
    releaseBulkJob,
    splitJob,
    getSplitJobStatus,
    getEventGroups,
    markJobMissing,
    moveJobToReprice,
    getActivePartnerOptions,
    sendToPartner,
    getPartnerRateForJob,
};

export default jobListApi;
