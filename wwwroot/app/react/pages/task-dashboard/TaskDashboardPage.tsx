/**
 * TaskDashboard Page Component
 *
 * A React implementation of the task dashboard with a "Refined Command Center" layout.
 * Features gradient stat cards, inline filters, date-grouped tasks, and a fixed two-column layout.
 * The job-detail-widget is rendered separately in the AngularJS template.
 */

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import List from '@mui/material/List';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import {useTheme} from '@mui/material/styles';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import SearchIcon from '@mui/icons-material/Search';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import ViewListIcon from '@mui/icons-material/ViewList';
import WarningIcon from '@mui/icons-material/Warning';
import dayjs, {Dayjs} from 'dayjs';
import {aiAccentColor} from '../../theme/designTokens';
import {
    DateFilterData,
    ExtendedTask,
    StatusCounts,
    StatusFilter,
    TaskDashboardPageProps,
    ViewMode,
} from './TaskDashboardPage.interfaces';
import {TaskFiltersRequest} from '../../interfaces';
import {TaskItem} from '../../components/common/task-item/TaskItem';
import {TaskCalendarView} from '../../components/common/task-calendar-view/TaskCalendarView';
import {JobDetails} from '../../components/common/job-details/JobDetails';
import type {MountJobDetailsConfig} from '../../components/common/job-details/JobDetails.types';
import {formatDateForApi} from '../../utils/dateUtils';
import {
    useActiveStaff,
    useEventTypes,
    useMarkTaskAsClosed,
    useReassignTask,
    useTasks,
    useUpdateTaskDate,
    useUpdateTaskTime,
} from '../../hooks/useTasksApi';
import {tasksApi} from '../../services/tasksApi';
import {summarizeTaskDashboard} from '../../services/aiAssistantApi';
import {AiSummaryPanel} from '../../components/common/ai-summary-panel/AiSummaryPanel';
import {isAiEnabled} from '../../../functions/aiSettings';

// Local storage keys
const getViewPreferenceKey = () => {
    const contactId = window.ContactID || 0;
    return `taskDashboardViewPreference-${contactId}`;
};

const getDateFilterKey = () => {
    const contactId = window.ContactID || 0;
    return `dateFilter-task-dashboard-${contactId}`;
};

// Helper to set default date filter
const setDateFilterDefaults = (): DateFilterData => ({
    startDate: dayjs().subtract(1, 'day').startOf('day'),
    endDate: dayjs().add(7, 'days').endOf('day'),
});

// Task date group definition
interface TaskGroup {
    key: string;
    label: string;
    accent: string;
    tasks: ExtendedTask[];
}

// Stat card definition
interface StatCardDef {
    status: StatusFilter;
    label: string;
    countKey: keyof StatusCounts;
    color: 'primary' | 'error' | 'success' | 'secondary';
    icon: React.ReactNode;
}

const STAT_CARDS: StatCardDef[] = [
    {
        status: StatusFilter.All,
        label: 'ACTIVE',
        countKey: 'active',
        color: 'primary',
        icon: <TaskAltIcon sx={{fontSize: 32, opacity: 0.9}}/>,
    },
    {
        status: StatusFilter.Overdue,
        label: 'OVERDUE',
        countKey: 'overdue',
        color: 'error',
        icon: <WarningIcon sx={{fontSize: 32, opacity: 0.9}}/>,
    },
    {
        status: StatusFilter.Todo,
        label: 'TODO',
        countKey: 'todo',
        color: 'success',
        icon: <PendingActionsIcon sx={{fontSize: 32, opacity: 0.9}}/>,
    },
    {
        status: StatusFilter.Done,
        label: 'DONE',
        countKey: 'done',
        color: 'secondary',
        icon: <CheckCircleIcon sx={{fontSize: 32, opacity: 0.9}}/>,
    },
];

// Staggered animation keyframe style (injected once)
const fadeInUpKeyframes = `
@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
}
`;

