/**
 * AI Summary API Service
 *
 * Handles communication with the AI summarization backend endpoints.
 * Notes/events summaries return free-form markdown; the four briefing-style
 * summaries (job, task dashboard, operations, compliance) return a structured
 * shape that the AiSummaryCard component renders directly.
 */

import {apiClient, RequestOptions} from './apiClient';

export interface AiUsageInfo {
    inputTokens: number;
    outputTokens: number;
}

export interface AiSummaryResponse {
    summary: string;
    usage: AiUsageInfo;
}

export type SummarySeverity = 'Ok' | 'Info' | 'Caution' | 'Urgent' | 'Critical';
export type TimelineStatus = 'Ok' | 'Pending' | 'Warning' | 'Late';

export interface AttentionItem {
    headline: string;
    action: string;
    severity: SummarySeverity;
}

export interface TimelineItem {
    label: string;
    detail: string;
    status: TimelineStatus;
}

export interface StructuredSummaryResponse {
    verdict: string;
    severity: SummarySeverity;
    keyFacts: string[];
    attention: AttentionItem[];
    timeline: TimelineItem[];
    highlights: string[];
    usage: AiUsageInfo;
}

/** Summarize notes for a job (markdown) */
export function summarizeJobNotes(jobId: number): Promise<AiSummaryResponse> {
    return apiClient.post<AiSummaryResponse>('/Ai/SummarizeJobNotes', null, {params: {jobId}});
}

/** Summarize event history for a job (markdown) */
export function summarizeJobEvents(jobId: number): Promise<AiSummaryResponse> {
    return apiClient.post<AiSummaryResponse>('/Ai/SummarizeJobEvents', null, {params: {jobId}});
}

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
