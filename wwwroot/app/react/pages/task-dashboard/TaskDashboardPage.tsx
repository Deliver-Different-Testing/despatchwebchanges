/**
 * TaskDashboard Page Component
 *
 * A React implementation of the task dashboard with a "Refined Command Center" layout.
 * Features gradient stat cards, inline filters, date-grouped tasks, and a fixed two-column layout.
 * The job-detail-widget is rendered separately in the AngularJS template.
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
    ActionIcon,
    Badge,
    Box,
    Card,
    Drawer,
    Group,
    Popover,
    Select,
    Skeleton,
    Stack,
    Text,
    TextInput,
    VisuallyHidden,
    alpha,
    em,
} from '@mantine/core';
import {useMediaQuery} from '@mantine/hooks';
import {
    CalendarDays,
    Info,
    ListChecks,
    ListFilter,
    RefreshCw,
    Search,
    X,
} from 'lucide-react';
import {Icon} from '../../components/common/icon/Icon';
import classes from './TaskDashboardPage.module.css';
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
import {
    HeaderActionIcon,
    HeaderMenuButton,
    PANEL_CONTROL_GLYPH_SIZE,
} from '../../components/common/panel-controls';
import {SegmentedToggle} from '../../components/common/segmented-toggle';
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
import {
    
    formatUpdatedAgo,
    getRefreshIntervalOptions,
    loadRefreshIntervalMs,
} from './refreshIntervalOptions';
import {summarizeTaskDashboard} from '../../services/aiAssistantApi';
import {AiSummaryCard} from '../../components/common/ai-summary-card/AiSummaryCard';
import {useAiAutoOpen, useAiFeature} from '../../hooks/useAiFeature';

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

// Row cap for the dashboard's date window. Sent explicitly so the ceiling is a
// deliberate, visible choice rather than the server's silent default.
const TASK_LIST_LIMIT = 2000;

// Read the persisted auto-refresh interval as a React Query refetchInterval
// (ms; `false` = off). localStorage stores seconds (0 = off); an unset key falls
// back to DEFAULT_TASK_REFRESH_SECONDS.
const loadRefreshIntervalMsForUser = (): number | false =>
    loadRefreshIntervalMs(getRefreshIntervalKey());

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

/**
 * The accent colours for the queue's date groups. They are read into an inline
 * `border-left` string and a badge fill, so each has to be a value the browser
 * can resolve on its own — a Mantine colour *name* would survive neither.
 */
const STAT_COLORS = {
    primary: {main: 'var(--mantine-primary-color-filled)', dark: 'var(--mantine-primary-color-filled-hover)'},
    error: {main: 'var(--mantine-color-red-6)', dark: 'var(--mantine-color-red-8)'},
    secondary: {main: 'var(--mantine-color-grape-6)', dark: 'var(--mantine-color-grape-8)'},
    warning: {main: 'var(--mantine-color-yellow-6)', dark: 'var(--mantine-color-yellow-8)'},
    info: {main: 'var(--mantine-color-cyan-6)', dark: 'var(--mantine-color-cyan-8)'},
} as const;

/**
 * The queue buckets, in time-to-action order. These drive the status filter
 * under the panel header — the same shape dispatch's Tasks panel uses for its
 * filter chips, where the count is secondary copy beside the label rather than
 * a figure in its own right.
 */
const STATUS_BUCKETS: {status: StatusFilter; label: string; countKey?: keyof StatusCounts}[] = [
    {status: StatusFilter.All, label: 'All'},
    {status: StatusFilter.Overdue, label: 'Overdue', countKey: 'overdue'},
    {status: StatusFilter.DueToday, label: 'Today', countKey: 'dueToday'},
    {status: StatusFilter.Upcoming, label: 'Upcoming', countKey: 'upcoming'},
    {status: StatusFilter.Done, label: 'Done', countKey: 'done'},
];

