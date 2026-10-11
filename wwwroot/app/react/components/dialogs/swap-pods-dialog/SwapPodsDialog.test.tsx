/**
 * SwapPodsDialog Component Tests
 *
 * Covers the two-phase flow: candidate search/selection + validation → confirmation/swap.
 */

import React from 'react';
import {act, screen, waitFor} from '@testing-library/react';
import {setupUser} from '../../../__testUtils__/setupUser';
import {renderWithMantine} from '../../../__testUtils__';
import {SwapPodsDialog, SwapPodsDialogProps} from './SwapPodsDialog';
import {dayjs, getInputDateFormat} from '../../../utils/dateUtils';
import type {SwapPodCandidate} from '../../../services/jobApi';

// Shared fast userEvent instance (see setupUser).
const userEvent = setupUser();

const renderWithTheme = (ui: React.ReactElement) => renderWithMantine(ui);

const candidate = (overrides: Partial<SwapPodCandidate> = {}): SwapPodCandidate => ({
    jobId: 2,
    number: 'JOB-002',
    statusId: 0,
    statusName: 'New',
    customer: 'Acme Ltd',
    fromSuburb: 'Penrose',
    toSuburb: 'Albany',
    courier: 'Sam Courier',
    date: '2026-10-09T00:00:00',
    hasPod: false,
    ...overrides,
});

const createMockProps = (overrides: Partial<SwapPodsDialogProps> = {}): SwapPodsDialogProps => ({
    open: true,
    jobNo: 'JOB-001',
    onClose: jest.fn(),
    onValidate: jest.fn().mockResolvedValue(true),
    onSearch: jest.fn().mockResolvedValue([candidate()]),
    onSwap: jest.fn().mockResolvedValue(undefined),
    showToast: jest.fn(),
    ...overrides,
});

/** Open the picker and choose the option showing this job number */
const pickCandidate = async (number = 'JOB-002') => {
    await userEvent.click(screen.getByLabelText(/Second job/i));
    await userEvent.click(await screen.findByText(number));
};

/** Render and advance the dialog to phase 2 */
const advanceToPhase2 = async (props: SwapPodsDialogProps) => {
    renderWithTheme(<SwapPodsDialog {...props} />);
    await pickCandidate();
    await userEvent.click(screen.getByRole('button', {name: /validate/i}));
    await screen.findByRole('button', {name: /confirm swap/i});
};

