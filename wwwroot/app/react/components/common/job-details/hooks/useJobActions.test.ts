/**
 * useJobActions Hook Tests — Guided POD Collection (markJobAsDone) Flow
 */

import {renderHook, act} from '@testing-library/react';
import {useJobActions} from './useJobActions';
import {JobProperty} from '../../../../../enums/job-property.enum';
import JobRelationshipType from '../../../../../enums/job-relationship-type.enum';
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
        ensureSplitPricingBreakdownDialog: jest.fn().mockResolvedValue(undefined),
        ensureSimplePriceEditDialog: jest.fn().mockResolvedValue(undefined),
        ensureParcelDimensionsDialog: jest.fn().mockResolvedValue(undefined),
        ensureSendPodDialog: jest.fn().mockResolvedValue(undefined),
        ensureJobFileUploadDialog: jest.fn().mockResolvedValue(undefined),
    }),
}));

// Mock dateUtils — formatDateForApi returns a predictable string
jest.mock('../../../../utils/dateUtils', () => ({
    formatDateForApi: jest.fn((_date: unknown, _tz?: string) => '2026-03-23T11:45:00+13:00'),
    formatLongDate: jest.fn((_date: unknown, _isUs?: boolean) => '23 March 2026'),
}));

// Mock pricingBreakdownApi
jest.mock('../../../../services/pricingBreakdownApi', () => ({
    getPriceBreakdowns: jest.fn().mockResolvedValue([]),
}));

// Mock splitPriceBreakdownApi — defaults to null (no allocation rows yet), the "not a
// live split parent with a derivable grid" signal that falls back to the flat dialog.
jest.mock('../../../../services/splitPriceBreakdownApi', () => ({
    getSplitPricingBreakdown: jest.fn().mockResolvedValue(null),
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
    getOverlayDocumentUrl: jest.fn(),
    getJobOverlayDocuments: jest.fn().mockResolvedValue([]),
    saveRecurringFlight: jest.fn().mockResolvedValue(undefined),
    updateJobDetail: jest.fn().mockResolvedValue(undefined),
    updateBulkJobDetail: jest.fn().mockResolvedValue(undefined),
    getFamilyForDateChange: jest.fn().mockResolvedValue({relationshipTypeId: null, members: []}),
}));

jest.mock('../../../../services/toastService', () => ({
    toastService: {
        showSuccessToast: jest.fn(),
        showWarningToast: jest.fn(),
        showErrorToast: jest.fn(),
        showLoadingToast: jest.fn(() => ({update: jest.fn()})),
    },
}));

