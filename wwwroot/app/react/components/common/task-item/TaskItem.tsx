/**
 * React Task Item Component
 *
 * A modern replacement for the AngularJS task-item-component using MUI components.
 * Displays a task with its metadata and provides actions for completion, reassignment,
 * and date/time editing.
 */

import React from 'react';
import {
    Box,
    Checkbox,
    Typography,
    Button,
    Chip,
    alpha,
    Popover,
    List,
    ListItemButton,
    ListItemText,
    TextField,
    InputAdornment,
    CircularProgress,
} from '@mui/material';
import {
    Person as PersonIcon,
    CalendarToday as CalendarIcon,
    Schedule as ScheduleIcon,
    Search as SearchIcon,
} from '@mui/icons-material';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import {DateCalendar} from '@mui/x-date-pickers/DateCalendar';
import {TimeClock} from '@mui/x-date-pickers/TimeClock';
import dayjs, {Dayjs} from 'dayjs';
import {TaskItemProps, TaskItemConfig} from './TaskItem.interfaces';
import {getIanaTimezone} from '../../../../functions/formatDates';
import {TimeZone} from '../../../../contants';
import {timezoneShortFilter} from '../../../../filters';

const defaultConfig: TaskItemConfig = {
    showJobId: true,
    showAssignee: true,
    showJobType: true,
    showDateTime: true,
    showStatusIndicators: true,
    allowCompletion: true,
    showOverdueWarning: true,
    onTaskClick: true,
};

type PopoverType = 'date' | 'time' | 'assignee' | null;

interface TaskItemState {
    popoverType: PopoverType;
    anchorEl: HTMLElement | null;
    selectedDate: Dayjs;
    staffList: Array<{id: number; text: string}>;
    staffSearchText: string;
    loadingStaff: boolean;
    isCompleting: boolean;
}

export class TaskItem extends React.Component<TaskItemProps, TaskItemState> {
    private readonly timeZoneShort: string;

    constructor(props: TaskItemProps) {
        super(props);
        this.state = {
            popoverType: null,
            anchorEl: null,
            selectedDate: props.task.dueDate,
            staffList: [],
            staffSearchText: '',
            loadingStaff: false,
            isCompleting: false,
        };

        const ianaTimeZone = getIanaTimezone(TimeZone);
        this.timeZoneShort = timezoneShortFilter(ianaTimeZone);
    }

    private get config(): TaskItemConfig {
        return {...defaultConfig, ...this.props.config};
    }

    private get isOverdue(): boolean {
        const {task} = this.props;
        if (task.closed) return false;
        return task.dueDate.isBefore(dayjs());
    }

    private get filteredStaff(): Array<{id: number; text: string}> {
        const {staffList, staffSearchText} = this.state;
        if (!staffSearchText) return staffList;
        const searchLower = staffSearchText.toLowerCase();
        return staffList.filter(s => s.text.toLowerCase().includes(searchLower));
    }

    private getStatusChip = (): {label: string; color: 'success' | 'error' | 'info'} => {
        const {task} = this.props;
        if (task.closed) {
            return {label: 'Done', color: 'success'};
        }
        if (this.isOverdue) {
            return {label: 'Overdue', color: 'error'};
        }
        return {label: 'To do', color: 'info'};
    };

    private getPriorityColor = (priority?: string): string => {
        switch (priority) {
            case 'high':
                return '#e53935';
            case 'medium':
                return '#fb8500';
            case 'low':
                return '#64748b';
            default:
                return 'transparent';
        }
    };

    private handleTaskClick = (event: React.MouseEvent): void => {
        const {onTaskClick, task} = this.props;
        if (this.config.onTaskClick && onTaskClick) {
            event.stopPropagation();
            onTaskClick(task);
        }
    };

    private handleCheckboxChange = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
        event.stopPropagation();
        const {task, tasksService, showSuccessToast, showErrorToast, onTaskUpdated} = this.props;
        const newClosedState = event.target.checked;
        this.setState({isCompleting: true});

