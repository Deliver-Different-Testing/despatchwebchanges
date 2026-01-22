/**
 * React Date Filter Menu Component
 *
 * A dropdown menu for filtering data by date range.
 * Supports: All Time, Time Range (minutes), and Custom Date Range.
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
    alpha,
    Box,
    Button,
    Divider,
    FormControl,
    FormControlLabel,
    IconButton,
    InputLabel,
    Menu,
    MenuItem,
    Radio,
    RadioGroup,
    Select,
    Tooltip,
    Typography,
} from '@mui/material';
import {CalendarToday as CalendarIcon, DateRange as DateRangeIcon,} from '@mui/icons-material';
import {DatePicker} from '@mui/x-date-pickers/DatePicker';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, {Dayjs} from 'dayjs';

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
function getIanaTimezone(windowsTimeZone: string): string {
    // Simple mapping - in production this would use a more complete mapping
    const tzMap: Record<string, string> = {
        'New Zealand Standard Time': 'Pacific/Auckland',
        'Pacific Standard Time': 'America/Los_Angeles',
        'Eastern Standard Time': 'America/New_York',
        'Central Standard Time': 'America/Chicago',
        'Mountain Standard Time': 'America/Denver',
    };
    return tzMap[windowsTimeZone] || 'Pacific/Auckland';
}

function getLongTimeZoneString(ianaTimeZone: string): string {
    try {
        const formatter = new Intl.DateTimeFormat('en', {
            timeZone: ianaTimeZone,
            timeZoneName: 'long',
        });
        const parts = formatter.formatToParts(new Date());
        const tzPart = parts.find(p => p.type === 'timeZoneName');
        return tzPart?.value || ianaTimeZone;
    } catch {
        return ianaTimeZone;
    }
}

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
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    const ianaTimeZone = getIanaTimezone(timeZone);
    const timeZoneLong = getLongTimeZoneString(ianaTimeZone);

    const storageKey = `dateRangeOption-${appPage}`;

    // State
    const [selectedRangeOption, setSelectedRangeOption] = useState<DateRangeOption>('all_time');
    const [startDate, setStartDate] = useState<Dayjs>(dayjs().tz(ianaTimeZone));
    const [endDate, setEndDate] = useState<Dayjs>(dayjs().tz(ianaTimeZone).add(24, 'hours'));
    const [selectedMinsOption, setSelectedMinsOption] = useState<number>(300); // 5 mins default

    const minsOptions = getMinsSelectionOptions(300, 300, 180);
    const minsUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Load saved option from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved && ['all_time', 'today', 'custom_minutes', 'custom_date'].includes(saved)) {
                setSelectedRangeOption(saved as DateRangeOption);
            }
        } catch {
            // Ignore localStorage errors
        }
    }, [storageKey]);

    // Update local state when dateFilterData changes
    useEffect(() => {
        if (dateFilterData) {
            setStartDate(dateFilterData.startDate);
            setEndDate(dateFilterData.endDate);
        }
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
        event.preventDefault();
        event.stopPropagation();
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
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

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="en">
            <Tooltip title="Date Filter">
                <IconButton
                    color="inherit"
                    onClick={handleClick}
                    sx={{
                        p: 1,
                        '&:hover': {
                            bgcolor: (theme) => alpha(theme.palette.common.white, 0.12),
                        },
                    }}
                >
                    <CalendarIcon sx={{fontSize: 22}}/>
                </IconButton>
            </Tooltip>

            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
                transformOrigin={{vertical: 'top', horizontal: 'right'}}
                slotProps={{
                    paper: {
                        elevation: 3,
                        sx: {
                            width: 320,
                            mt: 0.5,
                        },
                    }
                }}
            >
                {/* Header */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        px: 2,
                        py: 1.5,
                        bgcolor: 'grey.50',
                        borderBottom: 1,
                        borderColor: 'divider',
                    }}
                >
                    <DateRangeIcon color="primary" sx={{fontSize: 20}}/>
                    <Typography variant="subtitle2" fontWeight={600}>
                        Date Filter
                    </Typography>
                    {timeZoneLong && (
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ml: 'auto'}}
                        >
                            {timeZoneLong}
                        </Typography>
                    )}
                </Box>

                {/* Content */}
                <Box sx={{p: 2}}>
                    {/* Range Options */}
                    <RadioGroup
                        value={selectedRangeOption}
                        onChange={(e) => handleRangeOptionChange(e.target.value as DateRangeOption)}
                    >
                        <FormControlLabel
                            value="all_time"
                            control={<Radio size="small"/>}
                            label="All Time"
                        />
                        <FormControlLabel
                            value="today"
                            control={<Radio size="small"/>}
                            label="Today"
                        />
                        <FormControlLabel
                            value="custom_minutes"
                            control={<Radio size="small"/>}
                            label="Time Range"
                        />
                        <FormControlLabel
                            value="custom_date"
                            control={<Radio size="small"/>}
                            label="Custom Dates"
                        />
                    </RadioGroup>

                    {/* Custom Date Range */}
                    {selectedRangeOption === 'custom_date' && (
                        <Box sx={{mt: 2}}>
                            <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
                                <DatePicker
                                    label="Start Date"
                                    value={startDate}
                                    onChange={(newValue) => newValue && setStartDate(newValue)}
                                    format="DD/MM/YYYY"
                                    slotProps={{
                                        textField: {size: 'small', fullWidth: true},
                                    }}
                                />
                                <DatePicker
                                    label="End Date"
                                    value={endDate}
                                    onChange={(newValue) => newValue && setEndDate(newValue)}
                                    format="DD/MM/YYYY"
                                    slotProps={{
                                        textField: {size: 'small', fullWidth: true},
                                    }}
                                />
                            </Box>
                            {startDate && endDate && (
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{display: 'block', mt: 1, textAlign: 'center'}}
                                >
                                    {startDate.format('MMM DD, YYYY')} — {endDate.format('MMM DD, YYYY')}
                                </Typography>
                            )}
                        </Box>
                    )}

                    {/* Time Range (Minutes) */}
                    {selectedRangeOption === 'custom_minutes' && (
                        <Box sx={{mt: 2}}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Duration</InputLabel>
                                <Select
                                    value={selectedMinsOption}
                                    label="Duration"
                                    onChange={(e) => handleMinsOptionChange(e.target.value as number)}
                                >
                                    {minsOptions.map((option) => (
                                        <MenuItem key={option.id} value={option.id}>
                                            {option.text}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{display: 'block', mt: 1, textAlign: 'center'}}
                            >
                                {'All Time'} — {endDate.format('MMM DD, h:mm A')}
                            </Typography>
                        </Box>
                    )}
                </Box>

                <Divider/>

                {/* Actions */}
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 1,
                        p: 1.5,
                    }}
                >
                    <Button size="small" onClick={handleClear}>
                        Reset
                    </Button>
                    <Button
                        size="small"
                        variant="contained"
                        onClick={handleApply}
                    >
                        Apply
                    </Button>
                </Box>
            </Menu>
        </LocalizationProvider>
    );
};

export default DateFilterMenu;
