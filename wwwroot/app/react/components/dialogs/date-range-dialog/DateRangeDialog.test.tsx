/**
 * DateRangeDialog Component Tests
 *
 * Consolidated: the read-only assertions share one render per scenario.
 */

import React from 'react';
import {screen} from '@testing-library/react';
import {DateRangeDialog, DateRangeDialogProps} from './DateRangeDialog';
import { createProps, renderWithMantine } from '../../../__testUtils__';
import { setupUser } from '../../../__testUtils__/setupUser';
import dayjs from 'dayjs';

const defaultProps: DateRangeDialogProps = {
    open: true,
    onClose: jest.fn(),
    onApply: jest.fn(),
};

const createMockProps = (overrides?: Partial<DateRangeDialogProps>) =>
    createProps(defaultProps, overrides);

describe('DateRangeDialog', () => {
    describe('Rendering', () => {
        it('renders the header, both calendars and both actions when open', () => {
            renderWithMantine(<DateRangeDialog {...createMockProps()} />);

            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText('Select Date Range')).toBeInTheDocument();
            expect(screen.getByText('Choose a start and end date for your report')).toBeInTheDocument();
            expect(screen.getByText('From')).toBeInTheDocument();
            expect(screen.getByText('To')).toBeInTheDocument();
            // Each calendar is labelled by its card title, so they are distinguishable.
            expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
            expect(screen.getByLabelText('End Date')).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /cancel/i})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /apply/i})).toBeInTheDocument();
        });

        it('does not render dialog when open is false', () => {
            renderWithMantine(<DateRangeDialog {...createMockProps({open: false})} />);

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('defaults both ends to today when no initial range is provided', () => {
            renderWithMantine(<DateRangeDialog {...createMockProps()} />);

            expect(screen.getAllByText(dayjs().format('MMM D, YYYY')).length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Summary bar', () => {
        it('shows both formatted dates and the inclusive day count', () => {
            const initialRange = {start: new Date(2024, 5, 10), end: new Date(2024, 5, 15)};
            renderWithMantine(<DateRangeDialog {...createMockProps({initialRange})} />);

            expect(screen.getByText('Jun 10, 2024')).toBeInTheDocument();
            expect(screen.getByText('Jun 15, 2024')).toBeInTheDocument();
            expect(screen.getByText('6 Days')).toBeInTheDocument();
            expect(screen.queryByText('Invalid')).not.toBeInTheDocument();
        });

        it('counts a same-day range as one day and still allows Apply', () => {
            const sameDay = new Date(2024, 0, 15);
            renderWithMantine(<DateRangeDialog {...createMockProps({initialRange: {start: sameDay, end: sameDay}})} />);

            expect(screen.getByText('1 Day')).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /apply/i})).not.toBeDisabled();
        });
    });

    describe('Actions', () => {
        it('calls onClose from both the header close button and Cancel', async () => {
            const user = setupUser();
            const onClose = jest.fn();
            renderWithMantine(<DateRangeDialog {...createMockProps({onClose})} />);

            await user.click(screen.getByRole('button', {name: 'Close dialog'}));
            expect(onClose).toHaveBeenCalledTimes(1);

            await user.click(screen.getByRole('button', {name: /cancel/i}));
            expect(onClose).toHaveBeenCalledTimes(2);
        });

        it('calls onApply with the picked range', async () => {
            const user = setupUser();
            const onApply = jest.fn();
            const initialRange = {start: new Date(2024, 0, 15), end: new Date(2024, 0, 20)};
            renderWithMantine(<DateRangeDialog {...createMockProps({onApply, initialRange})} />);

            await user.click(screen.getByRole('button', {name: /apply/i}));

            expect(onApply).toHaveBeenCalledWith({
                start: expect.any(Date),
                end: expect.any(Date),
            });
            const {start, end} = onApply.mock.calls[0][0];
            expect(dayjs(start).format('YYYY-MM-DD')).toBe('2024-01-15');
            expect(dayjs(end).format('YYYY-MM-DD')).toBe('2024-01-20');
        });
    });

    /**
     * Two things are pinned here. The bounds are what stop the calendars producing
     * an inverted range, so the "Invalid" state is unreachable by clicking. And each
     * calendar has to *open on its own value's month* — a Mantine calendar does not
     * navigate to `value` on its own, and without `defaultDate` a range in any other
     * month renders as a fully disabled current month.
     */
    describe('Cross-wired bounds', () => {
        const dayIn = (calendar: HTMLElement, label: string) =>
            calendar.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);

        it('opens on the range month and disables days past the other end', () => {
            const initialRange = {start: new Date(2024, 0, 10), end: new Date(2024, 0, 15)};
            renderWithMantine(<DateRangeDialog {...createMockProps({initialRange})} />);

            const startCalendar = screen.getByLabelText('Start Date');
            const endCalendar = screen.getByLabelText('End Date');

            expect(dayIn(startCalendar, '14 January 2024')).toBeEnabled();
            expect(dayIn(startCalendar, '16 January 2024')).toBeDisabled();
            expect(dayIn(endCalendar, '9 January 2024')).toBeDisabled();
            expect(dayIn(endCalendar, '20 January 2024')).toBeEnabled();
        });
    });
});
