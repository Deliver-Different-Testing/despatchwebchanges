/**
 * EditDateTimeDialog Component
 *
 * React replacement for the AngularJS edit-date-time-dialog.
 * Allows editing date and/or time values with timezone information.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogActions,
    Button,
    IconButton,
    Typography,
    Box,
    CircularProgress,
    Paper,
} from '@mui/material';
import {
    Today as TodayIcon,
    Close as CloseIcon,
    Public as PublicIcon,
    Work as WorkIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

import { EditDateTimeDialogProps, EditDateTimeDialogResult } from './types';

dayjs.extend(utc);
dayjs.extend(timezone);

// Default timezone constant
const DEFAULT_TIMEZONE = 'Pacific/Auckland';

/**
 * Format timezone for display (e.g., "Pacific/Auckland" -> "Pacific/Auckland (NZDT)")
 */
function formatTimezoneDisplay(tz: string): string {
    try {
        const now = dayjs().tz(tz);
        const abbr = now.format('z');
        return `${tz.replace(/_/g, ' ')} (${abbr})`;
    } catch {
        return tz.replace(/_/g, ' ');
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
    onClose,
    onSubmit,
    showToast,
}) => {
    // State
    const [dateTime, setDateTime] = useState<Dayjs>(dayjs());
    const [isLoading, setIsLoading] = useState(false);
    const [selectedTimeZone] = useState(defaultTimeZone || DEFAULT_TIMEZONE);
    const browserTimeZone = dayjs.tz.guess();

    // Initialize dateTime when dialog opens or initialDateTime changes
    useEffect(() => {
        if (open) {
            if (initialDateTime && initialDateTime.isValid()) {
                setDateTime(initialDateTime);
            } else {
                setDateTime(dayjs());
            }
        }
    }, [open, initialDateTime]);

    // Handle date/time change
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
        if (newValue && !isNaN(newValue.hour()) && !isNaN(newValue.minute())) {
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
        } catch (error: any) {
            console.error('Error submitting date/time:', error);
            showToast(error.message || 'Failed to save date/time', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [dateTime, fieldName, selectedTimeZone, processDateTime, onSubmit, showToast]);

    // Render the appropriate picker based on mode
    const renderPicker = () => {
        const commonProps = {
            value: dateTime,
            onChange: handleDateTimeChange,
            disabled: isLoading,
            slotProps: {
                textField: {
                    fullWidth: true,
                    sx: { '& .MuiOutlinedInput-root': { bgcolor: 'white' } },
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
                            borderRadius: 2,
                            overflow: 'hidden',
                            minWidth: 480,
                            maxWidth: 600,
                        },
                    },
                }}
            >
                {/* Header */}
                <Box
                    sx={(theme) => ({
                        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                        color: 'white',
                        px: 3,
                        py: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                    })}
                >
                    <Box
                        sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 1.5,
                            bgcolor: 'rgba(255,255,255,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <TodayIcon sx={{ fontSize: 24 }} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" fontWeight={600}>
                            {title}
                        </Typography>
                    </Box>
                    <IconButton
                        onClick={onClose}
                        disabled={isLoading}
                        sx={{
                            color: 'white',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                </Box>

                {/* Content */}
                <DialogContent sx={{ p: 0, bgcolor: '#fafafa' }}>
                    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {/* Date/Time Picker */}
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            {showDate && showTime ? (
                                // Show separate date and time pickers for better UX
                                <>
                                    <DatePicker
                                        value={dateTime}
                                        onChange={handleDateChange}
                                        disabled={isLoading}
                                        label="Date"
                                        format="YYYY-MM-DD"
                                        slotProps={{
                                            textField: {
                                                fullWidth: true,
                                                sx: { '& .MuiOutlinedInput-root': { bgcolor: 'white' } },
                                            },
                                        }}
                                    />
                                    <TimePicker
                                        value={dateTime}
                                        onChange={handleTimeChange}
                                        disabled={isLoading}
                                        label="Time (24-hour)"
                                        ampm={false}
                                        format="HH:mm"
                                        timeSteps={{ minutes: 1 }}
                                        slotProps={{
                                            textField: {
                                                fullWidth: true,
                                                sx: { '& .MuiOutlinedInput-root': { bgcolor: 'white' } },
                                            },
                                        }}
                                    />
                                </>
                            ) : (
                                renderPicker()
                            )}
                        </Box>

                        {/* Timezone Information - Only shown for US customers */}
                        {isUSCustomer && (
                            <Paper
                                elevation={0}
                                sx={{
                                    bgcolor: 'white',
                                    borderRadius: 3,
                                    p: 2.5,
                                    border: '1px solid',
                                    borderColor: 'grey.200',
                                }}
                            >
                                {/* Browser Timezone */}
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
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
                                            Your timezone
                                        </Typography>
                                        <Typography variant="body1">
                                            {formatTimezoneDisplay(browserTimeZone)}
                                        </Typography>
                                    </Box>
                                </Box>

                                {/* Job Timezone */}
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <WorkIcon
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
                        bgcolor: 'white',
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
                        Cancel
                    </Button>
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
                </DialogActions>
            </Dialog>
        </LocalizationProvider>
    );
};

export default EditDateTimeDialog;
