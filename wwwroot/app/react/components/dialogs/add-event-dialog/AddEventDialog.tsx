/**
 * React Add Event Dialog
 *
 * Allows users to add a task/event to a job with event type, date/time, and notes.
 *
 * **Wall-clock in, API string out.** `DateTimePicker` is string-valued
 * (`YYYY-MM-DD HH:mm`), so the picker never builds an instant. The one place a
 * zone is applied is unchanged: the field is seeded with `dayjs().tz(tz)` — "now,
 * over there" — and submitted through `formatDateForApi(eventDate, tz)`.
 */

import React, {useState, useMemo, useEffect, useCallback} from 'react';
import {Box, Group, Loader, Select, Stack, Textarea, TextInput} from '@mantine/core';
import {DateTimePicker} from '@mantine/dates';
import {CalendarClock} from 'lucide-react';
import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {DialogShell, DialogHeader, DialogFooter, dialogContentBg} from '../shared/mantine';
import {Icon} from '../../common/icon/Icon';
import type { ShowToastFn } from '../../../services/toastService';
import { formatDateForApi, getInputDateFormat } from '../../../utils/dateUtils';

dayjs.extend(utc);
dayjs.extend(timezone);

/** What the picker exchanges values in, and the tenant-ordered form it displays. */
const PICKER_VALUE_FORMAT = 'YYYY-MM-DD HH:mm';

export interface EventType {
    id: number;
    text: string;
}

export interface AddEventJob {
    id: number;
    jobNo: string;
    client: string;
    clientId?: number;
}

export interface JobEventData {
    jobId: number;
    notes: string;
    eventTypeId: number;
    eventDueDate: string;
}

export interface AddEventDialogProps {
    open: boolean;
    job: AddEventJob | null;
    onClose: () => void;
    onSubmit: (eventData: JobEventData) => Promise<void>;
    onLoadEventTypes: () => Promise<EventType[]>;
    showToast: ShowToastFn;
    timezone: string;
}

// Event type IDs that match the EventType enum
const EventTypeIds = {
    Other: 66,
    Compliment: 7,
    Complaint: 92,
    Closed: 48,
    AddressIncorrect: 52,
    FlightDetails: 54,
    WaitingForJob: 60,
    CancelJob: 6,
};

export const AddEventDialog: React.FC<AddEventDialogProps> = ({
    open,
    job,
    onClose,
    onSubmit,
    onLoadEventTypes,
    showToast,
    timezone: tz,
}) => {
    const [eventTypes, setEventTypes] = useState<EventType[]>([]);
    const [selectedEventTypeId, setSelectedEventTypeId] = useState<number | ''>('');
    const [eventDate, setEventDate] = useState<Dayjs>(dayjs().tz(tz));
    const [notes, setNotes] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const loadEventTypes = useCallback(async (): Promise<void> => {
        try {
            const types = await onLoadEventTypes();
            const otherEvent = types.find(et => et.id === EventTypeIds.Other);
            setEventTypes(types);
            setSelectedEventTypeId(otherEvent?.id ?? '');
            setIsLoading(false);
        } catch (error) {
            console.error('Error loading event types:', error);
            showToast('Failed to load event types.', 'error');
            setIsLoading(false);
        }
    }, [onLoadEventTypes, showToast]);

    // Reset state and load event types when dialog opens
    useEffect(() => {
        if (open) {
            setSelectedEventTypeId('');
            setEventDate(dayjs().tz(tz));
            setNotes('');
            setIsLoading(true);
            setIsSubmitting(false);
            void loadEventTypes();
        }
    }, [open, tz, loadEventTypes]);

    // `Select` is string-valued; the event-type ids are numbers, so they round-trip
    // through `String()`/`Number()` at the component boundary.
    const eventTypeOptions = useMemo(
        () => eventTypes.map(({id, text}) => ({value: String(id), label: text})),
        [eventTypes],
    );

    const handleDateChange = (value: string | null): void => {
        const parsed = value ? dayjs(value) : null;
        if (parsed?.isValid()) {
            setEventDate(parsed);
        }
    };

    const isFormValid = useMemo(() => selectedEventTypeId !== '', [selectedEventTypeId]);

    const handleSubmit = async (): Promise<void> => {
        if (!job) return;

        if (!isFormValid) {
            showToast('Please complete all required fields.', 'warning');
            return;
        }

        setIsSubmitting(true);

        try {
            const eventData: JobEventData = {
                jobId: job.id,
                notes: notes,
                eventTypeId: selectedEventTypeId as number,
                eventDueDate: formatDateForApi(eventDate, tz),
            };

            await onSubmit(eventData);
            showToast('Task added successfully.', 'success');
            onClose();
        } catch (error: unknown) {
            console.error('Error adding event:', error);
            showToast(error instanceof Error ? error.message : 'Failed to add task.', 'error');
            setIsSubmitting(false);
        }
    };

    if (!job) return null;

    return (
        <DialogShell opened={open} onClose={onClose} label="Add Task">
            <DialogHeader
                icon={<Icon lucide={CalendarClock}/>}
                title="Add Task"
                subtitle="Create a new task for this job"
                onClose={onClose}
                closeDisabled={isSubmitting}
            />

            <Box p="lg" bg={dialogContentBg}>
                {isLoading ? (
                    <Group justify="center" py="xl">
                        <Loader size="md" aria-label="Loading task types"/>
                    </Group>
                ) : (
                    <Stack gap="lg">
                        <Group gap="md" grow align="flex-start">
                            <TextInput label="Job Number" value={job.jobNo} disabled/>
                            <TextInput label="Client" value={job.client} disabled/>
                        </Group>

                        <Group gap="md" grow align="flex-start">
                            <Select
                                label="Task Type"
                                required
                                value={selectedEventTypeId === '' ? null : String(selectedEventTypeId)}
                                onChange={(value) => setSelectedEventTypeId(value ? Number(value) : '')}
                                data={eventTypeOptions}
                                disabled={isSubmitting}
                            />
                            {/* 24-hour, tenant-ordered date — `TimePicker` rather than a native
                                time input so the segments never fall back to the browser's AM/PM. */}
                            <DateTimePicker
                                label="Due Date & Time"
                                value={eventDate.format(PICKER_VALUE_FORMAT)}
                                onChange={handleDateChange}
                                valueFormat={`${getInputDateFormat()} HH:mm`}
                                timePickerProps={{format: '24h', withDropdown: true}}
                                disabled={isSubmitting}
                            />
                        </Group>

                        <Textarea
                            label="Notes"
                            placeholder="Add notes for this task..."
                            value={notes}
                            onChange={(event) => setNotes(event.currentTarget.value)}
                            disabled={isSubmitting}
                            maxLength={150}
                            rows={3}
                            description={`${notes.length}/150 characters`}
                            inputWrapperOrder={['label', 'input', 'description', 'error']}
                        />
                    </Stack>
                )}
            </Box>

            <DialogFooter
                onCancel={onClose}
                onConfirm={handleSubmit}
                confirmLabel={isSubmitting ? 'Saving...' : 'Save'}
                confirmDisabled={!isFormValid || isLoading}
                submitting={isSubmitting}
            />
        </DialogShell>
    );
};

export default AddEventDialog;
