/**
 * React Date Range Dialog
 *
 * A modern replacement for the AngularJS date-range-dialog using MUI components.
 */

import React, {useState, useMemo} from 'react';
import {
    Dialog,
    DialogContent,
    DialogActions,
    Button,
    IconButton,
    Typography,
    Box,
    Paper,
    Stack,
    alpha,
} from '@mui/material';
import {
    Close as CloseIcon,
    DateRange as DateRangeIcon,
    ArrowForward as ArrowForwardIcon,
    CalendarMonth as CalendarIcon,
} from '@mui/icons-material';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import {DateCalendar} from '@mui/x-date-pickers/DateCalendar';
import dayjs, {Dayjs} from 'dayjs';

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
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Dialog
                open={open}
                onClose={onClose}
                maxWidth="md"
                fullWidth
                slotProps={{
                    paper: {
                        elevation: 24,
                        sx: {
                            borderRadius: 3,
                            overflow: 'hidden',
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
                        py: 2.5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                    })}
                >
                    <Box
                        sx={{
                            width: 48,
                            height: 48,
                            borderRadius: 2,
                            bgcolor: 'rgba(255,255,255,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <DateRangeIcon sx={{ fontSize: 28 }} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="h5" fontWeight={600}>
                            Select Date Range
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.25 }}>
                            Choose a start and end date for your report
                        </Typography>
                    </Box>
                    <IconButton
                        onClick={onClose}
                        sx={{
                            color: 'white',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                </Box>

                {/* Summary Bar */}
                <Box
                    sx={(theme) => ({
                        px: 3,
                        py: 2,
                        bgcolor: alpha(theme.palette.primary.main, 0.04),
                        borderBottom: `1px solid ${theme.palette.divider}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 2,
                    })}
                >
                    <Paper
                        elevation={0}
                        sx={(theme) => ({
                            px: 2.5,
                            py: 1,
                            borderRadius: 2,
                            bgcolor: 'white',
                            border: `1px solid ${theme.palette.divider}`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                        })}
                    >
                        <CalendarIcon fontSize="small" color="primary" />
                        <Typography variant="body2" color="text.secondary">
                            From
                        </Typography>
                        <Typography variant="subtitle2" fontWeight={600}>
                            {startDate?.format('MMM D, YYYY')}
                        </Typography>
                    </Paper>

                    <ArrowForwardIcon color="action" />

                    <Paper
                        elevation={0}
                        sx={(theme) => ({
                            px: 2.5,
                            py: 1,
                            borderRadius: 2,
                            bgcolor: 'white',
                            border: `1px solid ${theme.palette.divider}`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                        })}
                    >
                        <CalendarIcon fontSize="small" color="primary" />
                        <Typography variant="body2" color="text.secondary">
                            To
                        </Typography>
                        <Typography variant="subtitle2" fontWeight={600}>
                            {endDate?.format('MMM D, YYYY')}
                        </Typography>
                    </Paper>

                    <Paper
                        elevation={0}
                        sx={(theme) => ({
                            px: 2,
                            py: 1,
                            borderRadius: 2,
                            bgcolor: isValidRange ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.error.main, 0.1),
                            border: `1px solid ${isValidRange ? alpha(theme.palette.success.main, 0.3) : alpha(theme.palette.error.main, 0.3)}`,
                        })}
                    >
                        <Typography
                            variant="subtitle2"
                            fontWeight={600}
                            color={isValidRange ? 'success.main' : 'error.main'}
                        >
                            {isValidRange ? `${duration} Day${duration !== 1 ? 's' : ''}` : 'Invalid'}
                        </Typography>
                    </Paper>
                </Box>

                {/* Content */}
                <DialogContent sx={{ p: 3, bgcolor: '#fafafa' }}>
                    <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={3}
                        justifyContent="center"
                    >
                        {/* Start Date Calendar */}
                        <Paper
                            elevation={0}
                            sx={(theme) => ({
                                borderRadius: 3,
                                overflow: 'hidden',
                                border: `1px solid ${theme.palette.divider}`,
                                bgcolor: 'white',
                            })}
                        >
                            <Box
                                sx={(theme) => ({
                                    px: 2,
                                    py: 1.5,
                                    bgcolor: alpha(theme.palette.primary.main, 0.06),
                                    borderBottom: `1px solid ${theme.palette.divider}`,
                                })}
                            >
                                <Typography variant="subtitle2" fontWeight={600} color="primary">
                                    Start Date
                                </Typography>
                            </Box>
                            <DateCalendar
                                value={startDate}
                                onChange={(newValue) => newValue && setStartDate(newValue)}
                                maxDate={endDate}
                                sx={{
                                    '& .MuiPickersDay-root.Mui-selected': {
                                        fontWeight: 600,
                                    },
                                }}
                            />
                        </Paper>

                        {/* End Date Calendar */}
                        <Paper
                            elevation={0}
                            sx={(theme) => ({
                                borderRadius: 3,
                                overflow: 'hidden',
                                border: `1px solid ${theme.palette.divider}`,
                                bgcolor: 'white',
                            })}
                        >
                            <Box
                                sx={(theme) => ({
                                    px: 2,
                                    py: 1.5,
                                    bgcolor: alpha(theme.palette.primary.main, 0.06),
                                    borderBottom: `1px solid ${theme.palette.divider}`,
                                })}
                            >
                                <Typography variant="subtitle2" fontWeight={600} color="primary">
                                    End Date
                                </Typography>
                            </Box>
                            <DateCalendar
                                value={endDate}
                                onChange={(newValue) => newValue && setEndDate(newValue)}
                                minDate={startDate}
                                sx={{
                                    '& .MuiPickersDay-root.Mui-selected': {
                                        fontWeight: 600,
                                    },
                                }}
                            />
                        </Paper>
                    </Stack>
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
                        sx={{ minWidth: 100 }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleApply}
                        variant="contained"
                        disabled={!isValidRange}
                        sx={{ minWidth: 100 }}
                    >
                        Apply
                    </Button>
                </DialogActions>
            </Dialog>
        </LocalizationProvider>
    );
};

export default DateRangeDialog;