export const TaskDashboardPage: React.FC<TaskDashboardPageProps> = ({
                                                                        showToast,
                                                                        isUsCustomer,
                                                                        setRefreshCallback,
                                                                    }) => {
    const theme = useTheme();

    // View state (initialized from localStorage to avoid flash of default state)
    const [showFullCalendar, setShowFullCalendar] = useState(() => {
        try {
            return localStorage.getItem(getViewPreferenceKey()) === ViewMode.Calendar;
        } catch {
            return false;
        }
    });
    const [statusFilter, setStatusFilter] = useState<StatusFilter>(StatusFilter.All);

    // Filter values
    const [searchQuery, setSearchQuery] = useState('');
    const [staffFilter, setStaffFilter] = useState('all');
    const [eventTypeFilter, setEventTypeFilter] = useState('all');

    // Date filter (initialized from localStorage, falls back to defaults)
    const [dateFilterData, setDateFilterData] = useState<DateFilterData>(() => {
        try {
            const saved = localStorage.getItem(getDateFilterKey());
            if (saved) {
                const parsed = JSON.parse(saved);
                return {
                    startDate: dayjs(parsed.startDate),
                    endDate: dayjs(parsed.endDate),
                };
            }
        } catch { /* ignore localStorage errors */
        }
        return setDateFilterDefaults();
    });

    // Selection
    const [selectedTask, setSelectedTask] = useState<ExtendedTask | undefined>();

    // Build filters for API request
    const taskFilters = useMemo((): TaskFiltersRequest => {
        const filters: TaskFiltersRequest = {};

        if (staffFilter && staffFilter !== 'all') {
            filters.staffId = parseInt(staffFilter, 10);
        }

        if (eventTypeFilter && eventTypeFilter !== 'all') {
            filters.eventTypeId = parseInt(eventTypeFilter, 10);
        }

        filters.showCompleted = true;

        if (searchQuery) {
            filters.searchText = searchQuery;
        }

        filters.startDate = formatDateForApi(dateFilterData.startDate);
        filters.endDate = formatDateForApi(dateFilterData.endDate);

        return filters;
    }, [staffFilter, eventTypeFilter, searchQuery, dateFilterData]);

    // React Query hooks
    const {
        data: rawTasks = [],
        isLoading: tasksLoading,
        refetch: refetchTasks,
    } = useTasks(taskFilters);

    const {data: staffList = []} = useActiveStaff();
    const {data: eventTypesList = []} = useEventTypes();

    // Mutation hooks
    const markTaskAsClosedMutation = useMarkTaskAsClosed();
    const updateTaskDateMutation = useUpdateTaskDate();
    const updateTaskTimeMutation = useUpdateTaskTime();
    const reassignTaskMutation = useReassignTask();

    // Initialize time strings for tasks
    const tasks = useMemo((): ExtendedTask[] => {
        return rawTasks.map(task => {
            try {
                if (!task.dueDate || !task.dueDate.isValid()) {
                    return {...task, dueTimeStr: '00:00'};
                }

                const hours = task.dueDate.hour();
                const minutes = task.dueDate.minute();
                const roundedMinutes = minutes < 30 ? 0 : 30;
                const formattedHours = hours < 10 ? `0${hours}` : `${hours}`;

                return {
                    ...task,
                    dueTimeStr: `${formattedHours}:${roundedMinutes === 0 ? '00' : roundedMinutes}`,
                };
            } catch {
                return {...task, dueTimeStr: '00:00'};
            }
        });
    }, [rawTasks]);

    // Register refresh callback for external use
    useEffect(() => {
        if (setRefreshCallback) {
            setRefreshCallback(() => refetchTasks());
        }
    }, [setRefreshCallback, refetchTasks]);

    // Check if task is overdue
    const isTaskOverdue = useCallback((task: ExtendedTask): boolean => {
        if (task.closed) return false;
        return task.dueDate.isBefore(dayjs());
    }, []);

    // Apply filters to tasks
    const filteredTasks = useMemo(() => {
        switch (statusFilter) {
            case StatusFilter.All:
                return tasks.filter(task => !task.closed);
            case StatusFilter.Overdue:
                return tasks.filter(task => isTaskOverdue(task));
            case StatusFilter.Todo:
                return tasks.filter(task => !task.closed && !isTaskOverdue(task));
            case StatusFilter.Done:
                return tasks.filter(task => task.closed);
            default:
                return [...tasks];
        }
    }, [tasks, statusFilter, isTaskOverdue]);

    // Calculate status counts
    const statusCounts = useMemo((): StatusCounts => {
        let active = 0, overdue = 0, todo = 0, done = 0;

        for (const task of tasks) {
            if (task.closed) {
                done++;
            } else {
                active++;
                if (isTaskOverdue(task)) {
                    overdue++;
                } else {
                    todo++;
                }
            }
        }

        return {active, overdue, todo, done};
    }, [tasks, isTaskOverdue]);

    // Group tasks by date bucket
    const taskGroups = useMemo((): TaskGroup[] => {
        // For Done filter, render a flat list
        if (statusFilter === StatusFilter.Done) {
            if (filteredTasks.length === 0) return [];
            return [{
                key: 'completed',
                label: 'Completed',
                accent: theme.palette.secondary.main,
                tasks: filteredTasks,
            }];
        }

        const now = dayjs();
        const todayStart = now.startOf('day');
        const todayEnd = now.endOf('day');
        const tomorrowEnd = todayStart.add(1, 'day').endOf('day');
        const weekEnd = todayStart.add(7, 'day').endOf('day');

        const groups: Record<string, ExtendedTask[]> = {
            overdue: [],
            today: [],
            tomorrow: [],
            thisWeek: [],
            later: [],
        };

        for (const task of filteredTasks) {
            if (!task.closed && task.dueDate.isBefore(now)) {
                groups.overdue.push(task);
            } else if (task.dueDate.isBefore(todayEnd) || task.dueDate.isSame(todayEnd)) {
                groups.today.push(task);
            } else if (task.dueDate.isBefore(tomorrowEnd) || task.dueDate.isSame(tomorrowEnd)) {
                groups.tomorrow.push(task);
            } else if (task.dueDate.isBefore(weekEnd) || task.dueDate.isSame(weekEnd)) {
                groups.thisWeek.push(task);
            } else {
                groups.later.push(task);
            }
        }

        const definitions: Array<{ key: string; label: string; accent: string }> = [
            {key: 'overdue', label: 'Overdue', accent: theme.palette.error.main},
            {key: 'today', label: 'Today', accent: theme.palette.primary.main},
            {key: 'tomorrow', label: 'Tomorrow', accent: theme.palette.warning.main},
            {key: 'thisWeek', label: 'This Week', accent: theme.palette.info.dark},
            {key: 'later', label: 'Later', accent: theme.palette.secondary.main},
        ];

        return definitions
            .filter(d => groups[d.key].length > 0)
            .map(d => ({...d, tasks: groups[d.key]}));
    }, [filteredTasks, statusFilter, theme.palette]);

    // Handle view mode change
    const handleViewModeChange = useCallback((_event: React.MouseEvent<HTMLElement>, newView: string | null) => {
        if (!newView) return;
        const isCalendar = newView === 'calendar';
        setShowFullCalendar(isCalendar);

        const viewMode = isCalendar ? ViewMode.Calendar : ViewMode.List;

        // If switching to list view, reset to default date range
        if (!isCalendar) {
            const defaultFilter = setDateFilterDefaults();
            setDateFilterData(defaultFilter);
            try {
                localStorage.setItem(getDateFilterKey(), JSON.stringify(defaultFilter));
            } catch {
                // Ignore localStorage errors
            }
        }

        try {
            localStorage.setItem(getViewPreferenceKey(), viewMode);
        } catch {
            // Ignore localStorage errors
        }
    }, []);

    // Handle status filter change
    const handleStatusFilterChange = useCallback(async (newStatus: StatusFilter) => {
        setStatusFilter(newStatus);

        if (newStatus === StatusFilter.Done) {
            await refetchTasks();
        }
    }, [refetchTasks]);

    // Handle task selection
    const selectTaskForHistory = useCallback((task: ExtendedTask) => {
        setSelectedTask(task);
    }, []);

    // Handle task completion
    const handleTaskCompletion = useCallback(async () => {
        await refetchTasks();
    }, [refetchTasks]);

    // Handle calendar task click
    const handleCalendarTaskClick = useCallback((task: ExtendedTask) => {
        selectTaskForHistory(task);
    }, [selectTaskForHistory]);

    // Handle calendar task status change
    const handleCalendarTaskStatusChange = useCallback(async (_task: ExtendedTask) => {
        await handleTaskCompletion();
    }, [handleTaskCompletion]);

    // Handle calendar view change
    const handleCalendarViewChange = useCallback(async (startDate: Date, endDate: Date) => {
        const newDateFilter = {
            startDate: dayjs(startDate),
            endDate: dayjs(endDate),
        };
        setDateFilterData(newDateFilter);
    }, []);

    // Toast helpers
    const showSuccessToast = useCallback((msg: string) => showToast(msg, 'success'), [showToast]);
    const showErrorToast = useCallback((msg: string) => showToast(msg, 'error'), [showToast]);
    
    // Create a tasks service interface for child components
    const tasksServiceForComponents = useMemo(() => ({
        markTaskAsClosed: async (eventId: number, closed: boolean) => {
            await markTaskAsClosedMutation.mutateAsync({eventId, closed});
        },
        updateTaskDate: async (eventId: number, date: Dayjs, timezone?: string) => {
            await updateTaskDateMutation.mutateAsync({eventId, date, timezone});
        },
        updateTaskTime: async (eventId: number, time: Dayjs, timezone?: string) => {
            await updateTaskTimeMutation.mutateAsync({eventId, time, timezone});
        },
        reassignTaskToStaff: async (eventId: number, staffId: number) => {
            await reassignTaskMutation.mutateAsync({eventId, staffId});
        },
    }), [markTaskAsClosedMutation, updateTaskDateMutation, updateTaskTimeMutation, reassignTaskMutation]);

    // Create a dispatch service interface for child components
    const dispatchServiceForComponents = useMemo(() => ({
        getActiveStaff: () => tasksApi.getActiveStaff(),
        getDeliveryJourney: (jobId: number) => tasksApi.getDeliveryJourney(jobId),
    }), []);

    // Track cumulative task index for staggered animation across groups
    let globalTaskIndex = 0;

    return (
        <Box sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            p: 2,
            bgcolor: 'background.default',
        }}>
            {/* Inject animation keyframes */}
            <style>{fadeInUpKeyframes}</style>

            {/* Stat Cards Row */}
            <Box sx={{display: 'flex', gap: 2, mb: 2, flexShrink: 0}}>
                {STAT_CARDS.map((card) => {
                    const isSelected = statusFilter === card.status;
                    const count = statusCounts[card.countKey];
                    return (
                        <Card
                            key={card.status}
                            role="button"
                            tabIndex={0}
                            aria-label={`${card.label}: ${count}`}
                            onClick={() => handleStatusFilterChange(card.status)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    return handleStatusFilterChange(card.status);
                                }
                            }}
                            elevation={isSelected ? 8 : 1}
                            sx={{
                                flex: 1,
                                bgcolor: `${card.color}.main`,
                                color: `${card.color}.contrastText`,
                                p: 2,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                opacity: isSelected ? 1 : 0.85,
                                transform: isSelected ? 'translateY(-2px)' : 'none',
                                transition: 'all 200ms ease',
                                outline: 'none',
                                '&:hover': {
                                    opacity: 1,
                                    transform: 'translateY(-2px)',
                                },
                            }}
                        >
                            <Box>
                                <Typography sx={{fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.2}}>
                                    {count}
                                </Typography>
                                <Typography variant="overline">
                                    {card.label}
                                </Typography>
                            </Box>
                            {card.icon}
                        </Card>
                    );
                })}
            </Box>

            {/* Inline Filter Bar */}
            <Card variant="outlined" sx={{mb: 2, flexShrink: 0}}>
                <CardContent sx={{py: 1.5, '&:last-child': {pb: 1.5}}}>
                    <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                        <TextField
                            size="small"
                            label="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            slotProps={{
                                input: {
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon/>
                                        </InputAdornment>
                                    ),
                                },
                            }}
                            sx={{minWidth: 180}}
                        />

                        <FormControl size="small" sx={{minWidth: 140}}>
                            <InputLabel>Staff</InputLabel>
                            <Select
                                value={staffFilter}
                                label="Staff"
                                onChange={(e) => setStaffFilter(e.target.value)}
                            >
                                <MenuItem value="all">All Staff</MenuItem>
                                {staffList.map((staff) => (
                                    <MenuItem key={staff.id} value={staff.id.toString()}>
                                        {staff.text}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl size="small" sx={{minWidth: 140}}>
                            <InputLabel>Task Type</InputLabel>
                            <Select
                                value={eventTypeFilter}
                                label="Task Type"
                                onChange={(e) => setEventTypeFilter(e.target.value)}
                            >
                                <MenuItem value="all">All Task Types</MenuItem>
                                {eventTypesList.map((eventType) => (
                                    <MenuItem key={eventType.id} value={eventType.id.toString()}>
                                        {eventType.text}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <Box sx={{flex: 1}}/>

                        <ToggleButtonGroup
                            value={showFullCalendar ? 'calendar' : 'list'}
                            exclusive
                            onChange={handleViewModeChange}
                            size="small"
                            sx={{
                                '& .MuiToggleButton-root': {
                                    textTransform: 'none',
                                    px: 2,
                                },
                                '& .MuiToggleButton-root.Mui-selected': {
                                    bgcolor: 'primary.main',
                                    color: 'primary.contrastText',
                                    '&:hover': {
                                        bgcolor: 'primary.dark',
                                    },
                                },
                            }}
                        >
                            <ToggleButton value="list">
                                <ViewListIcon sx={{mr: 0.5, fontSize: 20}}/>
                                List
                            </ToggleButton>
                            <ToggleButton value="calendar">
                                <CalendarMonthIcon sx={{mr: 0.5, fontSize: 20}}/>
                                Calendar
                            </ToggleButton>
                        </ToggleButtonGroup>
                    </Box>
                </CardContent>
            </Card>

            {/* AI Briefing — only show when there are tasks and AI is enabled */}
            {isAiEnabled() && !tasksLoading && tasks.length > 0 && (
                <Box sx={{mb: 2, flexShrink: 0}}>
                    <AiSummaryPanel
                        title="AI Daily Briefing"
                        fetchSummary={summarizeTaskDashboard}
                        accentColor={aiAccentColor}
                    />
                </Box>
            )}

            {/* Main Content - Two Column Layout */}
            <Box sx={{flex: 1, display: 'flex', gap: 2, minHeight: 0}}>
                {/* Left Panel: Tasks or Calendar */}
                <Box sx={{flex: 11, minWidth: 0, display: 'flex', flexDirection: 'column'}}>
                    <Card variant="outlined"
                          sx={{flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
                        <Toolbar
                            variant="dense"
                            sx={{
                                bgcolor: 'background.paper',
                                color: 'text.primary',
                                borderBottom: '1px solid',
                                borderColor: 'divider',
                                minHeight: 44,
                                flexShrink: 0,
                            }}
                        >
                            {showFullCalendar ? (
                                <>
                                    <CalendarMonthIcon sx={{mr: 1}}/>
                                    <Typography variant="subtitle1">Calendar</Typography>
                                </>
                            ) : (
                                <>
                                    <TaskAltIcon sx={{mr: 1}}/>
                                    <Typography variant="subtitle1">
                                        Tasks ({filteredTasks.length})
                                    </Typography>
                                </>
                            )}
                        </Toolbar>

                        {showFullCalendar ? (
                            <Box sx={{flex: 1, overflow: 'hidden'}}>
                                <TaskCalendarView
                                    tasks={filteredTasks}
                                    onTaskUpdate={() => refetchTasks()}
                                    onTaskClick={handleCalendarTaskClick}
                                    onTaskStatusChange={handleCalendarTaskStatusChange}
                                    onViewChange={handleCalendarViewChange}
                                    tasksService={tasksServiceForComponents}
                                    showSuccessToast={showSuccessToast}
                                    showErrorToast={showErrorToast}
                                />
                            </Box>
                        ) : (
                            <CardContent sx={{flex: 1, overflow: 'hidden', p: 0, position: 'relative'}}>
                                {/* Skeleton Loading */}
                                {tasksLoading && (
                                    <Box sx={{p: 2, display: 'flex', flexDirection: 'column', gap: 1}}>
                                        {[0, 1, 2, 3].map((i) => (
                                            <Skeleton
                                                key={i}
                                                variant="rounded"
                                                height={72}
                                                sx={{borderRadius: 1.5}}
                                            />
                                        ))}
                                    </Box>
                                )}

                                {/* Empty State */}
                                {!tasksLoading && filteredTasks.length === 0 && (
                                    <Box display="flex" alignItems="center" justifyContent="center" p={3}>
                                        <InfoIcon sx={{mr: 1, color: 'text.disabled'}}/>
                                        <Typography color="text.secondary">
                                            No tasks match your filters
                                        </Typography>
                                    </Box>
                                )}

                                {/* Task List with Date Groups */}
                                {!tasksLoading && filteredTasks.length > 0 && (
                                    <List
                                        sx={{
                                            position: 'absolute',
                                            top: 0,
                                            bottom: 0,
                                            left: 0,
                                            right: 0,
                                            overflow: 'auto',
                                            m: 0,
                                            p: 0,
                                        }}
                                    >
                                        {taskGroups.map((group) => (
                                            <Box key={group.key}>
                                                {/* Group Sticky Header */}
                                                <Box
                                                    sx={{
                                                        position: 'sticky',
                                                        top: 0,
                                                        zIndex: 1,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 1,
                                                        px: 2,
                                                        py: 1,
                                                        bgcolor: 'background.default',
                                                        borderLeft: `4px solid ${group.accent}`,
                                                    }}
                                                >
                                                    <Typography
                                                        variant="subtitle2"
                                                        sx={{fontWeight: 600, color: 'text.primary'}}
                                                    >
                                                        {group.label}
                                                    </Typography>
                                                    <Box
                                                        sx={{
                                                            bgcolor: group.accent,
                                                            color: 'common.white',
                                                            borderRadius: 2.5,
                                                            px: 1,
                                                            py: 0.125,
                                                            fontSize: '0.75rem',
                                                            fontWeight: 600,
                                                            lineHeight: '18px',
                                                            minWidth: 20,
                                                            textAlign: 'center',
                                                        }}
                                                    >
                                                        {group.tasks.length}
                                                    </Box>
                                                </Box>

                                                {/* Group Tasks */}
                                                <Box sx={{px: 1, pb: 0.5}}>
                                                    {group.tasks.map((task) => {
                                                        const animIndex = globalTaskIndex++;
                                                        return (
                                                            <Box
                                                                key={task.id}
                                                                sx={{
                                                                    animation: `fadeInUp 200ms ease ${animIndex * 30}ms both`,
                                                                    mb: 0.5,
                                                                }}
                                                            >
                                                                <TaskItem
                                                                    task={task}
                                                                    config={{
                                                                        showJobId: true,
                                                                        showAssignee: true,
                                                                        showJobType: true,
                                                                        showDateTime: true,
                                                                        allowCompletion: true,
                                                                        showStatusIndicators: true,
                                                                        showOverdueWarning: true,
                                                                        onTaskClick: true,
                                                                    }}
                                                                    onTaskUpdated={() => refetchTasks()}
                                                                    onTaskClick={() => selectTaskForHistory(task)}
                                                                    tasksService={tasksServiceForComponents}
                                                                    dispatchService={dispatchServiceForComponents}
                                                                    showSuccessToast={showSuccessToast}
                                                                    showErrorToast={showErrorToast}
                                                                />
                                                            </Box>
                                                        );
                                                    })}
                                                </Box>
                                            </Box>
                                        ))}
                                    </List>
                                )}
                            </CardContent>
                        )}
                    </Card>
                </Box>

                {/* Right Panel: Job Details */}
                <Box sx={{flex: 9, minWidth: 0, display: 'flex', flexDirection: 'column'}}>
                    <Card variant="outlined"
                          sx={{flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
                        <Toolbar
                            variant="dense"
                            sx={{
                                bgcolor: 'background.paper',
                                color: 'text.primary',
                                borderBottom: '1px solid',
                                borderColor: 'divider',
                                minHeight: 44,
                                flexShrink: 0,
                            }}
                        >
                            <InfoIcon sx={{mr: 1}}/>
                            <Typography variant="subtitle1">
                                Job Details{selectedTask ? ` - Job #${selectedTask.jobId}` : ''}
                            </Typography>
                        </Toolbar>
                        <Box sx={{flex: 1, overflow: 'auto'}}>
                            <JobDetails
                                config={{
                                    jobId: selectedTask?.jobId,
                                    isRecurringJob: false,
                                    isBulkJob: false,
                                    isUsCustomer,
                                    showToast,
                                } satisfies MountJobDetailsConfig}
                            />
                        </Box>
                    </Card>
                </Box>
            </Box>
        </Box>
    );
};

export default TaskDashboardPage;
