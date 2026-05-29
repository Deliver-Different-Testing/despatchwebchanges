/** @jest-environment jest-environment-jsdom */
/**
 * Tests for JobAddStopService
 * Covers addNewStop routing, addRecurringJobStop, dialog handling,
 * and address generation.
 */
import {IAddressViewModel, IDispatchJob} from "../interfaces/job.interface";
import JobAddStopService from "./job-add-stop.service";
import DispatchCoreService from "./dispatch-core.service";
import {EditAddressDialogService} from "../components/dialogs/edit-address-dialog/edit-address-dialog.service";
import ToastrService from "./toastr.service";
import JobSuffix from "../enums/job-suffix.enum";
import {AddressType} from "../enums/address-type.enum";

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

function createMockDispatchData(): jest.Mocked<Pick<DispatchCoreService, 'addStopToJob'>> {
    return { addStopToJob: jest.fn() };
}

function createMockEditAddressDialogService(): jest.Mocked<Pick<EditAddressDialogService, 'openEditAddressDialog'>> {
    return { openEditAddressDialog: jest.fn() };
}

function createMockToastrService(): jest.Mocked<Pick<ToastrService, 'showWarningToast'>> {
    return { showWarningToast: jest.fn() };
}

function blankAddress(): IAddressViewModel {
    return {
        addressLine1: "",
        addressLine2: "",
        addressLine3: "",
        addressLine4: "",
        addressLine5: "",
        addressLine6: "",
        addressLine7: "",
        addressLine8: "",
        fullAddress: "",
    };
}

function createJob(overrides: Partial<IDispatchJob> = {}): IDispatchJob {
    return {
        angularId: '1',
        selected: false,
        showCourierSearch: false,
        id: 42,
        jobNo: 'J0011',
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
        pickupAddress: blankAddress(),
        deliveryAddress: blankAddress(),
        ...overrides,
    } as IDispatchJob;
}

function createService() {
    const dispatchData = createMockDispatchData();
    const editAddressDialogService = createMockEditAddressDialogService();
    const toastrService = createMockToastrService();

    const service = new (JobAddStopService as any)(
        dispatchData,
        editAddressDialogService,
        toastrService,
    ) as JobAddStopService;

    return { service, dispatchData, editAddressDialogService, toastrService };
}

// ---------------------------------------------------------------------------
// addNewStop
// ---------------------------------------------------------------------------

describe('addNewStop', () => {
    it('calls addStopToJob with pickup address when job suffix is Pickup', async () => {
        const { service, dispatchData, editAddressDialogService } = createService();
        const job = createJob({ jobNo: 'J001' + JobSuffix.Pickup });
        const dialogAddress = { ...blankAddress(), addressLine1: '99 New St' };

        editAddressDialogService.openEditAddressDialog.mockResolvedValue(dialogAddress as any);
        dispatchData.addStopToJob.mockResolvedValue(100);

        const result = await service.addNewStop(job);

        expect(result).toBe(100);
        expect(dispatchData.addStopToJob).toHaveBeenCalledWith(job.id, dialogAddress, undefined);
    });

    it('calls addStopToJob with delivery address when job suffix is Delivery', async () => {
        const { service, dispatchData, editAddressDialogService } = createService();
        const job = createJob({ jobNo: 'J001' + JobSuffix.Delivery });
        const dialogAddress = { ...blankAddress(), addressLine1: '55 Delivery Rd' };

        editAddressDialogService.openEditAddressDialog.mockResolvedValue(dialogAddress as any);
        dispatchData.addStopToJob.mockResolvedValue(200);

        const result = await service.addNewStop(job);

        expect(result).toBe(200);
        expect(dispatchData.addStopToJob).toHaveBeenCalledWith(job.id, undefined, dialogAddress);
    });

    it('shows warning toast and returns undefined for Flight suffix', async () => {
        const { service, toastrService } = createService();
        const job = createJob({ jobNo: 'J001' + JobSuffix.Flight });

        const result = await service.addNewStop(job);

        expect(result).toBeUndefined();
        expect(toastrService.showWarningToast).toHaveBeenCalledWith("Cannot add stop to this job");
    });

    it('shows warning toast for unknown suffix', async () => {
        const { service, toastrService } = createService();
        const job = createJob({ jobNo: 'J0019' });

        const result = await service.addNewStop(job);

        expect(result).toBeUndefined();
        expect(toastrService.showWarningToast).toHaveBeenCalledWith("Cannot add stop to this job");
    });

    it('returns undefined when dialog is cancelled for pickup stop', async () => {
        const { service, dispatchData, editAddressDialogService } = createService();
        const job = createJob({ jobNo: 'J001' + JobSuffix.Pickup });

        editAddressDialogService.openEditAddressDialog.mockResolvedValue(undefined as any);

        const result = await service.addNewStop(job);

        expect(result).toBeUndefined();
        expect(dispatchData.addStopToJob).not.toHaveBeenCalled();
    });

    it('returns undefined when dialog is cancelled for delivery stop', async () => {
        const { service, dispatchData, editAddressDialogService } = createService();
        const job = createJob({ jobNo: 'J001' + JobSuffix.Delivery });

        editAddressDialogService.openEditAddressDialog.mockResolvedValue(undefined as any);

        const result = await service.addNewStop(job);

        expect(result).toBeUndefined();
        expect(dispatchData.addStopToJob).not.toHaveBeenCalled();
    });

    it('returns undefined when job has no pickup address', async () => {
        const { service, dispatchData } = createService();
        const job = createJob({ jobNo: 'J001' + JobSuffix.Pickup, pickupAddress: undefined as any });

        const result = await service.addNewStop(job);

        expect(result).toBeUndefined();
        expect(dispatchData.addStopToJob).not.toHaveBeenCalled();
    });

    it('returns undefined when job has no delivery address', async () => {
        const { service, dispatchData } = createService();
        const job = createJob({ jobNo: 'J001' + JobSuffix.Delivery, deliveryAddress: undefined as any });

        const result = await service.addNewStop(job);

        expect(result).toBeUndefined();
        expect(dispatchData.addStopToJob).not.toHaveBeenCalled();
    });

    it('passes $event to dialog for pickup stop', async () => {
        const { service, editAddressDialogService } = createService();
        const job = createJob({ jobNo: 'J001' + JobSuffix.Pickup });
        const mockEvent = new MouseEvent('click');

        editAddressDialogService.openEditAddressDialog.mockResolvedValue(undefined as any);

        await service.addNewStop(job, mockEvent);

        expect(editAddressDialogService.openEditAddressDialog).toHaveBeenCalledWith(
            expect.any(Object), mockEvent, "Add Pick Up Stop", "Add Stop", true, AddressType.Pickup);
    });

    it('passes $event to dialog for delivery stop', async () => {
        const { service, editAddressDialogService } = createService();
        const job = createJob({ jobNo: 'J001' + JobSuffix.Delivery });
        const mockEvent = new MouseEvent('click');

        editAddressDialogService.openEditAddressDialog.mockResolvedValue(undefined as any);

        await service.addNewStop(job, mockEvent);

        expect(editAddressDialogService.openEditAddressDialog).toHaveBeenCalledWith(
            expect.any(Object), mockEvent, "Add Delivery Stop", "Add Stop", true, AddressType.Delivery);
    });
});

