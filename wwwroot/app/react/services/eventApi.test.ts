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

// Mock fetch globally for exsalerateActivity
const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('EventApiService', () => {
    let service: EventApiService;

    beforeEach(() => {
        service = new EventApiService();
        jest.clearAllMocks();
        mockFetch.mockClear();
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
        const createMockResponse = (ok: boolean = true, statusText: string = 'OK') => {
            return Promise.resolve({
                ok,
                status: ok ? 200 : 500,
                statusText,
            } as Response);
        };

        it('should call fetch with correct URL and query parameters', async () => {
            mockFetch.mockReturnValueOnce(createMockResponse());

            await service.exsalerateActivity('Compliment', 'Great service', 456, 'JOB-001');

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('job/ExsalerateActivity?'),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    }),
                    credentials: 'same-origin',
                })
            );

            // Verify query parameters
            const callUrl = mockFetch.mock.calls[0][0] as string;
            expect(callUrl).toContain('eventName=Compliment');
            expect(callUrl).toContain('notes=Great+service');
            expect(callUrl).toContain('clientId=456');
            expect(callUrl).toContain('jobNumber=JOB-001');
        });

        it('should throw error when response is not ok', async () => {
            mockFetch.mockReturnValueOnce(createMockResponse(false, 'Internal Server Error'));

            await expect(
                service.exsalerateActivity('Compliment', 'Test', 123, 'JOB-001')
            ).rejects.toThrow('Failed to log exsalerate activity: Internal Server Error');
        });

        it('should encode special characters in parameters', async () => {
            mockFetch.mockReturnValueOnce(createMockResponse());

            await service.exsalerateActivity('Complaint', 'Bad & slow service', 789, 'JOB-002');

            const callUrl = mockFetch.mock.calls[0][0] as string;
            expect(callUrl).toContain('notes=Bad+%26+slow+service');
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
