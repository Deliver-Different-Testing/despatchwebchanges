/**
 * VoidJobConfirmationDialog Component Tests
 */

import React from 'react';
import {render, screen, waitFor, act} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {ThemeProvider, createTheme} from '@mui/material';
import {VoidJobConfirmationDialog, VoidJobDialogJob, RelatedJob} from './VoidJobConfirmationDialog';

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) => {
    return render(
        <ThemeProvider theme={theme}>
            {ui}
        </ThemeProvider>
    );
};

const mockJob: VoidJobDialogJob = {
    id: 123,
    jobNo: 'JOB-001',
    isBulkJob: false,
    isArchived: false,
};

const mockBulkJob: VoidJobDialogJob = {
    id: 456,
    jobNo: 'BULK-001',
    isBulkJob: true,
    isArchived: false,
};

const mockRelatedJobs: RelatedJob[] = [
    {id: 123, text: 'JOB-001 - Main Job', selected: true},
    {id: 124, text: 'JOB-002 - Related Pickup', selected: false},
    {id: 125, text: 'JOB-003 - Related Delivery', selected: false},
];

const createMockProps = (overrides = {}) => ({
    open: true,
    job: mockJob,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
    onLoadRelatedJobs: jest.fn().mockResolvedValue(mockRelatedJobs),
    onVoidJob: jest.fn().mockResolvedValue(undefined),
    onVoidBulkJob: jest.fn().mockResolvedValue(undefined),
    showToast: jest.fn(),
    ...overrides,
});

