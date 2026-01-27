/**
 * Recurring Jobs API Service Tests
 */

import axios from 'axios';
import {recurringJobsApi} from './recurringJobsApi';
import {apiClient} from './apiClient';
import {
    PaginatedRecurringJobsResponseDto,
    RecurringJobQuery,
    SpeedOption,
} from '../interfaces';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock the apiClient
jest.mock('./apiClient', () => ({
    apiClient: {
        get: jest.fn(),
        post: jest.fn(),
    },
}));

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockCreateObjectURL = jest.fn(() => 'blob:test-url');
const mockRevokeObjectURL = jest.fn();
URL.createObjectURL = mockCreateObjectURL;
URL.revokeObjectURL = mockRevokeObjectURL;

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('recurringJobsApi', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getPreBookJobs', () => {
        const mockQuery: RecurringJobQuery = {
            order: 'booked',
            orderDirection: 'desc',
            limit: 50,
            page: 1,
            active: true,
        };

        const mockResponseDto: PaginatedRecurringJobsResponseDto = {
            items: [
                {
                    id: 1,
                    booked: '2024-01-15T10:00:00Z',
                    nextDueTime: '2024-01-20T14:00:00Z',
                    client: 'Acme Corp',
                    jobNo: 'RJ-001',
                    clientId: 100,
                    courier: 'Express Courier',
                    speed: 'Same Day',
                    customJobName: 'Weekly delivery',
                    pickupAddress: {
                        addressLine1: 'Warehouse A',
                        addressLine2: '',
                        addressLine3: '',
                        addressLine4: '123 Main St',
                        addressLine5: 'Auckland',
                        addressLine6: '',
                        addressLine7: '1010',
                        addressLine8: '',
                        fullAddress: '123 Main St, Auckland 1010',
                    },
                    deliveryAddress: {
                        addressLine1: 'Client Office',
                        addressLine2: '',
                        addressLine3: '',
                        addressLine4: '456 Business Ave',
                        addressLine5: 'Wellington',
                        addressLine6: '',
                        addressLine7: '6011',
                        addressLine8: '',
                        fullAddress: '456 Business Ave, Wellington 6011',
                    },
                },
                {
                    id: 2,
                    booked: '2024-01-10T09:00:00Z',
                    client: 'Beta Inc',
                    jobNo: 'RJ-002',
                    clientId: 101,
                    courier: 'Standard Delivery',
                    speed: 'Next Day',
                    pickupAddress: {
                        addressLine1: 'Office B',
                        addressLine2: '',
                        addressLine3: '',
                        addressLine4: '789 Park Rd',
                        addressLine5: 'Christchurch',
                        addressLine6: '',
                        addressLine7: '8011',
                        addressLine8: '',
                        fullAddress: '789 Park Rd, Christchurch 8011',
                    },
                    deliveryAddress: {
                        addressLine1: 'Distribution Center',
                        addressLine2: '',
                        addressLine3: '',
                        addressLine4: '321 Industrial Way',
                        addressLine5: 'Hamilton',
                        addressLine6: '',
                        addressLine7: '3200',
                        addressLine8: '',
                        fullAddress: '321 Industrial Way, Hamilton 3200',
                    },
                },
            ],
            total: 2,
            page: 1,
            pages: 1,
        };

        it('should call apiClient.post with correct URL and query', async () => {
            mockApiClient.post.mockResolvedValueOnce(mockResponseDto);

            const result = await recurringJobsApi.getPreBookJobs(mockQuery);

            expect(mockApiClient.post).toHaveBeenCalledWith('job/PreBookJobs', mockQuery);
            expect(result.items).toHaveLength(2);
            expect(result.total).toBe(2);
            expect(result.page).toBe(1);
            expect(result.pages).toBe(1);
        });

        it('should transform date strings to Date objects', async () => {
            mockApiClient.post.mockResolvedValueOnce(mockResponseDto);

            const result = await recurringJobsApi.getPreBookJobs(mockQuery);

            expect(result.items[0].booked).toBeInstanceOf(Date);
            expect(result.items[0].nextDueTime).toBeInstanceOf(Date);
            expect(result.items[1].booked).toBeInstanceOf(Date);
            expect(result.items[1].nextDueTime).toBeUndefined();
        });

        it('should pass search text filter', async () => {
            mockApiClient.post.mockResolvedValueOnce({...mockResponseDto, items: []});

            const queryWithSearch: RecurringJobQuery = {
                ...mockQuery,
                searchText: 'Acme',
            };

            await recurringJobsApi.getPreBookJobs(queryWithSearch);

            expect(mockApiClient.post).toHaveBeenCalledWith('job/PreBookJobs', queryWithSearch);
        });

        it('should pass speed filter', async () => {
            mockApiClient.post.mockResolvedValueOnce({...mockResponseDto, items: []});

            const queryWithSpeed: RecurringJobQuery = {
                ...mockQuery,
                speedId: 5,
            };

            await recurringJobsApi.getPreBookJobs(queryWithSpeed);

            expect(mockApiClient.post).toHaveBeenCalledWith('job/PreBookJobs', queryWithSpeed);
        });

        it('should pass courier filter', async () => {
            mockApiClient.post.mockResolvedValueOnce({...mockResponseDto, items: []});

            const queryWithCourier: RecurringJobQuery = {
                ...mockQuery,
                courierId: 10,
            };

            await recurringJobsApi.getPreBookJobs(queryWithCourier);

            expect(mockApiClient.post).toHaveBeenCalledWith('job/PreBookJobs', queryWithCourier);
        });

        it('should pass days of week filter', async () => {
            mockApiClient.post.mockResolvedValueOnce({...mockResponseDto, items: []});

            const queryWithDays: RecurringJobQuery = {
                ...mockQuery,
                daysOfWeek: 31, // Mon-Fri bitmask
            };

            await recurringJobsApi.getPreBookJobs(queryWithDays);

            expect(mockApiClient.post).toHaveBeenCalledWith('job/PreBookJobs', queryWithDays);
        });

        it('should propagate errors from apiClient', async () => {
            const error = {status: 500, statusText: 'Internal Server Error', message: 'Server error'};
            mockApiClient.post.mockRejectedValueOnce(error);

            await expect(recurringJobsApi.getPreBookJobs(mockQuery)).rejects.toEqual(error);
        });
    });

    describe('getSpeedList', () => {
        const mockSpeedOptions: SpeedOption[] = [
            {id: 1, text: 'Same Day'},
            {id: 2, text: 'Next Day'},
            {id: 3, text: 'Economy'},
        ];

        it('should call apiClient.get with correct URL', async () => {
            mockApiClient.get.mockResolvedValueOnce(mockSpeedOptions);

            const result = await recurringJobsApi.getSpeedList();

            expect(mockApiClient.get).toHaveBeenCalledWith('job/SpeedList');
            expect(result).toEqual(mockSpeedOptions);
        });

        it('should return array of speed options', async () => {
            mockApiClient.get.mockResolvedValueOnce(mockSpeedOptions);

            const result = await recurringJobsApi.getSpeedList();

            expect(result).toHaveLength(3);
            expect(result[0]).toEqual({id: 1, text: 'Same Day'});
        });

        it('should propagate errors from apiClient', async () => {
            const error = {status: 500, statusText: 'Internal Server Error', message: 'Server error'};
            mockApiClient.get.mockRejectedValueOnce(error);

            await expect(recurringJobsApi.getSpeedList()).rejects.toEqual(error);
        });
    });

    describe('voidPrebookJob', () => {
        it('should call apiClient.get with correct URL and jobId', async () => {
            mockApiClient.get.mockResolvedValueOnce(undefined);

            await recurringJobsApi.voidPrebookJob(123);

            expect(mockApiClient.get).toHaveBeenCalledWith('job/VoidPrebookJob', {jobId: 123});
        });

        it('should propagate errors from apiClient', async () => {
            const error = {status: 400, statusText: 'Bad Request', message: 'Invalid job'};
            mockApiClient.get.mockRejectedValueOnce(error);

            await expect(recurringJobsApi.voidPrebookJob(123)).rejects.toEqual(error);
        });
    });

    describe('exportToCsv', () => {
        const mockQuery: RecurringJobQuery = {
            order: 'booked',
            orderDirection: 'desc',
            limit: 50,
            page: 1,
            active: true,
        };

        beforeEach(() => {
            // Reset document.body for link creation
            document.body.innerHTML = '';
        });

        it('should call axios.post with correct URL and options', async () => {
            const mockBlob = new Blob(['csv,data'], {type: 'text/csv'});
            mockedAxios.post.mockResolvedValueOnce({
                data: mockBlob,
                headers: {},
            });

            await recurringJobsApi.exportToCsv(mockQuery);

            expect(mockedAxios.post).toHaveBeenCalledWith('job/RecurringJobsExportCsv', mockQuery, {
                responseType: 'blob',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                withCredentials: true,
            });
        });

        it('should use default filename for active jobs', async () => {
            const mockBlob = new Blob(['csv,data'], {type: 'text/csv'});
            const mockLink = {
                href: '',
                download: '',
                style: {visibility: ''},
                click: jest.fn(),
            };
            jest.spyOn(document, 'createElement').mockReturnValueOnce(mockLink as any);
            jest.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
            jest.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);

            mockedAxios.post.mockResolvedValueOnce({
                data: mockBlob,
                headers: {},
            });

            await recurringJobsApi.exportToCsv(mockQuery);

            expect(mockLink.download).toBe('recurring-jobs-active.csv');
        });

        it('should use default filename for inactive jobs', async () => {
            const mockBlob = new Blob(['csv,data'], {type: 'text/csv'});
            const mockLink = {
                href: '',
                download: '',
                style: {visibility: ''},
                click: jest.fn(),
            };
            jest.spyOn(document, 'createElement').mockReturnValueOnce(mockLink as any);
            jest.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
            jest.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);

            mockedAxios.post.mockResolvedValueOnce({
                data: mockBlob,
                headers: {},
            });

            const inactiveQuery = {...mockQuery, active: false};
            await recurringJobsApi.exportToCsv(inactiveQuery);

            expect(mockLink.download).toBe('recurring-jobs-inactive.csv');
        });

        it('should extract filename from content-disposition header', async () => {
            const mockBlob = new Blob(['csv,data'], {type: 'text/csv'});
            const mockLink = {
                href: '',
                download: '',
                style: {visibility: ''},
                click: jest.fn(),
            };
            jest.spyOn(document, 'createElement').mockReturnValueOnce(mockLink as any);
            jest.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
            jest.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);

            mockedAxios.post.mockResolvedValueOnce({
                data: mockBlob,
                headers: {
                    'content-disposition': 'attachment; filename="custom-export.csv"',
                },
            });

            await recurringJobsApi.exportToCsv(mockQuery);

            expect(mockLink.download).toBe('custom-export.csv');
        });

        it('should propagate errors from axios', async () => {
            const axiosError = new Error('Network Error');
            mockedAxios.post.mockRejectedValueOnce(axiosError);

            await expect(recurringJobsApi.exportToCsv(mockQuery)).rejects.toThrow('Network Error');
        });

        it('should create and click download link', async () => {
            const mockBlob = new Blob(['csv,data'], {type: 'text/csv'});
            const mockClick = jest.fn();
            const mockLink = {
                href: '',
                download: '',
                style: {visibility: ''},
                click: mockClick,
            };
            jest.spyOn(document, 'createElement').mockReturnValueOnce(mockLink as any);
            const appendSpy = jest.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
            const removeSpy = jest.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);

            mockedAxios.post.mockResolvedValueOnce({
                data: mockBlob,
                headers: {},
            });

            await recurringJobsApi.exportToCsv(mockQuery);

            expect(mockCreateObjectURL).toHaveBeenCalled();
            expect(mockLink.href).toBe('blob:test-url');
            expect(mockClick).toHaveBeenCalled();
            expect(appendSpy).toHaveBeenCalled();
            expect(removeSpy).toHaveBeenCalled();
            expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url');
        });
    });
});
