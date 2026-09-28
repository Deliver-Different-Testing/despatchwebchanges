/**
 * RecurringJobFields - Days of week, frequency, holiday delivery, dates
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import RepeatIcon from '@mui/icons-material/Repeat';
import dayjs from 'dayjs';
import {EditableField} from './EditableField';
import type {IJob} from '../JobDetails.types';
import {
    cardContainerSx,
    sectionToolbarSx,
    sectionToolbarTitleSx,
    sectionToolbarIconSx,
} from '../JobDetails.styles';
import {DaysOfWeek, DaysOfWeekHelpers} from '../../../../../enums/days-of-week.enum';
import {Frequency} from '../../../../../enums/frequency.enum';
import {HolidayDeliveryOptions} from '../../../../../enums/holiday-delivery-options.enum';
import {formatLongDate, getTimezoneAbbreviation} from '../../../../utils/dateUtils';

// Route assignment moved to JobDetailHeader (sits before the Lock icon
// on the job-number line) per 2026-05-26 UX feedback. RecurringJobFields
// now owns just frequency / days / holiday / dates.
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
}

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
];

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
}: RecurringJobFieldsProps) {
    if (!job.preBook) return null;

    const toggleDay = (day: DaysOfWeek) => {
        const newDays = daysOfWeekArray.includes(day)
            ? daysOfWeekArray.filter(d => d !== day)
            : [...daysOfWeekArray, day];
        onDaysOfWeekChange(newDays);
    };

    /** Schedule dates are anchored to the pickup side of the job (that's where
     *  the recurring booking executes), so we hover-reveal the long-form date
     *  with the pickup timezone abbreviation — no timezone for NZ tenants per
     *  `getTimezoneAbbreviation`'s NZ rule. */
    const pickupTz = job.pickUpTimeZone?.text ?? '';
    const tzSuffix = (() => {
        const abbr = getTimezoneAbbreviation(pickupTz);
        return abbr ? ` ${abbr}` : '';
    })();
    const dateTooltip = (label: string, date: dayjs.Dayjs | undefined, displayValue: string | undefined): string => {
        if (date && date.isValid()) return `${label}: ${formatLongDate(date)}${tzSuffix}`;
        if (displayValue) return `${label}: ${displayValue}${tzSuffix}`;
        return `${label}: not set`;
    };
    const firstDueDisplay = job.firstDue && dayjs.isDayjs(job.firstDue) && job.firstDue.isValid()
        ? formatLongDate(job.firstDue)
        : (job.firstDue ? String(job.firstDue) : undefined);

    return (
        <Box sx={cardContainerSx}>
            <Box sx={sectionToolbarSx}>
                <RepeatIcon sx={sectionToolbarIconSx} />
                <Typography variant="subtitle2" sx={sectionToolbarTitleSx}>
                    Recurring Job Settings
                </Typography>
            </Box>
            <Box sx={{p: 1.5}}>
                {/* Days of Week */}
                <Typography variant="caption" color="text.secondary" sx={{mb: 0.75, display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.625rem'}}>
                    Days of Week
                </Typography>
                <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5}}>
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

                {/* Frequency & Holiday Options */}
                <Stack direction="row" spacing={1.5} sx={{mb: 1.5}}>
                    <FormControl size="small" sx={{minWidth: 140}}>
                        <InputLabel sx={{fontSize: '0.8125rem'}}>Frequency</InputLabel>
                        <Select
                            value={job.frequency ?? Frequency.None}
                            label="Frequency"
                            onChange={(e) => onFrequencyChange(Number(e.target.value))}
                            sx={{fontSize: '0.8125rem'}}
                        >
                            {frequencyOptions.map(opt => (
                                <MenuItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl size="small" sx={{minWidth: 140}}>
                        <InputLabel sx={{fontSize: '0.8125rem'}}>Holiday</InputLabel>
                        <Select
                            value={job.holidayDeliveryOption ?? HolidayDeliveryOptions.DontBook}
                            label="Holiday"
                            onChange={(e) => onHolidayOptionChange(Number(e.target.value))}
                            sx={{fontSize: '0.8125rem'}}
                        >
                            {holidayOptions.map(opt => (
                                <MenuItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Stack>

                {/* Dates — wrapped in Tooltips that always carry the pickup
                    timezone abbreviation so dispatchers across regions know
                    which calendar the schedule reads against. */}
                <Tooltip title={dateTooltip('First Due', job.firstDue, firstDueDisplay)} placement="top-start" arrow>
                    <Box>
                        <EditableField
                            icon="event" label="First Due" value={firstDueDisplay}
                            onClick={onEditFirstDue} dense={dense}
                        />
                    </Box>
                </Tooltip>
                <Tooltip title={dateTooltip('Stop Date', job.stopDate, job._stopDateStr)} placement="top-start" arrow>
                    <Box>
                        <EditableField
                            icon="event_busy" label="Stop Date" value={job._stopDateStr}
                            onClick={onEditStopDate} dense={dense}
                        />
                    </Box>
                </Tooltip>
                <Tooltip title={dateTooltip('Restart Date', job.restartDate, job._restartDateStr)} placement="top-start" arrow>
                    <Box>
                        <EditableField
                            icon="event_available" label="Restart Date" value={job._restartDateStr}
                            onClick={onEditRestartDate} dense={dense}
                        />
                    </Box>
                </Tooltip>
            </Box>
        </Box>
    );
}
