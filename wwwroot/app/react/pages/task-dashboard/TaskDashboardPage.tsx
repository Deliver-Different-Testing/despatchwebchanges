/**
 * TaskDashboard Page Component
 *
 * A React implementation of the task dashboard, managing tasks in list and calendar views.
 * Features customizable, resizable grid layout using react-grid-layout.
 * The job-detail-widget is rendered separately in the AngularJS template.
 */

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
    Box,
    Card,
    CardContent,
    CircularProgress,
    Divider,
    FormControl,
    IconButton,
    InputAdornment,
    InputLabel,
    List,
    MenuItem,
    Select,
    Switch,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Toolbar,
    Tooltip,
    Typography,
} from '@mui/material';
import {
    CalendarMonth as CalendarMonthIcon,
    CheckCircle as CheckCircleIcon,
    DragIndicator as DragIndicatorIcon,
    Info as InfoIcon,
    Lock as LockIcon,
    LockOpen as LockOpenIcon,
    PendingActions as PendingActionsIcon,
    RestartAlt as RestartAltIcon,
    RocketLaunch as RocketLaunchIcon,
    Search as SearchIcon,
    TaskAlt as TaskAltIcon,
    Tune as TuneIcon,
    ViewList as ViewListIcon,
    Warning as WarningIcon,
} from '@mui/icons-material';
import type {Layout} from 'react-grid-layout';
import {ResponsiveGridLayout, useContainerWidth} from 'react-grid-layout';
import dayjs from 'dayjs';

// Import react-grid-layout styles
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import {
    DashboardLayouts,
    DashboardWidget,
    DateFilterData,
    ExtendedTask,
    SavedLayout,
    SavedLayoutsState,
    StatusCounts,
    StatusFilter,
    TaskDashboardPageProps,
    ViewMode,
} from './TaskDashboardPage.interfaces';
import {SaveLayoutDialog} from './SaveLayoutDialog';
import {TaskFiltersRequest} from '../../interfaces';
import {TaskItem} from '../../components/common/task-item/TaskItem';
import {TaskCalendarView} from '../../components/common/task-calendar-view/TaskCalendarView';
import {TaskHistory} from '../../components/common/task-history/TaskHistory';
import {formatDateForApi} from '../../utils/dateUtils';
import DensityMode from '../../../enums/densityMode';
import {
    useActiveStaff,
    useEventTypes,
    useMarkTaskAsClosed,
    useReassignTask,
    useTasks,
    useUpdateTaskDate,
    useUpdateTaskTime,
} from '../../hooks';
import {tasksApi} from '../../services/tasksApi';
import {summarizeTaskDashboard} from '../../services/aiAssistantApi';
import {AiSummaryPanel} from '../../components/common/ai-summary-panel/AiSummaryPanel';

// Local storage keys
const getViewPreferenceKey = () => {
    const contactId = (window as any).ContactID || 0;
    return `taskDashboardViewPreference-${contactId}`;
};

const getDateFilterKey = () => {
    const contactId = (window as any).ContactID || 0;
    return `dateFilter-task-dashboard-${contactId}`;
};

const getSavedLayoutsKey = () => {
    const contactId = (window as any).ContactID || 0;
    return `taskDashboardSavedLayouts-${contactId}`;
};

const DEFAULT_LAYOUT_NAME = 'Default';

// Helper to set default date filter
const setDateFilterDefaults = (): DateFilterData => ({
    startDate: dayjs().subtract(1, 'day').startOf('day'),
    endDate: dayjs().add(7, 'days').endOf('day'),
});

// Default layouts for list view (filters, tasks, delivery journey)
const DEFAULT_LIST_LAYOUTS: DashboardLayouts = {
    lg: [
        {i: DashboardWidget.Filters, x: 0, y: 0, w: 6, h: 3, minW: 3, minH: 2},
        {i: DashboardWidget.Tasks, x: 0, y: 3, w: 6, h: 9, minW: 3, minH: 4},
        {i: DashboardWidget.DeliveryJourney, x: 6, y: 0, w: 6, h: 12, minW: 3, minH: 4},
    ],
    md: [
        {i: DashboardWidget.Filters, x: 0, y: 0, w: 6, h: 3, minW: 3, minH: 2},
        {i: DashboardWidget.Tasks, x: 0, y: 3, w: 6, h: 9, minW: 3, minH: 4},
        {i: DashboardWidget.DeliveryJourney, x: 6, y: 0, w: 6, h: 12, minW: 3, minH: 4},
    ],
    sm: [
        {i: DashboardWidget.Filters, x: 0, y: 0, w: 12, h: 3, minW: 6, minH: 2},
        {i: DashboardWidget.Tasks, x: 0, y: 3, w: 12, h: 6, minW: 6, minH: 4},
        {i: DashboardWidget.DeliveryJourney, x: 0, y: 9, w: 12, h: 6, minW: 6, minH: 4},
    ],
};

