/**
 * VoidJobConfirmationDialog Component Tests
 *
 * Optimised: read-only tests consolidated; fireEvent for simple interactions.
 */

import React from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import { setupUser } from '../../../__testUtils__/setupUser';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {RelatedJob, VoidJobConfirmationDialog, VoidJobDialogJob} from './VoidJobConfirmationDialog';

// Shared fast userEvent instance (see setupUser).
const userEvent = setupUser();

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) =>
    render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

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
    // ── Rendering + validation + cancel (single render) ─────────────
    it('renders dialog with all elements, validates reason, and supports cancel/close', async () => {
        const props = createMockProps();
        renderWithTheme(<VoidJobConfirmationDialog {...props} />);

        // Dialog structure
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Void JOB-001')).toBeInTheDocument();
        expect(screen.getByText(/You are about to void job/)).toBeInTheDocument();
        expect(screen.getByText('#JOB-001')).toBeInTheDocument();
        expect(screen.getByLabelText(/Reason for voiding/)).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /cancel/i})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /void job/i})).toBeInTheDocument();
        expect(screen.getByText('0/500 characters')).toBeInTheDocument();
        expect(screen.getByText('Void this job only')).toBeInTheDocument();
        expect(screen.getByText('Only this specific job will be voided')).toBeInTheDocument();

        // Void button disabled when reason empty
        expect(screen.getByRole('button', {name: /void job/i})).toBeDisabled();

        // Type reason → enables button, shows character count
        fireEvent.change(screen.getByLabelText(/Reason for voiding/), {target: {value: 'Customer requested'}});
        expect(screen.getByRole('button', {name: /void job/i})).toBeEnabled();
        expect(screen.getByText('18/500 characters')).toBeInTheDocument();

        // Cancel
        await userEvent.click(screen.getByRole('button', {name: /cancel/i}));
        expect(props.onClose).toHaveBeenCalledTimes(1);

        // Close icon
        props.onClose.mockClear();
        const closeIconButton = screen.getAllByRole('button').find(btn =>
            btn.querySelector('[data-testid="CloseIcon"]')
        );
        if (closeIconButton) {
            await userEvent.click(closeIconButton);
            expect(props.onClose).toHaveBeenCalledTimes(1);
        }
    });

    // ── Closed / null job (single render with rerender) ─────────────
    it('does not render when closed or job is null', () => {
        const props = createMockProps({open: false});
        const {rerender, container} = renderWithTheme(<VoidJobConfirmationDialog {...props} />);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        rerender(<ThemeProvider theme={theme}><VoidJobConfirmationDialog {...createMockProps({job: null})} /></ThemeProvider>);
        expect(container.firstChild).toBeNull();
    });

    // ── Single void + submitting state (single render) ──────────────
    it('shows loading state during submission, then completes with success toast', async () => {
        let resolveVoid!: () => void;
        const voidPromise = new Promise<void>(resolve => { resolveVoid = resolve; });

        const props = createMockProps({
            onVoidJob: jest.fn().mockReturnValue(voidPromise),
        });
        renderWithTheme(<VoidJobConfirmationDialog {...props} />);

        fireEvent.change(screen.getByLabelText(/Reason for voiding/), {target: {value: 'Customer requested cancellation'}});
        await userEvent.click(screen.getByRole('button', {name: /void job/i}));

        // Submitting state
        expect(screen.getByText('Voiding...')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /cancel/i})).toBeDisabled();

        // Resolve
        await act(async () => { resolveVoid(); });

        await waitFor(() => {
            expect(props.onVoidJob).toHaveBeenCalledWith(123, true, 'Customer requested cancellation', undefined);
            expect(props.showToast).toHaveBeenCalledWith('JOB-001 has been voided successfully.', 'success');
            expect(props.onConfirm).toHaveBeenCalledWith({success: true, voidedCount: 1});
        });
    });

    // ── Bulk job void + chips (single render) ───────────────────────
    it('voids bulk jobs and shows Bulk chips for bulk related jobs', async () => {
        const bulkRelatedJobs: RelatedJob[] = [
            {id: 456, text: 'BULK-001 - Parent', selected: true, isBulkJob: true},
            {id: 457, text: 'BULK-002 - Child', selected: false, isBulkJob: true},
        ];
        const props = createMockProps({
            job: mockBulkJob,
            onLoadRelatedJobs: jest.fn().mockResolvedValue(bulkRelatedJobs),
        });
        renderWithTheme(<VoidJobConfirmationDialog {...props} />);

        // Void bulk job (single mode)
        fireEvent.change(screen.getByLabelText(/Reason for voiding/), {target: {value: 'Bulk cancellation'}});

        // Toggle to multi-void to check bulk chips
        await userEvent.click(screen.getByRole('switch'));

        await waitFor(() => {
            expect(props.onLoadRelatedJobs).toHaveBeenCalledWith(456, false, true);
        });
        expect(await screen.findAllByText('Bulk')).toHaveLength(2);

        // Void in single mode (click switch back)
        await userEvent.click(screen.getByRole('switch'));
        await userEvent.click(screen.getByRole('button', {name: /void job/i}));

        await waitFor(() => {
            expect(props.onVoidBulkJob).toHaveBeenCalledWith(456, true, 'Bulk cancellation', undefined);
        });
    });

    // ── Multi-job flow + select/deselect all + toggle job (single render) ─
    it('shows related jobs, supports select/deselect all, and toggles individual jobs', async () => {
        const props = createMockProps();
        renderWithTheme(<VoidJobConfirmationDialog {...props} />);

        await userEvent.click(screen.getByRole('switch'));

        expect(await screen.findByText('Related Jobs')).toBeInTheDocument();
        expect(await screen.findByText('1 of 3 jobs selected')).toBeInTheDocument();
        expect(await screen.findByText('current')).toBeInTheDocument();

        await waitFor(() => {
            expect(props.onLoadRelatedJobs).toHaveBeenCalledWith(123, false, false);
            expect(screen.getByText('JOB-001 - Main Job')).toBeInTheDocument();
            expect(screen.getByText('JOB-002 - Related Pickup')).toBeInTheDocument();
            expect(screen.getByText('JOB-003 - Related Delivery')).toBeInTheDocument();
        });

        // Select All
        await userEvent.click(screen.getByRole('button', {name: 'Select All'}));
        expect(await screen.findByText('3 of 3 jobs selected')).toBeInTheDocument();

        // Deselect All
        await userEvent.click(screen.getByRole('button', {name: 'Deselect All'}));
        expect(await screen.findByText('0 of 3 jobs selected')).toBeInTheDocument();

        // Toggle individual job
        await userEvent.click(screen.getByText('JOB-002 - Related Pickup'));
        expect(await screen.findByText('1 of 3 jobs selected')).toBeInTheDocument();
    });

    // ── Loading + empty related jobs (single render) ────────────────
    it('shows loading state then empty state for related jobs', async () => {
        let resolveLoad!: (value: RelatedJob[]) => void;
        const loadPromise = new Promise<RelatedJob[]>(resolve => {
            resolveLoad = resolve;
        });

        const props = createMockProps({onLoadRelatedJobs: jest.fn().mockReturnValue(loadPromise)});
        renderWithTheme(<VoidJobConfirmationDialog {...props} />);

        await userEvent.click(screen.getByRole('switch'));

        expect(await screen.findByText('Loading related jobs...')).toBeInTheDocument();

        // Resolve with empty list
        await act(async () => {
            resolveLoad([]);
        });

        expect(await screen.findByText('No related jobs found.')).toBeInTheDocument();
    });

    // ── No jobs selected → disabled ─────────────────────────────────
    it('disables confirm when no jobs are selected', async () => {
        const props = createMockProps({
            onLoadRelatedJobs: jest.fn().mockResolvedValue([
                {id: 123, text: 'JOB-001', selected: false},
                {id: 124, text: 'JOB-002', selected: false},
            ]),
        });
        renderWithTheme(<VoidJobConfirmationDialog {...props} />);

        fireEvent.change(screen.getByLabelText(/Reason for voiding/), {target: {value: 'Test reason'}});
        await userEvent.click(screen.getByRole('switch'));

        await waitFor(() => {
            expect(screen.getByRole('button', {name: /void 0 jobs/i})).toBeDisabled();
        });
    });

    // ── Multi-void confirm ──────────────────────────────────────────
    it('calls onVoidJob with selected job IDs and shows plural success message', async () => {
        const props = createMockProps({
            onLoadRelatedJobs: jest.fn().mockResolvedValue([
                {id: 123, text: 'JOB-001', selected: true},
                {id: 124, text: 'JOB-002', selected: true},
                {id: 125, text: 'JOB-003', selected: false},
            ]),
        });
        renderWithTheme(<VoidJobConfirmationDialog {...props} />);

        fireEvent.change(screen.getByLabelText(/Reason for voiding/), {target: {value: 'Multi-void reason'}});
        await userEvent.click(screen.getByRole('switch'));

        expect(await screen.findByText('JOB-001')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: /void 2 jobs/i}));

        await waitFor(() => {
            expect(props.onVoidJob).toHaveBeenCalledWith(123, false, 'Multi-void reason', [123, 124]);
            expect(props.showToast).toHaveBeenCalledWith('2 jobs have been voided successfully.', 'success');
        });
    });

    // ── State Reset ─────────────────────────────────────────────────
    it('resets state when dialog reopens', async () => {
        const props = createMockProps();
        const {rerender} = renderWithTheme(<VoidJobConfirmationDialog {...props} />);

        fireEvent.change(screen.getByLabelText(/Reason for voiding/), {target: {value: 'Test reason'}});

        await act(async () => {
            rerender(<ThemeProvider theme={theme}><VoidJobConfirmationDialog {...props}
                                                                             open={false}/></ThemeProvider>);
        });
        await act(async () => {
            rerender(<ThemeProvider theme={theme}><VoidJobConfirmationDialog {...props}
                                                                             open={true}/></ThemeProvider>);
        });

        expect(screen.getByLabelText(/Reason for voiding/)).toHaveValue('');
    });

    // ── Archived Job ────────────────────────────────────────────────
    it('passes isArchived flag when loading related jobs', async () => {
        const props = createMockProps({job: {...mockJob, isArchived: true}});
        renderWithTheme(<VoidJobConfirmationDialog {...props} />);

        await userEvent.click(screen.getByRole('switch'));

        await waitFor(() => {
            expect(props.onLoadRelatedJobs).toHaveBeenCalledWith(123, true, false);
        });
    });

    // ── Archived chips ──────────────────────────────────────────────
    it('shows Archived chip for archived related jobs', async () => {
        const archivedRelatedJobs: RelatedJob[] = [
            {id: 100, text: 'ARCH-001 - Parent', selected: true, isArchived: true},
            {id: 101, text: 'ARCH-002 - Child', selected: false, isArchived: true},
        ];
        const props = createMockProps({
            onLoadRelatedJobs: jest.fn().mockResolvedValue(archivedRelatedJobs),
        });
        renderWithTheme(<VoidJobConfirmationDialog {...props} />);

        await userEvent.click(screen.getByRole('switch'));
        expect(await screen.findAllByText('Archived')).toHaveLength(2);
    });
});