describe('SwapPodsDialog', () => {
    it('renders phase 1 with filters, picker and a disabled Validate; renders nothing when closed', () => {
        const {unmount} = renderWithTheme(<SwapPodsDialog {...createMockProps()} />);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByDisplayValue('JOB-001')).toBeInTheDocument();
        expect(screen.getByLabelText(/Second job/i)).toBeInTheDocument();
        expect(screen.getByRole('combobox', {name: 'Status'})).toBeInTheDocument();
        expect(screen.getByLabelText('Customer')).toBeInTheDocument();
        expect(screen.getByLabelText('Date')).toHaveValue(dayjs().format(getInputDateFormat()));
        expect(screen.queryByLabelText('Same customer')).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: /validate/i})).toBeDisabled();
        unmount();

        renderWithTheme(<SwapPodsDialog {...createMockProps({open: false})} />);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('searches with the default date, excludes the current job, and renders rich option rows', async () => {
        const props = createMockProps({
            onSearch: jest.fn().mockResolvedValue([candidate({hasPod: true, statusName: 'Completed', statusId: 6})]),
        });
        renderWithTheme(<SwapPodsDialog {...props} />);
        await userEvent.click(screen.getByLabelText(/Second job/i));

        expect(await screen.findByText('JOB-002')).toBeInTheDocument();
        expect(props.onSearch).toHaveBeenCalledWith(
            expect.objectContaining({excludeJobNumber: 'JOB-001', date: dayjs().format('YYYY-MM-DD')}),
            expect.anything()
        );
        expect(screen.getAllByText('Completed')).toHaveLength(2);
        expect(screen.getByText('Has POD')).toBeInTheDocument();
        expect(screen.getByText(/Acme Ltd · Penrose → Albany/)).toBeInTheDocument();
        expect(screen.getByText(/Sam Courier/)).toBeInTheDocument();
    });

    it('re-searches with the customer filter; "Same customer" fills and clears it', async () => {
        const props = createMockProps({customer: 'Acme Ltd'});
        renderWithTheme(<SwapPodsDialog {...props} />);

        await userEvent.click(screen.getByLabelText('Same customer'));
        expect(screen.getByLabelText('Customer')).toHaveValue('Acme Ltd');
        await waitFor(() => {
            expect(props.onSearch).toHaveBeenCalledWith(
                expect.objectContaining({customer: 'Acme Ltd'}),
                expect.anything()
            );
        });

        await userEvent.click(screen.getByLabelText('Same customer'));
        expect(screen.getByLabelText('Customer')).toHaveValue('');
    });

    it('validates the selected candidate, shows a failure, and a text edit drops the pick', async () => {
        const props = createMockProps({onValidate: jest.fn().mockResolvedValue(false)});
        renderWithTheme(<SwapPodsDialog {...props} />);
        await pickCandidate();
        expect(screen.getByLabelText(/Second job/i)).toHaveValue('JOB-002');
        await userEvent.click(screen.getByRole('button', {name: /validate/i}));

        expect(await screen.findByText(/eligible for a POD swap/i)).toBeInTheDocument();
        expect(props.onValidate).toHaveBeenCalledWith('JOB-002');
        expect(screen.queryByRole('button', {name: /confirm swap/i})).not.toBeInTheDocument();

        await userEvent.type(screen.getByLabelText(/Second job/i), 'x');
        expect(screen.getByRole('button', {name: /validate/i})).toBeDisabled();
    });

    it('shows a network error message when onValidate throws', async () => {
        const props = createMockProps({onValidate: jest.fn().mockRejectedValue(new Error('Network error'))});
        renderWithTheme(<SwapPodsDialog {...props} />);
        await pickCandidate();
        await userEvent.click(screen.getByRole('button', {name: /validate/i}));
        expect(await screen.findByText(/couldn't check this job/i)).toBeInTheDocument();
    });

    it('shows loading state while validating', async () => {
        let resolveValidation!: (value: boolean) => void;
        const props = createMockProps({
            onValidate: jest.fn().mockImplementation(() => new Promise<boolean>(resolve => { resolveValidation = resolve; })),
        });
        renderWithTheme(<SwapPodsDialog {...props} />);
        await pickCandidate();
        await userEvent.click(screen.getByRole('button', {name: /validate/i}));
        expect(screen.getByText('Validating…')).toBeInTheDocument();
        await act(async () => { resolveValidation(true); });
    });

    it('advances to phase 2 with both jobs and the one-sided outcome; Back preserves the pick', async () => {
        await advanceToPhase2(createMockProps());

        expect(screen.queryByRole('button', {name: /validate/i})).not.toBeInTheDocument();
        expect(screen.getByText('JOB-002')).toBeInTheDocument();
        expect(screen.getByText('JOB-001 goes back to New/Accepted, JOB-002 becomes Completed.')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: /back/i}));
        expect(screen.getByRole('button', {name: /validate/i})).toBeEnabled();
        expect(screen.getByLabelText(/Second job/i)).toHaveValue('JOB-002');
    });

    it('describes a two-sided exchange when the chosen job already has a POD', async () => {
        await advanceToPhase2(createMockProps({onSearch: jest.fn().mockResolvedValue([candidate({hasPod: true})])}));
        expect(screen.getByText('PODs are exchanged between JOB-001 and JOB-002.')).toBeInTheDocument();
    });

    it('calls onSwap, shows a success toast, and closes on successful swap', async () => {
        const props = createMockProps({onSwap: jest.fn().mockResolvedValue({movedPhotos: 2, failedPhotos: 0})});
        await advanceToPhase2(props);
        await userEvent.click(screen.getByRole('button', {name: /confirm swap/i}));

        await waitFor(() => {
            expect(props.onSwap).toHaveBeenCalledWith('JOB-001', 'JOB-002');
            expect(props.showToast).toHaveBeenCalledWith('PODs swapped', 'success');
            expect(props.onClose).toHaveBeenCalled();
        });
    });

    it('shows a warning toast instead of success when photos failed to move', async () => {
        const props = createMockProps({onSwap: jest.fn().mockResolvedValue({movedPhotos: 1, failedPhotos: 2})});
        await advanceToPhase2(props);
        await userEvent.click(screen.getByRole('button', {name: /confirm swap/i}));

        await waitFor(() => {
            expect(props.showToast).toHaveBeenCalledWith(expect.stringMatching(/2 photos couldn't be moved/), 'warning');
        });
        expect(props.showToast).not.toHaveBeenCalledWith('PODs swapped', 'success');
        expect(props.onClose).toHaveBeenCalled();
    });

    it('shows loading state while the swap is in progress', async () => {
        let resolveSwap!: () => void;
        const props = createMockProps({
            onSwap: jest.fn().mockImplementation(() => new Promise<void>(resolve => { resolveSwap = resolve; })),
        });
        await advanceToPhase2(props);
        await userEvent.click(screen.getByRole('button', {name: /confirm swap/i}));
        expect(screen.getByText('Swapping…')).toBeInTheDocument();
        await act(async () => { resolveSwap(); });
    });

    it('shows error toast, does not close, and re-enables button on swap failure', async () => {
        const props = createMockProps({onSwap: jest.fn().mockRejectedValue(new Error('API error'))});
        await advanceToPhase2(props);
        await userEvent.click(screen.getByRole('button', {name: /confirm swap/i}));

        await waitFor(() => {
            expect(props.showToast).toHaveBeenCalledWith(expect.any(String), 'error');
        });
        expect(props.onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('button', {name: /confirm swap/i})).toBeEnabled();
    });

    it('calls onClose when Cancel is clicked', async () => {
        const props = createMockProps();
        renderWithTheme(<SwapPodsDialog {...props} />);
        await userEvent.click(screen.getByRole('button', {name: /cancel/i}));
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('resets to phase 1 with an empty pick when the dialog reopens', async () => {
        const props = createMockProps();
        const {rerender} = renderWithTheme(<SwapPodsDialog {...props} />);
        await pickCandidate();
        await userEvent.click(screen.getByRole('button', {name: /validate/i}));
        await screen.findByRole('button', {name: /confirm swap/i});

        await act(async () => { rerender(<SwapPodsDialog {...props} open={false} />); });
        await act(async () => { rerender(<SwapPodsDialog {...props} open={true} />); });

        expect(screen.getByRole('button', {name: /validate/i})).toBeDisabled();
        expect(screen.getByLabelText(/Second job/i)).toHaveValue('');
    });
});
