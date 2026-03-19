/**
 * AI Assistant API Service Tests
 *
 * Tests the AI assistant API functions including:
 * - suggestCouriers (returns structured AiCourierSuggestionResponse)
 * - summarizeJobNotes, summarizeJob, analyzeLateAlert
 */

import {
    suggestCouriers,
    summarizeJobNotes,
    summarizeJob,
    analyzeLateAlert,
    summarizeOperations,
    summarizeCompliance,
    summarizeTaskDashboard,
} from './aiAssistantApi';
import { apiClient } from './apiClient';
import { createMockApiError } from '../__testUtils__';

jest.mock('./apiClient', () => ({
    apiClient: {
        get: jest.fn(),
        post: jest.fn(),
        delete: jest.fn(),
    },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('aiAssistantApi', () => {
    describe('suggestCouriers', () => {
        const mockResponse = {
            summary: '1. **Jane** — lowest workload\n2. **John** — closest driver',
            usage: { inputTokens: 250, outputTokens: 40 },
            couriers: [
                { courierId: 10, code: 'C10', firstName: 'John' },
                { courierId: 11, code: 'C11', firstName: 'Jane' },
            ],
        };

        it('should call correct endpoint with jobId', async () => {
            mockApiClient.post.mockResolvedValueOnce(mockResponse);

            await suggestCouriers(42);

            expect(mockApiClient.post).toHaveBeenCalledWith(
                '/Ai/SuggestCouriers',
                null,
                { params: { jobId: 42 } }
            );
        });

        it('should return summary, usage, and couriers list', async () => {
            mockApiClient.post.mockResolvedValueOnce(mockResponse);

            const result = await suggestCouriers(1);

            expect(result.summary).toContain('Jane');
            expect(result.usage.inputTokens).toBe(250);
            expect(result.couriers).toHaveLength(2);
            expect(result.couriers[0]).toEqual({
                courierId: 10,
                code: 'C10',
                firstName: 'John',
            });
        });

        it('should return empty couriers when none available', async () => {
            mockApiClient.post.mockResolvedValueOnce({
                summary: 'No courier data available for suggestions.',
                usage: { inputTokens: 0, outputTokens: 0 },
                couriers: [],
            });

            const result = await suggestCouriers(1);

            expect(result.summary).toBe('No courier data available for suggestions.');
            expect(result.couriers).toEqual([]);
        });

        it.each([
            ['404 Not Found', createMockApiError({ status: 404, message: 'Job not found' })],
            ['500 Server Error', createMockApiError({ status: 500, message: 'Server error' })],
        ])('should propagate %s errors', async (_, error) => {
            mockApiClient.post.mockRejectedValueOnce(error);
            await expect(suggestCouriers(1)).rejects.toEqual(error);
        });
    });

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

    describe('analyzeLateAlert', () => {
        it('should call correct endpoint with jobId', async () => {
            mockApiClient.post.mockResolvedValueOnce({
                summary: 'Late analysis',
                usage: { inputTokens: 80, outputTokens: 15 },
            });

            await analyzeLateAlert(7);

            expect(mockApiClient.post).toHaveBeenCalledWith(
                '/Ai/AnalyzeLateAlert',
                null,
                { params: { jobId: 7 } }
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
