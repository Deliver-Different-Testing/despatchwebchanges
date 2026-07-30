/**
 * React Task Calendar View Component
 *
 * A calendar component for viewing and managing tasks in month, week, and day views.
 * Uses MUI components for styling and interactions.
 */

import React, {useState, useMemo, useEffect, useCallback} from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Tooltip from '@mui/material/Tooltip';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import {alpha} from '@mui/material/styles';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TodayIcon from '@mui/icons-material/Today';
import CalendarViewMonthIcon from '@mui/icons-material/CalendarViewMonth';
import ViewWeekIcon from '@mui/icons-material/ViewWeek';
import ViewDayIcon from '@mui/icons-material/ViewDay';
import WarningIcon from '@mui/icons-material/Warning';
import dayjs, {Dayjs} from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import weekday from 'dayjs/plugin/weekday';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {
    TaskCalendarViewProps,
    ViewMode,
    CalendarDay,
    CalendarWeek,
} from './TaskCalendarView.interfaces';
import {Task} from '../task-item/TaskItem.interfaces';

dayjs.extend(isoWeek);
dayjs.extend(weekday);
dayjs.extend(utc);
dayjs.extend(timezone);

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function generateTimeSlots(): string[] {
    const slots: string[] = [];
    for (let hour = 0; hour < 24; hour++) {
        slots.push(dayjs().hour(hour).minute(0).format('HH:mm'));
    }
    return slots;
}

const TIME_SLOTS = generateTimeSlots();

function getTasksForDate(tasks: Task[] | undefined, date: Dayjs): Task[] {
    if (!tasks) return [];
    return tasks.filter(task => dayjs(task.dueDate).isSame(date, 'day'));
}

function getTasksForTimeSlot(tasks: Task[] | undefined, date: Dayjs, timeSlot: string): Task[] {
    if (!tasks || !date) return [];
    const [hours, minutes] = timeSlot.split(':').map(Number);
    const slotStart = date.hour(hours).minute(minutes);
    const slotEnd = slotStart.add(1, 'hour');
    return tasks.filter(task => {
        const taskDate = dayjs(task.dueDate);
        return (
            taskDate.isSame(date, 'day') &&
            (taskDate.isSame(slotStart) || taskDate.isAfter(slotStart)) &&
            taskDate.isBefore(slotEnd)
        );
    });
}

function isTaskOverdue(task: Task): boolean {
    if (task.closed) return false;
    return dayjs(task.dueDate).isBefore(dayjs());
}

function getTaskPriorityColor(task: Task): 'error.main' | 'warning.main' {
    if (isTaskOverdue(task)) return 'error.main';
    return 'warning.main';
}

function formatTimeSlot(time: string): string {
    const [hours] = time.split(':').map(Number);
    return dayjs().hour(hours).minute(0).format('h A');
}

function formatWeekDayHeader(date: Dayjs): string {
    const format = date.isSame(dayjs(), 'day') ? '[Today], MMM D' : 'ddd, MMM D';
    return date.format(format);
}

