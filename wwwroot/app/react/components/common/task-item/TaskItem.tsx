/**
 * React Task Item Component
 *
 * A Material Design 3 list-item for a dispatch task, built from MUI primitives.
 * Anatomy: leading completion control, headline (priority + title + status),
 * supporting description text, metadata chips, and trailing date/time supporting text.
 */

import React, {useState, useMemo, useCallback} from 'react';
import {alpha} from '@mui/material/styles';
import type {SxProps, Theme} from '@mui/material/styles';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
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
import BusinessIcon from '@mui/icons-material/Business';
import FlagIcon from '@mui/icons-material/Flag';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import {DateCalendar} from '@mui/x-date-pickers/DateCalendar';
import {TimeClock} from '@mui/x-date-pickers/TimeClock';
import dayjs, {Dayjs} from 'dayjs';
import {TaskItemProps, TaskItemConfig, Task} from './TaskItem.interfaces';
import {getIanaTimezone, getTenantTimezone, getTimezoneAbbreviation} from '../../../utils/dateUtils';
import {monoFontFamily} from '../../../theme/muiTheme';

// MD3 emphasized easing for the row's state-layer / border transition.
const MD3_EMPHASIZED = 'cubic-bezier(0.2, 0, 0, 1)';

const defaultConfig: TaskItemConfig = {
    showJobId: true,
    showAssignee: true,
    showJobType: true,
    showCourierCode: true,
    showClientCode: true,
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

const priorityColor: Record<NonNullable<Task['priority']>, string> = {
    high: 'error.main',
    medium: 'warning.main',
    low: 'info.main',
};

/** First letters of up to two name words, e.g. "John Doe" -> "JD". */
const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

/** Deterministic, readable avatar background derived from the assignee name. */
const getAvatarColor = (name: string): string => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return `hsl(${Math.abs(hash) % 360}, 42%, 42%)`;
};

// Shared metadata-chip styling on an MD3 tonal surface-container tier
// (matches the app's chip convention).
const metadataChipSx = {
    bgcolor: 'background.surfaceContainerHigh',
    border: 1,
    borderColor: 'divider',
    color: 'text.secondary',
    fontWeight: 500,
    '& .MuiChip-icon': {color: 'text.secondary'},
} satisfies SxProps<Theme>;

// Compute timezone abbreviation once at module level (it doesn't change per-render)
const ianaTimeZone = getIanaTimezone(getTenantTimezone());
const timeZoneShort = getTimezoneAbbreviation(ianaTimeZone);

