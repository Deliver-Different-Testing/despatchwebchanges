/** @jest-environment node */
/**
 * splitJobFlow Tests
 *
 * Unit tests for the split job orchestration function.
 * Covers: validation, address dialog cancel, courier dialog, successful flow, API error.
 */

import {executeSplitJobFlow, SplitJobFlowOptions} from './splitJobFlow';
import type {DispatchJob} from '../interfaces/dispatchJob';
import type {ShowToastFn} from './toastService';
import dayjs from 'dayjs';

// ── Mocks ──────────────────────────────────────────────────────────────

jest.mock('./splitJobApi');
jest.mock('../components/dialogs/edit-address-dialog/edit-address-dialog-react.module', () => ({
    openEditAddressDialog: jest.fn(),
}));
jest.mock('../components/dialogs/split-job-courier-dialog/openSplitJobCourierDialog', () => ({
    openSplitJobCourierDialog: jest.fn(),
}));
jest.mock('../components/dialogs/split-pricing-dialog/openSplitPricingDialog', () => ({
    openSplitPricingDialog: jest.fn(),
}));

import {previewSplitPricing, splitJob} from './splitJobApi';
import {openEditAddressDialog} from '../components/dialogs/edit-address-dialog/edit-address-dialog-react.module';
import {openSplitJobCourierDialog} from '../components/dialogs/split-job-courier-dialog/openSplitJobCourierDialog';
import {openSplitPricingDialog} from '../components/dialogs/split-pricing-dialog/openSplitPricingDialog';

const mockedSplitJob = splitJob as jest.Mock;
const mockedPreviewSplitPricing = previewSplitPricing as jest.Mock;
const mockedOpenEditAddressDialog = openEditAddressDialog as jest.Mock;
const mockedOpenSplitJobCourierDialog = openSplitJobCourierDialog as jest.Mock;
const mockedOpenSplitPricingDialog = openSplitPricingDialog as jest.Mock;

const CONFIRMED_ALLOCATION = [
    {sequence: 1, sharePercent: 70},
    {sequence: 2, sharePercent: 30},
];

// ── Helpers ────────────────────────────────────────────────────────────

function createMockJob(overrides?: Partial<DispatchJob>): DispatchJob {
    return {
        angularId: 'job-1',
        id: 1,
        jobNo: 'J001',
        hasBeenRead: true,
        showCourierSearch: false,
        parentId: 0,
        isFlightJob: false,
        isAgentJob: false,
        isBulkJob: false,
        isArchived: false,
        booked: dayjs('2025-03-15T09:00:00'),
        courierSearchLoading: false,
        pickupAddress: {} as any,
        deliveryAddress: {
            fullAddress: '20 High St, Auckland',
            addressLine1: '',
            addressLine2: '',
            addressLine3: '20',
            addressLine4: 'High St',
            addressLine5: 'Auckland',
            addressLine6: '',
            addressLine7: '',
            addressLine8: '',
        } as any,
        pickUpTimeZone: {id: 1, text: 'NZST'},
        deliveryTimeZone: {id: 1, text: 'NZST'},
        ...overrides,
    } as DispatchJob;
}

function createOptions(overrides?: Partial<SplitJobFlowOptions>): SplitJobFlowOptions {
    return {
        job: createMockJob(),
        showToast: jest.fn() as ShowToastFn,
        onComplete: jest.fn(),
        setLoading: jest.fn(),
        ...overrides,
    };
}

// ── Setup ──────────────────────────────────────────────────────────────

beforeEach(() => {
    mockedOpenEditAddressDialog.mockResolvedValue({
        fullAddress: '15 Meeting St, Auckland',
        addressLine1: '',
        addressLine2: '',
        addressLine3: '15',
        addressLine4: 'Meeting St',
        addressLine5: 'Auckland',
    });

    mockedOpenSplitJobCourierDialog.mockResolvedValue({action: 'skip'});

    mockedPreviewSplitPricing.mockResolvedValue({
        basis: 'RoadMiles',
        parentTotalRevenue: 89,
        parentTotalCost: 50,
        isSynthesised: false,
        legs: [],
    });
    mockedOpenSplitPricingDialog.mockResolvedValue({
        action: 'confirm',
        allocation: CONFIRMED_ALLOCATION,
    });

    mockedSplitJob.mockResolvedValue(undefined);
});

// ── Tests ──────────────────────────────────────────────────────────────

