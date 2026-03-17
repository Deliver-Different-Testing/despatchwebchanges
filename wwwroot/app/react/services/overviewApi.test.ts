import {overviewApi} from './overviewApi';
import {apiClient} from './apiClient';

jest.mock('./apiClient', () => ({
    apiClient: {
        get: jest.fn(),
        post: jest.fn(),
        delete: jest.fn(),
    },
}));

jest.mock('../utils/dateUtils', () => ({
    formatDateForApiWithTzs: jest.fn((d: Date) => d.toISOString()),
    parseDateFromApi: jest.fn((s: string) => `parsed:${s}`),
    formatLongDateTime: jest.fn((s: string) => `formatted:${s}`),
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('overviewApi', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getAllJobs', () => {
        it('calls correct endpoint with parameters', async () => {
            const mockResponse = {items: [], total: 0, page: 1, pages: 0};
            mockApiClient.get.mockResolvedValueOnce(mockResponse);

            const params = {
                statusGroup: 1,
                page: 1,
                limit: 20,
                search: 'test',
                orderBy: 'jobName',
                orderDirection: 'asc',
            };

            const result = await overviewApi.getAllJobs(params);

            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/overview',
                expect.objectContaining({
                    statusGroup: 1,
                    page: 1,
                    limit: 20,
                    search: 'test',
                    orderBy: 'jobName',
                    orderDirection: 'asc',
                }),
                undefined,
            );
            expect(result).toEqual(mockResponse);
        });

        it('formats dates when startDate and endDate are provided', async () => {
            mockApiClient.get.mockResolvedValueOnce({items: [], total: 0, page: 1, pages: 0});

            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-31');

            await overviewApi.getAllJobs({
                page: 1,
                limit: 20,
                startDate,
                endDate,
            });

            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/overview',
                expect.objectContaining({
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                }),
                undefined,
            );
        });

        it('omits dates when not provided', async () => {
            mockApiClient.get.mockResolvedValueOnce({items: [], total: 0, page: 1, pages: 0});

            await overviewApi.getAllJobs({page: 1, limit: 20});

            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/overview',
                expect.objectContaining({
                    startDate: undefined,
                    endDate: undefined,
                }),
                undefined,
            );
        });

        it('passes regions, speeds, and couriers arrays', async () => {
            mockApiClient.get.mockResolvedValueOnce({items: [], total: 0, page: 1, pages: 0});

            await overviewApi.getAllJobs({
                page: 1,
                limit: 20,
                regions: [1, 2],
                speeds: [3],
                couriers: [10, 20],
            });

            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/overview',
                expect.objectContaining({
                    regions: [1, 2],
                    speeds: [3],
                    couriers: [10, 20],
                }),
                undefined,
            );
        });

        it('passes abort signal via options', async () => {
            mockApiClient.get.mockResolvedValueOnce({items: [], total: 0, page: 1, pages: 0});
            const controller = new AbortController();

            await overviewApi.getAllJobs({page: 1, limit: 20}, {signal: controller.signal});

            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/overview',
                expect.any(Object),
                {signal: controller.signal},
            );
        });

        it('propagates errors', async () => {
            const error = new Error('Network error');
            mockApiClient.get.mockRejectedValueOnce(error);

            await expect(overviewApi.getAllJobs({page: 1, limit: 20})).rejects.toThrow('Network error');
        });
    });

    describe('getAllRegions', () => {
        it('calls correct endpoint', async () => {
            const mockRegions = [{id: 1, text: 'London'}, {id: 2, text: 'Manchester'}];
            mockApiClient.get.mockResolvedValueOnce(mockRegions);

            const result = await overviewApi.getAllRegions();

            expect(mockApiClient.get).toHaveBeenCalledWith('/overview/GetAllRegions', undefined, undefined);
            expect(result).toEqual(mockRegions);
        });

        it('propagates errors', async () => {
            mockApiClient.get.mockRejectedValueOnce(new Error('Server error'));
            await expect(overviewApi.getAllRegions()).rejects.toThrow('Server error');
        });
    });

    describe('getAllSpeeds', () => {
        it('calls correct endpoint', async () => {
            const mockSpeeds = [{id: 1, text: 'Same Day'}, {id: 2, text: 'Next Day'}];
            mockApiClient.get.mockResolvedValueOnce(mockSpeeds);

            const result = await overviewApi.getAllSpeeds();

            expect(mockApiClient.get).toHaveBeenCalledWith('/overview/GetAllSpeeds', undefined, undefined);
            expect(result).toEqual(mockSpeeds);
        });
    });

    describe('getStats', () => {
        it('calls correct endpoint and returns stats', async () => {
            const mockStats = {active: 10, inactive: 3, completed: 42};
            mockApiClient.get.mockResolvedValueOnce(mockStats);

            const result = await overviewApi.getStats();

            expect(mockApiClient.get).toHaveBeenCalledWith('/overview/GetStats', undefined, undefined);
            expect(result).toEqual(mockStats);
        });
    });

    describe('getParentJobMap', () => {
        it('calls correct endpoint with jobId', async () => {
            const mockConfig = {center: {lat: 51.5, lng: -0.1}, zoom: 12, job: null, selectedJobIndex: 0, courierLocation: null};
            mockApiClient.get.mockResolvedValueOnce(mockConfig);

            const result = await overviewApi.getParentJobMap(123);

            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/overview/GetParentJobMap',
                {jobId: 123},
                undefined,
            );
            expect(result).toEqual(mockConfig);
        });
    });

    describe('getOpenJobs', () => {
        it('calls correct endpoint and transforms DTOs', async () => {
            const mockDtos = [
                {
                    jobId: 1,
                    reference: 'JOB-001',
                    status: 'New',
                    pickupTime: '2024-01-15T10:00:00',
                    pickupName: 'Warehouse A',
                    pickupAddress: '123 Main St',
                    deliveryTime: '2024-01-15T14:00:00',
                    deliveryName: 'Office B',
                    deliveryAddress: '456 High St',
                    driverName: 'John',
                    completedToday: 5,
                    lastCompleted: '13:00',
                    quantity: 2,
                    packageType: 'Parcel',
                    mileage: 15,
                },
            ];
            mockApiClient.get.mockResolvedValueOnce(mockDtos);

            const result = await overviewApi.getOpenJobs({});

            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/overview/GetOpenJobs',
                expect.any(Object),
                undefined,
            );
            expect(result).toHaveLength(1);
            expect(result[0]._pickUpTimeStr).toBe('formatted:parsed:2024-01-15T10:00:00');
            expect(result[0]._deliveryTimeStr).toBe('formatted:parsed:2024-01-15T14:00:00');
        });

        it('handles missing pickup/delivery times', async () => {
            const mockDtos = [
                {
                    jobId: 2,
                    reference: 'JOB-002',
                    status: 'New',
                    pickupName: 'Place',
                    pickupAddress: 'Address',
                    deliveryName: 'Place2',
                    deliveryAddress: 'Address2',
                    driverName: 'Jane',
                    completedToday: 0,
                    quantity: 1,
                    packageType: 'Box',
                    mileage: 5,
                },
            ];
            mockApiClient.get.mockResolvedValueOnce(mockDtos);

            const result = await overviewApi.getOpenJobs({});

            expect(result[0]._pickUpTimeStr).toBeUndefined();
            expect(result[0]._deliveryTimeStr).toBeUndefined();
        });

        it('formats dates when provided', async () => {
            mockApiClient.get.mockResolvedValueOnce([]);

            const startDate = new Date('2024-06-01');
            const endDate = new Date('2024-06-30');

            await overviewApi.getOpenJobs({startDate, endDate});

            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/overview/GetOpenJobs',
                expect.objectContaining({
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                }),
                undefined,
            );
        });
    });

    describe('searchCouriers', () => {
        it('calls correct endpoint with search text', async () => {
            const mockResults = [{id: 1, text: 'Courier A'}];
            mockApiClient.get.mockResolvedValueOnce(mockResults);

            const result = await overviewApi.searchCouriers('Courier');

            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/courier/AllActiveSearch',
                {search: 'Courier'},
                undefined,
            );
            expect(result).toEqual(mockResults);
        });

        it('propagates errors', async () => {
            mockApiClient.get.mockRejectedValueOnce(new Error('Search failed'));
            await expect(overviewApi.searchCouriers('test')).rejects.toThrow('Search failed');
        });
    });
});
