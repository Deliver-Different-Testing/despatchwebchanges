/**
 * React Event Group Dialog
 *
 * A modern replacement for the AngularJS event-group-dialog using MUI components.
 * Manages task group assignments for jobs with editable due dates, user assignments, and active toggles.
 */

import React, { useState, useCallback } from 'react';
import DialogContent from '@mui/material/DialogContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import ChecklistIcon from '@mui/icons-material/Checklist';
import SaveIcon from '@mui/icons-material/Save';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import { DialogShell, DialogHeader, DialogFooter } from '../shared';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { EventGroupViewModel, StaffSuggestion } from '../../../interfaces';
import { getTimezoneAbbreviation } from '../../../utils/dateUtils';
import { NoData } from '../../common/no-data/NoData';
import type { ShowToastFn } from '../../../services/toastService';

dayjs.extend(utc);
dayjs.extend(timezone);

export interface EventGroupDialogProps {
    open: boolean;
    events: EventGroupViewModel[];
    users: StaffSuggestion[];
    onClose: () => void;
    onSave: (events: EventGroupViewModel[]) => Promise<void>;
    onOpenAdminManager: () => void;
    showToast: ShowToastFn;
    timezone: string;
}

export const EventGroupDialog: React.FC<EventGroupDialogProps> = ({
    open,
    events,
    users,
    onClose,
    onSave,
    onOpenAdminManager,
    showToast,
    timezone: tz,
}) => {
    const [localEvents, setLocalEvents] = useState<EventGroupViewModel[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset local state when dialog opens with new events
    React.useEffect(() => {
        if (open && events.length > 0) {
            setLocalEvents(events.map(e => ({ ...e })));
        }
    }, [open, events]);

    const handleDueDateChange = useCallback((index: number, date: Dayjs | null) => {
        if (!date || !date.isValid()) return;
        setLocalEvents(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], dueTime: date.toDate() };
            return updated;
        });
    }, []);

    const handleUserChange = useCallback((index: number, user: StaffSuggestion | null) => {
        setLocalEvents(prev => {
            const updated = [...prev];
            updated[index] = {
                ...updated[index],
                assignTo: user ? { id: user.id, text: user.text } : undefined,
            };
            return updated;
        });
    }, []);

    const handleActiveToggle = useCallback((index: number) => {
        setLocalEvents(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], active: !updated[index].active };
            return updated;
        });
    }, []);

    const handleSave = useCallback(async () => {
        const activeEvents = localEvents.filter(e => e.active);
        if (activeEvents.length === 0) {
            showToast('No events are active. Please select at least one event to add to the job.', 'warning');
            return;
        }

        setIsSubmitting(true);
        try {
            const formattedEvents = activeEvents.map(event => ({
                ...event,
                dueTime: event.dueTime ? dayjs(event.dueTime).format() : undefined,
            }));
            await onSave(formattedEvents);
        } catch {
            setIsSubmitting(false);
        }
    }, [localEvents, onSave, showToast]);

    const hasEvents = localEvents.length > 0;

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DialogShell
                open={open}
                onClose={onClose}
                maxWidth="lg"
                slotProps={{
                    paper: {
                        sx: {
                            overflow: 'hidden',
                            width: '85%',
                            maxWidth: 1200,
                        },
                    },
                }}
            >
                <DialogHeader
                    icon={<ChecklistIcon/>}
                    title="Task Groups Management"
                    subtitle="Manage task group assignments for jobs"
                    onClose={onClose}
                    closeDisabled={isSubmitting}
                />

                {/* Content */}
                <DialogContent sx={{ p: 3, bgcolor: 'background.default' }}>
                    {hasEvents ? (
                        <Box
                            sx={{
                                p: 3,
                                bgcolor: 'background.paper',
                                borderRadius: 2,
                                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                            }}
                        >
                            <Box
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    mb: 2,
                                    pb: 1.5,
                                    borderBottom: '2px solid',
                                    borderColor: 'divider',
                                }}
                            >
                                <Box>
                                    <Typography
                                        variant="h6"
                                        sx={{
                                            fontWeight: 600,
                                            color: "text.primary"
                                        }}>
                                        Active Task Groups
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            color: "text.secondary",
                                            mt: 0.5
                                        }}>
                                        Manage task assignments and schedules
                                    </Typography>
                                </Box>
                            </Box>

                            <TableContainer
                                sx={{
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: 2,
                                    overflow: 'hidden',
                                }}
                            >
                                <Table sx={{ tableLayout: 'fixed' }}>
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: 'grey.50' }}>
                                            <TableCell sx={{ width: '18%', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                Task Type
                                            </TableCell>
                                            <TableCell sx={{ width: '15%', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                Group
                                            </TableCell>
                                            <TableCell sx={{ width: '10%', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                Sequence
                                            </TableCell>
                                            <TableCell sx={{ width: '22%', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                Due Date
                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        display: "block",
                                                        color: "text.secondary",
                                                        fontStyle: "italic"
                                                    }}>
                                                    {getTimezoneAbbreviation(tz)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{ width: '25%', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                Assign To
                                            </TableCell>
                                            <TableCell sx={{ width: '10%', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                Active
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {localEvents.map((item, index) => (
                                            <TableRow
                                                key={item.eventTypeGroupTypeGroupId}
                                                sx={{
                                                    height: 70,
                                                    '&:hover': {
                                                        bgcolor: 'rgba(87, 83, 78, 0.06)',
                                                    },
                                                    '&:last-child td': { borderBottom: 0 },
                                                }}
                                            >
                                                <TableCell sx={{ fontWeight: 500, color: 'text.primary' }}>
                                                    {item.eventType.text}
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={item.group}
                                                        size="small"
                                                        sx={{
                                                            bgcolor: 'grey.600',
                                                            color: 'white',
                                                            fontWeight: 500,
                                                            fontSize: '0.7rem',
                                                            textTransform: 'uppercase',
                                                            letterSpacing: '0.025em',
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Avatar
                                                        sx={{
                                                            width: 32,
                                                            height: 32,
                                                            bgcolor: 'grey.100',
                                                            color: 'text.secondary',
                                                            fontSize: '0.875rem',
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        {item.sequence}
                                                    </Avatar>
                                                </TableCell>
                                                <TableCell>
                                                    <DateTimePicker
                                                        value={item.dueTime ? dayjs(item.dueTime) : null}
                                                        onChange={(date) => handleDueDateChange(index, date)}
                                                        disabled={isSubmitting}
                                                        slotProps={{
                                                            textField: {
                                                                size: 'small',
                                                                fullWidth: true,
                                                                sx: { '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' } },
                                                            },
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Autocomplete
                                                        options={users}
                                                        getOptionLabel={(option) => option.text}
                                                        value={item.assignTo || null}
                                                        onChange={(_e, value) => handleUserChange(index, value)}
                                                        isOptionEqualToValue={(option, value) => option.id === value.id}
                                                        disabled={isSubmitting}
                                                        size="small"
                                                        renderInput={(params) => (
                                                            <TextField
                                                                {...params}
                                                                placeholder="Search User..."
                                                                sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' } }}
                                                            />
                                                        )}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Checkbox
                                                        checked={item.active}
                                                        onChange={() => handleActiveToggle(index)}
                                                        disabled={isSubmitting}
                                                        color="primary"
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>
                    ) : (
                        <NoData
                            title="No Task Groups Found"
                            message="Get started by adding task types in the Admin Manager to create your first task group."
                            icon={<EventBusyOutlinedIcon/>}
                            showAction={true}
                            actionText="Open Admin Manager"
                            onAction={onOpenAdminManager}
                        />
                    )}
                </DialogContent>

                <DialogFooter
                    onCancel={onClose}
                    onConfirm={handleSave}
                    confirmLabel={isSubmitting ? 'Saving...' : 'Save Changes'}
                    confirmIcon={<SaveIcon />}
                    confirmDisabled={!hasEvents}
                    submitting={isSubmitting}
                />
            </DialogShell>
        </LocalizationProvider>
    );
};

export default EventGroupDialog;
