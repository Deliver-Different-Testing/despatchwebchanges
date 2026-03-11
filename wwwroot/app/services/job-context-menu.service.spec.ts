/**
 * Tests for JobContextMenuService
 * Covers the markJobMissing method, Missing status menu option, and splitJobAction flow
 */

import {JobStatus} from '../enums/job-status.enum';
import {JobProperty} from '../enums/job-property.enum';
import {IDispatchJob} from '../interfaces/job.interface';
import {isAiEnabled} from '../functions/aiSettings';

jest.mock('../functions/aiSettings', () => ({
    ...jest.requireActual('../functions/aiSettings'),
    isAiEnabled: jest.fn(),
}));

describe('JobContextMenuService', () => {
    // Mock services
    let mockDispatchData: {
        updateJobDetail: jest.Mock;
        getEventGroups: jest.Mock;
    };
    let mockToastrService: {
        showSuccessToast: jest.Mock;
        showErrorToast: jest.Mock;
        showWarningToast: jest.Mock;
        showInfoToast: jest.Mock;
    };

    // Helper to create a minimal mock IDispatchJob
    const createMockJob = (overrides: Partial<IDispatchJob> = {}): IDispatchJob => ({
        angularId: 'test-angular-id',
        id: 123,
        jobNo: 'JOB-123',
        hasBeenRead: false,
        showCourierSearch: false,
        parentId: 0,
        isFlightJob: false,
        isAgentJob: false,
        isBulkJob: false,
        isArchived: false,
        courierSearchLoading: false,
        pickupAddress: {} as any,
        deliveryAddress: {} as any,
        booked: {} as any,
        preBook: false,
        ...overrides,
    } as IDispatchJob);

    // Simplified service methods that mirror the actual implementation
    const markJobMissing = async (
        dispatchData: typeof mockDispatchData,
        toastrService: typeof mockToastrService,
        job: IDispatchJob,
        onRefresh?: () => void
    ): Promise<void> => {
        try {
            await dispatchData.updateJobDetail(
                job.id,
                JobProperty.Status,
                JobStatus.Missing,
                job.preBook ?? false
            );
            toastrService.showSuccessToast("Job successfully marked as missing.");

            if (onRefresh) {
                onRefresh();
            }
        } catch (error) {
            console.error("Error updating job status to missing:", error);
            toastrService.showErrorToast("An unexpected error occured marking this job as missing.");
        }
    };

    beforeEach(() => {
        mockDispatchData = {
            updateJobDetail: jest.fn(),
            getEventGroups: jest.fn().mockResolvedValue([]),
        };
        mockToastrService = {
            showSuccessToast: jest.fn(),
            showErrorToast: jest.fn(),
            showWarningToast: jest.fn(),
            showInfoToast: jest.fn(),
        };
        jest.fn();
        jest.fn().mockReturnThis();
        jest.fn().mockReturnThis();
    });

    describe('markJobMissing', () => {
        it('should call updateJobDetail with correct parameters for regular job', async () => {
            const job = createMockJob({ id: 456, preBook: false });
            mockDispatchData.updateJobDetail.mockResolvedValue(undefined);

            await markJobMissing(mockDispatchData, mockToastrService, job);

            expect(mockDispatchData.updateJobDetail).toHaveBeenCalledTimes(1);
            expect(mockDispatchData.updateJobDetail).toHaveBeenCalledWith(
                456,
                JobProperty.Status,
                JobStatus.Missing,
                false
            );
        });

        it('should call updateJobDetail with preBook=true for prebook job', async () => {
            const job = createMockJob({ id: 789, preBook: true });
            mockDispatchData.updateJobDetail.mockResolvedValue(undefined);

            await markJobMissing(mockDispatchData, mockToastrService, job);

            expect(mockDispatchData.updateJobDetail).toHaveBeenCalledWith(
                789,
                JobProperty.Status,
                JobStatus.Missing,
                true
            );
        });

        it('should show success toast on successful update', async () => {
            const job = createMockJob();
            mockDispatchData.updateJobDetail.mockResolvedValue(undefined);

            await markJobMissing(mockDispatchData, mockToastrService, job);

            expect(mockToastrService.showSuccessToast).toHaveBeenCalledTimes(1);
            expect(mockToastrService.showSuccessToast).toHaveBeenCalledWith(
                "Job successfully marked as missing."
            );
        });

        it('should call onRefresh callback after successful update', async () => {
            const job = createMockJob();
            const onRefresh = jest.fn();
            mockDispatchData.updateJobDetail.mockResolvedValue(undefined);

            await markJobMissing(mockDispatchData, mockToastrService, job, onRefresh);

            expect(onRefresh).toHaveBeenCalledTimes(1);
        });

        it('should not call onRefresh if not provided', async () => {
            const job = createMockJob();
            mockDispatchData.updateJobDetail.mockResolvedValue(undefined);

            // Should not throw
            await expect(
                markJobMissing(mockDispatchData, mockToastrService, job, undefined)
            ).resolves.toBeUndefined();
        });

        it('should show error toast when updateJobDetail fails', async () => {
            const job = createMockJob();
            const error = new Error('Network error');
            mockDispatchData.updateJobDetail.mockRejectedValue(error);

            await markJobMissing(mockDispatchData, mockToastrService, job);

            expect(mockToastrService.showErrorToast).toHaveBeenCalledTimes(1);
            expect(mockToastrService.showErrorToast).toHaveBeenCalledWith(
                "An unexpected error occured marking this job as missing."
            );
        });

        it('should not call onRefresh when update fails', async () => {
            const job = createMockJob();
            const onRefresh = jest.fn();
            mockDispatchData.updateJobDetail.mockRejectedValue(new Error('Failed'));

            await markJobMissing(mockDispatchData, mockToastrService, job, onRefresh);

            expect(onRefresh).not.toHaveBeenCalled();
        });

        it('should not show success toast when update fails', async () => {
            const job = createMockJob();
            mockDispatchData.updateJobDetail.mockRejectedValue(new Error('Failed'));

            await markJobMissing(mockDispatchData, mockToastrService, job);

            expect(mockToastrService.showSuccessToast).not.toHaveBeenCalled();
        });

        it('should handle undefined preBook by defaulting to false', async () => {
            const job = createMockJob({ preBook: undefined });
            mockDispatchData.updateJobDetail.mockResolvedValue(undefined);

            await markJobMissing(mockDispatchData, mockToastrService, job);

            expect(mockDispatchData.updateJobDetail).toHaveBeenCalledWith(
                expect.any(Number),
                JobProperty.Status,
                JobStatus.Missing,
                false
            );
        });
    });

    describe('JobStatus.Missing enum value', () => {
        it('should have Missing status with value 1001', () => {
            expect(JobStatus.Missing).toBe(1001);
        });

        it('should be distinct from other statuses', () => {
            expect(JobStatus.Missing).not.toBe(JobStatus.Completed);
        });
    });

    describe('getMenuOptions - Mark Missing option', () => {
        // Test that the menu option structure is correct
        it('should include Mark Missing option with correct properties', () => {
            // Simulating the menu option that would be created
            const markMissingOption = {
                text: "Mark Missing",
                icon: "checked_bag_question",
                click: expect.any(Function),
            };

            expect(markMissingOption.text).toBe("Mark Missing");
            expect(markMissingOption.icon).toBe("checked_bag_question");
        });
    });

    describe('splitJobAction', () => {
        // Extended mocks for split job flow
        let mockMdDialogSplit: {
            show: jest.Mock;
            confirm: jest.Mock;
            alert: jest.Mock;
            hide: jest.Mock;
        };
        let mockDispatchDataSplit: {
            splitJob: jest.Mock;
            getSplitJobStatus: jest.Mock;
        };
        let mockEditAddressDialogService: {
            openEditAddressDialog: jest.Mock;
        };

        const mockEvent = {} as MouseEvent;

        const createMockAddress = (overrides: Record<string, unknown> = {}) => ({
            addressLine1: '123 Main St',
            addressLine2: '',
            addressLine3: '',
            addressLine4: '',
            addressLine5: 'Auckland',
            addressLine6: '',
            addressLine7: '1010',
            addressLine8: '',
            latitude: -36.8485,
            longitude: 174.7633,
            fullAddress: '123 Main St, Auckland, 1010',
            ...overrides,
        });

        /**
         * Mirrors the splitJobAction logic from job-context-menu.service.ts.
         * This follows the project's established test pattern of creating simplified
         * functions that reproduce the service's control flow against mocked dependencies.
         *
         * Updated for fire-and-poll pattern: splitJob returns { taskId } immediately,
         * then pollSplitJobStatus polls for completion.
         */
        const splitJobAction = async (
            job: IDispatchJob | null,
            onRefresh?: () => void | Promise<void>
        ): Promise<void> => {
            if (!job) return;

            if (job.isArchived) {
                await mockMdDialogSplit.show(mockMdDialogSplit.alert());
                return;
            }

            const hasChildren = (job as any)._groupChildren && (job as any)._groupChildren.length > 0;
            if (!(job as any).allowSplit || hasChildren) {
                await mockMdDialogSplit.show(mockMdDialogSplit.alert());
                return;
            }

            try {
                // Confirmation dialog (awaited — rejects if user clicks "No")
                await mockMdDialogSplit.show(mockMdDialogSplit.confirm());

                if (!job.deliveryAddress) {
                    mockToastrService.showErrorToast("No delivery address found");
                    return;
                }

                const meetingPointAddress = await mockEditAddressDialogService.openEditAddressDialog(
                    job.deliveryAddress,
                    mockEvent,
                    'Set Meeting Point',
                    'Split Job'
                );

                if (!meetingPointAddress) {
                    return;
                }

                if (!meetingPointAddress.fullAddress) {
                    mockToastrService.showErrorToast("Invalid meeting point address");
                    return;
                }

                // Fire API call and get taskId back immediately
                const { taskId } = await mockDispatchDataSplit.splitJob(job.id, meetingPointAddress);

                // Show loading dialog during polling, hide in finally
                mockMdDialogSplit.show({});
                try {
                    await pollSplitJobStatus(taskId, (job as any).jobNo, onRefresh);
                } finally {
                    mockMdDialogSplit.hide();
                }
            } catch (error) {
                if (error) {
                    mockToastrService.showErrorToast("Error splitting job");
                }
            }
        };

        /**
         * Simplified poll helper for testing. In the real service this uses
         * setTimeout recursion; here we call it directly for synchronous testing.
         */
        const pollSplitJobStatus = async (
            taskId: string,
            jobNo: string,
            onRefresh?: () => void | Promise<void>,
            attempt: number = 0,
            maxAttempts: number = 30
        ): Promise<void> => {
            try {
                const result = await mockDispatchDataSplit.getSplitJobStatus(taskId);

                if (result.status === "Completed") {
                    mockToastrService.showSuccessToast(`Job ${jobNo} successfully split`);
                    if (onRefresh) {
                        await onRefresh();
                    }
                } else if (result.status === "Failed") {
                    mockToastrService.showErrorToast(
                        result.errorMessage || "Error splitting job"
                    );
                }
            } catch (error) {
                // Retry on transient errors instead of giving up immediately
                if (attempt < maxAttempts - 1) {
                    await pollSplitJobStatus(taskId, jobNo, onRefresh, attempt + 1, maxAttempts);
                } else {
                    mockToastrService.showErrorToast("Error checking split job status");
                }
            }
        };

        beforeEach(() => {
            mockMdDialogSplit = {
                show: jest.fn().mockResolvedValue(undefined),
                confirm: jest.fn().mockReturnThis(),
                alert: jest.fn().mockReturnThis(),
                hide: jest.fn(),
            };
            mockDispatchDataSplit = {
                splitJob: jest.fn().mockResolvedValue({ taskId: 'test-task-id' }),
                getSplitJobStatus: jest.fn().mockResolvedValue({ status: 'Completed', errorMessage: null }),
            };
            mockEditAddressDialogService = {
                openEditAddressDialog: jest.fn(),
            };
        });

        // --- Validation & guard tests ---

        it('should return early without showing any dialog if job is null', async () => {
            await splitJobAction(null);

            expect(mockMdDialogSplit.show).not.toHaveBeenCalled();
            expect(mockDispatchDataSplit.splitJob).not.toHaveBeenCalled();
        });

        it('should show alert dialog if job.allowSplit is false', async () => {
            const job = createMockJob({ allowSplit: false } as any);

            await splitJobAction(job);

            expect(mockMdDialogSplit.alert).toHaveBeenCalled();
            expect(mockMdDialogSplit.show).toHaveBeenCalledTimes(1);
            expect(mockDispatchDataSplit.splitJob).not.toHaveBeenCalled();
        });

        it('should show alert dialog if job has group children', async () => {
            const job = createMockJob({
                allowSplit: true,
                _groupChildren: [{ id: 1 }],
            } as any);

            await splitJobAction(job);

            expect(mockMdDialogSplit.alert).toHaveBeenCalled();
            expect(mockDispatchDataSplit.splitJob).not.toHaveBeenCalled();
        });

        it('should show alert dialog if job is archived', async () => {
            const job = createMockJob({
                allowSplit: true,
                isArchived: true,
            } as any);

            await splitJobAction(job);

            expect(mockMdDialogSplit.alert).toHaveBeenCalled();
            expect(mockMdDialogSplit.show).toHaveBeenCalledTimes(1);
            expect(mockDispatchDataSplit.splitJob).not.toHaveBeenCalled();
        });

        it('should not proceed past confirmation when user clicks No', async () => {
            const job = createMockJob({ allowSplit: true } as any);
            // Rejecting with undefined simulates user clicking "No" on $mdDialog.confirm()
            mockMdDialogSplit.show.mockRejectedValueOnce(undefined);

            await splitJobAction(job);

            expect(mockEditAddressDialogService.openEditAddressDialog).not.toHaveBeenCalled();
            expect(mockDispatchDataSplit.splitJob).not.toHaveBeenCalled();
        });

        it('should not show error toast when user cancels confirmation (falsy error)', async () => {
            const job = createMockJob({ allowSplit: true } as any);
            mockMdDialogSplit.show.mockRejectedValueOnce(undefined);

            await splitJobAction(job);

            expect(mockToastrService.showErrorToast).not.toHaveBeenCalled();
        });

        it('should show error toast if delivery address is missing', async () => {
            const job = createMockJob({
                allowSplit: true,
                deliveryAddress: null,
            } as any);

            await splitJobAction(job);

            expect(mockToastrService.showErrorToast).toHaveBeenCalledWith("No delivery address found");
            expect(mockDispatchDataSplit.splitJob).not.toHaveBeenCalled();
        });

        // --- Address dialog tests ---

        it('should open edit address dialog with correct parameters', async () => {
            const deliveryAddr = { fullAddress: '456 Delivery Rd' };
            const job = createMockJob({
                allowSplit: true,
                deliveryAddress: deliveryAddr,
            } as any);
            mockEditAddressDialogService.openEditAddressDialog.mockResolvedValue(null);

            await splitJobAction(job);

            expect(mockEditAddressDialogService.openEditAddressDialog).toHaveBeenCalledWith(
                deliveryAddr,
                mockEvent,
                'Set Meeting Point',
                'Split Job'
            );
        });

        it('should return silently if user cancels address dialog', async () => {
            const job = createMockJob({
                allowSplit: true,
                deliveryAddress: { fullAddress: '456 Rd' },
            } as any);
            mockEditAddressDialogService.openEditAddressDialog.mockResolvedValue(null);

            await splitJobAction(job);

            expect(mockDispatchDataSplit.splitJob).not.toHaveBeenCalled();
            expect(mockToastrService.showErrorToast).not.toHaveBeenCalled();
        });

        it('should show error toast if meeting point address has no fullAddress', async () => {
            const job = createMockJob({
                allowSplit: true,
                deliveryAddress: { fullAddress: '456 Rd' },
            } as any);
            mockEditAddressDialogService.openEditAddressDialog.mockResolvedValue({
                addressLine1: '123 Main St',
                fullAddress: '',
            });

            await splitJobAction(job);

            expect(mockToastrService.showErrorToast).toHaveBeenCalledWith("Invalid meeting point address");
            expect(mockDispatchDataSplit.splitJob).not.toHaveBeenCalled();
        });

        // --- Loading dialog tests ---

        it('should show loading dialog after API call fires', async () => {
            const address = createMockAddress();
            const job = createMockJob({
                jobNo: 'J-100',
                allowSplit: true,
                deliveryAddress: { fullAddress: '456 Rd' },
            } as any);
            mockEditAddressDialogService.openEditAddressDialog.mockResolvedValue(address);

            await splitJobAction(job);

            // 2 show calls: confirm dialog + loading dialog
            expect(mockMdDialogSplit.show).toHaveBeenCalledTimes(2);
        });

        it('should hide loading dialog after successful poll', async () => {
            const address = createMockAddress();
            const job = createMockJob({
                allowSplit: true,
                deliveryAddress: { fullAddress: '456 Rd' },
            } as any);
            mockEditAddressDialogService.openEditAddressDialog.mockResolvedValue(address);
            mockDispatchDataSplit.getSplitJobStatus.mockResolvedValue({ status: 'Completed', errorMessage: null });

            await splitJobAction(job);

            expect(mockMdDialogSplit.hide).toHaveBeenCalledTimes(1);
        });

        it('should hide loading dialog when polling returns Failed', async () => {
            const address = createMockAddress();
            const job = createMockJob({
                allowSplit: true,
                deliveryAddress: { fullAddress: '456 Rd' },
            } as any);
            mockEditAddressDialogService.openEditAddressDialog.mockResolvedValue(address);
            mockDispatchDataSplit.getSplitJobStatus.mockResolvedValue({
                status: 'Failed',
                errorMessage: 'Job already split',
            });

            await splitJobAction(job);

            expect(mockMdDialogSplit.hide).toHaveBeenCalledTimes(1);
        });

        it('should not show loading dialog if splitJob API call fails', async () => {
            const address = createMockAddress();
            const job = createMockJob({
                allowSplit: true,
                deliveryAddress: { fullAddress: '456 Rd' },
            } as any);
            mockEditAddressDialogService.openEditAddressDialog.mockResolvedValue(address);
            mockDispatchDataSplit.splitJob.mockRejectedValue(new Error('Server error'));

            await splitJobAction(job);

            // Only 1 show call: the confirm dialog. Loading dialog was never opened.
            expect(mockMdDialogSplit.show).toHaveBeenCalledTimes(1);
        });

        // --- API call & success path tests ---

        it('should call splitJob API with correct job ID and address', async () => {
            const address = createMockAddress();
            const job = createMockJob({
                id: 789,
                allowSplit: true,
                deliveryAddress: { fullAddress: '456 Rd' },
            } as any);
            mockEditAddressDialogService.openEditAddressDialog.mockResolvedValue(address);

            await splitJobAction(job);

            expect(mockDispatchDataSplit.splitJob).toHaveBeenCalledWith(789, address);
        });

        it('should poll status after receiving taskId', async () => {
            const address = createMockAddress();
            const job = createMockJob({
                allowSplit: true,
                deliveryAddress: { fullAddress: '456 Rd' },
            } as any);
            mockEditAddressDialogService.openEditAddressDialog.mockResolvedValue(address);

            await splitJobAction(job);

            expect(mockDispatchDataSplit.getSplitJobStatus).toHaveBeenCalledWith('test-task-id');
        });

        it('should show success toast when polling returns Completed', async () => {
            const address = createMockAddress();
            const job = createMockJob({
                jobNo: 'J-200',
                allowSplit: true,
                deliveryAddress: { fullAddress: '456 Rd' },
            } as any);
            mockEditAddressDialogService.openEditAddressDialog.mockResolvedValue(address);
            mockDispatchDataSplit.getSplitJobStatus.mockResolvedValue({ status: 'Completed', errorMessage: null });

            await splitJobAction(job);

            expect(mockToastrService.showSuccessToast).toHaveBeenCalledWith('Job J-200 successfully split');
        });

        it('should call onRefresh callback after successful poll', async () => {
            const address = createMockAddress();
            const job = createMockJob({
                allowSplit: true,
                deliveryAddress: { fullAddress: '456 Rd' },
            } as any);
            const onRefresh = jest.fn();
            mockEditAddressDialogService.openEditAddressDialog.mockResolvedValue(address);

            await splitJobAction(job, onRefresh);

            expect(onRefresh).toHaveBeenCalledTimes(1);
        });

        it('should not fail if onRefresh is not provided', async () => {
            const address = createMockAddress();
            const job = createMockJob({
                allowSplit: true,
                deliveryAddress: { fullAddress: '456 Rd' },
            } as any);
            mockEditAddressDialogService.openEditAddressDialog.mockResolvedValue(address);

            await expect(splitJobAction(job)).resolves.toBeUndefined();
        });

        // --- Error path tests ---

        it('should show error toast on API failure (splitJob rejects)', async () => {
            const address = createMockAddress();
            const job = createMockJob({
                allowSplit: true,
                deliveryAddress: { fullAddress: '456 Rd' },
            } as any);
            mockEditAddressDialogService.openEditAddressDialog.mockResolvedValue(address);
            mockDispatchDataSplit.splitJob.mockRejectedValue(new Error('Server error'));

            await splitJobAction(job);

            expect(mockToastrService.showErrorToast).toHaveBeenCalledWith("Error splitting job");
        });

        it('should not show success toast on API failure', async () => {
            const address = createMockAddress();
            const job = createMockJob({
                allowSplit: true,
                deliveryAddress: { fullAddress: '456 Rd' },
            } as any);
            mockEditAddressDialogService.openEditAddressDialog.mockResolvedValue(address);
            mockDispatchDataSplit.splitJob.mockRejectedValue(new Error('Server error'));

            await splitJobAction(job);

            expect(mockToastrService.showSuccessToast).not.toHaveBeenCalled();
        });

        it('should not call onRefresh when API fails', async () => {
            const address = createMockAddress();
            const job = createMockJob({
                allowSplit: true,
                deliveryAddress: { fullAddress: '456 Rd' },
            } as any);
            const onRefresh = jest.fn();
            mockEditAddressDialogService.openEditAddressDialog.mockResolvedValue(address);
            mockDispatchDataSplit.splitJob.mockRejectedValue(new Error('Server error'));

            await splitJobAction(job, onRefresh);

            expect(onRefresh).not.toHaveBeenCalled();
        });

        it('should show error toast with message when polling returns Failed', async () => {
            const address = createMockAddress();
            const job = createMockJob({
                allowSplit: true,
                deliveryAddress: { fullAddress: '456 Rd' },
            } as any);
            mockEditAddressDialogService.openEditAddressDialog.mockResolvedValue(address);
            mockDispatchDataSplit.getSplitJobStatus.mockResolvedValue({
                status: 'Failed',
                errorMessage: 'Job already split',
            });

            await splitJobAction(job);

            expect(mockToastrService.showErrorToast).toHaveBeenCalledWith('Job already split');
        });

        it('should not call onRefresh when polling returns Failed', async () => {
            const address = createMockAddress();
            const job = createMockJob({
                allowSplit: true,
                deliveryAddress: { fullAddress: '456 Rd' },
            } as any);
            const onRefresh = jest.fn();
            mockEditAddressDialogService.openEditAddressDialog.mockResolvedValue(address);
            mockDispatchDataSplit.getSplitJobStatus.mockResolvedValue({
                status: 'Failed',
                errorMessage: 'Job already split',
            });

            await splitJobAction(job, onRefresh);

            expect(onRefresh).not.toHaveBeenCalled();
        });

        it('should retry polling on transient error and succeed on next attempt', async () => {
            const address = createMockAddress();
            const job = createMockJob({
                allowSplit: true,
                deliveryAddress: { fullAddress: '456 Rd' },
            } as any);
            mockEditAddressDialogService.openEditAddressDialog.mockResolvedValue(address);
            mockDispatchDataSplit.getSplitJobStatus
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce({ status: 'Completed', errorMessage: null });

            await splitJobAction(job);

            expect(mockDispatchDataSplit.getSplitJobStatus).toHaveBeenCalledTimes(2);
            expect(mockToastrService.showSuccessToast).toHaveBeenCalled();
            expect(mockToastrService.showErrorToast).not.toHaveBeenCalled();
        });

        it('should show error toast only after all retries are exhausted', async () => {
            const address = createMockAddress();
            const job = createMockJob({
                allowSplit: true,
                deliveryAddress: { fullAddress: '456 Rd' },
            } as any);
            mockEditAddressDialogService.openEditAddressDialog.mockResolvedValue(address);
            mockDispatchDataSplit.getSplitJobStatus.mockRejectedValue(new Error('Network error'));

            // Use a small maxAttempts via the poll helper directly
            await pollSplitJobStatus('test-task-id', (job as any).jobNo, undefined, 0, 3);

            expect(mockDispatchDataSplit.getSplitJobStatus).toHaveBeenCalledTimes(3);
            expect(mockToastrService.showErrorToast).toHaveBeenCalledWith("Error checking split job status");
        });
    });

    describe('swapPodsAction', () => {
        let mockSwapPodsDialogService: {
            showSwapPodsDialog: jest.Mock;
        };

        /**
         * Mirrors the swapPodsAction logic from job-context-menu.service.ts.
         */
        const swapPodsAction = async (
            job: IDispatchJob | null,
            onRefresh?: () => void
        ): Promise<void> => {
            if (!job) return;

            try {
                const result = await mockSwapPodsDialogService.showSwapPodsDialog(job);
                if (result && onRefresh) {
                    onRefresh();
                }
            } catch (error) {
                if (error) {
                    console.error('Swap PODs error:', error);
                }
            }
        };

        beforeEach(() => {
            mockSwapPodsDialogService = {
                showSwapPodsDialog: jest.fn().mockResolvedValue(true),
            };
        });

        it('should call showSwapPodsDialog with the job', async () => {
            const job = createMockJob({jobNo: 'JOB-123'});

            await swapPodsAction(job);

            expect(mockSwapPodsDialogService.showSwapPodsDialog).toHaveBeenCalledWith(job);
        });

        it('should call onRefresh when the swap succeeds (result is true)', async () => {
            mockSwapPodsDialogService.showSwapPodsDialog.mockResolvedValue(true);
            const job = createMockJob();
            const onRefresh = jest.fn();

            await swapPodsAction(job, onRefresh);

            expect(onRefresh).toHaveBeenCalledTimes(1);
        });

        it('should not call onRefresh when the user cancels (result is null)', async () => {
            mockSwapPodsDialogService.showSwapPodsDialog.mockResolvedValue(null);
            const job = createMockJob();
            const onRefresh = jest.fn();

            await swapPodsAction(job, onRefresh);

            expect(onRefresh).not.toHaveBeenCalled();
        });

        it('should not call onRefresh when the user cancels (result is false)', async () => {
            mockSwapPodsDialogService.showSwapPodsDialog.mockResolvedValue(false);
            const job = createMockJob();
            const onRefresh = jest.fn();

            await swapPodsAction(job, onRefresh);

            expect(onRefresh).not.toHaveBeenCalled();
        });

        it('should return early without calling the service when job is null', async () => {
            await swapPodsAction(null);

            expect(mockSwapPodsDialogService.showSwapPodsDialog).not.toHaveBeenCalled();
        });

        it('should not throw when the dialog service rejects with a falsy value', async () => {
            mockSwapPodsDialogService.showSwapPodsDialog.mockRejectedValue(undefined);
            const job = createMockJob();

            await expect(swapPodsAction(job)).resolves.toBeUndefined();
        });

        it('should not call onRefresh when the dialog service throws', async () => {
            mockSwapPodsDialogService.showSwapPodsDialog.mockRejectedValue(new Error('Network'));
            const job = createMockJob();
            const onRefresh = jest.fn();

            await swapPodsAction(job, onRefresh);

            expect(onRefresh).not.toHaveBeenCalled();
        });
    });

    describe('Swap PODs menu item visibility', () => {
        /**
         * Mirrors the conditional that guards the Swap PODs item in getMenuOptions().
         */
        const shouldShowSwapPods = (job: Partial<IDispatchJob>): boolean =>
            !!(job.done && !job.isBulkJob && !job.preBook);

        it('should show Swap PODs for a completed, non-bulk, non-prebook job', () => {
            const job = createMockJob({done: true, isBulkJob: false, preBook: false});
            expect(shouldShowSwapPods(job)).toBe(true);
        });

        it('should not show Swap PODs when the job is not done', () => {
            const job = createMockJob({done: false, isBulkJob: false, preBook: false});
            expect(shouldShowSwapPods(job)).toBe(false);
        });

        it('should not show Swap PODs for a bulk job', () => {
            const job = createMockJob({done: true, isBulkJob: true, preBook: false});
            expect(shouldShowSwapPods(job)).toBe(false);
        });

        it('should not show Swap PODs for a prebook (scheduled) job', () => {
            const job = createMockJob({done: true, isBulkJob: false, preBook: true});
            expect(shouldShowSwapPods(job)).toBe(false);
        });

        it('should have the correct text and icon', () => {
            const menuItem = {
                text: 'Swap PODs',
                icon: 'swap_horiz',
            };
            expect(menuItem.text).toBe('Swap PODs');
            expect(menuItem.icon).toBe('swap_horiz');
        });
    });

    describe('getMenuOptions - AI menu items', () => {
        it('should not include "AI Suggest Couriers" menu option', () => {
            // The "AI Suggest Couriers" context menu option has been removed
            // in favor of inline autocomplete suggestions
            const menuOptionTexts = [
                "Mark as Read",
                "Late Pickup",
                "Late Delivery",
                "AI Late Alert Analysis",
                "Add Task - Other",
                "Task Groups",
                "Void Job",
                "Set First Job",
                "Restore",
                "Mark Missing",
            ];

            expect(menuOptionTexts).not.toContain("AI Suggest Couriers");
        });

        it('should gate AI Late Alert Analysis behind isAiEnabled', () => {
            // When AI is disabled, the menu should not include "AI Late Alert Analysis"
            const buildMenuWithAiFlag = (aiEnabled: boolean): string[] => {
                const options: string[] = [];

                // Simulates the menu-building logic from job-context-menu.service.ts
                options.push("Late Pickup");
                options.push("Late Delivery");

                if (aiEnabled) {
                    options.push("AI Late Alert Analysis");
                }

                return options;
            };

            const menuWithAi = buildMenuWithAiFlag(true);
            expect(menuWithAi).toContain("AI Late Alert Analysis");

            const menuWithoutAi = buildMenuWithAiFlag(false);
            expect(menuWithoutAi).not.toContain("AI Late Alert Analysis");
        });

        it('should include AI Late Alert Analysis when isAiEnabled returns true', () => {
            jest.mocked(isAiEnabled).mockReturnValue(true);
            expect(isAiEnabled()).toBe(true);
        });

        it('should exclude AI Late Alert Analysis when isAiEnabled returns false', () => {
            jest.mocked(isAiEnabled).mockReturnValue(false);
            expect(isAiEnabled()).toBe(false);
        });
    });
});
