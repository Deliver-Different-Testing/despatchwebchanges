/** @jest-environment jest-environment-jsdom */
/**
 * RecurringJobFields Component Tests
 */

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {RecurringJobFields} from './RecurringJobFields';
import {createMockJob} from '../__testUtils__/mockJob';
import {DaysOfWeek} from '../../../../../enums/days-of-week.enum';
import {Frequency} from '../../../../../enums/frequency.enum';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
    return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

function createDefaultProps(overrides?: Record<string, any>) {
    return {
        job: createMockJob({preBook: true, frequency: Frequency.Weekly}),
        daysOfWeekArray: [DaysOfWeek.Monday, DaysOfWeek.Wednesday, DaysOfWeek.Friday],
        dense: false,
        onDaysOfWeekChange: jest.fn(),
        onFrequencyChange: jest.fn(),
        onHolidayOptionChange: jest.fn(),
        onEditFirstDue: jest.fn(),
        onEditStopDate: jest.fn(),
        onEditRestartDate: jest.fn(),
        ...overrides,
    };
}

describe('RecurringJobFields', () => {
    it('renders nothing when job is not a recurring job (preBook false)', () => {
        const job = createMockJob({preBook: false});
        const {container} = renderWithTheme(
            <RecurringJobFields {...createDefaultProps({job})} />
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders section title', () => {
        renderWithTheme(<RecurringJobFields {...createDefaultProps()} />);
        expect(screen.getByText('Recurring Job Settings')).toBeInTheDocument();
    });

    it('renders day-of-week chips with correct selection state', () => {
        renderWithTheme(<RecurringJobFields {...createDefaultProps()} />);
        expect(screen.getByText('Monday')).toBeInTheDocument();
        expect(screen.getByText('Tuesday')).toBeInTheDocument();
        expect(screen.getByText('Wednesday')).toBeInTheDocument();
        expect(screen.getByText('Thursday')).toBeInTheDocument();
        expect(screen.getByText('Friday')).toBeInTheDocument();
        expect(screen.getByText('Saturday')).toBeInTheDocument();
        expect(screen.getByText('Sunday')).toBeInTheDocument();

        const mondayChip = screen.getByText('Monday').closest('.MuiChip-root');
        const tuesdayChip = screen.getByText('Tuesday').closest('.MuiChip-root');
        expect(mondayChip).toHaveClass('MuiChip-colorPrimary');
        expect(tuesdayChip).not.toHaveClass('MuiChip-colorPrimary');
    });

    it('calls onDaysOfWeekChange when a day chip is clicked to add', () => {
        const onDaysOfWeekChange = jest.fn();
        renderWithTheme(
            <RecurringJobFields {...createDefaultProps({onDaysOfWeekChange})} />
        );
        fireEvent.click(screen.getByText('Tuesday'));
        expect(onDaysOfWeekChange).toHaveBeenCalledWith(
            expect.arrayContaining([DaysOfWeek.Monday, DaysOfWeek.Tuesday, DaysOfWeek.Wednesday, DaysOfWeek.Friday])
        );
    });

    it('calls onDaysOfWeekChange when a day chip is clicked to remove', () => {
        const onDaysOfWeekChange = jest.fn();
        renderWithTheme(
            <RecurringJobFields {...createDefaultProps({onDaysOfWeekChange})} />
        );
        fireEvent.click(screen.getByText('Monday'));
        expect(onDaysOfWeekChange).toHaveBeenCalledWith(
            expect.arrayContaining([DaysOfWeek.Wednesday, DaysOfWeek.Friday])
        );
        expect(onDaysOfWeekChange).toHaveBeenCalledWith(
            expect.not.arrayContaining([DaysOfWeek.Monday])
        );
    });

    it('renders schedule fields', () => {
        renderWithTheme(<RecurringJobFields {...createDefaultProps()} />);
        expect(screen.getByText('First Due')).toBeInTheDocument();
        expect(screen.getByText('Stop Date')).toBeInTheDocument();
        expect(screen.getByText('Restart Date')).toBeInTheDocument();
        const frequencyLabels = screen.getAllByText('Frequency');
        expect(frequencyLabels.length).toBeGreaterThanOrEqual(1);
        const holidayLabels = screen.getAllByText('Holiday');
        expect(holidayLabels.length).toBeGreaterThanOrEqual(1);
    });

    it('calls onEditFirstDue when First Due is clicked', () => {
        const onEditFirstDue = jest.fn();
        renderWithTheme(<RecurringJobFields {...createDefaultProps({onEditFirstDue})} />);

        const firstDueText = screen.getByText('First Due');
        const listItemButton = firstDueText.closest('[role="button"]') || firstDueText.parentElement;
        if (listItemButton) fireEvent.click(listItemButton);
        expect(onEditFirstDue).toHaveBeenCalled();
    });

    it('calls onEditStopDate when Stop Date is clicked', () => {
        const onEditStopDate = jest.fn();
        const job = createMockJob({preBook: true, _stopDateStr: '2026-04-01'});
        renderWithTheme(<RecurringJobFields {...createDefaultProps({onEditStopDate, job})} />);

        fireEvent.click(screen.getByText('2026-04-01'));
        expect(onEditStopDate).toHaveBeenCalled();
    });
});
