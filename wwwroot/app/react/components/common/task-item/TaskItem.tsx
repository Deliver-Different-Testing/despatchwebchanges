/**
 * React Task Item Component
 *
 * A modern replacement for the AngularJS task-item-component using MUI components.
 * Displays a task with its metadata and provides actions for completion, reassignment,
 * and date/time editing.
 */

import React, {useCallback, useMemo, useState} from 'react';
import type {Theme} from '@mui/material/styles';
import {alpha} from '@mui/material/styles';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Popover from '@mui/material/Popover';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';
import PersonIcon from '@mui/icons-material/Person';
import CalendarIcon from '@mui/icons-material/CalendarToday';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SearchIcon from '@mui/icons-material/Search';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import {DateCalendar} from '@mui/x-date-pickers/DateCalendar';
import {TimeClock} from '@mui/x-date-pickers/TimeClock';
import dayjs, {Dayjs} from 'dayjs';
import {Task, TaskItemConfig, TaskItemProps} from './TaskItem.interfaces';
import {getIanaTimezone, getTenantTimezone, getTimezoneAbbreviation} from '../../../utils/dateUtils';

const defaultConfig: TaskItemConfig = {
    showJobId: true,
    showAssignee: true,
    showCourier: true,
    showJobType: true,
    showDateTime: true,
    showStatusIndicators: true,
    allowCompletion: true,
    showOverdueWarning: true,
    onTaskClick: true,
};

type PopoverType = 'date' | 'time' | 'assignee' | null;

const getStatusChip = (task: Task, isOverdue: boolean): {label: string; color: 'success' | 'error' | 'info'} => {
    if (task.closed) return {label: 'Done', color: 'success'};
    if (isOverdue) return {label: 'Overdue', color: 'error'};
    return {label: 'To do', color: 'info'};
};

const getStatusBorderColor = (theme: Theme, task: Task, isOverdue: boolean): string => {
    if (task.closed) return theme.palette.success.main;
    if (isOverdue) return theme.palette.error.main;
    return theme.palette.primary.main;
};

// Compute timezone abbreviation once at module level (it doesn't change per-render)
const ianaTimeZone = getIanaTimezone(getTenantTimezone());
const timeZoneShort = getTimezoneAbbreviation(ianaTimeZone);

