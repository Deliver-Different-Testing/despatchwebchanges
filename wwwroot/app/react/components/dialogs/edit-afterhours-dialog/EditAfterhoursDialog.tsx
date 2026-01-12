/**
 * React Edit Afterhours Dialog
 *
 * A modern replacement for the AngularJS edit-afterhours-dialog using MUI components.
 * Allows users to create or edit afterhours schedules for couriers.
 *
 * Uses React Query for data fetching with automatic caching and loading states.
 */

import React, {useState, useCallback, useEffect, useMemo} from 'react';
import {
    Dialog,
    DialogContent,
    DialogActions,
    Button,
    IconButton,
    Typography,
    Box,
    TextField,
    Autocomplete,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Checkbox,
    ListItemText,
    OutlinedInput,
    Paper,
    CircularProgress,
    Alert,
    Chip,
    alpha,
    SelectChangeEvent,
} from '@mui/material';
import {
    Close as CloseIcon,
    Schedule as ScheduleIcon,
    Person as PersonIcon,
    Timer as TimerIcon,
    Event as EventIcon,
    Save as SaveIcon,
    Warning as WarningIcon,
} from '@mui/icons-material';
import {
    AfterHoursCourierSchedule,
    TimeZoneOption,
    CourierSuggestion,
    DAYS_OF_WEEK,
    DayOfWeek,
} from '../../../interfaces';
import {useCourierSearch, useTimeZoneOptions} from '../../../hooks';

export interface EditAfterhoursDialogProps {
    open: boolean;
    schedule: AfterHoursCourierSchedule | null;
    isUsTenant: boolean;
    onClose: () => void;
    onSave: (schedule: AfterHoursCourierSchedule) => void;
    showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
}

interface ValidationErrors {
    courier?: string;
    days?: string;
    startTime?: string;
    endTime?: string;
    timeZone?: string;
    timeLogic?: string;
}

