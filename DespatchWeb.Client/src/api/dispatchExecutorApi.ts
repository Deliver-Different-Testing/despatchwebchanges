/**
 * Dispatch Executor API Service
 *
 * API methods used by the dispatch executor workflow that aren't
 * covered by other React API services. Complements jobListApi.ts,
 * jobApi.ts, jobDetailApi.ts, etc.
 */

import {apiClient} from './client';
import type {ActiveCourierViewModel} from '../types/interfaces/courier.interface';
import type {IDispatchJobDto} from '../types/interfaces/job.interface';
import {transformDispatchJobDTO} from '../utils/dtoMappings';
import type {DispatchJob} from '../types/dispatchJob';
import {RequestOptions} from "./requestOptions";

// ── Courier Lookup ──────────────────────────────────────────────────

/**
 * Get a courier by their ID. Returns full courier details including
 * DG license and vehicle type (needed for dispatch validation).
 */
export async function getCourierById(
    courierId: number,
    options?: RequestOptions,
): Promise<ActiveCourierViewModel | null> {
    try {
        return await apiClient.get<ActiveCourierViewModel>('courier/GetCourier', {courierId}, options);
    } catch {
        return null;
    }
}

/**
 * Get dispatch-specific job detail (lighter than full job detail).
 */
export async function getDispatchJobDetail(
    jobId: number,
    options?: RequestOptions,
): Promise<DispatchJob> {
    const dto = await apiClient.get<IDispatchJobDto>('job/DispatchJobDetail', {jobId}, options);
    return transformDispatchJobDTO(dto) as unknown as DispatchJob;
}

// ── Followup Events ─────────────────────────────────────────────────

/**
 * Add a DG followup event for a job (called after dispatching a dangerous goods job).
 */
export async function addFollowupEvent(jobId: number): Promise<void> {
    await apiClient.post('courier/AddFollowupEvent', null, {params: {jobId}});
}

/**
 * Add a restore event for a job.
 */
export async function addRestoreEvent(jobId: number): Promise<void> {
    await apiClient.post('job/AddRestoreEvent', null, {params: {jobId}});
}

// ── Job Status Operations ───────────────────────────────────────────

/**
 * Reassign selected jobs (bulk operation).
 */
export async function reAssignJobs(jobIds: number[]): Promise<void> {
    await apiClient.post('job/ReAssignSelected', null, {params: {jobIds}});
}

/**
 * Resend selected jobs.
 */
export async function reSendJobs(jobIds: number[]): Promise<void> {
    await apiClient.post('job/ReSendSelected', null, {params: {jobIds}});
}

// ── Job Hierarchy ───────────────────────────────────────────────────

/**
 * Check if a job is a parent (has child jobs).
 */
export async function isJobParent(jobId: number, options?: RequestOptions): Promise<boolean> {
    return apiClient.get<boolean>('job/IsJobParent', {jobId}, options);
}

/**
 * Check if a bulk job is a parent.
 */
export async function isBulkJobParent(bulkJobId: number, options?: RequestOptions): Promise<boolean> {
    return apiClient.get<boolean>('job/IsBulkJobParent', {bulkJobId}, options);
}

// ── Nationwide / Agent ──────────────────────────────────────────────

/**
 * Check if an agent can be assigned to a job (a flight must be assigned first).
 */
export async function canAssignAgentToJob(agentJobId: number, options?: RequestOptions): Promise<boolean> {
    return apiClient.get<boolean>('nationwideJob/CanAssignAgentToJob', {agentJobId}, options);
}

/** Whether assigning an agent will email them the inbound-agent job link. */
export type AgentInboundEmailStatus =
    | 'Queued'
    | 'NoAgentEmail'
    | 'NoInboundUrl'
    | 'Failed'
    /** This agent already has this alert for this job; nothing is sent unless the dispatcher asks to send it again. */
    | 'AlreadySent'
    /** The tenant switched agent alerts off in Settings. */
    | 'AlertsOff';

/** Which alert the leg gets: what the agent physically does on it. */
export type AgentAlertType = 'Pickup' | 'Delivery' | 'DoorToDoor';

export interface AgentInboundEmailResult {
    status: AgentInboundEmailStatus;
    agentEmail: string | null;
    willEmail: boolean;
    alertType?: AgentAlertType | null;
    /** The subject as it will be sent (preview endpoint only, when an alert would go). */
    subject?: string | null;
    /** The email HTML as it will be sent, note included (preview endpoint only). */
    html?: string | null;
}

/**
 * Assign an agent to a job. Returns whether the agent was emailed the inbound-agent
 * link (best-effort — the assignment itself always succeeds if this resolves).
 *
 * `emailSubject` replaces the tenant's subject for this send (tokens such as [JobNumber] still fill);
 * `emailNote` is the dispatcher's plain-text note, shown above the alert. Omit both for the tenant's alert as is.
 */
export async function assignAgentToJob(
    jobId: number,
    agentId: number,
    includeStopJobs = false,
    emailSubject?: string,
    emailNote?: string,
    resend = false,
): Promise<AgentInboundEmailResult> {
    return apiClient.post<AgentInboundEmailResult>(
        'nationwideJob/AssignAgentToJob',
        {jobId, agentId, includeStopJobs, emailSubject, emailNote, resend},
    );
}

