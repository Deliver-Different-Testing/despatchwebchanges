/**
 * RecurringJobFields Component Tests
 */

import React from 'react';
import {render, screen, fireEvent, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {ThemeProvider} from '@mui/material/styles';
import dayjs from 'dayjs';
import {RecurringJobFields} from './RecurringJobFields';
import {createMockJob} from '../__testUtils__/mockJob';
import {testTheme} from '../../../../__testUtils__';
import {DaysOfWeek} from '../../../../../enums/days-of-week.enum';
import {Frequency} from '../../../../../enums/frequency.enum';

function renderWithTheme(ui: React.ReactElement) {
    return render(<ThemeProvider theme={testTheme}>{ui}</ThemeProvider>);
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
        onEditSavedFlight: jest.fn(),
        onAddFlight: jest.fn(),
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

    it('renders day-of-week chips with correct selection state and weekend coloring', () => {
        const props = createDefaultProps({
            daysOfWeekArray: [DaysOfWeek.Monday, DaysOfWeek.Wednesday, DaysOfWeek.Friday, DaysOfWeek.Saturday, DaysOfWeek.Sunday],
        });
        renderWithTheme(<RecurringJobFields {...props} />);
        expect(screen.getByText('Monday')).toBeInTheDocument();
        expect(screen.getByText('Tuesday')).toBeInTheDocument();
        expect(screen.getByText('Wednesday')).toBeInTheDocument();
        expect(screen.getByText('Thursday')).toBeInTheDocument();
        expect(screen.getByText('Friday')).toBeInTheDocument();
        expect(screen.getByText('Saturday')).toBeInTheDocument();
        expect(screen.getByText('Sunday')).toBeInTheDocument();

        // Weekday selected → primary. Weekend selected → secondary. Unselected
        // weekday → default outlined (so we just assert it's not primary).
        const mondayChip = screen.getByText('Monday').closest('.MuiChip-root');
        const tuesdayChip = screen.getByText('Tuesday').closest('.MuiChip-root');
        const saturdayChip = screen.getByText('Saturday').closest('.MuiChip-root');
        const sundayChip = screen.getByText('Sunday').closest('.MuiChip-root');
        expect(mondayChip).toHaveClass('MuiChip-colorPrimary');
        expect(tuesdayChip).not.toHaveClass('MuiChip-colorPrimary');
        expect(saturdayChip).toHaveClass('MuiChip-colorSecondary');
        expect(sundayChip).toHaveClass('MuiChip-colorSecondary');
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

    it('renders schedule fields and the full holiday-option set, firing onHolidayOptionChange with the enum value', async () => {
        const user = userEvent.setup();
        const onHolidayOptionChange = jest.fn();
        renderWithTheme(<RecurringJobFields {...createDefaultProps({onHolidayOptionChange})} />);
        expect(screen.getByText('Recurring Schedule')).toBeInTheDocument();
        expect(screen.getByText('Schedule Dates')).toBeInTheDocument();
        expect(screen.getByText('First Due')).toBeInTheDocument();
        expect(screen.getByText('Stop Date')).toBeInTheDocument();
        expect(screen.getByText('Restart Date')).toBeInTheDocument();
        const frequencyLabels = screen.getAllByText('Frequency');
        expect(frequencyLabels.length).toBeGreaterThanOrEqual(1);
        const holidayLabels = screen.getAllByText('Holiday');
        expect(holidayLabels.length).toBeGreaterThanOrEqual(1);

        // Open the Holiday Select — MUI renders options into a portal popover
        // on click, so we have to expand it before option text is queryable.
        // MUI's plain Select doesn't link the InputLabel via aria-labelledby
        // (the label is positioned visually but not in the a11y tree), so
        // by-name role queries don't work; instead, take the second combobox
        // since Frequency renders first in the same Stack.
        const comboboxes = screen.getAllByRole('combobox');
        await user.click(comboboxes[1]);
        const holidayListbox = await screen.findByRole('listbox');
        expect(within(holidayListbox).getByText("Don't Book")).toBeInTheDocument();
        expect(within(holidayListbox).getByText('Deliver Next Day')).toBeInTheDocument();
        expect(within(holidayListbox).getByText('Book Anyway')).toBeInTheDocument();

        await user.click(within(holidayListbox).getByText('Book Anyway'));
        expect(onHolidayOptionChange).toHaveBeenCalledWith(2);
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

    it('renders firstDue via the long-date formatter rather than the raw ISO toString', () => {
        // Parse without an offset so the formatter uses local midnight and the
        // expected day-of-month stays stable across CI timezones.
        const job = createMockJob({
            preBook: true,
            firstDue: dayjs('2026-04-15'),
        });
        renderWithTheme(<RecurringJobFields {...createDefaultProps({job})} />);

        // Long-date format is locale-aware: "Apr/15/2026" (US) or "15/Apr/2026" (rest).
        // Either is acceptable; what matters is that the raw ISO string is gone.
        expect(screen.getByText(/(Apr\/15\/2026|15\/Apr\/2026)/)).toBeInTheDocument();
        expect(screen.queryByText(/2026-04-15T00:00:00/)).not.toBeInTheDocument();
    });

    it('hovering a date field reveals a tooltip carrying the pickup timezone abbreviation', async () => {
        const user = userEvent.setup();
        const job = createMockJob({
            preBook: true,
            // Override the mock's NZ timezone so the abbreviation is non-empty —
            // getTimezoneAbbreviation returns '' for NZ tenants by design.
            pickUpTimeZone: {id: 2, text: 'Pacific Standard Time'},
            _stopDateStr: '15/Apr/2026',
            stopDate: dayjs('2026-04-15T00:00:00+13:00'),
        });
        renderWithTheme(<RecurringJobFields {...createDefaultProps({job})} />);

        await user.hover(screen.getByText('15/Apr/2026'));

        const tip = await screen.findByRole('tooltip');
        // ICU timezone short names follow DST — PST in winter, PDT in summer.
        expect(tip.textContent).toMatch(/\(P[SD]T\)/);
        expect(tip.textContent).toMatch(/Stop Date/);
    });

    it('renders an Add-flight card (not the saved-flight editor) for a non-flight booking and fires onAddFlight', () => {
        const onAddFlight = jest.fn();
        const job = createMockJob({preBook: true, fromAirportId: undefined, toAirportId: undefined});
        renderWithTheme(<RecurringJobFields {...createDefaultProps({job, onAddFlight})} />);

        // The editable saved-flight card is absent; the add-flight prompt is shown.
        expect(screen.queryByText('Saved Flight')).not.toBeInTheDocument();
        expect(screen.getByText('Add flight')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Add flight'));
        expect(onAddFlight).toHaveBeenCalled();
    });

    it('renders the Flight card with the saved flight number for a flight booking', () => {
        const job = createMockJob({preBook: true, fromAirportId: 1, toAirportId: 2, savedFlightNumber: 'NZ123'});
        renderWithTheme(<RecurringJobFields {...createDefaultProps({job})} />);
        expect(screen.getByText('Saved Flight')).toBeInTheDocument();
        expect(screen.getByText('NZ123')).toBeInTheDocument();
    });

    it('shows "Not set" and fires onEditSavedFlight when the Flight card is clicked', () => {
        const onEditSavedFlight = jest.fn();
        const job = createMockJob({preBook: true, fromAirportId: 1, toAirportId: 2, savedFlightNumber: undefined});
        renderWithTheme(<RecurringJobFields {...createDefaultProps({job, onEditSavedFlight})} />);

        // The Flight card's row shows "Not set" (date rows may too — scope to this row).
        const flightRow = screen.getByText('Saved Flight').closest('[role="button"]') as HTMLElement;
        expect(within(flightRow).getByText('Not set')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Saved Flight'));
        expect(onEditSavedFlight).toHaveBeenCalled();
    });
});
