/**
 * AI Summary API Service
 *
 * Handles communication with the AI backend endpoints. The briefing-style
 * summaries (job, task dashboard, operations, compliance) return a structured
 * shape that the AiSummaryCard component renders directly.
 */

import {
    AiDraftResponse, AiEmailDraftResponse,
    ChangeRequestTriageResponse,
    DraftEmailRequest, DraftMessageRequest, DraftNoteRequest, ExtractBlockersResponse,
    ExtractJobIntakeRequest, InboxTriageResponse, JobIntakeResponse,
    ParseSearchQueryRequest, PriceExplanationResponse, PricingAnalysisResponse,
    SearchCriteriaResponse, StructuredSummaryResponse
} from "../interfaces/ai";
import {apiClient} from './apiClient';
import {RequestOptions} from "./requestOptions";


export type SummarySeverity = 'Ok' | 'Info' | 'Caution' | 'Urgent' | 'Critical';
export type TimelineStatus = 'Ok' | 'Pending' | 'Warning' | 'Late';

/** Structured task dashboard briefing */
export function summarizeTaskDashboard(options?: RequestOptions): Promise<StructuredSummaryResponse> {
    return apiClient.post<StructuredSummaryResponse>('/Ai/SummarizeTaskDashboard', null, options);
}

/** Structured job briefing (verdict + attention + key facts + timeline) */
export function summarizeJob(jobId: number, options?: RequestOptions): Promise<StructuredSummaryResponse> {
    return apiClient.post<StructuredSummaryResponse>('/Ai/SummarizeJob', null, {params: {jobId}, ...options});
}

/** Structured operations health summary */
export function summarizeOperations(options?: RequestOptions): Promise<StructuredSummaryResponse> {
    return apiClient.post<StructuredSummaryResponse>('/Ai/SummarizeOperations', null, options);
}

/** Structured compliance risk briefing */
export function summarizeCompliance(options?: RequestOptions): Promise<StructuredSummaryResponse> {
    return apiClient.post<StructuredSummaryResponse>('/Ai/SummarizeCompliance', null, options);
}

// ---------------------------------------------------------------------------
//  Drafting — AI rewrites a rough "seed" into a polished message/note/email.
//  Body-only drafts fill a single text field; email drafts fill subject + body.
// ---------------------------------------------------------------------------

/** Draft a courier/staff message body. */
export function draftCourierMessage(
    request: DraftMessageRequest,
    options?: RequestOptions,
): Promise<AiDraftResponse> {
    return apiClient.post<AiDraftResponse>('/Ai/DraftMessage', request, options);
}

/** Draft an email subject + body (compose-email dialog). */
export function draftEmail(
    request: DraftEmailRequest,
    options?: RequestOptions,
): Promise<AiEmailDraftResponse> {
    return apiClient.post<AiEmailDraftResponse>('/Ai/DraftEmail', request, options);
}

/** Draft the POD delivery email subject + body for a job. */
export function draftPodEmail(jobId: number, options?: RequestOptions): Promise<AiEmailDraftResponse> {
    return apiClient.post<AiEmailDraftResponse>('/Ai/DraftPodEmail', null, {params: {jobId}, ...options});
}

/** Draft a job note of a chosen type. */
export function draftNote(request: DraftNoteRequest, options?: RequestOptions): Promise<AiDraftResponse> {
    return apiClient.post<AiDraftResponse>('/Ai/DraftNote', request, options);
}


/** Extract structured blockers/tags from a job's notes. */
export function extractBlockers(jobId: number, options?: RequestOptions): Promise<ExtractBlockersResponse> {
    return apiClient.post<ExtractBlockersResponse>('/Ai/ExtractBlockers', null, {params: {jobId}, ...options});
}

/** Re-rate anomaly + suggested accessorial charges for a job. */
export function analyzePricing(
    jobId: number,
    accessorialChargeGroupId: number,
    options?: RequestOptions,
): Promise<PricingAnalysisResponse> {
    return apiClient.post<PricingAnalysisResponse>(
        '/Ai/AnalyzePricing',
        null,
        {params: {jobId, accessorialChargeGroupId}, ...options},
    );
}

/** Advisory approve/reject/clarify recommendation for a pending change request. */
export function triageChangeRequest(
    requestId: number,
    jobId: number,
    options?: RequestOptions,
): Promise<ChangeRequestTriageResponse> {
    return apiClient.post<ChangeRequestTriageResponse>(
        '/Ai/TriageChangeRequest',
        null,
        {params: {requestId, jobId}, ...options},
    );
}


/**
 * Read a pasted booking request into the Create Job form. Fills fields only — the
 * operator reviews every one and submits the job themselves.
 */
export function extractJobIntake(
    request: ExtractJobIntakeRequest,
    options?: RequestOptions,
): Promise<JobIntakeResponse> {
    return apiClient.post<JobIntakeResponse>('/Ai/ExtractJobIntake', request, options);
}

/** Turn one line of dispatcher shorthand into search criteria. Fills the form; does not search. */
export function parseSearchQuery(
    request: ParseSearchQueryRequest,
    options?: RequestOptions,
): Promise<SearchCriteriaResponse> {
    return apiClient.post<SearchCriteriaResponse>('/Ai/ParseSearchQuery', request, options);
}

/** Triage every open message conversation in a single call. */
export function triageInbox(options?: RequestOptions): Promise<InboxTriageResponse> {
    return apiClient.post<InboxTriageResponse>('/Ai/TriageInbox', null, options);
}

/** Plain-English account of why a job cost what it did, for a customer price query. */
export function explainPrice(
    jobId: number,
    isPrebook = false,
    isArchived = false,
    options?: RequestOptions,
): Promise<PriceExplanationResponse> {
    return apiClient.post<PriceExplanationResponse>(
        '/Ai/ExplainPrice',
        null,
        {params: {jobId, isPrebook, isArchived}, ...options},
    );
}