// ---------------------------------------------------------------------------
// addRecurringJobStop
// ---------------------------------------------------------------------------

describe('addRecurringJobStop', () => {
    it('calls addStopToJob with pickup address when isPickup is true', async () => {
        const { service, dispatchData, editAddressDialogService } = createService();
        const job = { id: 10, pickupAddress: blankAddress(), deliveryAddress: blankAddress() };
        const dialogAddress = { ...blankAddress(), addressLine1: '1 Pickup Ln' };

        editAddressDialogService.openEditAddressDialog.mockResolvedValue(dialogAddress as any);
        dispatchData.addStopToJob.mockResolvedValue(300);

        const result = await service.addRecurringJobStop(job, true);

        expect(result).toBe(300);
        expect(dispatchData.addStopToJob).toHaveBeenCalledWith(10, dialogAddress, undefined);
    });

    it('calls addStopToJob with delivery address when isPickup is false', async () => {
        const { service, dispatchData, editAddressDialogService } = createService();
        const job = { id: 10, pickupAddress: blankAddress(), deliveryAddress: blankAddress() };
        const dialogAddress = { ...blankAddress(), addressLine1: '2 Delivery Ln' };

        editAddressDialogService.openEditAddressDialog.mockResolvedValue(dialogAddress as any);
        dispatchData.addStopToJob.mockResolvedValue(400);

        const result = await service.addRecurringJobStop(job, false);

        expect(result).toBe(400);
        expect(dispatchData.addStopToJob).toHaveBeenCalledWith(10, undefined, dialogAddress);
    });

    it('returns undefined when job has no pickup address', async () => {
        const { service, dispatchData } = createService();
        const job = { id: 10, pickupAddress: undefined, deliveryAddress: blankAddress() };

        const result = await service.addRecurringJobStop(job as any, true);

        expect(result).toBeUndefined();
        expect(dispatchData.addStopToJob).not.toHaveBeenCalled();
    });

    it('returns undefined when job has no delivery address', async () => {
        const { service, dispatchData } = createService();
        const job = { id: 10, pickupAddress: blankAddress(), deliveryAddress: undefined };

        const result = await service.addRecurringJobStop(job as any, true);

        expect(result).toBeUndefined();
        expect(dispatchData.addStopToJob).not.toHaveBeenCalled();
    });

    it('returns undefined when dialog is cancelled', async () => {
        const { service, dispatchData, editAddressDialogService } = createService();
        const job = { id: 10, pickupAddress: blankAddress(), deliveryAddress: blankAddress() };

        editAddressDialogService.openEditAddressDialog.mockResolvedValue(undefined as any);

        const result = await service.addRecurringJobStop(job, true);

        expect(result).toBeUndefined();
        expect(dispatchData.addStopToJob).not.toHaveBeenCalled();
    });

    it('opens dialog with "Add Pick Up Stop" title when isPickup is true', async () => {
        const { service, editAddressDialogService } = createService();
        const job = { id: 10, pickupAddress: blankAddress(), deliveryAddress: blankAddress() };

        editAddressDialogService.openEditAddressDialog.mockResolvedValue(undefined as any);

        await service.addRecurringJobStop(job, true);

        expect(editAddressDialogService.openEditAddressDialog).toHaveBeenCalledWith(
            expect.any(Object), undefined, "Add Pick Up Stop", "Add Stop", true, AddressType.Pickup);
    });

    it('opens dialog with "Add Delivery Stop" title when isPickup is false', async () => {
        const { service, editAddressDialogService } = createService();
        const job = { id: 10, pickupAddress: blankAddress(), deliveryAddress: blankAddress() };

        editAddressDialogService.openEditAddressDialog.mockResolvedValue(undefined as any);

        await service.addRecurringJobStop(job, false);

        expect(editAddressDialogService.openEditAddressDialog).toHaveBeenCalledWith(
            expect.any(Object), undefined, "Add Delivery Stop", "Add Stop", true, AddressType.Delivery);
    });
});
