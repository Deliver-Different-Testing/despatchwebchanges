/** @jest-environment jest-environment-jsdom */
/**
 * useJobUpdate Hook Tests
 */

import {act, renderHook, waitFor} from '@testing-library/react';
import {QueryClient} from '@tanstack/react-query';
import {useJobUpdate} from './useJobUpdate';
import {createTestQueryClient, createWrapper, suppressConsoleError} from '../../../../__testUtils__';

// Mock API services
jest.mock('../../../../services/jobDetailApi', () => ({
    updateJobDetail: jest.fn(),
    updateBulkJobDetail: jest.fn(),
    updatePickupAddress: jest.fn(),
    updateDeliveryAddress: jest.fn(),
    updatePodDetails: jest.fn(),
    updateJobReadStatus: jest.fn(),
    restoreJobs: jest.fn(),
    allocateJob: jest.fn(),
    getCourierById: jest.fn(),
}));

import {
    updateJobDetail,
    updateBulkJobDetail,
    updatePickupAddress,
    updateDeliveryAddress,
    updatePodDetails,
    updateJobReadStatus,
    restoreJobs,
    allocateJob,
    getCourierById,
} from '../../../../services/jobDetailApi';

const mockUpdateJobDetail = updateJobDetail as jest.MockedFunction<typeof updateJobDetail>;
const mockUpdateBulkJobDetail = updateBulkJobDetail as jest.MockedFunction<typeof updateBulkJobDetail>;
const mockUpdatePickupAddress = updatePickupAddress as jest.MockedFunction<typeof updatePickupAddress>;
const mockUpdateDeliveryAddress = updateDeliveryAddress as jest.MockedFunction<typeof updateDeliveryAddress>;
const mockUpdatePodDetails = updatePodDetails as jest.MockedFunction<typeof updatePodDetails>;
const mockUpdateJobReadStatus = updateJobReadStatus as jest.MockedFunction<typeof updateJobReadStatus>;
const mockRestoreJobs = restoreJobs as jest.MockedFunction<typeof restoreJobs>;
const mockAllocateJob = allocateJob as jest.MockedFunction<typeof allocateJob>;
const mockGetCourierById = getCourierById as jest.MockedFunction<typeof getCourierById>;

// ── Test Helpers ──────────────────────────────────────────────────────

