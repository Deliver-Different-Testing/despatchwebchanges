/** @jest-environment node */
/**
 * AI Summary API Service Tests
 *
 * Tests the AI summarization API functions: summarizeJobNotes,
 * summarizeJob, summarizeTaskDashboard, summarizeOperations,
 * summarizeCompliance.
 */

import {
    summarizeJobNotes,
    summarizeJob,
    summarizeOperations,
    summarizeCompliance,
    summarizeTaskDashboard,
} from './aiAssistantApi';
import { apiClient } from './apiClient';

jest.mock('./apiClient', () => ({
    apiClient: {
        get: jest.fn(),
        post: jest.fn(),
        delete: jest.fn(),
    },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('aiAssistantApi', () => {
    describe('summarizeJobNotes', () => {
        it('should call correct endpoint with jobId', async () => {
            mockApiClient.post.mockResolvedValueOnce({
                summary: 'Test summary',
                usage: { inputTokens: 100, outputTokens: 20 },
            });

            await summarizeJobNotes(42);

            expect(mockApiClient.post).toHaveBeenCalledWith(
                '/Ai/SummarizeJobNotes',
                null,
                { params: { jobId: 42 } }
            );
        });
    });

    describe('summarizeJob', () => {
        it('should call correct endpoint with jobId', async () => {
            mockApiClient.post.mockResolvedValueOnce({
                summary: 'Job summary',
                usage: { inputTokens: 100, outputTokens: 20 },
            });

            await summarizeJob(99);

            expect(mockApiClient.post).toHaveBeenCalledWith(
                '/Ai/SummarizeJob',
                null,
                { params: { jobId: 99 } }
            );
        });

        it('should pass abort signal via options', async () => {
            mockApiClient.post.mockResolvedValueOnce({
                summary: 'Summary',
                usage: { inputTokens: 50, outputTokens: 10 },
            });
            const controller = new AbortController();

            await summarizeJob(1, { signal: controller.signal });

            expect(mockApiClient.post).toHaveBeenCalledWith(
                '/Ai/SummarizeJob',
                null,
                expect.objectContaining({ signal: controller.signal })
            );
        });
    });

    describe('summarizeTaskDashboard', () => {
        it('should call correct endpoint with no params', async () => {
            mockApiClient.post.mockResolvedValueOnce({
                summary: 'Dashboard summary',
                usage: { inputTokens: 200, outputTokens: 40 },
            });

            await summarizeTaskDashboard();

            expect(mockApiClient.post).toHaveBeenCalledWith('/Ai/SummarizeTaskDashboard');
        });
    });

    describe('summarizeOperations', () => {
        it('should call correct endpoint', async () => {
            mockApiClient.post.mockResolvedValueOnce({
                summary: 'Operations insight',
                usage: { inputTokens: 100, outputTokens: 25 },
            });

            await summarizeOperations();

            expect(mockApiClient.post).toHaveBeenCalledWith('/Ai/SummarizeOperations');
        });
    });

    describe('summarizeCompliance', () => {
        it('should call correct endpoint', async () => {
            mockApiClient.post.mockResolvedValueOnce({
                summary: 'Compliance summary',
                usage: { inputTokens: 150, outputTokens: 20 },
            });

            await summarizeCompliance();

            expect(mockApiClient.post).toHaveBeenCalledWith('/Ai/SummarizeCompliance');
        });
    });
});
