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
    draftCourierMessage,
    draftEmail,
    draftPodEmail,
    draftNote,
    extractBlockers,
    analyzePricing,
    triageChangeRequest,
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

    describe('drafting', () => {
        const draftResponse = {draft: 'polished text', usage: {inputTokens: 50, outputTokens: 10}};
        const emailDraftResponse = {subject: 'S', body: 'B', usage: {inputTokens: 60, outputTokens: 20}};

        it('draftCourierMessage posts the request body', async () => {
            mockApiClient.post.mockResolvedValueOnce(draftResponse);
            const request = {recipientName: 'Dave', recipientType: 0, messageType: 2, seed: 'pu late'};

            await draftCourierMessage(request);

            expect(mockApiClient.post).toHaveBeenCalledWith('/Ai/DraftMessage', request, undefined);
        });

        it('draftEmail posts the request body', async () => {
            mockApiClient.post.mockResolvedValueOnce(emailDraftResponse);
            const request = {recipientNames: ['Dave'], seedSubject: '', seedBody: 'hi'};

            await draftEmail(request);

            expect(mockApiClient.post).toHaveBeenCalledWith('/Ai/DraftEmail', request, undefined);
        });

        it('draftPodEmail calls endpoint with jobId param', async () => {
            mockApiClient.post.mockResolvedValueOnce(emailDraftResponse);

            await draftPodEmail(77);

            expect(mockApiClient.post).toHaveBeenCalledWith(
                '/Ai/DraftPodEmail',
                null,
                {params: {jobId: 77}}
            );
        });

        it('draftNote posts the request body and passes the abort signal', async () => {
            mockApiClient.post.mockResolvedValueOnce(draftResponse);
            const controller = new AbortController();
            const request = {jobId: 5, noteTypeId: 2, seed: 'cust wants call'};

            await draftNote(request, {signal: controller.signal});

            expect(mockApiClient.post).toHaveBeenCalledWith(
                '/Ai/DraftNote',
                request,
                expect.objectContaining({signal: controller.signal})
            );
        });
    });

    describe('insights', () => {
        it('extractBlockers calls endpoint with jobId param', async () => {
            mockApiClient.post.mockResolvedValueOnce({blockers: [], summary: '', severity: 'Ok', usage: {inputTokens: 1, outputTokens: 1}});

            await extractBlockers(7);

            expect(mockApiClient.post).toHaveBeenCalledWith('/Ai/ExtractBlockers', null, {params: {jobId: 7}});
        });

        it('analyzePricing passes jobId and accessorialChargeGroupId', async () => {
            mockApiClient.post.mockResolvedValueOnce({anomaly: null, suggestions: [], usage: {inputTokens: 1, outputTokens: 1}});

            await analyzePricing(7, 5);

            expect(mockApiClient.post).toHaveBeenCalledWith(
                '/Ai/AnalyzePricing',
                null,
                {params: {jobId: 7, accessorialChargeGroupId: 5}}
            );
        });

        it('triageChangeRequest passes requestId and jobId', async () => {
            mockApiClient.post.mockResolvedValueOnce({recommendedAction: 'approve', confidence: 0.8, rationale: '', riskFactors: [], usage: {inputTokens: 1, outputTokens: 1}});

            await triageChangeRequest(42, 7);

            expect(mockApiClient.post).toHaveBeenCalledWith(
                '/Ai/TriageChangeRequest',
                null,
                {params: {requestId: 42, jobId: 7}}
            );
        });
    });
});