export const TaskDashboardPage: React.FC<TaskDashboardPageProps> = ({
                                                                        showToast,
                                                                        isUsCustomer,
                                                                        setRefreshCallback,
                                                                    }) => {
    // Below `md` the fixed two-pane list-detail can't breathe; collapse to a
    // single pane and surface Job Details in a drawer instead.
    // `getInitialValueInEffect: false` reads matchMedia on the first render rather
    // than after an effect — without it the page mounts as two-pane and reflows to
    // the drawer layout a tick later. The hook can still return undefined, hence
    // the `?? false`.
    const isCompact = useMediaQuery(`(max-width: ${em(992)})`, false, {
        getInitialValueInEffect: false,
    }) ?? false;

    const aiBriefingsEnabled = useAiFeature('briefings');
    const aiAutoOpen = useAiAutoOpen();

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
    const [refreshIntervalMs, setRefreshIntervalMs] = useState<number | false>(loadRefreshIntervalMsForUser);
    const refreshOptions = useMemo(() => getRefreshIntervalOptions(), []);

    // Secondary filters (staff + task type) live behind a "Filters" popover to
    // keep the toolbar compact — mirrors the dispatch Tasks panel's control.
    const [filterOpen, setFilterOpen] = useState(false);

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
        filters.limit = TASK_LIST_LIMIT;

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
                accent: STAT_COLORS.secondary.main,
                accentText: STAT_COLORS.secondary.dark,
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
            {key: 'overdue', label: 'Overdue', accent: STAT_COLORS.error.main, accentText: STAT_COLORS.error.dark},
            {key: 'today', label: 'Today', accent: STAT_COLORS.primary.main, accentText: STAT_COLORS.primary.dark},
            {key: 'tomorrow', label: 'Tomorrow', accent: STAT_COLORS.warning.main, accentText: STAT_COLORS.warning.dark},
            {key: 'thisWeek', label: 'This Week', accent: STAT_COLORS.info.dark, accentText: STAT_COLORS.info.dark},
            {key: 'later', label: 'Later', accent: STAT_COLORS.secondary.main, accentText: STAT_COLORS.secondary.dark},
        ];

        return definitions
            .filter(d => groups[d.key].length > 0)
            .map(d => ({...d, tasks: groups[d.key]}));
    }, [filteredTasks, statusFilter]);

    // Handle view mode change
    const handleViewModeChange = useCallback((newView: string) => {
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
    // The control is a radio group, so a bucket is chosen rather than toggled —
    // clearing is the explicit "All" option instead of re-clicking the active one.
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
        <Box style={{flex: 1, overflow: 'auto'}}>
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

    // The panel bar's controls: the view toggle, the filters popover and refresh.
    // They live in PanelHeader's action slot rather than in a bar of their own —
    // dispatch puts a panel's configuration on that panel's header, so the page
    // has one 32px control band instead of two competing rows.
    const panelControls = (
        <>
            {/* List + Calendar only. A kanban board isn't offered because tasks here
                are binary (to-do / done), not a multi-stage pipeline — columns would
                carry no meaning. List is the triage view; Calendar is for scheduling. */}
            <SegmentedToggle<'list' | 'calendar'>
                aria-label="View"
                value={showFullCalendar ? 'calendar' : 'list'}
                onChange={handleViewModeChange}
                data={[
                    {value: 'list', label: 'List', icon: <Icon lucide={ListChecks} size={PANEL_CONTROL_GLYPH_SIZE}/>},
                    {value: 'calendar', label: 'Calendar', icon: <Icon lucide={CalendarDays} size={PANEL_CONTROL_GLYPH_SIZE}/>},
                ]}
            />
            <Popover
                opened={filterOpen}
                onChange={setFilterOpen}
                position="bottom-end"
                shadow="md"
                withinPortal
            >
                <Popover.Target>
                    <HeaderMenuButton
                        icon={<Icon lucide={ListFilter} size={PANEL_CONTROL_GLYPH_SIZE}/>}
                        opened={filterOpen}
                        onClick={() => setFilterOpen(o => !o)}
                    >
                        {activeFilterCount ? `Filters (${activeFilterCount})` : 'Filters'}
                    </HeaderMenuButton>
                </Popover.Target>
                <Popover.Dropdown>
                    <Stack gap="md" miw={260}>
                        <Select
                            size="sm"
                            label="Staff"
                            value={staffFilter}
                            onChange={(value) => setStaffFilter(value ?? 'all')}
                            allowDeselect={false}
                            comboboxProps={{keepMounted: false}}
                            data={[
                                {value: 'all', label: 'All staff'},
                                ...staffList.map((staff) => ({
                                    value: staff.id.toString(),
                                    label: staff.text,
                                })),
                            ]}
                        />
                        <Select
                            size="sm"
                            label="Type"
                            value={eventTypeFilter}
                            onChange={(value) => setEventTypeFilter(value ?? 'all')}
                            allowDeselect={false}
                            comboboxProps={{keepMounted: false}}
                            data={[
                                {value: 'all', label: 'All types'},
                                ...eventTypesList.map((eventType) => ({
                                    value: eventType.id.toString(),
                                    label: eventType.text,
                                })),
                            ]}
                        />
                        <Select
                            size="sm"
                            label="Auto-refresh"
                            value={String(refreshIntervalMs === false ? 0 : refreshIntervalMs / 1000)}
                            onChange={(value) => handleSelectRefreshInterval(Number(value ?? 0))}
                            allowDeselect={false}
                            comboboxProps={{keepMounted: false}}
                            data={refreshOptions.map((option) => ({
                                value: String(option.seconds),
                                label: option.label,
                            }))}
                        />
                    </Stack>
                </Popover.Dropdown>
            </Popover>
            <HeaderActionIcon
                label="Refresh tasks"
                onClick={() => refetchTasks()}
                disabled={tasksFetching}
            >
                <Icon lucide={RefreshCw} size={PANEL_CONTROL_GLYPH_SIZE}/>
            </HeaderActionIcon>
        </>
    );

    return (
        <Stack
            gap={16}
            h="100%"
            p={{base: 12, md: 16}}
            bg="var(--mantine-color-body)"
        >
            {/* Screen-reader announcement of the current bucket counts, updated
                whenever they change (e.g. after an auto-refresh). */}
            <VisuallyHidden component="p" aria-live="polite">
                {`${statusCounts.overdue} overdue, ${statusCounts.dueToday} due today, ${statusCounts.upcoming} upcoming, ${statusCounts.done} done`}
            </VisuallyHidden>
            {/* AI Briefing — collapsible so the task queue leads the scan.
                Starts collapsed (deferring the fetch) unless the user has opted
                into "open automatically" via their Auto-mate settings. */}
            {aiBriefingsEnabled && !tasksLoading && tasks.length > 0 && (
                <Box style={{flexShrink: 0}}>
                    <AiSummaryCard
                        title="Auto-mate Daily Briefing"
                        fetchSummary={(signal) => summarizeTaskDashboard({signal})}
                        collapsible
                        autoOpen={aiAutoOpen}
                    />
                </Box>
            )}
            {/* Main Content — adaptive list-detail (two-pane ≥ md, single pane + drawer below) */}
            <Group gap={16} align="stretch" wrap="nowrap" style={{flex: 1, minHeight: 0}}>
                {/* Left Panel: Tasks or Calendar */}
                <Stack gap={0} miw={0} style={{flex: isCompact ? 1 : '1 1 56%'}}>
                    <Card
                        withBorder
                        p={0}
                        style={{flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden'}}
                    >
                        <PanelHeader
                            icon={<Icon lucide={showFullCalendar ? CalendarDays : ListChecks}/>}
                            title={showFullCalendar ? 'Calendar' : 'Tasks'}
                            count={showFullCalendar ? undefined : filteredTasks.length}
                            action={panelControls}
                        />

                        {/*
                          * The queue's own controls, on the same 32px band as the header
                          * above them: which bucket, and free-text within it. The status
                          * filter is a SegmentedToggle rather than a row of stat tiles —
                          * it is a pick-exactly-one control, which is what that grammar
                          * is for, and the count reads as secondary copy beside each
                          * label the way dispatch's filter chips do.
                          */}
                        <Group
                            gap="sm"
                            px="md"
                            py="xs"
                            wrap="nowrap"
                            style={{
                                flexShrink: 0,
                                borderBottom: '1px solid var(--mantine-color-default-border)',
                            }}
                        >
                            <SegmentedToggle<StatusFilter>
                                aria-label="Task status"
                                value={statusFilter}
                                onChange={handleStatusFilterChange}
                                data={STATUS_BUCKETS.map((bucket) => {
                                    const count = bucket.countKey ? statusCounts[bucket.countKey] : undefined;
                                    // Overdue stays the North Star: it carries a red
                                    // badge while it has work and reads like any other
                                    // bucket when it is clear.
                                    const loud = bucket.status === StatusFilter.Overdue && (count ?? 0) > 0;
                                    return {
                                        value: bucket.status,
                                        label: (
                                            <Group gap={6} wrap="nowrap">
                                                <span>{bucket.label}</span>
                                                {count == null ? null : loud ? (
                                                    <Badge size="xs" color="red" circle>
                                                        {count}
                                                    </Badge>
                                                ) : (
                                                    <Text component="span" size="sm" fw={400} c="dimmed">
                                                        ({count})
                                                    </Text>
                                                )}
                                            </Group>
                                        ),
                                    };
                                })}
                            />
                            <div style={{flex: 1}}/>
                            {freshnessLabel && (
                                <Text size="xs" c="dimmed" style={{whiteSpace: 'nowrap'}}>
                                    {freshnessLabel}
                                </Text>
                            )}
                            <TextInput
                                size="xs"
                                w={200}
                                placeholder="Search tasks"
                                aria-label="Search tasks"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.currentTarget.value)}
                                leftSection={<Icon lucide={Search} size={PANEL_CONTROL_GLYPH_SIZE}/>}
                            />
                        </Group>

                        {showFullCalendar ? (
                            <Box style={{flex: 1, overflow: 'hidden'}}>
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
                            <Box style={{flex: 1, overflow: 'hidden', position: 'relative'}}>
                                {/* Skeleton Loading */}
                                {tasksLoading && (
                                    <Stack p={16} gap={8}>
                                        {[0, 1, 2, 3].map((i) => (
                                            <Skeleton
                                                key={i}
                                                data-testid="task-skeleton"
                                                height={72}
                                                radius={12}
                                            />
                                        ))}
                                    </Stack>
                                )}

                                {/* Empty State */}
                                {!tasksLoading && filteredTasks.length === 0 && (
                                    <NoData
                                        title="No tasks"
                                        message="No tasks match your filters"
                                        icon={<Icon lucide={ListChecks}/>}
                                    />
                                )}

                                {/* Task List with Date Groups */}
                                {!tasksLoading && filteredTasks.length > 0 && (
                                    <Box
                                        component="ul"
                                        m={0}
                                        p={0}
                                        style={{
                                            position: 'absolute',
                                            inset: 0,
                                            overflow: 'auto',
                                            listStyle: 'none',
                                        }}
                                    >
                                        {taskGroups.map((group) => (
                                            <Box key={group.key}>
                                                {/* Group Sticky Header */}
                                                <Group
                                                    gap={8}
                                                    px={16}
                                                    py={8}
                                                    wrap="nowrap"
                                                    bg="var(--mantine-color-body)"
                                                    style={{
                                                        position: 'sticky',
                                                        top: 0,
                                                        zIndex: 1,
                                                        borderLeft: `4px solid ${group.accent}`,
                                                    }}
                                                >
                                                    <Text fz="sm" fw={600}>
                                                        {group.label}
                                                    </Text>
                                                    <Badge
                                                        h={20}
                                                        px={8}
                                                        fw={700}
                                                        tt="none"
                                                        style={{
                                                            backgroundColor: alpha(group.accent, 0.16),
                                                            color: group.accentText,
                                                        }}
                                                    >
                                                        {group.tasks.length}
                                                    </Badge>
                                                </Group>

                                                {/* Group Tasks */}
                                                <Box px={8} pb={4}>
                                                    {group.tasks.map((task) => {
                                                        const animIndex = globalTaskIndex++;
                                                        return (
                                                            <Box
                                                                key={task.id}
                                                                component="li"
                                                                className={`${classes.taskRow}${animateEntrance ? ` ${classes.taskRowAnimated}` : ''}`}
                                                                style={{
                                                                    '--task-row-delay': `${Math.min(animIndex, 12) * 30}ms`,
                                                                } as React.CSSProperties}
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
                                    </Box>
                                )}
                            </Box>
                        )}
                    </Card>
                </Stack>

                {/* Right Panel: Job Details — side pane at ≥ md */}
                {!isCompact && (
                    <Stack gap={0} miw={0} style={{flex: '1 1 44%'}}>
                        <Card
                            withBorder
                            p={0}
                            style={{flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden'}}
                        >
                            <PanelHeader icon={<Icon lucide={Info}/>} title={jobDetailsTitle} />
                            {jobDetailsBody}
                        </Card>
                    </Stack>
                )}
            </Group>

            {/* Job Details — drawer below md, so the list gets the full width */}
            <Drawer
                position="right"
                opened={isCompact && Boolean(selectedTask)}
                onClose={() => setSelectedTask(undefined)}
                withCloseButton={false}
                padding={0}
                size={460}
                // The MUI original was width {xs: '100%', sm: 460}. Mantine's `size`
                // takes no responsive object, so maxWidth does the clamping below 460.
                styles={{content: {display: 'flex', flexDirection: 'column', maxWidth: '100%'}}}
            >
                <PanelHeader
                    icon={<Icon lucide={Info}/>}
                    title={jobDetailsTitle}
                    action={
                        <ActionIcon
                            variant="subtle"
                            color="gray"
                            onClick={() => setSelectedTask(undefined)}
                            aria-label="Close job details"
                        >
                            <Icon lucide={X}/>
                        </ActionIcon>
                    }
                />
                {isCompact && jobDetailsBody}
            </Drawer>
        </Stack>
    );
};

export default TaskDashboardPage;
