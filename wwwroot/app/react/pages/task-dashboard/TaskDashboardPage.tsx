/**
 * TaskDashboard Page Component
 *
 * A React implementation of the task dashboard with a "Refined Command Center" layout.
 * Features gradient stat cards, inline filters, date-grouped tasks, and a fixed two-column layout.
 * The job-detail-widget is rendered separately in the AngularJS template.
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Drawer from '@mui/material/Drawer';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import List from '@mui/material/List';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Popover from '@mui/material/Popover';
import Select from '@mui/material/Select';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import {visuallyHidden} from '@mui/utils';
import {alpha, useTheme} from '@mui/material/styles';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CheckIcon from '@mui/icons-material/Check';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import InfoIcon from '@mui/icons-material/Info';
import SearchIcon from '@mui/icons-material/Search';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import TodayIcon from '@mui/icons-material/Today';
import UpcomingIcon from '@mui/icons-material/Upcoming';
import ViewListIcon from '@mui/icons-material/ViewList';
import WarningIcon from '@mui/icons-material/Warning';
import dayjs, {Dayjs} from 'dayjs';
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
import {PanelHeader} from '../../components/common/panel-header';
import {NoData} from '../../components/common/no-data/NoData';
import {formatDateForApi} from '../../utils/dateUtils';
import {
    useActiveStaff,
    useEventTypes,
    useMarkTaskAsClosed,
    useReassignTask,
    useUnassignTask,
    useTasks,
    useUpdateTaskDate,
    useUpdateTaskTime,
} from '../../hooks/useTasksApi';
import {tasksApi} from '../../services/tasksApi';
import {getCurrentUserId} from '../../services/tasksService';
import {formatRefreshButtonLabel, formatUpdatedAgo, getRefreshIntervalOptions} from './refreshIntervalOptions';
import {summarizeTaskDashboard} from '../../services/aiAssistantApi';
import {AiSummaryCard} from '../../components/common/ai-summary-card/AiSummaryCard';
import {isAiEnabled, isAiAutoOpenEnabled} from '../../../functions/aiSettings';

// Local storage keys
const getViewPreferenceKey = () => {
    const contactId = window.ContactID || 0;
    return `taskDashboardViewPreference-${contactId}`;
};

const getDateFilterKey = () => {
    const contactId = window.ContactID || 0;
    return `dateFilter-task-dashboard-${contactId}`;
};

const getRefreshIntervalKey = () => {
    const contactId = window.ContactID || 0;
    return `taskDashboardRefreshInterval-${contactId}`;
};

// Read the persisted auto-refresh interval as a React Query refetchInterval
// (ms; `false` = off). localStorage stores seconds (0 = off).
const loadRefreshIntervalMs = (): number | false => {
    try {
        const raw = localStorage.getItem(getRefreshIntervalKey());
        const seconds = raw == null ? 0 : parseInt(raw, 10);
        return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : false;
    } catch {
        return false;
    }
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
    /** Saturated accent for the sticky-header left border. */
    accent: string;
    /** Dark on-color for the tonal count badge (AA-safe on the tinted fill). */
    accentText: string;
    tasks: ExtendedTask[];
}

// Stat card definition — a filter chip that mirrors a queue bucket.
interface StatCardDef {
    status: StatusFilter;
    label: string;
    countKey: keyof StatusCounts;
    color: 'primary' | 'error' | 'success' | 'secondary';
    icon: React.ReactNode;
    /** Overdue is the North Star: rendered loud (solid fill) whenever it carries
     *  work, and calm/tonal when it's zero. Emphasis is by colour, not size. */
    emphasis?: boolean;
}

