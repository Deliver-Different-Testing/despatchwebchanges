/**
 * Job List API Service
 *
 * Handles API calls for context menu actions in the React job list.
 * Uses the same endpoints as the AngularJS dispatch-core.service.ts.
 */

import {apiClient} from './client';
import {JobStatus} from '../types/enums/job-status.enum';
import InternalJobStatus from "../types/enums/job-internal-status.enum";
import type {EditAddressDialogViewModel} from '../types';
import type {RestorePodImpactRow} from '../services/restorePodImpact';
import {updateJobDetail, updateJobReadStatus, allocateJob as allocateJobs, reAllocateJob as reAllocateJobs} from './jobDetailApi';
import type {JobUpdateResponse} from './jobDetailApi';

// One implementation of each job write, shared with job details.
export {updateJobDetail, updateJobReadStatus, allocateJobs, reAllocateJobs};

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

export async function bulkUpdateReadStatus(jobIds: number[], shouldMarkAsRead: boolean): Promise<void> {
    await apiClient.post('job/BulkUpdateReadStatus', {jobIds, shouldMarkAsRead});
}

// ── Nationwide / Flight / Agent ──────────────────────────────────────

export async function restoreNationwideJob(jobId: number): Promise<void> {
    await apiClient.post('nationwideJob/RestoreJob', {jobId});
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

// ── Change paid courier (archived jobs) ──────────────────────────────

export interface CourierChangeEligibility {
    canChange: boolean;
    /** Why the change is blocked; null when changeable. */
    reason: 'invoiced' | 'settled' | 'notArchived' | null;
    currentCourierId?: number;
    currentCourierName?: string;
}

export async function getCourierChangeEligibility(jobId: number): Promise<CourierChangeEligibility> {
    const result = await apiClient.get<CourierChangeEligibility>('job/CourierChangeEligibility', {jobId});
    return result ?? {canChange: false, reason: 'notArchived'};
}

export async function changeArchivedJobCourier(jobId: number, courierId: number): Promise<void> {
    await apiClient.post('job/ChangeArchivedJobCourier', {jobId, courierId});
}

// ── Restore ──────────────────────────────────────────────────────────

export async function restoreJobs(jobIds: number[], removeCapturedImages = false): Promise<void> {
    await apiClient.post('job/RestoreJobs', {jobIds, removeCapturedImages});
}

/**
 * Read-only: what a restore of these jobs would cost in proof of delivery — the POD name it would
 * clear and how many captured photos/signatures are held against each job.
 */
export async function getRestorePodImpact(jobIds: number[]): Promise<RestorePodImpactRow[]> {
    return await apiClient.post<RestorePodImpactRow[]>('job/GetRestorePodImpact', {jobIds}) ?? [];
}

export async function restoreSplitJobs(jobIds: number[]): Promise<void> {
    await apiClient.post('job/RestoreSplitJobs', {jobIds});
}

export async function addRestoreEvent(jobId: number): Promise<void> {
    await apiClient.post('job/AddRestoreEvent', null, {params: {jobId}});
}

// ── Lock / Unlock ────────────────────────────────────────────────────

export function setJobLocked(jobId: number, locked: boolean, isRecurring: boolean): Promise<JobUpdateResponse> {
    return updateJobDetail(jobId, 'Locked', locked, isRecurring);
}

export interface LockableRow {
    id: number;
    preBook?: boolean;
    isBulkJob?: boolean;
    linkedJobId?: number;
}

/**
 * A prebook row locks its own template (UpdateRecurringJob). A bulk row's `id` is a BulkJobId, which
 * UpdateJob would read as an unrelated live job, so it locks the job it generated, or nothing yet.
 */
export function lockTargetFor(row: LockableRow): {jobId: number; isRecurring: boolean} | null {
    if (row.preBook) return {jobId: row.id, isRecurring: true};
    if (row.isBulkJob) return row.linkedJobId ? {jobId: row.linkedJobId, isRecurring: false} : null;
    return {jobId: row.id, isRecurring: false};
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

export function markJobMissing(jobId: number): Promise<JobUpdateResponse> {
    return updateJobDetail(jobId, 'Status', JobStatus.Missing);
}

// ── Reprice ──────────────────────────────────────────────────────────
export function moveJobToReprice(jobId: number): Promise<JobUpdateResponse> {
    return updateJobDetail(jobId, 'InternalStatusID', InternalJobStatus.Reprice);
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
    getRestorePodImpact,
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
