/** @jest-environment jest-environment-jsdom */
/**
 * useDispatchExecutor Hook Tests
 */

import {act, renderHook, waitFor} from '@testing-library/react';
import {useDispatchExecutor} from './useDispatchExecutor';
import type {DispatchJob} from '../../../interfaces/dispatchJob';
import type {ActiveCourierViewModel} from '../../../../interfaces/courier.interface';
import {suppressConsoleError} from '../../../__testUtils__';

// Mock API modules
jest.mock('../../../services/dispatchExecutorApi', () => ({
    getCourierById: jest.fn(),
    addFollowupEvent: jest.fn(),
}));

jest.mock('../../../services/jobListApi', () => ({
    allocateJobs: jest.fn(),
    reAllocateJobs: jest.fn(),
}));

import {getCourierById, addFollowupEvent} from '../../../services/dispatchExecutorApi';
import {allocateJobs, reAllocateJobs} from '../../../services/jobListApi';

const mockGetCourierById = getCourierById as jest.MockedFunction<typeof getCourierById>;
const mockAddFollowupEvent = addFollowupEvent as jest.MockedFunction<typeof addFollowupEvent>;
const mockAllocateJobs = allocateJobs as jest.MockedFunction<typeof allocateJobs>;
const mockReAllocateJobs = reAllocateJobs as jest.MockedFunction<typeof reAllocateJobs>;

// ── Test Helpers ──────────────────────────────────────────────────────

const mockShowToast = jest.fn();

function createMockCourier(overrides?: Partial<ActiveCourierViewModel>): ActiveCourierViewModel {
    return {
        courierId: 42,
        id: 'C42',
        name: 'Test Courier',
        dangerousGoods: 0,
        dgLicenseExpiry: null,
        label: 'C42 - Test',
        text: 'C42 - Test Courier',
        isActive: true,
        vehicleType: 'Van',
        ...overrides,
    };
}

