/** @jest-environment jest-environment-jsdom */
/**
 * Tests for DispatchExecutorService
 * Covers the chilled job warning logic: isChilledJob, isChilledCourier,
 * and checkChilledJobWarning confirmation dialog.
 */
import {IDispatchJob} from "../interfaces/job.interface";
import {ActiveCourierViewModel} from "../interfaces/courier.interface";
import DispatchExecutorService from "./dispatch-executor.service";

// Mock angular before importing the service
jest.mock('angular', () => ({
    default: {
        element: jest.fn(),
        module: jest.fn(() => ({
            service: jest.fn(),
            provider: jest.fn(),
        })),
    },
    element: jest.fn(),
    module: jest.fn(() => ({
        service: jest.fn(),
        provider: jest.fn(),
    })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockJob(overrides: Partial<IDispatchJob> = {}): IDispatchJob {
    return {
        angularId: '1',
        selected: false,
        showCourierSearch: false,
        id: 1,
        jobNo: 'J001',
        hasBeenRead: true,
        isParentOrSingle: true,
        parentId: 0,
        isFlightJob: false,
        isAgentJob: false,
        isBulkJob: false,
        isArchived: false,
        courierSearchLoading: false,
        vehicle: undefined,
        dgClass: 0,
        ...overrides,
    } as IDispatchJob;
}

function createMockCourier(overrides: Partial<ActiveCourierViewModel> = {}): ActiveCourierViewModel {
    return {
        courierId: 1,
        id: 'C01',
        name: 'Test Courier',
        dangerousGoods: 0,
        dgLicenseExpiry: null,
        label: 'C01',
        text: 'C01',
        isActive: true,
        vehicleType: 'Car',
        ...overrides,
    };
}

function createService(mdDialogOverrides: any = {}) {
    const mockConfirmChain = {
        title: jest.fn().mockReturnThis(),
        textContent: jest.fn().mockReturnThis(),
        ok: jest.fn().mockReturnThis(),
        cancel: jest.fn().mockReturnThis(),
    };

    const mockMdDialog = {
        show: jest.fn().mockResolvedValue(true),
        confirm: jest.fn().mockReturnValue(mockConfirmChain),
        alert: jest.fn().mockReturnValue({
            parent: jest.fn().mockReturnThis(),
            clickOutsideToClose: jest.fn().mockReturnThis(),
            title: jest.fn().mockReturnThis(),
            textContent: jest.fn().mockReturnThis(),
            ariaLabel: jest.fn().mockReturnThis(),
            ok: jest.fn().mockReturnThis(),
        }),
        ...mdDialogOverrides,
    };

    const mockDispatchData = {
        getCourierById: jest.fn(),
        getDispatchJobDetail: jest.fn(),
        allocateJobs: jest.fn().mockResolvedValue(undefined),
        addFollowupEvent: jest.fn().mockResolvedValue(undefined),
        getClearListJobs: jest.fn(),
        getJobsWithFilters: jest.fn(),
    };

    const mockDocument = {
        parent: jest.fn().mockReturnValue(document.body),
    };

    const service = new (DispatchExecutorService as any)(
        mockMdDialog,
        mockDispatchData,
        mockDocument,
    );

    return {service, mockMdDialog, mockDispatchData, mockConfirmChain};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DispatchExecutorService', () => {

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {
        });
        jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        jest.spyOn(console, 'error').mockImplementation(() => {
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // -----------------------------------------------------------------------
    // isChilledJob (private, tested via executeJobDispatch behavior)
    // -----------------------------------------------------------------------
    describe('Chilled job detection', () => {
        it('should detect a chilled job by vehicle text containing "chilled"', async () => {
            const {service, mockMdDialog} = createService();
            const job = createMockJob({vehicle: {id: 1, text: 'Chilled Van'}});
            const courier = createMockCourier({vehicleType: 'Car'});

            // The chilled warning check will fire → dialog appears
            mockMdDialog.show.mockRejectedValueOnce(undefined); // user cancels
            await service['executeJobDispatch'](courier, [job]);

            expect(mockMdDialog.confirm).toHaveBeenCalled();
        });

        it('should detect a frozen job by vehicle text containing "frozen"', async () => {
            const {service, mockMdDialog} = createService();
            const job = createMockJob({vehicle: {id: 2, text: 'Frozen Truck'}});
            const courier = createMockCourier({vehicleType: 'Car'});

            mockMdDialog.show.mockRejectedValueOnce(undefined);
            await service['executeJobDispatch'](courier, [job]);

            expect(mockMdDialog.confirm).toHaveBeenCalled();
        });

        it('should not flag a standard vehicle job as chilled', async () => {
            const {service, mockMdDialog, mockDispatchData} = createService();
            const job = createMockJob({vehicle: {id: 3, text: 'Standard Van'}});
            const courier = createMockCourier({vehicleType: 'Car'});

            mockDispatchData.allocateJobs.mockResolvedValue(undefined);
            await service['executeJobDispatch'](courier, [job]);

            // No confirm dialog for non-chilled job
            expect(mockMdDialog.confirm).not.toHaveBeenCalled();
        });

        it('should not flag a job with no vehicle as chilled', async () => {
            const {service, mockMdDialog, mockDispatchData} = createService();
            const job = createMockJob({vehicle: undefined});
            const courier = createMockCourier({vehicleType: 'Car'});

            mockDispatchData.allocateJobs.mockResolvedValue(undefined);
            await service['executeJobDispatch'](courier, [job]);

            expect(mockMdDialog.confirm).not.toHaveBeenCalled();
        });

        it('should be case-insensitive when checking vehicle text', async () => {
            const {service, mockMdDialog} = createService();
            const job = createMockJob({vehicle: {id: 1, text: 'CHILLED VAN'}});
            const courier = createMockCourier({vehicleType: 'Car'});

            mockMdDialog.show.mockRejectedValueOnce(undefined);
            await service['executeJobDispatch'](courier, [job]);

            expect(mockMdDialog.confirm).toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // isChilledCourier
    // -----------------------------------------------------------------------
    describe('Chilled courier detection', () => {
        it('should not show warning when courier vehicle is chilled', async () => {
            const {service, mockMdDialog, mockDispatchData} = createService();
            const job = createMockJob({vehicle: {id: 1, text: 'Chilled Van'}});
            const courier = createMockCourier({vehicleType: 'Chilled Van'});

            mockDispatchData.allocateJobs.mockResolvedValue(undefined);
            await service['executeJobDispatch'](courier, [job]);

            // No warning — courier IS chilled
            expect(mockMdDialog.confirm).not.toHaveBeenCalled();
        });

        it('should not show warning when courier vehicle is frozen', async () => {
            const {service, mockMdDialog, mockDispatchData} = createService();
            const job = createMockJob({vehicle: {id: 1, text: 'Frozen Truck'}});
            const courier = createMockCourier({vehicleType: 'Frozen Truck'});

            mockDispatchData.allocateJobs.mockResolvedValue(undefined);
            await service['executeJobDispatch'](courier, [job]);

            expect(mockMdDialog.confirm).not.toHaveBeenCalled();
        });

        it('should show warning when courier has no vehicleType', async () => {
            const {service, mockMdDialog} = createService();
            const job = createMockJob({vehicle: {id: 1, text: 'Chilled Van'}});
            const courier = createMockCourier({vehicleType: ''});

            mockMdDialog.show.mockRejectedValueOnce(undefined);
            await service['executeJobDispatch'](courier, [job]);

            expect(mockMdDialog.confirm).toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // checkChilledJobWarning - confirmation flow
    // -----------------------------------------------------------------------
    describe('Chilled job warning dialog', () => {
        it('should proceed with dispatch when user confirms', async () => {
            const {service, mockMdDialog, mockDispatchData} = createService();
            const job = createMockJob({vehicle: {id: 1, text: 'Chilled Van'}});
            const courier = createMockCourier({vehicleType: 'Car'});

            // User clicks "Dispatch Anyway"
            mockMdDialog.show.mockResolvedValueOnce(true);
            mockDispatchData.allocateJobs.mockResolvedValue(undefined);

            await service['executeJobDispatch'](courier, [job]);

            expect(mockDispatchData.allocateJobs).toHaveBeenCalled();
        });

        it('should abort dispatch when user cancels', async () => {
            const {service, mockMdDialog, mockDispatchData} = createService();
            const job = createMockJob({vehicle: {id: 1, text: 'Chilled Van'}});
            const courier = createMockCourier({vehicleType: 'Car'});

            // User clicks "Cancel" → $mdDialog.show rejects
            mockMdDialog.show.mockRejectedValueOnce(undefined);

            await service['executeJobDispatch'](courier, [job]);

            expect(mockDispatchData.allocateJobs).not.toHaveBeenCalled();
        });

        it('should use singular "Job" for a single chilled job', async () => {
            const {service, mockMdDialog, mockConfirmChain} = createService();
            const job = createMockJob({jobNo: 'J100', vehicle: {id: 1, text: 'Chilled Van'}});
            const courier = createMockCourier({vehicleType: 'Car', id: 'C42'});

            mockMdDialog.show.mockRejectedValueOnce(undefined);
            await service['executeJobDispatch'](courier, [job]);

            const textContent = mockConfirmChain.textContent.mock.calls[0][0] as string;
            expect(textContent).toContain('Job J100');
            expect(textContent).toContain('requires');
            expect(textContent).toContain('courier C42');
        });

        it('should use plural "Jobs" for multiple chilled jobs', async () => {
            const {service, mockMdDialog, mockConfirmChain} = createService();
            const jobs = [
                createMockJob({jobNo: 'J100', vehicle: {id: 1, text: 'Chilled Van'}}),
                createMockJob({jobNo: 'J101', vehicle: {id: 2, text: 'Frozen Truck'}}),
            ];
            const courier = createMockCourier({vehicleType: 'Car'});

            mockMdDialog.show.mockRejectedValueOnce(undefined);
            await service['executeJobDispatch'](courier, jobs);

            const textContent = mockConfirmChain.textContent.mock.calls[0][0] as string;
            expect(textContent).toContain('Jobs J100, J101');
            expect(textContent).toContain('require ');
        });

        it('should show courier vehicle type in the dialog message', async () => {
            const {service, mockMdDialog, mockConfirmChain} = createService();
            const job = createMockJob({vehicle: {id: 1, text: 'Chilled Van'}});
            const courier = createMockCourier({vehicleType: 'Motorcycle'});

            mockMdDialog.show.mockRejectedValueOnce(undefined);
            await service['executeJobDispatch'](courier, [job]);

            const textContent = mockConfirmChain.textContent.mock.calls[0][0] as string;
            expect(textContent).toContain('"Motorcycle"');
        });

        it('should show "unknown" when courier has no vehicleType', async () => {
            const {service, mockMdDialog, mockConfirmChain} = createService();
            const job = createMockJob({vehicle: {id: 1, text: 'Chilled Van'}});
            const courier = createMockCourier({vehicleType: ''});

            mockMdDialog.show.mockRejectedValueOnce(undefined);
            await service['executeJobDispatch'](courier, [job]);

            const textContent = mockConfirmChain.textContent.mock.calls[0][0] as string;
            expect(textContent).toContain('"unknown"');
        });

        it('should only warn about chilled jobs in a mixed batch', async () => {
            const {service, mockMdDialog, mockConfirmChain, mockDispatchData} = createService();
            const jobs = [
                createMockJob({jobNo: 'J100', vehicle: {id: 1, text: 'Chilled Van'}}),
                createMockJob({jobNo: 'J200', vehicle: {id: 3, text: 'Standard Van'}}),
            ];
            const courier = createMockCourier({vehicleType: 'Car'});

            // User confirms the warning
            mockMdDialog.show.mockResolvedValueOnce(true);
            mockDispatchData.allocateJobs.mockResolvedValue(undefined);

            await service['executeJobDispatch'](courier, jobs);

            const textContent = mockConfirmChain.textContent.mock.calls[0][0] as string;
            // Only the chilled job should be mentioned
            expect(textContent).toContain('Job J100');
            expect(textContent).not.toContain('J200');
            // Both jobs should still be dispatched after confirmation
            expect(mockDispatchData.allocateJobs).toHaveBeenCalled();
        });
    });
});