// Default layouts for calendar view (calendar, delivery journey)
const DEFAULT_CALENDAR_LAYOUTS: DashboardLayouts = {
    lg: [
        {i: DashboardWidget.Calendar, x: 0, y: 0, w: 6, h: 12, minW: 4, minH: 6},
        {i: DashboardWidget.DeliveryJourney, x: 6, y: 0, w: 6, h: 12, minW: 3, minH: 4},
    ],
    md: [
        {i: DashboardWidget.Calendar, x: 0, y: 0, w: 6, h: 12, minW: 4, minH: 6},
        {i: DashboardWidget.DeliveryJourney, x: 6, y: 0, w: 6, h: 12, minW: 3, minH: 4},
    ],
    sm: [
        {i: DashboardWidget.Calendar, x: 0, y: 0, w: 12, h: 8, minW: 6, minH: 6},
        {i: DashboardWidget.DeliveryJourney, x: 0, y: 8, w: 12, h: 6, minW: 6, minH: 4},
    ],
};

// Grid configuration
const GRID_BREAKPOINTS = {lg: 1200, md: 996, sm: 768};
const GRID_COLS = {lg: 12, md: 12, sm: 12};
const GRID_ROW_HEIGHT = 50;

export const TaskDashboardPage: React.FC<TaskDashboardPageProps> = ({
    showToast,
    isUsCustomer,
    onTaskSelect,
    setRefreshCallback,
    onLayoutActionsChange,
}) => {
    // View state
    const [showFullCalendar, setShowFullCalendar] = useState(false);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>(StatusFilter.All);

    // Filter values
    const [searchQuery, setSearchQuery] = useState('');
    const [staffFilter, setStaffFilter] = useState('all');
    const [eventTypeFilter, setEventTypeFilter] = useState('all');

    // Date filter
    const [dateFilterData, setDateFilterData] = useState<DateFilterData>(setDateFilterDefaults);

    // Selection
    const [selectedTask, setSelectedTask] = useState<ExtendedTask | undefined>();

    // Layout state
    const [layouts, setLayouts] = useState<DashboardLayouts>(DEFAULT_LIST_LAYOUTS);
    const [isLayoutLocked, setIsLayoutLocked] = useState(true);
    const [savedLayouts, setSavedLayouts] = useState<SavedLayout[]>([]);
    const [activeLayoutName, setActiveLayoutName] = useState(DEFAULT_LAYOUT_NAME);
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);

    // Grid layout width management - debounce to prevent jumping
    const {width: rawContainerWidth, containerRef: gridContainerRef} = useContainerWidth();
    const [containerWidth, setContainerWidth] = useState(1200);

    // Debounce width changes to prevent layout thrashing
    useEffect(() => {
        if (rawContainerWidth && rawContainerWidth > 0) {
            const timeout = setTimeout(() => {
                setContainerWidth(rawContainerWidth);
            }, 100);
            return () => clearTimeout(timeout);
        }
    }, [rawContainerWidth]);

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
                    console.warn(`Invalid date for task "${task.title}":`, task.dueDate);
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
            } catch (error) {
                console.error('Error processing dueDate for task:', task, error);
                return {...task, dueTimeStr: '00:00'};
            }
        });
    }, [rawTasks]);

    // Load view preference from localStorage
    useEffect(() => {
        try {
            const viewMode = localStorage.getItem(getViewPreferenceKey());
            if (viewMode) {
                setShowFullCalendar(viewMode === ViewMode.Calendar);
            }
        } catch (error) {
            console.warn('Failed to load view preference:', error);
        }
    }, []);

    // Load date filter from localStorage
    useEffect(() => {
        try {
            const savedDateFilter = localStorage.getItem(getDateFilterKey());
            if (savedDateFilter) {
                const parsed = JSON.parse(savedDateFilter);
                setDateFilterData({
                    startDate: dayjs(parsed.startDate),
                    endDate: dayjs(parsed.endDate),
                });
            }
        } catch (error) {
            console.warn('Failed to load date filter:', error);
        }
    }, []);

    // Create default layout object
    const defaultLayout: SavedLayout = useMemo(() => ({
        name: DEFAULT_LAYOUT_NAME,
        listLayouts: DEFAULT_LIST_LAYOUTS,
        calendarLayouts: DEFAULT_CALENDAR_LAYOUTS,
        isDefault: true,
    }), []);

    // Load saved layouts from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(getSavedLayoutsKey());
            if (saved) {
                const parsed: SavedLayoutsState = JSON.parse(saved);
                setSavedLayouts(parsed.layouts || []);
                setActiveLayoutName(parsed.activeLayoutName || DEFAULT_LAYOUT_NAME);

                // Find and apply the active layout
                const activeLayout = parsed.layouts?.find(l => l.name === parsed.activeLayoutName);
                if (activeLayout) {
                    setLayouts(showFullCalendar ? activeLayout.calendarLayouts : activeLayout.listLayouts);
                    // Lock layout if it's the default
                    setIsLayoutLocked(activeLayout.isDefault !== false);
                }
            }
        } catch (error) {
            console.warn('Failed to load saved layouts:', error);
        }
    }, []);

    // Update layouts when view mode or active layout changes
    useEffect(() => {
        const activeLayout = savedLayouts.find(l => l.name === activeLayoutName) || defaultLayout;
        setLayouts(showFullCalendar ? activeLayout.calendarLayouts : activeLayout.listLayouts);
    }, [showFullCalendar, activeLayoutName, savedLayouts, defaultLayout]);

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
        let result: ExtendedTask[];

        switch (statusFilter) {
            case StatusFilter.All:
                result = tasks.filter(task => !task.closed);
                break;
            case StatusFilter.Overdue:
                result = tasks.filter(task => isTaskOverdue(task));
                break;
            case StatusFilter.Todo:
                result = tasks.filter(task => !task.closed && !isTaskOverdue(task));
                break;
            case StatusFilter.Done:
                result = tasks.filter(task => task.closed);
                break;
            default:
                result = [...tasks];
        }

        return result;
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

    // Handle view mode change
    const handleViewModeChange = useCallback((newShowFullCalendar: boolean) => {
        setShowFullCalendar(newShowFullCalendar);

        const viewMode = newShowFullCalendar ? ViewMode.Calendar : ViewMode.List;

        // If switching to list view, reset to default date range
        if (!newShowFullCalendar) {
            const defaultFilter = setDateFilterDefaults();
            setDateFilterData(defaultFilter);
            try {
                localStorage.setItem(getDateFilterKey(), JSON.stringify(defaultFilter));
            } catch (error) {
                console.warn('Failed to save date filter:', error);
            }
        }

        try {
            localStorage.setItem(getViewPreferenceKey(), viewMode);
        } catch (error) {
            console.warn('Failed to save view preference:', error);
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
        onTaskSelect(task);
    }, [onTaskSelect]);

    // Handle task completion
    const handleTaskCompletion = useCallback(async () => {
        await refetchTasks();
    }, [refetchTasks]);

    // Handle calendar task click
    const handleCalendarTaskClick = useCallback((task: ExtendedTask) => {
        selectTaskForHistory(task);
    }, [selectTaskForHistory]);

    // Handle calendar task status change
    const handleCalendarTaskStatusChange = useCallback(async (task: ExtendedTask) => {
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
    const showInfoToast = useCallback((msg: string) => showToast(msg, 'info'), [showToast]);

    // Helper to persist saved layouts to localStorage
    const persistSavedLayouts = useCallback((layouts: SavedLayout[], activeName: string) => {
        try {
            const state: SavedLayoutsState = {layouts, activeLayoutName: activeName};
            localStorage.setItem(getSavedLayoutsKey(), JSON.stringify(state));
        } catch (error) {
            console.warn('Failed to save layouts:', error);
        }
    }, []);

    // Check if current layout is the default
    const isDefaultLayout = activeLayoutName === DEFAULT_LAYOUT_NAME;

    // Get all layout names for the dropdown (including Default)
    const allLayoutNames = useMemo(() => {
        return [DEFAULT_LAYOUT_NAME, ...savedLayouts.map(l => l.name)];
    }, [savedLayouts]);

    // Helper to get current breakpoint based on container width
    const getCurrentBreakpoint = useCallback((): string => {
        const width = containerWidth || 1200;
        if (width >= GRID_BREAKPOINTS.lg) return 'lg';
        if (width >= GRID_BREAKPOINTS.md) return 'md';
        return 'sm';
    }, [containerWidth]);

    // Layout handlers - only save on drag/resize stop to prevent layout thrashing
    const handleLayoutChangeEnd = useCallback((newLayout: Layout) => {
        if (isLayoutLocked || isDefaultLayout) return;

        // Convert Layout to mutable array for our DashboardLayouts type
        const currentBreakpoint = getCurrentBreakpoint();
        const dashboardLayouts: DashboardLayouts = {
            ...layouts,
            [currentBreakpoint]: newLayout.map(item => ({...item})),
        };

        setLayouts(dashboardLayouts);

        // Update the saved layout
        setSavedLayouts(prev => {
            const updated = prev.map(l => {
                if (l.name === activeLayoutName) {
                    return {
                        ...l,
                        [showFullCalendar ? 'calendarLayouts' : 'listLayouts']: dashboardLayouts,
                    };
                }
                return l;
            });
            persistSavedLayouts(updated, activeLayoutName);
            return updated;
        });
    }, [showFullCalendar, isLayoutLocked, isDefaultLayout, activeLayoutName, persistSavedLayouts, layouts, getCurrentBreakpoint]);

    // Handlers for drag and resize end events
    const handleDragStop = useCallback((layout: Layout) => {
        handleLayoutChangeEnd(layout);
    }, [handleLayoutChangeEnd]);

    const handleResizeStop = useCallback((layout: Layout) => {
        handleLayoutChangeEnd(layout);
    }, [handleLayoutChangeEnd]);

    // Switch to a different layout
    const handleLayoutSelect = useCallback((layoutName: string) => {
        setActiveLayoutName(layoutName);
        const layout = savedLayouts.find(l => l.name === layoutName) || defaultLayout;
        setLayouts(showFullCalendar ? layout.calendarLayouts : layout.listLayouts);
        // Lock the layout when switching (default is always locked, custom starts locked)
        setIsLayoutLocked(true);
        persistSavedLayouts(savedLayouts, layoutName);
    }, [savedLayouts, defaultLayout, showFullCalendar, persistSavedLayouts]);

    // Save current layout as a new named layout
    const handleSaveLayout = useCallback((name: string) => {
        const newLayout: SavedLayout = {
            name,
            listLayouts: showFullCalendar ? DEFAULT_LIST_LAYOUTS : layouts,
            calendarLayouts: showFullCalendar ? layouts : DEFAULT_CALENDAR_LAYOUTS,
            isDefault: false,
        };

        // If we're on a custom layout, copy both view layouts from the current active
        const currentActive = savedLayouts.find(l => l.name === activeLayoutName);
        if (currentActive) {
            newLayout.listLayouts = showFullCalendar ? currentActive.listLayouts : layouts;
            newLayout.calendarLayouts = showFullCalendar ? layouts : currentActive.calendarLayouts;
        }

        const updated = [...savedLayouts, newLayout];
        setSavedLayouts(updated);
        setActiveLayoutName(name);
        setIsLayoutLocked(true);
        persistSavedLayouts(updated, name);
        showSuccessToast(`Layout "${name}" saved`);
    }, [layouts, showFullCalendar, savedLayouts, activeLayoutName, persistSavedLayouts, showSuccessToast]);

    // Delete a saved layout
    const handleDeleteLayout = useCallback((name: string) => {
        if (name === DEFAULT_LAYOUT_NAME) return;

        const updated = savedLayouts.filter(l => l.name !== name);
        setSavedLayouts(updated);

        // Switch to default if we deleted the active layout
        if (activeLayoutName === name) {
            setActiveLayoutName(DEFAULT_LAYOUT_NAME);
            setLayouts(showFullCalendar ? DEFAULT_CALENDAR_LAYOUTS : DEFAULT_LIST_LAYOUTS);
            setIsLayoutLocked(true);
        }

        persistSavedLayouts(updated, activeLayoutName === name ? DEFAULT_LAYOUT_NAME : activeLayoutName);
        showSuccessToast(`Layout "${name}" deleted`);
    }, [savedLayouts, activeLayoutName, showFullCalendar, persistSavedLayouts, showSuccessToast]);

    // Reset current layout to default values
    const handleResetLayout = useCallback(() => {
        if (isDefaultLayout) {
            // For default layout, just reset to default values
            setLayouts(showFullCalendar ? DEFAULT_CALENDAR_LAYOUTS : DEFAULT_LIST_LAYOUTS);
            showSuccessToast('Layout reset to default');
        } else {
            // For custom layouts, reset to default values but keep the layout
            const defaultLayouts = showFullCalendar ? DEFAULT_CALENDAR_LAYOUTS : DEFAULT_LIST_LAYOUTS;
            setLayouts(defaultLayouts);

            setSavedLayouts(prev => {
                const updated = prev.map(l => {
                    if (l.name === activeLayoutName) {
                        return {
                            ...l,
                            [showFullCalendar ? 'calendarLayouts' : 'listLayouts']: defaultLayouts,
                        };
                    }
                    return l;
                });
                persistSavedLayouts(updated, activeLayoutName);
                return updated;
            });
            showSuccessToast('Layout reset to default');
        }
    }, [isDefaultLayout, showFullCalendar, activeLayoutName, persistSavedLayouts, showSuccessToast]);

    // Toggle layout lock (only for custom layouts)
    const toggleLayoutLock = useCallback(() => {
        if (isDefaultLayout) {
            showInfoToast('Default layout cannot be modified');
            return;
        }

        setIsLayoutLocked(prev => {
            const newValue = !prev;
            if (newValue) {
                showInfoToast('Layout locked');
            } else {
                showInfoToast('Layout unlocked - drag widgets to rearrange');
            }
            return newValue;
        });
    }, [isDefaultLayout, showInfoToast]);

    // Index-based handlers for app bar LayoutsMenu integration
    const handleLoadLayoutByIndex = useCallback((index: number) => {
        const layoutName = allLayoutNames[index];
        if (layoutName) {
            handleLayoutSelect(layoutName);
        }
    }, [allLayoutNames, handleLayoutSelect]);

    const handleDeleteLayoutByIndex = useCallback((index: number) => {
        const layoutName = allLayoutNames[index];
        if (layoutName && layoutName !== DEFAULT_LAYOUT_NAME) {
            handleDeleteLayout(layoutName);
        }
    }, [allLayoutNames, handleDeleteLayout]);

    const handleOpenSaveDialog = useCallback(() => {
        setSaveDialogOpen(true);
    }, []);

    // Notify parent of layout actions for app bar integration
    useEffect(() => {
        if (onLayoutActionsChange) {
            onLayoutActionsChange({
                layouts: allLayoutNames.map(name => ({ name })),
                currentLayoutName: activeLayoutName,
                onSaveLayout: handleOpenSaveDialog,
                onLoadLayout: handleLoadLayoutByIndex,
                onDeleteLayout: handleDeleteLayoutByIndex,
            });
        }
    }, [onLayoutActionsChange, allLayoutNames, activeLayoutName, handleOpenSaveDialog, handleLoadLayoutByIndex, handleDeleteLayoutByIndex]);

    // Create a tasks service interface for child components
    const tasksServiceForComponents = useMemo(() => ({
        markTaskAsClosed: async (eventId: number, closed: boolean) => {
            await markTaskAsClosedMutation.mutateAsync({eventId, closed});
        },
        updateTaskDate: async (eventId: number, date: any) => {
            await updateTaskDateMutation.mutateAsync({eventId, date});
        },
        updateTaskTime: async (eventId: number, time: any) => {
            await updateTaskTimeMutation.mutateAsync({eventId, time});
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

    return (
        <Box sx={{
            height: '100%', display: 'flex', flexDirection: 'column', p: 2,
            bgcolor: '#f5f7fa',
            '& .MuiCard-root': {
                borderRadius: '12px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {boxShadow: '0 4px 12px rgba(0,0,0,0.15)'},
            },
        }}>
            {/* Header Card */}
            <Card sx={{mb: 2, flexShrink: 0}}>
                <CardContent sx={{py: 2}}>
                    <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
                        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                            {/* View Mode Switch */}
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    bgcolor: 'grey.100',
                                    borderRadius: '100px',
                                    px: 1.5,
                                    py: 0.75,
                                    gap: 1,
                                }}
                            >
                                <ViewListIcon sx={{fontSize: 20, color: 'grey.600'}} />
                                <Typography variant="body2" fontWeight={500} color="text.secondary">
                                    List
                                </Typography>
                                <Switch
                                    checked={showFullCalendar}
                                    onChange={(e) => handleViewModeChange(e.target.checked)}
                                    color="primary"
                                    size="small"
                                />
                                <Typography variant="body2" fontWeight={500} color="text.secondary">
                                    Calendar
                                </Typography>
                                <CalendarMonthIcon sx={{fontSize: 20, color: 'grey.600'}} />
                            </Box>

                            <Divider orientation="vertical" flexItem sx={{mx: 1}} />

                            {/* Status Filters */}
                            <ToggleButtonGroup
                                value={statusFilter}
                                exclusive
                                onChange={(_, value) => value && handleStatusFilterChange(value)}
                                size="small"
                            >
                                <ToggleButton value={StatusFilter.All} sx={{textTransform: 'none'}}>
                                    <TaskAltIcon sx={{mr: 0.5, fontSize: 18}} />
                                    Active: {statusCounts.active}
                                </ToggleButton>
                                <ToggleButton
                                    value={StatusFilter.Overdue}
                                    sx={{
                                        textTransform: 'none',
                                        '&.Mui-selected': {bgcolor: '#ffecef', color: '#e53935'},
                                    }}
                                >
                                    <WarningIcon sx={{mr: 0.5, fontSize: 18}} />
                                    Overdue: {statusCounts.overdue}
                                </ToggleButton>
                                <ToggleButton
                                    value={StatusFilter.Todo}
                                    sx={{
                                        textTransform: 'none',
                                        '&.Mui-selected': {bgcolor: '#e8f5e9', color: '#388e3c'},
                                    }}
                                >
                                    <PendingActionsIcon sx={{mr: 0.5, fontSize: 18}} />
                                    Todo: {statusCounts.todo}
                                </ToggleButton>
                                <ToggleButton
                                    value={StatusFilter.Done}
                                    sx={{
                                        textTransform: 'none',
                                        '&.Mui-selected': {bgcolor: '#e0e0e0', color: '#616161'},
                                    }}
                                >
                                    <CheckCircleIcon sx={{mr: 0.5, fontSize: 18}} />
                                    Done: {statusCounts.done}
                                </ToggleButton>
                            </ToggleButtonGroup>
                        </Box>

                        {/* Layout Controls */}
                        <Box display="flex" alignItems="center" gap={1}>
                            {!isDefaultLayout && (
                                <>
                                    <Tooltip title={isLayoutLocked ? 'Unlock layout to edit' : 'Lock layout'}>
                                        <IconButton
                                            size="small"
                                            onClick={toggleLayoutLock}
                                            color={isLayoutLocked ? 'default' : 'primary'}
                                            aria-label={isLayoutLocked ? 'Unlock layout to edit' : 'Lock layout'}
                                        >
                                            {isLayoutLocked ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />}
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Reset layout to default">
                                        <IconButton
                                            size="small"
                                            onClick={handleResetLayout}
                                            aria-label="Reset layout to default"
                                        >
                                            <RestartAltIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </>
                            )}
                        </Box>
                    </Box>
                </CardContent>
            </Card>

            {/* AI Briefing — only show when there are tasks */}
            {!tasksLoading && tasks.length > 0 && (
                <Box sx={{mb: 2, flexShrink: 0}}>
                    <AiSummaryPanel
                        title="AI Daily Briefing"
                        fetchSummary={summarizeTaskDashboard}
                        accentColor="#7c4dff"
                    />
                </Box>
            )}

            {/* Main Content - Grid Layout */}
            <Box
                ref={gridContainerRef}
                sx={{
                    flex: 1,
                    minHeight: 0,
                    '& .react-grid-layout': {
                        height: '100% !important',
                    },
                    '& .react-grid-item': {
                        transition: isLayoutLocked ? 'none' : 'all 200ms ease',
                    },
                    '& .react-grid-item.react-grid-placeholder': {
                        bgcolor: 'primary.light',
                        opacity: 0.3,
                        borderRadius: 1,
                    },
                    '& .react-resizable-handle': {
                        display: isLayoutLocked ? 'none' : 'block',
                        position: 'absolute',
                        background: 'transparent',
                    },
                    '& .react-resizable-handle-se': {
                        width: 20,
                        height: 20,
                        bottom: 0,
                        right: 0,
                        cursor: 'se-resize',
                        '&::after': {
                            content: '""',
                            position: 'absolute',
                            right: 3,
                            bottom: 3,
                            width: 8,
                            height: 8,
                            borderRight: '2px solid rgba(0,0,0,0.4)',
                            borderBottom: '2px solid rgba(0,0,0,0.4)',
                        },
                    },
                    '& .react-resizable-handle-s': {
                        width: '100%',
                        height: 10,
                        bottom: 0,
                        left: 0,
                        cursor: 's-resize',
                        '&::after': {
                            content: '""',
                            position: 'absolute',
                            left: '50%',
                            bottom: 2,
                            width: 30,
                            height: 4,
                            marginLeft: -15,
                            backgroundColor: 'rgba(0,0,0,0.3)',
                            borderRadius: 2,
                        },
                    },
                    '& .react-resizable-handle-e': {
                        width: 10,
                        height: '100%',
                        top: 0,
                        right: 0,
                        cursor: 'e-resize',
                        '&::after': {
                            content: '""',
                            position: 'absolute',
                            top: '50%',
                            right: 2,
                            width: 4,
                            height: 30,
                            marginTop: -15,
                            backgroundColor: 'rgba(0,0,0,0.3)',
                            borderRadius: 2,
                        },
                    },
                }}
            >
                <ResponsiveGridLayout
                    width={containerWidth}
                    layouts={layouts}
                    breakpoints={GRID_BREAKPOINTS}
                    cols={GRID_COLS}
                    rowHeight={GRID_ROW_HEIGHT}
                    onDragStop={handleDragStop}
                    onResizeStop={handleResizeStop}
                    dragConfig={{
                        enabled: !isLayoutLocked,
                        handle: '.drag-handle',
                        bounded: false,
                        threshold: 3,
                    }}
                    resizeConfig={{
                        enabled: !isLayoutLocked,
                        handles: ['se', 's', 'e'],
                    }}
                    margin={[16, 16]}
                    containerPadding={[0, 0]}
                >
                    {/* Filters Widget (List View Only) */}
                    {!showFullCalendar && (
                        <div key={DashboardWidget.Filters}>
                            <Card sx={{height: '100%', display: 'flex', flexDirection: 'column'}}>
                                <Toolbar
                                    variant="dense"
                                    className="drag-handle"
                                    sx={{
                                        bgcolor: 'primary.main',
                                        color: 'primary.contrastText',
                                        minHeight: 48,
                                        cursor: isLayoutLocked ? 'default' : 'grab',
                                        '&:active': {cursor: isLayoutLocked ? 'default' : 'grabbing'},
                                    }}
                                >
                                    {!isLayoutLocked && <DragIndicatorIcon sx={{mr: 1, opacity: 0.7}} />}
                                    <TuneIcon sx={{mr: 1}} />
                                    <Typography variant="subtitle1">Filters</Typography>
                                </Toolbar>
                                <CardContent sx={{flex: 1, overflow: 'auto'}}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Search..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <SearchIcon />
                                                </InputAdornment>
                                            ),
                                        }}
                                        sx={{mb: 2}}
                                    />

                                    <Box display="flex" gap={2}>
                                        <FormControl size="small" sx={{flex: 1}}>
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

                                        <FormControl size="small" sx={{flex: 1}}>
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
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Tasks Widget (List View Only) */}
                    {!showFullCalendar && (
                        <div key={DashboardWidget.Tasks}>
                            <Card sx={{height: '100%', display: 'flex', flexDirection: 'column'}}>
                                <Toolbar
                                    variant="dense"
                                    className="drag-handle"
                                    sx={{
                                        bgcolor: 'primary.main',
                                        color: 'primary.contrastText',
                                        minHeight: 48,
                                        flexShrink: 0,
                                        cursor: isLayoutLocked ? 'default' : 'grab',
                                        '&:active': {cursor: isLayoutLocked ? 'default' : 'grabbing'},
                                    }}
                                >
                                    {!isLayoutLocked && <DragIndicatorIcon sx={{mr: 1, opacity: 0.7}} />}
                                    <TaskAltIcon sx={{mr: 1}} />
                                    <Typography variant="subtitle1">
                                        Tasks ({filteredTasks.length})
                                    </Typography>
                                </Toolbar>
                                <CardContent sx={{flex: 1, overflow: 'hidden', p: 0, position: 'relative'}}>
                                    {tasksLoading && (
                                        <Box display="flex" justifyContent="center" p={2}>
                                            <CircularProgress size={24} />
                                        </Box>
                                    )}

                                    {!tasksLoading && filteredTasks.length === 0 && (
                                        <Box display="flex" alignItems="center" justifyContent="center" p={3}>
                                            <InfoIcon sx={{mr: 1, color: 'grey.500'}} />
                                            <Typography color="text.secondary">
                                                No tasks match your filters
                                            </Typography>
                                        </Box>
                                    )}

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
                                            {filteredTasks.map((task) => (
                                                <TaskItem
                                                    key={task.id}
                                                    task={task}
                                                    config={{
                                                        showJobId: true,
                                                        showAssignee: true,
                                                        showJobType: true,
                                                        showDateTime: true,
                                                        customClass: '',
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
                                            ))}
                                        </List>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Calendar Widget (Calendar View Only) */}
                    {showFullCalendar && (
                        <div key={DashboardWidget.Calendar}>
                            <Card sx={{height: '100%', display: 'flex', flexDirection: 'column'}}>
                                <Toolbar
                                    variant="dense"
                                    className="drag-handle"
                                    sx={{
                                        bgcolor: 'primary.main',
                                        color: 'primary.contrastText',
                                        minHeight: 48,
                                        cursor: isLayoutLocked ? 'default' : 'grab',
                                        '&:active': {cursor: isLayoutLocked ? 'default' : 'grabbing'},
                                    }}
                                >
                                    {!isLayoutLocked && <DragIndicatorIcon sx={{mr: 1, opacity: 0.7}} />}
                                    <CalendarMonthIcon sx={{mr: 1}} />
                                    <Typography variant="subtitle1">Calendar</Typography>
                                </Toolbar>
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
                            </Card>
                        </div>
                    )}

                    {/* Delivery Journey Widget (Always Visible) */}
                    <div key={DashboardWidget.DeliveryJourney}>
                        <Card sx={{height: '100%', display: 'flex', flexDirection: 'column'}}>
                            <Toolbar
                                variant="dense"
                                className="drag-handle"
                                sx={{
                                    bgcolor: 'primary.main',
                                    color: 'primary.contrastText',
                                    minHeight: 48,
                                    flexShrink: 0,
                                    cursor: isLayoutLocked ? 'default' : 'grab',
                                    '&:active': {cursor: isLayoutLocked ? 'default' : 'grabbing'},
                                }}
                            >
                                {!isLayoutLocked && <DragIndicatorIcon sx={{mr: 1, opacity: 0.7}} />}
                                <RocketLaunchIcon sx={{mr: 1}} />
                                <Typography variant="subtitle1">
                                    Delivery Journey {selectedTask ? `for Job ${selectedTask.jobNumber}` : ''}
                                </Typography>
                            </Toolbar>
                            <Box sx={{flex: 1, overflow: 'auto'}}>
                                <TaskHistory
                                    jobId={selectedTask?.jobId}
                                    config={{
                                        showSummaryStats: true,
                                        densityMode: DensityMode.Normal,
                                    }}
                                    dispatchService={dispatchServiceForComponents}
                                    showSuccessToast={showSuccessToast}
                                    showErrorToast={showErrorToast}
                                    showInfoToast={showInfoToast}
                                    isUsCustomer={isUsCustomer}
                                />
                            </Box>
                        </Card>
                    </div>
                </ResponsiveGridLayout>
            </Box>

            {/* Save Layout Dialog */}
            <SaveLayoutDialog
                open={saveDialogOpen}
                onClose={() => setSaveDialogOpen(false)}
                onSave={handleSaveLayout}
                existingNames={allLayoutNames}
            />
        </Box>
    );
};

export default TaskDashboardPage;
