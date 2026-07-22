/**
 * EditDateTimeDialog Component
 *
 * React replacement for the AngularJS edit-date-time-dialog.
 * Allows editing date and/or time values with timezone information.
 */

import React, { useState, useEffect, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import TodayIcon from '@mui/icons-material/Today';
import CloseIcon from '@mui/icons-material/Close';
import PublicIcon from '@mui/icons-material/Public';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

import { EditDateTimeDialogProps, EditDateTimeDialogResult } from './types';
import { getIanaTimezone, getTimezoneName } from '../../../utils/dateUtils';
import {headerChromeSx, headerChipSx, headerOnColor, headerOverlayColor} from '../shared/styles';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Format timezone for display (e.g., "America/New_York" -> "Eastern Daylight Time")
 */
function formatTimezoneDisplay(tz: string | { text?: string } | undefined | null): string {
    // Handle timezone objects (e.g. {text: "Pacific/Auckland"}) that may be passed via `as any`
    const tzStr = typeof tz === 'string' ? tz : tz?.text ?? '';
    if (!tzStr) return '';
    try {
        return getTimezoneName(tzStr);
    } catch {
        return tzStr.replace(/_/g, ' ');
    }
}

export const EditDateTimeDialog: React.FC<EditDateTimeDialogProps> = ({
    open,
    title,
    fieldName,
    dateTime: initialDateTime,
    defaultTimeZone,
    showDate = true,
    showTime = true,
    isUSCustomer = false,
    readOnly = false,
    onClose,
    onSubmit,
    showToast,
}) => {
    // State
    const [dateTime, setDateTime] = useState<Dayjs>(dayjs());
    const [isLoading, setIsLoading] = useState(false);
    // Handle timezone objects that may arrive via `as any` from callers
    const resolvedTz = typeof defaultTimeZone === 'string'
        ? defaultTimeZone
        : (defaultTimeZone as unknown as { text?: string })?.text ?? undefined;
    const [selectedTimeZone] = useState(resolvedTz || getIanaTimezone());


    // Initialize dateTime when dialog opens or initialDateTime changes
    useEffect(() => {
        if (open) {
            if (initialDateTime && initialDateTime.isValid()) {
                setDateTime(initialDateTime);
            } else {
                setDateTime(dayjs().tz(selectedTimeZone));
            }
        }
    }, [open, initialDateTime]);

    // Handle date/time change - pass through MUI's value directly to preserve
    // internal Dayjs state compatibility with MUI X v8's accessible field sections
    const handleDateTimeChange = useCallback((newValue: Dayjs | null) => {
        if (newValue) {
            setDateTime(newValue);
        }
    }, []);

    // Handle date-only change (preserves existing time)
    const handleDateChange = useCallback((newValue: Dayjs | null) => {
        if (newValue && !isNaN(newValue.year()) && !isNaN(newValue.month()) && !isNaN(newValue.date())) {
            setDateTime(prev => prev.year(newValue.year()).month(newValue.month()).date(newValue.date()));
        }
    }, []);

    // Handle time-only change (preserves existing date)
    const handleTimeChange = useCallback((newValue: Dayjs | null) => {
        if (newValue && newValue.isValid()) {
            setDateTime(prev => prev.hour(newValue.hour()).minute(newValue.minute()).second(0));
        }
    }, []);

    // Process the datetime based on mode before submitting
    const processDateTime = useCallback((dt: Dayjs): Dayjs => {
        if (showDate && showTime) {
            // Both date and time - use as is
            return dt;
        } else if (showDate && !showTime) {
            // Date only - set to midnight (00:00:00)
            return dt.startOf('day');
        } else if (showTime && !showDate) {
            // Time only - use minimum date (1900-01-01) with the selected time
            return dayjs('1900-01-01')
                .hour(dt.hour())
                .minute(dt.minute())
                .second(0)
                .millisecond(0);
        }
        return dt;
    }, [showDate, showTime]);

    // Handle form submission
    const handleSubmit = useCallback(async () => {
        if (!dateTime || !dateTime.isValid()) {
            showToast('Please provide valid date/time information', 'warning');
            return;
        }

        try {
            setIsLoading(true);

            const processedDateTime = processDateTime(dateTime);

            const result: EditDateTimeDialogResult = {
                fieldName,
                value: processedDateTime,
                timezone: selectedTimeZone,
            };

            // Await onSubmit in case it returns a promise
            await onSubmit(result);
        } catch (error: unknown) {
            console.error('Error submitting date/time:', error);
            showToast(error instanceof Error ? error.message : 'Failed to save date/time', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [dateTime, fieldName, selectedTimeZone, processDateTime, onSubmit, showToast]);

    // Render the appropriate picker based on mode
    const renderPicker = () => {
        const commonProps = {
            value: dateTime,
            onChange: handleDateTimeChange,
            disabled: isLoading || readOnly,
            slotProps: {
                textField: {
                    fullWidth: true,
                    sx: { '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' } },
                },
            },
        };

        if (showDate && !showTime) {
            return (
                <DatePicker
                    {...commonProps}
                    label="Date"
                    format="YYYY-MM-DD"
                />
            );
        } else if (showTime && !showDate) {
            return (
                <TimePicker
                    {...commonProps}
                    label="Time (24-hour)"
                    ampm={false}
                    format="HH:mm"
                    timeSteps={{ minutes: 1 }}
                />
            );
        }
        return null;
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Dialog
                open={open}
                onClose={onClose}
                maxWidth="sm"
                fullWidth
                disableEnforceFocus
                slotProps={{
                    paper: {
                        elevation: 24,
                        sx: {
                            overflow: 'hidden',
                            minWidth: 480,
                            maxWidth: 600,
                        },
                    },
                }}
            >
                {/* Header */}
                <Box sx={(theme) => headerChromeSx(theme)}>
                    <Box sx={(theme) => headerChipSx(theme)}>
                        {readOnly ? <LockOutlinedIcon/> : <TodayIcon/>}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" sx={{
                            fontWeight: 600
                        }}>
                            {title}
                        </Typography>
                        <Typography variant="body2" sx={{opacity: 0.85, mt: 0.25}}>
                            {readOnly ? 'View only — this job is locked' : 'Update the date and time'}
                        </Typography>
                    </Box>
                    <IconButton
                        onClick={onClose}
                        disabled={isLoading}
                        sx={(theme) => ({
                            color: headerOnColor(theme),
                            '&:hover': {bgcolor: headerOverlayColor(theme, 0.1)},
                        })}
                    >
                        <CloseIcon />
                    </IconButton>
                </Box>

                {/* Content */}
                <DialogContent sx={{ p: 0, bgcolor: 'background.default' }}>
                    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {/* Date/Time Picker */}
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            {showDate && showTime ? (
                                // Separate date and time pickers for better UX.
                                // Use MUI's TimePicker (not native <input type="time">)
                                // so the 24-hour display is locale-independent —
                                // browsers force AM/PM under US locale even when
                                // the bound value is in HH:mm.
                                (<>
                                    <DatePicker
                                        value={dateTime}
                                        onChange={handleDateChange}
                                        disabled={isLoading || readOnly}
                                        label="Date"
                                        format="YYYY-MM-DD"
                                        slotProps={{
                                            textField: {
                                                fullWidth: true,
                                                sx: { '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' } },
                                            },
                                        }}
                                    />
                                    <TimePicker
                                        value={dateTime}
                                        onChange={handleTimeChange}
                                        disabled={isLoading || readOnly}
                                        label="Time (24-hour)"
                                        ampm={false}
                                        format="HH:mm"
                                        timeSteps={{ minutes: 1 }}
                                        slotProps={{
                                            textField: {
                                                fullWidth: true,
                                                sx: { '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' } },
                                            },
                                        }}
                                    />
                                </>)
                            ) : (
                                renderPicker()
                            )}
                        </Box>

                        {/* Timezone Information - Only shown for US customers */}
                        {isUSCustomer && (
                            <Paper
                                elevation={0}
                                sx={{
                                    bgcolor: 'background.paper',
                                    borderRadius: 3,
                                    p: 2.5,
                                    border: '1px solid',
                                    borderColor: 'grey.200',
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <PublicIcon
                                        sx={{
                                            fontSize: 24,
                                            color: 'primary.main',
                                            mr: 1.5,
                                        }}
                                    />
                                    <Box>
                                        <Typography
                                            variant="body2"
                                            sx={{ color: 'text.secondary', fontWeight: 500 }}
                                        >
                                            Job timezone
                                        </Typography>
                                        <Typography variant="body1">
                                            {formatTimezoneDisplay(selectedTimeZone)}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Paper>
                        )}
                    </Box>
                </DialogContent>

                {/* Actions */}
                <DialogActions
                    sx={(theme) => ({
                        px: 3,
                        py: 2,
                        bgcolor: 'background.paper',
                        borderTop: `1px solid ${theme.palette.divider}`,
                        gap: 1,
                    })}
                >
                    <Button
                        onClick={onClose}
                        variant="outlined"
                        disabled={isLoading}
                        sx={{ minWidth: 100 }}
                    >
                        {readOnly ? 'Close' : 'Cancel'}
                    </Button>
                    {!readOnly && (
                        <Button
                            onClick={handleSubmit}
                            variant="contained"
                            color="primary"
                            disabled={isLoading}
                            startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : null}
                            sx={{ minWidth: 100 }}
                        >
                            {isLoading ? 'Saving...' : 'Save'}
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
        </LocalizationProvider>
    );
};

export default EditDateTimeDialog;
