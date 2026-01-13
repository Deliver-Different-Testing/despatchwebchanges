/**
 * React Add Event Dialog
 *
 * A modern replacement for the AngularJS add-event-dialog using MUI components.
 * Allows users to add a task/event to a job with event type, date/time, and notes.
 */

import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogActions,
    Button,
    IconButton,
    Typography,
    Box,
    TextField,
    CircularProgress,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
} from '@mui/material';
import {
    Close as CloseIcon,
    Event as EventIcon,
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

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
    showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
    timezone: string;
}

interface AddEventDialogState {
    eventTypes: EventType[];
    selectedEventTypeId: number | '';
    eventDate: Dayjs;
    notes: string;
    isLoading: boolean;
    isSubmitting: boolean;
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

export class AddEventDialog extends React.Component<AddEventDialogProps, AddEventDialogState> {
    constructor(props: AddEventDialogProps) {
        super(props);
        this.state = {
            eventTypes: [],
            selectedEventTypeId: '',
            eventDate: dayjs().tz(props.timezone),
            notes: '',
            isLoading: false,
            isSubmitting: false,
        };
    }

    componentDidUpdate(prevProps: AddEventDialogProps): void {
        // Reset state and load event types when dialog opens
        if (this.props.open && !prevProps.open) {
            this.setState({
                selectedEventTypeId: '',
                eventDate: dayjs().tz(this.props.timezone),
                notes: '',
                isLoading: true,
                isSubmitting: false,
            });
            this.loadEventTypes();
        }
    }

    private loadEventTypes = async (): Promise<void> => {
        const { onLoadEventTypes, showToast } = this.props;
        try {
            const eventTypes = await onLoadEventTypes();
            const otherEvent = eventTypes.find(et => et.id === EventTypeIds.Other);
            this.setState({
                eventTypes,
                selectedEventTypeId: otherEvent?.id ?? '',
                isLoading: false,
            });
        } catch (error) {
            console.error('Error loading event types:', error);
            showToast('Failed to load event types.', 'error');
            this.setState({ isLoading: false });
        }
    };

    private handleEventTypeChange = (event: any): void => {
        this.setState({ selectedEventTypeId: event.target.value });
    };

    private handleDateChange = (newDate: Dayjs | null): void => {
        if (newDate && newDate.isValid()) {
            this.setState({ eventDate: newDate });
        }
    };

    private handleNotesChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({ notes: event.target.value });
    };

    private get isFormValid(): boolean {
        const { selectedEventTypeId } = this.state;
        return selectedEventTypeId !== '';
    }

    private handleSubmit = async (): Promise<void> => {
        const { job, onSubmit, onClose, showToast } = this.props;
        const { selectedEventTypeId, eventDate, notes } = this.state;

        if (!job) return;

        if (!this.isFormValid) {
            showToast('Please complete all required fields.', 'warning');
            return;
        }

        this.setState({ isSubmitting: true });

        try {
            const eventData: JobEventData = {
                jobId: job.id,
                notes: notes,
                eventTypeId: selectedEventTypeId as number,
                eventDueDate: eventDate.toISOString(),
            };

            await onSubmit(eventData);
            showToast('Task added successfully.', 'success');
            onClose();
        } catch (error: any) {
            console.error('Error adding event:', error);
            showToast(error.message || 'Failed to add task.', 'error');
            this.setState({ isSubmitting: false });
        }
    };

    render(): React.ReactNode {
        const { open, job, onClose } = this.props;
        const { eventTypes, selectedEventTypeId, eventDate, notes, isLoading, isSubmitting } = this.state;

        if (!job) return null;

        return (
            <LocalizationProvider dateAdapter={AdapterDayjs}>
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
                            minWidth: 480,
                            maxWidth: 560,
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
                    <DialogContent sx={{ p: 3, bgcolor: '#fafafa' }}>
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
                                            onChange={this.handleEventTypeChange}
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
                                        onChange={this.handleDateChange}
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
                                    onChange={this.handleNotesChange}
                                    disabled={isSubmitting}
                                    inputProps={{ maxLength: 150 }}
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
                            onClick={this.handleSubmit}
                            variant="contained"
                            color="primary"
                            disabled={!this.isFormValid || isSubmitting || isLoading}
                            startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : null}
                            sx={{ minWidth: 100 }}
                        >
                            {isSubmitting ? 'Saving...' : 'Save'}
                        </Button>
                    </DialogActions>
                </Dialog>
            </LocalizationProvider>
        );
    }
}

export default AddEventDialog;
