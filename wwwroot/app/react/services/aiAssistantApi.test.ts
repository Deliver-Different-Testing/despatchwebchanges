/** @jest-environment node */
/**
 * AI Summary API Service Tests
 *
 * Tests the AI summarization API functions: summarizeJobNotes (markdown),
 * summarizeJob, summarizeTaskDashboard, summarizeOperations,
 * summarizeCompliance (structured).
 */

import {
    summarizeJobNotes,
    summarizeJob,
    summarizeOperations,
    summarizeCompliance,
    summarizeTaskDashboard,
} from './aiAssistantApi';
import {apiClient} from './apiClient';

jest.mock('./apiClient', () => ({
    apiClient: {
        get: jest.fn(),
        post: jest.fn(),
        delete: jest.fn(),
    },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

const structuredResponse = {
    verdict: '✅ On track',
    severity: 'Ok' as const,
    keyFacts: [],
    attention: [],
    timeline: [],
    highlights: [],
    usage: {inputTokens: 100, outputTokens: 20},
};

describe('aiAssistantApi', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('summarizeJobNotes (markdown)', () => {
        it('calls correct endpoint with jobId', async () => {
            mockApiClient.post.mockResolvedValueOnce({
                summary: 'Test summary',
                usage: {inputTokens: 100, outputTokens: 20},
            });

            await summarizeJobNotes(42);

            expect(mockApiClient.post).toHaveBeenCalledWith(
                '/Ai/SummarizeJobNotes',
                null,
                {params: {jobId: 42}}
            );
        });
    });

    describe('summarizeJob (structured)', () => {
        it('calls correct endpoint with jobId', async () => {
            mockApiClient.post.mockResolvedValueOnce(structuredResponse);

            await summarizeJob(99);

            expect(mockApiClient.post).toHaveBeenCalledWith(
                '/Ai/SummarizeJob',
                null,
                {params: {jobId: 99}}
            );
        });

        it('passes abort signal via options', async () => {
            mockApiClient.post.mockResolvedValueOnce(structuredResponse);
            const controller = new AbortController();

            await summarizeJob(1, {signal: controller.signal});

            expect(mockApiClient.post).toHaveBeenCalledWith(
                '/Ai/SummarizeJob',
                null,
                expect.objectContaining({signal: controller.signal})
            );
        });
    });

    describe('summarizeTaskDashboard (structured)', () => {
        it('calls correct endpoint', async () => {
            mockApiClient.post.mockResolvedValueOnce(structuredResponse);

            await summarizeTaskDashboard();

            expect(mockApiClient.post).toHaveBeenCalledWith(
                '/Ai/SummarizeTaskDashboard',
                null,
                undefined
            );
        });

        it('passes abort signal', async () => {
            mockApiClient.post.mockResolvedValueOnce(structuredResponse);
            const controller = new AbortController();

            await summarizeTaskDashboard({signal: controller.signal});

            expect(mockApiClient.post).toHaveBeenCalledWith(
                '/Ai/SummarizeTaskDashboard',
                null,
                expect.objectContaining({signal: controller.signal})
            );
        });
    });

    describe('summarizeOperations (structured)', () => {
        it('calls correct endpoint', async () => {
            mockApiClient.post.mockResolvedValueOnce(structuredResponse);

            await summarizeOperations();

            expect(mockApiClient.post).toHaveBeenCalledWith(
                '/Ai/SummarizeOperations',
                null,
                undefined
            );
        });
    });

    describe('summarizeCompliance (structured)', () => {
        it('calls correct endpoint', async () => {
            mockApiClient.post.mockResolvedValueOnce(structuredResponse);

            await summarizeCompliance();

            expect(mockApiClient.post).toHaveBeenCalledWith(
                '/Ai/SummarizeCompliance',
                null,
                undefined
            );
        });
    });
});
