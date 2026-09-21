/**
 * React Task Calendar View Component
 *
 * A calendar component for viewing and managing tasks in month, week, and day views.
 * Uses MUI components for styling and interactions.
 */

import React, {useState, useMemo, useEffect, useCallback} from 'react';
import {
    ActionIcon,
    Box,
    Button,
    Card,
    Checkbox,
    Divider,
    Group,
    SegmentedControl,
    Stack,
    Text,
    Title,
    Tooltip,
    alpha,
} from '@mantine/core';
import {CalendarDays, ChevronLeft, ChevronRight, Columns3, Rows3, TriangleAlert} from 'lucide-react';
import {Icon} from '../icon/Icon';
import classes from './TaskCalendarView.module.css';
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

const DIV = 'var(--mantine-color-default-border)';

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

    // SegmentedControl hands back the value itself, where ToggleButtonGroup passed
    // (event, value) and could emit null when the active button was re-clicked.
    const handleViewModeChange = (newMode: string): void => {
        setViewMode(newMode as ViewMode);
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
            <Group
                key={task.id}
                onClick={() => handleTaskClick(task)}
                className={classes.taskItem}
                gap={8}
                wrap="nowrap"
                mb={4}
                px={12}
                py={8}
                mih={32}
                bg="var(--mantine-color-body)"
                style={{
                    borderRadius: 'var(--mantine-radius-lg)',
                    cursor: 'pointer',
                    border: '1px solid var(--mantine-color-default-border)',
                    borderLeft: `3px solid ${isOverdue ? 'var(--mantine-color-red-6)' : 'var(--mantine-color-yellow-6)'}`,
                }}
            >
                <Checkbox
                    checked={task.closed}
                    onClick={e => handleTaskCheckboxChange(task, e)}
                    onChange={() => undefined}
                    size="xs"
                />
                <Text
                    fz="0.8125rem"
                    fw={500}
                    truncate
                    c={task.closed ? 'dimmed' : undefined}
                    td={task.closed ? 'line-through' : undefined}
                    style={{flex: 1}}
                >
                    {task.title}
                </Text>
            </Group>
        );
    };

    const renderCalendarDay = (day: CalendarDay, index: number): React.ReactNode => {
        const dayIsSelected = isSelected(day.date);
        const isPast = isPastDate(day.date);

        return (
            <Box
                key={index}
                onClick={() => handleSelectDate(day.date)}
                className={classes.calendarDay}
                mih={100}
                style={{
                    flex: 1,
                    backgroundColor: day.isToday
                        ? alpha('var(--mantine-primary-color-filled)', 0.08)
                        : dayIsSelected
                            ? 'var(--mantine-primary-color-filled)'
                            : isPast ? 'var(--mantine-color-gray-0)' : 'var(--mantine-color-body)',
                    borderRadius: 'var(--mantine-radius-sm)',
                    cursor: 'pointer',
                    border: `2px solid ${day.isToday ? 'var(--mantine-primary-color-filled)' : 'transparent'}`,
                    position: 'relative',
                    overflow: 'hidden',
                    opacity: day.isCurrentMonth ? 1 : 0.4,
                }}
            >
                <Group p={12} justify="space-between" align="flex-start" wrap="nowrap">
                    <Text
                        fz="1rem"
                        fw={day.isToday ? 700 : 500}
                        c={dayIsSelected
                            ? 'var(--mantine-color-body)'
                            : day.isToday ? 'var(--mantine-primary-color-filled)' : isPast ? 'dimmed' : undefined}
                    >
                        {day.dayNumber}
                    </Text>
                    {day.dayNumber === 1 && (
                        <Text
                            fz="0.75rem"
                            fw={500}
                            tt="uppercase"
                            c={dayIsSelected ? 'var(--mantine-color-body)' : 'dimmed'}
                        >
                            {day.monthName}
                        </Text>
                    )}
                </Group>

                <Box px={12} pb={12}>
                    {day.tasks.slice(0, 3).map(task => (
                        <Group
                            key={task.id}
                            onClick={e => {
                                e.stopPropagation();
                                handleTaskClick(task);
                            }}
                            className={classes.dayTask}
                            gap={4}
                            wrap="nowrap"
                            px={10}
                            py={6}
                            mb={6}
                            fz="0.75rem"
                            style={{
                                backgroundColor: dayIsSelected ? 'rgba(255, 255, 255, 0.95)' : 'var(--mantine-color-gray-1)',
                                borderRadius: 'var(--mantine-radius-lg)',
                                cursor: 'pointer',
                                borderLeft: `3px solid ${getTaskPriorityColor(task)}`,
                            }}
                        >
                            <Checkbox
                                checked={task.closed}
                                onClick={e => handleTaskCheckboxChange(task, e)}
                                onChange={() => undefined}
                                size="xs"
                            />
                            <Text
                                component="span"
                                fw={600}
                                fz="0.75rem"
                                mr={6}
                                c={isTaskOverdue(task) ? 'var(--mantine-color-red-8)' : 'var(--mantine-color-yellow-8)'}
                            >
                                {dayjs(task.dueDate).format('h:mm a')}
                            </Text>
                            <Text
                                component="span"
                                fw={500}
                                truncate
                                td={task.closed ? 'line-through' : undefined}
                                style={{flex: 1}}
                            >
                                {task.title}
                            </Text>
                        </Group>
                    ))}
                    {day.tasks.length > 3 && (
                        <Text
                            fz="0.75rem"
                            fw={500}
                            ta="center"
                            mt={6}
                            c={dayIsSelected ? 'var(--mantine-color-body)' : 'dimmed'}
                        >
                            +{day.tasks.length - 3} more
                        </Text>
                    )}
                </Box>
            </Box>
        );
    };

    const renderMonthView = (): React.ReactNode => (
        <Stack gap={0} h="100%">
            {/* Day Headers */}
            <Group gap={0} mb={12} wrap="nowrap">
                {DAY_HEADERS.map(day => (
                    <Text
                        key={day}
                        ta="center"
                        fw={600}
                        fz="0.8125rem"
                        c="dimmed"
                        py={12}
                        tt="uppercase"
                        style={{flex: 1, letterSpacing: '0.05em'}}
                    >
                        {day}
                    </Text>
                ))}
            </Group>

            {/* Calendar Grid */}
            <Stack gap={8} style={{flex: 1}}>
                {calendarWeeks.map((week, weekIndex) => (
                    <Group key={weekIndex} gap={8} align="stretch" wrap="nowrap" style={{flex: 1}}>
                        {week.days.map((day, dayIndex) => renderCalendarDay(day, dayIndex))}
                    </Group>
                ))}
            </Stack>
        </Stack>
    );

    const renderWeekView = (): React.ReactNode => (
        <Group
            gap={0}
            align="stretch"
            wrap="nowrap"
            h="100%"
            bg="var(--mantine-color-body)"
            style={{borderRadius: 'var(--mantine-radius-sm)', overflow: 'hidden'}}
        >
            {/* Time Column */}
            <Box
                w={80}
                bg="var(--mantine-color-gray-0)"
                style={{flexShrink: 0, borderRight: `1px solid ${DIV}`}}
            >
                <Box h={56} style={{borderBottom: `1px solid ${DIV}`}} />
                <Box>
                    {TIME_SLOTS.map(time => (
                        <Text
                            key={time}
                            h={72}
                            px={12}
                            py={8}
                            ta="right"
                            fz="0.75rem"
                            fw={500}
                            c="dimmed"
                            style={{borderBottom: `1px solid ${DIV}`}}
                        >
                            {formatTimeSlot(time)}
                        </Text>
                    ))}
                </Box>
            </Box>

            {/* Days Container */}
            <Group gap={0} align="stretch" wrap="nowrap" style={{flex: 1, overflowX: 'auto'}}>
                {weekDays.map((day, index) => (
                    <Box
                        key={index}
                        miw={160}
                        style={{
                            flex: 1,
                            borderRight: index < 6 ? `1px solid ${DIV}` : undefined,
                        }}
                    >
                        <Box
                            h={56}
                            p={12}
                            ta="center"
                            style={{
                                backgroundColor: isToday(day)
                                    ? alpha('var(--mantine-primary-color-filled)', 0.08)
                                    : 'var(--mantine-color-body)',
                                borderBottom: `1px solid ${DIV}`,
                                position: 'sticky',
                                top: 0,
                                zIndex: 5,
                            }}
                        >
                            <Text
                                fz="0.875rem"
                                fw={isToday(day) ? 600 : 500}
                                c={isToday(day) ? 'var(--mantine-primary-color-filled)' : undefined}
                            >
                                {formatWeekDayHeader(day)}
                            </Text>
                        </Box>

                        <Box style={{height: 'calc(100% - 56px)', overflowY: 'auto'}}>
                            {TIME_SLOTS.map(time => (
                                <Box
                                    key={time}
                                    className={classes.timeSlot}
                                    h={72}
                                    style={{borderBottom: `1px solid ${DIV}`}}
                                >
                                    <Box px={6} py={4}>
                                        {getTasksForTimeSlot(tasks, day, time).map(task =>
                                            renderTaskItem(task)
                                        )}
                                    </Box>
                                </Box>
                            ))}
                        </Box>
                    </Box>
                ))}
            </Group>
        </Group>
    );

    const renderDayView = (): React.ReactNode => (
        <Group gap={16} align="stretch" wrap="nowrap" h="100%">
            {/* Time Column */}
            <Box
                w={80}
                bg="var(--mantine-color-gray-0)"
                style={{flexShrink: 0, borderRadius: 'var(--mantine-radius-sm) 0 0 var(--mantine-radius-sm)'}}
            >
                {TIME_SLOTS.map(time => (
                    <Text
                        key={time}
                        h={80}
                        px={12}
                        py={8}
                        ta="right"
                        fz="0.75rem"
                        fw={500}
                        c="dimmed"
                        style={{borderBottom: `1px solid ${DIV}`}}
                    >
                        {formatTimeSlot(time)}
                    </Text>
                ))}
            </Box>

            {/* Day Content */}
            <Box
                bg="var(--mantine-color-body)"
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    borderRadius: '0 var(--mantine-radius-sm) var(--mantine-radius-sm) 0',
                }}
            >
                {TIME_SLOTS.map(time => (
                    <Box
                        key={time}
                        className={classes.timeSlot}
                        h={80}
                        style={{borderBottom: `1px solid ${DIV}`}}
                    >
                        <Box px={12} py={6}>
                            {getTasksForTimeSlot(tasks, currentDate, time).map(task =>
                                renderTaskItem(task)
                            )}
                        </Box>
                    </Box>
                ))}
            </Box>

            {/* Overdue Tasks Sidebar */}
            {overdueTasks.length > 0 && (
                <Card w={320} p={0} radius={12} style={{flexShrink: 0, display: 'flex', flexDirection: 'column'}}>
                    <Group
                        p={16}
                        gap={8}
                        wrap="nowrap"
                        c="var(--mantine-color-red-8)"
                        style={{backgroundColor: alpha('var(--mantine-color-red-6)', 0.08)}}
                    >
                        <Icon lucide={TriangleAlert} color="var(--mantine-color-red-6)"/>
                        <Text fz="1rem" fw={600}>
                            Overdue Tasks ({overdueTasks.length})
                        </Text>
                    </Group>
                    <Box
                        p={12}
                        style={{
                            flex: 1,
                            overflowY: 'auto',
                            backgroundColor: alpha('var(--mantine-color-red-6)', 0.04),
                        }}
                    >
                        {overdueTasks.map(task => (
                            <Box key={task.id} mb={8}>
                                {renderTaskItem(task)}
                            </Box>
                        ))}
                    </Box>
                </Card>
            )}
        </Group>
    );

    return (
        <Stack
            data-testid="task-calendar-view"
            gap={0}
            bg="var(--mantine-color-gray-0)"
            // height/overflow stay inline: a regression test asserts them with
            // toHaveStyle, and a fixed viewport height here overshoots the real flex
            // space and clips the bottom with no scrollbar.
            style={{height: '100%', minHeight: 0, borderRadius: 'var(--mantine-radius-sm)', overflow: 'hidden'}}
        >
            {/* Toolbar */}
            <Group
                px={16}
                py={8}
                gap={0}
                wrap="nowrap"
                bg="var(--mantine-color-body)"
                style={{
                    borderBottom: `1px solid ${DIV}`,
                    boxShadow: 'var(--mantine-shadow-xs)',
                }}
            >
                {/* A SegmentedControl rather than a toggle group: one tab stop, arrow-key
                    navigation, and the selected state is a real radio, not a pressed button. */}
                <SegmentedControl
                    value={viewMode}
                    onChange={handleViewModeChange}
                    size="xs"
                    radius={100}
                    data={[
                        {value: 'month', label: (
                            <Tooltip label="Month View">
                                <Icon lucide={CalendarDays} aria-label="Month view"/>
                            </Tooltip>
                        )},
                        {value: 'week', label: (
                            <Tooltip label="Week View">
                                <Icon lucide={Columns3} aria-label="Week view"/>
                            </Tooltip>
                        )},
                        {value: 'day', label: (
                            <Tooltip label="Day View">
                                <Icon lucide={Rows3} aria-label="Day view"/>
                            </Tooltip>
                        )},
                    ]}
                />

                <Divider orientation="vertical" mx={20} h={24} style={{alignSelf: 'center'}}/>

                <Group gap={0} wrap="nowrap">
                    <ActionIcon
                        variant="subtle"
                        color="gray"
                        onClick={handlePreviousPeriod}
                        aria-label="Previous period"
                    >
                        <Icon lucide={ChevronLeft}/>
                    </ActionIcon>
                    {/* Title, not Text: the period heading is queried by role. */}
                    <Title order={6} miw={240} ta="center" fw={500} fz="1.125rem">
                        {formatPeriodTitle()}
                    </Title>
                    <ActionIcon
                        variant="subtle"
                        color="gray"
                        onClick={handleNextPeriod}
                        aria-label="Next period"
                    >
                        <Icon lucide={ChevronRight}/>
                    </ActionIcon>
                </Group>

                <div style={{flex: 1}}/>

                <Button
                    radius={100}
                    fw={500}
                    leftSection={<Icon lucide={CalendarDays}/>}
                    onClick={handleGoToToday}
                >
                    Today
                </Button>
            </Group>

            <Box p={16} style={{flex: 1, overflow: 'auto'}}>
                {viewMode === 'month' && renderMonthView()}
                {viewMode === 'week' && renderWeekView()}
                {viewMode === 'day' && renderDayView()}
            </Box>
        </Stack>
    );
};

export default TaskCalendarView;
