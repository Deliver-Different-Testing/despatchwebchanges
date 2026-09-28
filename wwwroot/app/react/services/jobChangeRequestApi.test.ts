/**
 * Job Change Request API Service Tests
 */

import {JobChangeRequestApiService, jobChangeRequestApi} from './jobChangeRequestApi';
import {apiClient} from './apiClient';

jest.mock('./apiClient', () => ({
    apiClient: {
        get: jest.fn(),
        post: jest.fn(),
    },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('JobChangeRequestApiService', () => {
    let service: JobChangeRequestApiService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new JobChangeRequestApiService();
    });

    describe('create', () => {
        it('posts to JobChangeRequest/Create with payload', async () => {
            mockApiClient.post.mockResolvedValueOnce({success: true});

            const result = await service.create({
                jobId: 42,
                fieldName: 'Quantity',
                requestedValue: '5',
                reason: 'extra package',
            });

            expect(mockApiClient.post).toHaveBeenCalledWith('JobChangeRequest/Create', {
                jobId: 42,
                fieldName: 'Quantity',
                requestedValue: '5',
                reason: 'extra package',
            });
            expect(result.success).toBe(true);
        });

        it('propagates errors', async () => {
            const error = {status: 400, statusText: 'Bad Request', message: 'invalid'};
            mockApiClient.post.mockRejectedValueOnce(error);

            await expect(service.create({jobId: 1, fieldName: 'Notes'})).rejects.toEqual(error);
        });
    });

    describe('approve / reject', () => {
        it('posts approve with rowVersion when provided', async () => {
            mockApiClient.post.mockResolvedValueOnce({success: true});

            await service.approve({requestId: 5, rowVersion: 'AAAAAA==', reason: 'ok'});

            expect(mockApiClient.post).toHaveBeenCalledWith('JobChangeRequest/Approve', {
                requestId: 5,
                rowVersion: 'AAAAAA==',
                reason: 'ok',
            });
        });

        it('posts reject', async () => {
            mockApiClient.post.mockResolvedValueOnce({success: true});

            await service.reject({requestId: 5, reason: 'no'});

            expect(mockApiClient.post).toHaveBeenCalledWith('JobChangeRequest/Reject', {
                requestId: 5,
                reason: 'no',
            });
        });
    });

    describe('forJob', () => {
        it('gets ForJob with jobId param', async () => {
            mockApiClient.get.mockResolvedValueOnce([]);

            await service.forJob(123);

            expect(mockApiClient.get).toHaveBeenCalledWith('JobChangeRequest/ForJob', {jobId: 123});
        });
    });

    describe('singleton', () => {
        it('exports a default instance', () => {
            expect(jobChangeRequestApi).toBeInstanceOf(JobChangeRequestApiService);
        });
    });
});
