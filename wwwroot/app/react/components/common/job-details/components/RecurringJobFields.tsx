/**
 * RecurringJobFields - Material 3 elevated cards for recurring schedule + dates.
 *
 * Card 1: Days of week, frequency, holiday rule.
 * Card 2: First Due, Stop Date, Restart Date (anchored to pickup timezone).
 */

import React from 'react';
import {
    Box, Button, Divider, Group, NumberInput, Paper, Select, Stack, Text, ThemeIcon, Tooltip,
    UnstyledButton,
} from '@mantine/core';
import {Calendar, CalendarCheck, CalendarX, ChevronRight, Repeat} from 'lucide-react';
import {IconPlaneDeparture} from '@tabler/icons-react';
import dayjs from 'dayjs';
import {Icon, type LucideIcon, type TablerIcon} from '../../icon/Icon';
import type {IJob} from '../JobDetails.types';
import {cardContainerProps} from '../JobDetails.styles';
import {SectionHeader} from './SectionHeader';
import {DaysOfWeek, DaysOfWeekHelpers} from '../../../../../enums/days-of-week.enum';
import {Frequency} from '../../../../../enums/frequency.enum';
import {HolidayDeliveryOptions} from '../../../../../enums/holiday-delivery-options.enum';
import {formatLongDate, getTimezoneAbbreviation} from '../../../../utils/dateUtils';

interface RecurringJobFieldsProps {
    job: IJob;
    daysOfWeekArray: DaysOfWeek[];
    dense: boolean;
    onDaysOfWeekChange: (days: DaysOfWeek[]) => void;
    onFrequencyChange: (frequency: number) => void;
    onHolidayOptionChange: (option: number) => void;
    onEditFirstDue: () => void;
    onEditStopDate: () => void;
    onEditRestartDate: () => void;
    onEditSavedFlight: () => void;
    /** Opens the add-flight dialog (with airport pickers) for recurring
     *  bookings that have no route airports yet. */
    onAddFlight: () => void;
    /** Persist a new RecurringInitialDays value (create-ahead offset in days).
     *  Parent hook posts the update via JobProperty.RecurringInitialDays and,
     *  when newValue > oldValue, opens the CreateAheadBackfillDialog to plug
     *  the interim gap. Value is clamped to [0, 30] at the input level. */
    onInitialDaysChange: (initialDays: number) => void;
}

/** Upper bound mirrors DespatchWeb.Repositories.RecurringJobRepository
 *  MaxRecurringInitialDays. Kept in sync at both ends. */
const MAX_RECURRING_INITIAL_DAYS = 30;

const dayOptions = DaysOfWeekHelpers.allDays.map(day => ({
    value: day,
    label: DaysOfWeekHelpers.dayLabels[day],
}));

/** Saturday/Sunday selected pills take the grape accent to call out weekend
 *  scheduling at a glance — the rest of the week stays on the tenant brand. */
function isWeekend(day: DaysOfWeek): boolean {
    return day === DaysOfWeek.Saturday || day === DaysOfWeek.Sunday;
}

const frequencyOptions = [
    {value: Frequency.None, label: 'None'},
    {value: Frequency.Weekly, label: 'Weekly'},
    {value: Frequency.Fortnightly, label: 'Fortnightly'},
    {value: Frequency.FirstOfMonth, label: '1st of Month'},
    {value: Frequency.SecondOfMonth, label: '2nd of Month'},
    {value: Frequency.ThirdOfMonth, label: '3rd of Month'},
    {value: Frequency.FirstWorkdayOfMonth, label: '1st Workday'},
    {value: Frequency.LastWorkdayOfMonth, label: 'Last Workday'},
];

const holidayOptions = [
    {value: HolidayDeliveryOptions.DontBook, label: "Don't Book"},
    {value: HolidayDeliveryOptions.DeliverNextDay, label: 'Deliver Next Day'},
    {value: HolidayDeliveryOptions.BookAnyway, label: 'Book Anyway'},
];

/** Mantine `Select` is string-keyed, so the numeric enums round-trip as strings. */
const toSelectData = (options: Array<{value: number; label: string}>) =>
    options.map(o => ({value: String(o.value), label: o.label}));

const captionStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.6875rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 8,
};

/**
 * The round tinted glyph in front of each date row — Mantine's `ThemeIcon` in its
 * `light` variant, which is exactly a brand-tinted disc with the brand glyph.
 */
const dateAvatarProps = {
    size: 36,
    radius: 'xl',
    variant: 'light',
    style: {flexShrink: 0},
} as const;

const dateLabelStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    lineHeight: 1.3,
};

// Truncation is <Text truncate> at the call site, not three properties here.
const dateValueStyle = (isSet: boolean): React.CSSProperties => ({
    fontSize: '0.875rem',
    fontWeight: isSet ? 500 : 400,
    lineHeight: 1.4,
});

const dateRowStyle = (dense: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    width: '100%',
    textAlign: 'left',
    paddingInline: dense ? 16 : 20,
    paddingBlock: dense ? 10 : 14,
});

export function RecurringJobFields({
    job,
    daysOfWeekArray,
    dense,
    onDaysOfWeekChange,
    onFrequencyChange,
    onHolidayOptionChange,
    onEditFirstDue,
    onEditStopDate,
    onEditRestartDate,
    onEditSavedFlight,
    onAddFlight,
    onInitialDaysChange,
}: RecurringJobFieldsProps) {
    /** Local state for the create-ahead input so we can commit-on-blur
     *  instead of firing the backfill dialog on every keystroke. Kept in
     *  sync with `job.recurringInitialDays` when the caller refreshes the
     *  job (e.g. after a successful save).
     *
     *  Both hooks live above the `if (!job.preBook) return null` guard on
     *  purpose - React's Rules of Hooks require hooks to be called in the
     *  same order on every render, so they cannot sit after an early return
     *  (eslint react-hooks/rules-of-hooks flags this as an error). */
    const currentInitialDays = job.recurringInitialDays ?? 0;
    const [initialDaysDraft, setInitialDaysDraft] = React.useState<string>(
        String(currentInitialDays)
    );
    // Re-sync the draft when the caller refreshes the job, derived during render
    // rather than in an effect (avoids the extra post-paint commit).
    const [prevInitialDays, setPrevInitialDays] = React.useState(currentInitialDays);
    if (currentInitialDays !== prevInitialDays) {
        setPrevInitialDays(currentInitialDays);
        setInitialDaysDraft(String(currentInitialDays));
    }

    if (!job.preBook) return null;

    // Flight jobs are identified by speed grouping (same rule as live jobs) —
    // only they get the flight picker. Within a flight job, a set from/to
    // airport means a route already exists (edit the saved flight); otherwise
    // the operator adds a flight (which also collects the route airports).
    const isFlightJob = job.isFlightJob === true;
    const hasRoute = job.fromAirportId != null || job.toAirportId != null;

    const toggleDay = (day: DaysOfWeek) => {
        const newDays = daysOfWeekArray.includes(day)
            ? daysOfWeekArray.filter(d => d !== day)
            : [...daysOfWeekArray, day];
        onDaysOfWeekChange(newDays);
    };

    const commitInitialDays = () => {
        const parsed = parseInt(initialDaysDraft, 10);
        if (Number.isNaN(parsed)) {
            // Roll the draft back so the input reflects the last-saved value
            // instead of leaving a garbage string in the box.
            setInitialDaysDraft(String(currentInitialDays));
            return;
        }
        const clamped = Math.min(MAX_RECURRING_INITIAL_DAYS, Math.max(0, parsed));
        if (clamped !== currentInitialDays) {
            onInitialDaysChange(clamped);
        }
        if (String(clamped) !== initialDaysDraft) {
            setInitialDaysDraft(String(clamped));
        }
    };

    /** Schedule dates are anchored to the pickup side of the job (that's where
     *  the recurring booking executes), so we hover-reveal the long-form date
     *  with the pickup timezone abbreviation — no timezone for NZ tenants per
     *  `getTimezoneAbbreviation`'s NZ rule. */
    const pickupTz = job.pickUpTimeZone?.text ?? '';
    const tzAbbr = getTimezoneAbbreviation(pickupTz);
    const tzSuffix = tzAbbr ? ` ${tzAbbr}` : '';
    const dateTooltip = (label: string, date: dayjs.Dayjs | undefined, displayValue: string | undefined): string => {
        if (date && date.isValid()) return `${label}: ${formatLongDate(date)}${tzSuffix}`;
        if (displayValue) return `${label}: ${displayValue}${tzSuffix}`;
        return `${label}: not set`;
    };
    const firstDueDisplay = job.firstDue && dayjs.isDayjs(job.firstDue) && job.firstDue.isValid()
        ? formatLongDate(job.firstDue)
        : (job.firstDue ? String(job.firstDue) : undefined);

    const dateRows: Array<{
        label: string;
        value: string | undefined;
        glyph: LucideIcon;
        onClick: () => void;
        tooltipDate: dayjs.Dayjs | undefined;
    }> = [
        {label: 'First Due', value: firstDueDisplay, glyph: Calendar, onClick: onEditFirstDue, tooltipDate: job.firstDue},
        {label: 'Stop Date', value: job._stopDateStr, glyph: CalendarX, onClick: onEditStopDate, tooltipDate: job.stopDate},
        {label: 'Restart Date', value: job._restartDateStr, glyph: CalendarCheck, onClick: onEditRestartDate, tooltipDate: job.restartDate},
    ];

    const innerDividerMx = dense ? 16 : 20;
    const bodyPx = dense ? 16 : 20;
    const bodyPy = dense ? 12 : 16;

    /** One of the three "tap to edit" rows (a date, or the saved flight). */
    const detailRow = (
        {label, value, glyph, tabler, onClick, tooltip}: {
            label: string;
            value: string | undefined;
            glyph?: LucideIcon;
            tabler?: TablerIcon;
            onClick: () => void;
            tooltip: string;
        }
    ) => (
        <Tooltip label={tooltip} position="top-start" withArrow>
            <UnstyledButton onClick={onClick} style={dateRowStyle(dense)}>
                <ThemeIcon {...dateAvatarProps}>
                    <Icon lucide={glyph} tabler={tabler} size={20}/>
                </ThemeIcon>
                <Box style={{flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0}}>
                    <Text c="dimmed" style={dateLabelStyle}>{label}</Text>
                    <Text truncate c={value ? undefined : 'dimmed'} style={dateValueStyle(!!value)}>
                        {value || 'Not set'}
                    </Text>
                </Box>
                <Icon lucide={ChevronRight} size={20} color="var(--mantine-color-dimmed)" style={{flexShrink: 0}} aria-hidden/>
            </UnstyledButton>
        </Tooltip>
    );

    return (
        <Stack gap="sm">
            {/* Card 1 — Recurring Schedule (days, frequency, holiday) */}
            <Paper {...cardContainerProps}>
                <SectionHeader
                    lucide={Repeat}
                    title="Recurring Schedule"
                    subtitle="When this job repeats"
                    dense={dense}
                />
                <Box style={{paddingInline: bodyPx, paddingBlock: bodyPy}}>
                    <Text c="dimmed" style={captionStyle}>Days of Week</Text>
                    {/*
                      * Multi-select toggles, so these stay buttons with `aria-pressed`
                      * rather than a `Chip.Group` — Mantine chips are checkboxes, which
                      * loses the pressed state. `data-tone` carries the weekday/weekend
                      * distinction so tests assert the contract, not the palette.
                      */}
                    <Group gap={6} wrap="wrap" mb="md" role="group" aria-label="Days of week">
                        {dayOptions.map(day => {
                            const selected = daysOfWeekArray.includes(day.value);
                            const weekend = isWeekend(day.value);
                            return (
                                <Button
                                    key={day.value}
                                    size="compact-xs"
                                    radius="xl"
                                    variant={selected ? 'filled' : 'default'}
                                    color={selected && weekend ? 'grape' : undefined}
                                    aria-pressed={selected}
                                    data-tone={weekend ? 'weekend' : 'weekday'}
                                    onClick={() => toggleDay(day.value)}
                                    style={{fontSize: '0.75rem', fontWeight: 500}}
                                >
                                    {day.label}
                                </Button>
                            );
                        })}
                    </Group>
                    <Group gap="sm" grow align="flex-start">
                        <Select
                            label="Frequency"
                            data={toSelectData(frequencyOptions)}
                            value={String(job.frequency ?? Frequency.None)}
                            onChange={(value) => value != null && onFrequencyChange(Number(value))}
                            allowDeselect={false}
                            // Two selects in one row: keeping both dropdowns mounted
                            // would leave two listboxes in the DOM at once.
                            comboboxProps={{keepMounted: false}}
                        />
                        <Select
                            label="Holiday"
                            data={toSelectData(holidayOptions)}
                            value={String(job.holidayDeliveryOption ?? HolidayDeliveryOptions.DontBook)}
                            onChange={(value) => value != null && onHolidayOptionChange(Number(value))}
                            allowDeselect={false}
                            comboboxProps={{keepMounted: false}}
                        />
                    </Group>
                    {/* Create-ahead offset. Save-on-blur so the confirmation
                     *  dialog for the interim backfill only opens once per edit
                     *  cycle, not on every keystroke. Enter also commits. */}
                    <Tooltip
                        label="Cron creates this recurring job's live tucJob N days ahead of the service date. Raising this value offers to backfill the interim service dates that would otherwise be skipped."
                        position="top-start"
                        withArrow
                        multiline
                        w={320}
                    >
                        {/* Mantine's own numeric control: it refuses non-numeric
                            input at the source and clamps to [0, 30] on blur, so
                            `commitInitialDays` only has to decide whether the
                            settled value differs from what is saved. */}
                        <NumberInput
                            label="Create bookings X days ahead"
                            mt="sm"
                            value={initialDaysDraft}
                            onChange={(value) => setInitialDaysDraft(String(value ?? ''))}
                            onBlur={commitInitialDays}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    // Commit inline as well as blurring the input
                                    // so both behaviours (visible focus loss +
                                    // callback) fire in one keystroke. blur()
                                    // alone doesn't synthesise an onBlur event
                                    // in jsdom, so we commit directly to make
                                    // the flow testable end-to-end.
                                    commitInitialDays();
                                    (e.target as HTMLInputElement).blur();
                                }
                            }}
                            min={0}
                            max={MAX_RECURRING_INITIAL_DAYS}
                            step={1}
                            clampBehavior="blur"
                            allowDecimal={false}
                            // Negatives stay *typable* on purpose: `allowNegative={false}`
                            // would silently turn "-5" into 5, whereas clamping turns it
                            // into 0 — the value the operator actually meant.
                        />
                    </Tooltip>
                </Box>
            </Paper>

            {/* Card 2 — Schedule Dates (always pickup-timezone anchored) */}
            <Paper {...cardContainerProps}>
                <SectionHeader
                    lucide={Calendar}
                    title="Schedule Dates"
                    subtitle="Anchored to pickup timezone"
                    dense={dense}
                />
                {dateRows.map((row, index) => (
                    <React.Fragment key={row.label}>
                        {index > 0 && <Divider mx={innerDividerMx}/>}
                        {detailRow({
                            label: row.label,
                            value: row.value,
                            glyph: row.glyph,
                            onClick: row.onClick,
                            tooltip: dateTooltip(row.label, row.tooltipDate, row.value),
                        })}
                    </React.Fragment>
                ))}
            </Paper>

            {/* Card 3 — Saved Flight (flight bookings only) */}
            {isFlightJob && hasRoute && (
                <Paper {...cardContainerProps}>
                    <SectionHeader
                        tabler={IconPlaneDeparture}
                        title="Flight"
                        subtitle="Auto-assigned on push to live"
                        dense={dense}
                    />
                    {detailRow({
                        label: 'Saved Flight',
                        value: job.savedFlightNumber || undefined,
                        tabler: IconPlaneDeparture,
                        onClick: onEditSavedFlight,
                        tooltip: job.savedFlightNumber
                            ? `Saved flight ${job.savedFlightNumber} — re-assigned each push`
                            : 'No saved flight — set one to auto-assign on push',
                    })}
                </Paper>
            )}

            {/* Card 3 (no route yet) — Add Flight. Lets the operator attach a
                flight to a recurring booking that was created without airports:
                the dialog collects From/To airports + flight number and the
                push-to-live auto-assign takes over from there. */}
            {isFlightJob && !hasRoute && (
                <Paper {...cardContainerProps}>
                    <SectionHeader
                        tabler={IconPlaneDeparture}
                        title="Flight"
                        subtitle="Auto-assigned on push to live"
                        dense={dense}
                    />
                    {/* No saved value here — the row's own copy is the affordance. */}
                    <Tooltip
                        label="Add a flight — pick the route airports and flight number to auto-assign on push"
                        position="top-start"
                        withArrow
                    >
                        <UnstyledButton onClick={onAddFlight} style={dateRowStyle(dense)}>
                            <ThemeIcon {...dateAvatarProps}>
                                <Icon tabler={IconPlaneDeparture} size={20}/>
                            </ThemeIcon>
                            <Box style={{flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0}}>
                                <Text c="dimmed" style={dateLabelStyle}>Flight</Text>
                                <Text truncate c="dimmed" style={dateValueStyle(false)}>Add flight</Text>
                            </Box>
                            <Icon lucide={ChevronRight} size={20} color="var(--mantine-color-dimmed)" style={{flexShrink: 0}} aria-hidden/>
                        </UnstyledButton>
                    </Tooltip>
                </Paper>
            )}
        </Stack>
    );
}