export const TaskItem = React.memo(function TaskItem(props: TaskItemProps) {
    const {
        task,
        config: configOverrides,
        onTaskUpdated,
        onTaskClick,
        currentUserId,
        tasksService,
        dispatchService,
        showSuccessToast,
        showErrorToast,
    } = props;

    const config = useMemo(() => ({...defaultConfig, ...configOverrides}), [configOverrides]);
    const compact = config.compactView === true;

    // State
    const [popoverType, setPopoverType] = useState<PopoverType>(null);
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [selectedDate, setSelectedDate] = useState<Dayjs>(task.dueDate);
    const [staffList, setStaffList] = useState<Array<{id: number; text: string}>>([]);
    const [staffSearchText, setStaffSearchText] = useState('');
    const [loadingStaff, setLoadingStaff] = useState(false);
    const [isCompleting, setIsCompleting] = useState(false);
    const [isUnassigning, setIsUnassigning] = useState(false);

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
    const assigneeName = task.assignee?.text || '';
    const hasAssignee = Boolean(task.assignee?.id);
    const canUnassign = config.showAssignee !== false && hasAssignee;

    // A task may have no due date; guard against rendering the raw "undefined"/"Invalid Date"
    // string and drop the timezone suffix when there's no value to qualify.
    const hasValidDate = (s?: string) => Boolean(s) && s !== 'Invalid Date';
    const dateChipLabel = hasValidDate(task._dueDateString)
        ? `${task._dueDateString} ${timeZoneShort}`.trim()
        : 'Set date';
    const timeChipLabel = hasValidDate(task._dueTimeString)
        ? `${task._dueTimeString} ${timeZoneShort}`.trim()
        : 'Set time';

    // Handlers
    const closePopover = useCallback(() => {
        setAnchorEl(null);
        setPopoverType(null);
    }, []);

    const assignToCurrentUser = useCallback(async () => {
        if (!currentUserId) return;

        try {
            await tasksService.reassignTaskToStaff(task.id, currentUserId);
            showSuccessToast?.('Task assigned to you');
            onTaskUpdated?.();
        } catch (error) {
            showErrorToast?.('Error assigning task');
            console.error('Error assigning task to current user:', error);
        }
    }, [currentUserId, task.id, tasksService, showSuccessToast, showErrorToast, onTaskUpdated]);

    const handleTaskClick = useCallback((event: React.MouseEvent) => {
        if (!config.onTaskClick) return;
        event.stopPropagation();

        // Claim an unassigned, open task for the current user before selecting the job.
        if (config.autoAssignOnClick && currentUserId && currentUserId > 0 && !task.assignee?.id && !task.closed) {
            void assignToCurrentUser();
        }

        onTaskClick?.(task);
    }, [config.onTaskClick, config.autoAssignOnClick, onTaskClick, task, currentUserId, assignToCurrentUser, task.closed]);

    const handleUnassign = useCallback(async (event: React.MouseEvent) => {
        event.stopPropagation();
        setIsUnassigning(true);
        try {
            await tasksService.unassignTask(task.id);
            showSuccessToast?.('Task unassigned');
            onTaskUpdated?.();
        } catch (error) {
            showErrorToast?.('Error unassigning task');
            console.error('Error unassigning task:', error);
        } finally {
            setIsUnassigning(false);
        }
    }, [task.id, tasksService, showSuccessToast, showErrorToast, onTaskUpdated]);

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

    const openDatePopover = useCallback((event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        setAnchorEl(event.currentTarget);
        setSelectedDate(task.dueDate);
        setPopoverType('date');
    }, [task.dueDate]);

    const openTimePopover = useCallback((event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        setAnchorEl(event.currentTarget);
        setSelectedDate(task.dueDate);
        setPopoverType('time');
    }, [task.dueDate]);

    const openAssigneePopover = useCallback(async (event: React.MouseEvent<HTMLElement>) => {
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

    const unassignButton = canUnassign ? (
        <Button
            size="small"
            variant="outlined"
            color="inherit"
            onClick={handleUnassign}
            disabled={isUnassigning}
            aria-label="Unassign task"
            startIcon={isUnassigning
                ? <CircularProgress size={14} color="inherit" />
                : <PersonOffIcon fontSize="small" />}
            sx={{
                textTransform: 'none',
                color: 'text.secondary',
                borderColor: 'divider',
                ...(compact
                    ? {}
                    : {position: 'absolute', bottom: 8, right: 8}),
            }}
        >
            Unassign
        </Button>
    ) : null;

    const titleTypography = (
        <Typography
            className="task-title"
            variant="subtitle2"
            sx={{
                fontWeight: 600,
                color: task.closed ? 'text.disabled' : 'text.primary',
                textDecoration: task.closed ? 'line-through' : 'none',
                transition: (theme) => `color ${theme.transitions.duration.short}ms ease`,
            }}
        >
            {task.title}
        </Typography>
    );

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Box
                onClick={handleTaskClick}
                sx={(theme) => ({
                    position: 'relative',
                    display: 'flex',
                    alignItems: compact ? 'center' : 'flex-start',
                    py: compact ? 1 : 1.5,
                    px: 2,
                    minHeight: compact ? 44 : 64,
                    borderRadius: 1.5,
                    mb: 0.25,
                    bgcolor: task.closed ? 'grey.50' : 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    borderLeft: `4px solid ${getStatusBorderColor(theme, task, isOverdue)}`,
                    transition: `background-color ${theme.transitions.duration.short}ms ${MD3_EMPHASIZED}, border-color ${theme.transitions.duration.short}ms ${MD3_EMPHASIZED}`,
                    '@media (prefers-reduced-motion: reduce)': {transition: 'none'},
                    cursor: config.onTaskClick ? 'pointer' : 'default',
                    color: task.closed ? 'text.disabled' : 'text.primary',
                    // MD3 list rows are flat on the surface: no per-row shadow or
                    // lift — hover is a primary state-layer overlay instead.
                    '&:hover': config.onTaskClick ? {
                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                        borderColor: alpha(theme.palette.primary.main, 0.24),
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
                        slotProps={{input: {'aria-label': `Mark "${task.title}" complete`}}}
                        sx={{
                            marginRight: 1.5,
                            marginTop: compact ? 0 : -0.5,
                            padding: 0.5,
                        }}
                    />
                )}

                {/* Task Content */}
                <Box sx={{flex: 1, minWidth: 0, mb: compact ? 0 : 1.25}}>
                    {/* Headline: priority + title + status */}
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 1,
                            mb: compact ? 0 : 0.5,
                        }}
                    >
                        {task.priority && (
                            <Tooltip title={`Priority: ${task.priority}`}>
                                <FlagIcon
                                    titleAccess={`Priority: ${task.priority}`}
                                    sx={{fontSize: 16, color: priorityColor[task.priority]}}
                                />
                            </Tooltip>
                        )}

                        {config.onTaskClick ? (
                            <ButtonBase
                                onClick={handleTaskClick}
                                aria-label={`Open task: ${task.title}`}
                                sx={{
                                    borderRadius: 0.5,
                                    textAlign: 'left',
                                    '&:focus-visible': {
                                        outline: '2px solid',
                                        outlineColor: 'primary.main',
                                        outlineOffset: 2,
                                    },
                                }}
                            >
                                {titleTypography}
                            </ButtonBase>
                        ) : titleTypography}

                        {config.showStatusIndicators !== false && (
                            <Chip
                                label={statusChip.label}
                                color={statusChip.color}
                                size="small"
                            />
                        )}
                    </Box>

                    {/* Supporting text */}
                    {config.showDescription !== false && !compact && task.description && (
                        <Typography
                            variant="body2"
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

                    {/* Metadata chips */}
                    <Box
                        sx={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: 1,
                            mt: compact ? 0 : 0.5,
                        }}
                    >
                        {/* Assignee */}
                        {config.showAssignee !== false && (
                            <Chip
                                size="small"
                                onClick={openAssigneePopover}
                                avatar={hasAssignee ? (
                                    <Avatar sx={{bgcolor: getAvatarColor(assigneeName), color: 'common.white'}}>
                                        {getInitials(assigneeName)}
                                    </Avatar>
                                ) : undefined}
                                icon={hasAssignee ? undefined : <PersonIcon />}
                                label={assigneeName || 'Unassigned'}
                                variant={hasAssignee ? 'filled' : 'outlined'}
                                sx={hasAssignee ? metadataChipSx : undefined}
                            />
                        )}

                        {/* Job ID */}
                        {config.showJobId !== false && (
                            <Chip
                                label={`Job #${task.jobNumber}`}
                                size="small"
                                sx={(theme) => ({
                                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                                    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                                    color: 'primary.dark',
                                    fontWeight: 600,
                                    fontFamily: monoFontFamily,
                                })}
                            />
                        )}

                        {/* Job Type */}
                        {config.showJobType !== false && task.eventType && (
                            <Chip
                                label={task.eventType.charAt(0).toUpperCase() + task.eventType.slice(1)}
                                size="small"
                                sx={metadataChipSx}
                            />
                        )}

                        {/* Courier */}
                        {config.showCourierCode !== false && task.courierCode && (
                            <Chip
                                icon={<LocalShippingIcon />}
                                label={`Courier: ${task.courierCode}${task.courierName ? ` — ${task.courierName}` : ''}`}
                                size="small"
                                sx={metadataChipSx}
                            />
                        )}

                        {/* Client */}
                        {config.showClientCode !== false && task.clientCode && (
                            <Chip
                                icon={<BusinessIcon />}
                                label={`Client: ${task.clientCode}`}
                                size="small"
                                sx={metadataChipSx}
                            />
                        )}
                    </Box>
                </Box>

                {/* Trailing supporting text: due date / time */}
                {(config.showDateTime !== false || (compact && canUnassign)) && (
                    <Box
                        sx={{
                            pl: 1.5,
                            display: 'flex',
                            flexDirection: compact ? 'row' : 'column',
                            alignItems: compact ? 'center' : 'stretch',
                            gap: 0.5,
                            flexShrink: 0,
                        }}
                    >
                        {config.showDateTime !== false && (
                            <>
                                <Chip
                                    size="small"
                                    onClick={openDatePopover}
                                    icon={<CalendarIcon />}
                                    label={dateChipLabel}
                                    color={isOverdue ? 'error' : 'default'}
                                    variant={isOverdue ? 'outlined' : 'filled'}
                                    sx={isOverdue ? undefined : metadataChipSx}
                                />
                                <Chip
                                    size="small"
                                    onClick={openTimePopover}
                                    icon={<ScheduleIcon />}
                                    label={timeChipLabel}
                                    color={isOverdue ? 'error' : 'default'}
                                    variant={isOverdue ? 'outlined' : 'filled'}
                                    sx={isOverdue ? undefined : metadataChipSx}
                                />
                            </>
                        )}
                        {/* Compact rows keep the unassign action inline; non-compact
                            anchors it to the card's bottom-right corner (below). */}
                        {compact && unassignButton}
                    </Box>
                )}

                {/* Unassign action — anchored to the card's bottom-right corner. */}
                {!compact && unassignButton}
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
                                        slotProps={{primary: {sx: {fontSize: '0.8125rem'}}}}
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