        try {
            await tasksService.markTaskAsClosed(task.id, newClosedState);
            showSuccessToast?.('Task completed successfully');
            onTaskUpdated?.();
        } catch (error) {
            showErrorToast?.('Error updating task');
            console.error('Error updating task:', error);
        } finally {
            this.setState({isCompleting: false});
        }
    };

    private openDatePopover = (event: React.MouseEvent<HTMLButtonElement>): void => {
        event.stopPropagation();
        this.setState({
            anchorEl: event.currentTarget,
            selectedDate: this.props.task.dueDate,
            popoverType: 'date',
        });
    };

    private openTimePopover = (event: React.MouseEvent<HTMLButtonElement>): void => {
        event.stopPropagation();
        this.setState({
            anchorEl: event.currentTarget,
            selectedDate: this.props.task.dueDate,
            popoverType: 'time',
        });
    };

    private openAssigneePopover = async (event: React.MouseEvent<HTMLButtonElement>): Promise<void> => {
        event.stopPropagation();
        const {dispatchService, showErrorToast} = this.props;

        this.setState({
            anchorEl: event.currentTarget,
            popoverType: 'assignee',
            loadingStaff: true,
            staffSearchText: '',
        });

        try {
            const staff = await dispatchService.getActiveStaff();
            this.setState({staffList: staff || []});
        } catch (error) {
            console.error('Error loading staff:', error);
            showErrorToast?.('Error loading staff list');
        } finally {
            this.setState({loadingStaff: false});
        }
    };

    private closePopover = (): void => {
        this.setState({anchorEl: null, popoverType: null});
    };

    private handleDateSelect = async (newDate: Dayjs | null): Promise<void> => {
        if (!newDate) return;

        const {task, tasksService, showSuccessToast, showErrorToast, onTaskUpdated} = this.props;

        try {
            await tasksService.updateTaskDate(task.id, newDate);
            showSuccessToast?.('Task date updated successfully');
            onTaskUpdated?.();
            this.closePopover();
        } catch (error) {
            showErrorToast?.('Error updating task date');
            console.error('Error updating task date:', error);
        }
    };

    private handleTimeSelect = async (newTime: Dayjs | null): Promise<void> => {
        if (!newTime) return;

        const {task, tasksService, showSuccessToast, showErrorToast, onTaskUpdated} = this.props;

        try {
            await tasksService.updateTaskTime(task.id, newTime);
            showSuccessToast?.('Task time updated successfully');
            onTaskUpdated?.();
            this.closePopover();
        } catch (error) {
            showErrorToast?.('Error updating task time');
            console.error('Error updating task time:', error);
        }
    };

    private handleAssigneeSelect = async (staffId: number): Promise<void> => {
        const {task, tasksService, showSuccessToast, showErrorToast, onTaskUpdated} = this.props;

        try {
            await tasksService.reassignTaskToStaff(task.id, staffId);
            showSuccessToast?.('Task reassigned successfully');
            onTaskUpdated?.();
            this.closePopover();
        } catch (error) {
            showErrorToast?.('Error reassigning task');
            console.error('Error reassigning task:', error);
        }
    };

    private handleStaffSearchChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({staffSearchText: event.target.value});
    };

    render(): React.ReactNode {
        const {task} = this.props;
        const {popoverType, anchorEl, selectedDate, loadingStaff, isCompleting, staffSearchText} = this.state;
        const config = this.config;
        const isOverdue = this.isOverdue;
        const filteredStaff = this.filteredStaff;
        const statusChip = this.getStatusChip();

        return (
            <LocalizationProvider dateAdapter={AdapterDayjs}>
                <Box
                onClick={this.handleTaskClick}
                sx={(theme) => ({
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'flex-start',
                    padding: '12px 16px',
                    minHeight: 64,
                    borderRadius: '6px',
                    margin: '0 0 1px 0',
                    backgroundColor: task.closed ? '#f8fafc' : '#ffffff',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                    transition: 'all 150ms ease',
                    cursor: config.onTaskClick ? 'pointer' : 'default',
                    '&:hover': config.onTaskClick ? {
                        backgroundColor: '#f8fafc',
                        borderColor: '#cbd5e1',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
                        '& .task-title': {
                            color: theme.palette.primary.main,
                        },
                    } : {},
                })}
            >
                {/* Priority Indicator */}
                <Box
                    sx={{
                        position: 'absolute',
                        left: 0,
                        top: 12,
                        bottom: 12,
                        width: 3,
                        borderRadius: '0 2px 2px 0',
                        backgroundColor: this.getPriorityColor(task.priority),
                        opacity: task.closed ? 0.4 : 1,
                    }}
                />

                {/* Checkbox */}
                {config.allowCompletion !== false && (
                    <Checkbox
                        checked={task.closed}
                        onChange={this.handleCheckboxChange}
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
                <Box sx={{flex: 1, minWidth: 0, marginBottom: '10px'}}>
                    {/* Title with Status Chips */}
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 1,
                            marginBottom: 0.5,
                        }}
                    >
                        <Typography
                            className="task-title"
                            variant="subtitle1"
                            sx={{
                                fontWeight: 600,
                                fontSize: '14px',
                                lineHeight: 1.3,
                                color: '#1e293b',
                                textDecoration: task.closed ? 'line-through' : 'none',
                                transition: 'color 150ms ease',
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
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.03em',
                                }}
                            />
                        )}
                    </Box>

                    {/* Description */}
                    {config.showDescription !== false && task.description && (
                        <Typography
                            variant="body2"
                            sx={{
                                fontSize: '12px',
                                lineHeight: 1.4,
                                color: task.closed ? '#cbd5e1' : '#64748b',
                                marginBottom: 1,
                                display: '-webkit-box',
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
                            marginTop: 0.5,
                        }}
                    >
                        {/* Assignee Button */}
                        {config.showAssignee !== false && (
                            <Button
                                size="small"
                                onClick={this.openAssigneePopover}
                                startIcon={<PersonIcon sx={{fontSize: 14}} />}
                                sx={{
                                    height: 28,
                                    padding: '4px 12px',
                                    borderRadius: '9999px',
                                    backgroundColor: '#f1f5f9',
                                    border: '1px solid #e2e8f0',
                                    color: '#1e293b',
                                    fontSize: '11px',
                                    fontWeight: 500,
                                    textTransform: 'none',
                                    '&:hover': {
                                        backgroundColor: '#e2e8f0',
                                        borderColor: '#cbd5e1',
                                    },
                                    '& .MuiButton-startIcon': {
                                        marginRight: 0.5,
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
                                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                                    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                                    color: theme.palette.primary.dark,
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    fontFamily: '"SF Mono", "Monaco", "Inconsolata", "Roboto Mono", monospace',
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
                                    backgroundColor: '#f1f5f9',
                                    border: '1px solid #e2e8f0',
                                    color: '#64748b',
                                    fontSize: '11px',
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
                            paddingLeft: 1.5,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 0.5,
                            flexShrink: 0,
                        }}
                    >
                        {/* Date Button */}
                        <Button
                            size="small"
                            onClick={this.openDatePopover}
                            startIcon={<CalendarIcon sx={{fontSize: 14}} />}
                            sx={{
                                width: '100%',
                                height: 28,
                                justifyContent: 'flex-start',
                                padding: '0 8px',
                                borderRadius: '4px',
                                backgroundColor: isOverdue ? 'rgba(229, 57, 53, 0.08)' : '#f1f5f9',
                                border: `1px solid ${isOverdue ? 'rgba(229, 57, 53, 0.2)' : '#e2e8f0'}`,
                                color: isOverdue ? '#c62828' : '#1e293b',
                                fontSize: '11px',
                                fontWeight: 500,
                                textTransform: 'none',
                                '&:hover': {
                                    backgroundColor: isOverdue ? 'rgba(229, 57, 53, 0.12)' : '#e2e8f0',
                                    borderColor: isOverdue ? 'rgba(229, 57, 53, 0.3)' : '#cbd5e1',
                                },
                                '& .MuiButton-startIcon': {
                                    marginRight: 1,
                                    color: isOverdue ? '#e53935' : '#64748b',
                                },
                            }}
                        >
                            {task._dueDateString} {this.timeZoneShort}
                        </Button>

                        {/* Time Button */}
                        <Button
                            size="small"
                            onClick={this.openTimePopover}
                            startIcon={<ScheduleIcon sx={{fontSize: 14}} />}
                            sx={{
                                width: '100%',
                                height: 28,
                                justifyContent: 'flex-start',
                                padding: '0 8px',
                                borderRadius: '4px',
                                backgroundColor: isOverdue ? 'rgba(229, 57, 53, 0.08)' : '#f1f5f9',
                                border: `1px solid ${isOverdue ? 'rgba(229, 57, 53, 0.2)' : '#e2e8f0'}`,
                                color: isOverdue ? '#c62828' : '#1e293b',
                                fontSize: '11px',
                                fontWeight: 500,
                                textTransform: 'none',
                                '&:hover': {
                                    backgroundColor: isOverdue ? 'rgba(229, 57, 53, 0.12)' : '#e2e8f0',
                                    borderColor: isOverdue ? 'rgba(229, 57, 53, 0.3)' : '#cbd5e1',
                                },
                                '& .MuiButton-startIcon': {
                                    marginRight: 1,
                                    color: isOverdue ? '#e53935' : '#64748b',
                                },
                            }}
                        >
                            {task._dueTimeString} {this.timeZoneShort}
                        </Button>
                    </Box>
                )}
            </Box>

            {/* Date Popover */}
            <Popover
                open={popoverType === 'date'}
                anchorEl={anchorEl}
                onClose={this.closePopover}
                anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
                transformOrigin={{vertical: 'top', horizontal: 'left'}}
            >
                <DateCalendar
                    value={selectedDate}
                    onChange={this.handleDateSelect}
                />
            </Popover>

            {/* Time Popover */}
            <Popover
                open={popoverType === 'time'}
                anchorEl={anchorEl}
                onClose={this.closePopover}
                anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
                transformOrigin={{vertical: 'top', horizontal: 'left'}}
            >
                <Box sx={{p: 2}}>
                    <TimeClock
                        value={selectedDate}
                        onChange={this.handleTimeSelect}
                    />
                </Box>
            </Popover>

            {/* Assignee Popover */}
            <Popover
                open={popoverType === 'assignee'}
                anchorEl={anchorEl}
                onClose={this.closePopover}
                anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
                transformOrigin={{vertical: 'top', horizontal: 'left'}}
            >
                <Box sx={{width: 280, maxHeight: 400}}>
                    <Box sx={{p: 1.5, borderBottom: '1px solid #e2e8f0'}}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="Search staff..."
                            value={staffSearchText}
                            onChange={this.handleStaffSearchChange}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={{fontSize: 18, color: '#64748b'}} />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    fontSize: '13px',
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
                                    onClick={() => this.handleAssigneeSelect(staff.id)}
                                    sx={{py: 1, px: 2}}
                                >
                                    <ListItemText
                                        primary={staff.text}
                                        primaryTypographyProps={{fontSize: '13px'}}
                                    />
                                </ListItemButton>
                            ))}
                            {filteredStaff.length === 0 && !loadingStaff && (
                                <Box sx={{p: 2, textAlign: 'center', color: '#64748b'}}>
                                    <Typography variant="body2">No staff found</Typography>
                                </Box>
                            )}
                        </List>
                    )}
                </Box>
            </Popover>
        </LocalizationProvider>
        );
    }
}

export default TaskItem;
