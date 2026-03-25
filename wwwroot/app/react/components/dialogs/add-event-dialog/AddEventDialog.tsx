/**
 * React Add Event Dialog
 *
 * A modern replacement for the AngularJS add-event-dialog using MUI components.
 * Allows users to add a task/event to a job with event type, date/time, and notes.
 */

import React, {useState, useMemo, useEffect, useCallback} from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import CloseIcon from '@mui/icons-material/Close';
import EventIcon from '@mui/icons-material/Event';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import type { ShowToastFn } from '../../../services/toastService';
import { formatDateForApi } from '../../../utils/dateUtils';

dayjs.extend(utc);
dayjs.extend(timezone);

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
            loadEventTypes();
        }
    }, [open, tz, loadEventTypes]);

    const handleEventTypeChange = (event: { target: { value: number | '' } }): void => {
        setSelectedEventTypeId(event.target.value);
    };

    const handleDateChange = (newDate: Dayjs | null): void => {
        if (newDate && newDate.isValid()) {
            setEventDate(newDate);
        }
    };

    const handleNotesChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
        setNotes(event.target.value);
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
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Dialog
                open={open}
                onClose={onClose}
                maxWidth="sm"
                fullWidth
                slotProps={{
                    paper: {
                        elevation: 24,
                        sx: {
                            borderRadius: 2,
                            overflow: 'hidden',
                            minWidth: 480,
                            maxWidth: 560,
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
                        <EventIcon sx={{ fontSize: 24 }} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" fontWeight={600}>
                            Add Task
                        </Typography>
                    </Box>
                    <IconButton
                        onClick={onClose}
                        disabled={isSubmitting}
                        sx={{
                            color: 'white',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                </Box>

                {/* Content */}
                <DialogContent sx={{ p: 3, bgcolor: 'background.default' }}>
                    {isLoading ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
                            <CircularProgress size={32} />
                        </Box>
                    ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {/* Job/Client Information */}
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <TextField
                                    fullWidth
                                    label="Job Number"
                                    value={job.jobNo}
                                    disabled
                                    size="small"
                                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'white' } }}
                                />
                                <TextField
                                    fullWidth
                                    label="Client"
                                    value={job.client}
                                    disabled
                                    size="small"
                                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'white' } }}
                                />
                            </Box>

                            {/* Task Type and Date */}
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <FormControl fullWidth size="small" required>
                                    <InputLabel>Task Type</InputLabel>
                                    <Select
                                        value={selectedEventTypeId}
                                        onChange={handleEventTypeChange}
                                        label="Task Type"
                                        disabled={isSubmitting}
                                        sx={{ bgcolor: 'white' }}
                                    >
                                        {eventTypes.map((eventType) => (
                                            <MenuItem key={eventType.id} value={eventType.id}>
                                                {eventType.text}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <DateTimePicker
                                    label="Due Date & Time"
                                    value={eventDate}
                                    onChange={handleDateChange}
                                    disabled={isSubmitting}
                                    slotProps={{
                                        textField: {
                                            size: 'small',
                                            fullWidth: true,
                                            sx: { '& .MuiOutlinedInput-root': { bgcolor: 'white' } },
                                        },
                                    }}
                                />
                            </Box>

                            {/* Notes */}
                            <TextField
                                fullWidth
                                multiline
                                rows={3}
                                label="Notes"
                                placeholder="Add notes for this task..."
                                value={notes}
                                onChange={handleNotesChange}
                                disabled={isSubmitting}
                                slotProps={{htmlInput: {maxLength: 150}}}
                                helperText={`${notes.length}/150 characters`}
                                sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'white' } }}
                            />
                        </Box>
                    )}
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
                        disabled={isSubmitting}
                        sx={{ minWidth: 100 }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        variant="contained"
                        color="primary"
                        disabled={!isFormValid || isSubmitting || isLoading}
                        startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : null}
                        sx={{ minWidth: 100 }}
                    >
                        {isSubmitting ? 'Saving...' : 'Save'}
                    </Button>
                </DialogActions>
            </Dialog>
        </LocalizationProvider>
    );
};

export default AddEventDialog;