export const TaskItem = React.memo(function TaskItem(props: TaskItemProps) {
    const {
        task,
        config: configOverrides,
        onTaskUpdated,
        onTaskClick,
        tasksService,
        dispatchService,
        showSuccessToast,
        showErrorToast,
    } = props;

    const config = useMemo(() => ({...defaultConfig, ...configOverrides}), [configOverrides]);

    // State
    const [popoverType, setPopoverType] = useState<PopoverType>(null);
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [selectedDate, setSelectedDate] = useState<Dayjs>(task.dueDate);
    const [staffList, setStaffList] = useState<Array<{id: number; text: string}>>([]);
    const [staffSearchText, setStaffSearchText] = useState('');
    const [loadingStaff, setLoadingStaff] = useState(false);
    const [isCompleting, setIsCompleting] = useState(false);

    // Derived state
    const isOverdue = useMemo(() => {
        if (task.closed) return false;
        return task.dueDate.isBefore(dayjs());
    }, [task.closed, task.dueDate]);

    const filteredStaff = useMemo(() => {
        if (!staffSearchText) return staffList;
        const searchLower = staffSearchText.toLowerCase();
        return staffList.filter(s => s.text.toLowerCase().includes(searchLower));
    }, [staffList, staffSearchText]);

    const statusChip = useMemo(() => getStatusChip(task, isOverdue), [task, isOverdue]);

    // Handlers
    const closePopover = useCallback(() => {
        setAnchorEl(null);
        setPopoverType(null);
    }, []);

    const handleTaskClick = useCallback((event: React.MouseEvent) => {
        if (config.onTaskClick && onTaskClick) {
            event.stopPropagation();
            onTaskClick(task);
        }
    }, [config.onTaskClick, onTaskClick, task]);

    const handleCheckboxChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        event.stopPropagation();
        const newClosedState = event.target.checked;
        setIsCompleting(true);

        try {
            await tasksService.markTaskAsClosed(task.id, newClosedState);
            showSuccessToast?.('Task completed successfully');
            onTaskUpdated?.();
        } catch (error) {
            showErrorToast?.('Error updating task');
            console.error('Error updating task:', error);
        } finally {
            setIsCompleting(false);
        }
    }, [task.id, tasksService, showSuccessToast, showErrorToast, onTaskUpdated]);

    const openDatePopover = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        setAnchorEl(event.currentTarget);
        setSelectedDate(task.dueDate);
        setPopoverType('date');
    }, [task.dueDate]);

    const openTimePopover = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        setAnchorEl(event.currentTarget);
        setSelectedDate(task.dueDate);
        setPopoverType('time');
    }, [task.dueDate]);

    const openAssigneePopover = useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        setAnchorEl(event.currentTarget);
        setPopoverType('assignee');
        setLoadingStaff(true);
        setStaffSearchText('');

        try {
            const staff = await dispatchService.getActiveStaff();
            setStaffList(staff || []);
        } catch (error) {
            console.error('Error loading staff:', error);
            showErrorToast?.('Error loading staff list');
        } finally {
            setLoadingStaff(false);
        }
    }, [dispatchService, showErrorToast]);

    const handleDateSelect = useCallback(async (newDate: Dayjs | null) => {
        if (!newDate) return;

        try {
            await tasksService.updateTaskDate(task.id, newDate);
            showSuccessToast?.('Task date updated successfully');
            onTaskUpdated?.();
            closePopover();
        } catch (error) {
            showErrorToast?.('Error updating task date');
            console.error('Error updating task date:', error);
        }
    }, [task.id, tasksService, showSuccessToast, showErrorToast, onTaskUpdated, closePopover]);

    const handleTimeSelect = useCallback(async (newTime: Dayjs | null) => {
        if (!newTime) return;

        try {
            await tasksService.updateTaskTime(task.id, newTime);
            showSuccessToast?.('Task time updated successfully');
            onTaskUpdated?.();
            closePopover();
        } catch (error) {
            showErrorToast?.('Error updating task time');
            console.error('Error updating task time:', error);
        }
    }, [task.id, tasksService, showSuccessToast, showErrorToast, onTaskUpdated, closePopover]);

    const handleAssigneeSelect = useCallback(async (staffId: number) => {
        try {
            await tasksService.reassignTaskToStaff(task.id, staffId);
            showSuccessToast?.('Task reassigned successfully');
            onTaskUpdated?.();
            closePopover();
        } catch (error) {
            showErrorToast?.('Error reassigning task');
            console.error('Error reassigning task:', error);
        }
    }, [task.id, tasksService, showSuccessToast, showErrorToast, onTaskUpdated, closePopover]);

    const handleStaffSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setStaffSearchText(event.target.value);
    }, []);

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Box
                onClick={handleTaskClick}
                sx={(theme) => ({
                    display: 'flex',
                    alignItems: 'flex-start',
                    py: 1.5,
                    px: 2,
                    minHeight: 64,
                    borderRadius: 1.5,
                    mb: 0.25,
                    bgcolor: task.closed ? 'grey.50' : 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    borderLeft: `4px solid ${getStatusBorderColor(theme, task, isOverdue)}`,
                    boxShadow: 1,
                    transition: `all ${theme.transitions.duration.short}ms ease`,
                    cursor: config.onTaskClick ? 'pointer' : 'default',
                    color: task.closed ? 'text.disabled' : 'text.primary',
                    '&:hover': config.onTaskClick ? {
                        transform: 'translateY(-1px)',
                        bgcolor: 'grey.50',
                        borderColor: 'grey.300',
                        borderLeftColor: getStatusBorderColor(theme, task, isOverdue),
                        boxShadow: 3,
                        '& .task-title': {
                            color: 'primary.main',
                        },
                    } : {},
                })}
            >

                {/* Checkbox */}
                {config.allowCompletion !== false && (
                    <Checkbox
                        checked={task.closed}
                        onChange={handleCheckboxChange}
                        onClick={(e) => e.stopPropagation()}
                        disabled={isCompleting}
                        sx={{
                            marginRight: 1.5,
                            marginTop: -0.5,
                            padding: 0.5,
                        }}
                    />
                )}

                {/* Task Content */}
                <Box sx={{flex: 1, minWidth: 0, mb: 1.25}}>
                    {/* Title with Status Chips */}
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 1,
                            mb: 0.5,
                        }}
                    >
                        <Typography
                            className="task-title"
                            variant="subtitle2"
                            sx={{
                                fontWeight: 600,
                                color: 'text.primary',
                                textDecoration: task.closed ? 'line-through' : 'none',
                                transition: (theme) => `color ${theme.transitions.duration.short}ms ease`,
                            }}
                        >
                            {task.title}
                        </Typography>

                        {config.showStatusIndicators !== false && (
                            <Chip
                                label={statusChip.label}
                                color={statusChip.color}
                                size="small"
                                sx={{
                                    height: 20,
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                }}
                            />
                        )}
                    </Box>

                    {/* Description */}
                    {config.showDescription !== false && task.description && (
                        <Typography
                            variant="caption"
                            sx={{
                                display: '-webkit-box',
                                color: task.closed ? 'text.disabled' : 'text.secondary',
                                mb: 1,
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                            }}
                        >
                            {task.description}
                        </Typography>
                    )}

                    {/* Metadata */}
                    <Box
                        sx={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: 1,
                            mt: 0.5,
                        }}
                    >
                        {/* Assignee Button */}
                        {config.showAssignee !== false && (
                            <Button
                                size="small"
                                onClick={openAssigneePopover}
                                startIcon={<PersonIcon sx={{fontSize: 14}} />}
                                sx={{
                                    height: 24,
                                    py: 0.25,
                                    px: 1.25,
                                    borderRadius: 9999,
                                    bgcolor: 'grey.100',
                                    border: 1,
                                    borderColor: 'divider',
                                    color: 'text.primary',
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    textTransform: 'none',
                                    '&:hover': {
                                        bgcolor: 'grey.200',
                                        borderColor: 'grey.300',
                                    },
                                    '& .MuiButton-startIcon': {
                                        mr: 0.5,
                                    },
                                }}
                            >
                                {task.assignee?.text || 'Unassigned'}
                            </Button>
                        )}

                        {/* Job ID Chip */}
                        {config.showJobId !== false && (
                            <Chip
                                label={`Job #${task.jobNumber}`}
                                size="small"
                                sx={(theme) => ({
                                    height: 24,
                                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                                    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                                    color: 'primary.dark',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                })}
                            />
                        )}

                        {/* Courier */}
                        {config.showCourier !== false && task.courierCode && (
                            <Chip
                                icon={<LocalShippingIcon sx={{fontSize: 14}} />}
                                label={`#${task.courierCode}`}
                                title={task.courierName}
                                size="small"
                                sx={(theme) => ({
                                    height: 24,
                                    bgcolor: alpha(theme.palette.warning.main, 0.1),
                                    border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
                                    color: 'warning.dark',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    '& .MuiChip-icon': {
                                        color: 'warning.main',
                                    },
                                })}
                            />
                        )}

                        {/* Job Type */}
                        {config.showJobType !== false && task.eventType && (
                            <Chip
                                label={task.eventType.charAt(0).toUpperCase() + task.eventType.slice(1)}
                                size="small"
                                sx={{
                                    height: 24,
                                    bgcolor: 'grey.100',
                                    border: 1,
                                    borderColor: 'divider',
                                    color: 'text.secondary',
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                }}
                            />
                        )}
                    </Box>
                </Box>

                {/* Date/Time Section */}
                {config.showDateTime !== false && (
                    <Box
                        sx={{
                            minWidth: 130,
                            maxWidth: 160,
                            pl: 1.5,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 0.5,
                            flexShrink: 0,
                        }}
                    >
                        {/* Date Button */}
                        <Button
                            size="small"
                            onClick={openDatePopover}
                            startIcon={<CalendarIcon sx={{fontSize: 14}} />}
                            sx={(theme) => ({
                                width: '100%',
                                height: 28,
                                justifyContent: 'flex-start',
                                px: 1,
                                py: 0,
                                borderRadius: 1,
                                bgcolor: isOverdue ? alpha(theme.palette.error.main, 0.08) : 'grey.100',
                                border: 1,
                                borderColor: isOverdue ? alpha(theme.palette.error.main, 0.2) : 'divider',
                                color: isOverdue ? 'error.dark' : 'text.primary',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                textTransform: 'none',
                                '&:hover': {
                                    bgcolor: isOverdue ? alpha(theme.palette.error.main, 0.12) : 'grey.200',
                                    borderColor: isOverdue ? alpha(theme.palette.error.main, 0.3) : 'grey.300',
                                },
                                '& .MuiButton-startIcon': {
                                    mr: 1,
                                    color: isOverdue ? 'error.main' : 'text.secondary',
                                },
                            })}
                        >
                            {task._dueDateString} {timeZoneShort}
                        </Button>

                        {/* Time Button */}
                        <Button
                            size="small"
                            onClick={openTimePopover}
                            startIcon={<ScheduleIcon sx={{fontSize: 14}} />}
                            sx={(theme) => ({
                                width: '100%',
                                height: 28,
                                justifyContent: 'flex-start',
                                px: 1,
                                py: 0,
                                borderRadius: 1,
                                bgcolor: isOverdue ? alpha(theme.palette.error.main, 0.08) : 'grey.100',
                                border: 1,
                                borderColor: isOverdue ? alpha(theme.palette.error.main, 0.2) : 'divider',
                                color: isOverdue ? 'error.dark' : 'text.primary',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                textTransform: 'none',
                                '&:hover': {
                                    bgcolor: isOverdue ? alpha(theme.palette.error.main, 0.12) : 'grey.200',
                                    borderColor: isOverdue ? alpha(theme.palette.error.main, 0.3) : 'grey.300',
                                },
                                '& .MuiButton-startIcon': {
                                    mr: 1,
                                    color: isOverdue ? 'error.main' : 'text.secondary',
                                },
                            })}
                        >
                            {task._dueTimeString} {timeZoneShort}
                        </Button>
                    </Box>
                )}
            </Box>

            {/* Date Popover */}
            <Popover
                open={popoverType === 'date'}
                anchorEl={anchorEl}
                onClose={closePopover}
                anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
                transformOrigin={{vertical: 'top', horizontal: 'left'}}
            >
                <DateCalendar
                    value={selectedDate}
                    onChange={handleDateSelect}
                />
            </Popover>

            {/* Time Popover */}
            <Popover
                open={popoverType === 'time'}
                anchorEl={anchorEl}
                onClose={closePopover}
                anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
                transformOrigin={{vertical: 'top', horizontal: 'left'}}
            >
                <Box sx={{p: 2}}>
                    <TimeClock
                        value={selectedDate}
                        onChange={handleTimeSelect}
                    />
                </Box>
            </Popover>

            {/* Assignee Popover */}
            <Popover
                open={popoverType === 'assignee'}
                anchorEl={anchorEl}
                onClose={closePopover}
                anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
                transformOrigin={{vertical: 'top', horizontal: 'left'}}
            >
                <Box sx={{width: 280, maxHeight: 400}}>
                    <Box sx={{p: 1.5, borderBottom: 1, borderColor: 'divider'}}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="Search staff..."
                            value={staffSearchText}
                            onChange={handleStaffSearchChange}
                            slotProps={{
                                input: {
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon sx={{fontSize: 18, color: 'text.secondary'}} />
                                        </InputAdornment>
                                    ),
                                },
                            }}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    fontSize: '0.8125rem',
                                },
                            }}
                        />
                    </Box>
                    {loadingStaff ? (
                        <Box sx={{display: 'flex', justifyContent: 'center', p: 3}}>
                            <CircularProgress size={24} />
                        </Box>
                    ) : (
                        <List sx={{maxHeight: 300, overflow: 'auto', py: 0.5}}>
                            {filteredStaff.map((staff) => (
                                <ListItemButton
                                    key={staff.id}
                                    selected={staff.id === task.assignee?.id}
                                    onClick={() => handleAssigneeSelect(staff.id)}
                                    sx={{py: 1, px: 2}}
                                >
                                    <ListItemText
                                        primary={staff.text}
                                        slotProps={{primary: {fontSize: '0.8125rem'}}}
                                    />
                                </ListItemButton>
                            ))}
                            {filteredStaff.length === 0 && !loadingStaff && (
                                <Box sx={{p: 2, textAlign: 'center', color: 'text.secondary'}}>
                                    <Typography variant="body2">No staff found</Typography>
                                </Box>
                            )}
                        </List>
                    )}
                </Box>
            </Popover>
        </LocalizationProvider>
    );
});

export default TaskItem;
