/**
 * SwapPodsDialog Component Tests
 *
 * Optimised: tests sharing identical setup consolidated into single renders.
 * Covers the two-phase flow: input/validation → confirmation/swap.
 */

import React from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import { setupUser } from '../../../__testUtils__/setupUser';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {SwapPodsDialog, SwapPodsDialogProps} from './SwapPodsDialog';

// Shared fast userEvent instance (see setupUser).
const userEvent = setupUser();

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) => {
    return render(
        <ThemeProvider theme={theme}>
            {ui}
        </ThemeProvider>
    );
};

const createMockProps = (overrides: Partial<SwapPodsDialogProps> = {}): SwapPodsDialogProps => ({
    open: true,
    jobNo: 'JOB-001',
    onClose: jest.fn(),
    onValidate: jest.fn().mockResolvedValue(true),
    onSwap: jest.fn().mockResolvedValue(undefined),
    showToast: jest.fn(),
    ...overrides,
});

/** Shared helper: render and advance the dialog to phase 2 */
const advanceToPhase2 = async (props: SwapPodsDialogProps, secondJob = 'JOB-002') => {
    renderWithTheme(<SwapPodsDialog {...props} />);
    fireEvent.change(screen.getByLabelText(/Second job number/i), { target: { value: secondJob } });
    await userEvent.click(screen.getByRole('button', {name: /validate/i}));
    await screen.findByRole('button', {name: /confirm swap/i});
};

