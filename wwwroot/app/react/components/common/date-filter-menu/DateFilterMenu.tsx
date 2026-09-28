/**
 * React Date Filter Menu Component
 *
 * A dropdown panel for filtering data by date range.
 * Supports: All Time, Time Range (minutes), and Custom Date Range.
 *
 * **A `Popover`, not a `Menu`.** The dropdown holds a form — radios, two date
 * fields, a select and two action buttons — and a menu's item semantics fight
 * that: MUI's `Menu` owns keyboard navigation and type-ahead, which is why the
 * old date fields each carried an `onKeyDown` `stopPropagation()` guard just so
 * the user could type a date. `Popover` has no such claim on the keys, so the
 * guards are gone.
 *
 * **Wall-clock only.** `DateInput` is string-valued (`YYYY-MM-DD`), so the picker
 * cannot introduce an instant. Everything that *does* need a zone — the
 * all-time/today/rolling-window bounds — still goes through `dayjs().tz(iana)`
 * exactly as before, unchanged by this conversion.
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
    ActionIcon, Box, Button, Divider, Group, Popover, Radio, Select, Stack, Text, Tooltip,
} from '@mantine/core';
import {DateInput} from '@mantine/dates';
import {Calendar, CalendarRange} from 'lucide-react';
import dayjs, {Dayjs} from 'dayjs';
import {getIanaTimezone, getInputDateFormat, getTimezoneName} from '../../../utils/dateUtils';
import {Icon} from '../icon/Icon';
import {toolbarIconButtonClassName, toolbarIconButtonStyle} from '../app-toolbar/toolbarIconStyles';

/** The string form `DateInput` speaks. */
const ISO_DATE = 'YYYY-MM-DD';

/**
 * Keep the calendar inside this panel's dropdown. Portalled — Mantine's default — it
 * lands in `document.body`, outside the node the panel's click-outside check walks, so
 * picking a day dismisses the whole panel instead of just the calendar.
 */
const calendarPopoverProps = {withinPortal: false} as const;

// Types
export interface DateFilterData {
    startDate: Dayjs;
    endDate: Dayjs;
    useTime?: boolean;
}

export type DateRangeOption = 'all_time' | 'today' | 'custom_minutes' | 'custom_date';

interface DurationOption {
    id: number;
    text: string;
}

export interface DateFilterMenuProps {
    dateFilterData: DateFilterData | null;
    appPage?: string;
    timeZone?: string;
    onRefreshData: (dateFilterData: DateFilterData) => void;
    onShowToast?: (message: string, type: 'success' | 'warning' | 'error') => void;
}

// Helper functions
function getMinsSelectionOptions(
    startSeconds: number = 300,
    intervalSeconds: number = 300,
    maxMinutes: number = 180
): DurationOption[] {
    const options: DurationOption[] = [];
    const maxSeconds = maxMinutes * 60;

    for (let seconds = startSeconds; seconds <= maxSeconds; seconds += intervalSeconds) {
        options.push({
            id: seconds,
            text: formatDuration(seconds),
        });
    }

    return options;
}

function formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;

    if (hours > 0) {
        if (remainingMins === 0) {
            return hours === 1 ? '1 hour' : `${hours} hours`;
        }
        return `${hours}h ${remainingMins}m`;
    }

    return minutes === 1 ? '1 min' : `${minutes} mins`;
}

function setDateFilterDefaults(ianaTimeZone: string): DateFilterData {
    return {
        startDate: dayjs(0).tz(ianaTimeZone),
        endDate: dayjs().tz(ianaTimeZone).add(24, 'hours'),
    };
}

