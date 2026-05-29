/**
 * AI Summary API Service
 *
 * Handles communication with the AI summarization backend endpoints.
 */

import { apiClient, RequestOptions } from './apiClient';

export interface AiUsageInfo {
    inputTokens: number;
    outputTokens: number;
}

export interface AiSummaryResponse {
    summary: string;
    usage: AiUsageInfo;
}

/** Summarize notes for a job */
export function summarizeJobNotes(jobId: number): Promise<AiSummaryResponse> {
    return apiClient.post<AiSummaryResponse>('/Ai/SummarizeJobNotes', null, { params: { jobId } });
}

/** Summarize event history for a job */
export function summarizeJobEvents(jobId: number): Promise<AiSummaryResponse> {
    return apiClient.post<AiSummaryResponse>('/Ai/SummarizeJobEvents', null, { params: { jobId } });
}

/** Summarize task dashboard for daily briefing */
export function summarizeTaskDashboard(): Promise<AiSummaryResponse> {
    return apiClient.post<AiSummaryResponse>('/Ai/SummarizeTaskDashboard');
}

/** Combined job summary (notes + events + details) */
export function summarizeJob(jobId: number, options?: RequestOptions): Promise<AiSummaryResponse> {
    return apiClient.post<AiSummaryResponse>('/Ai/SummarizeJob', null, { params: { jobId }, ...options });
}

/** Operations insight summary for overview dashboard */
export function summarizeOperations(): Promise<AiSummaryResponse> {
    return apiClient.post<AiSummaryResponse>('/Ai/SummarizeOperations');
}

/** Compliance risk summary for driver management */
export function summarizeCompliance(): Promise<AiSummaryResponse> {
    return apiClient.post<AiSummaryResponse>('/Ai/SummarizeCompliance');
}

/** Check whether AI features are enabled server-side */
export async function fetchAiEnabled(): Promise<boolean> {
    const result = await apiClient.get<{ enabled: boolean }>('/Ai/IsEnabled');
    return result.enabled;
}
