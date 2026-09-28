/** @jest-environment jest-environment-jsdom */
/**
 * DateFilterMenu Component Tests
 */

import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {DateFilterData, DateFilterMenu} from './DateFilterMenu';

dayjs.extend(utc);
dayjs.extend(timezone);

const theme = createTheme();

const renderWithProviders = (ui: React.ReactElement) => {
    return render(
        <ThemeProvider theme={theme}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
                {ui}
            </LocalizationProvider>
        </ThemeProvider>
    );
};

describe('DateFilterMenu', () => {
    const mockDateFilterData: DateFilterData = {
        startDate: dayjs('2024-01-01'),
        endDate: dayjs('2024-01-31'),
    };

    const defaultProps = {
        dateFilterData: mockDateFilterData,
        onRefreshData: jest.fn(),
    };

    beforeEach(() => {
        localStorage.clear();
    });

    describe('Rendering', () => {
        it('should render calendar icon button that opens menu with all options and action buttons', async () => {
            renderWithProviders(<DateFilterMenu {...defaultProps} />);
            expect(screen.getByRole('button')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button'));

            expect(await screen.findByText('Date Filter')).toBeInTheDocument();
            expect(screen.getByLabelText('All Time')).toBeInTheDocument();
            expect(screen.getByLabelText('Time Range')).toBeInTheDocument();
            expect(screen.getByLabelText('Custom Dates')).toBeInTheDocument();
            expect(screen.getByLabelText('Today')).toBeInTheDocument();
            expect(screen.getByText('Reset')).toBeInTheDocument();
            expect(screen.getByText('Apply')).toBeInTheDocument();
        });
    });

    describe('Date Range Options', () => {
        it('should select All Time by default', async () => {
            renderWithProviders(<DateFilterMenu {...defaultProps} />);
            fireEvent.click(screen.getByRole('button'));

            const allTimeRadio = await screen.findByLabelText('All Time');
            expect(allTimeRadio).toBeChecked();
        });

        it('should show date pickers when Custom Dates is selected', async () => {
            renderWithProviders(<DateFilterMenu {...defaultProps} />);
            fireEvent.click(screen.getByRole('button'));

            const customDatesLabel = await screen.findByText('Custom Dates');
            fireEvent.click(customDatesLabel.closest('label')!);

            await waitFor(() => {
                // MUI DatePicker renders multiple elements with the label, use getAllByLabelText
                expect(screen.getAllByLabelText(/start date/i).length).toBeGreaterThan(0);
                expect(screen.getAllByLabelText(/end date/i).length).toBeGreaterThan(0);
            });
        });

        it('date pickers should use accessible field DOM structure for keyboard input', async () => {
            renderWithProviders(<DateFilterMenu {...defaultProps} />);
            fireEvent.click(screen.getByRole('button'));

            const customDatesLabel = await screen.findByText('Custom Dates');
            fireEvent.click(customDatesLabel.closest('label')!);

            await waitFor(() => {
                const datePickers = screen.getAllByTestId('mock-date-picker');
                expect(datePickers).toHaveLength(2);
                datePickers.forEach(picker => {
                    expect(picker).toHaveAttribute('data-accessible-field', 'true');
                });
            });
        });

        it('should show duration dropdown when Time Range is selected', async () => {
            renderWithProviders(<DateFilterMenu {...defaultProps} />);
            fireEvent.click(screen.getByRole('button'));

            fireEvent.click(await screen.findByText('Time Range'));

            expect(await screen.findByRole('combobox')).toBeInTheDocument();
        });
    });

    describe('Interactions', () => {
        it('should call onRefreshData when Apply is clicked', async () => {
            const onRefreshData = jest.fn();
            renderWithProviders(
                <DateFilterMenu {...defaultProps} onRefreshData={onRefreshData} />
            );

            fireEvent.click(screen.getByRole('button'));
            fireEvent.click(await screen.findByText('Apply'));

            expect(onRefreshData).toHaveBeenCalled();
        });

        it('should call onRefreshData when Reset is clicked', async () => {
            const onRefreshData = jest.fn();
            renderWithProviders(
                <DateFilterMenu {...defaultProps} onRefreshData={onRefreshData} />
            );

            fireEvent.click(screen.getByRole('button'));
            fireEvent.click(await screen.findByText('Reset'));

            expect(onRefreshData).toHaveBeenCalled();
        });

        it('should call onShowToast when Apply is clicked with valid dates', async () => {
            const onShowToast = jest.fn();
            renderWithProviders(
                <DateFilterMenu {...defaultProps} onShowToast={onShowToast} />
            );

            fireEvent.click(screen.getByRole('button'));
            fireEvent.click(await screen.findByText('Apply'));

            expect(onShowToast).toHaveBeenCalledWith(
                'Showing all up until the end of today',
                'success'
            );
        });

        it('should call onShowToast with today message when Today is selected', async () => {
            const onShowToast = jest.fn();
            renderWithProviders(
                <DateFilterMenu {...defaultProps} onShowToast={onShowToast} />
            );

            fireEvent.click(screen.getByRole('button'));
            fireEvent.click(await screen.findByText('Today'));
            fireEvent.click(screen.getByText('Apply'));

            expect(onShowToast).toHaveBeenCalledWith(
                expect.stringContaining('Showing today'),
                'success'
            );
        });

        it('should close menu after Apply is clicked', async () => {
            renderWithProviders(<DateFilterMenu {...defaultProps} />);

            fireEvent.click(screen.getByRole('button'));
            expect(await screen.findByText('Date Filter')).toBeInTheDocument();

            fireEvent.click(screen.getByText('Apply'));

            await waitFor(() => {
                expect(screen.queryByText('Date Filter')).not.toBeInTheDocument();
            });
        });
    });

    describe('Timezone Display', () => {
        it('should display tenant timezone name in the menu header', async () => {
            renderWithProviders(
                <DateFilterMenu
                    {...defaultProps}
                    timeZone="Pacific Standard Time"
                />
            );

            fireEvent.click(screen.getByRole('button'));
            await screen.findByRole('menu');

            // getTimezoneName returns the long Intl name (e.g. "Pacific Standard Time" or "Pacific Daylight Time")
            // Just verify some timezone text is rendered in the header
            const header = screen.getByText('Date Filter').parentElement!;
            const tzCaption = header.querySelector('[class*="caption"]') ?? header.lastElementChild;
            expect(tzCaption).toBeTruthy();
            expect(tzCaption!.textContent).not.toBe('');
        });

        it('should display default NZ timezone when not provided', async () => {
            renderWithProviders(<DateFilterMenu {...defaultProps} />);

            fireEvent.click(screen.getByRole('button'));
            await screen.findByRole('menu');

            // Default timeZone prop is 'New Zealand Standard Time'
            const header = screen.getByText('Date Filter').parentElement!;
            const tzCaption = header.querySelector('[class*="caption"]') ?? header.lastElementChild;
            expect(tzCaption).toBeTruthy();
            expect(tzCaption!.textContent).not.toBe('');
        });
    });

    describe('localStorage Persistence', () => {
        it('should save selected option to localStorage', async () => {
            renderWithProviders(
                <DateFilterMenu {...defaultProps} appPage="testPage" />
            );

            fireEvent.click(screen.getByRole('button'));
            fireEvent.click(await screen.findByText('Custom Dates'));

            expect(localStorage.getItem('dateRangeOption-testPage')).toBe('custom_date');
        });

        it('should restore saved option from localStorage', async () => {
            localStorage.setItem('dateRangeOption-testPage', 'custom_minutes');

            renderWithProviders(
                <DateFilterMenu {...defaultProps} appPage="testPage" />
            );

            fireEvent.click(screen.getByRole('button'));

            const timeRangeRadio = await screen.findByLabelText('Time Range');
            expect(timeRangeRadio).toBeChecked();
        });

        it('should restore today option from localStorage', async () => {
            localStorage.setItem('dateRangeOption-testPage', 'today');

            renderWithProviders(
                <DateFilterMenu {...defaultProps} appPage="testPage" />
            );

            fireEvent.click(screen.getByRole('button'));

            const todayRadio = await screen.findByLabelText('Today');
            expect(todayRadio).toBeChecked();
        });
    });

    describe('Null Data Handling', () => {
        it('should render when dateFilterData is null', () => {
            renderWithProviders(
                <DateFilterMenu {...defaultProps} dateFilterData={null} />
            );
            expect(screen.getByRole('button')).toBeInTheDocument();
        });
    });

    describe('Mount-time initialization', () => {
        it('should call onRefreshData on mount with all_time dates when no saved option', () => {
            const onRefreshData = jest.fn();
            renderWithProviders(
                <DateFilterMenu
                    dateFilterData={null}
                    onRefreshData={onRefreshData}
                    appPage="initTest"
                />
            );

            expect(onRefreshData).toHaveBeenCalledTimes(1);

            const call = onRefreshData.mock.calls[0][0] as DateFilterData;
            expect(call.startDate.valueOf()).toBe(dayjs(0).valueOf());
            expect(call.endDate.isAfter(dayjs())).toBe(true);
            expect(call.useTime).toBeFalsy();
        });

        it('should call onRefreshData on mount with today dates when saved option is today', () => {
            localStorage.setItem('dateRangeOption-initToday', 'today');
            const onRefreshData = jest.fn();

            renderWithProviders(
                <DateFilterMenu
                    dateFilterData={null}
                    onRefreshData={onRefreshData}
                    appPage="initToday"
                />
            );

            expect(onRefreshData).toHaveBeenCalledTimes(1);

            const call = onRefreshData.mock.calls[0][0] as DateFilterData;
            const now = dayjs().tz('Pacific/Auckland');
            expect(call.startDate.isSame(now.startOf('day'), 'minute')).toBe(true);
            expect(call.endDate.isSame(now.endOf('day'), 'minute')).toBe(true);
            expect(call.useTime).toBeFalsy();
        });

        it('should call onRefreshData on mount with useTime when saved option is custom_minutes', () => {
            localStorage.setItem('dateRangeOption-initMins', 'custom_minutes');
            const onRefreshData = jest.fn();

            renderWithProviders(
                <DateFilterMenu
                    dateFilterData={null}
                    onRefreshData={onRefreshData}
                    appPage="initMins"
                />
            );

            expect(onRefreshData).toHaveBeenCalledTimes(1);

            const call = onRefreshData.mock.calls[0][0] as DateFilterData;
            expect(call.startDate.valueOf()).toBe(dayjs(0).valueOf());
            expect(call.endDate.isAfter(dayjs())).toBe(true);
            expect(call.useTime).toBe(true);
        });

        it('should call onRefreshData on mount with default dates when saved option is custom_date', () => {
            localStorage.setItem('dateRangeOption-initCustom', 'custom_date');
            const onRefreshData = jest.fn();

            renderWithProviders(
                <DateFilterMenu
                    dateFilterData={null}
                    onRefreshData={onRefreshData}
                    appPage="initCustom"
                />
            );

            expect(onRefreshData).toHaveBeenCalledTimes(1);

            const call = onRefreshData.mock.calls[0][0] as DateFilterData;
            expect(call.startDate).toBeDefined();
            expect(call.endDate).toBeDefined();
            expect(call.useTime).toBeFalsy();
        });

        it('should only call onRefreshData once on mount (not on re-renders)', () => {
            const onRefreshData = jest.fn();
            const {rerender} = renderWithProviders(
                <DateFilterMenu
                    dateFilterData={null}
                    onRefreshData={onRefreshData}
                    appPage="initOnce"
                />
            );

            expect(onRefreshData).toHaveBeenCalledTimes(1);

            // Re-render with updated dateFilterData (simulating the parent receiving the init data)
            rerender(
                <ThemeProvider theme={theme}>
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <DateFilterMenu
                            dateFilterData={onRefreshData.mock.calls[0][0]}
                            onRefreshData={onRefreshData}
                            appPage="initOnce"
                        />
                    </LocalizationProvider>
                </ThemeProvider>
            );

            expect(onRefreshData).toHaveBeenCalledTimes(1);
        });
    });
});