function createMockJob(overrides?: Record<string, unknown>) {
    return {
        id: 1,
        jobNo: 'J100',
        isBulkJob: false,
        preBook: false,
        courierData: null,
        assignedCourier: null,
        ...overrides,
    } as any;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('useJobUpdate', () => {
    let queryClient: QueryClient;
    let mockShowToast: jest.Mock;
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
        queryClient = createTestQueryClient();
        mockShowToast = jest.fn();
        jest.clearAllMocks();
        errorSpy = suppressConsoleError();
    });

    afterEach(() => {
        errorSpy.mockRestore();
    });

    function renderUseJobUpdate() {
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        return renderHook(() => useJobUpdate(mockShowToast), {wrapper});
    }

    describe('updateField', () => {
        it('calls updateJobDetail for standard jobs and shows success toast', async () => {
            mockUpdateJobDetail.mockResolvedValueOnce(undefined);
            const {result} = renderUseJobUpdate();
            const job = createMockJob();

            await act(async () => {
                await result.current.updateField({job, field: 'notes', value: 'test', isRecurring: false});
            });

            expect(mockUpdateJobDetail).toHaveBeenCalledWith(1, 'notes', 'test', false, undefined);
            expect(mockUpdateBulkJobDetail).not.toHaveBeenCalled();
            expect(mockShowToast).toHaveBeenCalledWith('J100 updated', 'success');
        });

        it('calls updateBulkJobDetail for bulk jobs and shows success toast', async () => {
            mockUpdateBulkJobDetail.mockResolvedValueOnce(undefined);
            const {result} = renderUseJobUpdate();
            const job = createMockJob({isBulkJob: true, jobNo: 'B200'});

            await act(async () => {
                await result.current.updateField({job, field: 'notes', value: 'bulk note', isRecurring: false});
            });

            expect(mockUpdateBulkJobDetail).toHaveBeenCalledWith(1, 'notes', 'bulk note', undefined);
            expect(mockUpdateJobDetail).not.toHaveBeenCalled();
            expect(mockShowToast).toHaveBeenCalledWith('B200 updated', 'success');
        });

        it('shows error toast when updateField fails', async () => {
            mockUpdateJobDetail.mockRejectedValueOnce(new Error('fail'));
            const {result} = renderUseJobUpdate();
            const job = createMockJob();

            await act(async () => {
                try {
                    await result.current.updateField({job, field: 'notes', value: 'x', isRecurring: false});
                } catch { /* expected */ }
            });

            expect(mockShowToast).toHaveBeenCalledWith('Failed to update job. Please try again.', 'error');
        });
    });

    describe('updateAddress', () => {
        it('calls updateDeliveryAddress when isDelivery is true', async () => {
            mockUpdateDeliveryAddress.mockResolvedValueOnce(undefined);
            const {result} = renderUseJobUpdate();
            const job = createMockJob();
            const address = {line1: '123 Main St'} as any;

            await act(async () => {
                await result.current.updateAddress({job, address, isDelivery: true});
            });

            expect(mockUpdateDeliveryAddress).toHaveBeenCalledWith(1, false, address);
            expect(mockUpdatePickupAddress).not.toHaveBeenCalled();
            expect(mockShowToast).toHaveBeenCalledWith('J100 updated', 'success');
        });

        it('calls updatePickupAddress when isDelivery is false', async () => {
            mockUpdatePickupAddress.mockResolvedValueOnce(undefined);
            const {result} = renderUseJobUpdate();
            const job = createMockJob();
            const address = {line1: '456 Oak Ave'} as any;

            await act(async () => {
                await result.current.updateAddress({job, address, isDelivery: false});
            });

            expect(mockUpdatePickupAddress).toHaveBeenCalledWith(1, false, address);
            expect(mockUpdateDeliveryAddress).not.toHaveBeenCalled();
            expect(mockShowToast).toHaveBeenCalledWith('J100 updated', 'success');
        });

        it('shows error toast when updateAddress fails', async () => {
            mockUpdateDeliveryAddress.mockRejectedValueOnce(new Error('fail'));
            const {result} = renderUseJobUpdate();
            const job = createMockJob();

            await act(async () => {
                try {
                    await result.current.updateAddress({job, address: {} as any, isDelivery: true});
                } catch { /* expected */ }
            });

            expect(mockShowToast).toHaveBeenCalledWith('Failed to update address. Please try again.', 'error');
        });
    });

    describe('toggleReadStatus', () => {
        it('calls updateJobReadStatus and invalidates queries on success', async () => {
            mockUpdateJobReadStatus.mockResolvedValueOnce(undefined);
            const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
            const {result} = renderUseJobUpdate();

            await act(async () => {
                await result.current.toggleReadStatus({jobId: 1, hasBeenRead: true});
            });

            expect(mockUpdateJobReadStatus).toHaveBeenCalledWith(1, true);
            expect(invalidateSpy).toHaveBeenCalled();
        });

        it('shows error toast with correct action text for marking as read', async () => {
            mockUpdateJobReadStatus.mockRejectedValueOnce(new Error('fail'));
            const {result} = renderUseJobUpdate();

            await act(async () => {
                try {
                    await result.current.toggleReadStatus({jobId: 1, hasBeenRead: true});
                } catch { /* expected */ }
            });

            expect(mockShowToast).toHaveBeenCalledWith('Failed to mark job as read. Please try again.', 'error');
        });

        it('shows error toast with correct action text for marking as unread', async () => {
            mockUpdateJobReadStatus.mockRejectedValueOnce(new Error('fail'));
            const {result} = renderUseJobUpdate();

            await act(async () => {
                try {
                    await result.current.toggleReadStatus({jobId: 1, hasBeenRead: false});
                } catch { /* expected */ }
            });

            expect(mockShowToast).toHaveBeenCalledWith('Failed to mark job as unread. Please try again.', 'error');
        });
    });

    describe('dispatchJob', () => {
        it('restores job first when it already has a courier, then allocates', async () => {
            mockRestoreJobs.mockResolvedValueOnce(undefined);
            mockAllocateJob.mockResolvedValueOnce(undefined);
            mockGetCourierById.mockResolvedValueOnce({id: 'C5', name: 'Test Courier'});
            const {result} = renderUseJobUpdate();
            const job = createMockJob({courierData: {courierId: 99}});

            await act(async () => {
                await result.current.dispatchJob({job, courierId: 5});
            });

            expect(mockRestoreJobs).toHaveBeenCalledWith([1]);
            expect(mockAllocateJob).toHaveBeenCalledWith(5, [1]);
        });

        it('does not restore when job has no existing courier', async () => {
            mockAllocateJob.mockResolvedValueOnce(undefined);
            mockGetCourierById.mockResolvedValueOnce({id: 'C5', name: 'Test Courier'});
            const {result} = renderUseJobUpdate();
            const job = createMockJob();

            await act(async () => {
                await result.current.dispatchJob({job, courierId: 5});
            });

            expect(mockRestoreJobs).not.toHaveBeenCalled();
            expect(mockAllocateJob).toHaveBeenCalledWith(5, [1]);
        });

        it('shows courier name in success toast with id prefix', async () => {
            mockAllocateJob.mockResolvedValueOnce(undefined);
            mockGetCourierById.mockResolvedValueOnce({id: 'C5', name: 'Fast Courier'});
            const {result} = renderUseJobUpdate();
            const job = createMockJob();

            await act(async () => {
                await result.current.dispatchJob({job, courierId: 5});
            });

            expect(mockShowToast).toHaveBeenCalledWith('Dispatched to C5: Fast Courier', 'success');
        });

        it('shows courier name without id prefix when id is empty', async () => {
            mockAllocateJob.mockResolvedValueOnce(undefined);
            mockGetCourierById.mockResolvedValueOnce({id: '', name: 'Fast Courier'});
            const {result} = renderUseJobUpdate();
            const job = createMockJob();

            await act(async () => {
                await result.current.dispatchJob({job, courierId: 5});
            });

            expect(mockShowToast).toHaveBeenCalledWith('Dispatched to Fast Courier', 'success');
        });

        it('handles getCourierById failure gracefully with generic success message', async () => {
            mockAllocateJob.mockResolvedValueOnce(undefined);
            mockGetCourierById.mockRejectedValueOnce(new Error('not found'));
            const {result} = renderUseJobUpdate();
            const job = createMockJob();

            await act(async () => {
                await result.current.dispatchJob({job, courierId: 5});
            });

            expect(mockShowToast).toHaveBeenCalledWith('Job dispatched successfully', 'success');
        });

        it('shows error toast when dispatch fails', async () => {
            mockAllocateJob.mockRejectedValueOnce(new Error('fail'));
            const {result} = renderUseJobUpdate();
            const job = createMockJob();

            await act(async () => {
                try {
                    await result.current.dispatchJob({job, courierId: 5});
                } catch { /* expected */ }
            });

            expect(mockShowToast).toHaveBeenCalledWith('Failed to dispatch job.', 'error');
        });

        it('invalidates job queries on successful dispatch', async () => {
            mockAllocateJob.mockResolvedValueOnce(undefined);
            mockGetCourierById.mockResolvedValueOnce({id: 'C1', name: 'Courier'});
            const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
            const {result} = renderUseJobUpdate();
            const job = createMockJob();

            await act(async () => {
                await result.current.dispatchJob({job, courierId: 1});
            });

            expect(invalidateSpy).toHaveBeenCalled();
        });
    });

    describe('updatePod', () => {
        it('calls updatePodDetails and invalidates on success', async () => {
            mockUpdatePodDetails.mockResolvedValueOnce(undefined);
            const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
            const {result} = renderUseJobUpdate();
            const podData = {jobId: 1, name: 'Signer'} as any;

            await act(async () => {
                await result.current.updatePod(podData);
            });

            expect(mockUpdatePodDetails).toHaveBeenCalledWith(podData);
            expect(invalidateSpy).toHaveBeenCalled();
        });

        it('shows error toast when updatePod fails', async () => {
            mockUpdatePodDetails.mockRejectedValueOnce(new Error('fail'));
            const {result} = renderUseJobUpdate();

            await act(async () => {
                try {
                    await result.current.updatePod({jobId: 1} as any);
                } catch { /* expected */ }
            });

            expect(mockShowToast).toHaveBeenCalledWith('Failed to update POD details.', 'error');
        });
    });

    describe('job list cache invalidation', () => {
        const listPrefixes = [['dispatch'], ['jobSearch'], ['nationwide']];

        it('invalidates job list caches after a successful field update', async () => {
            mockUpdateJobDetail.mockResolvedValueOnce(undefined);
            const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
            const {result} = renderUseJobUpdate();

            await act(async () => {
                await result.current.updateField({job: createMockJob(), field: 'speedId', value: 2, isRecurring: false});
            });

            for (const prefix of listPrefixes) {
                expect(invalidateSpy).toHaveBeenCalledWith({queryKey: prefix});
            }
        });

        it('invalidates job list caches after a successful address update', async () => {
            mockUpdateDeliveryAddress.mockResolvedValueOnce(undefined);
            const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
            const {result} = renderUseJobUpdate();

            await act(async () => {
                await result.current.updateAddress({job: createMockJob(), address: {} as any, isDelivery: true});
            });

            for (const prefix of listPrefixes) {
                expect(invalidateSpy).toHaveBeenCalledWith({queryKey: prefix});
            }
        });

        it('invalidates job list caches after a successful dispatch', async () => {
            mockAllocateJob.mockResolvedValueOnce(undefined);
            mockGetCourierById.mockResolvedValueOnce({id: 'C1', name: 'Courier'});
            const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
            const {result} = renderUseJobUpdate();

            await act(async () => {
                await result.current.dispatchJob({job: createMockJob(), courierId: 1});
            });

            for (const prefix of listPrefixes) {
                expect(invalidateSpy).toHaveBeenCalledWith({queryKey: prefix});
            }
        });

        it('does NOT invalidate job list caches for POD updates', async () => {
            mockUpdatePodDetails.mockResolvedValueOnce(undefined);
            const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
            const {result} = renderUseJobUpdate();

            await act(async () => {
                await result.current.updatePod({jobId: 1} as any);
            });

            for (const prefix of listPrefixes) {
                expect(invalidateSpy).not.toHaveBeenCalledWith({queryKey: prefix});
            }
        });

        it('does NOT invalidate job list caches for read status toggles', async () => {
            mockUpdateJobReadStatus.mockResolvedValueOnce(undefined);
            const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
            const {result} = renderUseJobUpdate();

            await act(async () => {
                await result.current.toggleReadStatus({jobId: 1, hasBeenRead: true});
            });

            for (const prefix of listPrefixes) {
                expect(invalidateSpy).not.toHaveBeenCalledWith({queryKey: prefix});
            }
        });

        it('does NOT invalidate job list caches when field update fails', async () => {
            mockUpdateJobDetail.mockRejectedValueOnce(new Error('fail'));
            const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
            const {result} = renderUseJobUpdate();

            await act(async () => {
                try {
                    await result.current.updateField({job: createMockJob(), field: 'speedId', value: 2, isRecurring: false});
                } catch { /* expected */ }
            });

            for (const prefix of listPrefixes) {
                expect(invalidateSpy).not.toHaveBeenCalledWith({queryKey: prefix});
            }
        });
    });

    describe('isUpdating', () => {
        it('reflects pending state during a mutation', async () => {
            let resolveUpdate: () => void;
            mockUpdateJobDetail.mockReturnValueOnce(new Promise<void>(r => { resolveUpdate = r; }));
            const {result} = renderUseJobUpdate();
            const job = createMockJob();

            expect(result.current.isUpdating).toBe(false);

            let mutationPromise: Promise<void>;
            act(() => {
                mutationPromise = result.current.updateField({job, field: 'x', value: 'y', isRecurring: false}).catch(() => {});
            });

            await waitFor(() => expect(result.current.isUpdating).toBe(true));

            await act(async () => {
                resolveUpdate!();
                await mutationPromise;
            });

            await waitFor(() => expect(result.current.isUpdating).toBe(false));
        });
    });
});
