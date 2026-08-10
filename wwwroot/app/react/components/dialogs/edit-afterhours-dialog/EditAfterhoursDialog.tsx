/**
 * React Edit Afterhours Dialog
 *
 * A modern replacement for the AngularJS edit-afterhours-dialog.
 * Allows users to create or edit afterhours schedules for couriers.
 *
 * Uses React Query for data fetching with automatic caching and loading states.
 */

import React, {useState, useCallback, useEffect, useMemo} from 'react';
import {Alert, Box, Group, MultiSelect, Paper, Select, Stack, Text, TextInput, alpha} from '@mantine/core';
import {Calendar, Clock, Save, Timer, TriangleAlert, User} from 'lucide-react';
import {
    AfterHoursCourierSchedule,
    TimeZoneOption,
    CourierSuggestion,
    DAYS_OF_WEEK,
    DayOfWeek,
} from '../../../interfaces';
import {useCourierSearch, useTimeZoneOptions} from '../../../hooks/useCourierApi';
import type {ShowToastFn} from '../../../services/toastService';
import {Icon} from '../../common/icon/Icon';
import {SearchSelect} from '../../common/search-select/SearchSelect';
import {DialogShell, DialogHeader, DialogFooter, dialogContentBg, sectionPaperProps} from '../shared/mantine';

export interface EditAfterhoursDialogProps {
    open: boolean;
    schedule: AfterHoursCourierSchedule | null;
    isUsTenant: boolean;
    onClose: () => void;
    onSave: (schedule: AfterHoursCourierSchedule) => void;
    showToast: ShowToastFn;
}

interface ValidationErrors {
    courier?: string;
    days?: string;
    startTime?: string;
    endTime?: string;
    timeZone?: string;
    timeLogic?: string;
}

const courierKey = (courier: CourierSuggestion) => courier.id;
const courierLabel = (courier: CourierSuggestion) => courier.text;