jest.mock('../../../../services/dispatchExecutorApi', () => ({
    canAssignAgentToJob: jest.fn().mockResolvedValue(true),
    assignAgentToJob: jest.fn().mockResolvedValue({status: 'Queued', agentEmail: 'a@b.c', willEmail: true}),
    assignNpAgentToJob: jest.fn().mockResolvedValue({success: true}),
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
    isRecurringJob?: boolean;
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
    const mockCheckForRateChanges = jest.fn().mockResolvedValue(undefined);

    const {result} = renderHook(() =>
        useJobActions({
            ...jobActionsDefaults(),
            job: opts.job ?? createMockJob(),
            isRecurringJob: opts.isRecurringJob ?? false,
            showToast: mockShowToast,
            updateField: mockUpdateField,
            updateAddress: mockUpdateAddress,
            updatePod: mockUpdatePod,
            dispatchJob: mockDispatchJob,
            refreshAndNotify: mockRefreshAndNotify,
            invalidateJobLists: mockInvalidateJobLists,
            invalidatePhotos: mockInvalidatePhotos,
            checkForRateChanges: mockCheckForRateChanges,
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
        mockCheckForRateChanges,
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

/** The POD time dialog now always opens, so most guided-flow tests need it stubbed. */
function mockPodTimeDialog(value = dayjs('2026-03-23T11:45:00')) {
    mockDateTimeDialog({value, fieldName: JobProperty.CompletedTime, timezone: 'Pacific/Auckland'});
    return value;
}

/** Stub the POD photo dialog and return its open spy. */
function mockPhotoDialog(open: jest.Mock = jest.fn().mockResolvedValue(undefined)) {
    (window as any).ReactJobFileUploadDialog = {open};
    return open;
}

/** Flush enough microtasks for the awaited dialog chain to reach the POD Name dialog. */
async function flushDialogChain() {
    await act(async () => {
        for (let i = 0; i < 20; i++) await Promise.resolve();
    });
}

// ── Tests ────────────────────────────────────────────────────────────

/** The collaborators useJobActions needs; a test names only the ones it asserts on. */
function jobActionsDefaults(): Omit<Parameters<typeof useJobActions>[0], 'job'> {
    return {
        isRecurringJob: false,
        isUsCustomer: false,
        showToast: jest.fn(),
        updateField: jest.fn().mockResolvedValue(undefined),
        updateAddress: jest.fn().mockResolvedValue(undefined),
        updatePod: jest.fn().mockResolvedValue(undefined),
        dispatchJob: jest.fn().mockResolvedValue(undefined),
        refreshAndNotify: jest.fn().mockResolvedValue(undefined),
        invalidateJobLists: jest.fn().mockResolvedValue([]),
        invalidatePhotos: jest.fn().mockResolvedValue(undefined),
        checkForRateChange: jest.fn().mockResolvedValue(undefined),
        checkForRateChanges: jest.fn().mockResolvedValue(undefined),
        invalidateAllJobDetails: jest.fn().mockResolvedValue(undefined),
        relatedJobs: [],
    };
}

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

        it('refuses to un-complete an archived job', async () => {
            const job = createMockJob({done: true, isArchived: true, completedTime: dayjs(), podName: 'Bob'});
            const {result, mockUpdateField, mockShowToast, mockRefreshAndNotify} = setup({job});

            await act(() => result.current.handleDoneClick());

            expect(mockShowToast).toHaveBeenCalledWith(
                'J-1001 is archived and completed, so it cannot be marked not done.',
                'warning',
            );
            expect(mockUpdateField).not.toHaveBeenCalled();
            expect(mockRefreshAndNotify).not.toHaveBeenCalled();
        });

        it('still completes an archived job that has not been done yet', async () => {
            mockPodTimeDialog();
            const job = createMockJob({done: false, isArchived: true, completedTime: null});
            const {result, mockShowToast} = setup({job});

            act(() => {
                void result.current.handleDoneClick();
            });
            await flushDialogChain();

            expect((window as any).ReactEditDateTimeDialog.showEditDateAndTimeDialog)
                .toHaveBeenCalled();
            expect(mockShowToast).not.toHaveBeenCalledWith(
                expect.stringContaining('archived'),
                'warning',
            );
        });

        it('does not offer Clear on the POD time of an archived completed job', async () => {
            mockPodTimeDialog();
            const job = createMockJob({done: true, isArchived: true, completedTime: dayjs('2026-03-23T11:45:00')});
            const {result} = setup({job});

            await act(() => result.current.handleEditCompletedTime());

            expect((window as any).ReactEditDateTimeDialog.showEditDateAndTimeDialog)
                .toHaveBeenCalledWith(expect.objectContaining({allowClear: false}));
        });

        it('still offers Clear on the POD time of a live completed job', async () => {
            mockPodTimeDialog();
            const job = createMockJob({done: true, completedTime: dayjs('2026-03-23T11:45:00')});
            const {result} = setup({job});

            await act(() => result.current.handleEditCompletedTime());

            expect((window as any).ReactEditDateTimeDialog.showEditDateAndTimeDialog)
                .toHaveBeenCalledWith(expect.objectContaining({allowClear: true}));
        });
    });

    describe('handleDoneClick — completing (guided flow)', () => {
        it('always prompts for a POD name, pre-filled, even when the job already has one', async () => {
            mockPodTimeDialog();
            const job = createMockJob({
                completedTime: dayjs('2026-03-23T11:45:00'),
                _completedTimeLongStr: '2026-03-23T11:45:00+13:00',
                podName: 'Bob Smith',
            });
            const {result, mockUpdatePod, mockShowToast, mockRefreshAndNotify} = setup({job});

            let donePromise: Promise<void>;
            act(() => {
                donePromise = result.current.handleDoneClick();
            });
            await flushDialogChain();

            // The operator gets the box, seeded with whoever was on the job already
            expect(result.current.textDialog.open).toBe(true);
            expect(result.current.textDialog.title).toBe('POD Name');
            expect(result.current.textDialog.initialValue).toBe('Bob Smith');

            await act(() => result.current.handleTextDialogSubmit('Jane Doe'));
            await act(() => donePromise!);

            expect(mockUpdatePod).toHaveBeenCalledWith({
                jobId: 1001,
                jobStatus: '6',
                podName: 'Jane Doe',
                podTime: '2026-03-23T11:45:00+13:00',
            });
            expect(mockShowToast).toHaveBeenCalledWith('J-1001 Completed', 'success');
            expect(mockRefreshAndNotify).toHaveBeenCalled();
        });

        it('prompts for a POD name when the existing value is whitespace only', async () => {
            mockPodTimeDialog();
            const job = createMockJob({
                completedTime: dayjs('2026-03-23T11:45:00'),
                _completedTimeLongStr: '2026-03-23T11:45:00+13:00',
                podName: ' ',
            });
            const {result, mockUpdatePod} = setup({job});

            let donePromise: Promise<void>;
            act(() => {
                donePromise = result.current.handleDoneClick();
            });
            await flushDialogChain();

            expect(result.current.textDialog.open).toBe(true);
            expect(result.current.textDialog.initialValue).toBe('');

            await act(() => result.current.handleTextDialogSubmit('Jane Doe'));
            await act(() => donePromise!);

            expect(mockUpdatePod).toHaveBeenCalledWith(
                expect.objectContaining({podName: 'Jane Doe'}),
            );
        });

        it('completes through UpdatePODDetails alone — no intermediate field writes', async () => {
            mockPodTimeDialog();
            const job = createMockJob({completedTime: null, podName: 'Bob Smith'});
            const {result, mockUpdateField, mockUpdatePod, mockRefreshAndNotify} = setup({job});

            let donePromise: Promise<void>;
            act(() => {
                donePromise = result.current.handleDoneClick();
            });
            await flushDialogChain();
            await act(() => result.current.handleTextDialogSubmit('Bob Smith'));
            await act(() => donePromise!);

            // POD time and name are persisted by the single completion call, so the
            // guided flow must not half-write them through job/UpdateJob first.
            expect(mockUpdateField).not.toHaveBeenCalled();
            expect(mockUpdatePod).toHaveBeenCalledWith(
                expect.objectContaining({
                    jobId: 1001,
                    jobStatus: '6',
                    podName: 'Bob Smith',
                    podTime: '2026-03-23T11:45:00+13:00',
                }),
            );
            expect(mockRefreshAndNotify).toHaveBeenCalled();
        });

        it('completes the job before opening the POD photo dialog', async () => {
            mockPodTimeDialog();
            const openPhotoDialog = mockPhotoDialog();
            const job = createMockJob({completedTime: null, podName: 'Bob Smith'});
            const {result, mockUpdatePod, mockInvalidatePhotos} = setup({job});

            let donePromise: Promise<void>;
            act(() => {
                donePromise = result.current.handleDoneClick();
            });
            await flushDialogChain();
            await act(() => result.current.handleTextDialogSubmit('Bob Smith'));
            await act(() => donePromise!);

            expect(openPhotoDialog).toHaveBeenCalledWith(1001, 'POD');
            expect(mockUpdatePod.mock.invocationCallOrder[0])
                .toBeLessThan(openPhotoDialog.mock.invocationCallOrder[0]);
            expect(mockInvalidatePhotos).toHaveBeenCalled();
        });

        it('still completes the job when the POD photo dialog is never dismissed', async () => {
            mockPodTimeDialog();
            // Escape and backdrop clicks are blocked on that dialog, so its promise can
            // stay pending forever — completion must not depend on it resolving.
            mockPhotoDialog(jest.fn(() => new Promise<void>(() => {})));
            const job = createMockJob({completedTime: null, podName: 'Bob Smith'});
            const {result, mockUpdatePod, mockShowToast} = setup({job});

            act(() => {
                void result.current.handleDoneClick();
            });
            await flushDialogChain();
            await act(() => result.current.handleTextDialogSubmit('Bob Smith'));
            await flushDialogChain();

            expect(mockUpdatePod).toHaveBeenCalledWith(
                expect.objectContaining({jobStatus: '6', podName: 'Bob Smith'}),
            );
            expect(mockShowToast).toHaveBeenCalledWith('J-1001 Completed', 'success');
        });

        it('refuses to complete a recurring booking', async () => {
            mockPodTimeDialog();
            const job = createMockJob({preBook: true, completedTime: null, podName: 'Bob'});
            const {result, mockUpdatePod, mockUpdateField, mockShowToast} = setup({job});

            await act(() => result.current.handleDoneClick());

            expect(mockShowToast).toHaveBeenCalledWith(
                'Recurring bookings cannot be completed here. Open the live job for this run.',
                'warning',
            );
            expect(mockUpdatePod).not.toHaveBeenCalled();
            expect(mockUpdateField).not.toHaveBeenCalled();
            expect((window as any).ReactEditDateTimeDialog.showEditDateAndTimeDialog)
                .not.toHaveBeenCalled();
        });

        it('refuses to complete a scheduled (bulk) job', async () => {
            mockPodTimeDialog();
            const job = createMockJob({isBulkJob: true, completedTime: null, podName: 'Bob'});
            const {result, mockUpdatePod, mockShowToast} = setup({job});

            await act(() => result.current.handleDoneClick());

            expect(mockShowToast).toHaveBeenCalledWith(
                'Completing a job is not currently available for scheduled jobs.',
                'warning',
            );
            expect(mockUpdatePod).not.toHaveBeenCalled();
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
            mockPodTimeDialog();
            const job = createMockJob({
                completedTime: dayjs('2026-03-23T11:45:00'),
                _completedTimeLongStr: '2026-03-23T11:45:00+13:00',
                podName: '',
            });
            const {result, mockUpdatePod, mockShowToast} = setup({job});

            // Start the done click — it will open the text dialog and await
            let donePromise: Promise<void>;
            act(() => {
                donePromise = result.current.handleDoneClick();
            });
            await flushDialogChain();

            // The text dialog should now be open
            expect(result.current.textDialog.open).toBe(true);
            expect(result.current.textDialog.title).toBe('POD Name');
            expect(result.current.textDialog.okLabel).toBe('Complete Job');

            // Simulate user submitting the text dialog
            await act(() => result.current.handleTextDialogSubmit('Jane Doe'));
            await act(() => donePromise!);

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
            mockPodTimeDialog();
            const job = createMockJob({
                completedTime: dayjs('2026-03-23T11:45:00'),
                _completedTimeLongStr: '2026-03-23T11:45:00+13:00',
                podName: '',
            });
            const {result, mockShowToast, mockUpdatePod} = setup({job});

            let donePromise: Promise<void>;
            act(() => {
                donePromise = result.current.handleDoneClick();
            });
            await flushDialogChain();

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
            mockPodTimeDialog();

            const job = createMockJob({completedTime: null, podName: ''});
            const {result, mockUpdatePod} = setup({job});

            // Start the flow — first the date dialog resolves, then the text dialog opens
            let donePromise: Promise<void>;
            act(() => {
                donePromise = result.current.handleDoneClick();
            });
            await flushDialogChain();

            expect((window as any).ReactEditDateTimeDialog.showEditDateAndTimeDialog)
                .toHaveBeenCalledWith(expect.objectContaining({title: 'POD Time'}));

            // Text dialog should now be open for POD name
            expect(result.current.textDialog.open).toBe(true);
            expect(result.current.textDialog.title).toBe('POD Name');

            // Submit POD name
            await act(() => result.current.handleTextDialogSubmit('Alice'));
            await act(() => donePromise!);

            expect(mockUpdatePod).toHaveBeenCalledWith(
                expect.objectContaining({
                    jobId: 1001,
                    jobStatus: '6',
                    podName: 'Alice',
                    podTime: '2026-03-23T11:45:00+13:00',
                }),
            );
        });

        it('does nothing when job is undefined', async () => {
            const mockShowToast = jest.fn();
            const mockUpdatePod = jest.fn();
            const {result} = renderHook(() =>
                useJobActions({
                    ...jobActionsDefaults(),
                    job: undefined,
                    showToast: mockShowToast,
                    updatePod: mockUpdatePod,
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
            mockPodTimeDialog();

            const {result, mockUpdatePod} = setup({job});

            let editPromise: Promise<void>;
            act(() => {
                editPromise = result.current.handleEditCompletedTime();
            });
            await flushDialogChain();

            // The POD name is still confirmed even though the job already carries one
            expect(result.current.textDialog.initialValue).toBe('Bob');
            await act(() => result.current.handleTextDialogSubmit('Bob'));
            await act(() => editPromise!);

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

        it('offers Clear and clears the POD time when the dialog signals cleared', async () => {
            const {updateJobDetail} = jest.requireMock('../../../../services/jobDetailApi');
            (updateJobDetail as jest.Mock).mockClear();

            const job = createMockJob({
                done: true,
                completedTime: dayjs('2026-03-23T11:45:00'),
                podName: 'Bob',
            });
            (window as any).ReactEditDateTimeDialog = {
                showEditDateAndTimeDialog: jest.fn().mockResolvedValue({
                    value: dayjs('2026-03-23T11:45:00'),
                    fieldName: JobProperty.CompletedTime,
                    timezone: 'Pacific/Auckland',
                    cleared: true,
                }),
            };

            const {result, mockUpdatePod, mockShowToast} = setup({job});

            await act(() => result.current.handleEditCompletedTime());

            // The dialog is opened with the Clear affordance enabled
            expect((window as any).ReactEditDateTimeDialog.showEditDateAndTimeDialog)
                .toHaveBeenCalledWith(expect.objectContaining({allowClear: true}));
            // Clear persists an empty value so the backend nulls the POD time
            expect(updateJobDetail).toHaveBeenCalledWith(1001, JobProperty.CompletedTime, '', false, 'Pacific/Auckland');
            expect(mockUpdatePod).not.toHaveBeenCalled();
            expect(mockShowToast).toHaveBeenCalledWith('J-1001 updated', 'success');
        });
    });

    describe('handleEditPodName — chaining into completion flow', () => {
        it('chains into markJobAsDone when job is not yet done', async () => {
            mockPodTimeDialog();
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
            await flushDialogChain();
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
            // Clear affordance is offered so the name can be removed
            expect(result.current.textDialog.allowClear).toBe(true);
            expect(mockUpdatePod).not.toHaveBeenCalled();
        });

        it('clears the POD name when an empty value is submitted on a done job', async () => {
            const job = createMockJob({
                done: true,
                completedTime: dayjs('2026-03-23T11:45:00'),
                podName: 'Bob',
            });
            const {result, mockUpdateField} = setup({job});

            act(() => {
                result.current.handleEditPodName();
            });

            // Clear submits an empty value through the text dialog
            await act(() => result.current.handleTextDialogSubmit(''));

            expect(mockUpdateField).toHaveBeenCalledWith(
                expect.objectContaining({field: JobProperty.PodName, value: ''}),
            );
        });
    });

    describe('openTextDialogAsync / text dialog promise integration', () => {
        it('resolves with submitted value in async mode', async () => {
            mockPodTimeDialog();
            const job = createMockJob({
                completedTime: dayjs('2026-03-23T11:45:00'),
                _completedTimeLongStr: '2026-03-23T11:45:00+13:00',
                podName: '',
            });
            const {result, mockUpdateField, mockUpdatePod} = setup({job});

            let donePromise: Promise<void>;
            act(() => {
                donePromise = result.current.handleDoneClick();
            });
            await flushDialogChain();

            // Submit via text dialog
            await act(() => result.current.handleTextDialogSubmit('Async Name'));
            await act(() => donePromise!);

            // In async mode the caller (markJobAsDone) owns the value and persists it
            // through the single completion call, not through handleTextDialogSubmit.
            expect(mockUpdateField).not.toHaveBeenCalled();
            expect(mockUpdatePod).toHaveBeenCalledWith(
                expect.objectContaining({podName: 'Async Name'}),
            );
        });

        it('resolves with null on cancel in async mode', async () => {
            mockPodTimeDialog();
            const job = createMockJob({
                completedTime: dayjs('2026-03-23T11:45:00'),
                _completedTimeLongStr: '2026-03-23T11:45:00+13:00',
                podName: '',
            });
            const {result, mockUpdatePod} = setup({job});

            let donePromise!: Promise<void>;
            act(() => {
                donePromise = result.current.handleDoneClick();
            });
            await flushDialogChain();

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
        it('completes the job even when file upload dialog is not available', async () => {
            // No ReactJobFileUploadDialog on window
            mockPodTimeDialog();
            const job = createMockJob({
                completedTime: dayjs('2026-03-23T11:45:00'),
                _completedTimeLongStr: '2026-03-23T11:45:00+13:00',
                podName: 'Bob',
            });
            const {result, mockUpdatePod, mockInvalidatePhotos} = setup({job});

            let donePromise: Promise<void>;
            act(() => {
                donePromise = result.current.handleDoneClick();
            });
            await flushDialogChain();
            await act(() => result.current.handleTextDialogSubmit('Bob'));
            await act(() => donePromise!);

            expect(mockUpdatePod).toHaveBeenCalledWith(
                expect.objectContaining({jobStatus: '6'}),
            );
            expect(mockInvalidatePhotos).toHaveBeenCalled();
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
                ...jobActionsDefaults(),
                job: undefined,
                refreshAndNotify: mockRefreshAndNotify,
                invalidateJobLists: mockInvalidateJobLists,
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
                ...jobActionsDefaults(),
                job,
                showToast: mockShowToast,
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
                ...jobActionsDefaults(),
                job,
                showToast: mockShowToast,
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
                ...jobActionsDefaults(),
                job,
                showToast: mockShowToast,
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

describe('useJobActions — handlePricingClick on a split child', () => {
    afterEach(() => {
        delete (window as any).ReactSplitPricingBreakdownDialog;
        delete (window as any).ReactPriceBreakdownDialog;
        jest.restoreAllMocks();
    });

    it('opens the same split pricing grid as the parent — fetched via the parent, editable, with its own leg highlighted', async () => {
        const {getSplitPricingBreakdown} = jest.requireMock('../../../../services/splitPriceBreakdownApi');
        const breakdown = {jobId: 500, totalRevenue: 100, items: [], legs: [], locks: {}};
        (getSplitPricingBreakdown as jest.Mock).mockResolvedValueOnce(breakdown);

        const splitOpenMock = jest.fn().mockResolvedValue(null);
        (window as any).ReactSplitPricingBreakdownDialog = {open: splitOpenMock, setToastService: jest.fn()};

        const parentJob = createMockJob({id: 500, jobNo: 'KT4071V'});
        const job = createMockJob({
            id: 501,
            jobNo: 'KT4071VA',
            locked: false,
            isArchived: false,
            rootParentId: 500,
            jobRelationshipTypeId: JobRelationshipType.SplitChild,
        });

        const {result} = renderHook(() =>
            useJobActions({...jobActionsDefaults(), job, relatedJobs: [parentJob]}),
        );

        await act(async () => {
            await result.current.handlePricingClick();
        });

        expect(getSplitPricingBreakdown).toHaveBeenCalledWith(500, false);
        expect(splitOpenMock).toHaveBeenCalledWith(breakdown, {readOnly: false, highlightLegId: 501});
    });

    it('opens the grid read-only from a split child whose parent is locked', async () => {
        const {getSplitPricingBreakdown} = jest.requireMock('../../../../services/splitPriceBreakdownApi');
        const breakdown = {jobId: 500, totalRevenue: 100, items: [], legs: [], locks: {}};
        (getSplitPricingBreakdown as jest.Mock).mockResolvedValueOnce(breakdown);

        const splitOpenMock = jest.fn().mockResolvedValue(null);
        (window as any).ReactSplitPricingBreakdownDialog = {open: splitOpenMock, setToastService: jest.fn()};

        const parentJob = createMockJob({id: 500, jobNo: 'KT4071V', locked: true});
        const job = createMockJob({
            id: 501,
            jobNo: 'KT4071VA',
            locked: false,
            rootParentId: 500,
            jobRelationshipTypeId: JobRelationshipType.SplitChild,
        });

        const {result} = renderHook(() =>
            useJobActions({...jobActionsDefaults(), job, relatedJobs: [parentJob]}),
        );

        await act(async () => {
            await result.current.handlePricingClick();
        });

        expect(splitOpenMock).toHaveBeenCalledWith(breakdown, {readOnly: true, highlightLegId: 501});
    });

    it('falls back to the flat dialog, forced read-only, when the parent has no derivable split breakdown', async () => {
        const openMock = jest.fn().mockResolvedValue(null);
        (window as any).ReactPriceBreakdownDialog = {
            open: openMock,
            setToastService: jest.fn(),
        };
        const {getPriceBreakdowns} = jest.requireMock('../../../../services/pricingBreakdownApi');
        (getPriceBreakdowns as jest.Mock).mockResolvedValueOnce([{chargeId: 1, name: 'Base', amount: 10}]);

        const parentJob = createMockJob({id: 500, jobNo: 'KT4071V'});
        const job = createMockJob({
            id: 501,
            jobNo: 'KT4071VA',
            locked: false,
            isArchived: false,
            rootParentId: 500,
            jobRelationshipTypeId: JobRelationshipType.SplitChild,
        });
        const onNavigateToJob = jest.fn();

        const {result} = renderHook(() =>
            useJobActions({
                ...jobActionsDefaults(),
                job,
                relatedJobs: [parentJob],
                onNavigateToJob,
            }),
        );

        await act(async () => {
            await result.current.handlePricingClick();
        });

        expect(openMock).toHaveBeenCalledWith(
            expect.any(Array), 501, false, false, false, true,
            {parentJobNumber: 'KT4071V', onNavigateToParent: expect.any(Function)},
        );

        const managedElsewhere = openMock.mock.calls[0][6];
        managedElsewhere.onNavigateToParent();
        expect(onNavigateToJob).toHaveBeenCalledWith(500);
    });
});

describe('useJobActions — handlePricingClick on a split parent', () => {
    afterEach(() => {
        delete (window as any).ReactSplitPricingBreakdownDialog;
        delete (window as any).ReactPriceBreakdownDialog;
        jest.restoreAllMocks();
    });

    it('opens the split pricing grid instead of the flat dialog, fully editable', async () => {
        const {getSplitPricingBreakdown} = jest.requireMock('../../../../services/splitPriceBreakdownApi');
        const breakdown = {jobId: 503, totalRevenue: 100, items: [], legs: [], locks: {}};
        (getSplitPricingBreakdown as jest.Mock).mockResolvedValueOnce(breakdown);

        const flatOpenMock = jest.fn();
        const splitOpenMock = jest.fn().mockResolvedValue(null);
        (window as any).ReactPriceBreakdownDialog = {open: flatOpenMock, setToastService: jest.fn()};
        (window as any).ReactSplitPricingBreakdownDialog = {open: splitOpenMock, setToastService: jest.fn()};

        const job = createMockJob({
            id: 503,
            jobNo: 'KT4071V',
            jobRelationshipTypeId: JobRelationshipType.SplitParent,
        });

        const {result} = renderHook(() => useJobActions({...jobActionsDefaults(), job}));

        await act(async () => {
            await result.current.handlePricingClick();
        });

        expect(getSplitPricingBreakdown).toHaveBeenCalledWith(503, false);
        expect(splitOpenMock).toHaveBeenCalledWith(breakdown, {readOnly: false, highlightLegId: undefined});
        expect(flatOpenMock).not.toHaveBeenCalled();
    });

    it('opens the split pricing grid editable when the split parent is archived but not locked', async () => {
        const {getSplitPricingBreakdown} = jest.requireMock('../../../../services/splitPriceBreakdownApi');
        const breakdown = {jobId: 505, totalRevenue: 100, items: [], legs: [], locks: {}};
        (getSplitPricingBreakdown as jest.Mock).mockResolvedValueOnce(breakdown);

        const splitOpenMock = jest.fn().mockResolvedValue(null);
        (window as any).ReactSplitPricingBreakdownDialog = {open: splitOpenMock, setToastService: jest.fn()};

        const job = createMockJob({
            id: 505,
            jobNo: 'KT4071V',
            isArchived: true,
            jobRelationshipTypeId: JobRelationshipType.SplitParent,
        });

        const {result} = renderHook(() => useJobActions({...jobActionsDefaults(), job}));

        await act(async () => {
            await result.current.handlePricingClick();
        });

        expect(getSplitPricingBreakdown).toHaveBeenCalledWith(505, true);
        expect(splitOpenMock).toHaveBeenCalledWith(breakdown, {readOnly: false, highlightLegId: undefined});
    });

    it('opens the split pricing grid read-only when the archived split parent is locked', async () => {
        const {getSplitPricingBreakdown} = jest.requireMock('../../../../services/splitPriceBreakdownApi');
        const breakdown = {jobId: 506, totalRevenue: 100, items: [], legs: [], locks: {}};
        (getSplitPricingBreakdown as jest.Mock).mockResolvedValueOnce(breakdown);

        const splitOpenMock = jest.fn().mockResolvedValue(null);
        (window as any).ReactSplitPricingBreakdownDialog = {open: splitOpenMock, setToastService: jest.fn()};

        const job = createMockJob({
            id: 506,
            jobNo: 'KT4072V',
            isArchived: true,
            locked: true,
            jobRelationshipTypeId: JobRelationshipType.SplitParent,
        });

        const {result} = renderHook(() => useJobActions({...jobActionsDefaults(), job}));

        await act(async () => {
            await result.current.handlePricingClick();
        });

        expect(splitOpenMock).toHaveBeenCalledWith(breakdown, {readOnly: true, highlightLegId: undefined});
    });

    it('falls back to the flat dialog, fully editable, when the split breakdown has nothing to show at all', async () => {
        const {getSplitPricingBreakdown} = jest.requireMock('../../../../services/splitPriceBreakdownApi');
        (getSplitPricingBreakdown as jest.Mock).mockResolvedValueOnce(null);
        const {getPriceBreakdowns} = jest.requireMock('../../../../services/pricingBreakdownApi');
        (getPriceBreakdowns as jest.Mock).mockResolvedValueOnce([{chargeId: 1, name: 'Base', amount: 10}]);

        const flatOpenMock = jest.fn().mockResolvedValue(null);
        const splitOpenMock = jest.fn();
        (window as any).ReactPriceBreakdownDialog = {open: flatOpenMock, setToastService: jest.fn()};
        (window as any).ReactSplitPricingBreakdownDialog = {open: splitOpenMock, setToastService: jest.fn()};

        const job = createMockJob({
            id: 504,
            jobNo: 'OLD001',
            locked: false,
            isArchived: false,
            jobRelationshipTypeId: JobRelationshipType.SplitParent,
        });

        const {result} = renderHook(() => useJobActions({...jobActionsDefaults(), job}));

        await act(async () => {
            await result.current.handlePricingClick();
        });

        expect(splitOpenMock).not.toHaveBeenCalled();
        expect(flatOpenMock).toHaveBeenCalledWith(expect.any(Array), 504, false, false, false, false, undefined);
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
                ...jobActionsDefaults(),
                job,
                showToast: mockShowToast,
                updateField: mockUpdateField,
                updateAddress: mockUpdateAddress,
                refreshAndNotify: mockRefreshAndNotify,
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

    describe('dispatchDialogConfirmCourier — network partner', () => {
        const {assignNpAgentToJob} = require('../../../../services/dispatchExecutorApi');

        beforeEach(() => {
            (assignNpAgentToJob as jest.Mock).mockClear();
        });

        it('sends a live job down the dedicated NP endpoint, not a field write', async () => {
            // JobProperty.NpAgentId is rejected outright for live tucJobs, so routing
            // this through updateField is what used to make job-detail NP assignment fail.
            const job = createMockJob();
            const {result, mockUpdateField, mockRefreshAndNotify} = setup({job});

            await act(async () => {
                await result.current.dispatchDialogConfirmCourier({
                    type: 'NP',
                    destination: {id: 55, text: 'PartnerCo'},
                });
            });

            expect(assignNpAgentToJob).toHaveBeenCalledWith(job.id, 55);
            expect(mockUpdateField).not.toHaveBeenCalled();
            expect(mockRefreshAndNotify).toHaveBeenCalled();
            expect(result.current.dispatchDialog.open).toBe(false);
        });

        it('still writes the booking field for a recurring job, which does support it', async () => {
            const job = createMockJob({preBook: true});
            const {result, mockUpdateField} = setup({job, isRecurringJob: true});

            await act(async () => {
                await result.current.dispatchDialogConfirmCourier({
                    type: 'NP',
                    destination: {id: 55, text: 'PartnerCo'},
                });
            });

            expect(assignNpAgentToJob).not.toHaveBeenCalled();
            expect(mockUpdateField).toHaveBeenCalledWith(
                expect.objectContaining({
                    field: JobProperty.NpAgentId,
                    value: 55,
                    isRecurring: true,
                }),
            );
        });
    });

    describe('dispatchDialogConfirmCourier — agent extras', () => {
        const {assignAgentToJob} = require('../../../../services/dispatchExecutorApi');
        const {updateJobDetail} = require('../../../../services/jobDetailApi');

        const {toastService} = require('../../../../services/toastService');

        beforeEach(() => {
            (assignAgentToJob as jest.Mock).mockClear();
            (assignAgentToJob as jest.Mock).mockResolvedValue({
                status: 'Queued', agentEmail: 'a@b.c', willEmail: true,
            });
            (updateJobDetail as jest.Mock).mockClear();
            toastService.showSuccessToast.mockClear();
            toastService.showWarningToast.mockClear();
        });

        it('forwards the stop-job cascade and writes the AWB after the assignment lands', async () => {
            const job = createMockJob();
            const {result} = setup({job});

            await act(async () => {
                await result.current.dispatchDialogConfirmCourier({
                    type: 'Agent',
                    destination: {id: 201, text: 'AgentOne'},
                    includeStopJobs: true,
                    awb: '123-45678901',
                });
            });

            expect(assignAgentToJob).toHaveBeenCalledWith(job.id, 201, true, undefined, undefined);
            expect(updateJobDetail).toHaveBeenCalledWith(
                job.id, JobProperty.ConNote, '123-45678901', false,
            );
        });

        it('warns rather than reports success when the agent could not be emailed the link', async () => {
            // The assignment landed but the agent has no way into the job, so this must
            // not read as a clean success.
            (assignAgentToJob as jest.Mock).mockResolvedValue({
                status: 'NoAgentEmail', agentEmail: null, willEmail: false,
            });
            const {result} = setup({job: createMockJob()});

            await act(async () => {
                await result.current.dispatchDialogConfirmCourier({
                    type: 'Agent',
                    destination: {id: 201, text: 'AgentOne'},
                });
            });

            expect(toastService.showWarningToast).toHaveBeenCalledWith(
                expect.stringContaining('no email on file'),
            );
            expect(toastService.showSuccessToast).not.toHaveBeenCalled();
        });

        it('skips the ConNote write when no AWB was entered', async () => {
            const {result} = setup({job: createMockJob()});

            await act(async () => {
                await result.current.dispatchDialogConfirmCourier({
                    type: 'Agent',
                    destination: {id: 201, text: 'AgentOne'},
                });
            });

            expect(updateJobDetail).not.toHaveBeenCalled();
        });
    });

    describe('dispatchDialogUnassignCourier', () => {
        it('clears the courier on a recurring job by sending an empty value through updateField', async () => {
            const job = createMockJob({preBook: true});
            const {result, mockUpdateField, mockRefreshAndNotify} = setup({job});

            await act(async () => {
                await result.current.dispatchDialogUnassignCourier();
            });

            expect(mockUpdateField).toHaveBeenCalledWith(
                expect.objectContaining({
                    field: JobProperty.CourierID,
                    value: '',
                    isRecurring: true,
                }),
            );
            expect(mockRefreshAndNotify).toHaveBeenCalled();
        });

        it('closes the dispatch dialog after a successful unassign', async () => {
            const job = createMockJob({preBook: true});
            const {result} = setup({job});

            await act(async () => {
                await result.current.dispatchDialogUnassignCourier();
            });

            expect(result.current.dispatchDialog.open).toBe(false);
        });
    });
});

describe('useJobActions — date cascade', () => {
    const {updateJobDetail, getFamilyForDateChange} = require('../../../../services/jobDetailApi');

    function mockBookedDateDialog() {
        mockDateTimeDialog({
            value: dayjs('2026-03-12T09:30:00'),
            fieldName: JobProperty.BookedTime,
            timezone: 'Pacific/Auckland',
        });
    }

    function mockFamily(members: Array<Record<string, unknown>>) {
        getFamilyForDateChange.mockResolvedValueOnce({relationshipTypeId: 19, members});
    }

    const cascadableLeg = (jobId: number) => ({
        jobId, jobNo: `J-${jobId}`, date: null, time: null, amount: 25,
        ratedManually: false, locked: false, isPartnerJob: false, cascadable: true,
    });

    afterEach(() => {
        clearWindowDialogs();
        jest.clearAllMocks();
    });

    it('opens the confirm dialog when the job has cascadable linked jobs', async () => {
        mockBookedDateDialog();
        mockFamily([cascadableLeg(2), cascadableLeg(3)]);
        const {result} = setup();

        act(() => {
            void result.current.editDateAndTime(JobProperty.BookedTime, 'Booked Date');
        });
        await flushDialogChain();

        expect(result.current.cascadeDialog.open).toBe(true);
        expect(result.current.cascadeDialog.members).toHaveLength(2);
        // Nothing is written until the user chooses.
        expect(updateJobDetail).not.toHaveBeenCalled();
    });

    it('cascades when the user applies to all, then price-checks every job that moved', async () => {
        mockBookedDateDialog();
        mockFamily([cascadableLeg(2)]);
        updateJobDetail.mockResolvedValueOnce({updatedJobIds: [1001, 2]});
        const {result, mockCheckForRateChanges, mockShowToast} = setup();

        act(() => {
            void result.current.editDateAndTime(JobProperty.BookedTime, 'Booked Date');
        });
        await flushDialogChain();
        await act(async () => {
            result.current.handleCascadeChoose('all');
        });
        await flushDialogChain();

        expect(updateJobDetail).toHaveBeenCalledWith(
            1001, JobProperty.BookedTime, expect.anything(), false, 'Pacific/Auckland',
            {cascadeToChildren: true},
        );
        expect(mockShowToast).toHaveBeenCalledWith('J-1001 and 1 linked jobs updated', 'success');
        expect(mockCheckForRateChanges).toHaveBeenCalledWith([1001, 2]);
    });

    it('writes only the parent when the user picks "this job only"', async () => {
        mockBookedDateDialog();
        mockFamily([cascadableLeg(2)]);
        updateJobDetail.mockResolvedValueOnce({updatedJobIds: [1001]});
        const {result} = setup();

        act(() => {
            void result.current.editDateAndTime(JobProperty.BookedTime, 'Booked Date');
        });
        await flushDialogChain();
        await act(async () => {
            result.current.handleCascadeChoose('self');
        });
        await flushDialogChain();

        expect(updateJobDetail).toHaveBeenCalledWith(
            1001, JobProperty.BookedTime, expect.anything(), false, 'Pacific/Auckland',
            {cascadeToChildren: false},
        );
    });

    it('writes nothing when the confirm dialog is cancelled', async () => {
        mockBookedDateDialog();
        mockFamily([cascadableLeg(2)]);
        const {result} = setup();

        act(() => {
            void result.current.editDateAndTime(JobProperty.BookedTime, 'Booked Date');
        });
        await flushDialogChain();
        await act(async () => {
            result.current.handleCascadeCancel();
        });
        await flushDialogChain();

        expect(updateJobDetail).not.toHaveBeenCalled();
        expect(result.current.cascadeDialog.open).toBe(false);
    });

    it('skips the dialog entirely when there is nothing cascadable', async () => {
        mockBookedDateDialog();
        // A locked leg is returned so the user could be told, but it cannot be written to.
        mockFamily([{...cascadableLeg(2), locked: true, cascadable: false}]);
        updateJobDetail.mockResolvedValueOnce({updatedJobIds: [1001]});
        const {result, mockShowToast} = setup();

        await act(async () => {
            await result.current.editDateAndTime(JobProperty.BookedTime, 'Booked Date');
        });

        expect(result.current.cascadeDialog.open).toBe(false);
        expect(updateJobDetail).toHaveBeenCalledWith(
            1001, JobProperty.BookedTime, expect.anything(), false, 'Pacific/Auckland',
            {cascadeToChildren: false},
        );
        expect(mockShowToast).toHaveBeenCalledWith('J-1001 updated', 'success');
    });

    it('warns when some children could not be moved', async () => {
        mockBookedDateDialog();
        mockFamily([cascadableLeg(2), cascadableLeg(3)]);
        updateJobDetail.mockResolvedValueOnce({updatedJobIds: [1001, 2], failedJobIds: [3]});
        const {result, mockShowToast} = setup();

        act(() => {
            void result.current.editDateAndTime(JobProperty.BookedTime, 'Booked Date');
        });
        await flushDialogChain();
        await act(async () => {
            result.current.handleCascadeChoose('all');
        });
        await flushDialogChain();

        expect(mockShowToast).toHaveBeenCalledWith('Date applied to 2 of 3 jobs', 'warning');
    });

    it('never looks up a family for a non-date field', async () => {
        mockDateTimeDialog({
            value: dayjs('2026-03-12T09:30:00'),
            fieldName: JobProperty.PickupArrivalTime,
            timezone: 'Pacific/Auckland',
        });
        updateJobDetail.mockResolvedValueOnce({});
        const {result} = setup();

        await act(async () => {
            await result.current.editDateAndTime(JobProperty.PickupArrivalTime, 'Pickup Arrival');
        });

        expect(getFamilyForDateChange).not.toHaveBeenCalled();
    });

    it('routes a partner job to the change-request dialog without touching the family', async () => {
        mockBookedDateDialog();
        const onRequestPartnerChange = jest.fn();
        const {result} = renderHook(() =>
            useJobActions({
                ...jobActionsDefaults(),
                job: createMockJob({isPartnerJob: true}),
                onRequestPartnerChange,
            }),
        );

        await act(async () => {
            await result.current.editDateAndTime(JobProperty.BookedTime, 'Booked Date');
        });

        expect(onRequestPartnerChange).toHaveBeenCalled();
        expect(getFamilyForDateChange).not.toHaveBeenCalled();
        expect(updateJobDetail).not.toHaveBeenCalled();
    });
});

describe('useJobActions — POD & document actions on bulk (scheduled) jobs', () => {
    const {
        getPodReportUrl,
        getPodSpreadsheetUrl,
        getOverlayDocumentUrl,
        getJobOverlayDocuments,
    } = require('../../../../services/jobDetailApi');

    /** A schedule row: its own id is a BulkJobId, the live tucJob is on linkedJobId. */
    const bulkJob = () => createMockJob({id: 500, linkedJobId: 987654, isBulkJob: true, done: true});

    let openSpy: jest.SpyInstance;

    beforeEach(() => {
        openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
        getPodReportUrl.mockImplementation((id: number) => `/job/PodReport?jobId=${id}`);
        getPodSpreadsheetUrl.mockImplementation((id: number) => `/job/PodSpreadsheet?jobId=${id}`);
        getOverlayDocumentUrl.mockImplementation((id: number, type: string) => `/job/OverlayDocument?jobId=${id}&documentType=${type}`);
        getJobOverlayDocuments.mockResolvedValue([]);
    });

    afterEach(() => {
        clearWindowDialogs();
        delete (window as any).ReactSendPodDialog;
        jest.restoreAllMocks();
        jest.clearAllMocks();
    });

    it('sends the linked live job id to every POD and document action', async () => {
        const uploadOpen = mockPhotoDialog();
        const sendPodOpen = jest.fn().mockResolvedValue(undefined);
        (window as any).ReactSendPodDialog = {open: sendPodOpen};
        const {result} = setup({job: bulkJob()});

        act(() => result.current.handlePodReport());
        act(() => result.current.handlePodSpreadsheet());
        act(() => result.current.handlePodUpload());
        act(() => result.current.handleDownloadOverlay('Invoice'));
        await act(async () => {
            await result.current.fetchOverlayDocuments();
        });
        await act(async () => {
            await result.current.handleSendPodEmail();
        });

        expect(getPodReportUrl).toHaveBeenCalledWith(987654);
        expect(getPodSpreadsheetUrl).toHaveBeenCalledWith(987654);
        expect(uploadOpen).toHaveBeenCalledWith(987654, 'POD');
        expect(getOverlayDocumentUrl).toHaveBeenCalledWith(987654, 'Invoice');
        expect(getJobOverlayDocuments).toHaveBeenCalledWith(987654);
        expect(sendPodOpen).toHaveBeenCalledWith(expect.objectContaining({jobId: 987654}));
        expect(openSpy).toHaveBeenCalledWith('/job/PodReport?jobId=987654', '_blank');
    });

    it('uses the job’s own id when there is no linked job', async () => {
        const uploadOpen = mockPhotoDialog();
        const {result} = setup({job: createMockJob({id: 1001, done: true})});

        act(() => result.current.handlePodReport());
        act(() => result.current.handlePodUpload());
        await act(async () => {
            await result.current.fetchOverlayDocuments();
        });

        expect(getPodReportUrl).toHaveBeenCalledWith(1001);
        expect(uploadOpen).toHaveBeenCalledWith(1001, 'POD');
        expect(getJobOverlayDocuments).toHaveBeenCalledWith(1001);
    });
});