/**
 * Hand a job to a network partner. Stamps tucJob.NpAgentId, which is what the
 * partner's row-level visibility keys off — it does not dispatch the job or email
 * anyone, so the courier-facing status is left alone.
 */
export async function assignNpAgentToJob(jobId: number, npAgentId: number): Promise<{success: boolean}> {
    return apiClient.post<{success: boolean}>(
        'nationwideJob/AssignNpAgentToJob',
        {jobId, npAgentId},
    );
}

/** Per-job outcome of a bulk assignment; a failed job never aborts the batch. */
export interface BulkAssignmentResult {
    jobId: number;
    succeeded: boolean;
    failureReason: string | null;
    emailStatus: AgentInboundEmailStatus | null;
}

export interface BulkAssignmentResponse {
    assigned: number;
    failed: number;
    results: BulkAssignmentResult[];
}

/** Assign one agent across many jobs; each job is gated and reported independently. */
export async function assignAgentToJobs(
    jobIds: number[],
    agentId: number,
    includeStopJobs = false,
    emailSubject?: string,
    emailNote?: string,
    resend = false,
): Promise<BulkAssignmentResponse> {
    return apiClient.post<BulkAssignmentResponse>(
        'nationwideJob/AssignAgentToJobs',
        {jobIds, agentId, includeStopJobs, emailSubject, emailNote, resend},
    );
}

/** Assign one network partner across many jobs. */
export async function assignNpAgentToJobs(
    jobIds: number[],
    npAgentId: number,
): Promise<BulkAssignmentResponse> {
    return apiClient.post<BulkAssignmentResponse>(
        'nationwideJob/AssignNpAgentToJobs',
        {jobIds, npAgentId},
    );
}

/**
 * Pre-flight (no side effects): would assigning this agent email them the agent alert, to what
 * address, and what exactly would it say (with `note` shown above the message)?
 */
export async function getAgentInboundEmailPreview(
    agentId: number,
    jobId: number,
    note?: string,
    options?: RequestOptions,
): Promise<AgentInboundEmailResult> {
    return apiClient.get<AgentInboundEmailResult>(
        'nationwideJob/GetAgentInboundEmailPreview',
        note ? {agentId, jobId, note} : {agentId, jobId},
        options,
    );
}

// ── Pricing ─────────────────────────────────────────────────────────

/**
 * Recalculate the job rate and return the new amount.
 */
export async function recalculateJobRate(
    jobId: number,
    isBooking: boolean,
    options?: RequestOptions,
): Promise<number> {
    return apiClient.get<number>('job/RecalculateJobRate', {jobId, isBooking}, options);
}

/**
 * Apply the recalculated job rate.
 */
export async function applyRecalculatedJobRate(jobId: number, isPrebook: boolean): Promise<void> {
    await apiClient.post('job/ApplyRecalculatedJobRate', null, {params: {jobId, isPrebook}});
}

/**
 * Manually reprice a job with a specific amount.
 */
export async function simpleRepriceJobManual(
    jobId: number,
    isPrebook: boolean,
    isBulk: boolean,
    newPrice: number,
): Promise<void> {
    await apiClient.post('job/SimpleRepriceJobManual', {jobId, isPrebook, isBulk, newPrice});
}

/**
 * Reprice a job using a base amount.
 */
export async function repriceJobWithBaseAmount(
    jobId: number,
    isPrebook: boolean,
    baseAmount: number,
): Promise<number> {
    return apiClient.post<number>('job/RepriceJobWithBaseAmount', {jobId, isPrebook, baseAmount});
}

// ── Search ──────────────────────────────────────────────────────────

/**
 * Search speed options by text.
 */
export async function searchSpeedOptions(searchTerm: string, options?: RequestOptions): Promise<Array<{id: number; text: string}>> {
    return apiClient.get<Array<{id: number; text: string}>>('job/SearchSpeedOptions', {searchTerm}, options);
}

// ── Inter-Courier Charge ────────────────────────────────────────────

export interface InterCourierChargeData {
    fromCourierId: number;
    toCourierId: number;
    reference: string;
    amount: number;
}

/**
 * Create an inter-courier charge (native React replacement for Angular bridge).
 */
export async function createInterCourierCharge(data: InterCourierChargeData): Promise<void> {
    await apiClient.post('job/InterCourierCharge', data);
}

// ── Aggregate Export ────────────────────────────────────────────────

export const dispatchExecutorApi = {
    getCourierById,
    getDispatchJobDetail,
    addFollowupEvent,
    addRestoreEvent,
    reAssignJobs,
    reSendJobs,
    isJobParent,
    isBulkJobParent,
    canAssignAgentToJob,
    assignAgentToJob,
    getAgentInboundEmailPreview,
    recalculateJobRate,
    applyRecalculatedJobRate,
    simpleRepriceJobManual,
    repriceJobWithBaseAmount,
    searchSpeedOptions,
    createInterCourierCharge,
};

export default dispatchExecutorApi;
