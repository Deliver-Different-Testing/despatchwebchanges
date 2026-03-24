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
    getDispatchJobDetail: jest.fn(),
    addFollowupEvent: jest.fn(),
}));

jest.mock('../../../services/jobListApi', () => ({
    allocateJobs: jest.fn(),
    reAllocateJobs: jest.fn(),
}));

import {getCourierById, getDispatchJobDetail, addFollowupEvent} from '../../../services/dispatchExecutorApi';
import {allocateJobs, reAllocateJobs} from '../../../services/jobListApi';

const mockGetCourierById = getCourierById as jest.MockedFunction<typeof getCourierById>;
const mockGetDispatchJobDetail = getDispatchJobDetail as jest.MockedFunction<typeof getDispatchJobDetail>;
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

    describe('chilled job detection', () => {
        it('should show chilled-warning confirmation for a chilled vehicle job dispatched to a non-chilled courier', async () => {
            const courier = createMockCourier({vehicleType: 'Car'});
            const job = createMockJob({vehicle: {id: 1, text: 'Chilled Van'}} as any);
            mockGetCourierById.mockResolvedValueOnce(courier);

            const {result} = renderHook(() => useDispatchExecutor(mockShowToast));

            let dispatchPromise: Promise<boolean>;
            act(() => {
                dispatchPromise = result.current.dispatchJobs(42, [job]);
            });

            await waitFor(() => {
                expect(result.current.pendingConfirmation).not.toBeNull();
            });
            expect(result.current.pendingConfirmation!.type).toBe('chilled-warning');

            await act(async () => {
                result.current.resolveConfirmation(false);
            });
            expect(await dispatchPromise!).toBe(false);
            expect(mockAllocateJobs).not.toHaveBeenCalled();
        });

        it('should show chilled-warning for a frozen vehicle job', async () => {
            const courier = createMockCourier({vehicleType: 'Car'});
            const job = createMockJob({vehicle: {id: 2, text: 'Frozen Truck'}} as any);
            mockGetCourierById.mockResolvedValueOnce(courier);

            const {result} = renderHook(() => useDispatchExecutor(mockShowToast));

            let dispatchPromise: Promise<boolean>;
            act(() => {
                dispatchPromise = result.current.dispatchJobs(42, [job]);
            });

            await waitFor(() => {
                expect(result.current.pendingConfirmation).not.toBeNull();
            });
            expect(result.current.pendingConfirmation!.type).toBe('chilled-warning');

            await act(async () => {
                result.current.resolveConfirmation(false);
            });
            await dispatchPromise!;
        });

        it('should not show chilled warning for a standard vehicle job', async () => {
            const courier = createMockCourier({vehicleType: 'Car'});
            const job = createMockJob({vehicle: {id: 3, text: 'Standard Van'}} as any);
            mockGetCourierById.mockResolvedValueOnce(courier);
            mockAllocateJobs.mockResolvedValueOnce(undefined);

            const {result} = renderHook(() => useDispatchExecutor(mockShowToast));

            await act(async () => {
                await result.current.dispatchJobs(42, [job]);
            });

            expect(result.current.pendingConfirmation).toBeNull();
            expect(mockAllocateJobs).toHaveBeenCalled();
        });

        it('should not show chilled warning for a job with no vehicle', async () => {
            const courier = createMockCourier({vehicleType: 'Car'});
            const job = createMockJob({vehicle: undefined});
            mockGetCourierById.mockResolvedValueOnce(courier);
            mockAllocateJobs.mockResolvedValueOnce(undefined);

            const {result} = renderHook(() => useDispatchExecutor(mockShowToast));

            await act(async () => {
                await result.current.dispatchJobs(42, [job]);
            });

            expect(result.current.pendingConfirmation).toBeNull();
            expect(mockAllocateJobs).toHaveBeenCalled();
        });

        it('should be case-insensitive when checking vehicle text', async () => {
            const courier = createMockCourier({vehicleType: 'Car'});
            const job = createMockJob({vehicle: {id: 1, text: 'CHILLED VAN'}} as any);
            mockGetCourierById.mockResolvedValueOnce(courier);

            const {result} = renderHook(() => useDispatchExecutor(mockShowToast));

            let dispatchPromise: Promise<boolean>;
            act(() => {
                dispatchPromise = result.current.dispatchJobs(42, [job]);
            });

            await waitFor(() => {
                expect(result.current.pendingConfirmation).not.toBeNull();
            });
            expect(result.current.pendingConfirmation!.type).toBe('chilled-warning');

            await act(async () => {
                result.current.resolveConfirmation(false);
            });
            await dispatchPromise!;
        });
    });

    describe('chilled courier detection', () => {
        it('should not show warning when courier vehicle is chilled', async () => {
            const courier = createMockCourier({vehicleType: 'Chilled Van'});
            const job = createMockJob({vehicle: {id: 1, text: 'Chilled Van'}} as any);
            mockGetCourierById.mockResolvedValueOnce(courier);
            mockAllocateJobs.mockResolvedValueOnce(undefined);

            const {result} = renderHook(() => useDispatchExecutor(mockShowToast));

            await act(async () => {
                await result.current.dispatchJobs(42, [job]);
            });

            expect(result.current.pendingConfirmation).toBeNull();
            expect(mockAllocateJobs).toHaveBeenCalled();
        });

        it('should not show warning when courier vehicle is frozen', async () => {
            const courier = createMockCourier({vehicleType: 'Frozen Truck'});
            const job = createMockJob({vehicle: {id: 1, text: 'Frozen Truck'}} as any);
            mockGetCourierById.mockResolvedValueOnce(courier);
            mockAllocateJobs.mockResolvedValueOnce(undefined);

            const {result} = renderHook(() => useDispatchExecutor(mockShowToast));

            await act(async () => {
                await result.current.dispatchJobs(42, [job]);
            });

            expect(result.current.pendingConfirmation).toBeNull();
            expect(mockAllocateJobs).toHaveBeenCalled();
        });

        it('should show warning when courier has empty vehicleType', async () => {
            const courier = createMockCourier({vehicleType: ''});
            const job = createMockJob({vehicle: {id: 1, text: 'Chilled Van'}} as any);
            mockGetCourierById.mockResolvedValueOnce(courier);

            const {result} = renderHook(() => useDispatchExecutor(mockShowToast));

            let dispatchPromise: Promise<boolean>;
            act(() => {
                dispatchPromise = result.current.dispatchJobs(42, [job]);
            });

            await waitFor(() => {
                expect(result.current.pendingConfirmation).not.toBeNull();
            });
            expect(result.current.pendingConfirmation!.type).toBe('chilled-warning');

            await act(async () => {
                result.current.resolveConfirmation(false);
            });
            await dispatchPromise!;
        });
    });

    describe('chilled job warning dialog', () => {
        it('should proceed with dispatch when user confirms chilled warning', async () => {
            const courier = createMockCourier({vehicleType: 'Car'});
            const job = createMockJob({vehicle: {id: 1, text: 'Chilled Van'}} as any);
            mockGetCourierById.mockResolvedValueOnce(courier);
            mockAllocateJobs.mockResolvedValueOnce(undefined);

            const {result} = renderHook(() => useDispatchExecutor(mockShowToast));

            let dispatchPromise: Promise<boolean>;
            act(() => {
                dispatchPromise = result.current.dispatchJobs(42, [job]);
            });

            await waitFor(() => {
                expect(result.current.pendingConfirmation).not.toBeNull();
            });

            await act(async () => {
                result.current.resolveConfirmation(true);
            });

            expect(await dispatchPromise!).toBe(true);
            expect(mockAllocateJobs).toHaveBeenCalled();
        });

        it('should abort dispatch when user cancels chilled warning', async () => {
            const courier = createMockCourier({vehicleType: 'Car'});
            const job = createMockJob({vehicle: {id: 1, text: 'Chilled Van'}} as any);
            mockGetCourierById.mockResolvedValueOnce(courier);

            const {result} = renderHook(() => useDispatchExecutor(mockShowToast));

            let dispatchPromise: Promise<boolean>;
            act(() => {
                dispatchPromise = result.current.dispatchJobs(42, [job]);
            });

            await waitFor(() => {
                expect(result.current.pendingConfirmation).not.toBeNull();
            });

            await act(async () => {
                result.current.resolveConfirmation(false);
            });

            expect(await dispatchPromise!).toBe(false);
            expect(mockAllocateJobs).not.toHaveBeenCalled();
        });

        it('should use singular "Job" in message for a single chilled job', async () => {
            const courier = createMockCourier({vehicleType: 'Car', id: 'C42'});
            const job = createMockJob({jobNo: 'J100', vehicle: {id: 1, text: 'Chilled Van'}} as any);
            mockGetCourierById.mockResolvedValueOnce(courier);

            const {result} = renderHook(() => useDispatchExecutor(mockShowToast));

            let dispatchPromise: Promise<boolean>;
            act(() => {
                dispatchPromise = result.current.dispatchJobs(42, [job]);
            });

            await waitFor(() => {
                expect(result.current.pendingConfirmation).not.toBeNull();
            });

            const message = result.current.pendingConfirmation!.message;
            expect(message).toContain('Job J100');
            expect(message).toContain('requires');
            expect(message).toContain('courier C42');

            await act(async () => {
                result.current.resolveConfirmation(false);
            });
            await dispatchPromise!;
        });

        it('should use plural "Jobs" in message for multiple chilled jobs', async () => {
            const courier = createMockCourier({vehicleType: 'Car'});
            const jobs = [
                createMockJob({id: 100, jobNo: 'J100', vehicle: {id: 1, text: 'Chilled Van'}} as any),
                createMockJob({id: 101, jobNo: 'J101', vehicle: {id: 2, text: 'Frozen Truck'}} as any),
            ];
            mockGetCourierById.mockResolvedValueOnce(courier);

            const {result} = renderHook(() => useDispatchExecutor(mockShowToast));

            let dispatchPromise: Promise<boolean>;
            act(() => {
                dispatchPromise = result.current.dispatchJobs(42, jobs);
            });

            await waitFor(() => {
                expect(result.current.pendingConfirmation).not.toBeNull();
            });

            const message = result.current.pendingConfirmation!.message;
            expect(message).toContain('Jobs J100, J101');
            expect(message).toContain('require ');

            await act(async () => {
                result.current.resolveConfirmation(false);
            });
            await dispatchPromise!;
        });

        it('should show courier vehicle type in warning message', async () => {
            const courier = createMockCourier({vehicleType: 'Motorcycle'});
            const job = createMockJob({vehicle: {id: 1, text: 'Chilled Van'}} as any);
            mockGetCourierById.mockResolvedValueOnce(courier);

            const {result} = renderHook(() => useDispatchExecutor(mockShowToast));

            let dispatchPromise: Promise<boolean>;
            act(() => {
                dispatchPromise = result.current.dispatchJobs(42, [job]);
            });

            await waitFor(() => {
                expect(result.current.pendingConfirmation).not.toBeNull();
            });

            expect(result.current.pendingConfirmation!.message).toContain('"Motorcycle"');

            await act(async () => {
                result.current.resolveConfirmation(false);
            });
            await dispatchPromise!;
        });

        it('should show "unknown" when courier has no vehicleType', async () => {
            const courier = createMockCourier({vehicleType: ''});
            const job = createMockJob({vehicle: {id: 1, text: 'Chilled Van'}} as any);
            mockGetCourierById.mockResolvedValueOnce(courier);

            const {result} = renderHook(() => useDispatchExecutor(mockShowToast));

            let dispatchPromise: Promise<boolean>;
            act(() => {
                dispatchPromise = result.current.dispatchJobs(42, [job]);
            });

            await waitFor(() => {
                expect(result.current.pendingConfirmation).not.toBeNull();
            });

            expect(result.current.pendingConfirmation!.message).toContain('"unknown"');

            await act(async () => {
                result.current.resolveConfirmation(false);
            });
            await dispatchPromise!;
        });

        it('should only warn about chilled jobs in a mixed batch', async () => {
            const courier = createMockCourier({vehicleType: 'Car'});
            const jobs = [
                createMockJob({id: 100, jobNo: 'J100', vehicle: {id: 1, text: 'Chilled Van'}} as any),
                createMockJob({id: 200, jobNo: 'J200', vehicle: {id: 3, text: 'Standard Van'}} as any),
            ];
            mockGetCourierById.mockResolvedValueOnce(courier);
            mockAllocateJobs.mockResolvedValueOnce(undefined);

            const {result} = renderHook(() => useDispatchExecutor(mockShowToast));

            let dispatchPromise: Promise<boolean>;
            act(() => {
                dispatchPromise = result.current.dispatchJobs(42, jobs);
            });

            await waitFor(() => {
                expect(result.current.pendingConfirmation).not.toBeNull();
            });

            const message = result.current.pendingConfirmation!.message;
            expect(message).toContain('Job J100');
            expect(message).not.toContain('J200');

            // User confirms → both jobs dispatched
            await act(async () => {
                result.current.resolveConfirmation(true);
            });

            expect(await dispatchPromise!).toBe(true);
            expect(mockAllocateJobs).toHaveBeenCalledWith(42, [100, 200]);
        });
    });

    describe('dangerous goods validation', () => {
        it('should reject DG job when courier has no DG license', async () => {
            const courier = createMockCourier({dangerousGoods: 0, dgLicenseExpiry: null});
            const dgJob = createMockJob({dgClass: 3});
            mockGetCourierById.mockResolvedValueOnce(courier);

            const {result} = renderHook(() => useDispatchExecutor(mockShowToast));

            let success: boolean;
            await act(async () => {
                success = await result.current.dispatchJobs(42, [dgJob]);
            });

            expect(success!).toBe(false);
            expect(mockShowToast).toHaveBeenCalledWith(
                expect.stringContaining("doesn't have DG License"),
                'error',
            );
            expect(mockAllocateJobs).not.toHaveBeenCalled();
        });

        it('should reject DG job when courier DG license is expired', async () => {
            const courier = createMockCourier({dangerousGoods: 1, dgLicenseExpiry: '2020-01-01'});
            const dgJob = createMockJob({dgClass: 3});
            mockGetCourierById.mockResolvedValueOnce(courier);

            const {result} = renderHook(() => useDispatchExecutor(mockShowToast));

            let success: boolean;
            await act(async () => {
                success = await result.current.dispatchJobs(42, [dgJob]);
            });

            expect(success!).toBe(false);
            expect(mockShowToast).toHaveBeenCalledWith(
                expect.stringContaining('license has expired'),
                'error',
            );
            expect(mockAllocateJobs).not.toHaveBeenCalled();
        });
    });

    describe('multiple jobs dispatch', () => {
        it('should show plural toast message when dispatching multiple jobs', async () => {
            const courier = createMockCourier();
            const jobs = [
                createMockJob({id: 100, jobNo: 'J100'}),
                createMockJob({id: 101, jobNo: 'J101'}),
            ];
            mockGetCourierById.mockResolvedValueOnce(courier);
            mockAllocateJobs.mockResolvedValueOnce(undefined);

            const {result} = renderHook(() => useDispatchExecutor(mockShowToast));

            await act(async () => {
                await result.current.dispatchJobs(42, jobs);
            });

            expect(mockShowToast).toHaveBeenCalledWith(
                expect.stringContaining('2 jobs'),
                'success',
            );
            expect(mockAllocateJobs).toHaveBeenCalledWith(42, [100, 101]);
        });
    });

    describe('reassignJob edge cases', () => {
        it('should return false when user cancels courier selection', async () => {
            const job = createMockJob({jobNo: 'J300', courierData: {courierId: 10, courier: 'Old', courierNumber: 'C10'}});

            const {result} = renderHook(() => useDispatchExecutor(mockShowToast));

            let reassignPromise: Promise<boolean>;
            act(() => {
                reassignPromise = result.current.reassignJob(job);
            });

            expect(result.current.pendingCourierSelection).not.toBeNull();

            await act(async () => {
                result.current.resolveCourierSelection(null);
            });

            expect(await reassignPromise!).toBe(false);
            expect(mockReAllocateJobs).not.toHaveBeenCalled();
        });

        it('should show error toast when reassignment throws', async () => {
            const job = createMockJob({jobNo: 'J300', courierData: {courierId: 10, courier: 'Old', courierNumber: 'C10'}});
            const newCourier = createMockCourier({courierId: 50, id: 'C50'});
            mockGetCourierById.mockResolvedValueOnce(newCourier);
            mockReAllocateJobs.mockRejectedValueOnce(new Error('Server error'));

            const {result} = renderHook(() => useDispatchExecutor(mockShowToast));

            let reassignPromise: Promise<boolean>;
            act(() => {
                reassignPromise = result.current.reassignJob(job);
            });

            await act(async () => {
                result.current.resolveCourierSelection(50);
            });

            expect(await reassignPromise!).toBe(false);
            expect(mockShowToast).toHaveBeenCalledWith(
                expect.stringContaining('Server error'),
                'error',
            );
        });
    });

    describe('assignSingleJobById', () => {
        it('should allocate a single job by ID', async () => {
            const courier = createMockCourier();
            const job = createMockJob({id: 200, jobNo: 'J200'});
            mockGetCourierById.mockResolvedValueOnce(courier);
            mockGetDispatchJobDetail.mockResolvedValueOnce(job);
            mockAllocateJobs.mockResolvedValueOnce(undefined);

            const {result} = renderHook(() => useDispatchExecutor(mockShowToast));

            let success: boolean;
            await act(async () => {
                success = await result.current.assignSingleJobById(42, 200);
            });

            expect(success!).toBe(true);
            expect(mockAllocateJobs).toHaveBeenCalledWith(42, [200]);
            expect(mockShowToast).toHaveBeenCalledWith(
                expect.stringContaining('Dispatched job #J200 to C42'),
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