export const EditAfterhoursDialog: React.FC<EditAfterhoursDialogProps> = ({
    open,
    schedule,
    isUsTenant,
    onClose,
    onSave,
    showToast,
}) => {
    const isNewSchedule = !schedule || schedule.afterHoursScheduleId === 0;

    // Form state
    const [courierId, setCourierId] = useState<number>(0);
    const [courierName, setCourierName] = useState<string>('');
    const [courierCode, setCourierCode] = useState<string>('');
    const [selectedDays, setSelectedDays] = useState<string[]>([]);
    const [startTime, setStartTime] = useState<string>('');
    const [endTime, setEndTime] = useState<string>('');
    const [selectedTimeZone, setSelectedTimeZone] = useState<TimeZoneOption | null>(null);

    // UI state
    const [courierSearchText, setCourierSearchText] = useState<string>('');
    const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // React Query hooks
    const {
        data: courierOptions = [],
        isFetching: isSearchingCouriers,
        error: courierSearchError,
    } = useCourierSearch(courierSearchText, {enabled: open});

    const {
        data: timeZoneOptions = [],
        isLoading: isLoadingTimeZones,
        error: timeZoneError,
    } = useTimeZoneOptions({enabled: open && isUsTenant});

    // Show error toasts for query failures
    useEffect(() => {
        if (courierSearchError) {
            showToast('An error occurred while searching. Please try again later.', 'error');
        }
    }, [courierSearchError, showToast]);

    useEffect(() => {
        if (timeZoneError) {
            showToast('Failed to load time zone options.', 'error');
        }
    }, [timeZoneError, showToast]);

    // Set selected timezone when options load
    useEffect(() => {
        if (timeZoneOptions.length > 0 && schedule?.timezone && !selectedTimeZone) {
            const selected = timeZoneOptions.find(t => t.timeZoneIana === schedule.timezone);
            if (selected) {
                setSelectedTimeZone(selected);
            }
        }
    }, [timeZoneOptions, schedule?.timezone, selectedTimeZone]);

    // Reset form when dialog opens
    useEffect(() => {
        if (open && schedule) {
            setCourierId(schedule.courierId);
            setCourierName(schedule.courierName);
            setCourierCode(schedule.courierCode);
            setSelectedDays(schedule.days || []);
            setStartTime(schedule.startTime || '');
            setEndTime(schedule.endTime || '');
            setCourierSearchText(schedule.courierName || '');
            setValidationErrors({});
            setIsSubmitting(false);
            // selectedTimeZone is set by the useEffect above when timeZoneOptions load
        } else if (open && !schedule) {
            // New schedule - reset all fields
            setCourierId(0);
            setCourierName('');
            setCourierCode('');
            setSelectedDays([]);
            setStartTime('');
            setEndTime('');
            setCourierSearchText('');
            setSelectedTimeZone(null);
            setValidationErrors({});
            setIsSubmitting(false);
        }
    }, [open, schedule]);

    // Handle courier selection
    const handleCourierSelect = useCallback((courier: CourierSuggestion | null) => {
        if (courier) {
            setCourierId(courier.id);
            setCourierName(courier.text);
            // Extract courier code if present (format is typically "Code (Name)" or just "Code")
            const parts = courier.text.split('(');
            if (parts.length > 1) {
                setCourierCode(parts[0].trim());
            } else {
                setCourierCode(courier.text);
            }
        } else {
            setCourierId(0);
            setCourierName('');
            setCourierCode('');
        }
    }, []);

    // Calculate duration
    const {duration, isNextDay} = useMemo(() => {
        if (!startTime || !endTime) {
            return {duration: '', isNextDay: false};
        }

        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);

        const startMinutes = startHour * 60 + startMin;
        let endMinutes = endHour * 60 + endMin;

        const crossesMidnight = endMinutes <= startMinutes;
        if (crossesMidnight) {
            endMinutes += 24 * 60;
        }

        const diffMinutes = endMinutes - startMinutes;
        const hours = Math.floor(diffMinutes / 60);
        const minutes = diffMinutes % 60;

        return {
            duration: `${hours}h ${minutes.toString().padStart(2, '0')}m`,
            isNextDay: crossesMidnight,
        };
    }, [startTime, endTime]);

    // Get effective end day for display
    const getEffectiveEndDay = useCallback((): string => {
        if (!isNextDay || selectedDays.length === 0) {
            return '';
        }

        if (selectedDays.length > 1) {
            return 'the next day';
        }

        const currentDay = selectedDays[0];
        const currentDayIndex = DAYS_OF_WEEK.indexOf(currentDay as DayOfWeek);
        const nextDayIndex = (currentDayIndex + 1) % DAYS_OF_WEEK.length;
        return DAYS_OF_WEEK[nextDayIndex];
    }, [isNextDay, selectedDays]);

    // Validation
    const validateForm = useCallback((): boolean => {
        const errors: ValidationErrors = {};

        if (!courierId) {
            errors.courier = 'Please select a courier';
        }

        if (selectedDays.length === 0) {
            errors.days = 'Please select at least one day';
        }

        if (!startTime) {
            errors.startTime = 'Please set a start time';
        }

        if (!endTime) {
            errors.endTime = 'Please set an end time';
        }

        if (isUsTenant && !selectedTimeZone) {
            errors.timeZone = 'Please select a time zone';
        }

        if (startTime && endTime && startTime === endTime) {
            errors.timeLogic = 'Start time and end time cannot be the same';
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    }, [courierId, selectedDays, startTime, endTime, isUsTenant, selectedTimeZone]);

    // Handle days change
    const handleDaysChange = (event: SelectChangeEvent<string[]>) => {
        const value = event.target.value;
        setSelectedDays(typeof value === 'string' ? value.split(',') : value);
    };

    // Get selected days text
    const getSelectedDaysText = (): string => {
        if (selectedDays.length === 0) return '';
        if (selectedDays.length === 7) return 'Every day';
        if (selectedDays.length === 1) return '1 day selected';
        return `${selectedDays.length} days selected`;
    };

    // Handle save
    const handleSave = async () => {
        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);

        const updatedSchedule: AfterHoursCourierSchedule = {
            afterHoursScheduleId: schedule?.afterHoursScheduleId || 0,
            courierId,
            courierName,
            courierCode,
            days: selectedDays,
            startTime,
            endTime,
            timezone: selectedTimeZone?.timeZoneIana,
            duration,
        };

        onSave(updatedSchedule);
    };

    const isFormValid = Object.keys(validationErrors).length === 0 &&
        courierId > 0 &&
        selectedDays.length > 0 &&
        startTime &&
        endTime &&
        (!isUsTenant || selectedTimeZone);

    if (!open) return null;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                elevation: 24,
                sx: {
                    borderRadius: 2,
                    overflow: 'hidden',
                    minWidth: 500,
                    maxWidth: 600,
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
                    <ScheduleIcon sx={{fontSize: 24}} />
                </Box>
                <Box sx={{flex: 1}}>
                    <Typography variant="h6" fontWeight={600}>
                        {isNewSchedule ? 'Create' : 'Edit'} Afterhours Schedule
                    </Typography>
                </Box>
                <IconButton
                    onClick={onClose}
                    disabled={isSubmitting}
                    sx={{
                        color: 'white',
                        '&:hover': {bgcolor: 'rgba(255,255,255,0.1)'},
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </Box>

            {/* Content */}
            <DialogContent sx={{p: 3, bgcolor: '#fafafa'}}>
                {/* Driver Selection Section */}
                <Paper
                    elevation={0}
                    sx={{
                        p: 2.5,
                        mb: 2.5,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'white',
                    }}
                >
                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 2}}>
                        <PersonIcon sx={{color: 'text.secondary'}} />
                        <Typography variant="subtitle1" fontWeight={500}>
                            {isNewSchedule ? 'Select' : 'Change'} Driver
                        </Typography>
                    </Box>

                    <Autocomplete
                        options={courierOptions}
                        getOptionLabel={(option) => option.text}
                        loading={isSearchingCouriers}
                        inputValue={courierSearchText}
                        onInputChange={(_, value) => {
                            setCourierSearchText(value);
                        }}
                        onChange={(_, value) => handleCourierSelect(value)}
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Search driver..."
                                placeholder="Type at least 2 characters"
                                error={!!validationErrors.courier}
                                helperText={validationErrors.courier}
                                InputProps={{
                                    ...params.InputProps,
                                    endAdornment: (
                                        <>
                                            {isSearchingCouriers ? <CircularProgress size={20} /> : null}
                                            {params.InputProps.endAdornment}
                                        </>
                                    ),
                                }}
                            />
                        )}
                        noOptionsText={courierSearchText.length < 2 ? 'Type to search...' : 'No drivers found'}
                    />

                    {/* Current selection info for existing schedules */}
                    {!isNewSchedule && courierName && (
                        <Box
                            sx={{
                                mt: 1.5,
                                p: 1.5,
                                bgcolor: 'grey.100',
                                borderRadius: 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                            }}
                        >
                            <Typography variant="body2" color="text.secondary">
                                Current driver:
                            </Typography>
                            <Typography variant="body2" fontWeight={600}>
                                {courierName}
                            </Typography>
                            {courierCode && (
                                <Typography variant="body2" color="text.secondary" fontStyle="italic">
                                    ({courierCode})
                                </Typography>
                            )}
                        </Box>
                    )}
                </Paper>

                {/* Schedule Details Section */}
                <Paper
                    elevation={0}
                    sx={{
                        p: 2.5,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'white',
                    }}
                >
                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 3}}>
                        <ScheduleIcon sx={{color: 'text.secondary'}} />
                        <Typography variant="subtitle1" fontWeight={500}>
                            Schedule Details
                        </Typography>
                    </Box>

                    {/* Days of Week Selection */}
                    <FormControl fullWidth sx={{mb: 2.5}} error={!!validationErrors.days}>
                        <InputLabel>Days of Week</InputLabel>
                        <Select
                            multiple
                            value={selectedDays}
                            onChange={handleDaysChange}
                            input={<OutlinedInput label="Days of Week" />}
                            renderValue={(selected) => (
                                <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.5}}>
                                    {selected.map((day) => (
                                        <Chip key={day} label={day} size="small" />
                                    ))}
                                </Box>
                            )}
                        >
                            {DAYS_OF_WEEK.map((day) => (
                                <MenuItem key={day} value={day}>
                                    <Checkbox checked={selectedDays.includes(day)} />
                                    <ListItemText primary={day} />
                                </MenuItem>
                            ))}
                        </Select>
                        {validationErrors.days && (
                            <Typography variant="caption" color="error" sx={{mt: 0.5}}>
                                {validationErrors.days}
                            </Typography>
                        )}
                        {selectedDays.length > 0 && (
                            <Typography variant="caption" color="text.secondary" sx={{mt: 0.5}}>
                                {getSelectedDaysText()}
                            </Typography>
                        )}
                    </FormControl>

                    {/* Time Inputs */}
                    <Box sx={{display: 'flex', gap: 2, mb: 2.5}}>
                        <TextField
                            label="Start Time"
                            type="time"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            error={!!validationErrors.startTime}
                            helperText={validationErrors.startTime}
                            InputLabelProps={{shrink: true}}
                            fullWidth
                        />
                        <TextField
                            label="End Time"
                            type="time"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            error={!!validationErrors.endTime}
                            helperText={validationErrors.endTime}
                            InputLabelProps={{shrink: true}}
                            fullWidth
                        />
                    </Box>

                    {/* Timezone Selection (US only) */}
                    {isUsTenant && (
                        <FormControl fullWidth sx={{mb: 2.5}} error={!!validationErrors.timeZone}>
                            <InputLabel>Timezone</InputLabel>
                            <Select
                                value={selectedTimeZone?.id || ''}
                                onChange={(e) => {
                                    const selected = timeZoneOptions.find(t => t.id === e.target.value);
                                    setSelectedTimeZone(selected || null);
                                }}
                                label="Timezone"
                                disabled={isLoadingTimeZones}
                            >
                                {timeZoneOptions.map((tz) => (
                                    <MenuItem key={tz.id} value={tz.id}>
                                        {tz.text}
                                    </MenuItem>
                                ))}
                            </Select>
                            {validationErrors.timeZone && (
                                <Typography variant="caption" color="error" sx={{mt: 0.5}}>
                                    {validationErrors.timeZone}
                                </Typography>
                            )}
                        </FormControl>
                    )}

                    {/* Duration Display */}
                    {duration && (
                        <Box
                            sx={(theme) => ({
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1.5,
                                p: 1.5,
                                bgcolor: alpha(theme.palette.info.main, 0.08),
                                borderRadius: 1,
                                mb: 2,
                            })}
                        >
                            <TimerIcon sx={{color: 'info.main'}} />
                            <Typography variant="body2" color="text.secondary">
                                Total Duration
                            </Typography>
                            <Typography variant="body1" fontWeight={600} sx={{ml: 'auto'}}>
                                {duration}
                            </Typography>
                        </Box>
                    )}

                    {/* Next Day Indicator */}
                    {isNextDay && (
                        <Alert
                            severity="warning"
                            icon={<EventIcon />}
                            sx={{mb: 2}}
                        >
                            This shift spans across midnight into <strong>{getEffectiveEndDay()}</strong>
                        </Alert>
                    )}

                    {/* Time Logic Error */}
                    {validationErrors.timeLogic && (
                        <Alert severity="error" icon={<WarningIcon />}>
                            {validationErrors.timeLogic}
                        </Alert>
                    )}
                </Paper>
            </DialogContent>

            {/* Actions */}
            <DialogActions
                sx={(theme) => ({
                    px: 3,
                    py: 2,
                    bgcolor: '#fafafa',
                    borderTop: `1px solid ${theme.palette.divider}`,
                    gap: 1,
                })}
            >
                <Button
                    onClick={onClose}
                    variant="outlined"
                    disabled={isSubmitting}
                    sx={{minWidth: 100}}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleSave}
                    variant="contained"
                    color="primary"
                    disabled={!isFormValid || isSubmitting}
                    startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                    sx={{minWidth: 140}}
                >
                    {isSubmitting ? 'Saving...' : `${isNewSchedule ? 'Create' : 'Save'} Schedule`}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default EditAfterhoursDialog;
