/**
 * DateFilterMenu Component Tests
 */

import React from 'react';
import {fireEvent, screen, waitFor} from '@testing-library/react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {DateFilterData, DateFilterMenu} from './DateFilterMenu';
import {renderWithMantine} from '../../../test/utils';
import {getInputDateFormat} from '../../../utils/dateUtils';
import {loadDateFilterFrom} from '../../../utils/dateFilterStorage';
import {useDateFilter} from '../../../hooks/useDateFilter';
import {getContactId} from '../../../api/session';

dayjs.extend(utc);
dayjs.extend(timezone);

const renderWithProviders = (
    ui: React.ReactElement,
    options?: Parameters<typeof renderWithMantine>[1]
) => renderWithMantine(ui, options);

/** The dropdown is a `Popover`, so the trigger is the only button until it opens. */
const openMenu = () => fireEvent.click(screen.getByRole('button', {name: 'Date filter'}));

/** The saved range option is per user, like the range it pairs with. */
const optionKey = (appPage: string) => `dateRangeOption-${appPage}-${getContactId()}`;

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
        it('should style its trigger like the Mantine shell icons beside it', () => {
            // The trigger is now an `ActionIcon size="lg"` like the rest of the bar, so its
            // box comes from the variant rather than a hand-set 34px — the only thing left
            // to pin is the shared per-tenant glyph colour. The hover-grow itself is a
            // `:hover`/`:focus-visible` CSS-module rule, unreachable from `toHaveStyle`.
            renderWithProviders(<DateFilterMenu {...defaultProps} />);

            const trigger = screen.getByRole('button', {name: 'Date filter'});
            expect(trigger.style.color).toBe('var(--dd-on-shell)');
        });

        it('should render calendar icon button that opens menu with all options and action buttons', async () => {
            renderWithProviders(<DateFilterMenu {...defaultProps} />);
            expect(screen.getByRole('button', {name: 'Date filter'})).toBeInTheDocument();

            openMenu();

            expect(await screen.findByText('Date filter')).toBeInTheDocument();
            expect(screen.getByLabelText('All time')).toBeInTheDocument();
            expect(screen.getByLabelText('Time range')).toBeInTheDocument();
            expect(screen.getByLabelText('Custom dates')).toBeInTheDocument();
            expect(screen.getByLabelText('Today')).toBeInTheDocument();
            // The instant presets and the two that open a configurator are separated.
            expect(screen.getAllByRole('separator').length).toBeGreaterThan(0);
            expect(screen.getByText('Reset')).toBeInTheDocument();
            expect(screen.getByText('Apply')).toBeInTheDocument();
        });
    });

    describe('Date Range Options', () => {
        it('should select All Time by default', async () => {
            renderWithProviders(<DateFilterMenu {...defaultProps} />);
            openMenu();

            expect(await screen.findByLabelText('All time')).toBeChecked();
        });

        /**
         * Both fields are plain text inputs with a calendar dropdown — one element per
         * label, not MUI's multi-section field, so a single `getByLabelText` suffices.
         */
        it('should show date pickers when Custom Dates is selected', async () => {
            renderWithProviders(<DateFilterMenu {...defaultProps} />);
            openMenu();

            await selectOption('Custom dates');

            await waitFor(() => {
                expect(screen.getByLabelText('Start date')).toBeInTheDocument();
                expect(screen.getByLabelText('End date')).toBeInTheDocument();
            });
        });

        it('date fields accept typed text directly (no menu keyboard handler to fight)', async () => {
            renderWithProviders(<DateFilterMenu {...defaultProps} />);
            openMenu();
            await selectOption('Custom dates');

            const start = await screen.findByLabelText('Start date');
            fireEvent.change(start, {target: {value: '15/06/2024'}});
            expect(start).toHaveValue('15/06/2024');
        });

        /**
         * `DateInput` hangs its calendar off a nested `Popover`. Left portalled, that
         * calendar lands outside the panel's own dropdown node, so the panel reads a day
         * click as a click-outside and dismisses itself mid-pick. These render with
         * `env: 'default'` because Mantine's test env skips portals altogether — the very
         * thing under test. `Reset` stands in for "the panel is open": the header text
         * doubles as the trigger's tooltip once focus returns to it.
         */
        describe('calendar dropdown does not dismiss the panel', () => {
            const openStartCalendar = async () => {
                openMenu();
                await selectOption('Custom dates');

                const start = await screen.findByLabelText('Start date');
                fireEvent.click(start);
                await waitFor(() => expect(document.querySelector('[data-dates-dropdown]')).toBeInTheDocument());

                return start;
            };

            it('picking a day closes only the calendar', async () => {
                (window as any).serverConfig = {isUSCustomer: true};
                renderWithProviders(<DateFilterMenu {...defaultProps} />, {env: 'default'});
                const start = await openStartCalendar();

                // `mousedown`, not `click`, is what a Mantine popover treats as a dismissal.
                const day = screen.getByLabelText('15 January 2024');
                fireEvent.mouseDown(day);
                fireEvent.click(day);

                await waitFor(() => expect(document.querySelector('[data-dates-dropdown]')).not.toBeInTheDocument());
                expect(screen.getByText('Reset')).toBeInTheDocument();
                expect(start).toHaveValue('01/15/2024');
            });

            it('escape closes the calendar first and the panel second', async () => {
                renderWithProviders(<DateFilterMenu {...defaultProps} />, {env: 'default'});
                const start = await openStartCalendar();

                fireEvent.keyDown(start, {key: 'Escape'});

                await waitFor(() => expect(document.querySelector('[data-dates-dropdown]')).not.toBeInTheDocument());
                expect(screen.getByText('Reset')).toBeInTheDocument();

                fireEvent.keyDown(start, {key: 'Escape'});

                await waitFor(() => expect(screen.queryByText('Reset')).not.toBeInTheDocument());
            });
        });

        it('should show duration dropdown when Time Range is selected', async () => {
            renderWithProviders(<DateFilterMenu {...defaultProps} />);
            openMenu();

            await selectOption('Time range');

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
            await selectOption('Custom dates');
            return screen.findByLabelText('Start date');
        };

        it('uses US format (MM/DD/YYYY) for US customers', async () => {
            (window as any).serverConfig = {isUSCustomer: true};
            renderWithProviders(<DateFilterMenu {...defaultProps} />);

            await openCustomDates();

            expect(screen.getByLabelText('Start date')).toHaveValue('01/01/2024');
            expect(screen.getByLabelText('End date')).toHaveValue('01/31/2024'); // month-first
            expect(screen.getAllByPlaceholderText('MM/DD/YYYY')).toHaveLength(2);
        });

        it('uses NZ format (DD/MM/YYYY) for non-US customers', async () => {
            (window as any).serverConfig = {isUSCustomer: false};
            renderWithProviders(<DateFilterMenu {...defaultProps} />);

            await openCustomDates();

            expect(screen.getByLabelText('End date')).toHaveValue('31/01/2024'); // day-first
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
            expect(await screen.findByText('Date filter')).toBeInTheDocument();

            fireEvent.click(screen.getByText('Apply'));

            await waitFor(() => {
                expect(screen.queryByText('Date filter')).not.toBeInTheDocument();
            });
        });
    });

    describe('Timezone Display', () => {
        /** The header carries the title plus the tenant's long zone name beside it. */
        const headerText = async () => {
            const title = await screen.findByText('Date filter');
            return title.parentElement!.textContent!;
        };

        it('should display tenant timezone name in the menu header', async () => {
            renderWithProviders(
                <DateFilterMenu {...defaultProps} timeZone="Pacific Standard Time" />
            );

            openMenu();

            // getTimezoneName returns the long Intl name, which shifts with DST, so the
            // assertion is that *something* beyond the title is rendered.
            expect(await headerText()).not.toBe('Date filter');
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
            await selectOption('Custom dates');

            expect(localStorage.getItem(optionKey('testPage'))).toBe('custom_date');
        });

        it('should restore saved option from localStorage', async () => {
            localStorage.setItem(optionKey('testPage'), 'custom_minutes');

            renderWithProviders(
                <DateFilterMenu {...defaultProps} appPage="testPage" />
            );

            openMenu();

            expect(await screen.findByLabelText('Time range')).toBeChecked();
        });

        it('should save all_time when Reset is clicked', async () => {
            renderWithProviders(
                <DateFilterMenu {...defaultProps} appPage="testPage" />
            );

            openMenu();
            await selectOption('Custom dates');
            fireEvent.click(screen.getByText('Reset'));

            expect(localStorage.getItem(optionKey('testPage'))).toBe('all_time');
        });

        it('should honour a per-browser option saved before options were per user, and move it to the user', async () => {
            localStorage.setItem('dateRangeOption-legacy', 'today');

            renderWithProviders(<DateFilterMenu {...defaultProps} appPage="legacy" />);
            openMenu();

            expect(await screen.findByLabelText('Today')).toBeChecked();
            expect(localStorage.getItem(optionKey('legacy'))).toBe('today');
        });

        it("should not pick up another user's saved option", async () => {
            (window as unknown as {ContactID: number}).ContactID = 7;
            const first = renderWithProviders(<DateFilterMenu {...defaultProps} appPage="shared" />);
            openMenu();
            await selectOption('Today');
            first.unmount();

            (window as unknown as {ContactID: number}).ContactID = 8;
            renderWithProviders(<DateFilterMenu {...defaultProps} appPage="shared" />);
            openMenu();

            expect(await screen.findByLabelText('All time')).toBeChecked();
        });

        it('should restore today option from localStorage', async () => {
            localStorage.setItem(optionKey('testPage'), 'today');

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
            expect(screen.getByRole('button', {name: 'Date filter'})).toBeInTheDocument();
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
            localStorage.setItem(optionKey('initToday'), 'today');
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
            localStorage.setItem(optionKey('initMins'), 'custom_minutes');
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

        it('should keep the persisted custom range on mount and show it when opened', async () => {
            localStorage.setItem(optionKey('initCustom'), 'custom_date');
            const onRefreshData = jest.fn();
            const persisted: DateFilterData = {
                startDate: dayjs('2026-10-01'),
                endDate: dayjs('2026-10-15'),
            };

            renderWithProviders(
                <DateFilterMenu
                    dateFilterData={persisted}
                    onRefreshData={onRefreshData}
                    appPage="initCustom"
                />
            );

            expect(onRefreshData).not.toHaveBeenCalled();

            openMenu();

            const format = getInputDateFormat();
            expect(await screen.findByLabelText('Custom dates')).toBeChecked();
            expect(screen.getByLabelText('Start date')).toHaveValue(persisted.startDate.format(format));
            expect(screen.getByLabelText('End date')).toHaveValue(persisted.endDate.format(format));
        });

        it('should fall back to All time when the saved option is custom_date but no range is stored', async () => {
            localStorage.setItem(optionKey('initCustomAllTime'), 'custom_date');
            const onRefreshData = jest.fn();

            renderWithProviders(
                <DateFilterMenu
                    dateFilterData={{startDate: dayjs(0), endDate: dayjs().add(24, 'hours')}}
                    onRefreshData={onRefreshData}
                    appPage="initCustomAllTime"
                />
            );

            expect(onRefreshData).not.toHaveBeenCalled();
            expect(localStorage.getItem(optionKey('initCustomAllTime'))).toBe('all_time');

            openMenu();
            expect(await screen.findByLabelText('All time')).toBeChecked();

            await selectOption('Custom dates');

            const format = getInputDateFormat();
            const now = dayjs().tz('Pacific/Auckland');
            expect(await screen.findByLabelText('Start date')).toHaveValue(now.subtract(7, 'days').format(format));
            expect(screen.getByLabelText('End date')).toHaveValue(now.format(format));
        });

        it('should keep the page-persisted custom range across a reload', async () => {
            const rangeKey = 'dateFilter-reload-test';
            const start = dayjs('2026-10-01');
            const end = dayjs('2026-10-15');
            localStorage.setItem(optionKey('reload'), 'custom_date');
            localStorage.setItem(rangeKey, JSON.stringify({startDate: start, endDate: end, useTime: false}));
            const stored = localStorage.getItem(rangeKey);

            const Page = () => {
                const [filter, setFilter] = useDateFilter(rangeKey, () => loadDateFilterFrom(rangeKey));
                return (
                    <DateFilterMenu
                        dateFilterData={filter}
                        appPage="reload"
                        onRefreshData={(next) => setFilter({...next, useTime: next.useTime ?? false})}
                    />
                );
            };

            renderWithProviders(<Page/>).unmount();
            renderWithProviders(<Page/>);

            expect(localStorage.getItem(rangeKey)).toBe(stored);

            openMenu();

            const format = getInputDateFormat();
            expect(await screen.findByLabelText('Start date')).toHaveValue(start.format(format));
            expect(screen.getByLabelText('End date')).toHaveValue(end.format(format));
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
