/**
 * EditDateTimeDialog Component Tests
import {fireEvent, screen, waitFor} from '@testing-library/react';
 * Optimised: read-only tests consolidated to reduce render count.
 */

import React from 'react';
import { setupUser } from '../../../__testUtils__/setupUser';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {EditDateTimeDialog} from './EditDateTimeDialog';
import {EditDateTimeDialogProps} from './types';
import {renderWithMantine} from '../../../__testUtils__';

dayjs.extend(utc);
dayjs.extend(timezone);



// The pickers render for real: Mantine's are string-valued and light enough for jsdom,
// so none of the `muiDatePickerMocks` indirection is involved any more.
function renderWithProviders(props: EditDateTimeDialogProps) {
    return renderWithMantine(<EditDateTimeDialog {...props} />);
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

describe('EditDateTimeDialog', () => {
    // ── Rendering (consolidated) ────────────────────────────────────
    describe('Rendering', () => {
        it('renders dialog with title, buttons, date and time inputs', () => {
            renderWithProviders(createDefaultProps());

            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText('Edit Date & Time')).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /Save/i})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /Cancel/i})).toBeInTheDocument();
            expect(screen.getAllByText('Date').length).toBeGreaterThan(0);
            expect(screen.getAllByText(/Time/i).length).toBeGreaterThan(0);
        });

        it('renders nothing when not open', () => {
            renderWithProviders(createDefaultProps({open: false}));
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('displays custom title', () => {
            renderWithProviders(createDefaultProps({title: 'Update Time'}));
            expect(screen.getByText('Update Time')).toBeInTheDocument();
        });
    });

    // ── Mode Tests ──────────────────────────────────────────────────
    describe('Mode Tests', () => {
        it('shows only date input in date-only mode', () => {
            renderWithProviders(createDefaultProps({showDate: true, showTime: false}));
            expect(screen.getAllByText('Date').length).toBeGreaterThan(0);
            expect(screen.queryByText(/Time \(24-hour\)/i)).not.toBeInTheDocument();
        });

        it('shows only time input in time-only mode', () => {
            renderWithProviders(createDefaultProps({showDate: false, showTime: true}));
            expect(screen.getAllByText(/Time \(24-hour\)/i).length).toBeGreaterThan(0);
            expect(screen.queryAllByText('Date').length).toBe(0);
        });

        // The native HTML <input type="time"> defers display to the browser
        // locale (12-hour AM/PM under en-US, 24-hour under en-NZ), so the
        // "Time (24-hour)" label lied for half our users. Using MUI's
        // TimePicker with ampm={false} keeps the display 24-hour everywhere.
        // Mantine's `TimePicker format="24h"` renders hour/minute segments rather than a
        // native <input type="time">, whose display would follow the browser locale.
        it('uses a segmented 24-hour picker, not a native time input', () => {
            renderWithProviders(createDefaultProps({showDate: true, showTime: true}));
            expect(screen.getByLabelText('Hours')).toBeInTheDocument();
            expect(screen.getByLabelText('Minutes')).toBeInTheDocument();
            expect(document.querySelector('input[type="time"]')).toBeNull();
        });
    });

    // ── Timezone Display ────────────────────────────────────────────
    describe('Timezone Display', () => {
        it('displays job timezone with human-readable name for US customers', () => {
            renderWithProviders(createDefaultProps({
                isUSCustomer: true,
                defaultTimeZone: 'America/New_York',
            }));
            expect(screen.getByText('Job timezone')).toBeInTheDocument();
            // Should show human-readable name like "Eastern Daylight Time" without abbreviation or IANA ID
            const tzText = screen.getByText(/Eastern .+ Time/);
            expect(tzText).toBeInTheDocument();
            expect(tzText.textContent).not.toContain('America');
            expect(tzText.textContent).not.toMatch(/\(.*\)/);
        });

        it('does not display browser timezone', () => {
            renderWithProviders(createDefaultProps({isUSCustomer: true}));
            expect(screen.queryByText('Your timezone')).not.toBeInTheDocument();
        });

        it('hides timezone section for non-US customers', () => {
            renderWithProviders(createDefaultProps({isUSCustomer: false}));
            expect(screen.queryByText('Job timezone')).not.toBeInTheDocument();
        });

        it('defaults to hiding timezone section', () => {
            renderWithProviders(createDefaultProps());
            expect(screen.queryByText('Job timezone')).not.toBeInTheDocument();
        });
    });

    // ── Read-only (locked job) ──────────────────────────────────────
    describe('Read-only mode', () => {
        it('hides Save, shows Close, disables inputs and shows the view-only subtitle', () => {
            renderWithProviders(createDefaultProps({readOnly: true}));

            expect(screen.queryByRole('button', {name: /Save/i})).not.toBeInTheDocument();
            // `/Close/i` also matches the header's `Close dialog`, so match exactly.
            expect(screen.getByRole('button', {name: 'Close'})).toBeInTheDocument();
            expect(screen.getByText('View only — this job is locked')).toBeInTheDocument();

            // Date/time pickers are disabled while locked.
            // Exact 'Date': the dialog's own aria-label ('Edit Date & Time') also matches /Date/i.
            const dateInput = screen.getByLabelText('Date') as HTMLInputElement;
            expect(dateInput).toBeDisabled();
        });
    });

    // ── Dialog Actions ──────────────────────────────────────────────
    describe('Dialog Actions', () => {
        it('calls onClose when Cancel is clicked', async () => {
            const user = setupUser();
            const onClose = jest.fn();
            renderWithProviders(createDefaultProps({onClose}));

            await user.click(screen.getByRole('button', {name: /Cancel/i}));
            expect(onClose).toHaveBeenCalled();
        });

        it('calls onSubmit with correct result when Save is clicked', async () => {
            const user = setupUser();
            const onSubmit = jest.fn();
            renderWithProviders(createDefaultProps({
                onSubmit,
                fieldName: 'DeliverBy',
                defaultTimeZone: 'America/New_York'
            }));

            await user.click(screen.getByRole('button', {name: /Save/i}));

            await waitFor(() => {
                expect(onSubmit).toHaveBeenCalledWith(
                    expect.objectContaining({fieldName: 'DeliverBy', timezone: 'America/New_York'})
                );
            });
        });
    });

    // ── Clear ───────────────────────────────────────────────────────
    describe('Clear', () => {
        it('does not show a Clear button unless allowClear is set', () => {
            renderWithProviders(createDefaultProps());
            expect(screen.queryByRole('button', {name: /Clear/i})).not.toBeInTheDocument();
        });

        it('shows a Clear button when allowClear is set', () => {
            renderWithProviders(createDefaultProps({allowClear: true}));
            expect(screen.getByRole('button', {name: /Clear/i})).toBeInTheDocument();
        });

        it('submits with cleared: true when Clear is clicked', async () => {
            const user = setupUser();
            const onSubmit = jest.fn();
            renderWithProviders(createDefaultProps({allowClear: true, fieldName: 'CompletedTime', onSubmit}));

            await user.click(screen.getByRole('button', {name: /Clear/i}));

            await waitFor(() => {
                expect(onSubmit).toHaveBeenCalledWith(
                    expect.objectContaining({fieldName: 'CompletedTime', cleared: true})
                );
            });
        });

        it('hides the Clear button in read-only mode', () => {
            renderWithProviders(createDefaultProps({allowClear: true, readOnly: true}));
            expect(screen.queryByRole('button', {name: /Clear/i})).not.toBeInTheDocument();
        });
    });

    // ── Initial Value ───────────────────────────────────────────────
    describe('Initial Value', () => {
        it('initializes without error when no dateTime provided', () => {
            renderWithProviders(createDefaultProps({dateTime: undefined}));
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
    });

    // ── Validation ──────────────────────────────────────────────────
    describe('Validation', () => {
        it('handles invalid date by falling back to current time', async () => {
            const user = setupUser();
            const onSubmit = jest.fn();
            const showToast = jest.fn();
            renderWithProviders(createDefaultProps({dateTime: dayjs('invalid'), onSubmit, showToast}));

            await user.click(screen.getByRole('button', {name: /Save/i}));

            await waitFor(() => {
                expect(onSubmit).toHaveBeenCalled();
            });
            expect(showToast).not.toHaveBeenCalledWith('Please provide valid date/time information', 'warning');
        });

        it('ignores unparseable text and keeps the last valid date', async () => {
            const user = setupUser();
            const onSubmit = jest.fn();
            const showToast = jest.fn();
            renderWithProviders(createDefaultProps({onSubmit, showToast, showDate: true, showTime: false}));

            // DateInput only calls back with a date it parsed, so garbage never reaches
            // state and the previously valid value is what gets saved.
            fireEvent.change(screen.getByLabelText('Date'), {target: {value: 'not-a-date'}});
            await user.click(screen.getByRole('button', {name: /Save/i}));

            await waitFor(() => {
                expect(onSubmit).toHaveBeenCalled();
            });
            expect(onSubmit.mock.calls[0][0].value.format('YYYY-MM-DD')).toBe('2024-03-15');
        });
    });

    // ── Text Input Editability ──────────────────────────────────────
    describe('Text Input Editability', () => {
        it('allows typing in date and time inputs', () => {
            renderWithProviders(createDefaultProps());

            const dateInput = screen.getByLabelText('Date') as HTMLInputElement;
            fireEvent.change(dateInput, {target: {value: '2025-06-15'}});
            expect(dateInput).toHaveValue('2025-06-15');

            // The time picker is segmented: set the hour and the minute separately.
            fireEvent.change(screen.getByLabelText('Hours'), {target: {value: '09'}});
            fireEvent.change(screen.getByLabelText('Minutes'), {target: {value: '45'}});
            expect(screen.getByLabelText('Hours')).toHaveValue('09');
            expect(screen.getByLabelText('Minutes')).toHaveValue('45');
        });

        it('accepts intermediate invalid values without freezing', () => {
            renderWithProviders(createDefaultProps());

            const dateInput = screen.getByLabelText('Date') as HTMLInputElement;
            fireEvent.change(dateInput, {target: {value: '2'}});
            fireEvent.change(dateInput, {target: {value: '20'}});
            fireEvent.change(dateInput, {target: {value: '2025'}});
            expect(screen.getByRole('dialog')).toBeInTheDocument();

            fireEvent.change(dateInput, {target: {value: '2025-06-15'}});
            expect(dateInput).toHaveValue('2025-06-15');
        });

        it('submits successfully after typing a valid date', async () => {
            const user = setupUser();
            const onSubmit = jest.fn();
            renderWithProviders(createDefaultProps({onSubmit}));

            fireEvent.change(screen.getByLabelText('Date'), {target: {value: '2025-12-25'}});
            await user.click(screen.getByRole('button', {name: /Save/i}));

            await waitFor(() => {
                expect(onSubmit).toHaveBeenCalled();
                const result = onSubmit.mock.calls[0][0];
                expect(result.value.year()).toBe(2025);
                expect(result.value.month()).toBe(11);
                expect(result.value.date()).toBe(25);
            });
        });

        it('allows editing date-only and time-only pickers', async () => {
            const user = setupUser();
            const onSubmit = jest.fn();

            // Date-only
            const {unmount} = renderWithProviders(createDefaultProps({showDate: true, showTime: false, onSubmit}));
            fireEvent.change(screen.getByLabelText('Date'), {target: {value: '2026-01-01'}});
            await user.click(screen.getByRole('button', {name: /Save/i}));

            await waitFor(() => {
                const result = onSubmit.mock.calls[0][0];
                expect(result.value.year()).toBe(2026);
                expect(result.value.month()).toBe(0);
                expect(result.value.date()).toBe(1);
            });
            unmount();

            // Time-only
            onSubmit.mockClear();
            renderWithProviders(createDefaultProps({showDate: false, showTime: true, onSubmit}));
            fireEvent.change(screen.getByLabelText('Hours'), {target: {value: '16'}});
            fireEvent.change(screen.getByLabelText('Minutes'), {target: {value: '30'}});
            await user.click(screen.getByRole('button', {name: /Save/i}));

            await waitFor(() => {
                const result = onSubmit.mock.calls[0][0];
                expect(result.value.hour()).toBe(16);
                expect(result.value.minute()).toBe(30);
            });
        });
    });

    // ── Date Processing ─────────────────────────────────────────────
    describe('Date Processing', () => {
        it('sets time to midnight in date-only mode', async () => {
            const user = setupUser();
            const onSubmit = jest.fn();
            renderWithProviders(createDefaultProps({showDate: true, showTime: false, onSubmit}));

            await user.click(screen.getByRole('button', {name: /Save/i}));

            await waitFor(() => {
                const result = onSubmit.mock.calls[0][0];
                expect(result.value.hour()).toBe(0);
                expect(result.value.minute()).toBe(0);
            });
        });

        it('uses minimum date in time-only mode', async () => {
            const user = setupUser();
            const onSubmit = jest.fn();
            renderWithProviders(createDefaultProps({showDate: false, showTime: true, onSubmit}));

            await user.click(screen.getByRole('button', {name: /Save/i}));

            await waitFor(() => {
                const result = onSubmit.mock.calls[0][0];
                expect(result.value.year()).toBe(1900);
                expect(result.value.hour()).toBe(14);
                expect(result.value.minute()).toBe(30);
            });
        });
    });

    // ── Date/Time Independence ──────────────────────────────────────
    describe('Date/Time Independence', () => {
        it('preserves time when date is changed', async () => {
            const user = setupUser();
            const onSubmit = jest.fn();
            renderWithProviders(createDefaultProps({onSubmit}));

            fireEvent.change(screen.getByLabelText('Date'), {target: {value: '2024-07-20'}});
            await user.click(screen.getByRole('button', {name: /Save/i}));

            await waitFor(() => {
                const result = onSubmit.mock.calls[0][0];
                expect(result.value.hour()).toBe(14);
                expect(result.value.minute()).toBe(30);
            });
        });

        it('preserves date when time is changed', async () => {
            const user = setupUser();
            const onSubmit = jest.fn();
            renderWithProviders(createDefaultProps({onSubmit}));

            fireEvent.change(screen.getByLabelText('Time (24-hour)'), {target: {value: '09:15'}});
            await user.click(screen.getByRole('button', {name: /Save/i}));

            await waitFor(() => {
                const result = onSubmit.mock.calls[0][0];
                expect(result.value.year()).toBe(2024);
                expect(result.value.month()).toBe(2);
                expect(result.value.date()).toBe(15);
            });
        });

        it('ignores invalid intermediate date and time values', async () => {
            const user = setupUser();
            const onSubmit = jest.fn();
            renderWithProviders(createDefaultProps({onSubmit}));

            // Invalid intermediate date
            await user.clear(screen.getByLabelText('Date'));
            await user.type(screen.getByLabelText('Date'), '2024-');
            await user.click(screen.getByRole('button', {name: /Save/i}));

            await waitFor(() => {
                const result = onSubmit.mock.calls[0][0];
                expect(result.value.hour()).toBe(14);
                expect(result.value.minute()).toBe(30);
            });
        });
    });

    // ── Loading State ───────────────────────────────────────────────
    describe('Loading State', () => {
        it('disables buttons during loading', async () => {
            const user = setupUser();
            renderWithProviders(createDefaultProps({
                onSubmit: jest.fn(() => new Promise(() => {
                }))
            }));

            await user.click(screen.getByRole('button', {name: /Save/i}));
            expect(await screen.findByText('Saving...')).toBeInTheDocument();
        });
    });

    // ── Timezone-Aware Fallback ─────────────────────────────────────
    describe('Timezone-Aware Fallback Initialization', () => {
        it('initializes with target timezone time when no initialDateTime is provided', async () => {
            const user = setupUser();
            const onSubmit = jest.fn();
            const targetTz = 'America/Denver';
            renderWithProviders(createDefaultProps({dateTime: undefined, defaultTimeZone: targetTz, onSubmit}));

            await user.click(screen.getByRole('button', {name: /Save/i}));

            await waitFor(() => {
                expect(onSubmit).toHaveBeenCalled();
                const result = onSubmit.mock.calls[0][0];
                const expectedInTargetTz = dayjs().tz(targetTz);
                const diffMinutes = Math.abs(
                    result.value.hour() * 60 + result.value.minute()
                    - (expectedInTargetTz.hour() * 60 + expectedInTargetTz.minute())
                );
                expect(diffMinutes).toBeLessThanOrEqual(1);
                expect(result.timezone).toBe(targetTz);
            });
        });
    });
});
