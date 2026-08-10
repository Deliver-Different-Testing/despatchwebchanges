/**
 * Dispatch Executor API Service
 *
 * API methods used by the dispatch executor workflow that aren't
 * covered by other React API services. Complements jobListApi.ts,
 * jobApi.ts, jobDetailApi.ts, etc.
 */

import {apiClient} from './apiClient';
import type {ActiveCourierViewModel} from '../../interfaces/courier.interface';
import type {IDispatchJobDto} from '../../interfaces/job.interface';
import {transformDispatchJobDTO} from '../../functions/dtoMappings';
import type {DispatchJob} from '../interfaces/dispatchJob';
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
export type AgentInboundEmailStatus = 'Queued' | 'NoAgentEmail' | 'NoInboundUrl' | 'Failed';

export interface AgentInboundEmailResult {
    status: AgentInboundEmailStatus;
    agentEmail: string | null;
    willEmail: boolean;
    /** Hardcoded default subject template (returned by the preview endpoint only). */
    defaultSubject?: string;
    /** Hardcoded default body template (returned by the preview endpoint only). */
    defaultBody?: string;
}

/**
 * Assign an agent to a job. Returns whether the agent was emailed the inbound-agent
 * link (best-effort — the assignment itself always succeeds if this resolves).
 *
 * `emailSubject`/`emailBody` optionally override the hardcoded default templates for this
 * send (the dispatcher's edits from the confirmation dialog); omit to use the defaults.
 */
export async function assignAgentToJob(
    jobId: number,
    agentId: number,
    includeStopJobs = false,
    emailSubject?: string,
    emailBody?: string,
): Promise<AgentInboundEmailResult> {
    return apiClient.post<AgentInboundEmailResult>(
        'nationwideJob/AssignAgentToJob',
        {jobId, agentId, includeStopJobs, emailSubject, emailBody},
    );
}

/**
 * Pre-flight (no side effects): would assigning this agent email them the inbound-agent
 * link, and to what address? Used to warn the dispatcher before they confirm.
 */
export async function getAgentInboundEmailPreview(
    agentId: number,
    jobId: number,
    options?: RequestOptions,
): Promise<AgentInboundEmailResult> {
    return apiClient.get<AgentInboundEmailResult>(
        'nationwideJob/GetAgentInboundEmailPreview',
        {agentId, jobId},
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
    clientId: number;
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