export const DateFilterMenu: React.FC<DateFilterMenuProps> = ({
                                                                  dateFilterData,
                                                                  appPage = 'default',
                                                                  timeZone = 'New Zealand Standard Time',
                                                                  onRefreshData,
                                                                  onShowToast,
                                                              }) => {
    const [opened, setOpened] = useState(false);

    const ianaTimeZone = getIanaTimezone(timeZone);
    const timeZoneLong = getTimezoneName(timeZone);

    const storageKey = `dateRangeOption-${appPage}`;

    // State
    const [selectedRangeOption, setSelectedRangeOption] = useState<DateRangeOption>('all_time');
    const [startDate, setStartDate] = useState<Dayjs>(dayjs().tz(ianaTimeZone));
    const [endDate, setEndDate] = useState<Dayjs>(dayjs().tz(ianaTimeZone).add(24, 'hours'));
    const [selectedMinsOption, setSelectedMinsOption] = useState<number>(10800); // 3 hours default

    // `Select` is string-valued; the durations are seconds, so they round-trip
    // through `String()`/`Number()` at the boundary.
    const minsOptions = useMemo(
        () => getMinsSelectionOptions(300, 300, 180).map(({id, text}) => ({value: String(id), label: text})),
        [],
    );
    const minsUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const prevDateFilterRef = useRef<DateFilterData | null>(null);

    // Load saved option from localStorage and emit initial date filter data
    const initializedRef = useRef(false);
    useEffect(() => {
        if (initializedRef.current) return;
        initializedRef.current = true;

        let option: DateRangeOption = 'all_time';
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved && ['all_time', 'today', 'custom_minutes', 'custom_date'].includes(saved)) {
                option = saved as DateRangeOption;
                setSelectedRangeOption(option);
            }
        } catch {
            // Ignore localStorage errors
        }

        // Compute and emit initial dates so the job list fetches with the correct range
        const defaults = setDateFilterDefaults(ianaTimeZone);
        let initStart: Dayjs;
        let initEnd: Dayjs;
        let useTime = false;

        switch (option) {
            case 'today':
                initStart = dayjs().tz(ianaTimeZone).startOf('day');
                initEnd = dayjs().tz(ianaTimeZone).endOf('day');
                break;
            case 'custom_minutes':
                initStart = defaults.startDate;
                initEnd = dayjs().tz(ianaTimeZone).add(selectedMinsOption, 'seconds');
                useTime = true;
                startMinsUpdate(selectedMinsOption);
                break;
            case 'custom_date':
                // For custom dates, use whatever is already in state (defaults)
                initStart = startDate;
                initEnd = endDate;
                break;
            case 'all_time':
            default:
                initStart = defaults.startDate;
                initEnd = defaults.endDate;
                break;
        }

        setStartDate(initStart);
        setEndDate(initEnd);
        onRefreshData({startDate: initStart, endDate: initEnd, useTime});
    }, [storageKey]); // eslint-disable-line react-hooks/exhaustive-deps

    // Update local state when dateFilterData changes (compare actual values, not object reference)
    useEffect(() => {
        if (dateFilterData) {
            const prev = prevDateFilterRef.current;
            const startChanged = !prev || !dateFilterData.startDate.isSame(prev.startDate);
            const endChanged = !prev || !dateFilterData.endDate.isSame(prev.endDate);

            if (startChanged) setStartDate(dateFilterData.startDate);
            if (endChanged) setEndDate(dateFilterData.endDate);
        }
        prevDateFilterRef.current = dateFilterData;
    }, [dateFilterData]);

    // Cleanup interval on unmount
    useEffect(() => {
        return () => {
            if (minsUpdateIntervalRef.current) {
                clearInterval(minsUpdateIntervalRef.current);
            }
        };
    }, []);

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        // The trigger sits inside AngularJS chrome that also listens for clicks.
        event.preventDefault();
        event.stopPropagation();
        setOpened((prev) => !prev);
    };

    const handleClose = () => {
        setOpened(false);
    };

    // A `DateInput` calendar swallows the first Escape itself; the panel takes the next
    // one. Mantine's own `closeOnEscape` runs in the capture phase, ahead of the field,
    // so it has to be off for the calendar to get a look in — hence this handler.
    const handleDropdownKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Escape' && !event.currentTarget.querySelector('[data-dates-dropdown]')) {
            handleClose();
        }
    };

    const stopMinsUpdate = useCallback(() => {
        if (minsUpdateIntervalRef.current) {
            clearInterval(minsUpdateIntervalRef.current);
            minsUpdateIntervalRef.current = null;
        }
    }, []);

    const startMinsUpdate = useCallback((seconds: number) => {
        stopMinsUpdate();

        minsUpdateIntervalRef.current = setInterval(() => {
            const defaults = setDateFilterDefaults(ianaTimeZone);
            const newEndDate = dayjs().tz(ianaTimeZone).add(seconds, 'seconds');

            setStartDate(defaults.startDate);
            setEndDate(newEndDate);

            onRefreshData({
                startDate: defaults.startDate,
                endDate: newEndDate,
                useTime: true,
            });
        }, 60000); // Update every minute
    }, [ianaTimeZone, onRefreshData, stopMinsUpdate]);

    const handleRangeOptionChange = useCallback(async (option: DateRangeOption) => {
        setSelectedRangeOption(option);
        stopMinsUpdate();

        const defaults = setDateFilterDefaults(ianaTimeZone);
        let newStartDate = startDate;
        let newEndDate = endDate;
        let useTime = false;

        switch (option) {
            case 'all_time':
                newStartDate = defaults.startDate;
                newEndDate = defaults.endDate;
                break;

            case 'today':
                newStartDate = dayjs().tz(ianaTimeZone).startOf('day');
                newEndDate = dayjs().tz(ianaTimeZone).endOf('day');
                break;

            case 'custom_date':
                // Keep current dates or set reasonable defaults
                if (!startDate || startDate.valueOf() === 0) {
                    newStartDate = dayjs().tz(ianaTimeZone).subtract(7, 'days');
                }
                if (!endDate || endDate.valueOf() === 0) {
                    newEndDate = dayjs().tz(ianaTimeZone);
                }
                break;

            case 'custom_minutes':
                newStartDate = defaults.startDate;
                newEndDate = dayjs().tz(ianaTimeZone).add(selectedMinsOption, 'seconds');
                useTime = true;
                startMinsUpdate(selectedMinsOption);
                break;
        }

        setStartDate(newStartDate);
        setEndDate(newEndDate);

        // Save to localStorage
        try {
            localStorage.setItem(storageKey, option);
        } catch {
            // Ignore
        }

        onRefreshData({
            startDate: newStartDate,
            endDate: newEndDate,
            useTime,
        });
    }, [ianaTimeZone, startDate, endDate, selectedMinsOption, startMinsUpdate, stopMinsUpdate, storageKey, onRefreshData]);

    const handleMinsOptionChange = useCallback((seconds: number) => {
        setSelectedMinsOption(seconds);

        const defaults = setDateFilterDefaults(ianaTimeZone);
        const newEndDate = dayjs().tz(ianaTimeZone).add(seconds, 'seconds');

        setStartDate(defaults.startDate);
        setEndDate(newEndDate);

        stopMinsUpdate();
        startMinsUpdate(seconds);

        onRefreshData({
            startDate: defaults.startDate,
            endDate: newEndDate,
            useTime: true,
        });
    }, [ianaTimeZone, startMinsUpdate, stopMinsUpdate, onRefreshData]);

    const handleClear = useCallback(() => {
        stopMinsUpdate();

        const defaults = setDateFilterDefaults(ianaTimeZone);
        setStartDate(defaults.startDate);
        setEndDate(defaults.endDate);
        setSelectedRangeOption('all_time');

        onRefreshData(defaults);
    }, [ianaTimeZone, stopMinsUpdate, onRefreshData]);

    const handleApply = useCallback(() => {
        if (startDate.isAfter(endDate)) {
            onShowToast?.('Start date cannot be after end date', 'warning');
            return;
        }

        onRefreshData({
            startDate,
            endDate,
            useTime: selectedRangeOption === 'custom_minutes',
        });

        let toastMessage: string;
        switch (selectedRangeOption) {
            case 'all_time':
                toastMessage = 'Showing all up until the end of today';
                break;
            case 'today':
                toastMessage = `Showing today (${startDate.format('MMM DD, YYYY')})`;
                break;
            case 'custom_minutes': {
                const minutes = Math.floor(selectedMinsOption / 60);
                toastMessage = `Showing all up until ${minutes} mins from now`;
                break;
            }
            case 'custom_date':
                toastMessage = `Showing ${startDate.format('MMM DD, YYYY')} - ${endDate.format('MMM DD, YYYY')}`;
                break;
        }

        onShowToast?.(toastMessage, 'success');

        handleClose();
    }, [startDate, endDate, selectedRangeOption, selectedMinsOption, onRefreshData, onShowToast]);

    const inputFormat = getInputDateFormat();

    const rangeSummary = selectedRangeOption === 'custom_date'
        ? `${startDate.format('MMM DD, YYYY')} — ${endDate.format('MMM DD, YYYY')}`
        : `All Time — ${endDate.format('MMM DD, h:mm A')}`;

    return (
        <Popover
            opened={opened}
            onChange={setOpened}
            onDismiss={handleClose}
            position="bottom-end"
            width={320}
            shadow="md"
            withinPortal
            closeOnEscape={false}
        >
            <Popover.Target>
                <Tooltip label="Date Filter">
                    {/* Same box, glyph colour and hover grow as every other shell icon —
                        the shared style/class pair is the single source for all three. */}
                    <ActionIcon
                        variant="subtle"
                        size="lg"
                        onClick={handleClick}
                        aria-label="Date Filter"
                        className={toolbarIconButtonClassName}
                        style={toolbarIconButtonStyle}
                    >
                        <Icon lucide={Calendar} size={18}/>
                    </ActionIcon>
                </Tooltip>
            </Popover.Target>
            <Popover.Dropdown p={0} onKeyDown={handleDropdownKeyDown}>
                {/* Header */}
                <Group
                    gap="sm"
                    px="md"
                    py="sm"
                    bg="var(--mantine-color-default-hover)"
                    style={{borderBottom: '1px solid var(--mantine-color-default-border)'}}
                >
                    <Icon lucide={CalendarRange} size={20} color="var(--mantine-primary-color-filled)"/>
                    <Text size="sm" fw={600}>Date Filter</Text>
                    {timeZoneLong && (
                        <Text size="xs" c="dimmed" ml="auto">{timeZoneLong}</Text>
                    )}
                </Group>

                {/* Content */}
                <Box p="md">
                    <Radio.Group
                        value={selectedRangeOption}
                        onChange={(value) => handleRangeOptionChange(value as DateRangeOption)}
                    >
                        {/* Deliberately uncoloured: four date presets carry no meaning
                            for a colour to encode. The split that does exist — pick and
                            go, versus pick and then configure — is the divider. */}
                        <Stack gap="xs">
                            <Radio value="all_time" label="All Time"/>
                            <Radio value="today" label="Today"/>
                            <Divider my={2}/>
                            <Radio value="custom_minutes" label="Time Range"/>
                            <Radio value="custom_date" label="Custom Dates"/>
                        </Stack>
                    </Radio.Group>

                    {selectedRangeOption === 'custom_date' && (
                        <Stack gap="md" mt="md">
                            <DateInput
                                label="Start Date"
                                value={startDate.format(ISO_DATE)}
                                onChange={(value) => value && setStartDate(dayjs(value))}
                                valueFormat={inputFormat}
                                placeholder={inputFormat}
                                size="sm"
                                popoverProps={calendarPopoverProps}
                            />
                            <DateInput
                                label="End Date"
                                value={endDate.format(ISO_DATE)}
                                onChange={(value) => value && setEndDate(dayjs(value))}
                                valueFormat={inputFormat}
                                placeholder={inputFormat}
                                size="sm"
                                popoverProps={calendarPopoverProps}
                            />
                            <Text size="xs" c="dimmed" ta="center">{rangeSummary}</Text>
                        </Stack>
                    )}

                    {selectedRangeOption === 'custom_minutes' && (
                        <Stack gap="xs" mt="md">
                            <Select
                                label="Duration"
                                value={String(selectedMinsOption)}
                                onChange={(value) => value && handleMinsOptionChange(Number(value))}
                                data={minsOptions}
                                allowDeselect={false}
                                size="sm"
                            />
                            <Text size="xs" c="dimmed" ta="center">{rangeSummary}</Text>
                        </Stack>
                    )}
                </Box>

                <Divider/>

                <Group justify="flex-end" gap="xs" p="sm">
                    <Button size="xs" variant="subtle" onClick={handleClear}>
                        Reset
                    </Button>
                    <Button size="xs" onClick={handleApply}>
                        Apply
                    </Button>
                </Group>
            </Popover.Dropdown>
        </Popover>
    );
};

export default DateFilterMenu;