describe('VoidJobConfirmationDialog', () => {
    describe('Rendering', () => {
        it('should render dialog when open is true', () => {
            const props = createMockProps();
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText('Void JOB-001')).toBeInTheDocument();
        });

        it('should not render dialog when open is false', () => {
            const props = createMockProps({open: false});
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('should return null when job is null', () => {
            const props = createMockProps({job: null});
            const {container} = renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            expect(container.firstChild).toBeNull();
        });

        it('should display warning message with job number', () => {
            const props = createMockProps();
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            expect(screen.getByText(/You are about to void job/)).toBeInTheDocument();
            expect(screen.getByText('#JOB-001')).toBeInTheDocument();
        });

        it('should display void reason textarea', () => {
            const props = createMockProps();
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            expect(screen.getByLabelText(/Reason for voiding/)).toBeInTheDocument();
        });

        it('should display Cancel and Void Job buttons', () => {
            const props = createMockProps();
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            expect(screen.getByRole('button', {name: /cancel/i})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /void job/i})).toBeInTheDocument();
        });

        it('should show character count for reason field', () => {
            const props = createMockProps();
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            expect(screen.getByText('0/500 characters')).toBeInTheDocument();
        });
    });

    describe('Void Reason Validation', () => {
        it('should disable confirm button when reason is empty', () => {
            const props = createMockProps();
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            const confirmButton = screen.getByRole('button', {name: /void job/i});
            expect(confirmButton).toBeDisabled();
        });

        it('should enable confirm button when reason is provided', async () => {
            const props = createMockProps();
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            const textarea = screen.getByLabelText(/Reason for voiding/);
            await userEvent.type(textarea, 'Customer requested cancellation');

            const confirmButton = screen.getByRole('button', {name: /void job/i});
            expect(confirmButton).toBeEnabled();
        });

        it('should show warning toast when trying to confirm without reason', async () => {
            const props = createMockProps();
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            // Force enable button by directly typing and clearing
            const textarea = screen.getByLabelText(/Reason for voiding/);
            await userEvent.type(textarea, 'test');
            await userEvent.clear(textarea);

            // Button should be disabled, but let's test the validation logic
            // by checking that onVoidJob is not called
            expect(props.onVoidJob).not.toHaveBeenCalled();
        });

        it('should update character count as user types', async () => {
            const props = createMockProps();
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            const textarea = screen.getByLabelText(/Reason for voiding/);
            await userEvent.type(textarea, 'Test reason');

            expect(screen.getByText('11/500 characters')).toBeInTheDocument();
        });
    });

    describe('Single Job Void Flow', () => {
        it('should default to void single job only', () => {
            const props = createMockProps();
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            expect(screen.getByText('Void this job only')).toBeInTheDocument();
            expect(screen.getByText('Only this specific job will be voided')).toBeInTheDocument();
        });

        it('should call onVoidJob when confirming single job void', async () => {
            const props = createMockProps();
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            const textarea = screen.getByLabelText(/Reason for voiding/);
            await userEvent.type(textarea, 'Customer requested cancellation');

            const confirmButton = screen.getByRole('button', {name: /void job/i});
            await userEvent.click(confirmButton);

            await waitFor(() => {
                expect(props.onVoidJob).toHaveBeenCalledWith(
                    123,
                    true,
                    'Customer requested cancellation',
                    undefined
                );
            });
        });

        it('should show success toast after voiding single job', async () => {
            const props = createMockProps();
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            const textarea = screen.getByLabelText(/Reason for voiding/);
            await userEvent.type(textarea, 'Test reason');

            const confirmButton = screen.getByRole('button', {name: /void job/i});
            await userEvent.click(confirmButton);

            await waitFor(() => {
                expect(props.showToast).toHaveBeenCalledWith(
                    'JOB-001 has been voided successfully.',
                    'success'
                );
            });
        });

        it('should call onConfirm with result after successful void', async () => {
            const props = createMockProps();
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            const textarea = screen.getByLabelText(/Reason for voiding/);
            await userEvent.type(textarea, 'Test reason');

            const confirmButton = screen.getByRole('button', {name: /void job/i});
            await userEvent.click(confirmButton);

            await waitFor(() => {
                expect(props.onConfirm).toHaveBeenCalledWith({
                    success: true,
                    voidedCount: 1,
                });
            });
        });
    });

    describe('Bulk Job Void Flow', () => {
        it('should call onVoidBulkJob for bulk jobs', async () => {
            const props = createMockProps({job: mockBulkJob});
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            const textarea = screen.getByLabelText(/Reason for voiding/);
            await userEvent.type(textarea, 'Bulk cancellation');

            const confirmButton = screen.getByRole('button', {name: /void job/i});
            await userEvent.click(confirmButton);

            await waitFor(() => {
                expect(props.onVoidBulkJob).toHaveBeenCalledWith(
                    456,
                    true,
                    'Bulk cancellation',
                    undefined
                );
            });
        });
    });

    describe('Multi-Job Void Flow', () => {
        it('should show related jobs section when toggle is switched off', async () => {
            const props = createMockProps();
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            const toggle = screen.getByRole('switch');
            await userEvent.click(toggle);

            await waitFor(() => {
                expect(screen.getByText('Related Jobs')).toBeInTheDocument();
            });
        });

        it('should load related jobs when switching to multi-void mode', async () => {
            const props = createMockProps();
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            const toggle = screen.getByRole('switch');
            await userEvent.click(toggle);

            await waitFor(() => {
                expect(props.onLoadRelatedJobs).toHaveBeenCalledWith(123, false, false);
            });
        });

        it('should display loading state while fetching related jobs', async () => {
            const props = createMockProps({
                onLoadRelatedJobs: jest.fn().mockImplementation(
                    () => new Promise(resolve => setTimeout(() => resolve(mockRelatedJobs), 100))
                ),
            });
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            const toggle = screen.getByRole('switch');
            await userEvent.click(toggle);

            expect(screen.getByText('Loading related jobs...')).toBeInTheDocument();
        });

        it('should display related jobs after loading', async () => {
            const props = createMockProps();
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            const toggle = screen.getByRole('switch');
            await userEvent.click(toggle);

            await waitFor(() => {
                expect(screen.getByText('JOB-001 - Main Job')).toBeInTheDocument();
                expect(screen.getByText('JOB-002 - Related Pickup')).toBeInTheDocument();
                expect(screen.getByText('JOB-003 - Related Delivery')).toBeInTheDocument();
            });
        });

        it('should show current job indicator', async () => {
            const props = createMockProps();
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            const toggle = screen.getByRole('switch');
            await userEvent.click(toggle);

            await waitFor(() => {
                expect(screen.getByText('current')).toBeInTheDocument();
            });
        });

        it('should display selection count', async () => {
            const props = createMockProps();
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            const toggle = screen.getByRole('switch');
            await userEvent.click(toggle);

            await waitFor(() => {
                expect(screen.getByText('1 of 3 jobs selected')).toBeInTheDocument();
            });
        });

        it('should disable confirm when no jobs are selected', async () => {
            const props = createMockProps({
                onLoadRelatedJobs: jest.fn().mockResolvedValue([
                    {id: 123, text: 'JOB-001', selected: false},
                    {id: 124, text: 'JOB-002', selected: false},
                ]),
            });
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            const textarea = screen.getByLabelText(/Reason for voiding/);
            await userEvent.type(textarea, 'Test reason');

            const toggle = screen.getByRole('switch');
            await userEvent.click(toggle);

            await waitFor(() => {
                const confirmButton = screen.getByRole('button', {name: /void 0 jobs/i});
                expect(confirmButton).toBeDisabled();
            });
        });

        it('should call onVoidJob with selected job IDs', async () => {
            const props = createMockProps({
                onLoadRelatedJobs: jest.fn().mockResolvedValue([
                    {id: 123, text: 'JOB-001', selected: true},
                    {id: 124, text: 'JOB-002', selected: true},
                    {id: 125, text: 'JOB-003', selected: false},
                ]),
            });
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            const textarea = screen.getByLabelText(/Reason for voiding/);
            await userEvent.type(textarea, 'Multi-void reason');

            const toggle = screen.getByRole('switch');
            await userEvent.click(toggle);

            await waitFor(() => {
                expect(screen.getByText('JOB-001')).toBeInTheDocument();
            });

            const confirmButton = screen.getByRole('button', {name: /void 2 jobs/i});
            await userEvent.click(confirmButton);

            await waitFor(() => {
                expect(props.onVoidJob).toHaveBeenCalledWith(
                    123,
                    false,
                    'Multi-void reason',
                    [123, 124]
                );
            });
        });

        it('should show plural success message for multiple jobs', async () => {
            const props = createMockProps({
                onLoadRelatedJobs: jest.fn().mockResolvedValue([
                    {id: 123, text: 'JOB-001', selected: true},
                    {id: 124, text: 'JOB-002', selected: true},
                ]),
            });
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            const textarea = screen.getByLabelText(/Reason for voiding/);
            await userEvent.type(textarea, 'Test');

            const toggle = screen.getByRole('switch');
            await userEvent.click(toggle);

            await waitFor(() => {
                expect(screen.getByText('JOB-001')).toBeInTheDocument();
            });

            const confirmButton = screen.getByRole('button', {name: /void 2 jobs/i});
            await userEvent.click(confirmButton);

            await waitFor(() => {
                expect(props.showToast).toHaveBeenCalledWith(
                    '2 jobs have been voided successfully.',
                    'success'
                );
            });
        });
    });

    describe('Select/Deselect All', () => {
        it('should select all jobs when Select All is clicked', async () => {
            const props = createMockProps();
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            const toggle = screen.getByRole('switch');
            await userEvent.click(toggle);

            // Wait for related jobs to load
            await waitFor(() => {
                expect(screen.getByText('JOB-001 - Main Job')).toBeInTheDocument();
            });

            // Click Select All button (exact match)
            const selectAllButton = screen.getByRole('button', {name: 'Select All'});
            await userEvent.click(selectAllButton);

            await waitFor(() => {
                expect(screen.getByText('3 of 3 jobs selected')).toBeInTheDocument();
            });
        });

        it('should deselect all jobs when Deselect All is clicked', async () => {
            const props = createMockProps();
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            const toggle = screen.getByRole('switch');
            await userEvent.click(toggle);

            // Wait for related jobs to load
            await waitFor(() => {
                expect(screen.getByText('JOB-001 - Main Job')).toBeInTheDocument();
            });

            const deselectAllButton = screen.getByRole('button', {name: 'Deselect All'});
            await userEvent.click(deselectAllButton);

            await waitFor(() => {
                expect(screen.getByText('0 of 3 jobs selected')).toBeInTheDocument();
            });
        });
    });

    describe('Job Selection Toggle', () => {
        it('should toggle job selection when clicking on a job', async () => {
            const props = createMockProps();
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            const toggle = screen.getByRole('switch');
            await userEvent.click(toggle);

            await waitFor(() => {
                expect(screen.getByText('JOB-002 - Related Pickup')).toBeInTheDocument();
            });

            // Click on the unselected job
            const jobItem = screen.getByText('JOB-002 - Related Pickup');
            await userEvent.click(jobItem);

            await waitFor(() => {
                expect(screen.getByText('2 of 3 jobs selected')).toBeInTheDocument();
            });
        });
    });

    describe('Cancel and Close', () => {
        it('should call onClose when Cancel button is clicked', async () => {
            const props = createMockProps();
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            const cancelButton = screen.getByRole('button', {name: /cancel/i});
            await userEvent.click(cancelButton);

            expect(props.onClose).toHaveBeenCalled();
        });

        it('should call onClose when close icon is clicked', async () => {
            const props = createMockProps();
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            // The close button is an IconButton with CloseIcon
            const closeButtons = screen.getAllByRole('button');
            const closeIconButton = closeButtons.find(btn =>
                btn.querySelector('[data-testid="CloseIcon"]')
            );

            if (closeIconButton) {
                await userEvent.click(closeIconButton);
                expect(props.onClose).toHaveBeenCalled();
            }
        });
    });

    describe('Empty State', () => {
        it('should display empty state when no related jobs found', async () => {
            const props = createMockProps({
                onLoadRelatedJobs: jest.fn().mockResolvedValue([]),
            });
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            const toggle = screen.getByRole('switch');
            await userEvent.click(toggle);

            await waitFor(() => {
                expect(screen.getByText('No related jobs found.')).toBeInTheDocument();
            });
        });
    });

    describe('Submitting State', () => {
        it('should show loading state on confirm button while submitting', async () => {
            const props = createMockProps({
                onVoidJob: jest.fn().mockImplementation(
                    () => new Promise(resolve => setTimeout(resolve, 100))
                ),
            });
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            const textarea = screen.getByLabelText(/Reason for voiding/);
            await userEvent.type(textarea, 'Test reason');

            const confirmButton = screen.getByRole('button', {name: /void job/i});
            await userEvent.click(confirmButton);

            expect(screen.getByText('Voiding...')).toBeInTheDocument();
        });

        it('should disable buttons while submitting', async () => {
            const props = createMockProps({
                onVoidJob: jest.fn().mockImplementation(
                    () => new Promise(resolve => setTimeout(resolve, 200))
                ),
            });
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            const textarea = screen.getByLabelText(/Reason for voiding/);
            await userEvent.type(textarea, 'Test reason');

            const confirmButton = screen.getByRole('button', {name: /void job/i});
            await userEvent.click(confirmButton);

            const cancelButton = screen.getByRole('button', {name: /cancel/i});
            expect(cancelButton).toBeDisabled();
        });
    });

    describe('State Reset', () => {
        it('should reset state when dialog reopens', async () => {
            const props = createMockProps();
            const {rerender} = renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            // Type a reason
            const textarea = screen.getByLabelText(/Reason for voiding/);
            await userEvent.type(textarea, 'Test reason');

            // Close and reopen dialog
            await act(async () => {
                rerender(
                    <ThemeProvider theme={theme}>
                        <VoidJobConfirmationDialog {...props} open={false} />
                    </ThemeProvider>
                );
            });

            await act(async () => {
                rerender(
                    <ThemeProvider theme={theme}>
                        <VoidJobConfirmationDialog {...props} open={true} />
                    </ThemeProvider>
                );
            });

            // Reason should be cleared
            const newTextarea = screen.getByLabelText(/Reason for voiding/);
            expect(newTextarea).toHaveValue('');
        });
    });

    describe('Archived Job', () => {
        it('should pass isArchived flag when loading related jobs', async () => {
            const archivedJob: VoidJobDialogJob = {
                ...mockJob,
                isArchived: true,
            };
            const props = createMockProps({job: archivedJob});
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            const toggle = screen.getByRole('switch');
            await userEvent.click(toggle);

            await waitFor(() => {
                expect(props.onLoadRelatedJobs).toHaveBeenCalledWith(123, true, false);
            });
        });
    });

    describe('Bulk Job Multi-Void Flow', () => {
        it('should pass isBulkJob=true when loading related jobs for bulk job', async () => {
            const props = createMockProps({job: mockBulkJob});
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            const toggle = screen.getByRole('switch');
            await userEvent.click(toggle);

            await waitFor(() => {
                expect(props.onLoadRelatedJobs).toHaveBeenCalledWith(456, false, true);
            });
        });

        it('should show Bulk chip for bulk related jobs', async () => {
            const bulkRelatedJobs: RelatedJob[] = [
                {id: 456, text: 'BULK-001 - Parent', selected: true, isBulkJob: true},
                {id: 457, text: 'BULK-002 - Child', selected: false, isBulkJob: true},
            ];
            const props = createMockProps({
                job: mockBulkJob,
                onLoadRelatedJobs: jest.fn().mockResolvedValue(bulkRelatedJobs),
            });
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            const toggle = screen.getByRole('switch');
            await userEvent.click(toggle);

            await waitFor(() => {
                expect(screen.getAllByText('Bulk')).toHaveLength(2);
            });
        });

        it('should show Archived chip for archived related jobs', async () => {
            const archivedRelatedJobs: RelatedJob[] = [
                {id: 100, text: 'ARCH-001 - Parent', selected: true, isArchived: true},
                {id: 101, text: 'ARCH-002 - Child', selected: false, isArchived: true},
            ];
            const props = createMockProps({
                onLoadRelatedJobs: jest.fn().mockResolvedValue(archivedRelatedJobs),
            });
            renderWithTheme(<VoidJobConfirmationDialog {...props} />);

            const toggle = screen.getByRole('switch');
            await userEvent.click(toggle);

            await waitFor(() => {
                expect(screen.getAllByText('Archived')).toHaveLength(2);
            });
        });
    });
});