// Ordered by time-to-action so the top-left (golden-triangle) card is the most
// actionable. Labels match the queue's date-group headers one-to-one.
const STAT_CARDS: StatCardDef[] = [
    {
        status: StatusFilter.Overdue,
        label: 'OVERDUE',
        countKey: 'overdue',
        color: 'error',
        icon: <WarningIcon sx={{fontSize: 20, opacity: 0.8}}/>,
        emphasis: true,
    },
    {
        status: StatusFilter.DueToday,
        label: 'TODAY',
        countKey: 'dueToday',
        color: 'primary',
        icon: <TodayIcon sx={{fontSize: 20, opacity: 0.8}}/>,
    },
    {
        status: StatusFilter.Upcoming,
        label: 'UPCOMING',
        countKey: 'upcoming',
        color: 'secondary',
        icon: <UpcomingIcon sx={{fontSize: 20, opacity: 0.8}}/>,
    },
    {
        status: StatusFilter.Done,
        label: 'DONE',
        countKey: 'done',
        color: 'success',
        icon: <CheckCircleIcon sx={{fontSize: 20, opacity: 0.8}}/>,
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

    // Below `md` the fixed two-pane list-detail can't breathe; collapse to a
    // single pane and surface Job Details in a drawer instead.
    const isCompact = useMediaQuery(theme.breakpoints.down('md'));

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

    // Auto-refresh interval (ms; false = off), seeded from localStorage. Applied
    // as the React Query refetchInterval on the tasks list and configured via the
    // toolbar menu. Independent of the dispatch page's refresh setting.
    const [refreshIntervalMs, setRefreshIntervalMs] = useState<number | false>(loadRefreshIntervalMs);
    const [refreshAnchor, setRefreshAnchor] = useState<HTMLElement | null>(null);
    const refreshOptions = useMemo(() => getRefreshIntervalOptions(), []);

    // Secondary filters (staff + task type) live behind a "Filters" popover to
    // keep the toolbar compact — mirrors the dispatch Tasks panel's control.
    const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);

    // Ticking clock so the "Updated Ns ago" freshness label stays current
    // between refetches without re-rendering the whole tree on every second.
    const [nowTick, setNowTick] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNowTick(Date.now()), 15000);
        return () => clearInterval(id);
    }, []);

    const handleSelectRefreshInterval = useCallback((seconds: number) => {
        setRefreshIntervalMs(seconds > 0 ? seconds * 1000 : false);
        try {
            localStorage.setItem(getRefreshIntervalKey(), String(seconds));
        } catch {
            // Ignore localStorage errors (private mode / quota)
        }
        setRefreshAnchor(null);
    }, []);

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
        isFetching: tasksFetching,
        dataUpdatedAt,
        refetch: refetchTasks,
    } = useTasks(taskFilters, {refetchInterval: refreshIntervalMs});

    const {data: staffList = []} = useActiveStaff();
    const {data: eventTypesList = []} = useEventTypes();

    // Mutation hooks
    const markTaskAsClosedMutation = useMarkTaskAsClosed();
    const updateTaskDateMutation = useUpdateTaskDate();
    const updateTaskTimeMutation = useUpdateTaskTime();
    const reassignTaskMutation = useReassignTask();
    const unassignTaskMutation = useUnassignTask();

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

    // Open, not-yet-overdue, and due before the end of today.
    const isTaskDueToday = useCallback((task: ExtendedTask): boolean => {
        if (task.closed || isTaskOverdue(task)) return false;
        return !task.dueDate.isAfter(dayjs().endOf('day'));
    }, [isTaskOverdue]);

    // Apply the time-to-action filter. `All` is all active work; the four cards
    // each narrow to one bucket, and `Upcoming` is everything beyond today.
    const filteredTasks = useMemo(() => {
        switch (statusFilter) {
            case StatusFilter.All:
                return tasks.filter(task => !task.closed);
            case StatusFilter.Overdue:
                return tasks.filter(task => isTaskOverdue(task));
            case StatusFilter.DueToday:
                return tasks.filter(task => isTaskDueToday(task));
            case StatusFilter.Upcoming:
                return tasks.filter(task => !task.closed && !isTaskOverdue(task) && !isTaskDueToday(task));
            case StatusFilter.Done:
                return tasks.filter(task => task.closed);
            default:
                return [...tasks];
        }
    }, [tasks, statusFilter, isTaskOverdue, isTaskDueToday]);

    // Counts for the stat cards — the same buckets as the filter above.
    const statusCounts = useMemo((): StatusCounts => {
        let overdue = 0, dueToday = 0, upcoming = 0, done = 0;

        for (const task of tasks) {
            if (task.closed) {
                done++;
            } else if (isTaskOverdue(task)) {
                overdue++;
            } else if (isTaskDueToday(task)) {
                dueToday++;
            } else {
                upcoming++;
            }
        }

        return {overdue, dueToday, upcoming, done};
    }, [tasks, isTaskOverdue, isTaskDueToday]);

    // Group tasks by date bucket
    const taskGroups = useMemo((): TaskGroup[] => {
        // For Done filter, render a flat list
        if (statusFilter === StatusFilter.Done) {
            if (filteredTasks.length === 0) return [];
            return [{
                key: 'completed',
                label: 'Completed',
                accent: theme.palette.secondary.main,
                accentText: theme.palette.secondary.dark,
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

        const definitions: Array<{ key: string; label: string; accent: string; accentText: string }> = [
            {key: 'overdue', label: 'Overdue', accent: theme.palette.error.main, accentText: theme.palette.error.dark},
            {key: 'today', label: 'Today', accent: theme.palette.primary.main, accentText: theme.palette.primary.dark},
            {key: 'tomorrow', label: 'Tomorrow', accent: theme.palette.warning.main, accentText: theme.palette.warning.dark},
            {key: 'thisWeek', label: 'This Week', accent: theme.palette.info.dark, accentText: theme.palette.info.dark},
            {key: 'later', label: 'Later', accent: theme.palette.secondary.main, accentText: theme.palette.secondary.dark},
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

    // Toggle the bucket filter: clicking the active card returns to All (all
    // active work), so the four cards behave like a filter-chip group.
    const handleStatusFilterChange = useCallback(async (newStatus: StatusFilter) => {
        setStatusFilter(prev => (prev === newStatus ? StatusFilter.All : newStatus));

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
        unassignTask: async (eventId: number) => {
            await unassignTaskMutation.mutateAsync({eventId});
        },
    }), [markTaskAsClosedMutation, updateTaskDateMutation, updateTaskTimeMutation, reassignTaskMutation, unassignTaskMutation]);

    // Create a dispatch service interface for child components
    const dispatchServiceForComponents = useMemo(() => ({
        getActiveStaff: () => tasksApi.getActiveStaff(),
        getDeliveryJourney: (jobId: number) => tasksApi.getDeliveryJourney(jobId),
    }), []);

    // Freshness + sync state for the toolbar. While a fetch is in flight we say
    // so; otherwise we show how stale the last successful load is.
    const freshnessLabel = tasksFetching ? 'Updating…' : formatUpdatedAgo(dataUpdatedAt, nowTick);

    // Count of active secondary filters, surfaced on the Filters button.
    const activeFilterCount = (staffFilter !== 'all' ? 1 : 0) + (eventTypeFilter !== 'all' ? 1 : 0);

    // Only play the entrance stagger when the *view intent* changes (first load,
    // status/view toggle, or a filter change) — never on a background refetch,
    // so an auto-refresh doesn't re-animate the whole queue.
    const viewSignature = `${statusFilter}|${showFullCalendar}|${searchQuery}|${staffFilter}|${eventTypeFilter}`;
    const prevViewSignatureRef = useRef<string | null>(null);
    const animateEntrance = prevViewSignatureRef.current !== viewSignature;
    useEffect(() => {
        prevViewSignatureRef.current = viewSignature;
    });

    // Track cumulative task index for staggered animation across groups
    let globalTaskIndex = 0;

    // Job Details panel content — shared between the side pane (≥ md) and the
    // drawer (< md); only one is mounted at a time via the isCompact guards.
    const jobDetailsTitle = selectedTask ? `Job Details - Job #${selectedTask.jobId}` : 'Job Details';
    const jobDetailsBody = (
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
    );

    return (
        <Box sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            px: {xs: 2, md: 3},
            pt: {xs: 2, md: 3},
            pb: {xs: 1.5, md: 2},
            bgcolor: 'background.default',
        }}>
            {/* Inject animation keyframes */}
            <style>{fadeInUpKeyframes}</style>
            {/* Stat Cards Row */}
            <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 1.5, flexShrink: 0}}>
                {STAT_CARDS.map((card) => {
                    const isSelected = statusFilter === card.status;
                    const count = statusCounts[card.countKey];
                    // Overdue is the North Star: loud (solid fill, bigger number)
                    // whenever it carries work, calm/tonal when it's zero so a
                    // clear board doesn't read as an alarm.
                    const loud = (card.emphasis === true && count > 0) || isSelected;
                    return (
                        <Card
                            key={card.status}
                            role="button"
                            tabIndex={0}
                            aria-label={`${card.label}: ${count}`}
                            aria-pressed={isSelected}
                            onClick={() => handleStatusFilterChange(card.status)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    return handleStatusFilterChange(card.status);
                                }
                            }}
                            elevation={0}
                            sx={(t) => {
                                // MD3: quiet cards are tonal containers (12% tint +
                                // dark on-color); a "loud" card (Overdue-with-work
                                // or the active filter) is the solid fill. Weight,
                                // not opacity, carries emphasis; a ring marks the
                                // selected card even when it's already loud.
                                const main = t.palette[card.color].main;
                                return {
                                    flex: '1 1 0',
                                    minWidth: 128,
                                    py: 1,
                                    px: 1.5,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 1,
                                    border: '1px solid',
                                    bgcolor: loud ? main : alpha(main, 0.12),
                                    borderColor: loud ? main : alpha(main, 0.24),
                                    color: loud ? t.palette[card.color].contrastText : t.palette[card.color].dark,
                                    boxShadow: isSelected ? 3 : (loud ? 1 : 'none'),
                                    outline: isSelected ? '2px solid' : 'none',
                                    outlineColor: isSelected ? main : 'transparent',
                                    outlineOffset: 2,
                                    transition: `background-color ${t.transitions.duration.short}ms cubic-bezier(0.2, 0, 0, 1), border-color ${t.transitions.duration.short}ms cubic-bezier(0.2, 0, 0, 1)`,
                                    '&:hover': {
                                        bgcolor: loud ? main : alpha(main, 0.2),
                                    },
                                    '&:focus-visible': {
                                        outline: '2px solid',
                                        outlineColor: main,
                                        outlineOffset: 2,
                                    },
                                    '@media (prefers-reduced-motion: reduce)': {transition: 'none'},
                                };
                            }}
                        >
                            <Box sx={{minWidth: 0}}>
                                <Typography
                                    component="div"
                                    sx={{fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.15}}
                                >
                                    {count}
                                </Typography>
                                <Typography
                                    variant="labelSmall"
                                    component="div"
                                    noWrap
                                    sx={{letterSpacing: '0.06em', opacity: 0.85}}
                                >
                                    {card.label}
                                </Typography>
                            </Box>
                            {card.icon}
                        </Card>
                    );
                })}
            </Box>
            {/* Screen-reader announcement of the current bucket counts, updated
                whenever they change (e.g. after an auto-refresh). */}
            <Box component="p" aria-live="polite" sx={visuallyHidden}>
                {`${statusCounts.overdue} overdue, ${statusCounts.dueToday} due today, ${statusCounts.upcoming} upcoming, ${statusCounts.done} done`}
            </Box>
            {/* Inline Filter Bar */}
            <Card variant="outlined" sx={{mb: 2, flexShrink: 0}}>
                <CardContent sx={{py: 1.5, '&:last-child': {pb: 1.5}}}>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 2,
                            flexWrap: "wrap"
                        }}>
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

                        <Button
                            size="small"
                            variant="outlined"
                            color="inherit"
                            startIcon={<FilterListIcon/>}
                            endIcon={<ArrowDropDownIcon/>}
                            onClick={(e) => setFilterAnchor(e.currentTarget)}
                            aria-haspopup="true"
                            aria-expanded={filterAnchor ? 'true' : undefined}
                            sx={{textTransform: 'none', borderColor: 'divider', color: 'text.secondary'}}
                        >
                            {activeFilterCount ? `Filters (${activeFilterCount})` : 'Filters'}
                        </Button>
                        <Popover
                            open={Boolean(filterAnchor)}
                            anchorEl={filterAnchor}
                            onClose={() => setFilterAnchor(null)}
                            anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
                            transformOrigin={{vertical: 'top', horizontal: 'left'}}
                        >
                            <Box sx={{p: 2, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 260}}>
                                <FormControl size="small" fullWidth>
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
                                <FormControl size="small" fullWidth>
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
                            </Box>
                        </Popover>

                        <Box sx={{flex: 1}}/>

                        {freshnessLabel && (
                            <Typography
                                variant="caption"
                                sx={{color: 'text.secondary', whiteSpace: 'nowrap'}}
                            >
                                {freshnessLabel}
                            </Typography>
                        )}

                        <Button
                            size="small"
                            variant="outlined"
                            color="inherit"
                            startIcon={<AutorenewIcon/>}
                            endIcon={<ArrowDropDownIcon/>}
                            onClick={(e) => setRefreshAnchor(e.currentTarget)}
                            aria-haspopup="true"
                            aria-expanded={refreshAnchor ? 'true' : undefined}
                            sx={{textTransform: 'none', borderColor: 'divider', color: 'text.secondary'}}
                        >
                            {formatRefreshButtonLabel(refreshIntervalMs)}
                        </Button>
                        <Menu
                            anchorEl={refreshAnchor}
                            open={Boolean(refreshAnchor)}
                            onClose={() => setRefreshAnchor(null)}
                            anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
                            transformOrigin={{vertical: 'top', horizontal: 'right'}}
                            slotProps={{paper: {sx: {maxHeight: 300}}}}
                        >
                            {refreshOptions.map((option) => {
                                const optionMs = option.seconds > 0 ? option.seconds * 1000 : false;
                                const selected = optionMs === refreshIntervalMs;
                                return (
                                    <MenuItem
                                        key={option.seconds}
                                        selected={selected}
                                        onClick={() => handleSelectRefreshInterval(option.seconds)}
                                    >
                                        <ListItemIcon>
                                            {selected && <CheckIcon fontSize="small"/>}
                                        </ListItemIcon>
                                        <ListItemText>{option.label}</ListItemText>
                                    </MenuItem>
                                );
                            })}
                        </Menu>

                        {/* List + Calendar only. A kanban board isn't offered
                            because tasks here are binary (to-do / done), not a
                            multi-stage pipeline — columns would carry no meaning.
                            List is the triage view; Calendar is for scheduling. */}
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
            {/* AI Briefing — collapsible so the task queue leads the scan.
                Starts collapsed (deferring the fetch) unless the user has opted
                into "open automatically" via their Auto-mate settings. */}
            {isAiEnabled() && !tasksLoading && tasks.length > 0 && (
                <Box sx={{mb: 2, flexShrink: 0}}>
                    <AiSummaryCard
                        title="Auto-mate Daily Briefing"
                        fetchSummary={(signal) => summarizeTaskDashboard({signal})}
                        collapsible
                        autoOpen={isAiAutoOpenEnabled()}
                    />
                </Box>
            )}
            {/* Main Content — adaptive list-detail (two-pane ≥ md, single pane + drawer below) */}
            <Box sx={{flex: 1, display: 'flex', gap: 2, minHeight: 0}}>
                {/* Left Panel: Tasks or Calendar */}
                <Box sx={{flex: isCompact ? 1 : '1 1 56%', minWidth: 0, display: 'flex', flexDirection: 'column'}}>
                    <Card variant="outlined"
                          sx={{flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
                        {showFullCalendar ? (
                            <PanelHeader icon={<CalendarMonthIcon />} title="Calendar" />
                        ) : (
                            <PanelHeader
                                icon={<TaskAltIcon />}
                                title="Tasks"
                                count={filteredTasks.length}
                            />
                        )}

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
                                    <NoData
                                        title="No tasks"
                                        message="No tasks match your filters"
                                        icon={<TaskAltIcon/>}
                                    />
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
                                                    <Chip
                                                        label={group.tasks.length}
                                                        size="small"
                                                        sx={{
                                                            height: 20,
                                                            fontWeight: 700,
                                                            bgcolor: alpha(group.accent, 0.16),
                                                            color: group.accentText,
                                                            '& .MuiChip-label': {px: 1},
                                                        }}
                                                    />
                                                </Box>

                                                {/* Group Tasks */}
                                                <Box sx={{px: 1, pb: 0.5}}>
                                                    {group.tasks.map((task) => {
                                                        const animIndex = globalTaskIndex++;
                                                        return (
                                                            <Box
                                                                key={task.id}
                                                                component="li"
                                                                sx={{
                                                                    animation: animateEntrance
                                                                        ? `fadeInUp 200ms cubic-bezier(0.2, 0, 0, 1) ${Math.min(animIndex, 12) * 30}ms both`
                                                                        : 'none',
                                                                    '@media (prefers-reduced-motion: reduce)': {animation: 'none'},
                                                                    mb: 0.5,
                                                                    listStyle: 'none',
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
                                                                        autoAssignOnClick: true,
                                                                    }}
                                                                    currentUserId={getCurrentUserId()}
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

                {/* Right Panel: Job Details — side pane at ≥ md */}
                {!isCompact && (
                    <Box sx={{flex: '1 1 44%', minWidth: 0, display: 'flex', flexDirection: 'column'}}>
                        <Card variant="outlined"
                              sx={{flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
                            <PanelHeader icon={<InfoIcon />} title={jobDetailsTitle} />
                            {jobDetailsBody}
                        </Card>
                    </Box>
                )}
            </Box>

            {/* Job Details — drawer below md, so the list gets the full width */}
            <Drawer
                anchor="right"
                open={isCompact && Boolean(selectedTask)}
                onClose={() => setSelectedTask(undefined)}
                slotProps={{
                    paper: {
                        sx: {
                            width: {xs: '100%', sm: 460},
                            maxWidth: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                        },
                    },
                }}
            >
                <PanelHeader
                    icon={<InfoIcon />}
                    title={jobDetailsTitle}
                    action={
                        <IconButton
                            onClick={() => setSelectedTask(undefined)}
                            aria-label="Close job details"
                            sx={{color: 'inherit'}}
                        >
                            <CloseIcon />
                        </IconButton>
                    }
                />
                {isCompact && jobDetailsBody}
            </Drawer>
        </Box>
    );
};

export default TaskDashboardPage;
