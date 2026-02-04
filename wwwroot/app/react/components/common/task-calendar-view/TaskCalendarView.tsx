/**
 * React Task Calendar View Component
 *
 * A calendar component for viewing and managing tasks in month, week, and day views.
 * Uses MUI components for styling and interactions.
 */

import React from 'react';
import {
    Box,
    IconButton,
    Button,
    Typography,
    Checkbox,
    Divider,
    Card,
    CardContent,
    Tooltip,
    ToggleButton,
    ToggleButtonGroup,
} from '@mui/material';
import {
    ChevronLeft as ChevronLeftIcon,
    ChevronRight as ChevronRightIcon,
    Today as TodayIcon,
    CalendarViewMonth as CalendarViewMonthIcon,
    ViewWeek as ViewWeekIcon,
    ViewDay as ViewDayIcon,
    Warning as WarningIcon,
} from '@mui/icons-material';
import dayjs, {Dayjs} from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import weekday from 'dayjs/plugin/weekday';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {
    TaskCalendarViewProps,
    TaskCalendarViewState,
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

export class TaskCalendarView extends React.Component<TaskCalendarViewProps, TaskCalendarViewState> {

    constructor(props: TaskCalendarViewProps) {
        super(props);
        this.state = {
            currentDate: dayjs(),
            viewMode: 'month',
            calendarWeeks: [],
            weekDays: [],
            selectedDate: dayjs(),
            timeSlots: this.generateTimeSlots(),
        };
    }

    componentDidMount(): void {
        this.initializeCalendar();
        this.emitViewChange();
    }

    componentDidUpdate(prevProps: TaskCalendarViewProps, prevState: TaskCalendarViewState): void {
        if (prevProps.tasks !== this.props.tasks) {
            this.initializeCalendar();
        }
        if (prevState.viewMode !== this.state.viewMode || prevState.currentDate !== this.state.currentDate) {
            this.emitViewChange();
        }
    }

    private generateTimeSlots(): string[] {
        const slots: string[] = [];
        for (let hour = 0; hour < 24; hour++) {
            slots.push(dayjs().hour(hour).minute(0).format('HH:mm'));
        }
        return slots;
    }

    private initializeCalendar = (): void => {
        switch (this.state.viewMode) {
            case 'month':
                this.buildMonthView();
                break;
            case 'week':
                this.buildWeekView();
                break;
            case 'day':
                this.buildDayView();
                break;
        }
    };

    private buildMonthView = (): void => {
        const {currentDate} = this.state;
        const startOfMonth = currentDate.startOf('month');
        const endOfMonth = currentDate.endOf('month');
        const startDate = startOfMonth.startOf('week');
        const endDate = endOfMonth.endOf('week');

        const calendarWeeks: CalendarWeek[] = [];
        let currentWeek = startDate;

        while (currentWeek.isBefore(endDate) || currentWeek.isSame(endDate, 'day')) {
            const week: CalendarWeek = {
                weekNumber: currentWeek.isoWeek(),
                days: [],
            };

            for (let i = 0; i < 7; i++) {
                const dayDate = currentWeek.add(i, 'day');
                week.days.push(this.createCalendarDay(dayDate));
            }

            calendarWeeks.push(week);
            currentWeek = currentWeek.add(1, 'week');
        }

        this.setState({calendarWeeks});
    };

    private buildWeekView = (): void => {
        const startOfWeek = this.state.currentDate.startOf('week');
        const weekDays: Dayjs[] = [];

        for (let i = 0; i < 7; i++) {
            weekDays.push(startOfWeek.add(i, 'day'));
        }

        this.setState({weekDays});
    };

    private buildDayView = (): void => {
        this.setState({selectedDate: this.state.currentDate});
    };

    private createCalendarDay = (date: Dayjs): CalendarDay => {
        return {
            date,
            isToday: date.isSame(dayjs(), 'day'),
            isCurrentMonth: date.isSame(this.state.currentDate, 'month'),
            dayNumber: date.date(),
            monthName: date.format('MMM'),
            tasks: this.getTasksForDate(date),
        };
    };

    private getTasksForDate = (date: Dayjs): Task[] => {
        const {tasks} = this.props;
        if (!tasks) return [];

        return tasks.filter(task => {
            const taskDate = dayjs(task.dueDate);
            return taskDate.isSame(date, 'day');
        });
    };

    private getTasksForTimeSlot = (date: Dayjs, timeSlot: string): Task[] => {
        const {tasks} = this.props;
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
    };

    private getOverdueTasks = (): Task[] => {
        const {tasks} = this.props;
        if (!tasks) return [];

        const now = dayjs();
        return tasks.filter(task => {
            if (task.closed) return false;
            return dayjs(task.dueDate).isBefore(now);
        });
    };

    private handlePreviousPeriod = (): void => {
        const {viewMode, currentDate} = this.state;
        let newDate: Dayjs;

        switch (viewMode) {
            case 'month':
                newDate = currentDate.subtract(1, 'month');
                break;
            case 'week':
                newDate = currentDate.subtract(1, 'week');
                break;
            case 'day':
                newDate = currentDate.subtract(1, 'day');
                break;
        }

        this.setState({currentDate: newDate}, this.initializeCalendar);
    };

    private handleNextPeriod = (): void => {
        const {viewMode, currentDate} = this.state;
        let newDate: Dayjs;

        switch (viewMode) {
            case 'month':
                newDate = currentDate.add(1, 'month');
                break;
            case 'week':
                newDate = currentDate.add(1, 'week');
                break;
            case 'day':
                newDate = currentDate.add(1, 'day');
                break;
        }

        this.setState({currentDate: newDate}, this.initializeCalendar);
    };

    private handleGoToToday = (): void => {
        this.setState(
            {
                currentDate: dayjs(),
                selectedDate: dayjs(),
            },
            this.initializeCalendar
        );
    };

    private handleSelectDate = (date: Dayjs): void => {
        this.setState({selectedDate: date});
        if (this.state.viewMode === 'month') {
            this.setState({currentDate: date, viewMode: 'day'}, this.initializeCalendar);
        }
    };

    private handleViewModeChange = (_event: React.MouseEvent<HTMLElement>, newMode: ViewMode | null): void => {
        if (newMode !== null) {
            this.setState({viewMode: newMode}, this.initializeCalendar);
        }
    };

    private handleTaskClick = (task: Task): void => {
        const {onTaskClick} = this.props;
        if (onTaskClick) {
            onTaskClick(task);
        }
    };

    private handleTaskCheckboxChange = async (task: Task, event: React.MouseEvent): Promise<void> => {
        event.stopPropagation();
        const {tasksService, onTaskStatusChange, showSuccessToast, showErrorToast} = this.props;

        const newClosedState = !task.closed;
        task.closed = newClosedState;

        try {
            await tasksService.markTaskAsClosed(task.id, newClosedState);
            showSuccessToast?.('Task updated successfully');
            onTaskStatusChange?.(task);
            this.initializeCalendar();
        } catch (error) {
            task.closed = !newClosedState;
            showErrorToast?.('Failed to update task');
            console.error('Error updating task:', error);
        }
    };

    private emitViewChange = (): void => {
        const {onViewChange} = this.props;
        if (!onViewChange) return;

        const {viewMode, currentDate} = this.state;
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
    };

    private formatPeriodTitle = (): string => {
        const {viewMode, currentDate} = this.state;

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

    private formatWeekDayHeader = (date: Dayjs): string => {
        const format = date.isSame(dayjs(), 'day') ? '[Today], MMM D' : 'ddd, MMM D';
        return date.format(format);
    };

    private formatTimeSlot = (time: string): string => {
        const [hours] = time.split(':').map(Number);
        return dayjs().hour(hours).minute(0).format('h A');
    };

    private isToday = (date: Dayjs): boolean => date.isSame(dayjs(), 'day');

    private isSelected = (date: Dayjs): boolean => date.isSame(this.state.selectedDate, 'day');

    private isPastDate = (date: Dayjs): boolean => date.isBefore(dayjs(), 'day');

    private isTaskOverdue = (task: Task): boolean => {
        if (task.closed) return false;
        return dayjs(task.dueDate).isBefore(dayjs());
    };

    private getTaskPriorityColor = (task: Task): string => {
        if (this.isTaskOverdue(task)) return '#ef4444';
        return '#f59e0b';
    };

    render(): React.ReactNode {
        const {viewMode} = this.state;

        return (
            <Box
                sx={{
                    height: 'calc(100vh - 205px)',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '12px',
                    overflow: 'hidden',
                }}
            >
                {this.renderToolbar()}
                <Box sx={{flex: 1, overflow: 'auto', p: 2}}>
                    {viewMode === 'month' && this.renderMonthView()}
                    {viewMode === 'week' && this.renderWeekView()}
                    {viewMode === 'day' && this.renderDayView()}
                </Box>
            </Box>
        );
    }

    private renderToolbar(): React.ReactNode {
        const {viewMode} = this.state;

        return (
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    px: 2,
                    py: 1,
                    backgroundColor: '#ffffff',
                    borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                }}
            >
                <ToggleButtonGroup
                    value={viewMode}
                    exclusive
                    onChange={this.handleViewModeChange}
                    size="small"
                    sx={{
                        backgroundColor: '#f3f4f6',
                        borderRadius: '100px',
                        p: 0.5,
                        '& .MuiToggleButton-root': {
                            border: 'none',
                            borderRadius: '100px !important',
                            px: 1.5,
                            '&.Mui-selected': {
                                backgroundColor: '#ffffff',
                                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
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
                    <IconButton onClick={this.handlePreviousPeriod} size="small">
                        <ChevronLeftIcon />
                    </IconButton>
                    <Typography
                        variant="h6"
                        sx={{
                            minWidth: 240,
                            textAlign: 'center',
                            fontWeight: 500,
                            fontSize: '18px',
                            color: '#1f2937',
                        }}
                    >
                        {this.formatPeriodTitle()}
                    </Typography>
                    <IconButton onClick={this.handleNextPeriod} size="small">
                        <ChevronRightIcon />
                    </IconButton>
                </Box>

                <Box sx={{flex: 1}} />

                <Button
                    variant="contained"
                    startIcon={<TodayIcon />}
                    onClick={this.handleGoToToday}
                    sx={{
                        borderRadius: '100px',
                        fontWeight: 500,
                        textTransform: 'none',
                        boxShadow: 'none',
                        '&:hover': {
                            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                        },
                    }}
                >
                    Today
                </Button>
            </Box>
        );
    }

    private renderMonthView(): React.ReactNode {
        const {calendarWeeks} = this.state;

        return (
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
                                fontSize: '13px',
                                color: '#6b7280',
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
                            {week.days.map((day, dayIndex) => this.renderCalendarDay(day, dayIndex))}
                        </Box>
                    ))}
                </Box>
            </Box>
        );
    }

    private renderCalendarDay(day: CalendarDay, index: number): React.ReactNode {
        const isSelected = this.isSelected(day.date);
        const isPast = this.isPastDate(day.date);

        return (
            <Box
                key={index}
                onClick={() => this.handleSelectDate(day.date)}
                sx={{
                    flex: 1,
                    backgroundColor: day.isToday ? '#eff6ff' : isSelected ? 'primary.main' : isPast ? '#f9fafb' : '#ffffff',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: '2px solid',
                    borderColor: day.isToday ? 'primary.main' : 'transparent',
                    minHeight: 100,
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                    opacity: day.isCurrentMonth ? 1 : 0.4,
                    '&:hover': {
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        transform: 'translateY(-2px)',
                    },
                }}
            >
                <Box sx={{p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                    <Typography
                        sx={{
                            fontSize: '16px',
                            fontWeight: day.isToday ? 700 : 500,
                            color: isSelected ? '#ffffff' : day.isToday ? 'primary.main' : isPast ? '#9ca3af' : '#1f2937',
                        }}
                    >
                        {day.dayNumber}
                    </Typography>
                    {day.dayNumber === 1 && (
                        <Typography
                            sx={{
                                fontSize: '11px',
                                color: isSelected ? '#ffffff' : '#9ca3af',
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
                                this.handleTaskClick(task);
                            }}
                            sx={{
                                backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.95)' : '#f3f4f6',
                                borderRadius: '8px',
                                p: '6px 10px',
                                mb: 0.75,
                                fontSize: '12px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                borderLeft: '3px solid',
                                borderLeftColor: this.getTaskPriorityColor(task),
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                '&:hover': {
                                    transform: 'translateX(4px)',
                                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                                },
                            }}
                        >
                            <Checkbox
                                checked={task.closed}
                                onClick={e => this.handleTaskCheckboxChange(task, e)}
                                size="small"
                                sx={{p: 0, minWidth: 18}}
                            />
                            <Typography
                                component="span"
                                sx={{
                                    fontWeight: 600,
                                    fontSize: '11px',
                                    color: this.isTaskOverdue(task) ? '#dc2626' : '#d97706',
                                    mr: 0.75,
                                }}
                            >
                                {dayjs(task.dueDate).format('h:mm a')}
                            </Typography>
                            <Typography
                                component="span"
                                sx={{
                                    color: '#374151',
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
                                fontSize: '11px',
                                color: isSelected ? '#ffffff' : '#6b7280',
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
    }

    private renderWeekView(): React.ReactNode {
        const {weekDays, timeSlots} = this.state;

        return (
            <Box
                sx={{
                    height: '100%',
                    display: 'flex',
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                    overflow: 'hidden',
                }}
            >
                {/* Time Column */}
                <Box
                    sx={{
                        width: 80,
                        flexShrink: 0,
                        borderRight: '1px solid rgba(0, 0, 0, 0.08)',
                        backgroundColor: '#f9fafb',
                    }}
                >
                    <Box sx={{height: 56, borderBottom: '1px solid rgba(0, 0, 0, 0.08)'}} />
                    <Box>
                        {timeSlots.map(time => (
                            <Box
                                key={time}
                                sx={{
                                    height: 72,
                                    p: '8px 12px',
                                    textAlign: 'right',
                                    fontSize: '12px',
                                    color: '#6b7280',
                                    borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
                                    fontWeight: 500,
                                }}
                            >
                                {this.formatTimeSlot(time)}
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
                                borderRight: index < 6 ? '1px solid rgba(0, 0, 0, 0.08)' : 'none',
                            }}
                        >
                            <Box
                                sx={{
                                    height: 56,
                                    p: 1.5,
                                    textAlign: 'center',
                                    backgroundColor: this.isToday(day) ? '#eff6ff' : '#ffffff',
                                    borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
                                    position: 'sticky',
                                    top: 0,
                                    zIndex: 5,
                                }}
                            >
                                <Typography
                                    sx={{
                                        fontSize: '14px',
                                        color: this.isToday(day) ? 'primary.main' : '#1f2937',
                                        fontWeight: this.isToday(day) ? 600 : 500,
                                    }}
                                >
                                    {this.formatWeekDayHeader(day)}
                                </Typography>
                            </Box>

                            <Box sx={{height: 'calc(100% - 56px)', overflowY: 'auto'}}>
                                {timeSlots.map(time => (
                                    <Box
                                        key={time}
                                        sx={{
                                            height: 72,
                                            borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
                                            '&:hover': {backgroundColor: 'rgba(0, 0, 0, 0.02)'},
                                        }}
                                    >
                                        <Box sx={{p: '4px 6px'}}>
                                            {this.getTasksForTimeSlot(day, time).map(task =>
                                                this.renderTaskItem(task)
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
    }

    private renderDayView(): React.ReactNode {
        const {currentDate, timeSlots} = this.state;
        const overdueTasks = this.getOverdueTasks();

        return (
            <Box sx={{height: '100%', display: 'flex', gap: 2}}>
                {/* Time Column */}
                <Box
                    sx={{
                        width: 80,
                        flexShrink: 0,
                        backgroundColor: '#f9fafb',
                        borderRadius: '12px 0 0 12px',
                    }}
                >
                    {timeSlots.map(time => (
                        <Box
                            key={time}
                            sx={{
                                height: 80,
                                p: '8px 12px',
                                textAlign: 'right',
                                fontSize: '12px',
                                color: '#6b7280',
                                borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
                                fontWeight: 500,
                            }}
                        >
                            {this.formatTimeSlot(time)}
                        </Box>
                    ))}
                </Box>

                {/* Day Content */}
                <Box
                    sx={{
                        flex: 1,
                        backgroundColor: '#ffffff',
                        overflowY: 'auto',
                        borderRadius: '0 12px 12px 0',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                    }}
                >
                    {timeSlots.map(time => (
                        <Box
                            key={time}
                            sx={{
                                height: 80,
                                borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
                                '&:hover': {backgroundColor: 'rgba(0, 0, 0, 0.02)'},
                            }}
                        >
                            <Box sx={{p: '6px 12px'}}>
                                {this.getTasksForTimeSlot(currentDate, time).map(task =>
                                    this.renderTaskItem(task)
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
                            borderRadius: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        <Box
                            sx={{
                                backgroundColor: '#fef2f2',
                                color: '#991b1b',
                                p: 2,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                            }}
                        >
                            <WarningIcon sx={{color: '#ef4444'}} />
                            <Typography sx={{fontSize: '16px', fontWeight: 600}}>
                                Overdue Tasks ({overdueTasks.length})
                            </Typography>
                        </Box>
                        <CardContent
                            sx={{
                                flex: 1,
                                overflowY: 'auto',
                                p: 1.5,
                                backgroundColor: '#fffbfb',
                            }}
                        >
                            {overdueTasks.map(task => (
                                <Box key={task.id} sx={{mb: 1}}>
                                    {this.renderTaskItem(task)}
                                </Box>
                            ))}
                        </CardContent>
                    </Card>
                )}
            </Box>
        );
    }

    private renderTaskItem(task: Task): React.ReactNode {
        const isOverdue = this.isTaskOverdue(task);

        return (
            <Box
                key={task.id}
                onClick={() => this.handleTaskClick(task)}
                sx={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    p: '8px 12px',
                    mb: 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: '1px solid rgba(0, 0, 0, 0.08)',
                    borderLeft: '3px solid',
                    borderLeftColor: isOverdue ? '#ef4444' : '#f59e0b',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                    minHeight: 32,
                    '&:hover': {
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                        transform: 'translateY(-1px)',
                        backgroundColor: '#f8f9fa',
                    },
                }}
            >
                <Checkbox
                    checked={task.closed}
                    onClick={e => this.handleTaskCheckboxChange(task, e)}
                    size="small"
                    sx={{p: 0, minWidth: 18}}
                />
                <Typography
                    sx={{
                        flex: 1,
                        fontSize: '13px',
                        fontWeight: 500,
                        color: task.closed ? '#9ca3af' : '#1f2937',
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
    }
}

export default TaskCalendarView;
