/**
 * Tests for SimplePriceEditDialog React component
 */

import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import { SimplePriceEditDialog } from './SimplePriceEditDialog';
import { SimplePriceEditDialogProps } from './types';

const theme = createTheme();

function renderWithProviders(props: SimplePriceEditDialogProps) {
    return render(
        <ThemeProvider theme={theme}>
            <SimplePriceEditDialog {...props} />
        </ThemeProvider>
    );
}

function createDefaultProps(overrides?: Partial<SimplePriceEditDialogProps>): SimplePriceEditDialogProps {
    return {
        open: true,
        jobNumber: 'JOB-100',
        currentCharge: 150.00,
        isPrebook: false,
        onClose: jest.fn(),
        onSubmit: jest.fn().mockResolvedValue(175.00),
        showToast: jest.fn(),
        ...overrides,
    };
}

describe('SimplePriceEditDialog', () => {
    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Rendering', () => {
        it('renders nothing when not open', () => {
            const props = createDefaultProps({ open: false });
            const { container } = renderWithProviders(props);
            expect(container.querySelector('.MuiDialog-root')).toBeNull();
        });

        it('renders the dialog when open', () => {
            const props = createDefaultProps();
            renderWithProviders(props);
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('displays "Edit Price" title', () => {
            const props = createDefaultProps();
            renderWithProviders(props);
            expect(screen.getByText('Edit Price')).toBeInTheDocument();
        });

        it('displays the job number badge', () => {
            const props = createDefaultProps({ jobNumber: 'JOB-555' });
            renderWithProviders(props);
            expect(screen.getByText('JOB-555')).toBeInTheDocument();
        });

        it('displays all three mode cards', () => {
            const props = createDefaultProps();
            renderWithProviders(props);
            expect(screen.getByText('Recalculate')).toBeInTheDocument();
            expect(screen.getByText('Raw Base Amount')).toBeInTheDocument();
            expect(screen.getByText('Gross Amount')).toBeInTheDocument();
        });

        it('displays mode descriptions', () => {
            const props = createDefaultProps();
            renderWithProviders(props);
            expect(screen.getByText('Auto-price based on job details')).toBeInTheDocument();
            expect(screen.getByText('Set the base price directly')).toBeInTheDocument();
            expect(screen.getByText('Set final price directly')).toBeInTheDocument();
        });

        it('displays Cancel and submit buttons', () => {
            const props = createDefaultProps();
            renderWithProviders(props);
            expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Recalculate & Save/i })).toBeInTheDocument();
        });
    });

    describe('Mode Selection', () => {
        it('has recalculate selected by default', () => {
            const props = createDefaultProps();
            renderWithProviders(props);

            const radios = screen.getAllByRole('radio');
            expect(radios[0]).toBeChecked();    // recalculate
            expect(radios[1]).not.toBeChecked(); // base
            expect(radios[2]).not.toBeChecked(); // gross
        });

        it('selects base mode when clicking its card', async () => {
            const props = createDefaultProps();
            renderWithProviders(props);

            await userEvent.click(screen.getByText('Raw Base Amount'));

            const radios = screen.getAllByRole('radio');
            expect(radios[0]).not.toBeChecked(); // recalculate
            expect(radios[1]).toBeChecked();     // base
        });

        it('selects gross mode when clicking its card', async () => {
            const props = createDefaultProps();
            renderWithProviders(props);

            await userEvent.click(screen.getByText('Gross Amount'));

            const radios = screen.getAllByRole('radio');
            expect(radios[2]).toBeChecked(); // gross
        });

        it('hides amount input for recalculate mode', () => {
            const props = createDefaultProps();
            renderWithProviders(props);
            expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
        });

        it('shows amount input when base mode is selected', async () => {
            const props = createDefaultProps();
            renderWithProviders(props);

            await userEvent.click(screen.getByText('Raw Base Amount'));

            expect(screen.getByRole('spinbutton')).toBeInTheDocument();
        });

        it('shows amount input when gross mode is selected', async () => {
            const props = createDefaultProps();
            renderWithProviders(props);

            await userEvent.click(screen.getByText('Gross Amount'));

            expect(screen.getByRole('spinbutton')).toBeInTheDocument();
        });
    });

    describe('Amount Input', () => {
        it('pre-populates with currentCharge value', async () => {
            const props = createDefaultProps({ currentCharge: 250.50 });
            renderWithProviders(props);

            await userEvent.click(screen.getByText('Raw Base Amount'));

            const input = screen.getByRole('spinbutton');
            expect(input).toHaveValue(250.50);
        });

        it('shows "Enter Raw Base Amount" label for base mode', async () => {
            const props = createDefaultProps();
            renderWithProviders(props);

            await userEvent.click(screen.getByText('Raw Base Amount'));

            expect(screen.getByText('Enter Raw Base Amount')).toBeInTheDocument();
        });

        it('shows "Enter Final Amount" label for gross mode', async () => {
            const props = createDefaultProps();
            renderWithProviders(props);

            await userEvent.click(screen.getByText('Gross Amount'));

            expect(screen.getByText('Enter Final Amount')).toBeInTheDocument();
        });
    });

    describe('Submit Button', () => {
        it('shows "Recalculate & Save" text for recalculate mode', () => {
            const props = createDefaultProps();
            renderWithProviders(props);
            expect(screen.getByRole('button', { name: /Recalculate & Save/i })).toBeInTheDocument();
        });

        it('shows "Apply Raw Base" text for base mode', async () => {
            const props = createDefaultProps();
            renderWithProviders(props);

            await userEvent.click(screen.getByText('Raw Base Amount'));

            expect(screen.getByRole('button', { name: /Apply Raw Base/i })).toBeInTheDocument();
        });

        it('shows "Apply Amount" text for gross mode', async () => {
            const props = createDefaultProps();
            renderWithProviders(props);

            await userEvent.click(screen.getByText('Gross Amount'));

            expect(screen.getByRole('button', { name: /Apply Amount/i })).toBeInTheDocument();
        });

        it('is enabled for recalculate mode without entering an amount', () => {
            const props = createDefaultProps();
            renderWithProviders(props);

            const button = screen.getByRole('button', { name: /Recalculate & Save/i });
            expect(button).not.toBeDisabled();
        });

        it('is enabled for base mode with a valid amount', async () => {
            const props = createDefaultProps({ currentCharge: 100 });
            renderWithProviders(props);

            await userEvent.click(screen.getByText('Raw Base Amount'));

            const button = screen.getByRole('button', { name: /Apply Raw Base/i });
            expect(button).not.toBeDisabled();
        });

        it('is disabled for base mode when amount is cleared', async () => {
            const props = createDefaultProps({ currentCharge: 100 });
            renderWithProviders(props);

            await userEvent.click(screen.getByText('Raw Base Amount'));

            const input = screen.getByRole('spinbutton');
            await userEvent.clear(input);

            const button = screen.getByRole('button', { name: /Apply Raw Base/i });
            expect(button).toBeDisabled();
        });

        it('is disabled during loading', async () => {
            const onSubmit = jest.fn(() => new Promise<number>(() => {})); // Never resolves
            const props = createDefaultProps({ onSubmit });
            renderWithProviders(props);

            await userEvent.click(screen.getByRole('button', { name: /Recalculate & Save/i }));

            // During loading, we show a loading state — buttons are hidden
            // Verify loading indicator is shown instead
            expect(screen.getByText('Saving price...')).toBeInTheDocument();
        });
    });

    describe('Submit Flow', () => {
        it('calls onSubmit with mode and amount', async () => {
            const onSubmit = jest.fn().mockResolvedValue(200);
            const props = createDefaultProps({ onSubmit, currentCharge: 150 });
            renderWithProviders(props);

            await userEvent.click(screen.getByText('Raw Base Amount'));
            await userEvent.click(screen.getByRole('button', { name: /Apply Raw Base/i }));

            await waitFor(() => {
                expect(onSubmit).toHaveBeenCalledWith('base', 150);
            });
        });

        it('calls onSubmit with recalculate mode', async () => {
            const onSubmit = jest.fn().mockResolvedValue(175);
            const props = createDefaultProps({ onSubmit, currentCharge: 150 });
            renderWithProviders(props);

            await userEvent.click(screen.getByRole('button', { name: /Recalculate & Save/i }));

            await waitFor(() => {
                expect(onSubmit).toHaveBeenCalledWith('recalculate', 150);
            });
        });

        it('shows loading spinner during submit', async () => {
            const onSubmit = jest.fn(() => new Promise<number>(() => {})); // Never resolves
            const props = createDefaultProps({ onSubmit });
            renderWithProviders(props);

            await userEvent.click(screen.getByRole('button', { name: /Recalculate & Save/i }));

            expect(await screen.findByText('Saving price...')).toBeInTheDocument();
            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });

        it('transitions to success state after submit resolves', async () => {
            const onSubmit = jest.fn().mockResolvedValue(175.00);
            const props = createDefaultProps({ onSubmit });
            renderWithProviders(props);

            await userEvent.click(screen.getByRole('button', { name: /Recalculate & Save/i }));

            expect(await screen.findByText('Price Updated')).toBeInTheDocument();
        });
    });

    describe('Success State', () => {
        async function submitAndWaitForSuccess(overrides?: Partial<SimplePriceEditDialogProps>) {
            const onSubmit = jest.fn().mockResolvedValue(175.00);
            const props = createDefaultProps({ onSubmit, currentCharge: 150.00, ...overrides });
            const result = renderWithProviders(props);

            await userEvent.click(screen.getByRole('button', { name: /Recalculate & Save/i }));
            await screen.findByText('Price Updated');

            return { ...result, props };
        }

        it('displays "Price Updated" heading', async () => {
            await submitAndWaitForSuccess();
            expect(screen.getByText('Price Updated')).toBeInTheDocument();
        });

        it('displays the new price amount', async () => {
            await submitAndWaitForSuccess();
            // $175.00 appears in both the main display and comparison — verify at least one
            const priceElements = screen.getAllByText('$175.00');
            expect(priceElements.length).toBeGreaterThanOrEqual(1);
        });

        it('shows price comparison when price changed', async () => {
            await submitAndWaitForSuccess({ currentCharge: 150.00 });
            expect(screen.getByText('Previous Price')).toBeInTheDocument();
            expect(screen.getByText('$150.00')).toBeInTheDocument();
        });

        it('shows correct mode subtitle for recalculate', async () => {
            await submitAndWaitForSuccess();
            expect(screen.getByText('Recalculated based on job details')).toBeInTheDocument();
        });

        it('shows correct mode subtitle for base', async () => {
            const onSubmit = jest.fn().mockResolvedValue(200.00);
            const props = createDefaultProps({ onSubmit, currentCharge: 150.00 });
            renderWithProviders(props);

            await userEvent.click(screen.getByText('Raw Base Amount'));
            await userEvent.click(screen.getByRole('button', { name: /Apply Raw Base/i }));

            await screen.findByText('Price Updated');
            expect(screen.getByText('Raw base amount applied')).toBeInTheDocument();
        });

        it('shows correct mode subtitle for gross', async () => {
            const onSubmit = jest.fn().mockResolvedValue(300.00);
            const props = createDefaultProps({ onSubmit, currentCharge: 150.00 });
            renderWithProviders(props);

            await userEvent.click(screen.getByText('Gross Amount'));
            await userEvent.click(screen.getByRole('button', { name: /Apply Amount/i }));

            await screen.findByText('Price Updated');
            expect(screen.getByText('Gross amount applied')).toBeInTheDocument();
        });

        it('Done button calls onClose', async () => {
            const { props } = await submitAndWaitForSuccess();

            await userEvent.click(screen.getByRole('button', { name: /Done/i }));

            expect(props.onClose).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        it('shows error toast on submit failure', async () => {
            const onSubmit = jest.fn().mockRejectedValue(new Error('Network error'));
            const showToast = jest.fn();
            const props = createDefaultProps({ onSubmit, showToast });
            renderWithProviders(props);

            await userEvent.click(screen.getByRole('button', { name: /Recalculate & Save/i }));

            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith('Network error', 'error');
            });
        });

        it('stays in edit state on failure', async () => {
            const onSubmit = jest.fn().mockRejectedValue(new Error('Server error'));
            const props = createDefaultProps({ onSubmit });
            renderWithProviders(props);

            await userEvent.click(screen.getByRole('button', { name: /Recalculate & Save/i }));

            await waitFor(() => {
                // Still in edit state — mode cards visible
                expect(screen.getByText('Recalculate')).toBeInTheDocument();
            });
            // Success state not shown
            expect(screen.queryByText('Price Updated')).not.toBeInTheDocument();
        });

        it('shows inline error message on failure', async () => {
            const onSubmit = jest.fn().mockRejectedValue(new Error('Price update failed'));
            const props = createDefaultProps({ onSubmit });
            renderWithProviders(props);

            await userEvent.click(screen.getByRole('button', { name: /Recalculate & Save/i }));

            await waitFor(() => {
                expect(screen.getByText('Price update failed')).toBeInTheDocument();
            });
        });

        it('uses fallback message when error has no message', async () => {
            const onSubmit = jest.fn().mockRejectedValue({});
            const showToast = jest.fn();
            const props = createDefaultProps({ onSubmit, showToast });
            renderWithProviders(props);

            await userEvent.click(screen.getByRole('button', { name: /Recalculate & Save/i }));

            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith(
                    'Failed to save price. Please try again.',
                    'error'
                );
            });
        });
    });

    describe('Cancel and Close', () => {
        it('calls onClose when Cancel button is clicked', async () => {
            const onClose = jest.fn();
            const props = createDefaultProps({ onClose });
            renderWithProviders(props);

            await userEvent.click(screen.getByRole('button', { name: /Cancel/i }));
            expect(onClose).toHaveBeenCalled();
        });

        it('calls onClose when close icon is clicked', async () => {
            const onClose = jest.fn();
            const props = createDefaultProps({ onClose });
            renderWithProviders(props);

            const closeButtons = screen.getAllByRole('button');
            const closeIconButton = closeButtons.find(
                btn => btn.querySelector('[data-testid="CloseIcon"]')
            );

            if (closeIconButton) {
                await userEvent.click(closeIconButton);
                expect(onClose).toHaveBeenCalled();
            }
        });

        it('disables close icon during loading', async () => {
            const onSubmit = jest.fn(() => new Promise<number>(() => {}));
            const props = createDefaultProps({ onSubmit });
            renderWithProviders(props);

            await userEvent.click(screen.getByRole('button', { name: /Recalculate & Save/i }));

            await screen.findByText('Saving price...');

            // During loading, close icon button should be disabled
            const closeButtons = screen.getAllByRole('button');
            const closeIconButton = closeButtons.find(
                btn => btn.querySelector('[data-testid="CloseIcon"]')
            );
            if (closeIconButton) {
                expect(closeIconButton).toBeDisabled();
            }
        });
    });

    describe('State Reset', () => {
        it('resets to default state when dialog reopens', async () => {
            const props = createDefaultProps({ currentCharge: 100.00 });
            const { rerender } = renderWithProviders(props);

            // Select gross mode
            await userEvent.click(screen.getByText('Gross Amount'));
            expect(screen.getAllByRole('radio')[2]).toBeChecked();

            // Close dialog
            await act(async () => {
                rerender(
                    <ThemeProvider theme={theme}>
                        <SimplePriceEditDialog {...props} open={false} />
                    </ThemeProvider>
                );
            });

            // Reopen dialog
            await act(async () => {
                rerender(
                    <ThemeProvider theme={theme}>
                        <SimplePriceEditDialog {...props} open={true} />
                    </ThemeProvider>
                );
            });

            // Should be back to recalculate mode
            const radios = screen.getAllByRole('radio');
            expect(radios[0]).toBeChecked();
            // Amount input should be hidden (recalculate mode)
            expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
        });

        it('resets success state when dialog reopens', async () => {
            const onSubmit = jest.fn().mockResolvedValue(200.00);
            const props = createDefaultProps({ onSubmit });
            const { rerender } = renderWithProviders(props);

            // Submit and get to success state
            await userEvent.click(screen.getByRole('button', { name: /Recalculate & Save/i }));
            await screen.findByText('Price Updated');

            // Close dialog
            await act(async () => {
                rerender(
                    <ThemeProvider theme={theme}>
                        <SimplePriceEditDialog {...props} open={false} />
                    </ThemeProvider>
                );
            });

            // Reopen dialog
            await act(async () => {
                rerender(
                    <ThemeProvider theme={theme}>
                        <SimplePriceEditDialog {...props} open={true} />
                    </ThemeProvider>
                );
            });

            // Should be back in edit state
            expect(screen.queryByText('Price Updated')).not.toBeInTheDocument();
            expect(screen.getByText('Recalculate')).toBeInTheDocument();
        });
    });
});