describe('executeSplitJobFlow', () => {
    describe('Validation', () => {
        it('shows error toast for archived job', async () => {
            const opts = createOptions({job: createMockJob({isArchived: true})});

            await executeSplitJobFlow(opts);

            expect(opts.showToast).toHaveBeenCalledWith(
                'Splitting archived jobs is not currently supported.',
                'error',
            );
            expect(mockedOpenEditAddressDialog).not.toHaveBeenCalled();
        });

        it('shows error toast when no delivery address', async () => {
            const opts = createOptions({job: createMockJob({deliveryAddress: undefined as any})});

            await executeSplitJobFlow(opts);

            expect(opts.showToast).toHaveBeenCalledWith('No delivery address found', 'error');
            expect(mockedOpenEditAddressDialog).not.toHaveBeenCalled();
        });
    });

    describe('Address Dialog', () => {
        it('opens address dialog with correct params', async () => {
            const opts = createOptions();

            await executeSplitJobFlow(opts);

            expect(mockedOpenEditAddressDialog).toHaveBeenCalledWith(
                opts.job.deliveryAddress,
                'Set Meeting Point',
                'Split Job',
            );
        });

        it('exits cleanly when user cancels address dialog', async () => {
            mockedOpenEditAddressDialog.mockResolvedValue(null);
            const opts = createOptions();

            await executeSplitJobFlow(opts);

            expect(mockedOpenSplitJobCourierDialog).not.toHaveBeenCalled();
            expect(mockedSplitJob).not.toHaveBeenCalled();
            expect(opts.showToast).not.toHaveBeenCalled();
        });

        it('shows error when address has no fullAddress', async () => {
            mockedOpenEditAddressDialog.mockResolvedValue({fullAddress: ''});
            const opts = createOptions();

            await executeSplitJobFlow(opts);

            expect(opts.showToast).toHaveBeenCalledWith('Invalid meeting point address', 'error');
            expect(mockedOpenSplitJobCourierDialog).not.toHaveBeenCalled();
            expect(mockedSplitJob).not.toHaveBeenCalled();
        });
    });

    describe('Courier Dialog', () => {
        it('opens courier dialog after address dialog', async () => {
            const opts = createOptions();

            await executeSplitJobFlow(opts);

            expect(mockedOpenSplitJobCourierDialog).toHaveBeenCalled();
        });

        it('exits cleanly when user cancels courier dialog', async () => {
            mockedOpenSplitJobCourierDialog.mockResolvedValue({action: 'cancel'});
            const opts = createOptions();

            await executeSplitJobFlow(opts);

            expect(mockedSplitJob).not.toHaveBeenCalled();
            expect(opts.showToast).not.toHaveBeenCalled();
        });

        it('passes null courierIdForLegB when user skips', async () => {
            mockedOpenSplitJobCourierDialog.mockResolvedValue({action: 'skip'});
            const opts = createOptions();

            await executeSplitJobFlow(opts);

            expect(mockedSplitJob).toHaveBeenCalledWith(
                expect.objectContaining({courierIdForLegB: null}),
            );
        });

        it('passes selected courierId when user assigns', async () => {
            mockedOpenSplitJobCourierDialog.mockResolvedValue({action: 'assign', courierId: 42});
            const opts = createOptions();

            await executeSplitJobFlow(opts);

            expect(mockedSplitJob).toHaveBeenCalledWith(
                expect.objectContaining({courierIdForLegB: 42}),
            );
        });
    });

    describe('Pricing Dialog', () => {
        it('previews the split pricing and opens the dialog after the courier dialog', async () => {
            const opts = createOptions();

            await executeSplitJobFlow(opts);

            expect(mockedPreviewSplitPricing).toHaveBeenCalledWith({
                jobId: 1,
                meetingPointAddress: expect.objectContaining({fullAddress: '15 Meeting St, Auckland'}),
            });
            expect(mockedOpenSplitPricingDialog).toHaveBeenCalledWith('J001', expect.anything());
            expect(mockedSplitJob).toHaveBeenCalledWith(
                expect.objectContaining({pricingAllocation: CONFIRMED_ALLOCATION}),
            );
        });

        it('leaves the job unsplit when the user cancels the pricing dialog', async () => {
            mockedOpenSplitPricingDialog.mockResolvedValue({action: 'cancel'});
            const opts = createOptions();

            await executeSplitJobFlow(opts);

            expect(mockedSplitJob).not.toHaveBeenCalled();
            expect(opts.showToast).not.toHaveBeenCalled();
        });

        it('leaves the job unsplit when the pricing dialog itself fails', async () => {
            // The user never saw the numbers, so consent is missing — don't split.
            mockedOpenSplitPricingDialog.mockRejectedValue(new Error('render failed'));
            const opts = createOptions();

            await executeSplitJobFlow(opts);

            expect(mockedSplitJob).not.toHaveBeenCalled();
            expect(opts.showToast).toHaveBeenCalledWith(
                expect.stringContaining('has not been split'),
                'error',
            );
        });

        it('still splits with a server-derived division when the preview fails', async () => {
            mockedPreviewSplitPricing.mockRejectedValue(new Error('boom'));
            const opts = createOptions();

            await executeSplitJobFlow(opts);

            expect(mockedOpenSplitPricingDialog).not.toHaveBeenCalled();
            expect(opts.showToast).toHaveBeenCalledWith(
                expect.stringContaining('Could not preview split pricing'),
                'warning',
            );
            expect(mockedSplitJob).toHaveBeenCalledWith(
                expect.objectContaining({pricingAllocation: null}),
            );
        });
    });

    describe('Successful Flow', () => {
        it('calls splitJob API, shows success toast, calls onComplete', async () => {
            const opts = createOptions();

            await executeSplitJobFlow(opts);

            expect(mockedSplitJob).toHaveBeenCalledWith({
                jobId: 1,
                meetingPointAddress: expect.objectContaining({fullAddress: '15 Meeting St, Auckland'}),
                courierIdForLegB: null,
                pricingAllocation: CONFIRMED_ALLOCATION,
            });
            expect(opts.showToast).toHaveBeenCalledWith('Job J001 successfully split', 'success');
            expect(opts.onComplete).toHaveBeenCalled();
            expect(opts.setLoading).toHaveBeenCalledWith(true);
            expect(opts.setLoading).toHaveBeenCalledWith(false);
        });
    });

    describe('Error Paths', () => {
        it('shows error toast when splitJob API fails', async () => {
            mockedSplitJob.mockRejectedValue(new Error('Network error'));
            const opts = createOptions();

            await executeSplitJobFlow(opts);

            expect(opts.showToast).toHaveBeenCalledWith('Error splitting job', 'error');
            expect(opts.setLoading).toHaveBeenCalledWith(false);
        });
    });
});
