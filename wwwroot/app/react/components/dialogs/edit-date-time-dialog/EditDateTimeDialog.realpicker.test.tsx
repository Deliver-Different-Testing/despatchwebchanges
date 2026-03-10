/**
 * Integration tests for EditDateTimeDialog using REAL MUI X date pickers.
 *
 * These tests bypass the project's moduleNameMapper (which routes @mui/x-date-pickers/*
 * to lightweight mock inputs) and load the actual MUI X v8 components. This exposes
 * the real DOM structure that MUI renders — including the v8 "accessible field" structure
 * (contentEditable sectioned divs) that replaced standard <input> elements.
 *
 * Purpose: Verify that enableAccessibleFieldDOMStructure={false} restores
 * standard <input> elements and that value changes propagate correctly.
 */

// --- Force Jest to load real MUI packages instead of the mock stubs ---
// All moduleNameMapper entries for @mui/x-date-pickers/* resolve to the SAME
// mock file (muiDatePickerMocks.ts). Multiple jest.mock() calls targeting
// different picker paths would all resolve to that single file, with only the
// last factory winning. Instead, we mock the shared mock file once and merge
// all real picker exports into it.
jest.mock('../../../../tests/mocks/muiDatePickerMocks', () => ({
    ...require('../../../../../../node_modules/@mui/x-date-pickers/DatePicker'),
    ...require('../../../../../../node_modules/@mui/x-date-pickers/TimePicker'),
    ...require('../../../../../../node_modules/@mui/x-date-pickers/LocalizationProvider'),
    ...require('../../../../../../node_modules/@mui/x-date-pickers/AdapterDayjs'),
}));

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createTheme, ThemeProvider } from '@mui/material';
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

describe('EditDateTimeDialog – Real MUI Picker Integration', () => {
    /**
     * Test 1: TimePicker should render a standard <input> element.
     *
     * If MUI X v8's enableAccessibleFieldDOMStructure defaults to true,
     * this will fail because the field is rendered as sectioned contentEditable
     * divs rather than a single <input>.
     */
    it('TimePicker renders a typeable <input> element', () => {
        const props = createDefaultProps({ showDate: true, showTime: true });
        renderWithProviders(props);

        const timeInput = screen.getByLabelText('Time (24-hour)');
        expect(timeInput.tagName).toBe('INPUT');
    });

    /**
     * Test 2: User should be able to change the time value via the <input>.
     *
     * With the accessible DOM structure (contentEditable divs), fireEvent.change
     * cannot set the value because there is no <input> element to target.
     * With enableAccessibleFieldDOMStructure={false}, the standard <input> accepts
     * change events and MUI processes the new value through its field parser.
     *
     * Note: userEvent.type() doesn't work with MUI's controlled input in jsdom
     * because MUI's internal field state management intercepts keystrokes.
     * fireEvent.change() is the correct jsdom-compatible approach.
     */
    it('user can change the time value via the input', () => {
        const props = createDefaultProps({ showDate: true, showTime: true });
        renderWithProviders(props);

        const timeInput = screen.getByLabelText('Time (24-hour)') as HTMLInputElement;
        fireEvent.change(timeInput, { target: { value: '16:45' } });

        expect(timeInput).toHaveValue('16:45');
    });

    /**
     * Test 3: A changed time value should be submitted correctly via onSubmit.
     *
     * With the accessible DOM structure, fireEvent.change cannot reach a real
     * <input>, so onChange never fires and the submitted value stays stale.
     * With enableAccessibleFieldDOMStructure={false}, the change event
     * propagates through MUI's field parser and updates component state.
     */
    it('changed time value is submitted correctly', async () => {
        const user = userEvent.setup();
        const onSubmit = jest.fn();
        const props = createDefaultProps({
            showDate: true,
            showTime: true,
            onSubmit,
        });
        renderWithProviders(props);

        const timeInput = screen.getByLabelText('Time (24-hour)') as HTMLInputElement;
        fireEvent.change(timeInput, { target: { value: '16:45' } });

        await user.click(screen.getByRole('button', { name: /Save/i }));

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalled();
            const result = onSubmit.mock.calls[0][0];
            expect(result.value.hour()).toBe(16);
            expect(result.value.minute()).toBe(45);
        });
    });

    /**
     * Test 4: Time-only mode (showDate=false, showTime=true) should also
     * support value changes via the input.
     */
    it('time-only mode allows value change via input', async () => {
        const user = userEvent.setup();
        const onSubmit = jest.fn();
        const props = createDefaultProps({
            showDate: false,
            showTime: true,
            onSubmit,
        });
        renderWithProviders(props);

        const timeInput = screen.getByLabelText('Time (24-hour)') as HTMLInputElement;
        fireEvent.change(timeInput, { target: { value: '09:15' } });

        await user.click(screen.getByRole('button', { name: /Save/i }));

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalled();
            const result = onSubmit.mock.calls[0][0];
            expect(result.value.hour()).toBe(9);
            expect(result.value.minute()).toBe(15);
        });
    });

    /**
     * Test 5: DatePicker should also render a standard <input> element.
     *
     * The same enableAccessibleFieldDOMStructure change affects DatePicker too.
     */
    it('DatePicker renders a typeable <input> element', () => {
        const props = createDefaultProps({ showDate: true, showTime: true });
        renderWithProviders(props);

        const dateInput = screen.getByLabelText('Date');
        expect(dateInput.tagName).toBe('INPUT');
    });
});