/** Courier suggestion text is typically "Code (Name)", or just the code. */
function deriveCourierCode(text: string): string {
    const parts = text.split('(');
    return parts.length > 1 ? parts[0].trim() : text;
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
    const [selectedCourier, setSelectedCourier] = useState<CourierSuggestion | null>(null);
    const [courierCode, setCourierCode] = useState<string>('');
    const [selectedDays, setSelectedDays] = useState<string[]>([]);
    const [startTime, setStartTime] = useState<string>('');
    const [endTime, setEndTime] = useState<string>('');
    const [selectedTimeZone, setSelectedTimeZone] = useState<TimeZoneOption | null>(null);

    // UI state
    const [courierSearchText, setCourierSearchText] = useState<string>('');
    const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const courierId = selectedCourier?.id ?? 0;
    const courierName = selectedCourier?.text ?? '';

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
            setSelectedCourier({id: schedule.courierId, text: schedule.courierName});
            setCourierCode(schedule.courierCode);
            setSelectedDays(schedule.days || []);
            setStartTime(schedule.startTime || '');
            setEndTime(schedule.endTime || '');
            setCourierSearchText('');
            setValidationErrors({});
            setIsSubmitting(false);
            // selectedTimeZone is set by the useEffect above when timeZoneOptions load
        } else if (open && !schedule) {
            // New schedule - reset all fields
            setSelectedCourier(null);
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
        setSelectedCourier(courier);
        setCourierCode(courier ? deriveCourierCode(courier.text) : '');
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
    }, [startTime, endTime, isUsTenant, selectedTimeZone, selectedDays.length]);

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

    const title = `${isNewSchedule ? 'Create' : 'Edit'} Afterhours Schedule`;

    return (
        <DialogShell opened={open} onClose={onClose} label={title}>
            <DialogHeader
                icon={<Icon lucide={Clock}/>}
                title={title}
                subtitle="Set courier availability outside business hours"
                onClose={onClose}
                closeDisabled={isSubmitting}
            />
            {/* Content */}
            <Box p="lg" style={{backgroundColor: dialogContentBg}}>
                {/* Driver Selection Section */}
                <Paper {...sectionPaperProps} mb="lg">
                    <Group gap="xs" mb="md" wrap="nowrap">
                        <Box c="dimmed" style={{display: 'flex'}}>
                            <Icon lucide={User}/>
                        </Box>
                        <Text fw={500}>{isNewSchedule ? 'Select' : 'Change'} Driver</Text>
                    </Group>

                    <SearchSelect<CourierSuggestion>
                        label="Search driver..."
                        placeholder="Type at least 2 characters"
                        value={selectedCourier}
                        onChange={handleCourierSelect}
                        options={courierOptions}
                        onSearchChange={setCourierSearchText}
                        loading={isSearchingCouriers}
                        getOptionKey={courierKey}
                        getOptionLabel={courierLabel}
                        error={validationErrors.courier}
                    />

                    {/* Current selection info for existing schedules */}
                    {!isNewSchedule && courierName && (
                        <Group
                            gap="xs"
                            mt="sm"
                            p="sm"
                            wrap="nowrap"
                            style={{
                                backgroundColor: 'var(--mantine-color-gray-1)',
                                borderRadius: 'var(--mantine-radius-sm)',
                            }}
                        >
                            <Text size="sm" c="dimmed">Current driver:</Text>
                            <Text size="sm" fw={600}>{courierName}</Text>
                            {courierCode && (
                                <Text size="sm" c="dimmed" fs="italic">({courierCode})</Text>
                            )}
                        </Group>
                    )}
                </Paper>

                {/* Schedule Details Section */}
                <Paper {...sectionPaperProps}>
                    <Group gap="xs" mb="lg" wrap="nowrap">
                        <Box c="dimmed" style={{display: 'flex'}}>
                            <Icon lucide={Clock}/>
                        </Box>
                        <Text fw={500}>Schedule Details</Text>
                    </Group>

                    <Stack gap="lg">
                        {/* Days of Week Selection */}
                        <Box>
                            <MultiSelect
                                label="Days of Week"
                                data={[...DAYS_OF_WEEK]}
                                value={selectedDays}
                                onChange={setSelectedDays}
                                error={validationErrors.days}
                                clearable
                            />
                            {selectedDays.length > 0 && (
                                <Text size="xs" c="dimmed" mt={4}>{getSelectedDaysText()}</Text>
                            )}
                        </Box>

                        {/* Time Inputs */}
                        <Group gap="md" grow align="flex-start">
                            {/*
                              * Plain time inputs, not `@mantine/dates`: these values are
                              * wall-clock "HH:mm" strings that must round-trip unchanged.
                              */}
                            <TextInput
                                label="Start Time"
                                type="time"
                                value={startTime}
                                onChange={(e) => setStartTime(e.currentTarget.value)}
                                error={validationErrors.startTime}
                            />
                            <TextInput
                                label="End Time"
                                type="time"
                                value={endTime}
                                onChange={(e) => setEndTime(e.currentTarget.value)}
                                error={validationErrors.endTime}
                            />
                        </Group>

                        {/* Timezone Selection (US only) */}
                        {isUsTenant && (
                            <Select
                                label="Timezone"
                                data={timeZoneOptions.map(tz => ({value: String(tz.id), label: tz.text}))}
                                value={selectedTimeZone ? String(selectedTimeZone.id) : null}
                                onChange={(value) => {
                                    setSelectedTimeZone(timeZoneOptions.find(t => String(t.id) === value) ?? null);
                                }}
                                error={validationErrors.timeZone}
                                disabled={isLoadingTimeZones}
                            />
                        )}

                        {/* Duration Display */}
                        {duration && (
                            <Group
                                gap="sm"
                                p="sm"
                                wrap="nowrap"
                                style={{
                                    backgroundColor: alpha('var(--mantine-color-reflex-6)', 0.08),
                                    borderRadius: 'var(--mantine-radius-sm)',
                                }}
                            >
                                <Box c="reflex.6" style={{display: 'flex'}}>
                                    <Icon lucide={Timer}/>
                                </Box>
                                <Text size="sm" c="dimmed">Total Duration</Text>
                                <Text fw={600} ml="auto">{duration}</Text>
                            </Group>
                        )}

                        {/* Next Day Indicator */}
                        {isNextDay && (
                            <Alert color="orange" icon={<Icon lucide={Calendar}/>}>
                                This shift spans across midnight into <strong>{getEffectiveEndDay()}</strong>
                            </Alert>
                        )}

                        {/* Time Logic Error */}
                        {validationErrors.timeLogic && (
                            <Alert color="red" icon={<Icon lucide={TriangleAlert}/>}>
                                {validationErrors.timeLogic}
                            </Alert>
                        )}
                    </Stack>
                </Paper>
            </Box>
            <DialogFooter
                onCancel={onClose}
                onConfirm={handleSave}
                confirmLabel={isSubmitting ? 'Saving...' : `${isNewSchedule ? 'Create' : 'Save'} Schedule`}
                confirmIcon={<Icon lucide={Save}/>}
                confirmDisabled={!isFormValid || isSubmitting}
                submitting={isSubmitting}
            />
        </DialogShell>
    );
};

export default EditAfterhoursDialog;
