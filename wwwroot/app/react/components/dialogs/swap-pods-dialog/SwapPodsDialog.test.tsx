/**
 * SwapPodsDialog Component Tests
 *
 * Covers the two-phase flow: input/validation → confirmation/swap.
 */

import React from 'react';
import {render, screen, waitFor, act} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {ThemeProvider, createTheme} from '@mui/material';
import {SwapPodsDialog, SwapPodsDialogProps} from './SwapPodsDialog';

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
    await userEvent.type(screen.getByLabelText(/Second job number/i), secondJob);
    await userEvent.click(screen.getByRole('button', {name: /validate/i}));
    await waitFor(() => screen.getByRole('button', {name: /confirm swap/i}));
};

describe('SwapPodsDialog', () => {
    describe('Rendering', () => {
        it('should render the dialog when open is true', () => {
            renderWithTheme(<SwapPodsDialog {...createMockProps()} />);
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('should not render the dialog when open is false', () => {
            renderWithTheme(<SwapPodsDialog {...createMockProps({open: false})} />);
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('should display "Swap PODs" in the dialog header', () => {
            renderWithTheme(<SwapPodsDialog {...createMockProps()} />);
            expect(screen.getByText('Swap PODs')).toBeInTheDocument();
        });

        it('should mention the current job number in the info banner', () => {
            renderWithTheme(<SwapPodsDialog {...createMockProps({jobNo: 'JOB-999'})} />);
            expect(screen.getByText(/JOB-999/)).toBeInTheDocument();
        });

        it('should show the current job number pre-filled in the read-only field', () => {
            renderWithTheme(<SwapPodsDialog {...createMockProps({jobNo: 'JOB-001'})} />);
            expect(screen.getByDisplayValue('JOB-001')).toBeInTheDocument();
        });

        it('should display the second job number input field', () => {
            renderWithTheme(<SwapPodsDialog {...createMockProps()} />);
            expect(screen.getByLabelText(/Second job number/i)).toBeInTheDocument();
        });

        it('should display Cancel and Validate buttons in phase 1', () => {
            renderWithTheme(<SwapPodsDialog {...createMockProps()} />);
            expect(screen.getByRole('button', {name: /cancel/i})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /validate/i})).toBeInTheDocument();
        });
    });

    describe('Phase 1 — Input validation', () => {
        it('should disable Validate button when input is empty', () => {
            renderWithTheme(<SwapPodsDialog {...createMockProps()} />);
            expect(screen.getByRole('button', {name: /validate/i})).toBeDisabled();
        });

        it('should enable Validate button when input has a value', async () => {
            renderWithTheme(<SwapPodsDialog {...createMockProps()} />);
            await userEvent.type(screen.getByLabelText(/Second job number/i), 'JOB-002');
            expect(screen.getByRole('button', {name: /validate/i})).toBeEnabled();
        });

        it('should show an error when the same job number is entered', async () => {
            renderWithTheme(<SwapPodsDialog {...createMockProps({jobNo: 'JOB-001'})} />);
            await userEvent.type(screen.getByLabelText(/Second job number/i), 'JOB-001');
            await userEvent.click(screen.getByRole('button', {name: /validate/i}));
            expect(screen.getByText(/cannot be the same/i)).toBeInTheDocument();
        });

        it('should not call onValidate when the same job number is entered', async () => {
            const props = createMockProps({jobNo: 'JOB-001'});
            renderWithTheme(<SwapPodsDialog {...props} />);
            await userEvent.type(screen.getByLabelText(/Second job number/i), 'JOB-001');
            await userEvent.click(screen.getByRole('button', {name: /validate/i}));
            expect(props.onValidate).not.toHaveBeenCalled();
        });

        it('should trim whitespace from the second job number before validating', async () => {
            const props = createMockProps();
            renderWithTheme(<SwapPodsDialog {...props} />);
            await userEvent.type(screen.getByLabelText(/Second job number/i), '  JOB-002  ');
            await userEvent.click(screen.getByRole('button', {name: /validate/i}));
            await waitFor(() => {
                expect(props.onValidate).toHaveBeenCalledWith('JOB-002');
            });
        });

        it('should show loading state while validating', async () => {
            const props = createMockProps({
                onValidate: jest.fn().mockImplementation(
                    () => new Promise(resolve => setTimeout(() => resolve(true), 100))
                ),
            });
            renderWithTheme(<SwapPodsDialog {...props} />);
            await userEvent.type(screen.getByLabelText(/Second job number/i), 'JOB-002');
            await userEvent.click(screen.getByRole('button', {name: /validate/i}));
            expect(screen.getByText('Validating...')).toBeInTheDocument();
        });

        it('should clear the error when the user starts typing again', async () => {
            const props = createMockProps({onValidate: jest.fn().mockResolvedValue(false)});
            renderWithTheme(<SwapPodsDialog {...props} />);
            const input = screen.getByLabelText(/Second job number/i);
            await userEvent.type(input, 'JOB-999');
            await userEvent.click(screen.getByRole('button', {name: /validate/i}));
            await waitFor(() => expect(screen.getByText(/not eligible/i)).toBeInTheDocument());
            await userEvent.type(input, '1');
            expect(screen.queryByText(/not eligible/i)).not.toBeInTheDocument();
        });
    });

    describe('Phase 1 → Phase 2 transition', () => {
        it('should call onValidate with the entered job number', async () => {
            const props = createMockProps();
            renderWithTheme(<SwapPodsDialog {...props} />);
            await userEvent.type(screen.getByLabelText(/Second job number/i), 'JOB-002');
            await userEvent.click(screen.getByRole('button', {name: /validate/i}));
            await waitFor(() => {
                expect(props.onValidate).toHaveBeenCalledWith('JOB-002');
            });
        });

        it('should advance to phase 2 when validation returns true', async () => {
            const props = createMockProps({onValidate: jest.fn().mockResolvedValue(true)});
            renderWithTheme(<SwapPodsDialog {...props} />);
            await userEvent.type(screen.getByLabelText(/Second job number/i), 'JOB-002');
            await userEvent.click(screen.getByRole('button', {name: /validate/i}));
            await waitFor(() => {
                expect(screen.getByRole('button', {name: /confirm swap/i})).toBeInTheDocument();
            });
        });

        it('should show an inline error when validation returns false', async () => {
            const props = createMockProps({onValidate: jest.fn().mockResolvedValue(false)});
            renderWithTheme(<SwapPodsDialog {...props} />);
            await userEvent.type(screen.getByLabelText(/Second job number/i), 'JOB-999');
            await userEvent.click(screen.getByRole('button', {name: /validate/i}));
            await waitFor(() => {
                expect(screen.getByText(/not eligible/i)).toBeInTheDocument();
            });
        });

        it('should remain on phase 1 when validation returns false', async () => {
            const props = createMockProps({onValidate: jest.fn().mockResolvedValue(false)});
            renderWithTheme(<SwapPodsDialog {...props} />);
            await userEvent.type(screen.getByLabelText(/Second job number/i), 'JOB-999');
            await userEvent.click(screen.getByRole('button', {name: /validate/i}));
            await waitFor(() => expect(screen.getByText(/not eligible/i)).toBeInTheDocument());
            expect(screen.queryByRole('button', {name: /confirm swap/i})).not.toBeInTheDocument();
        });

        it('should show a network error message when onValidate throws', async () => {
            const props = createMockProps({
                onValidate: jest.fn().mockRejectedValue(new Error('Network error')),
            });
            renderWithTheme(<SwapPodsDialog {...props} />);
            await userEvent.type(screen.getByLabelText(/Second job number/i), 'JOB-002');
            await userEvent.click(screen.getByRole('button', {name: /validate/i}));
            await waitFor(() => {
                expect(screen.getByText(/failed to validate/i)).toBeInTheDocument();
            });
        });
    });

    describe('Phase 2 — Confirmation', () => {
        it('should display both job numbers in the confirmation panel', async () => {
            const props = createMockProps({jobNo: 'JOB-001'});
            await advanceToPhase2(props, 'JOB-002');
            // The first job appears in the header info and confirmation panel
            expect(screen.getAllByText('JOB-001').length).toBeGreaterThan(0);
            expect(screen.getByText('JOB-002')).toBeInTheDocument();
        });

        it('should show Confirm Swap and Back buttons in phase 2', async () => {
            const props = createMockProps();
            await advanceToPhase2(props);
            expect(screen.getByRole('button', {name: /confirm swap/i})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /back/i})).toBeInTheDocument();
        });

        it('should not show the Validate button in phase 2', async () => {
            const props = createMockProps();
            await advanceToPhase2(props);
            expect(screen.queryByRole('button', {name: /validate/i})).not.toBeInTheDocument();
        });

        it('should return to phase 1 when Back is clicked', async () => {
            const props = createMockProps();
            await advanceToPhase2(props);
            await userEvent.click(screen.getByRole('button', {name: /back/i}));
            expect(screen.getByRole('button', {name: /validate/i})).toBeInTheDocument();
            expect(screen.queryByRole('button', {name: /confirm swap/i})).not.toBeInTheDocument();
        });

        it('should preserve the entered job number after going back', async () => {
            const props = createMockProps();
            await advanceToPhase2(props, 'JOB-002');
            await userEvent.click(screen.getByRole('button', {name: /back/i}));
            expect(screen.getByLabelText(/Second job number/i)).toHaveValue('JOB-002');
        });
    });

    describe('Confirm Swap flow', () => {
        it('should call onSwap with job1 and job2', async () => {
            const props = createMockProps({jobNo: 'JOB-001'});
            await advanceToPhase2(props, 'JOB-002');
            await userEvent.click(screen.getByRole('button', {name: /confirm swap/i}));
            await waitFor(() => {
                expect(props.onSwap).toHaveBeenCalledWith('JOB-001', 'JOB-002');
            });
        });

        it('should call showToast with success message after a successful swap', async () => {
            const props = createMockProps();
            await advanceToPhase2(props);
            await userEvent.click(screen.getByRole('button', {name: /confirm swap/i}));
            await waitFor(() => {
                expect(props.showToast).toHaveBeenCalledWith('PODs swapped successfully.', 'success');
            });
        });

        it('should call onClose after a successful swap', async () => {
            const props = createMockProps();
            await advanceToPhase2(props);
            await userEvent.click(screen.getByRole('button', {name: /confirm swap/i}));
            await waitFor(() => {
                expect(props.onClose).toHaveBeenCalled();
            });
        });

        it('should show loading state while the swap is in progress', async () => {
            const props = createMockProps({
                onSwap: jest.fn().mockImplementation(
                    () => new Promise(resolve => setTimeout(resolve, 100))
                ),
            });
            await advanceToPhase2(props);
            await userEvent.click(screen.getByRole('button', {name: /confirm swap/i}));
            expect(screen.getByText('Swapping...')).toBeInTheDocument();
        });

        it('should show an error toast and not close the dialog when onSwap throws', async () => {
            const props = createMockProps({
                onSwap: jest.fn().mockRejectedValue(new Error('API error')),
            });
            await advanceToPhase2(props);
            await userEvent.click(screen.getByRole('button', {name: /confirm swap/i}));
            await waitFor(() => {
                expect(props.showToast).toHaveBeenCalledWith(
                    expect.any(String),
                    'error'
                );
            });
            expect(props.onClose).not.toHaveBeenCalled();
        });

        it('should re-enable the Confirm Swap button after a failed swap', async () => {
            const props = createMockProps({
                onSwap: jest.fn().mockRejectedValue(new Error('API error')),
            });
            await advanceToPhase2(props);
            await userEvent.click(screen.getByRole('button', {name: /confirm swap/i}));
            await waitFor(() => {
                expect(props.showToast).toHaveBeenCalledWith(expect.any(String), 'error');
            });
            expect(screen.getByRole('button', {name: /confirm swap/i})).toBeEnabled();
        });
    });

    describe('Cancel and Close', () => {
        it('should call onClose when Cancel is clicked in phase 1', async () => {
            const props = createMockProps();
            renderWithTheme(<SwapPodsDialog {...props} />);
            await userEvent.click(screen.getByRole('button', {name: /cancel/i}));
            expect(props.onClose).toHaveBeenCalled();
        });

        it('should call onClose when the close icon button is clicked', async () => {
            const props = createMockProps();
            renderWithTheme(<SwapPodsDialog {...props} />);
            const closeIconButton = screen.getAllByRole('button').find(btn =>
                btn.querySelector('[data-testid="CloseIcon"]')
            );
            if (closeIconButton) {
                await userEvent.click(closeIconButton);
                expect(props.onClose).toHaveBeenCalled();
            }
        });
    });

    describe('State reset on reopen', () => {
        it('should reset to phase 1 with empty input when dialog reopens', async () => {
            const props = createMockProps();
            const {rerender} = renderWithTheme(<SwapPodsDialog {...props} />);

            // Advance to phase 2
            await userEvent.type(screen.getByLabelText(/Second job number/i), 'JOB-002');
            await userEvent.click(screen.getByRole('button', {name: /validate/i}));
            await waitFor(() => screen.getByRole('button', {name: /confirm swap/i}));

            // Close and reopen
            await act(async () => {
                rerender(
                    <ThemeProvider theme={theme}>
                        <SwapPodsDialog {...props} open={false} />
                    </ThemeProvider>
                );
            });
            await act(async () => {
                rerender(
                    <ThemeProvider theme={theme}>
                        <SwapPodsDialog {...props} open={true} />
                    </ThemeProvider>
                );
            });

            expect(screen.getByRole('button', {name: /validate/i})).toBeInTheDocument();
            expect(screen.getByLabelText(/Second job number/i)).toHaveValue('');
        });
    });

    describe('Enter key shortcut', () => {
        it('should trigger validation when Enter is pressed in the input field', async () => {
            const props = createMockProps();
            renderWithTheme(<SwapPodsDialog {...props} />);
            const input = screen.getByLabelText(/Second job number/i);
            await userEvent.type(input, 'JOB-002{enter}');
            await waitFor(() => {
                expect(props.onValidate).toHaveBeenCalledWith('JOB-002');
            });
        });

        it('should not trigger validation when the input is empty and Enter is pressed', async () => {
            const props = createMockProps();
            renderWithTheme(<SwapPodsDialog {...props} />);
            await userEvent.type(screen.getByLabelText(/Second job number/i), '{enter}');
            expect(props.onValidate).not.toHaveBeenCalled();
        });
    });
});