export const TaskCalendarView: React.FC<TaskCalendarViewProps> = ({
    tasks,
    onTaskClick,
    onTaskStatusChange,
    onViewChange,
    tasksService,
    showSuccessToast,
    showErrorToast,
}) => {
    const [currentDate, setCurrentDate] = useState<Dayjs>(dayjs());
    const [viewMode, setViewMode] = useState<ViewMode>('month');
    const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());

    // Build calendar data reactively based on state
    const calendarWeeks = useMemo((): CalendarWeek[] => {
        if (viewMode !== 'month') return [];

        const startOfMonth = currentDate.startOf('month');
        const endOfMonth = currentDate.endOf('month');
        const startDate = startOfMonth.startOf('week');
        const endDate = endOfMonth.endOf('week');

        const weeks: CalendarWeek[] = [];
        let currentWeek = startDate;

        while (currentWeek.isBefore(endDate) || currentWeek.isSame(endDate, 'day')) {
            const week: CalendarWeek = {
                weekNumber: currentWeek.isoWeek(),
                days: [],
            };

            for (let i = 0; i < 7; i++) {
                const dayDate = currentWeek.add(i, 'day');
                week.days.push({
                    date: dayDate,
                    isToday: dayDate.isSame(dayjs(), 'day'),
                    isCurrentMonth: dayDate.isSame(currentDate, 'month'),
                    dayNumber: dayDate.date(),
                    monthName: dayDate.format('MMM'),
                    tasks: getTasksForDate(tasks, dayDate),
                });
            }

            weeks.push(week);
            currentWeek = currentWeek.add(1, 'week');
        }

        return weeks;
    }, [viewMode, currentDate, tasks]);

    const weekDays = useMemo((): Dayjs[] => {
        if (viewMode !== 'week') return [];
        const startOfWeek = currentDate.startOf('week');
        const days: Dayjs[] = [];
        for (let i = 0; i < 7; i++) {
            days.push(startOfWeek.add(i, 'day'));
        }
        return days;
    }, [viewMode, currentDate]);

    const overdueTasks = useMemo((): Task[] => {
        if (!tasks) return [];
        const now = dayjs();
        return tasks.filter(task => {
            if (task.closed) return false;
            return dayjs(task.dueDate).isBefore(now);
        });
    }, [tasks]);

    // Emit view changes when viewMode or currentDate changes
    useEffect(() => {
        if (!onViewChange) return;

        let startDate: Dayjs;
        let endDate: Dayjs;

        switch (viewMode) {
            case 'month':
                startDate = currentDate.startOf('month').startOf('week');
                endDate = currentDate.endOf('month').endOf('week');
                break;
            case 'week':
                startDate = currentDate.startOf('week');
                endDate = currentDate.endOf('week');
                break;
            case 'day':
                startDate = currentDate.startOf('day');
                endDate = currentDate.endOf('day');
                break;
        }

        onViewChange(startDate.toDate(), endDate.toDate());
    }, [viewMode, currentDate, onViewChange]);

    const formatPeriodTitle = (): string => {
        switch (viewMode) {
            case 'month':
                return currentDate.format('MMMM YYYY');
            case 'week': {
                const weekStart = currentDate.startOf('week');
                const weekEnd = currentDate.endOf('week');
                if (weekStart.month() === weekEnd.month()) {
                    return `${weekStart.format('MMM D')} - ${weekEnd.format('D, YYYY')}`;
                } else if (weekStart.year() === weekEnd.year()) {
                    return `${weekStart.format('MMM D')} - ${weekEnd.format('MMM D, YYYY')}`;
                } else {
                    return `${weekStart.format('MMM D, YYYY')} - ${weekEnd.format('MMM D, YYYY')}`;
                }
            }
            case 'day':
                return currentDate.format('dddd, MMMM D, YYYY');
        }
    };

    const handlePreviousPeriod = (): void => {
        const unit = viewMode === 'month' ? 'month' : viewMode === 'week' ? 'week' : 'day';
        setCurrentDate(prev => prev.subtract(1, unit));
    };

    const handleNextPeriod = (): void => {
        const unit = viewMode === 'month' ? 'month' : viewMode === 'week' ? 'week' : 'day';
        setCurrentDate(prev => prev.add(1, unit));
    };

    const handleGoToToday = (): void => {
        setCurrentDate(dayjs());
        setSelectedDate(dayjs());
    };

    const handleSelectDate = (date: Dayjs): void => {
        setSelectedDate(date);
        if (viewMode === 'month') {
            setCurrentDate(date);
            setViewMode('day');
        }
    };

    const handleViewModeChange = (_event: React.MouseEvent<HTMLElement>, newMode: ViewMode | null): void => {
        if (newMode !== null) {
            setViewMode(newMode);
        }
    };

    const handleTaskClick = (task: Task): void => {
        onTaskClick?.(task);
    };

    const handleTaskCheckboxChange = useCallback(async (task: Task, event: React.MouseEvent): Promise<void> => {
        event.stopPropagation();

        const newClosedState = !task.closed;
        task.closed = newClosedState;

        try {
            await tasksService.markTaskAsClosed(task.id, newClosedState);
            showSuccessToast?.('Task updated successfully');
            onTaskStatusChange?.(task);
        } catch (error) {
            task.closed = !newClosedState;
            showErrorToast?.('Failed to update task');
            console.error('Error updating task:', error);
        }
    }, [tasksService, showSuccessToast, showErrorToast, onTaskStatusChange]);

    const isToday = (date: Dayjs): boolean => date.isSame(dayjs(), 'day');
    const isSelected = (date: Dayjs): boolean => date.isSame(selectedDate, 'day');
    const isPastDate = (date: Dayjs): boolean => date.isBefore(dayjs(), 'day');

    const renderTaskItem = (task: Task): React.ReactNode => {
        const isOverdue = isTaskOverdue(task);

        return (
            <Box
                key={task.id}
                onClick={() => handleTaskClick(task)}
                sx={{
                    backgroundColor: 'background.paper',
                    borderRadius: 2,
                    p: '8px 12px',
                    mb: 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: 1,
                    borderColor: 'divider',
                    borderLeft: '3px solid',
                    borderLeftColor: isOverdue ? 'error.main' : 'warning.main',
                    boxShadow: 1,
                    minHeight: 32,
                    '&:hover': {
                        boxShadow: 2,
                        transform: 'translateY(-1px)',
                        backgroundColor: 'grey.50',
                    },
                }}
            >
                <Checkbox
                    checked={task.closed}
                    onClick={e => handleTaskCheckboxChange(task, e)}
                    size="small"
                    sx={{p: 0, minWidth: 18}}
                />
                <Typography
                    sx={{
                        flex: 1,
                        fontSize: '0.8125rem',
                        fontWeight: 500,
                        color: task.closed ? 'text.disabled' : 'text.primary',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        textDecoration: task.closed ? 'line-through' : 'none',
                    }}
                >
                    {task.title}
                </Typography>
            </Box>
        );
    };

    const renderCalendarDay = (day: CalendarDay, index: number): React.ReactNode => {
        const dayIsSelected = isSelected(day.date);
        const isPast = isPastDate(day.date);

        return (
            <Box
                key={index}
                onClick={() => handleSelectDate(day.date)}
                sx={(theme) => ({
                    flex: 1,
                    backgroundColor: day.isToday ? alpha(theme.palette.primary.main, 0.08) : dayIsSelected ? 'primary.main' : isPast ? 'grey.50' : 'background.paper',
                    borderRadius: 3,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: '2px solid',
                    borderColor: day.isToday ? 'primary.main' : 'transparent',
                    minHeight: 100,
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: 1,
                    opacity: day.isCurrentMonth ? 1 : 0.4,
                    '&:hover': {
                        boxShadow: 3,
                        transform: 'translateY(-2px)',
                    },
                })}
            >
                <Box sx={{p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                    <Typography
                        sx={{
                            fontSize: '1rem',
                            fontWeight: day.isToday ? 700 : 500,
                            color: dayIsSelected ? 'background.paper' : day.isToday ? 'primary.main' : isPast ? 'text.disabled' : 'text.primary',
                        }}
                    >
                        {day.dayNumber}
                    </Typography>
                    {day.dayNumber === 1 && (
                        <Typography
                            sx={{
                                fontSize: '0.75rem',
                                color: dayIsSelected ? 'background.paper' : 'text.disabled',
                                fontWeight: 500,
                                textTransform: 'uppercase',
                            }}
                        >
                            {day.monthName}
                        </Typography>
                    )}
                </Box>

                <Box sx={{px: 1.5, pb: 1.5}}>
                    {day.tasks.slice(0, 3).map(task => (
                        <Box
                            key={task.id}
                            onClick={e => {
                                e.stopPropagation();
                                handleTaskClick(task);
                            }}
                            sx={{
                                bgcolor: dayIsSelected ? 'rgba(255, 255, 255, 0.95)' : 'grey.100',
                                borderRadius: 2,
                                p: '6px 10px',
                                mb: 0.75,
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                borderLeft: '3px solid',
                                borderLeftColor: getTaskPriorityColor(task),
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                '&:hover': {
                                    transform: 'translateX(4px)',
                                    boxShadow: 1,
                                },
                            }}
                        >
                            <Checkbox
                                checked={task.closed}
                                onClick={e => handleTaskCheckboxChange(task, e)}
                                size="small"
                                sx={{p: 0, minWidth: 18}}
                            />
                            <Typography
                                component="span"
                                sx={{
                                    fontWeight: 600,
                                    fontSize: '0.75rem',
                                    color: isTaskOverdue(task) ? 'error.dark' : 'warning.dark',
                                    mr: 0.75,
                                }}
                            >
                                {dayjs(task.dueDate).format('h:mm a')}
                            </Typography>
                            <Typography
                                component="span"
                                sx={{
                                    color: 'text.primary',
                                    fontWeight: 500,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    flex: 1,
                                    textDecoration: task.closed ? 'line-through' : 'none',
                                }}
                            >
                                {task.title}
                            </Typography>
                        </Box>
                    ))}
                    {day.tasks.length > 3 && (
                        <Typography
                            sx={{
                                fontSize: '0.75rem',
                                color: dayIsSelected ? 'background.paper' : 'text.secondary',
                                textAlign: 'center',
                                mt: 0.75,
                                fontWeight: 500,
                            }}
                        >
                            +{day.tasks.length - 3} more
                        </Typography>
                    )}
                </Box>
            </Box>
        );
    };

    const renderMonthView = (): React.ReactNode => (
        <Box sx={{height: '100%', display: 'flex', flexDirection: 'column'}}>
            {/* Day Headers */}
            <Box sx={{display: 'flex', mb: 1.5}}>
                {DAY_HEADERS.map(day => (
                    <Box
                        key={day}
                        sx={{
                            flex: 1,
                            textAlign: 'center',
                            fontWeight: 600,
                            fontSize: '0.8125rem',
                            color: 'text.secondary',
                            py: 1.5,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                        }}
                    >
                        {day}
                    </Box>
                ))}
            </Box>

            {/* Calendar Grid */}
            <Box sx={{flex: 1, display: 'flex', flexDirection: 'column', gap: 1}}>
                {calendarWeeks.map((week, weekIndex) => (
                    <Box key={weekIndex} sx={{flex: 1, display: 'flex', gap: 1}}>
                        {week.days.map((day, dayIndex) => renderCalendarDay(day, dayIndex))}
                    </Box>
                ))}
            </Box>
        </Box>
    );

    const renderWeekView = (): React.ReactNode => (
        <Box
            sx={{
                height: '100%',
                display: 'flex',
                backgroundColor: 'background.paper',
                borderRadius: 3,
                boxShadow: 1,
                overflow: 'hidden',
            }}
        >
            {/* Time Column */}
            <Box
                sx={{
                    width: 80,
                    flexShrink: 0,
                    borderRight: 1,
                    borderColor: 'divider',
                    backgroundColor: 'grey.50',
                }}
            >
                <Box sx={{height: 56, borderBottom: 1, borderColor: 'divider'}} />
                <Box>
                    {TIME_SLOTS.map(time => (
                        <Box
                            key={time}
                            sx={{
                                height: 72,
                                p: '8px 12px',
                                textAlign: 'right',
                                fontSize: '0.75rem',
                                color: 'text.secondary',
                                borderBottom: 1,
                                borderColor: 'divider',
                                fontWeight: 500,
                            }}
                        >
                            {formatTimeSlot(time)}
                        </Box>
                    ))}
                </Box>
            </Box>

            {/* Days Container */}
            <Box sx={{flex: 1, display: 'flex', overflowX: 'auto'}}>
                {weekDays.map((day, index) => (
                    <Box
                        key={index}
                        sx={{
                            flex: 1,
                            minWidth: 160,
                            borderRight: index < 6 ? 1 : 0,
                            borderColor: 'divider',
                        }}
                    >
                        <Box
                            sx={(theme) => ({
                                height: 56,
                                p: 1.5,
                                textAlign: 'center',
                                backgroundColor: isToday(day) ? alpha(theme.palette.primary.main, 0.08) : theme.palette.background.paper,
                                borderBottom: 1,
                                borderColor: 'divider',
                                position: 'sticky',
                                top: 0,
                                zIndex: 5,
                            })}
                        >
                            <Typography
                                sx={{
                                    fontSize: '0.875rem',
                                    color: isToday(day) ? 'primary.main' : 'text.primary',
                                    fontWeight: isToday(day) ? 600 : 500,
                                }}
                            >
                                {formatWeekDayHeader(day)}
                            </Typography>
                        </Box>

                        <Box sx={{height: 'calc(100% - 56px)', overflowY: 'auto'}}>
                            {TIME_SLOTS.map(time => (
                                <Box
                                    key={time}
                                    sx={{
                                        height: 72,
                                        borderBottom: 1,
                                        borderColor: 'divider',
                                        '&:hover': {bgcolor: 'action.hover'},
                                    }}
                                >
                                    <Box sx={{p: '4px 6px'}}>
                                        {getTasksForTimeSlot(tasks, day, time).map(task =>
                                            renderTaskItem(task)
                                        )}
                                    </Box>
                                </Box>
                            ))}
                        </Box>
                    </Box>
                ))}
            </Box>
        </Box>
    );

    const renderDayView = (): React.ReactNode => (
        <Box sx={{height: '100%', display: 'flex', gap: 2}}>
            {/* Time Column */}
            <Box
                sx={{
                    width: 80,
                    flexShrink: 0,
                    backgroundColor: 'grey.50',
                    borderRadius: '12px 0 0 12px',
                }}
            >
                {TIME_SLOTS.map(time => (
                    <Box
                        key={time}
                        sx={{
                            height: 80,
                            p: '8px 12px',
                            textAlign: 'right',
                            fontSize: '0.75rem',
                            color: 'text.secondary',
                            borderBottom: 1,
                            borderColor: 'divider',
                            fontWeight: 500,
                        }}
                    >
                        {formatTimeSlot(time)}
                    </Box>
                ))}
            </Box>

            {/* Day Content */}
            <Box
                sx={{
                    flex: 1,
                    backgroundColor: 'background.paper',
                    overflowY: 'auto',
                    borderRadius: '0 12px 12px 0',
                    boxShadow: 1,
                }}
            >
                {TIME_SLOTS.map(time => (
                    <Box
                        key={time}
                        sx={{
                            height: 80,
                            borderBottom: 1,
                            borderColor: 'divider',
                            '&:hover': {bgcolor: 'action.hover'},
                        }}
                    >
                        <Box sx={{p: '6px 12px'}}>
                            {getTasksForTimeSlot(tasks, currentDate, time).map(task =>
                                renderTaskItem(task)
                            )}
                        </Box>
                    </Box>
                ))}
            </Box>

            {/* Overdue Tasks Sidebar */}
            {overdueTasks.length > 0 && (
                <Card
                    sx={{
                        width: 320,
                        flexShrink: 0,
                        borderRadius: 3,
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    <Box
                        sx={(theme) => ({
                            backgroundColor: alpha(theme.palette.error.main, 0.08),
                            color: 'error.dark',
                            p: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                        })}
                    >
                        <WarningIcon sx={{color: 'error.main'}} />
                        <Typography sx={{fontSize: '1rem', fontWeight: 600}}>
                            Overdue Tasks ({overdueTasks.length})
                        </Typography>
                    </Box>
                    <CardContent
                        sx={(theme) => ({
                            flex: 1,
                            overflowY: 'auto',
                            p: 1.5,
                            backgroundColor: alpha(theme.palette.error.main, 0.04),
                        })}
                    >
                        {overdueTasks.map(task => (
                            <Box key={task.id} sx={{mb: 1}}>
                                {renderTaskItem(task)}
                            </Box>
                        ))}
                    </CardContent>
                </Card>
            )}
        </Box>
    );

    return (
        <Box
            sx={{
                height: '100%',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'grey.50',
                borderRadius: 3,
                overflow: 'hidden',
            }}
        >
            {/* Toolbar */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    px: 2,
                    py: 1,
                    backgroundColor: 'background.paper',
                    borderBottom: 1,
                    borderColor: 'divider',
                    boxShadow: 1,
                }}
            >
                <ToggleButtonGroup
                    value={viewMode}
                    exclusive
                    onChange={handleViewModeChange}
                    size="small"
                    sx={{
                        backgroundColor: 'grey.100',
                        borderRadius: '100px',
                        p: 0.5,
                        '& .MuiToggleButton-root': {
                            border: 'none',
                            borderRadius: '100px !important',
                            px: 1.5,
                            '&.Mui-selected': {
                                backgroundColor: 'background.paper',
                                boxShadow: 1,
                            },
                        },
                    }}
                >
                    <ToggleButton value="month" aria-label="Month view">
                        <Tooltip title="Month View">
                            <CalendarViewMonthIcon />
                        </Tooltip>
                    </ToggleButton>
                    <ToggleButton value="week" aria-label="Week view">
                        <Tooltip title="Week View">
                            <ViewWeekIcon />
                        </Tooltip>
                    </ToggleButton>
                    <ToggleButton value="day" aria-label="Day view">
                        <Tooltip title="Day View">
                            <ViewDayIcon />
                        </Tooltip>
                    </ToggleButton>
                </ToggleButtonGroup>

                <Divider orientation="vertical" flexItem sx={{mx: 2.5, height: 24, alignSelf: 'center'}} />

                <Box sx={{display: 'flex', alignItems: 'center'}}>
                    <IconButton onClick={handlePreviousPeriod} size="small">
                        <ChevronLeftIcon />
                    </IconButton>
                    <Typography
                        variant="h6"
                        sx={{
                            minWidth: 240,
                            textAlign: 'center',
                            fontWeight: 500,
                            fontSize: '1.125rem',
                            color: 'text.primary',
                        }}
                    >
                        {formatPeriodTitle()}
                    </Typography>
                    <IconButton onClick={handleNextPeriod} size="small">
                        <ChevronRightIcon />
                    </IconButton>
                </Box>

                <Box sx={{flex: 1}} />

                <Button
                    variant="contained"
                    startIcon={<TodayIcon />}
                    onClick={handleGoToToday}
                    sx={{
                        borderRadius: '100px',
                        fontWeight: 500,
                        textTransform: 'none',
                        boxShadow: 'none',
                        '&:hover': {
                            boxShadow: 1,
                        },
                    }}
                >
                    Today
                </Button>
            </Box>

            <Box sx={{flex: 1, overflow: 'auto', p: 2}}>
                {viewMode === 'month' && renderMonthView()}
                {viewMode === 'week' && renderWeekView()}
                {viewMode === 'day' && renderDayView()}
            </Box>
        </Box>
    );
};

export default TaskCalendarView;
