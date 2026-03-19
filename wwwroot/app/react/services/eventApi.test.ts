/**
 * Event API Service Tests
 */

import {EventApiService, eventApi} from './eventApi';
import {apiClient} from './apiClient';

// Mock the apiClient
jest.mock('./apiClient', () => ({
    apiClient: {
        get: jest.fn(),
        post: jest.fn(),
    },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('EventApiService', () => {
    let service: EventApiService;

    beforeEach(() => {
        service = new EventApiService();
    });

    describe('getEventTypes', () => {
        it('should call apiClient.get with correct endpoint', async () => {
            const mockEventTypes = [
                {id: 66, text: 'Other'},
                {id: 7, text: 'Compliment'},
                {id: 92, text: 'Complaint'},
            ];
            mockApiClient.get.mockResolvedValueOnce(mockEventTypes);

            const result = await service.getEventTypes();

            expect(mockApiClient.get).toHaveBeenCalledWith('job/EventTypeList');
            expect(result).toEqual(mockEventTypes);
        });

        it('should propagate errors from apiClient', async () => {
            const error = {status: 500, statusText: 'Internal Server Error', message: 'Server error'};
            mockApiClient.get.mockRejectedValueOnce(error);

            await expect(service.getEventTypes()).rejects.toEqual(error);
        });
    });

    describe('addEvent', () => {
        it('should call apiClient.post with correct endpoint and data', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            const eventData = {
                jobId: 123,
                notes: 'Test notes',
                eventTypeId: 66,
                eventDueDate: '2024-01-15T10:00:00',
            };

            await service.addEvent(eventData);

            expect(mockApiClient.post).toHaveBeenCalledWith('job/addEvent', eventData);
        });

        it('should propagate errors from apiClient', async () => {
            const error = {status: 400, statusText: 'Bad Request', message: 'Invalid event data'};
            mockApiClient.post.mockRejectedValueOnce(error);

            await expect(service.addEvent({
                jobId: 123,
                notes: 'Test',
                eventTypeId: 66,
                eventDueDate: '2024-01-15',
            })).rejects.toEqual(error);
        });
    });

    describe('exsalerateActivity', () => {
        it('should call apiClient.post with correct endpoint and params', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await service.exsalerateActivity('Compliment', 'Great service', 456, 'JOB-001');

            expect(mockApiClient.post).toHaveBeenCalledWith(
                'job/ExsalerateActivity',
                null,
                {
                    params: {
                        eventName: 'Compliment',
                        notes: 'Great service',
                        clientId: 456,
                        jobNumber: 'JOB-001',
                    },
                }
            );
        });

        it('should propagate errors from apiClient', async () => {
            const error = {status: 500, statusText: 'Internal Server Error', message: 'Server error'};
            mockApiClient.post.mockRejectedValueOnce(error);

            await expect(
                service.exsalerateActivity('Compliment', 'Test', 123, 'JOB-001')
            ).rejects.toEqual(error);
        });

        it('should handle special characters in parameters', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await service.exsalerateActivity('Complaint', 'Bad & slow service', 789, 'JOB-002');

            expect(mockApiClient.post).toHaveBeenCalledWith(
                'job/ExsalerateActivity',
                null,
                {
                    params: {
                        eventName: 'Complaint',
                        notes: 'Bad & slow service',
                        clientId: 789,
                        jobNumber: 'JOB-002',
                    },
                }
            );
        });
    });

    describe('getDispatchJobDetail', () => {
        it('should call apiClient.get with correct endpoint and jobId', async () => {
            const mockJobDetail = {
                id: 123,
                jobNo: 'JOB-001',
                isArchived: false,
            };
            mockApiClient.get.mockResolvedValueOnce(mockJobDetail);

            const result = await service.getDispatchJobDetail(123);

            expect(mockApiClient.get).toHaveBeenCalledWith('job/DispatchJobDetail', {jobId: 123});
            expect(result).toEqual(mockJobDetail);
        });

        it('should propagate errors from apiClient', async () => {
            const error = {status: 404, statusText: 'Not Found', message: 'Job not found'};
            mockApiClient.get.mockRejectedValueOnce(error);

            await expect(service.getDispatchJobDetail(999)).rejects.toEqual(error);
        });
    });

    describe('eventApi singleton', () => {
        it('should export a default instance of EventApiService', () => {
            expect(eventApi).toBeInstanceOf(EventApiService);
        });

        it('should have all methods available on the singleton', () => {
            expect(typeof eventApi.getEventTypes).toBe('function');
            expect(typeof eventApi.addEvent).toBe('function');
            expect(typeof eventApi.exsalerateActivity).toBe('function');
            expect(typeof eventApi.getDispatchJobDetail).toBe('function');
        });
    });
});
