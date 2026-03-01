/**
 * AI Assistant API Service
 *
 * Handles communication with the AI assistant backend endpoints.
 * Supports both standard and streaming (NDJSON) responses.
 */

import { apiClient } from './apiClient';

export interface AiChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface AiChatRequest {
    messages: AiChatMessage[];
    conversationId?: string;
}

export interface AiUsageInfo {
    inputTokens: number;
    outputTokens: number;
}

export interface AiChatResponse {
    message: string;
    usage: AiUsageInfo;
}

export interface AiChatChunk {
    text: string;
    isComplete: boolean;
    usage?: AiUsageInfo;
}

export interface AiSummaryResponse {
    summary: string;
    usage: AiUsageInfo;
}

/** Standard (non-streaming) chat request */
export function chat(request: AiChatRequest): Promise<AiChatResponse> {
    return apiClient.post<AiChatResponse>('/Ai/Chat', request);
}

/**
 * Streaming chat request using NDJSON.
 * Yields text chunks as they arrive from the server.
 */
export async function* streamChat(
    request: AiChatRequest,
    signal?: AbortSignal
): AsyncGenerator<AiChatChunk> {
    const response = await fetch('/Ai/StreamChat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify(request),
        signal,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            // Keep the last (potentially incomplete) line in the buffer
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                try {
                    const chunk = JSON.parse(trimmed) as AiChatChunk;
                    yield chunk;
                } catch {
                    // Skip malformed lines
                }
            }
        }

        // Process any remaining buffer
        if (buffer.trim()) {
            try {
                const chunk = JSON.parse(buffer.trim()) as AiChatChunk;
                yield chunk;
            } catch {
                // Skip malformed remainder
            }
        }
    } finally {
        reader.releaseLock();
    }
}

/** Summarize notes for a job */
export function summarizeJobNotes(jobId: number): Promise<AiSummaryResponse> {
    return apiClient.post<AiSummaryResponse>('/Ai/SummarizeJobNotes', null, { params: { jobId } });
}

/** Summarize event history for a job */
export function summarizeJobEvents(jobId: number): Promise<AiSummaryResponse> {
    return apiClient.post<AiSummaryResponse>('/Ai/SummarizeJobEvents', null, { params: { jobId } });
}
