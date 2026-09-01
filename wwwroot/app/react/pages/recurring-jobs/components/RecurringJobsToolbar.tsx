/**
 * Recurring Jobs Toolbar Component
 *
 * Search, filter, refresh, and export controls for the recurring jobs list.
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActionIcon, Autocomplete, Box, Button, Divider, Group, Loader, Select, Stack, TextInput, Tooltip} from '@mantine/core';
import {
    CRITERION_LABEL_GAP,
    FILTER_CONTROL_HEIGHT,
    GroupLabel,
} from '../../../components/common/filter-fields';
import {Download, FilterX, RefreshCw, Search, X} from 'lucide-react';
import {Icon} from '../../../components/common/icon/Icon';
import {CourierSuggestion, DAYS_OF_WEEK_BITS, DayOfWeekKey, RecurringMode} from '../../../interfaces';
import {useCourierSearch} from '../../../hooks/useCourierApi';
import {useRouteList, useSpeedList} from '../../../hooks/useRecurringJobsApi';

export interface RecurringJobsFilters {
    speedId?: number;
    time?: string;
    courierId?: number;
    daysOfWeek?: number;
    routeId?: number;
}

export interface RecurringJobsToolbarProps {
    searchText: string;
    recurringMode: RecurringMode;
    isLoading: boolean;
    isRefreshing: boolean;
    isExporting: boolean;
    filters: RecurringJobsFilters;
    onSearchChange: (searchText: string) => void;
    onRecurringModeChange: (mode: RecurringMode) => void;
    onFiltersChange: (filters: RecurringJobsFilters) => void;
    onRefresh: () => void;
    onExport: () => void;
}

const DEBOUNCE_DELAY = 300;
const MIN_SEARCH_LENGTH = 2;

const DAYS_ORDER: DayOfWeekKey[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_ABBREVIATIONS: Record<DayOfWeekKey, string> = {
    Monday: 'M',
    Tuesday: 'T',
    Wednesday: 'W',
    Thursday: 'Th',
    Friday: 'F',
    Saturday: 'S',
    Sunday: 'Su',
};

const MODE_BUTTONS: {mode: RecurringMode; label: string; color: string}[] = [
    {mode: RecurringMode.Active, label: 'Active', color: 'green'},
    {mode: RecurringMode.Manual, label: 'Manual', color: 'yellow'},
    {mode: RecurringMode.Inactive, label: 'Inactive', color: 'gray'},
];

export const RecurringJobsToolbar: React.FC<RecurringJobsToolbarProps> = ({
                                                                              searchText,
                                                                              recurringMode,
                                                                              isLoading,
                                                                              isRefreshing,
                                                                              isExporting,
                                                                              filters,
                                                                              onSearchChange,
                                                                              onRecurringModeChange,
                                                                              onFiltersChange,
                                                                              onRefresh,
                                                                              onExport,
                                                                          }) => {
    const [localSearchText, setLocalSearchText] = useState(searchText);
    const [courierSearchText, setCourierSearchText] = useState('');
    const [selectedCourier, setSelectedCourier] = useState<CourierSuggestion | null>(null);
    const [courierInputValue, setCourierInputValue] = useState('');
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch speed list, courier search, and route list
    const {data: speeds = []} = useSpeedList();
    const {data: routes = []} = useRouteList();
    const {data: courierSuggestions = [], isLoading: isLoadingCouriers} = useCourierSearch(courierSearchText);

    // Sync local state with prop
    useEffect(() => {
        setLocalSearchText(searchText);
    }, [searchText]);

    // Clear selected courier if filter is cleared externally
    useEffect(() => {
        if (!filters.courierId && selectedCourier) {
            setSelectedCourier(null);
        }
    }, [filters.courierId, selectedCourier]);

    const handleSearchInputChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const value = event.target.value;
            setLocalSearchText(value);

            // Clear any existing timer
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }

            // Debounce the search
            debounceTimerRef.current = setTimeout(() => {
                if (value.length === 0 || value.length >= MIN_SEARCH_LENGTH) {
                    onSearchChange(value);
                }
            }, DEBOUNCE_DELAY);
        },
        [onSearchChange]
    );

    const handleClearSearch = useCallback(() => {
        setLocalSearchText('');
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        onSearchChange('');
    }, [onSearchChange]);

    const handleRecurringModeChange = useCallback(
        (_event: React.MouseEvent<HTMLElement>, newValue: RecurringMode | null) => {
            if (newValue !== null) {
                onRecurringModeChange(newValue);
            }
        },
        [onRecurringModeChange]
    );

    // Filter handlers
    const handleSpeedChange = useCallback(
        (value: string | null) => {
            onFiltersChange({
                ...filters,
                speedId: !value ? undefined : Number(value),
            });
        },
        [filters, onFiltersChange]
    );

    const handleRouteChange = useCallback(
        (value: string | null) => {
            onFiltersChange({
                ...filters,
                routeId: !value ? undefined : Number(value),
            });
        },
        [filters, onFiltersChange]
    );

    /**
     * Mantine's Autocomplete is a free-text string input with no object value, so
     * the typed text drives the search and a courier is only "picked" when it
     * matches a suggestion exactly. Anything else clears the filter, which keeps
     * a half-typed name from silently holding the previous courier.
     */
    const handleCourierInputChange = useCallback(
        (value: string) => {
            setCourierInputValue(value);
            setCourierSearchText(value);

            const match = courierSuggestions.find((option) => option.text === value) ?? null;
            setSelectedCourier(match);
            if (match?.id !== filters.courierId) {
                onFiltersChange({...filters, courierId: match?.id});
            }
        },
        [courierSuggestions, filters, onFiltersChange]
    );

    const handleDayToggle = useCallback(
        (day: DayOfWeekKey) => {
            const dayBit = DAYS_OF_WEEK_BITS[day];
            const currentDays = filters.daysOfWeek || 0;
            const newDays = (currentDays & dayBit) ? (currentDays & ~dayBit) : (currentDays | dayBit);
            onFiltersChange({
                ...filters,
                daysOfWeek: newDays || undefined,
            });
        },
        [filters, onFiltersChange]
    );

    const isDaySelected = useCallback(
        (day: DayOfWeekKey) => {
            return ((filters.daysOfWeek || 0) & DAYS_OF_WEEK_BITS[day]) !== 0;
        },
        [filters.daysOfWeek]
    );

    const handleClearFilters = useCallback(() => {
        setSelectedCourier(null);
        setCourierSearchText('');
        onFiltersChange({
            speedId: undefined,
            courierId: undefined,
            daysOfWeek: undefined,
            routeId: undefined,
        });
    }, [onFiltersChange]);

    /*
     * Days is a bitmask, so its contribution is the number of bits set — a
     * multi-select owes the reader a count, not just "on".
     */
    const selectedDayCount = DAYS_ORDER.filter(isDaySelected).length;

    /*
     * What Clear all would actually clear. It labels the button so the reset is
     * quantified before it is pressed, and disables it when there is nothing to
     * undo — the control keeps its place either way, so it is always where the
     * reader last saw it.
     */
    const activeCriteriaCount =
        (filters.speedId !== undefined ? 1 : 0)
        + (filters.courierId !== undefined ? 1 : 0)
        + (filters.routeId !== undefined ? 1 : 0)
        + selectedDayCount;

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    return (
        <Box
            bg="var(--mantine-color-gray-0)"
            style={{
                display: 'flex',
                flexDirection: 'column',
                borderBottom: '1px solid var(--mantine-color-default-border)',
            }}
        >
            {/* Main toolbar row */}
            <Group gap={16} p={12} wrap="nowrap" align="flex-end">
                {/* Search Field */}
                <TextInput
                    size="xs"
                    placeholder="Search jobs..."
                    aria-label="Search jobs"
                    value={localSearchText}
                    onChange={handleSearchInputChange}
                    disabled={isLoading}
                    w={250}
                    styles={{input: {height: FILTER_CONTROL_HEIGHT, minHeight: FILTER_CONTROL_HEIGHT}}}
                    leftSection={<Icon lucide={Search} size={20}/>}
                    rightSection={localSearchText ? (
                        <ActionIcon
                            variant="subtle"
                            color="gray"
                            size="sm"
                            onClick={handleClearSearch}
                            aria-label="Clear search"
                        >
                            <Icon lucide={X} size={18}/>
                        </ActionIcon>
                    ) : null}
                />

                <Divider role="separator" orientation="vertical" h={FILTER_CONTROL_HEIGHT} style={{alignSelf: 'flex-end'}}/>

                {/* Active / Manual / Inactive Filter (Steve 2026-06-09) */}
                <Stack gap={CRITERION_LABEL_GAP}>
                    <GroupLabel selected={recurringMode != null ? 1 : 0}>Status</GroupLabel>
                    <Button.Group>
                    {MODE_BUTTONS.map(({mode, label, color}) => {
                        const selected = recurringMode === mode;
                        return (
                            <Button
                                key={label}
                                size="xs"
                                px={16}
                                h={FILTER_CONTROL_HEIGHT}
                                disabled={isLoading}
                                variant={selected ? 'filled' : 'default'}
                                color={selected ? color : undefined}
                                aria-pressed={selected}
                                onClick={(event) => handleRecurringModeChange(event, selected ? null : mode)}
                            >
                                {label}
                            </Button>
                        );
                    })}
                    </Button.Group>
                </Stack>

                {/* Spacer */}
                <div style={{flex: 1}}/>

                {/* Refresh Button */}
                <Tooltip label="Refresh">
                    {/* The span survives the conversion: a disabled control fires no
                        pointer events, so without it the tooltip never opens. */}
                    <span>
                        <ActionIcon
                            variant="default"
                            size={FILTER_CONTROL_HEIGHT}
                            onClick={onRefresh}
                            disabled={isRefreshing}
                            aria-label="Refresh"
                        >
                            {isRefreshing ? <Loader size={20} role="progressbar" aria-label="Refreshing"/> : <Icon lucide={RefreshCw}/>}
                        </ActionIcon>
                    </span>
                </Tooltip>

                {/* Export Button */}
                <Tooltip label="Export to CSV">
                    <span>
                        <ActionIcon
                            variant="default"
                            size={FILTER_CONTROL_HEIGHT}
                            onClick={onExport}
                            disabled={isLoading || isExporting}
                            aria-label="Export to CSV"
                        >
                            {isExporting ? <Loader size={20} role="progressbar" aria-label="Exporting"/> : <Icon lucide={Download}/>}
                        </ActionIcon>
                    </span>
                </Tooltip>
            </Group>

            {/* Filters row */}
            <Group gap={16} px={12} pb={12} align="flex-end">
                {/* Speed Filter */}
                <Stack gap={CRITERION_LABEL_GAP}>
                    <GroupLabel selected={filters.speedId !== undefined ? 1 : 0}>Speed</GroupLabel>
                    <Select
                    size="xs"
                    aria-label="Speed"
                    styles={{input: {height: FILTER_CONTROL_HEIGHT, minHeight: FILTER_CONTROL_HEIGHT}}}
                    miw={120}
                    disabled={isLoading}
                    value={filters.speedId != null ? String(filters.speedId) : ''}
                    onChange={handleSpeedChange}
                    data={[
                        {value: '', label: 'All'},
                        ...speeds.map((speed) => ({value: String(speed.id), label: speed.text})),
                    ]}
                    />
                </Stack>

                <Divider role="separator" orientation="vertical" h={FILTER_CONTROL_HEIGHT} style={{alignSelf: 'flex-end'}}/>

                {/* Courier Filter */}
                {/* Mantine's Autocomplete is a free-text string input — it has no object
                    value — so the picked courier is resolved from its label here. */}
                <Stack gap={CRITERION_LABEL_GAP}>
                    <GroupLabel selected={filters.courierId !== undefined ? 1 : 0}>Courier</GroupLabel>
                    <Autocomplete
                    size="xs"
                    aria-label="Courier"
                    styles={{input: {height: FILTER_CONTROL_HEIGHT, minHeight: FILTER_CONTROL_HEIGHT}}}
                    w={200}
                    disabled={isLoading}
                    value={courierInputValue}
                    onChange={handleCourierInputChange}
                    data={courierSuggestions.map((option) => option.text)}
                    rightSection={isLoadingCouriers ? <Loader size={16} role="progressbar" aria-label="Loading couriers"/> : undefined}
                    />
                </Stack>

                <Divider role="separator" orientation="vertical" h={FILTER_CONTROL_HEIGHT} style={{alignSelf: 'flex-end'}}/>

                {/* Days of Week Filter */}
                <Stack gap={CRITERION_LABEL_GAP}>
                    <GroupLabel selected={selectedDayCount}>Days</GroupLabel>
                    {/* Multi-select, so these stay individual buttons rather than any
                        single-value control. */}
                    <Button.Group>
                        {DAYS_ORDER.map((day) => {
                            const selected = isDaySelected(day);
                            return (
                                <Button
                                    key={day}
                                    size="compact-xs"
                                    miw={32}
                                    h={FILTER_CONTROL_HEIGHT}
                                    fz="0.75rem"
                                    disabled={isLoading}
                                    variant={selected ? 'filled' : 'default'}
                                    aria-pressed={selected}
                                    onClick={() => handleDayToggle(day)}
                                >
                                    {DAY_ABBREVIATIONS[day]}
                                </Button>
                            );
                        })}
                    </Button.Group>
                </Stack>

                <Divider role="separator" orientation="vertical" h={FILTER_CONTROL_HEIGHT} style={{alignSelf: 'flex-end'}}/>

                {/* Recurring Route Filter */}
                <Stack gap={CRITERION_LABEL_GAP}>
                    <GroupLabel selected={filters.routeId !== undefined ? 1 : 0}>Route</GroupLabel>
                    <Select
                    size="xs"
                    aria-label="Route"
                    styles={{input: {height: FILTER_CONTROL_HEIGHT, minHeight: FILTER_CONTROL_HEIGHT}}}
                    miw={180}
                    disabled={isLoading}
                    value={filters.routeId != null ? String(filters.routeId) : ''}
                    onChange={handleRouteChange}
                    data={[
                        {value: '', label: 'All'},
                        ...routes.map((route) => ({value: String(route.id), label: route.text})),
                    ]}
                    />
                </Stack>

                {/* Spacer, so the reset keeps the row's end regardless of how wide
                    the criteria before it run. */}
                <div style={{flex: 1}}/>

                {/*
                  * Always present, disabled when there is nothing to undo, rather
                  * than appearing with the selection: a control that comes and goes
                  * moves the layout and cannot be relied on to be where it was last
                  * seen, which is the opposite of a predictable place to reset.
                  */}
                <Button
                    size="xs"
                    variant="subtle"
                    color="gray"
                    h={FILTER_CONTROL_HEIGHT}
                    disabled={isLoading || activeCriteriaCount === 0}
                    onClick={handleClearFilters}
                    leftSection={<Icon lucide={FilterX} size={16}/>}
                >
                    {activeCriteriaCount > 0 ? `Clear all (${activeCriteriaCount})` : 'Clear all'}
                </Button>
            </Group>
        </Box>
    );
};

export default RecurringJobsToolbar;
