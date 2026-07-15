/**
 * Integration tests for EditDateTimeDialog using REAL MUI X v8 date pickers.
 *
 * These tests bypass the project's moduleNameMapper (which routes @mui/x-date-pickers/*
 * to lightweight mock inputs) and load the actual MUI X v8 components. This exposes
 * the real DOM structure that MUI renders — the v8 "accessible field" structure
 * (contentEditable sectioned spans) rather than standard <input> elements.
 *
 * Purpose: Verify that the real MUI X v8 pickers render correctly and that the
 * accessible field structure is functional (not broken by removed/invalid props).
 */

// --- Force Jest to load real MUI packages instead of the mock stubs ---
jest.mock('../../../../tests/mocks/muiDatePickerMocks', () => ({
    ...require('../../../../../../node_modules/@mui/x-date-pickers/DatePicker'),
    ...require('../../../../../../node_modules/@mui/x-date-pickers/TimePicker'),
    ...require('../../../../../../node_modules/@mui/x-date-pickers/LocalizationProvider'),
    ...require('../../../../../../node_modules/@mui/x-date-pickers/AdapterDayjs'),
}));

import React from 'react';
import { setupUser } from '../../../__testUtils__/setupUser';
import { render, screen, waitFor } from '@testing-library/react';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { EditDateTimeDialog } from './EditDateTimeDialog';
import { EditDateTimeDialogProps } from './types';

const theme = createTheme();

/**
 * Render helper that wraps the component with both MUI theme and the REAL
 * LocalizationProvider (not the mock pass-through).
 */
function renderWithProviders(props: EditDateTimeDialogProps) {
    return render(
        <ThemeProvider theme={theme}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
                <EditDateTimeDialog {...props} />
            </LocalizationProvider>
        </ThemeProvider>
    );
}

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

describe('EditDateTimeDialog – Real MUI v8 Picker Integration', () => {
    /**
     * MUI X v8 uses the accessible field DOM structure exclusively.
     * Fields render as sectioned contentEditable spans, NOT as <input> elements.
     */
    it('TimePicker renders accessible field sections (not a plain <input>)', () => {
        const props = createDefaultProps({ showDate: true, showTime: true });
        renderWithProviders(props);

        // The label text should be present in the DOM
        const timeLabels = screen.getAllByText(/Time \(24-hour\)/i);
        expect(timeLabels.length).toBeGreaterThan(0);

        // v8 accessible fields use contenteditable sections, not a single <input>
        const dialog = screen.getByRole('dialog');
        const timeInputs = dialog.querySelectorAll('input[type="text"][aria-label="Time (24-hour)"]');
        // In v8, there should be no single text <input> for the time field
        // (the field uses sectioned contentEditable spans instead)
        expect(timeInputs.length).toBe(0);
    });

    it('DatePicker renders accessible field sections (not a plain <input>)', () => {
        const props = createDefaultProps({ showDate: true, showTime: true });
        renderWithProviders(props);

        const dateLabels = screen.getAllByText('Date');
        expect(dateLabels.length).toBeGreaterThan(0);

        const dialog = screen.getByRole('dialog');
        const dateInputs = dialog.querySelectorAll('input[type="text"][aria-label="Date"]');
        expect(dateInputs.length).toBe(0);
    });

    it('time-only mode renders the TimePicker', () => {
        const props = createDefaultProps({ showDate: false, showTime: true });
        renderWithProviders(props);

        const timeLabels = screen.getAllByText(/Time \(24-hour\)/i);
        expect(timeLabels.length).toBeGreaterThan(0);

        // Date picker should NOT be present
        expect(screen.queryByText('Date')).not.toBeInTheDocument();
    });

    it('date-only mode renders the DatePicker', () => {
        const props = createDefaultProps({ showDate: true, showTime: false });
        renderWithProviders(props);

        const dateLabels = screen.getAllByText('Date');
        expect(dateLabels.length).toBeGreaterThan(0);

        // Time picker should NOT be present
        expect(screen.queryByText(/Time \(24-hour\)/i)).not.toBeInTheDocument();
    });

    /**
     * Verify that submit works with the initial value.
     * This confirms the component state is correctly initialized from props
     * and the real MUI picker doesn't interfere with state management.
     */
    it('submits the initial date/time value correctly', async () => {
        const user = setupUser();
        const onSubmit = jest.fn();
        const props = createDefaultProps({
            showDate: true,
            showTime: true,
            dateTime: dayjs('2024-06-10T16:45:00'),
            onSubmit,
        });
        renderWithProviders(props);

        await user.click(screen.getByRole('button', { name: /Save/i }));

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalled();
            const result = onSubmit.mock.calls[0][0];
            expect(result.value.hour()).toBe(16);
            expect(result.value.minute()).toBe(45);
            expect(result.value.year()).toBe(2024);
            expect(result.value.month()).toBe(5); // June = 5 (0-indexed)
            expect(result.value.date()).toBe(10);
        });
    });

    it('time-only submit uses minimum date with selected time', async () => {
        const user = setupUser();
        const onSubmit = jest.fn();
        const props = createDefaultProps({
            showDate: false,
            showTime: true,
            dateTime: dayjs('2024-06-10T09:15:00'),
            onSubmit,
        });
        renderWithProviders(props);

        await user.click(screen.getByRole('button', { name: /Save/i }));

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalled();
            const result = onSubmit.mock.calls[0][0];
            expect(result.value.year()).toBe(1900);
            expect(result.value.hour()).toBe(9);
            expect(result.value.minute()).toBe(15);
        });
    });

    it('date-only submit sets time to midnight', async () => {
        const user = setupUser();
        const onSubmit = jest.fn();
        const props = createDefaultProps({
            showDate: true,
            showTime: false,
            dateTime: dayjs('2024-06-10T14:30:00'),
            onSubmit,
        });
        renderWithProviders(props);

        await user.click(screen.getByRole('button', { name: /Save/i }));

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalled();
            const result = onSubmit.mock.calls[0][0];
            expect(result.value.hour()).toBe(0);
            expect(result.value.minute()).toBe(0);
            expect(result.value.year()).toBe(2024);
            expect(result.value.month()).toBe(5);
            expect(result.value.date()).toBe(10);
        });
    });

    it('passes timezone in submit result', async () => {
        const user = setupUser();
        const onSubmit = jest.fn();
        const props = createDefaultProps({
            defaultTimeZone: 'America/New_York',
            onSubmit,
        });
        renderWithProviders(props);

        await user.click(screen.getByRole('button', { name: /Save/i }));

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledWith(
                expect.objectContaining({
                    fieldName: 'TestField',
                    timezone: 'America/New_York',
                })
            );
        });
    });
});
