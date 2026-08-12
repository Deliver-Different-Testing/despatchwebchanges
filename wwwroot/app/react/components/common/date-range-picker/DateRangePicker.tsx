/**
 * DateRangePicker Component
 *
 * React replacement for the AngularJS date range selection in jobSearch.
 * Renders preset range buttons (Today, Fortnight, Month, Custom) and
 * optional From/To date inputs when Custom is selected.
 *
 * **Wall-clock only.** Mantine's `DateInput` is string-valued (`YYYY-MM-DD`), so
 * nothing here builds an instant and there is no zone to convert. The tenant's
 * day-first/month-first order stays owned by `dateUtils`: `valueFormat` renders
 * it and `dateParser` reads it back, so a US tenant types `MM/DD/YYYY` and an NZ
 * tenant `DD/MM/YYYY` exactly as before.
 *
 * The previous version hand-built this control — a `TextField`, a calendar
 * `IconButton`, a `Popover` and a `DateCalendar`, plus its own text/commit/revert
 * state — because MUI's `DatePicker` field edits in spinbutton sections and
 * mangles fast typing. Mantine's `DateInput` *is* a free-text field with a
 * calendar dropdown, so all of that is now props: `dateParser` for typed input
 * and `fixOnBlur` for the revert-to-last-valid behaviour.
 */

import React, {useCallback} from 'react';
import {Box, Group, SegmentedControl, Stack} from '@mantine/core';
import {DateInput as MantineDateInput} from '@mantine/dates';
import {CalendarDays} from 'lucide-react';
import dayjs, {Dayjs} from 'dayjs';
import {getInputDateFormat, parseInputDate} from '../../../utils/dateUtils';
import {Icon} from '../icon/Icon';

export interface DateRangePickerProps {
    dateSearchRange: string;
    fromDate: Dayjs;
    toDate: Dayjs;
    onSearchRangeChange: (range: string) => void;
    onFromDateChange: (dateTime: Dayjs) => void;
    onToDateChange: (dateTime: Dayjs) => void;
}

const RANGE_OPTIONS = [
    {value: 'today', label: 'Today'},
    {value: 'fortnight', label: 'Fortnight'},
    {value: 'month', label: 'Month'},
    {value: 'custom', label: 'Custom'},
];

/** The string form both the picker and `parseInputDate` agree on. */
const ISO_DATE = 'YYYY-MM-DD';

interface RangeDateInputProps {
    label: string;
    value: Dayjs;
    onChange: (dateTime: Dayjs) => void;
}

const RangeDateInput: React.FC<RangeDateInputProps> = ({label, value, onChange}) => {
    const inputFormat = getInputDateFormat();

    const handleChange = useCallback((next: string | null) => {
        if (next) {
            onChange(dayjs(next));
        }
    }, [onChange]);

    return (
        <Box style={{flex: '1 1 120px', minWidth: 0}}>
            <MantineDateInput
                label={label}
                value={value?.isValid() ? value.format(ISO_DATE) : null}
                onChange={handleChange}
                valueFormat={inputFormat}
                // Typed text is read in the tenant's order by `dateUtils`, not by
                // dayjs — which would ignore the format without `customParseFormat`.
                dateParser={(input) => parseInputDate(input)?.format(ISO_DATE) ?? null}
                placeholder={inputFormat}
                rightSection={<Icon lucide={CalendarDays} size={16}/>}
                rightSectionPointerEvents="none"
                size="sm"
                labelProps={{size: 'xs', c: 'dimmed'}}
            />
        </Box>
    );
};

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
    dateSearchRange,
    fromDate,
    toDate,
    onSearchRangeChange,
    onFromDateChange,
    onToDateChange,
}) => (
    <Stack gap={0}>
        {/* An exclusive toggle group is radio semantics: one tab stop, arrow-key
            navigation, and no way to deselect — all of which SegmentedControl
            already owns and the MUI ToggleButtonGroup did not. */}
        <SegmentedControl
            value={dateSearchRange}
            onChange={onSearchRangeChange}
            data={RANGE_OPTIONS}
            size="xs"
            fullWidth
        />
        {dateSearchRange === 'custom' && (
            <Group
                gap="xs"
                align="flex-start"
                wrap="wrap"
                mt="xs"
                pt="sm"
                style={{borderTop: '1px solid var(--mantine-color-default-border)'}}
            >
                <RangeDateInput label="From" value={fromDate} onChange={onFromDateChange}/>
                <RangeDateInput label="To" value={toDate} onChange={onToDateChange}/>
            </Group>
        )}
    </Stack>
);

export default DateRangePicker;
