/**
 * React Date Range Dialog
 *
 * Two side-by-side calendars — a start and an end — with a live summary bar.
 *
 * **Wall-clock only.** Mantine's calendars are string-valued (`YYYY-MM-DD`), so
 * neither the value nor the `minDate`/`maxDate` bounds ever carry a zone. The
 * `Date`s in the result are built at the boundary, from the picked wall-clock day,
 * exactly as before.
 *
 * Kept as *two* calendars rather than one `DatePicker type="range"`: the range
 * variant would fold the start/end cards, the cross-wired bounds and the "Invalid"
 * state into one control, but it also changes how the dialog is operated
 * (click-start-then-end), which is a design decision rather than a migration.
 */

import React, {useState, useMemo} from 'react';
import {Badge, Box, Flex, Group, Paper, Text} from '@mantine/core';
import {DatePicker} from '@mantine/dates';
import {ArrowRight, CalendarDays, CalendarRange} from 'lucide-react';
import dayjs, {Dayjs} from 'dayjs';
import {DialogShell, DialogHeader, DialogFooter, dialogContentBg, dialogSize} from '../shared/mantine';
import {Icon} from '../../common/icon/Icon';

/** The string form the calendars exchange values in. */
const ISO_DATE = 'YYYY-MM-DD';

export interface DateRange {
    start: Date;
    end: Date;
}

export interface DateRangeDialogProps {
    open: boolean;
    initialRange?: { start?: Date; end?: Date };
    onClose: () => void;
    onApply: (range: DateRange) => void;
}

interface CalendarCardProps {
    title: string;
    value: Dayjs;
    onChange: (value: Dayjs) => void;
    minDate?: string;
    maxDate?: string;
}

const CalendarCard: React.FC<CalendarCardProps> = ({title, value, onChange, minDate, maxDate}) => (
    <Paper radius="lg" withBorder style={{overflow: 'hidden'}}>
        <Box
            px="md"
            py="sm"
            bg="var(--mantine-primary-color-light)"
            style={{borderBottom: '1px solid var(--mantine-color-default-border)'}}
        >
            <Text size="sm" fw={600} c="var(--mantine-primary-color-filled)">{title}</Text>
        </Box>
        {/* `defaultDate` is load-bearing: unlike MUI's `DateCalendar`, a Mantine
            calendar does NOT navigate to its `value` — without it every calendar
            opens on the current month, which with the cross-wired bounds means a
            range in another month renders entirely disabled. */}
        <DatePicker
            aria-label={title}
            value={value.format(ISO_DATE)}
            defaultDate={value.format(ISO_DATE)}
            onChange={(next) => next && onChange(dayjs(next))}
            minDate={minDate}
            maxDate={maxDate}
            p="sm"
        />
    </Paper>
);

export const DateRangeDialog: React.FC<DateRangeDialogProps> = ({
    open,
    initialRange,
    onClose,
    onApply,
}) => {
    const [startDate, setStartDate] = useState<Dayjs>(
        dayjs(initialRange?.start || new Date())
    );
    const [endDate, setEndDate] = useState<Dayjs>(
        dayjs(initialRange?.end || new Date())
    );

    const isValidRange = useMemo(() => {
        return startDate && endDate && !endDate.isBefore(startDate);
    }, [startDate, endDate]);

    const duration = useMemo(() => {
        if (!startDate || !endDate) return 0;
        return endDate.diff(startDate, 'day') + 1;
    }, [startDate, endDate]);

    const handleApply = () => {
        if (isValidRange) {
            onApply({
                start: startDate.toDate(),
                end: endDate.toDate(),
            });
        }
    };

    return (
        <DialogShell
            opened={open}
            onClose={onClose}
            size={dialogSize.md}
            label="Select Date Range"
        >
            <DialogHeader
                icon={<Icon lucide={CalendarRange}/>}
                title="Select Date Range"
                subtitle="Choose a start and end date for your report"
                onClose={onClose}
            />

            {/* Summary bar */}
            <Group
                justify="center"
                gap="md"
                px="lg"
                py="md"
                bg="var(--mantine-primary-color-light)"
                style={{borderBottom: '1px solid var(--mantine-color-default-border)'}}
            >
                <Paper px="md" py={6} radius="md" withBorder>
                    <Group gap="xs" wrap="nowrap">
                        <Icon lucide={CalendarDays} size={16} color="var(--mantine-primary-color-filled)"/>
                        <Text size="sm" c="dimmed">From</Text>
                        <Text size="sm" fw={600}>{startDate?.format('MMM D, YYYY')}</Text>
                    </Group>
                </Paper>

                <Icon lucide={ArrowRight} size={20} color="var(--mantine-color-dimmed)" aria-label="to"/>

                <Paper px="md" py={6} radius="md" withBorder>
                    <Group gap="xs" wrap="nowrap">
                        <Icon lucide={CalendarDays} size={16} color="var(--mantine-primary-color-filled)"/>
                        <Text size="sm" c="dimmed">To</Text>
                        <Text size="sm" fw={600}>{endDate?.format('MMM D, YYYY')}</Text>
                    </Group>
                </Paper>

                {/* A `Badge` is the tonal pill the MUI version built out of a Paper. */}
                <Badge color={isValidRange ? 'green' : 'red'} variant="light" size="lg" tt="none">
                    {isValidRange ? `${duration} Day${duration !== 1 ? 's' : ''}` : 'Invalid'}
                </Badge>
            </Group>

            <Box p="lg" bg={dialogContentBg}>
                <Flex direction={{base: 'column', md: 'row'}} gap="lg" justify="center">
                    <CalendarCard
                        title="Start Date"
                        value={startDate}
                        onChange={setStartDate}
                        maxDate={endDate.format(ISO_DATE)}
                    />
                    <CalendarCard
                        title="End Date"
                        value={endDate}
                        onChange={setEndDate}
                        minDate={startDate.format(ISO_DATE)}
                    />
                </Flex>
            </Box>

            <DialogFooter
                onCancel={onClose}
                onConfirm={handleApply}
                confirmLabel="Apply"
                confirmDisabled={!isValidRange}
            />
        </DialogShell>
    );
};

export default DateRangeDialog;
