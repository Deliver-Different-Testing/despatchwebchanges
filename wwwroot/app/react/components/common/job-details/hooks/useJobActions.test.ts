/**
 * useJobActions Hook Tests — Guided POD Collection (markJobAsDone) Flow
 */

import {renderHook, act} from '@testing-library/react';
import {useJobActions} from './useJobActions';
import {JobProperty} from '../../../../../enums/job-property.enum';
import dayjs from 'dayjs';

// ── Mocks ────────────────────────────────────────────────────────────

// Mock the dialog loader so ensureDateTimeDialog etc. are no-ops
jest.mock('./useDialogLoader', () => ({
    useDialogLoader: () => ({
        ensureSelectDialog: jest.fn().mockResolvedValue(undefined),
        ensureDateTimeDialog: jest.fn().mockResolvedValue(undefined),
        ensureAutoCompleteDialog: jest.fn().mockResolvedValue(undefined),
        ensureAddressDialog: jest.fn().mockResolvedValue(undefined),
        ensureVoidDialog: jest.fn().mockResolvedValue(undefined),
        ensurePriceBreakdownDialog: jest.fn().mockResolvedValue(undefined),
        ensureSimplePriceEditDialog: jest.fn().mockResolvedValue(undefined),
        ensureParcelDimensionsDialog: jest.fn().mockResolvedValue(undefined),
        ensureSendPodDialog: jest.fn().mockResolvedValue(undefined),
        ensureJobFileUploadDialog: jest.fn().mockResolvedValue(undefined),
    }),
}));

// Mock dateUtils — formatDateForApi returns a predictable string
jest.mock('../../../../utils/dateUtils', () => ({
    formatDateForApi: jest.fn((_date: unknown, _tz?: string) => '2026-03-23T11:45:00+13:00'),
}));

// Mock pricingBreakdownApi
jest.mock('../../../../services/pricingBreakdownApi', () => ({
    getPriceBreakdowns: jest.fn().mockResolvedValue([]),
}));

// Mock jobDetailApi so dynamic imports inside editDateAndTime resolve
jest.mock('../../../../services/jobDetailApi', () => ({
    getSpeedList: jest.fn(),
    getVehicleSizes: jest.fn(),
    getLeaveList: jest.fn(),
    getContactList: jest.fn(),
    getStatusList: jest.fn(),
    getActiveStaff: jest.fn(),
    getUndeliverableList: jest.fn(),
    getInternalStatusList: jest.fn(),
    autocompleteSearch: jest.fn(),
    getPodReportUrl: jest.fn(),
    getPodSpreadsheetUrl: jest.fn(),
    updateJobDetail: jest.fn().mockResolvedValue(undefined),
    updateBulkJobDetail: jest.fn().mockResolvedValue(undefined),
}));

// ── Helpers ──────────────────────────────────────────────────────────

function createMockJob(overrides?: Record<string, unknown>) {
    return {
        id: 1001,
        jobNo: 'J-1001',
        done: false,
        completedTime: null as any,
        _completedTimeLongStr: undefined as string | undefined,
        podName: '',
        preBook: false,
        isBulkJob: false,
        deliveryTimeZone: {id: 1, text: 'Pacific/Auckland'},
        ...overrides,
    } as any;
}

interface SetupOptions {
    job?: ReturnType<typeof createMockJob>;
}

function setup(opts: SetupOptions = {}) {
    const mockShowToast = jest.fn();
    const mockUpdateField = jest.fn().mockResolvedValue(undefined);
    const mockUpdateAddress = jest.fn().mockResolvedValue(undefined);
    const mockUpdatePod = jest.fn().mockResolvedValue(undefined);
    const mockDispatchJob = jest.fn().mockResolvedValue(undefined);
    const mockRefreshAndNotify = jest.fn().mockResolvedValue(undefined);
    const mockInvalidateJobLists = jest.fn().mockResolvedValue([]);
    const mockInvalidatePhotos = jest.fn().mockResolvedValue(undefined);

    const {result} = renderHook(() =>
        useJobActions({
            job: opts.job ?? createMockJob(),
            isRecurringJob: false,
            isUsCustomer: false,
            showToast: mockShowToast,
            updateField: mockUpdateField,
            updateAddress: mockUpdateAddress,
            updatePod: mockUpdatePod,
            dispatchJob: mockDispatchJob,
            refreshAndNotify: mockRefreshAndNotify,
            invalidateJobLists: mockInvalidateJobLists,
            invalidatePhotos: mockInvalidatePhotos,
            checkForRateChange: jest.fn().mockResolvedValue(undefined),
            invalidateAllJobDetails: jest.fn().mockResolvedValue(undefined),
            relatedJobs: [],
        }),
    );

    return {
        result,
        mockShowToast,
        mockUpdateField,
        mockUpdatePod,
        mockRefreshAndNotify,
        mockInvalidateJobLists,
        mockInvalidatePhotos,
    };
}

// ── Date/Time Dialog Mock ────────────────────────────────────────────

function mockDateTimeDialog(returnValue: {value: unknown; fieldName: string; timezone: string} | null) {
    (window as any).ReactEditDateTimeDialog = {
        showEditDateAndTimeDialog: jest.fn().mockResolvedValue(returnValue),
    };
}

