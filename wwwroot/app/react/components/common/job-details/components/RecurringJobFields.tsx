/**
 * RecurringJobFields - Material 3 elevated cards for recurring schedule + dates.
 *
 * Card 1: Days of week, frequency, holiday rule.
 * Card 2: First Due, Stop Date, Restart Date (anchored to pickup timezone).
 */

import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import Tooltip from '@mui/material/Tooltip';
import ListItemButton from '@mui/material/ListItemButton';
import TextField from '@mui/material/TextField';
import RepeatIcon from '@mui/icons-material/Repeat';
import EventIcon from '@mui/icons-material/Event';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {alpha} from '@mui/material/styles';
import type {SxProps, Theme} from '@mui/material/styles';
import type {SvgIconProps} from '@mui/material/SvgIcon';
import dayjs from 'dayjs';
import type {IJob} from '../JobDetails.types';
import {cardContainerSx} from '../JobDetails.styles';
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

/** Saturday/Sunday selected chips render as `secondary` to call out
 *  weekend scheduling at a glance — the rest of the week stays `primary`. */
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

const captionSx = {
    display: 'block',
    fontSize: '0.6875rem',
    fontWeight: 600,
    color: 'text.secondary',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    mb: 1,
} satisfies SxProps<Theme>;

const dateAvatarSx = (theme: Theme) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: '50%',
    flexShrink: 0,
    bgcolor: alpha(theme.palette.primary.main, 0.08),
    color: theme.palette.primary.main,
});

const dateLabelSx = {
    fontSize: '0.75rem',
    color: 'text.secondary',
    lineHeight: 1.3,
} satisfies SxProps<Theme>;

const dateValueSetSx = {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'text.primary',
    lineHeight: 1.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
} satisfies SxProps<Theme>;

const dateValueUnsetSx = {
    ...dateValueSetSx,
    fontWeight: 400,
    color: 'text.disabled',
} satisfies SxProps<Theme>;