describe('SwapPodsDialog', () => {
    // ── Rendering: all phase 1 elements (single render) ─────────────
    it('renders dialog with all phase 1 elements, pre-filled job, and disabled Validate', () => {
        renderWithTheme(<SwapPodsDialog {...createMockProps({jobNo: 'JOB-001'})} />);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Swap PODs')).toBeInTheDocument();
        expect(screen.getByText(/JOB-001/)).toBeInTheDocument();
        expect(screen.getByDisplayValue('JOB-001')).toBeInTheDocument();
        expect(screen.getByLabelText(/Second job number/i)).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /cancel/i})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /validate/i})).toBeInTheDocument();
        // Validate disabled when empty
        expect(screen.getByRole('button', {name: /validate/i})).toBeDisabled();
    });

    // ── Closed dialog ───────────────────────────────────────────────
    it('should not render the dialog when open is false', () => {
        renderWithTheme(<SwapPodsDialog {...createMockProps({open: false})} />);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // ── Phase 1: input validation (single render) ───────────────────
    it('enables Validate on input, blocks same job number, trims whitespace, and clears error on re-type', async () => {
        const props = createMockProps({jobNo: 'JOB-001'});
        renderWithTheme(<SwapPodsDialog {...props} />);
        const input = screen.getByLabelText(/Second job number/i);

        // Enable on input
        fireEvent.change(input, { target: { value: 'JOB-002' } });
        expect(screen.getByRole('button', {name: /validate/i})).toBeEnabled();

        // Same job number → error, onValidate not called
        fireEvent.change(input, { target: { value: 'JOB-001' } });
        await userEvent.click(screen.getByRole('button', {name: /validate/i}));
        expect(screen.getByText(/cannot be the same/i)).toBeInTheDocument();
        expect(props.onValidate).not.toHaveBeenCalled();

        // Clear error on re-type
        fireEvent.change(input, { target: { value: 'JOB-0011' } });
        expect(screen.queryByText(/cannot be the same/i)).not.toBeInTheDocument();

        // Trim whitespace
        fireEvent.change(input, { target: { value: '  JOB-002  ' } });
        await userEvent.click(screen.getByRole('button', {name: /validate/i}));
        await waitFor(() => {
            expect(props.onValidate).toHaveBeenCalledWith('JOB-002');
        });
    });

    // ── Phase 1: loading state during validation ────────────────────
    it('should show loading state while validating', async () => {
        let resolveValidation!: (value: boolean) => void;
        const props = createMockProps({
            onValidate: jest.fn().mockImplementation(
                () => new Promise<boolean>(resolve => { resolveValidation = resolve; })
            ),
        });
        renderWithTheme(<SwapPodsDialog {...props} />);
        fireEvent.change(screen.getByLabelText(/Second job number/i), { target: { value: 'JOB-002' } });
        await userEvent.click(screen.getByRole('button', {name: /validate/i}));
        expect(screen.getByText('Validating...')).toBeInTheDocument();

        // Clean up: resolve the pending promise
        await act(async () => { resolveValidation(true); });
    });

    // ── Phase 1: validation failure + error clear (single render) ───
    it('shows error when validation returns false and clears on re-type', async () => {
        const props = createMockProps({onValidate: jest.fn().mockResolvedValue(false)});
        renderWithTheme(<SwapPodsDialog {...props} />);
        const input = screen.getByLabelText(/Second job number/i);
        fireEvent.change(input, { target: { value: 'JOB-999' } });
        await userEvent.click(screen.getByRole('button', {name: /validate/i}));

        // Error shown, stays on phase 1
        expect(await screen.findByText(/not eligible/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /confirm swap/i})).not.toBeInTheDocument();

        // Clear error on re-type
        fireEvent.change(input, { target: { value: 'JOB-9991' } });
        expect(screen.queryByText(/not eligible/i)).not.toBeInTheDocument();
    });

    // ── Phase 1: network error ──────────────────────────────────────
    it('should show a network error message when onValidate throws', async () => {
        const props = createMockProps({
            onValidate: jest.fn().mockRejectedValue(new Error('Network error')),
        });
        renderWithTheme(<SwapPodsDialog {...props} />);
        fireEvent.change(screen.getByLabelText(/Second job number/i), { target: { value: 'JOB-002' } });
        await userEvent.click(screen.getByRole('button', {name: /validate/i}));
        expect(await screen.findByText(/failed to validate/i)).toBeInTheDocument();
    });

    // ── Phase 1 → Phase 2 transition (single render) ────────────────
    it('advances to phase 2 on successful validation with correct buttons', async () => {
        const props = createMockProps({jobNo: 'JOB-001'});
        renderWithTheme(<SwapPodsDialog {...props} />);
        fireEvent.change(screen.getByLabelText(/Second job number/i), { target: { value: 'JOB-002' } });
        await userEvent.click(screen.getByRole('button', {name: /validate/i}));

        await waitFor(() => {
            expect(props.onValidate).toHaveBeenCalledWith('JOB-002');
        });

        // Phase 2 elements
        expect(await screen.findByRole('button', {name: /confirm swap/i})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /back/i})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /validate/i})).not.toBeInTheDocument();

        // Both job numbers displayed
        expect(screen.getAllByText('JOB-001').length).toBeGreaterThan(0);
        expect(screen.getByText('JOB-002')).toBeInTheDocument();
    });

    // ── Phase 2: back button preserves input (single render) ────────
    it('returns to phase 1 with preserved input when Back is clicked', async () => {
        const props = createMockProps();
        await advanceToPhase2(props, 'JOB-002');

        await userEvent.click(screen.getByRole('button', {name: /back/i}));

        expect(screen.getByRole('button', {name: /validate/i})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /confirm swap/i})).not.toBeInTheDocument();
        expect(screen.getByLabelText(/Second job number/i)).toHaveValue('JOB-002');
    });

    // ── Confirm Swap: success flow (single render) ──────────────────
    it('calls onSwap, shows success toast, and closes on successful swap', async () => {
        const props = createMockProps({jobNo: 'JOB-001'});
        await advanceToPhase2(props, 'JOB-002');
        await userEvent.click(screen.getByRole('button', {name: /confirm swap/i}));

        await waitFor(() => {
            expect(props.onSwap).toHaveBeenCalledWith('JOB-001', 'JOB-002');
            expect(props.showToast).toHaveBeenCalledWith('PODs swapped successfully.', 'success');
            expect(props.onClose).toHaveBeenCalled();
        });
    });

    // ── Confirm Swap: loading state ─────────────────────────────────
    it('should show loading state while the swap is in progress', async () => {
        let resolveSwap!: () => void;
        const props = createMockProps({
            onSwap: jest.fn().mockImplementation(
                () => new Promise<void>(resolve => { resolveSwap = resolve; })
            ),
        });
        await advanceToPhase2(props);
        await userEvent.click(screen.getByRole('button', {name: /confirm swap/i}));
        expect(screen.getByText('Swapping...')).toBeInTheDocument();

        // Clean up: resolve the pending promise
        await act(async () => { resolveSwap(); });
    });

    // ── Confirm Swap: error + re-enable (single render) ─────────────
    it('shows error toast, does not close, and re-enables button on swap failure', async () => {
        const props = createMockProps({
            onSwap: jest.fn().mockRejectedValue(new Error('API error')),
        });
        await advanceToPhase2(props);
        await userEvent.click(screen.getByRole('button', {name: /confirm swap/i}));

        await waitFor(() => {
            expect(props.showToast).toHaveBeenCalledWith(expect.any(String), 'error');
        });
        expect(props.onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('button', {name: /confirm swap/i})).toBeEnabled();
    });

    // ── Cancel and Close (single render) ────────────────────────────
    it('calls onClose when Cancel or close icon is clicked', async () => {
        const props = createMockProps();
        renderWithTheme(<SwapPodsDialog {...props} />);

        await userEvent.click(screen.getByRole('button', {name: /cancel/i}));
        expect(props.onClose).toHaveBeenCalledTimes(1);

        (props.onClose as jest.Mock).mockClear();
        const closeIconButton = screen.getAllByRole('button').find(btn =>
            btn.querySelector('[data-testid="CloseIcon"]')
        );
        if (closeIconButton) {
            await userEvent.click(closeIconButton);
            expect(props.onClose).toHaveBeenCalledTimes(1);
        }
    });

    // ── State reset on reopen ───────────────────────────────────────
    it('should reset to phase 1 with empty input when dialog reopens', async () => {
        const props = createMockProps();
        const {rerender} = renderWithTheme(<SwapPodsDialog {...props} />);

        fireEvent.change(screen.getByLabelText(/Second job number/i), { target: { value: 'JOB-002' } });
        await userEvent.click(screen.getByRole('button', {name: /validate/i}));
        await screen.findByRole('button', {name: /confirm swap/i});

        await act(async () => {
            rerender(<ThemeProvider theme={theme}><SwapPodsDialog {...props} open={false} /></ThemeProvider>);
        });
        await act(async () => {
            rerender(<ThemeProvider theme={theme}><SwapPodsDialog {...props} open={true} /></ThemeProvider>);
        });

        expect(screen.getByRole('button', {name: /validate/i})).toBeInTheDocument();
        expect(screen.getByLabelText(/Second job number/i)).toHaveValue('');
    });

    // ── Enter key shortcut (single render) ──────────────────────────
    it('triggers validation on Enter with input, but not when empty', async () => {
        const props = createMockProps();
        renderWithTheme(<SwapPodsDialog {...props} />);

        // Enter with empty input → no validation
        await userEvent.keyboard('{Enter}');
        expect(props.onValidate).not.toHaveBeenCalled();

        // Enter with value → validates
        fireEvent.change(screen.getByLabelText(/Second job number/i), { target: { value: 'JOB-002' } });
        await userEvent.keyboard('{Enter}');
        await waitFor(() => {
            expect(props.onValidate).toHaveBeenCalledWith('JOB-002');
        });
    });
});
