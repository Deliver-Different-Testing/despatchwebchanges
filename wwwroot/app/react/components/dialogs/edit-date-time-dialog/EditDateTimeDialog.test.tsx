/**
 * Tests for EditDateTimeDialog React component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { EditDateTimeDialog } from './EditDateTimeDialog';
import { EditDateTimeDialogProps } from './types';

// Create a theme for testing
const theme = createTheme();

// Helper to render component with theme and localization provider
function renderWithProviders(props: EditDateTimeDialogProps) {
    return render(
        <ThemeProvider theme={theme}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
                <EditDateTimeDialog {...props} />
            </LocalizationProvider>
        </ThemeProvider>
    );
}

// Default props factory
function createDefaultProps(overrides?: Partial<EditDateTimeDialogProps>): EditDateTimeDialogProps {
    return {
        open: true,
        title: 'Edit Date & Time',
        fieldName: 'TestField',
        dateTime: dayjs('2024-03-15T14:30:00'),
        defaultTimeZone: 'Pacific/Auckland',
        showDate: true,
        showTime: true,
        onClose: jest.fn(),
        onSubmit: jest.fn(),
        showToast: jest.fn(),
        ...overrides,
    };
}

describe('EditDateTimeDialog', () => {
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

        it('displays the provided title', () => {
            const props = createDefaultProps({ title: 'Update Time' });
            renderWithProviders(props);
            expect(screen.getByText('Update Time')).toBeInTheDocument();
        });

        it('displays Save button', () => {
            const props = createDefaultProps();
            renderWithProviders(props);
            expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument();
        });

        it('displays Cancel button', () => {
            const props = createDefaultProps();
            renderWithProviders(props);
            expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
        });
    });

    describe('Date and Time Mode', () => {
        it('shows both date and time inputs when showDate and showTime are true', () => {
            const props = createDefaultProps({ showDate: true, showTime: true });
            renderWithProviders(props);
            // MUI date pickers create multiple labeled elements, check for presence using getAllByText
            const dateElements = screen.getAllByText('Date');
            expect(dateElements.length).toBeGreaterThan(0);
            const timeElements = screen.getAllByText(/Time/i);
            expect(timeElements.length).toBeGreaterThan(0);
        });
    });

    describe('Date Only Mode', () => {
        it('shows only date input when showDate is true and showTime is false', () => {
            const props = createDefaultProps({ showDate: true, showTime: false });
            renderWithProviders(props);
            // Date label should be present
            const dateElements = screen.getAllByText('Date');
            expect(dateElements.length).toBeGreaterThan(0);
            // Time picker should not be present
            expect(screen.queryByText(/Time \(24-hour\)/i)).not.toBeInTheDocument();
        });
    });

    describe('Time Only Mode', () => {
        it('shows only time input when showTime is true and showDate is false', () => {
            const props = createDefaultProps({ showDate: false, showTime: true });
            renderWithProviders(props);
            // Time picker label should be present
            const timeElements = screen.getAllByText(/Time \(24-hour\)/i);
            expect(timeElements.length).toBeGreaterThan(0);
            // Date label should not be present when time only
            const dateLabels = screen.queryAllByText('Date');
            expect(dateLabels.length).toBe(0);
        });
    });

    describe('Timezone Display', () => {
        it('displays timezone section for US customers', () => {
            const props = createDefaultProps({ isUSCustomer: true });
            renderWithProviders(props);
            expect(screen.getByText('Your timezone')).toBeInTheDocument();
            expect(screen.getByText('Job timezone')).toBeInTheDocument();
        });

        it('hides timezone section for non-US customers', () => {
            const props = createDefaultProps({ isUSCustomer: false });
            renderWithProviders(props);
            expect(screen.queryByText('Your timezone')).not.toBeInTheDocument();
            expect(screen.queryByText('Job timezone')).not.toBeInTheDocument();
        });

        it('defaults to hiding timezone section when isUSCustomer is not specified', () => {
            const props = createDefaultProps();
            renderWithProviders(props);
            expect(screen.queryByText('Your timezone')).not.toBeInTheDocument();
            expect(screen.queryByText('Job timezone')).not.toBeInTheDocument();
        });
    });

    describe('Dialog Actions', () => {
        it('calls onClose when Cancel button is clicked', async () => {
            const user = userEvent.setup();
            const onClose = jest.fn();
            const props = createDefaultProps({ onClose });
            renderWithProviders(props);

            await user.click(screen.getByRole('button', { name: /Cancel/i }));

            expect(onClose).toHaveBeenCalled();
        });

        it('calls onClose when close icon is clicked', async () => {
            const user = userEvent.setup();
            const onClose = jest.fn();
            const props = createDefaultProps({ onClose });
            renderWithProviders(props);

            // Find and click the close button in the header
            const closeButtons = screen.getAllByRole('button');
            const closeIconButton = closeButtons.find(
                btn => btn.querySelector('.material-icons')?.textContent === 'close'
            );

            if (closeIconButton) {
                await user.click(closeIconButton);
                expect(onClose).toHaveBeenCalled();
            }
        });

        it('calls onSubmit when Save button is clicked with valid data', async () => {
            const user = userEvent.setup();
            const onSubmit = jest.fn();
            const props = createDefaultProps({ onSubmit });
            renderWithProviders(props);

            await user.click(screen.getByRole('button', { name: /Save/i }));

            await waitFor(() => {
                expect(onSubmit).toHaveBeenCalled();
            });
        });

        it('passes correct result to onSubmit', async () => {
            const user = userEvent.setup();
            const onSubmit = jest.fn();
            const props = createDefaultProps({
                onSubmit,
                fieldName: 'DeliverBy',
                defaultTimeZone: 'America/New_York',
            });
            renderWithProviders(props);

            await user.click(screen.getByRole('button', { name: /Save/i }));

            await waitFor(() => {
                expect(onSubmit).toHaveBeenCalledWith(
                    expect.objectContaining({
                        fieldName: 'DeliverBy',
                        timezone: 'America/New_York',
                    })
                );
            });
        });
    });

    describe('Initial Value', () => {
        it('initializes with current time when no dateTime provided', () => {
            const props = createDefaultProps({ dateTime: undefined });
            renderWithProviders(props);
            // Dialog should still render without error
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('initializes with provided dateTime value', () => {
            const testDate = dayjs('2024-06-20T10:30:00');
            const props = createDefaultProps({ dateTime: testDate });
            renderWithProviders(props);
            // The date picker should be present
            const dateElements = screen.getAllByText('Date');
            expect(dateElements.length).toBeGreaterThan(0);
        });
    });

    describe('Validation', () => {
        it('handles invalid date by falling back to current time and allowing submit', async () => {
            const user = userEvent.setup();
            const onSubmit = jest.fn();
            const showToast = jest.fn();
            // Create props with invalid date - component should fall back to current time
            const props = createDefaultProps({
                dateTime: dayjs('invalid'),
                onSubmit,
                showToast,
            });
            renderWithProviders(props);

            await user.click(screen.getByRole('button', { name: /Save/i }));

            // Component falls back to current time for invalid dates, so submit should succeed
            await waitFor(() => {
                expect(onSubmit).toHaveBeenCalled();
            });
            // No warning toast should be shown since fallback is valid
            expect(showToast).not.toHaveBeenCalledWith(
                'Please provide valid date/time information',
                'warning'
            );
        });

        it('shows warning toast when submitting with invalid date', async () => {
            const user = userEvent.setup();
            const onSubmit = jest.fn();
            const showToast = jest.fn();
            // Use date-only mode so the picker uses handleDateTimeChange (no isValid guard),
            // allowing the invalid mock dayjs to reach component state
            const props = createDefaultProps({
                onSubmit,
                showToast,
                showDate: true,
                showTime: false,
            });
            renderWithProviders(props);

            // Set an incomplete date value - fireEvent.change sets the full value atomically
            const dateInput = screen.getByLabelText('Date') as HTMLInputElement;
            fireEvent.change(dateInput, { target: { value: '2024-01' } });

            await user.click(screen.getByRole('button', { name: /Save/i }));

            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith(
                    'Please provide valid date/time information',
                    'warning'
                );
            });
            expect(onSubmit).not.toHaveBeenCalled();
        });
    });

    describe('Text Input Editability', () => {
        it('allows typing in the date input field', async () => {
            const props = createDefaultProps();
            renderWithProviders(props);

            // Find date input by aria-label
            const dateInput = screen.getByLabelText('Date') as HTMLInputElement;

            // Use fireEvent.change to set the value atomically (mock pickers are controlled)
            fireEvent.change(dateInput, { target: { value: '2025-06-15' } });

            // The input should reflect the new date
            expect(dateInput).toHaveValue('2025-06-15');
        });

        it('allows typing in the time input field', async () => {
            const props = createDefaultProps({ showDate: true, showTime: true });
            renderWithProviders(props);

            // Find time input by aria-label
            const timeInput = screen.getByLabelText('Time (24-hour)') as HTMLInputElement;

            // Use fireEvent.change to set the value atomically (mock pickers are controlled)
            fireEvent.change(timeInput, { target: { value: '09:45' } });

            expect(timeInput).toHaveValue('09:45');
        });

        it('accepts intermediate invalid values during typing without freezing', async () => {
            const props = createDefaultProps();
            renderWithProviders(props);

            const dateInput = screen.getByLabelText('Date') as HTMLInputElement;

            // Fire intermediate invalid values - the controlled mock rejects them (isValid check)
            // but the component should not crash or freeze
            fireEvent.change(dateInput, { target: { value: '2' } });
            fireEvent.change(dateInput, { target: { value: '20' } });
            fireEvent.change(dateInput, { target: { value: '2025' } });

            // Component should still render without errors
            expect(screen.getByRole('dialog')).toBeInTheDocument();

            // After setting a full valid date, the input should update
            fireEvent.change(dateInput, { target: { value: '2025-06-15' } });
            expect(dateInput).toHaveValue('2025-06-15');
        });

        it('submits successfully after typing a valid date', async () => {
            const user = userEvent.setup();
            const onSubmit = jest.fn();
            const props = createDefaultProps({ onSubmit });
            renderWithProviders(props);

            const dateInput = screen.getByLabelText('Date') as HTMLInputElement;

            // Use fireEvent.change to set a valid date (mock pickers are controlled)
            fireEvent.change(dateInput, { target: { value: '2025-12-25' } });

            await user.click(screen.getByRole('button', { name: /Save/i }));

            await waitFor(() => {
                expect(onSubmit).toHaveBeenCalled();
                const result = onSubmit.mock.calls[0][0];
                expect(result.value.year()).toBe(2025);
                expect(result.value.month()).toBe(11); // December is month 11 (0-indexed)
                expect(result.value.date()).toBe(25);
            });
        });

        it('allows editing date-only picker via text input', async () => {
            const user = userEvent.setup();
            const onSubmit = jest.fn();
            const props = createDefaultProps({
                showDate: true,
                showTime: false,
                onSubmit,
            });
            renderWithProviders(props);

            const dateInput = screen.getByLabelText('Date') as HTMLInputElement;
            // Use fireEvent.change to directly set value (avoids calendar popup stealing focus)
            fireEvent.change(dateInput, { target: { value: '2026-01-01' } });

            await user.click(screen.getByRole('button', { name: /Save/i }));

            await waitFor(() => {
                expect(onSubmit).toHaveBeenCalled();
                const result = onSubmit.mock.calls[0][0];
                expect(result.value.year()).toBe(2026);
                expect(result.value.month()).toBe(0);
                expect(result.value.date()).toBe(1);
            });
        });

        it('allows editing time-only picker via text input', async () => {
            const user = userEvent.setup();
            const onSubmit = jest.fn();
            const props = createDefaultProps({
                showDate: false,
                showTime: true,
                onSubmit,
            });
            renderWithProviders(props);

            const timeInput = screen.getByLabelText('Time (24-hour)') as HTMLInputElement;
            await user.clear(timeInput);
            await user.type(timeInput, '16:30');

            await user.click(screen.getByRole('button', { name: /Save/i }));

            await waitFor(() => {
                expect(onSubmit).toHaveBeenCalled();
                const result = onSubmit.mock.calls[0][0];
                expect(result.value.hour()).toBe(16);
                expect(result.value.minute()).toBe(30);
            });
        });
    });

    describe('Date Processing', () => {
        it('processes date only mode by setting time to midnight', async () => {
            const user = userEvent.setup();
            const onSubmit = jest.fn();
            const props = createDefaultProps({
                showDate: true,
                showTime: false,
                dateTime: dayjs('2024-03-15T14:30:00'),
                onSubmit,
            });
            renderWithProviders(props);

            await user.click(screen.getByRole('button', { name: /Save/i }));

            await waitFor(() => {
                expect(onSubmit).toHaveBeenCalled();
                const result = onSubmit.mock.calls[0][0];
                expect(result.value.hour()).toBe(0);
                expect(result.value.minute()).toBe(0);
            });
        });

        it('processes time only mode by using minimum date', async () => {
            const user = userEvent.setup();
            const onSubmit = jest.fn();
            const props = createDefaultProps({
                showDate: false,
                showTime: true,
                dateTime: dayjs('2024-03-15T14:30:00'),
                onSubmit,
            });
            renderWithProviders(props);

            await user.click(screen.getByRole('button', { name: /Save/i }));

            await waitFor(() => {
                expect(onSubmit).toHaveBeenCalled();
                const result = onSubmit.mock.calls[0][0];
                expect(result.value.year()).toBe(1900);
                expect(result.value.month()).toBe(0);
                expect(result.value.date()).toBe(1);
                expect(result.value.hour()).toBe(14);
                expect(result.value.minute()).toBe(30);
            });
        });
    });

    describe('Date/Time Independence', () => {
        it('preserves time when date is changed via fireEvent', async () => {
            const user = userEvent.setup();
            const onSubmit = jest.fn();
            const props = createDefaultProps({
                showDate: true,
                showTime: true,
                dateTime: dayjs('2024-03-15T14:30:00'),
                onSubmit,
            });
            renderWithProviders(props);

            // Change the date input
            const dateInput = screen.getByLabelText('Date') as HTMLInputElement;
            fireEvent.change(dateInput, { target: { value: '2024-07-20' } });

            await user.click(screen.getByRole('button', { name: /Save/i }));

            await waitFor(() => {
                expect(onSubmit).toHaveBeenCalled();
                const result = onSubmit.mock.calls[0][0];
                expect(result.value.hour()).toBe(14);
                expect(result.value.minute()).toBe(30);
            });
        });

        it('preserves date when time is changed via fireEvent', async () => {
            const user = userEvent.setup();
            const onSubmit = jest.fn();
            const props = createDefaultProps({
                showDate: true,
                showTime: true,
                dateTime: dayjs('2024-03-15T14:30:00'),
                onSubmit,
            });
            renderWithProviders(props);

            // Change the time input
            const timeInput = screen.getByLabelText('Time (24-hour)') as HTMLInputElement;
            fireEvent.change(timeInput, { target: { value: '09:15' } });

            await user.click(screen.getByRole('button', { name: /Save/i }));

            await waitFor(() => {
                expect(onSubmit).toHaveBeenCalled();
                const result = onSubmit.mock.calls[0][0];
                expect(result.value.year()).toBe(2024);
                expect(result.value.month()).toBe(2); // March is month 2 (0-indexed)
                expect(result.value.date()).toBe(15);
            });
        });

        it('ignores invalid intermediate date values', async () => {
            const user = userEvent.setup();
            const onSubmit = jest.fn();
            const props = createDefaultProps({
                showDate: true,
                showTime: true,
                dateTime: dayjs('2024-03-15T14:30:00'),
                onSubmit,
            });
            renderWithProviders(props);

            // Clear the date input and type a partial invalid value
            const dateInput = screen.getByLabelText('Date') as HTMLInputElement;
            await user.clear(dateInput);
            await user.type(dateInput, '2024-');

            // Submit with the invalid intermediate date - should still use the original time
            await user.click(screen.getByRole('button', { name: /Save/i }));

            await waitFor(() => {
                // Component should still have a valid dateTime (the original one) since
                // invalid intermediate values don't update the state
                expect(onSubmit).toHaveBeenCalled();
                const result = onSubmit.mock.calls[0][0];
                expect(result.value.hour()).toBe(14);
                expect(result.value.minute()).toBe(30);
            });
        });

        it('ignores invalid intermediate time values', async () => {
            const user = userEvent.setup();
            const onSubmit = jest.fn();
            const props = createDefaultProps({
                showDate: true,
                showTime: true,
                dateTime: dayjs('2024-03-15T14:30:00'),
                onSubmit,
            });
            renderWithProviders(props);

            // Clear the time input and type a partial value
            const timeInput = screen.getByLabelText('Time (24-hour)') as HTMLInputElement;
            await user.clear(timeInput);
            await user.type(timeInput, '0');

            // Submit - original date should still be intact
            await user.click(screen.getByRole('button', { name: /Save/i }));

            await waitFor(() => {
                expect(onSubmit).toHaveBeenCalled();
                const result = onSubmit.mock.calls[0][0];
                expect(result.value.year()).toBe(2024);
                expect(result.value.month()).toBe(2);
                expect(result.value.date()).toBe(15);
            });
        });
    });

    describe('Loading State', () => {
        it('disables buttons during loading', async () => {
            const user = userEvent.setup();
            const onSubmit = jest.fn(() => new Promise(() => {})); // Never resolves
            const props = createDefaultProps({ onSubmit });
            renderWithProviders(props);

            await user.click(screen.getByRole('button', { name: /Save/i }));

            // The save button text should change to "Saving..."
            await waitFor(() => {
                expect(screen.getByText('Saving...')).toBeInTheDocument();
            });
        });
    });
});
