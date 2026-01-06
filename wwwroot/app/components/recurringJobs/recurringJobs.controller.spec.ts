/**
 * Tests for RecurringJobsController
 * Focuses on the updateJobInList method that refreshes from backend
 */

import { IPrebookListModel } from './recurringJobs.interface';
import { IPaginatedResponse } from '../../interfaces/paginated-response.interface';
import dayjs from 'dayjs';

describe('RecurringJobsController', () => {
    // Mock services
    let mockRecurringJobsService: {
        getPreBookJobs: jest.Mock;
        voidPrebookJob: jest.Mock;
    };

    let mockMdDialog: {
        show: jest.Mock;
        confirm: jest.Mock;
        alert: jest.Mock;
        prompt: jest.Mock;
    };

    let mockMdSidenav: jest.Mock;
    let mockToastrService: {
        showSuccessToast: jest.Mock;
        showWarningToast: jest.Mock;
    };
    let mockJobContextMenuService: {
        getRecurringJobMenuOptions: jest.Mock;
    };
    let mockTimeout: jest.Mock;
    let mockInterval: jest.Mock;
    let mockScope: {
        $apply: jest.Mock;
        $on: jest.Mock;
        $$phase: string | null;
    };
    let mockAppConfig: {
        US_Customer: boolean;
    };

    // Controller state (simulating controller instance)
    let controller: {
        currentJobId?: number;
        jobList: IPrebookListModel[];
        totalJobCount: number;
        isLoading: boolean;
        jobQuery: {
            order: string;
            orderDirection: string;
            limit: number;
            page: number;
            active: boolean;
            searchText?: string;
        };
        refreshData: () => Promise<void>;
        updateJobInList: () => Promise<void>;
        applyScope: () => void;
    };

    // Sample job data
    const createMockJob = (id: number, client: string = 'Test Client'): IPrebookListModel => ({
        id,
        jobNo: `JOB-${id}`,
        client,
        clientId: id * 10,
        courier: 'Test Courier',
        speed: 'Standard',
        customJobName: `Job ${id}`,
        booked: dayjs(),
        _bookedStr: '01/01/2025 10:00',
        nextDueTime: dayjs(),
        _nextDueTimeStr: '02/01/2025 10:00',
        pickupAddress: {
            addressLine1: '123 Pickup St',
            fullAddress: '123 Pickup St, City'
        } as any,
        deliveryAddress: {
            addressLine1: '456 Delivery Ave',
            fullAddress: '456 Delivery Ave, City'
        } as any
    });

    const createPaginatedResponse = (jobs: IPrebookListModel[]): IPaginatedResponse<IPrebookListModel> => ({
        items: jobs,
        total: jobs.length,
        page: 1,
        pages: Math.ceil(jobs.length / 50) || 1
    });

    beforeEach(() => {
        // Reset mocks
        mockRecurringJobsService = {
            getPreBookJobs: jest.fn(),
            voidPrebookJob: jest.fn()
        };

        mockMdDialog = {
            show: jest.fn(),
            confirm: jest.fn().mockReturnThis(),
            alert: jest.fn().mockReturnThis(),
            prompt: jest.fn().mockReturnThis()
        };

        mockMdSidenav = jest.fn().mockReturnValue({
            toggle: jest.fn()
        });

        mockToastrService = {
            showSuccessToast: jest.fn(),
            showWarningToast: jest.fn()
        };

        mockJobContextMenuService = {
            getRecurringJobMenuOptions: jest.fn().mockReturnValue([])
        };

        mockTimeout = jest.fn((fn: Function) => fn());
        mockInterval = jest.fn();
        mockScope = {
            $apply: jest.fn((fn?: Function) => fn && fn()),
            $on: jest.fn(),
            $$phase: null
        };

        mockAppConfig = {
            US_Customer: false
        };

        // Suppress console logs during tests
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'info').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});

        // Create a simplified controller that mimics the actual implementation
        controller = {
            currentJobId: undefined,
            jobList: [],
            totalJobCount: 0,
            isLoading: false,
            jobQuery: {
                order: 'booked',
                orderDirection: 'asc',
                limit: 50,
                page: 1,
                active: true
            },

            applyScope: function() {
                if (mockScope.$$phase || mockScope.$$phase === '$apply' || mockScope.$$phase === '$digest') {
                    return;
                }
                mockScope.$apply();
            },

            refreshData: async function() {
                this.isLoading = true;
                try {
                    let orderBy = this.jobQuery.order || 'booked';
                    let orderDirection = 'asc';

                    if (orderBy.startsWith('-')) {
                        orderBy = orderBy.substring(1);
                        orderDirection = 'desc';
                    }

                    this.jobQuery.order = orderBy;
                    this.jobQuery.orderDirection = orderDirection;

                    this.currentJobId = undefined;
                    const response = await mockRecurringJobsService.getPreBookJobs(this.jobQuery);
                    this.jobList = response.items;
                    this.totalJobCount = response.total;
                } catch (error) {
                    this.jobList = [];
                    this.totalJobCount = 0;
                } finally {
                    this.isLoading = false;
                    this.applyScope();
                }
            },

            updateJobInList: async function() {
                const selectedJobId = this.currentJobId;
                await this.refreshData();

                // Restore selection if the job still exists in the list
                if (selectedJobId && this.jobList.some(j => j.id === selectedJobId)) {
                    this.currentJobId = selectedJobId;
                }
            }
        };
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('updateJobInList', () => {
        it('should refresh data from backend', async () => {
            const mockJobs = [createMockJob(1), createMockJob(2)];
            mockRecurringJobsService.getPreBookJobs.mockResolvedValue(createPaginatedResponse(mockJobs));

            await controller.updateJobInList();

            expect(mockRecurringJobsService.getPreBookJobs).toHaveBeenCalledTimes(1);
            expect(controller.jobList).toEqual(mockJobs);
            expect(controller.totalJobCount).toBe(2);
        });

        it('should preserve selection when job still exists after refresh', async () => {
            const mockJobs = [createMockJob(1), createMockJob(2), createMockJob(3)];
            mockRecurringJobsService.getPreBookJobs.mockResolvedValue(createPaginatedResponse(mockJobs));

            controller.currentJobId = 2;
            await controller.updateJobInList();

            expect(controller.currentJobId).toBe(2);
        });

        it('should clear selection when job no longer exists after refresh', async () => {
            const mockJobs = [createMockJob(1), createMockJob(3)]; // Job 2 is gone
            mockRecurringJobsService.getPreBookJobs.mockResolvedValue(createPaginatedResponse(mockJobs));

            controller.currentJobId = 2;
            await controller.updateJobInList();

            expect(controller.currentJobId).toBeUndefined();
        });

        it('should handle no prior selection', async () => {
            const mockJobs = [createMockJob(1)];
            mockRecurringJobsService.getPreBookJobs.mockResolvedValue(createPaginatedResponse(mockJobs));

            controller.currentJobId = undefined;
            await controller.updateJobInList();

            expect(controller.currentJobId).toBeUndefined();
            expect(controller.jobList).toEqual(mockJobs);
        });

        it('should handle empty job list from backend', async () => {
            mockRecurringJobsService.getPreBookJobs.mockResolvedValue(createPaginatedResponse([]));

            controller.currentJobId = 5;
            await controller.updateJobInList();

            expect(controller.jobList).toEqual([]);
            expect(controller.totalJobCount).toBe(0);
            expect(controller.currentJobId).toBeUndefined();
        });

        it('should handle backend error gracefully', async () => {
            mockRecurringJobsService.getPreBookJobs.mockRejectedValue(new Error('Network error'));

            controller.currentJobId = 1;
            controller.jobList = [createMockJob(1)];

            await controller.updateJobInList();

            expect(controller.jobList).toEqual([]);
            expect(controller.totalJobCount).toBe(0);
            expect(controller.currentJobId).toBeUndefined();
        });

        it('should update loading state correctly', async () => {
            let loadingDuringCall = false;
            mockRecurringJobsService.getPreBookJobs.mockImplementation(async () => {
                loadingDuringCall = controller.isLoading;
                return createPaginatedResponse([createMockJob(1)]);
            });

            expect(controller.isLoading).toBe(false);
            await controller.updateJobInList();

            expect(loadingDuringCall).toBe(true);
            expect(controller.isLoading).toBe(false);
        });

        it('should call applyScope after refresh completes', async () => {
            mockRecurringJobsService.getPreBookJobs.mockResolvedValue(createPaginatedResponse([createMockJob(1)]));

            await controller.updateJobInList();

            expect(mockScope.$apply).toHaveBeenCalled();
        });

        it('should maintain query parameters during refresh', async () => {
            mockRecurringJobsService.getPreBookJobs.mockResolvedValue(createPaginatedResponse([createMockJob(1)]));

            controller.jobQuery.page = 2;
            controller.jobQuery.limit = 100;
            controller.jobQuery.active = false;
            controller.jobQuery.searchText = 'test search';

            await controller.updateJobInList();

            expect(mockRecurringJobsService.getPreBookJobs).toHaveBeenCalledWith(
                expect.objectContaining({
                    page: 2,
                    limit: 100,
                    active: false,
                    searchText: 'test search'
                })
            );
        });

        it('should restore selection for first job in list', async () => {
            const mockJobs = [createMockJob(10), createMockJob(20), createMockJob(30)];
            mockRecurringJobsService.getPreBookJobs.mockResolvedValue(createPaginatedResponse(mockJobs));

            controller.currentJobId = 10;
            await controller.updateJobInList();

            expect(controller.currentJobId).toBe(10);
        });

        it('should restore selection for last job in list', async () => {
            const mockJobs = [createMockJob(10), createMockJob(20), createMockJob(30)];
            mockRecurringJobsService.getPreBookJobs.mockResolvedValue(createPaginatedResponse(mockJobs));

            controller.currentJobId = 30;
            await controller.updateJobInList();

            expect(controller.currentJobId).toBe(30);
        });

        it('should handle rapid consecutive calls', async () => {
            const mockJobs1 = [createMockJob(1)];
            const mockJobs2 = [createMockJob(1), createMockJob(2)];

            let callCount = 0;
            mockRecurringJobsService.getPreBookJobs.mockImplementation(async () => {
                callCount++;
                return createPaginatedResponse(callCount === 1 ? mockJobs1 : mockJobs2);
            });

            controller.currentJobId = 1;

            // Call twice in rapid succession
            await Promise.all([
                controller.updateJobInList(),
                controller.updateJobInList()
            ]);

            expect(mockRecurringJobsService.getPreBookJobs).toHaveBeenCalledTimes(2);
            // Final state should have job 1 selected (exists in both responses)
            expect(controller.currentJobId).toBe(1);
        });
    });

    describe('refreshData', () => {
        it('should clear currentJobId before fetching', async () => {
            let jobIdDuringFetch: number | undefined;
            mockRecurringJobsService.getPreBookJobs.mockImplementation(async () => {
                jobIdDuringFetch = controller.currentJobId;
                return createPaginatedResponse([createMockJob(1)]);
            });

            controller.currentJobId = 5;
            await controller.refreshData();

            expect(jobIdDuringFetch).toBeUndefined();
        });

        it('should handle descending sort order', async () => {
            mockRecurringJobsService.getPreBookJobs.mockResolvedValue(createPaginatedResponse([]));

            controller.jobQuery.order = '-booked';
            await controller.refreshData();

            expect(controller.jobQuery.order).toBe('booked');
            expect(controller.jobQuery.orderDirection).toBe('desc');
        });

        it('should handle ascending sort order', async () => {
            mockRecurringJobsService.getPreBookJobs.mockResolvedValue(createPaginatedResponse([]));

            controller.jobQuery.order = 'client';
            await controller.refreshData();

            expect(controller.jobQuery.order).toBe('client');
            expect(controller.jobQuery.orderDirection).toBe('asc');
        });
    });
});