const dateRowSx = (dense: boolean): SxProps<Theme> => ({
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    px: dense ? 2 : 2.5,
    py: dense ? 1.25 : 1.75,
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
        Icon: React.ComponentType<SvgIconProps>;
        onClick: () => void;
        tooltipDate: dayjs.Dayjs | undefined;
    }> = [
        {label: 'First Due', value: firstDueDisplay, Icon: EventIcon, onClick: onEditFirstDue, tooltipDate: job.firstDue},
        {label: 'Stop Date', value: job._stopDateStr, Icon: EventBusyIcon, onClick: onEditStopDate, tooltipDate: job.stopDate},
        {label: 'Restart Date', value: job._restartDateStr, Icon: EventAvailableIcon, onClick: onEditRestartDate, tooltipDate: job.restartDate},
    ];

    const innerDividerMx = dense ? 2 : 2.5;
    const bodyPx = dense ? 2 : 2.5;
    const bodyPy = dense ? 1.5 : 2;

    return (
        <Stack spacing={1.5}>
            {/* Card 1 — Recurring Schedule (days, frequency, holiday) */}
            <Box sx={cardContainerSx}>
                <SectionHeader
                    icon={RepeatIcon}
                    title="Recurring Schedule"
                    subtitle="When this job repeats"
                    dense={dense}
                />
                <Box sx={{px: bodyPx, py: bodyPy}}>
                    <Typography sx={captionSx}>Days of Week</Typography>
                    <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2}}>
                        {dayOptions.map(day => {
                            const selected = daysOfWeekArray.includes(day.value);
                            const selectedColor = isWeekend(day.value) ? 'secondary' : 'primary';
                            return (
                                <Chip
                                    key={day.value}
                                    label={day.label}
                                    size="small"
                                    color={selected ? selectedColor : 'default'}
                                    variant={selected ? 'filled' : 'outlined'}
                                    onClick={() => toggleDay(day.value)}
                                    clickable
                                    sx={{fontSize: '0.75rem', fontWeight: 500}}
                                />
                            );
                        })}
                    </Box>
                    <Stack direction="row" spacing={1.5}>
                        <FormControl size="small" sx={{flex: 1}}>
                            <InputLabel>Frequency</InputLabel>
                            <Select
                                value={job.frequency ?? Frequency.None}
                                label="Frequency"
                                onChange={(e) => onFrequencyChange(Number(e.target.value))}
                            >
                                {frequencyOptions.map(opt => (
                                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{flex: 1}}>
                            <InputLabel>Holiday</InputLabel>
                            <Select
                                value={job.holidayDeliveryOption ?? HolidayDeliveryOptions.DontBook}
                                label="Holiday"
                                onChange={(e) => onHolidayOptionChange(Number(e.target.value))}
                            >
                                {holidayOptions.map(opt => (
                                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Stack>
                    {/* Create-ahead offset. Save-on-blur so the confirmation
                     *  dialog for the interim backfill only opens once per edit
                     *  cycle, not on every keystroke. Enter also commits. */}
                    <Tooltip
                        title="Cron creates this recurring job's live tucJob N days ahead of the service date. Raising this value offers to backfill the interim service dates that would otherwise be skipped."
                        placement="top-start"
                        arrow
                    >
                        <TextField
                            label="Create bookings X days ahead"
                            size="small"
                            fullWidth
                            type="number"
                            value={initialDaysDraft}
                            onChange={(e) => setInitialDaysDraft(e.target.value)}
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
                            slotProps={{
                                htmlInput: {
                                    min: 0,
                                    max: MAX_RECURRING_INITIAL_DAYS,
                                    step: 1,
                                    inputMode: 'numeric',
                                },
                            }}
                            sx={{mt: 1.5}}
                        />
                    </Tooltip>
                </Box>
            </Box>

            {/* Card 2 — Schedule Dates (always pickup-timezone anchored) */}
            <Box sx={cardContainerSx}>
                <SectionHeader
                    icon={EventIcon}
                    title="Schedule Dates"
                    subtitle="Anchored to pickup timezone"
                    dense={dense}
                />
                {dateRows.map((row, index) => {
                    const {Icon} = row;
                    const isSet = !!row.value;
                    return (
                        <React.Fragment key={row.label}>
                            {index > 0 && <Divider sx={{mx: innerDividerMx}} />}
                            <Tooltip title={dateTooltip(row.label, row.tooltipDate, row.value)} placement="top-start" arrow>
                                <ListItemButton onClick={row.onClick} sx={dateRowSx(dense)}>
                                    <Box sx={dateAvatarSx}>
                                        <Icon sx={{fontSize: 20}} />
                                    </Box>
                                    <Box sx={{flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0}}>
                                        <Typography sx={dateLabelSx}>{row.label}</Typography>
                                        <Typography sx={isSet ? dateValueSetSx : dateValueUnsetSx}>
                                            {isSet ? row.value : 'Not set'}
                                        </Typography>
                                    </Box>
                                    <ChevronRightIcon sx={{color: 'text.secondary', fontSize: 20, flexShrink: 0}} />
                                </ListItemButton>
                            </Tooltip>
                        </React.Fragment>
                    );
                })}
            </Box>

            {/* Card 3 — Saved Flight (flight bookings only) */}
            {isFlightJob && hasRoute && (
                <Box sx={cardContainerSx}>
                    <SectionHeader
                        icon={FlightTakeoffIcon}
                        title="Flight"
                        subtitle="Auto-assigned on push to live"
                        dense={dense}
                    />
                    <Tooltip
                        title={job.savedFlightNumber
                            ? `Saved flight ${job.savedFlightNumber} — re-assigned each push`
                            : 'No saved flight — set one to auto-assign on push'}
                        placement="top-start"
                        arrow
                    >
                        <ListItemButton onClick={onEditSavedFlight} sx={dateRowSx(dense)}>
                            <Box sx={dateAvatarSx}>
                                <FlightTakeoffIcon sx={{fontSize: 20}} />
                            </Box>
                            <Box sx={{flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0}}>
                                <Typography sx={dateLabelSx}>Saved Flight</Typography>
                                <Typography sx={job.savedFlightNumber ? dateValueSetSx : dateValueUnsetSx}>
                                    {job.savedFlightNumber || 'Not set'}
                                </Typography>
                            </Box>
                            <ChevronRightIcon sx={{color: 'text.secondary', fontSize: 20, flexShrink: 0}} />
                        </ListItemButton>
                    </Tooltip>
                </Box>
            )}

            {/* Card 3 (no route yet) — Add Flight. Lets the operator attach a
                flight to a recurring booking that was created without airports:
                the dialog collects From/To airports + flight number and the
                push-to-live auto-assign takes over from there. */}
            {isFlightJob && !hasRoute && (
                <Box sx={cardContainerSx}>
                    <SectionHeader
                        icon={FlightTakeoffIcon}
                        title="Flight"
                        subtitle="Auto-assigned on push to live"
                        dense={dense}
                    />
                    <Tooltip
                        title="Add a flight — pick the route airports and flight number to auto-assign on push"
                        placement="top-start"
                        arrow
                    >
                        <ListItemButton onClick={onAddFlight} sx={dateRowSx(dense)}>
                            <Box sx={dateAvatarSx}>
                                <FlightTakeoffIcon sx={{fontSize: 20}} />
                            </Box>
                            <Box sx={{flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0}}>
                                <Typography sx={dateLabelSx}>Flight</Typography>
                                <Typography sx={dateValueUnsetSx}>Add flight</Typography>
                            </Box>
                            <ChevronRightIcon sx={{color: 'text.secondary', fontSize: 20, flexShrink: 0}} />
                        </ListItemButton>
                    </Tooltip>
                </Box>
            )}
        </Stack>
    );
}