function createMockJob(overrides?: Partial<DispatchJob>): DispatchJob {
    return {
        angularId: 'j-100',
        id: 100,
        jobNo: 'J100',
        hasBeenRead: true,
        showCourierSearch: false,
        parentId: 0,
        isFlightJob: false,
        isAgentJob: false,
        isBulkJob: false,
        isArchived: false,
        booked: {} as any,
        courierSearchLoading: false,
        pickupAddress: {} as any,
        deliveryAddress: {} as any,
        pickUpTimeZone: {id: 1, text: 'AEST'},
        deliveryTimeZone: {id: 1, text: 'AEST'},
        ...overrides,
    } as DispatchJob;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('useDispatchExecutor', () => {
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        errorSpy = suppressConsoleError('Error dispatching', 'Error reassigning');
    });

    afterEach(() => {
        errorSpy.mockRestore();
    });

    it('should initialise with dispatching false and no pending confirmation', () => {
        const {result} = renderHook(() => useDispatchExecutor(mockShowToast));

        expect(result.current.dispatching).toBe(false);
        expect(result.current.pendingConfirmation).toBeNull();
        expect(result.current.pendingCourierSelection).toBeNull();
    });

    describe('dispatchJobs', () => {
        it('should dispatch jobs successfully with a valid courier', async () => {
            const courier = createMockCourier();
            const job = createMockJob();
            mockGetCourierById.mockResolvedValueOnce(courier);
            mockAllocateJobs.mockResolvedValueOnce(undefined);

            const {result} = renderHook(() => useDispatchExecutor(mockShowToast));

            let success: boolean;
            await act(async () => {
                success = await result.current.dispatchJobs(42, [job]);
            });

            expect(success!).toBe(true);
            expect(mockGetCourierById).toHaveBeenCalledWith(42);
            expect(mockAllocateJobs).toHaveBeenCalledWith(42, [100]);
            expect(mockShowToast).toHaveBeenCalledWith(
                expect.stringContaining('Dispatched job #J100'),
                'success',
            );
        });

        it('should return false when courier is not found and user declines confirmation', async () => {
            mockGetCourierById.mockResolvedValueOnce(null);
            const job = createMockJob();

            const {result} = renderHook(() => useDispatchExecutor(mockShowToast));

            let dispatchPromise: Promise<boolean>;
            act(() => {
                dispatchPromise = result.current.dispatchJobs(999, [job]);
            });

            // Wait for the async getCourierById to resolve and trigger state update
            await waitFor(() => {
                expect(result.current.pendingConfirmation).not.toBeNull();
            });
            expect(result.current.pendingConfirmation!.type).toBe('offline-courier');

            // User declines
            await act(async () => {
                result.current.resolveConfirmation(false);
            });

            const success = await dispatchPromise!;
            expect(success).toBe(false);
            expect(mockAllocateJobs).not.toHaveBeenCalled();
        });

        it('should show error when job is already assigned to a courier', async () => {
            const courier = createMockCourier();
            const assignedJob = createMockJob({
                jobNo: 'J200',
                courierData: {
                    courierId: 10,
                    courier: 'Other',
                    courierNumber: 'C10',
                    courierName: 'Other Courier',
                },
            });
            mockGetCourierById.mockResolvedValueOnce(courier);

            const {result} = renderHook(() => useDispatchExecutor(mockShowToast));

            let success: boolean;
            await act(async () => {
                success = await result.current.dispatchJobs(42, [assignedJob]);
            });

            expect(success!).toBe(false);
            expect(mockShowToast).toHaveBeenCalledWith(
                expect.stringContaining('Restore J200 prior to dispatching'),
                'error',
            );
            expect(mockAllocateJobs).not.toHaveBeenCalled();
        });

        it('should set pendingConfirmation for offline courier', async () => {
            mockGetCourierById.mockResolvedValueOnce(null);
            const job = createMockJob();

            const {result} = renderHook(() => useDispatchExecutor(mockShowToast));

            act(() => {
                result.current.dispatchJobs(999, [job]);
            });

            // Wait for the async getCourierById to resolve and trigger state update
            await waitFor(() => {
                expect(result.current.pendingConfirmation).not.toBeNull();
            });
            expect(result.current.pendingConfirmation!.type).toBe('offline-courier');
            expect(result.current.pendingConfirmation!.title).toBe('Courier Offline');

            // Clean up - resolve the confirmation to avoid dangling promise
            await act(async () => {
                result.current.resolveConfirmation(false);
            });
        });

        it('should return false for empty jobs array', async () => {
            const {result} = renderHook(() => useDispatchExecutor(mockShowToast));

            let success: boolean;
            await act(async () => {
                success = await result.current.dispatchJobs(42, []);
            });

            expect(success!).toBe(false);
            expect(mockGetCourierById).not.toHaveBeenCalled();
        });

        it('should add followup event for dangerous goods jobs', async () => {
            const courier = createMockCourier({dangerousGoods: 1, dgLicenseExpiry: '2028-01-01'});
            const dgJob = createMockJob({dgClass: 3});
            mockGetCourierById.mockResolvedValueOnce(courier);
            mockAddFollowupEvent.mockResolvedValueOnce(undefined);
            mockAllocateJobs.mockResolvedValueOnce(undefined);

            const {result} = renderHook(() => useDispatchExecutor(mockShowToast));

            await act(async () => {
                await result.current.dispatchJobs(42, [dgJob]);
            });

            expect(mockAddFollowupEvent).toHaveBeenCalledWith(100);
            expect(mockAllocateJobs).toHaveBeenCalled();
        });

        it('should show error toast when dispatch throws', async () => {
            const courier = createMockCourier();
            const job = createMockJob();
            mockGetCourierById.mockResolvedValueOnce(courier);
            mockAllocateJobs.mockRejectedValueOnce(new Error('Network failure'));

            const {result} = renderHook(() => useDispatchExecutor(mockShowToast));

            let success: boolean;
            await act(async () => {
                success = await result.current.dispatchJobs(42, [job]);
            });

            expect(success!).toBe(false);
            expect(mockShowToast).toHaveBeenCalledWith(
                expect.stringContaining('Network failure'),
                'error',
            );
        });
    });

    describe('assignSingleJobById', () => {
        it('should allocate a single job by ID', async () => {
            const courier = createMockCourier();
            mockGetCourierById.mockResolvedValueOnce(courier);
            mockAllocateJobs.mockResolvedValueOnce(undefined);

            const {result} = renderHook(() => useDispatchExecutor(mockShowToast));

            let success: boolean;
            await act(async () => {
                success = await result.current.assignSingleJobById(42, 200);
            });

            expect(success!).toBe(true);
            expect(mockAllocateJobs).toHaveBeenCalledWith(42, [200]);
            expect(mockShowToast).toHaveBeenCalledWith(
                expect.stringContaining('Job dispatched to C42'),
                'success',
            );
        });
    });

    describe('reassignJob', () => {
        it('should request courier selection then reallocate', async () => {
            const job = createMockJob({jobNo: 'J300', courierData: {courierId: 10, courier: 'Old', courierNumber: 'C10'}});
            const newCourier = createMockCourier({courierId: 50, id: 'C50'});
            mockGetCourierById.mockResolvedValueOnce(newCourier);
            mockReAllocateJobs.mockResolvedValueOnce(undefined);

            const {result} = renderHook(() => useDispatchExecutor(mockShowToast));

            let reassignPromise: Promise<boolean>;
            act(() => {
                reassignPromise = result.current.reassignJob(job);
            });

            // Should show courier selection
            expect(result.current.pendingCourierSelection).not.toBeNull();
            expect(result.current.pendingCourierSelection!.jobNo).toBe('J300');

            // Select a courier
            await act(async () => {
                result.current.resolveCourierSelection(50);
            });

            const success = await reassignPromise!;
            expect(success).toBe(true);
            expect(mockReAllocateJobs).toHaveBeenCalledWith(50, [100]);
            expect(mockShowToast).toHaveBeenCalledWith(
                expect.stringContaining('reallocated to C50'),
                'success',
            );
        });
    });
});