function clearWindowDialogs() {
    delete (window as any).ReactEditDateTimeDialog;
    delete (window as any).ReactJobFileUploadDialog;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('useJobActions — markJobAsDone / handleDoneClick', () => {
    afterEach(() => {
        clearWindowDialogs();
        jest.restoreAllMocks();
    });

    describe('handleDoneClick — uncompleting a job', () => {
        it('toggles done off when job is already completed', async () => {
            const job = createMockJob({done: true, completedTime: dayjs(), podName: 'Bob'});
            const {result, mockUpdateField, mockRefreshAndNotify, mockUpdatePod} = setup({job});

            await act(() => result.current.handleDoneClick());

            expect(mockUpdateField).toHaveBeenCalledWith(
                expect.objectContaining({field: JobProperty.Delivered, value: false}),
            );
            expect(mockRefreshAndNotify).toHaveBeenCalled();
            expect(mockUpdatePod).not.toHaveBeenCalled();
        });
    });

    describe('handleDoneClick — completing (guided flow)', () => {
        it('completes immediately when both POD time and name exist', async () => {
            const job = createMockJob({
                completedTime: dayjs('2026-03-23T11:45:00'),
                _completedTimeLongStr: '2026-03-23T11:45:00+13:00',
                podName: 'Bob Smith',
            });
            const {result, mockUpdatePod, mockShowToast, mockRefreshAndNotify} = setup({job});

            await act(() => result.current.handleDoneClick());

            expect(mockUpdatePod).toHaveBeenCalledWith({
                jobId: 1001,
                jobStatus: '6',
                podName: 'Bob Smith',
                podTime: '2026-03-23T11:45:00+13:00',
            });
            expect(mockShowToast).toHaveBeenCalledWith('J-1001 Completed', 'success');
            expect(mockRefreshAndNotify).toHaveBeenCalled();
        });

        it('prompts for POD time when missing, then completes after user provides it', async () => {
            const dialogValue = dayjs('2026-03-23T11:45:00');
            mockDateTimeDialog({
                value: dialogValue,
                fieldName: JobProperty.CompletedTime,
                timezone: 'Pacific/Auckland',
            });

            const job = createMockJob({completedTime: null, podName: 'Bob Smith'});
            const {result, mockUpdateField, mockUpdatePod, mockRefreshAndNotify} = setup({job});

            await act(() => result.current.handleDoneClick());

            // Should have saved the completed time
            expect(mockUpdateField).toHaveBeenCalledWith(
                expect.objectContaining({
                    field: JobProperty.CompletedTime,
                    value: dialogValue,
                }),
            );
            // Should have called updatePod to complete the job
            expect(mockUpdatePod).toHaveBeenCalledWith(
                expect.objectContaining({
                    jobId: 1001,
                    jobStatus: '6',
                    podName: 'Bob Smith',
                }),
            );
            expect(mockRefreshAndNotify).toHaveBeenCalled();
        });

        it('stops and shows warning when user cancels POD time dialog', async () => {
            mockDateTimeDialog(null);

            const job = createMockJob({completedTime: null, podName: 'Bob Smith'});
            const {result, mockShowToast, mockUpdatePod} = setup({job});

            await act(() => result.current.handleDoneClick());

            expect(mockShowToast).toHaveBeenCalledWith(
                'A POD time needs to be provided to close this job.',
                'warning',
            );
            expect(mockUpdatePod).not.toHaveBeenCalled();
        });

        it('prompts for POD name when missing (via text dialog), then completes after submit', async () => {
            const job = createMockJob({
                completedTime: dayjs('2026-03-23T11:45:00'),
                _completedTimeLongStr: '2026-03-23T11:45:00+13:00',
                podName: '',
            });
            const {result, mockUpdateField, mockUpdatePod, mockShowToast} = setup({job});

            // Start the done click — it will open the text dialog and await
            let donePromise: Promise<void>;
            await act(async () => {
                donePromise = result.current.handleDoneClick();
                await Promise.resolve();
            });

            // The text dialog should now be open
            expect(result.current.textDialog.open).toBe(true);
            expect(result.current.textDialog.title).toBe('POD Name');
            expect(result.current.textDialog.okLabel).toBe('Complete Job');

            // Simulate user submitting the text dialog
            await act(() => result.current.handleTextDialogSubmit('Jane Doe'));
            await act(() => donePromise!);

            // Should have saved the POD name
            expect(mockUpdateField).toHaveBeenCalledWith(
                expect.objectContaining({
                    field: JobProperty.PodName,
                    value: 'Jane Doe',
                }),
            );
            // Should have called updatePod to complete the job
            expect(mockUpdatePod).toHaveBeenCalledWith(
                expect.objectContaining({
                    jobId: 1001,
                    jobStatus: '6',
                    podName: 'Jane Doe',
                }),
            );
            expect(mockShowToast).toHaveBeenCalledWith('J-1001 Completed', 'success');
        });

        it('stops and shows warning when user cancels POD name dialog', async () => {
            const job = createMockJob({
                completedTime: dayjs('2026-03-23T11:45:00'),
                _completedTimeLongStr: '2026-03-23T11:45:00+13:00',
                podName: '',
            });
            const {result, mockShowToast, mockUpdatePod} = setup({job});

            let donePromise: Promise<void>;
            await act(async () => {
                donePromise = result.current.handleDoneClick();
                await Promise.resolve();
            });

            // Cancel the text dialog
            act(() => result.current.handleTextDialogCancel());
            await act(() => donePromise!);

            expect(mockShowToast).toHaveBeenCalledWith(
                'A POD name needs to be provided to close this job.',
                'warning',
            );
            expect(mockUpdatePod).not.toHaveBeenCalled();
        });

        it('prompts for both POD time and name when both are missing', async () => {
            const dialogValue = dayjs('2026-03-23T11:45:00');
            mockDateTimeDialog({
                value: dialogValue,
                fieldName: JobProperty.CompletedTime,
                timezone: 'Pacific/Auckland',
            });

            const job = createMockJob({completedTime: null, podName: ''});
            const {result, mockUpdateField, mockUpdatePod} = setup({job});

            // Start the flow — first the date dialog resolves, then the text dialog opens
            let donePromise: Promise<void>;
            await act(async () => {
                donePromise = result.current.handleDoneClick();
                // Flush microtasks: date dialog resolves, then openTextDialogAsync calls setTextDialog
                for (let i = 0; i < 10; i++) await Promise.resolve();
            });

            // Date dialog resolved. POD time should have been saved.
            expect(mockUpdateField).toHaveBeenCalledWith(
                expect.objectContaining({field: JobProperty.CompletedTime}),
            );

            // Text dialog should now be open for POD name
            expect(result.current.textDialog.open).toBe(true);
            expect(result.current.textDialog.title).toBe('POD Name');

            // Submit POD name
            await act(() => result.current.handleTextDialogSubmit('Alice'));
            await act(() => donePromise!);

            expect(mockUpdateField).toHaveBeenCalledWith(
                expect.objectContaining({field: JobProperty.PodName, value: 'Alice'}),
            );
            expect(mockUpdatePod).toHaveBeenCalledWith(
                expect.objectContaining({
                    jobId: 1001,
                    jobStatus: '6',
                    podName: 'Alice',
                }),
            );
        });

        it('does nothing when job is undefined', async () => {
            const mockShowToast = jest.fn();
            const mockUpdatePod = jest.fn();
            const {result} = renderHook(() =>
                useJobActions({
                    job: undefined,
                    isRecurringJob: false,
                    isUsCustomer: false,
                    showToast: mockShowToast,
                    updateField: jest.fn().mockResolvedValue(undefined),
                    updateAddress: jest.fn().mockResolvedValue(undefined),
                    updatePod: mockUpdatePod,
                    dispatchJob: jest.fn().mockResolvedValue(undefined),
                    refreshAndNotify: jest.fn().mockResolvedValue(undefined),
                    invalidateJobLists: jest.fn().mockResolvedValue([]),
                    invalidatePhotos: jest.fn().mockResolvedValue(undefined),
                    checkForRateChange: jest.fn().mockResolvedValue(undefined),
                    invalidateAllJobDetails: jest.fn().mockResolvedValue(undefined),
                    relatedJobs: [],
                }),
            );

            await act(() => result.current.handleDoneClick());

            expect(mockUpdatePod).not.toHaveBeenCalled();
            expect(mockShowToast).not.toHaveBeenCalled();
        });
    });

    describe('handleEditCompletedTime — chaining into completion flow', () => {
        it('chains into markJobAsDone when job is not yet done', async () => {
            const job = createMockJob({
                completedTime: null,
                podName: 'Bob',
            });
            const dialogValue = dayjs('2026-03-23T11:45:00');
            mockDateTimeDialog({
                value: dialogValue,
                fieldName: JobProperty.CompletedTime,
                timezone: 'Pacific/Auckland',
            });

            const {result, mockUpdatePod} = setup({job});

            await act(() => result.current.handleEditCompletedTime());

            // Should have completed the job (POD name was already set)
            expect(mockUpdatePod).toHaveBeenCalledWith(
                expect.objectContaining({jobStatus: '6', podName: 'Bob'}),
            );
        });

        it('edits time without chaining when job is already done', async () => {
            const job = createMockJob({
                done: true,
                completedTime: dayjs('2026-03-23T11:45:00'),
                podName: 'Bob',
            });
            mockDateTimeDialog({
                value: dayjs('2026-03-23T12:00:00'),
                fieldName: JobProperty.CompletedTime,
                timezone: 'Pacific/Auckland',
            });

            const {result, mockUpdatePod, mockShowToast} = setup({job});

            await act(() => result.current.handleEditCompletedTime());

            // Should NOT have called updatePod (no completion flow)
            expect(mockUpdatePod).not.toHaveBeenCalled();
            // Should show "updated" toast from editDateAndTime, not "Completed"
            expect(mockShowToast).toHaveBeenCalledWith('J-1001 updated', 'success');
        });
    });

    describe('handleEditPodName — chaining into completion flow', () => {
        it('chains into markJobAsDone when job is not yet done', async () => {
            const job = createMockJob({
                completedTime: dayjs('2026-03-23T11:45:00'),
                _completedTimeLongStr: '2026-03-23T11:45:00+13:00',
                podName: '',
            });
            const {result, mockUpdatePod} = setup({job});

            // Start edit — should open text dialog via markJobAsDone
            let editPromise: Promise<void>;
            await act(async () => {
                editPromise = result.current.handleEditPodName();
                await Promise.resolve();
            });

            // Text dialog opens as part of the guided flow
            expect(result.current.textDialog.open).toBe(true);
            expect(result.current.textDialog.okLabel).toBe('Complete Job');

            await act(() => result.current.handleTextDialogSubmit('Charlie'));
            await act(() => editPromise!);

            expect(mockUpdatePod).toHaveBeenCalledWith(
                expect.objectContaining({jobStatus: '6', podName: 'Charlie'}),
            );
        });

        it('edits name without chaining when job is already done', async () => {
            const job = createMockJob({
                done: true,
                completedTime: dayjs('2026-03-23T11:45:00'),
                podName: 'Bob',
            });
            const {result, mockUpdatePod} = setup({job});

            act(() => {
                result.current.handleEditPodName();
            });

            // Should open text dialog for simple editing (no "Complete Job" button)
            expect(result.current.textDialog.open).toBe(true);
            expect(result.current.textDialog.title).toBe('Edit POD Name');
            expect(result.current.textDialog.okLabel).toBeUndefined();
            expect(mockUpdatePod).not.toHaveBeenCalled();
        });
    });

    describe('openTextDialogAsync / text dialog promise integration', () => {
        it('resolves with submitted value in async mode', async () => {
            const job = createMockJob({
                completedTime: dayjs('2026-03-23T11:45:00'),
                _completedTimeLongStr: '2026-03-23T11:45:00+13:00',
                podName: '',
            });
            const {result, mockUpdateField} = setup({job});

            let donePromise: Promise<void>;
            await act(async () => {
                donePromise = result.current.handleDoneClick();
                await Promise.resolve();
            });

            // Submit via text dialog
            await act(() => result.current.handleTextDialogSubmit('Async Name'));
            await act(() => donePromise!);

            // In async mode, the caller (markJobAsDone) saves the field, not handleTextDialogSubmit
            expect(mockUpdateField).toHaveBeenCalledWith(
                expect.objectContaining({field: JobProperty.PodName, value: 'Async Name'}),
            );
        });

        it('resolves with null on cancel in async mode', async () => {
            const job = createMockJob({
                completedTime: dayjs('2026-03-23T11:45:00'),
                _completedTimeLongStr: '2026-03-23T11:45:00+13:00',
                podName: '',
            });
            const {result, mockUpdatePod} = setup({job});

            let donePromise!: Promise<void>;
            await act(async () => {
                donePromise = result.current.handleDoneClick();
                await Promise.resolve();
            });

            act(() => result.current.handleTextDialogCancel());
            await act(() => donePromise!);

            expect(mockUpdatePod).not.toHaveBeenCalled();
        });

        it('still works in state-based (non-async) mode for other text dialogs', async () => {
            const job = createMockJob({
                done: true,
                completedTime: dayjs(),
                podName: 'Bob',
            });
            const {result, mockUpdateField, mockRefreshAndNotify} = setup({job});

            // Open a regular text dialog (e.g., Edit RefA)
            act(() => {
                result.current.handleEditRefA();
            });

            expect(result.current.textDialog.open).toBe(true);

            // Submit it — should use state-based flow (save directly)
            await act(() => result.current.handleTextDialogSubmit('NEW-REF'));

            expect(mockUpdateField).toHaveBeenCalledWith(
                expect.objectContaining({field: JobProperty.RefA, value: 'NEW-REF'}),
            );
            expect(mockRefreshAndNotify).toHaveBeenCalled();
        });
    });

    describe('file upload step (step 3)', () => {
        it('attempts to open file upload dialog when available', async () => {
            const openMock = jest.fn().mockResolvedValue(undefined);
            (window as any).ReactJobFileUploadDialog = {open: openMock};

            const job = createMockJob({
                completedTime: dayjs('2026-03-23T11:45:00'),
                _completedTimeLongStr: '2026-03-23T11:45:00+13:00',
                podName: 'Bob',
            });
            const {result} = setup({job});

            await act(() => result.current.handleDoneClick());

            expect(openMock).toHaveBeenCalledWith(1001, 'POD');
        });

        it('completes the job even when file upload dialog is not available', async () => {
            // No ReactJobFileUploadDialog on window
            const job = createMockJob({
                completedTime: dayjs('2026-03-23T11:45:00'),
                _completedTimeLongStr: '2026-03-23T11:45:00+13:00',
                podName: 'Bob',
            });
            const {result, mockUpdatePod} = setup({job});

            await act(() => result.current.handleDoneClick());

            expect(mockUpdatePod).toHaveBeenCalledWith(
                expect.objectContaining({jobStatus: '6'}),
            );
        });
    });
});

// ── Void Job Tests ──────────────────────────────────────────────────

describe('useJobActions — handleVoidClick', () => {
    afterEach(() => {
        delete (window as any).ReactVoidJobConfirmationDialog;
        jest.restoreAllMocks();
    });

    it('calls refreshAndNotify and invalidateJobLists after successful void', async () => {
        (window as any).ReactVoidJobConfirmationDialog = {
            open: jest.fn().mockResolvedValue({success: true, voidedCount: 1}),
        };

        const {result, mockRefreshAndNotify, mockInvalidateJobLists} = setup({
            job: createMockJob({void: false}),
        });

        await act(async () => {
            await result.current.handleVoidClick();
        });

        expect((window as any).ReactVoidJobConfirmationDialog.open).toHaveBeenCalledWith({
            id: 1001,
            jobNo: 'J-1001',
            isBulkJob: false,
            isArchived: undefined,
        });
        expect(mockRefreshAndNotify).toHaveBeenCalled();
        expect(mockInvalidateJobLists).toHaveBeenCalled();
    });

    it('does not refresh or invalidate when void dialog is cancelled', async () => {
        (window as any).ReactVoidJobConfirmationDialog = {
            open: jest.fn().mockResolvedValue(null),
        };

        const {result, mockRefreshAndNotify, mockInvalidateJobLists} = setup({
            job: createMockJob({void: false}),
        });

        await act(async () => {
            await result.current.handleVoidClick();
        });

        expect(mockRefreshAndNotify).not.toHaveBeenCalled();
        expect(mockInvalidateJobLists).not.toHaveBeenCalled();
    });

    it('un-voids via updateField when job is already voided', async () => {
        const {result, mockUpdateField, mockRefreshAndNotify} = setup({
            job: createMockJob({void: true, preBook: false}),
        });

        await act(async () => {
            await result.current.handleVoidClick();
        });

        expect(mockUpdateField).toHaveBeenCalledWith(
            expect.objectContaining({field: 'Void', value: false}),
        );
        expect(mockRefreshAndNotify).toHaveBeenCalled();
    });

    it('does nothing when job is undefined', async () => {
        (window as any).ReactVoidJobConfirmationDialog = {
            open: jest.fn(),
        };

        const mockRefreshAndNotify = jest.fn().mockResolvedValue(undefined);
        const mockInvalidateJobLists = jest.fn().mockResolvedValue([]);
        const {result} = renderHook(() =>
            useJobActions({
                job: undefined,
                isRecurringJob: false,
                isUsCustomer: false,
                showToast: jest.fn(),
                updateField: jest.fn().mockResolvedValue(undefined),
                updateAddress: jest.fn().mockResolvedValue(undefined),
                updatePod: jest.fn().mockResolvedValue(undefined),
                dispatchJob: jest.fn().mockResolvedValue(undefined),
                refreshAndNotify: mockRefreshAndNotify,
                invalidateJobLists: mockInvalidateJobLists,
                invalidatePhotos: jest.fn().mockResolvedValue(undefined),
                checkForRateChange: jest.fn().mockResolvedValue(undefined),
                invalidateAllJobDetails: jest.fn().mockResolvedValue(undefined),
                relatedJobs: [],
            }),
        );

        await act(async () => {
            await result.current.handleVoidClick();
        });

        expect((window as any).ReactVoidJobConfirmationDialog.open).not.toHaveBeenCalled();
        expect(mockRefreshAndNotify).not.toHaveBeenCalled();
        expect(mockInvalidateJobLists).not.toHaveBeenCalled();
    });
});

describe('useJobActions — handlePricingClick on a partner job', () => {
    it('captures the new rate via the main edit dialog, then opens the change-request dialog with the field + value locked', async () => {
        const mockShowToast = jest.fn();
        const mockOnRequestPartnerChange = jest.fn();
        const job = createMockJob({isPartnerJob: true, isInvoiced: false, isArchived: false});

        const {result} = renderHook(() =>
            useJobActions({
                job,
                isRecurringJob: false,
                isUsCustomer: false,
                showToast: mockShowToast,
                updateField: jest.fn().mockResolvedValue(undefined),
                updateAddress: jest.fn().mockResolvedValue(undefined),
                updatePod: jest.fn().mockResolvedValue(undefined),
                dispatchJob: jest.fn().mockResolvedValue(undefined),
                refreshAndNotify: jest.fn().mockResolvedValue(undefined),
                invalidateJobLists: jest.fn().mockResolvedValue([]),
                invalidatePhotos: jest.fn().mockResolvedValue(undefined),
                checkForRateChange: jest.fn().mockResolvedValue(undefined),
                invalidateAllJobDetails: jest.fn().mockResolvedValue(undefined),
                relatedJobs: [],
                onRequestPartnerChange: mockOnRequestPartnerChange,
            }),
        );

        // Step 1 — clicking Pricing opens the main edit dialog to capture a new rate.
        let pendingPricingClick: Promise<void> | undefined;
        await act(async () => {
            pendingPricingClick = result.current.handlePricingClick();
        });
        expect(result.current.textDialog.open).toBe(true);
        expect(result.current.textDialog.field).toBe('PartnerAgreedRate');
        // Change-request dialog must not have been opened yet — we still need a value.
        expect(mockOnRequestPartnerChange).not.toHaveBeenCalled();

        // Step 2 — submitting the rate forwards to the change-request dialog with
        // the field + value LOCKED so the user only fills in the reason.
        await act(async () => {
            await result.current.handleTextDialogSubmit('185.50');
            await pendingPricingClick;
        });

        expect(mockOnRequestPartnerChange).toHaveBeenCalledWith('PartnerAgreedRate', '185.50', true);
        // Legacy "managed by partner" toast must NOT fire — the dialog is the new path.
        expect(mockShowToast).not.toHaveBeenCalled();
    });

    it('aborts cleanly when the dispatcher cancels the rate dialog', async () => {
        const mockShowToast = jest.fn();
        const mockOnRequestPartnerChange = jest.fn();
        const job = createMockJob({isPartnerJob: true, isInvoiced: false, isArchived: false});

        const {result} = renderHook(() =>
            useJobActions({
                job,
                isRecurringJob: false,
                isUsCustomer: false,
                showToast: mockShowToast,
                updateField: jest.fn().mockResolvedValue(undefined),
                updateAddress: jest.fn().mockResolvedValue(undefined),
                updatePod: jest.fn().mockResolvedValue(undefined),
                dispatchJob: jest.fn().mockResolvedValue(undefined),
                refreshAndNotify: jest.fn().mockResolvedValue(undefined),
                invalidateJobLists: jest.fn().mockResolvedValue([]),
                invalidatePhotos: jest.fn().mockResolvedValue(undefined),
                checkForRateChange: jest.fn().mockResolvedValue(undefined),
                invalidateAllJobDetails: jest.fn().mockResolvedValue(undefined),
                relatedJobs: [],
                onRequestPartnerChange: mockOnRequestPartnerChange,
            }),
        );

        let pendingPricingClick: Promise<void> | undefined;
        await act(async () => {
            pendingPricingClick = result.current.handlePricingClick();
        });
        await act(async () => {
            result.current.handleTextDialogCancel();
            await pendingPricingClick;
        });

        expect(mockOnRequestPartnerChange).not.toHaveBeenCalled();
        expect(mockShowToast).not.toHaveBeenCalled();
    });

    it('falls back to the legacy toast when onRequestPartnerChange is not supplied', async () => {
        const mockShowToast = jest.fn();
        const job = createMockJob({isPartnerJob: true, isInvoiced: false, isArchived: false});

        const {result} = renderHook(() =>
            useJobActions({
                job,
                isRecurringJob: false,
                isUsCustomer: false,
                showToast: mockShowToast,
                updateField: jest.fn().mockResolvedValue(undefined),
                updateAddress: jest.fn().mockResolvedValue(undefined),
                updatePod: jest.fn().mockResolvedValue(undefined),
                dispatchJob: jest.fn().mockResolvedValue(undefined),
                refreshAndNotify: jest.fn().mockResolvedValue(undefined),
                invalidateJobLists: jest.fn().mockResolvedValue([]),
                invalidatePhotos: jest.fn().mockResolvedValue(undefined),
                checkForRateChange: jest.fn().mockResolvedValue(undefined),
                invalidateAllJobDetails: jest.fn().mockResolvedValue(undefined),
                relatedJobs: [],
            }),
        );

        await act(async () => {
            await result.current.handlePricingClick();
        });

        expect(mockShowToast).toHaveBeenCalledWith(
            expect.stringMatching(/managed by a partner/),
            'info',
        );
    });
});

describe('useJobActions — partner-job gating (no local save)', () => {
    /** Spin up a hook with onRequestPartnerChange wired in. */
    function setupPartnerHook(job: ReturnType<typeof createMockJob>) {
        const mockShowToast = jest.fn();
        const mockUpdateField = jest.fn().mockResolvedValue(undefined);
        const mockUpdateAddress = jest.fn().mockResolvedValue(undefined);
        const mockRefreshAndNotify = jest.fn().mockResolvedValue(undefined);
        const mockOnRequestPartnerChange = jest.fn();

        const {result} = renderHook(() =>
            useJobActions({
                job,
                isRecurringJob: false,
                isUsCustomer: false,
                showToast: mockShowToast,
                updateField: mockUpdateField,
                updateAddress: mockUpdateAddress,
                updatePod: jest.fn().mockResolvedValue(undefined),
                dispatchJob: jest.fn().mockResolvedValue(undefined),
                refreshAndNotify: mockRefreshAndNotify,
                invalidateJobLists: jest.fn().mockResolvedValue([]),
                invalidatePhotos: jest.fn().mockResolvedValue(undefined),
                checkForRateChange: jest.fn().mockResolvedValue(undefined),
                invalidateAllJobDetails: jest.fn().mockResolvedValue(undefined),
                relatedJobs: [],
                onRequestPartnerChange: mockOnRequestPartnerChange,
            }),
        );

        return {result, mockShowToast, mockUpdateField, mockUpdateAddress, mockRefreshAndNotify, mockOnRequestPartnerChange};
    }

    afterEach(() => {
        delete (window as any).ReactEditDateTimeDialog;
        delete (window as any).ReactEditAddressDialog;
        delete (window as any).ReactSelectDialog;
        jest.restoreAllMocks();
    });

    it('handleSpeedClick on a partner job routes to change-request locked and skips updateField', async () => {
        const {getSpeedList} = require('../../../../services/jobDetailApi');
        (getSpeedList as jest.Mock).mockResolvedValue([
            {id: 1, text: 'Standard'},
            {id: 2, text: 'Express'},
        ]);
        (window as any).ReactSelectDialog = {
            showSelectDialog: jest.fn().mockResolvedValue({value: 2, text: 'Express', fieldName: JobProperty.SpeedID}),
        };

        const job = createMockJob({isPartnerJob: true, speedName: 'Standard'});
        const {result, mockUpdateField, mockOnRequestPartnerChange, mockRefreshAndNotify} = setupPartnerHook(job);

        await act(async () => {
            await result.current.handleSpeedClick();
        });

        expect(mockOnRequestPartnerChange).toHaveBeenCalledWith('Speed', '2', true);
        expect(mockUpdateField).not.toHaveBeenCalled();
        expect(mockRefreshAndNotify).not.toHaveBeenCalled();
    });

    it('handleSpeedClick on a non-partner job still saves via updateField', async () => {
        const {getSpeedList} = require('../../../../services/jobDetailApi');
        (getSpeedList as jest.Mock).mockResolvedValue([
            {id: 1, text: 'Standard'},
            {id: 2, text: 'Express'},
        ]);
        (window as any).ReactSelectDialog = {
            showSelectDialog: jest.fn().mockResolvedValue({value: 2, text: 'Express', fieldName: JobProperty.SpeedID}),
        };

        const job = createMockJob({isPartnerJob: false, speedName: 'Standard'});
        const {result, mockUpdateField, mockOnRequestPartnerChange} = setupPartnerHook(job);

        await act(async () => {
            await result.current.handleSpeedClick();
        });

        expect(mockUpdateField).toHaveBeenCalledWith(
            expect.objectContaining({field: JobProperty.SpeedID, value: 2}),
        );
        expect(mockOnRequestPartnerChange).not.toHaveBeenCalled();
    });

    it('handleContactClick (Booked By dropdown) saves the picked contact name, not its id', async () => {
        const {getContactList} = require('../../../../services/jobDetailApi');
        (getContactList as jest.Mock).mockResolvedValue([
            {id: 12, text: 'Jane Admin'},
            {id: 34, text: 'Sam Booker'},
        ]);
        (window as any).ReactSelectDialog = {
            showSelectDialog: jest.fn().mockResolvedValue({
                value: 34,
                text: 'Sam Booker',
                fieldName: JobProperty.FromContactName,
            }),
        };

        const job = createMockJob({isPartnerJob: false, clientId: 99, fromContactName: 'Jane Admin'});
        const {result, mockUpdateField, mockOnRequestPartnerChange} = setupPartnerHook(job);

        await act(async () => {
            await result.current.handleContactClick();
        });

        expect(mockUpdateField).toHaveBeenCalledWith(
            expect.objectContaining({field: JobProperty.FromContactName, value: 'Sam Booker'}),
        );
        expect(mockOnRequestPartnerChange).not.toHaveBeenCalled();
    });

    it('handleContactClick on a partner job forwards the contact name to change-request locked', async () => {
        const {getContactList} = require('../../../../services/jobDetailApi');
        (getContactList as jest.Mock).mockResolvedValue([
            {id: 12, text: 'Jane Admin'},
            {id: 34, text: 'Sam Booker'},
        ]);
        (window as any).ReactSelectDialog = {
            showSelectDialog: jest.fn().mockResolvedValue({
                value: 34,
                text: 'Sam Booker',
                fieldName: JobProperty.FromContactName,
            }),
        };

        const job = createMockJob({isPartnerJob: true, clientId: 99, fromContactName: 'Jane Admin'});
        const {result, mockUpdateField, mockOnRequestPartnerChange} = setupPartnerHook(job);

        await act(async () => {
            await result.current.handleContactClick();
        });

        expect(mockOnRequestPartnerChange).toHaveBeenCalledWith('FromContactName', 'Sam Booker', true);
        expect(mockUpdateField).not.toHaveBeenCalled();
    });

    it('handleContactClick on a recurring job saves the contact name (not id) and routes to UpdateRecurringJob', async () => {
        const {getContactList} = require('../../../../services/jobDetailApi');
        (getContactList as jest.Mock).mockResolvedValue([
            {id: 12, text: 'Jane Admin'},
            {id: 34, text: 'Sam Booker'},
        ]);
        (window as any).ReactSelectDialog = {
            showSelectDialog: jest.fn().mockResolvedValue({
                value: 34,
                text: 'Sam Booker',
                fieldName: JobProperty.FromContactName,
            }),
        };

        const job = createMockJob({
            isPartnerJob: false,
            clientId: 99,
            fromContactName: 'Jane Admin',
            preBook: true,
        });
        const {result, mockUpdateField, mockOnRequestPartnerChange} = setupPartnerHook(job);

        await act(async () => {
            await result.current.handleContactClick();
        });

        expect(mockUpdateField).toHaveBeenCalledWith(
            expect.objectContaining({
                field: JobProperty.FromContactName,
                value: 'Sam Booker',
                isRecurring: true,
            }),
        );
        expect(mockOnRequestPartnerChange).not.toHaveBeenCalled();
    });

    it('handleEditFromContact on a partner job routes the submitted text to change-request locked', async () => {
        const job = createMockJob({isPartnerJob: true, fromContactName: 'Alice'});
        const {result, mockUpdateField, mockOnRequestPartnerChange} = setupPartnerHook(job);

        await act(async () => {
            result.current.handleEditFromContact();
        });
        expect(result.current.textDialog.open).toBe(true);
        expect(result.current.textDialog.field).toBe(JobProperty.FromContactName);

        await act(async () => {
            await result.current.handleTextDialogSubmit('Alice Updated');
        });

        expect(mockOnRequestPartnerChange).toHaveBeenCalledWith('FromContactName', 'Alice Updated', true);
        expect(mockUpdateField).not.toHaveBeenCalled();
    });

    it('handleEditFromContact on a non-partner job still saves via updateField', async () => {
        const job = createMockJob({isPartnerJob: false, fromContactName: 'Alice'});
        const {result, mockUpdateField, mockOnRequestPartnerChange} = setupPartnerHook(job);

        await act(async () => {
            result.current.handleEditFromContact();
        });
        await act(async () => {
            await result.current.handleTextDialogSubmit('Alice Updated');
        });

        expect(mockUpdateField).toHaveBeenCalledWith(
            expect.objectContaining({field: JobProperty.FromContactName, value: 'Alice Updated'}),
        );
        expect(mockOnRequestPartnerChange).not.toHaveBeenCalled();
    });

    it('handleEditPickupAddress on a partner job routes a JSON-encoded address and skips updateAddress', async () => {
        const pickedAddress = {
            addressLine1: '99 Lambton Quay',
            addressLine2: '',
            addressLine3: 'Te Aro',
            addressLine4: 'Wellington',
            addressLine5: '',
            addressLine6: '6011',
            addressLine7: 'New Zealand',
            addressLine8: '',
            fullAddress: '99 Lambton Quay, Te Aro, Wellington 6011',
        };
        (window as any).ReactEditAddressDialog = {
            open: jest.fn().mockResolvedValue(pickedAddress),
        };

        const job = createMockJob({isPartnerJob: true, pickupAddress: {}, deliveryAddress: {}});
        const {result, mockUpdateAddress, mockOnRequestPartnerChange} = setupPartnerHook(job);

        await act(async () => {
            await result.current.handleEditPickupAddress();
        });

        expect(mockUpdateAddress).not.toHaveBeenCalled();
        expect(mockOnRequestPartnerChange).toHaveBeenCalledWith(
            'PickupAddress',
            expect.any(String),
            true,
        );
        const payload = JSON.parse(mockOnRequestPartnerChange.mock.calls[0][1]);
        expect(payload.addressLine1).toBe('99 Lambton Quay');
        expect(payload.addressLine4).toBe('Wellington');
        expect(payload.fullAddress).toBe('99 Lambton Quay, Te Aro, Wellington 6011');
    });

    it('handleEditDeliveryAddress on a partner job uses the DeliveryAddress field name', async () => {
        (window as any).ReactEditAddressDialog = {
            open: jest.fn().mockResolvedValue({
                addressLine1: '1 Quay St',
                addressLine2: '', addressLine3: '', addressLine4: 'Auckland',
                addressLine5: '', addressLine6: '', addressLine7: '', addressLine8: '',
                fullAddress: '1 Quay St, Auckland',
            }),
        };

        const job = createMockJob({isPartnerJob: true, pickupAddress: {}, deliveryAddress: {}});
        const {result, mockOnRequestPartnerChange} = setupPartnerHook(job);

        await act(async () => {
            await result.current.handleEditDeliveryAddress();
        });

        expect(mockOnRequestPartnerChange).toHaveBeenCalledWith(
            'DeliveryAddress',
            expect.any(String),
            true,
        );
    });

    it('editDateAndTime on a partner job serialises the picked datetime and routes to change-request locked', async () => {
        const dialogValue = dayjs('2026-04-15T09:00:00');
        (window as any).ReactEditDateTimeDialog = {
            showEditDateAndTimeDialog: jest.fn().mockResolvedValue({
                value: dialogValue,
                fieldName: JobProperty.PuTime,
                timezone: 'Pacific/Auckland',
            }),
        };

        const job = createMockJob({isPartnerJob: true});
        const {result, mockUpdateField, mockOnRequestPartnerChange} = setupPartnerHook(job);

        await act(async () => {
            await result.current.editDateAndTime(JobProperty.PuTime, 'Pickup Time');
        });

        expect(mockUpdateField).not.toHaveBeenCalled();
        // formatDateForApi is mocked at the top of this file to return a canned
        // offset-aware ISO string — the point of the test is that the handler
        // calls it (not bypasses it) before routing.
        expect(mockOnRequestPartnerChange).toHaveBeenCalledWith(
            'PuTime',
            '2026-03-23T11:45:00+13:00',
            true,
        );
    });

    it('editDateAndTime on a partner job for non-gated fields (e.g. CompletedTime) still saves locally', async () => {
        const dialogValue = dayjs('2026-04-15T09:00:00');
        (window as any).ReactEditDateTimeDialog = {
            showEditDateAndTimeDialog: jest.fn().mockResolvedValue({
                value: dialogValue,
                fieldName: JobProperty.CompletedTime,
                timezone: 'Pacific/Auckland',
            }),
        };
        const {updateJobDetail} = require('../../../../services/jobDetailApi');
        (updateJobDetail as jest.Mock).mockClear();

        const job = createMockJob({isPartnerJob: true});
        const {result, mockOnRequestPartnerChange} = setupPartnerHook(job);

        await act(async () => {
            await result.current.editDateAndTime(JobProperty.CompletedTime, 'POD Time');
        });

        expect(mockOnRequestPartnerChange).not.toHaveBeenCalled();
        expect(updateJobDetail).toHaveBeenCalled();
    });

    it('handleToggleProperty for Direct on a partner job routes to change-request and skips updateField', async () => {
        const job = createMockJob({isPartnerJob: true});
        const {result, mockUpdateField, mockOnRequestPartnerChange} = setupPartnerHook(job);

        await act(async () => {
            await result.current.handleToggleProperty(JobProperty.Direct, false);
        });

        expect(mockOnRequestPartnerChange).toHaveBeenCalledWith('Direct', 'true', true);
        expect(mockUpdateField).not.toHaveBeenCalled();
    });

    it('handleToggleProperty for a non-gated toggle (e.g. Active) on a partner job still saves locally', async () => {
        const job = createMockJob({isPartnerJob: true});
        const {result, mockUpdateField, mockOnRequestPartnerChange} = setupPartnerHook(job);

        await act(async () => {
            await result.current.handleToggleProperty(JobProperty.Active, false);
        });

        expect(mockUpdateField).toHaveBeenCalledWith(
            expect.objectContaining({field: JobProperty.Active, value: true}),
        );
        expect(mockOnRequestPartnerChange).not.toHaveBeenCalled();
    });

    it('handleEditDimensions on a partner job opens the parcel dialog in partnerMode and forwards the captured value to onRequestPartnerChange', async () => {
        const capturedParcels = [
            {itemName: 'Box', weight: 5, length: 10, depth: 5, height: 3, dimensions: '10 × 5 × 3 cm'},
        ];
        const showDialogMock = jest.fn().mockResolvedValue({
            parcels: capturedParcels,
            totalWeight: 5,
        });
        (window as any).ReactEditParcelDimensionsDialog = {
            setToastService: jest.fn(),
            showEditParcelDimensionsDialog: showDialogMock,
        };

        const job = createMockJob({
            isPartnerJob: true,
            parcelDimensions: capturedParcels,
            weight: 5,
        });
        const {result, mockOnRequestPartnerChange, mockRefreshAndNotify} = setupPartnerHook(job);

        await act(async () => {
            await result.current.handleEditDimensions();
        });

        // Dialog must be opened in partner mode so it skips its own POST.
        expect(showDialogMock).toHaveBeenCalledWith(expect.objectContaining({
            partnerMode: true,
            jobId: job.id,
        }));

        // Captured value is JSON-serialised into the Packages payload shape.
        expect(mockOnRequestPartnerChange).toHaveBeenCalledTimes(1);
        const [field, payload, locked] = mockOnRequestPartnerChange.mock.calls[0];
        expect(field).toBe('Packages');
        expect(locked).toBe(true);
        const parsed = JSON.parse(payload);
        expect(parsed.parcels).toEqual(capturedParcels);
        expect(parsed.weight).toBe(5);

        // No local refresh — the change request lives or dies on the partner's approval.
        expect(mockRefreshAndNotify).not.toHaveBeenCalled();

        delete (window as any).ReactEditParcelDimensionsDialog;
    });

    it('handleEditDimensions on a non-partner job opens the dialog normally and refreshes after save', async () => {
        const showDialogMock = jest.fn().mockResolvedValue({
            parcels: [{itemName: 'Box', weight: 5, dimensions: '10 × 5 × 3 cm'}],
            totalWeight: 5,
        });
        (window as any).ReactEditParcelDimensionsDialog = {
            setToastService: jest.fn(),
            showEditParcelDimensionsDialog: showDialogMock,
        };

        const job = createMockJob({isPartnerJob: false, parcelDimensions: []});
        const {result, mockOnRequestPartnerChange, mockRefreshAndNotify} = setupPartnerHook(job);

        await act(async () => {
            await result.current.handleEditDimensions();
        });

        expect(showDialogMock).toHaveBeenCalledWith(expect.objectContaining({
            partnerMode: false,
            jobNumber: 'J-1001',
        }));
        expect(mockOnRequestPartnerChange).not.toHaveBeenCalled();
        expect(mockRefreshAndNotify).toHaveBeenCalled();

        delete (window as any).ReactEditParcelDimensionsDialog;
    });

    it('handleEditDimensions on a partner bulk job stays on the direct path (bulk jobs have no partner pairing)', async () => {
        const showDialogMock = jest.fn().mockResolvedValue({
            parcels: [{itemName: 'Box', weight: 5, dimensions: '10 × 5 × 3 cm'}],
            totalWeight: 5,
        });
        (window as any).ReactEditParcelDimensionsDialog = {
            setToastService: jest.fn(),
            showEditParcelDimensionsDialog: showDialogMock,
        };

        const job = createMockJob({isPartnerJob: true, isBulkJob: true, parcelDimensions: []});
        const {result, mockOnRequestPartnerChange} = setupPartnerHook(job);

        await act(async () => {
            await result.current.handleEditDimensions();
        });

        expect(showDialogMock).toHaveBeenCalledWith(expect.objectContaining({
            partnerMode: false,
            bulkJobId: job.id,
        }));
        expect(mockOnRequestPartnerChange).not.toHaveBeenCalled();

        delete (window as any).ReactEditParcelDimensionsDialog;
    });
});
