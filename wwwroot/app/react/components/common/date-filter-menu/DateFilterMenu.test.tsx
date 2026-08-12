/**
 * DateFilterMenu Component Tests
 */

import React from 'react';
import {fireEvent, screen, waitFor} from '@testing-library/react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {DateFilterData, DateFilterMenu} from './DateFilterMenu';
import {renderWithMantine} from '../../../__testUtils__';

dayjs.extend(utc);
dayjs.extend(timezone);

const renderWithProviders = (ui: React.ReactElement) => renderWithMantine(ui);

/** The dropdown is a `Popover`, so the trigger is the only button until it opens. */
const openMenu = () => fireEvent.click(screen.getByRole('button', {name: 'Date Filter'}));

const selectOption = async (label: string) => {
    fireEvent.click(await screen.findByLabelText(label));
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
        it('should wash its trigger like the Mantine shell icons beside it', () => {
            // The trigger is now an `ActionIcon size="lg"` like the rest of the bar, so its
            // box comes from the variant rather than a hand-set 34px — the only thing left
            // to pin is the shared per-tenant hover wash, which rides a custom property
            // because the `:hover` rule itself is unreachable from `toHaveStyle`.
            renderWithProviders(<DateFilterMenu {...defaultProps} />);

            const trigger = screen.getByRole('button', {name: 'Date Filter'});
            expect(trigger.style.getPropertyValue('--ai-hover')).toBe('var(--dd-shell-icon-hover)');
            expect(trigger.style.color).toBe('var(--dd-on-shell)');
        });

        it('should render calendar icon button that opens menu with all options and action buttons', async () => {
            renderWithProviders(<DateFilterMenu {...defaultProps} />);
            expect(screen.getByRole('button', {name: 'Date Filter'})).toBeInTheDocument();

            openMenu();

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
            openMenu();

            expect(await screen.findByLabelText('All Time')).toBeChecked();
        });

        /**
         * Both fields are plain text inputs with a calendar dropdown — one element per
         * label, not MUI's multi-section field, so a single `getByLabelText` suffices.
         */
        it('should show date pickers when Custom Dates is selected', async () => {
            renderWithProviders(<DateFilterMenu {...defaultProps} />);
            openMenu();

            await selectOption('Custom Dates');

            await waitFor(() => {
                expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
                expect(screen.getByLabelText('End Date')).toBeInTheDocument();
            });
        });

        it('date fields accept typed text directly (no menu keyboard handler to fight)', async () => {
            renderWithProviders(<DateFilterMenu {...defaultProps} />);
            openMenu();
            await selectOption('Custom Dates');

            const start = await screen.findByLabelText('Start Date');
            fireEvent.change(start, {target: {value: '15/06/2024'}});
            expect(start).toHaveValue('15/06/2024');
        });

        it('should show duration dropdown when Time Range is selected', async () => {
            renderWithProviders(<DateFilterMenu {...defaultProps} />);
            openMenu();

            await selectOption('Time Range');

            // Queried by its displayed value: `Select` pairs its visible input with a
            // hidden one, so the "Duration" label matches two elements.
            expect(await screen.findByDisplayValue('3 hours')).toBeInTheDocument();
        });
    });

    describe('Locale-aware date format', () => {
        const originalServerConfig = (window as any).serverConfig;

        afterEach(() => {
            (window as any).serverConfig = originalServerConfig;
        });

        const openCustomDates = async () => {
            openMenu();
            await selectOption('Custom Dates');
            return screen.findByLabelText('Start Date');
        };

        it('uses US format (MM/DD/YYYY) for US customers', async () => {
            (window as any).serverConfig = {isUSCustomer: true};
            renderWithProviders(<DateFilterMenu {...defaultProps} />);

            await openCustomDates();

            expect(screen.getByLabelText('Start Date')).toHaveValue('01/01/2024');
            expect(screen.getByLabelText('End Date')).toHaveValue('01/31/2024'); // month-first
            expect(screen.getAllByPlaceholderText('MM/DD/YYYY')).toHaveLength(2);
        });

        it('uses NZ format (DD/MM/YYYY) for non-US customers', async () => {
            (window as any).serverConfig = {isUSCustomer: false};
            renderWithProviders(<DateFilterMenu {...defaultProps} />);

            await openCustomDates();

            expect(screen.getByLabelText('End Date')).toHaveValue('31/01/2024'); // day-first
            expect(screen.getAllByPlaceholderText('DD/MM/YYYY')).toHaveLength(2);
        });
    });

    describe('Interactions', () => {
        it('should call onRefreshData when Apply is clicked', async () => {
            const onRefreshData = jest.fn();
            renderWithProviders(
                <DateFilterMenu {...defaultProps} onRefreshData={onRefreshData} />
            );

            openMenu();
            fireEvent.click(await screen.findByText('Apply'));

            expect(onRefreshData).toHaveBeenCalled();
        });

        it('should call onRefreshData when Reset is clicked', async () => {
            const onRefreshData = jest.fn();
            renderWithProviders(
                <DateFilterMenu {...defaultProps} onRefreshData={onRefreshData} />
            );

            openMenu();
            fireEvent.click(await screen.findByText('Reset'));

            expect(onRefreshData).toHaveBeenCalled();
        });

        it('should call onShowToast when Apply is clicked with valid dates', async () => {
            const onShowToast = jest.fn();
            renderWithProviders(
                <DateFilterMenu {...defaultProps} onShowToast={onShowToast} />
            );

            openMenu();
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

            openMenu();
            await selectOption('Today');
            fireEvent.click(screen.getByText('Apply'));

            expect(onShowToast).toHaveBeenCalledWith(
                expect.stringContaining('Showing today'),
                'success'
            );
        });

        it('should close menu after Apply is clicked', async () => {
            renderWithProviders(<DateFilterMenu {...defaultProps} />);

            openMenu();
            expect(await screen.findByText('Date Filter')).toBeInTheDocument();

            fireEvent.click(screen.getByText('Apply'));

            await waitFor(() => {
                expect(screen.queryByText('Date Filter')).not.toBeInTheDocument();
            });
        });
    });

    describe('Timezone Display', () => {
        /** The header carries the title plus the tenant's long zone name beside it. */
        const headerText = async () => {
            const title = await screen.findByText('Date Filter');
            return title.parentElement!.textContent!;
        };

        it('should display tenant timezone name in the menu header', async () => {
            renderWithProviders(
                <DateFilterMenu {...defaultProps} timeZone="Pacific Standard Time" />
            );

            openMenu();

            // getTimezoneName returns the long Intl name, which shifts with DST, so the
            // assertion is that *something* beyond the title is rendered.
            expect(await headerText()).not.toBe('Date Filter');
        });

        it('should display default NZ timezone when not provided', async () => {
            renderWithProviders(<DateFilterMenu {...defaultProps} />);

            openMenu();

            expect(await headerText()).toMatch(/New Zealand/);
        });
    });

    describe('localStorage Persistence', () => {
        it('should save selected option to localStorage', async () => {
            renderWithProviders(
                <DateFilterMenu {...defaultProps} appPage="testPage" />
            );

            openMenu();
            await selectOption('Custom Dates');

            expect(localStorage.getItem('dateRangeOption-testPage')).toBe('custom_date');
        });

        it('should restore saved option from localStorage', async () => {
            localStorage.setItem('dateRangeOption-testPage', 'custom_minutes');

            renderWithProviders(
                <DateFilterMenu {...defaultProps} appPage="testPage" />
            );

            openMenu();

            expect(await screen.findByLabelText('Time Range')).toBeChecked();
        });

        it('should restore today option from localStorage', async () => {
            localStorage.setItem('dateRangeOption-testPage', 'today');

            renderWithProviders(
                <DateFilterMenu {...defaultProps} appPage="testPage" />
            );

            openMenu();

            expect(await screen.findByLabelText('Today')).toBeChecked();
        });
    });

    describe('Null Data Handling', () => {
        it('should render when dateFilterData is null', () => {
            renderWithProviders(
                <DateFilterMenu {...defaultProps} dateFilterData={null} />
            );
            expect(screen.getByRole('button', {name: 'Date Filter'})).toBeInTheDocument();
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

            // Re-render *without* re-wrapping the provider — re-wrapping remounts the
            // subtree and the mount effect would fire a second time.
            rerender(
                <DateFilterMenu
                    dateFilterData={onRefreshData.mock.calls[0][0]}
                    onRefreshData={onRefreshData}
                    appPage="initOnce"
                />
            );

            expect(onRefreshData).toHaveBeenCalledTimes(1);
        });
    });
});
