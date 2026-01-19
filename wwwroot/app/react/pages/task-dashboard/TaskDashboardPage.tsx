/**
 * TaskDashboard Page Component
 *
 * A React implementation of the task dashboard, managing tasks in list and calendar views.
 * The job-detail-widget is rendered separately in the AngularJS template.
 */

import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    ToggleButtonGroup,
    ToggleButton,
    Switch,
    List,
    CircularProgress,
    Divider,
    InputAdornment,
    Toolbar,
} from '@mui/material';
import {
    ViewList as ViewListIcon,
    CalendarMonth as CalendarMonthIcon,
    TaskAlt as TaskAltIcon,
    Warning as WarningIcon,
    PendingActions as PendingActionsIcon,
    CheckCircle as CheckCircleIcon,
    Search as SearchIcon,
    Tune as TuneIcon,
    Info as InfoIcon,
    RocketLaunch as RocketLaunchIcon,
} from '@mui/icons-material';
import dayjs from 'dayjs';

import {
    TaskDashboardPageProps,
    StatusFilter,
    ViewMode,
    ExtendedTask,
    DateFilterData,
    StatusCounts,
} from './TaskDashboardPage.interfaces';
import {TaskFiltersRequest} from '../../interfaces';
import {TaskItem} from '../../components/common/task-item/TaskItem';
import {TaskCalendarView} from '../../components/common/task-calendar-view/TaskCalendarView';
import {TaskHistory} from '../../components/common/task-history/TaskHistory';
import {formatDateForApiWithTzs} from '../../../functions/formatDates';
import DensityMode from '../../../enums/densityMode';
import {
    useTasks,
    useActiveStaff,
    useEventTypes,
    useMarkTaskAsClosed,
    useUpdateTaskDate,
    useUpdateTaskTime,
    useReassignTask,
} from '../../hooks';
import {tasksApi} from '../../services/tasksApi';

// Local storage keys
const getViewPreferenceKey = () => {
    const contactId = (window as any).ContactID || 0;
    return `taskDashboardViewPreference-${contactId}`;
};

const getDateFilterKey = () => {
    const contactId = (window as any).ContactID || 0;
    return `dateFilter-task-dashboard-${contactId}`;
};

// Helper to set default date filter
const setDateFilterDefaults = (): DateFilterData => ({
    startDate: dayjs().subtract(1, 'day').startOf('day'),
    endDate: dayjs().add(7, 'days').endOf('day'),
});

export const TaskDashboardPage: React.FC<TaskDashboardPageProps> = ({
    showToast,
    isUsCustomer,
    onTaskSelect,
    setRefreshCallback,
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

        filters.startDate = formatDateForApiWithTzs(dateFilterData.startDate);
        filters.endDate = formatDateForApiWithTzs(dateFilterData.endDate);

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
    const handleCalendarTaskStatusChange = useCallback((task: ExtendedTask) => {
        handleTaskCompletion();
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
        <Box sx={{height: '100%', display: 'flex', flexDirection: 'column', p: 2}}>
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
                    </Box>
                </CardContent>
            </Card>

            {/* Main Content */}
            <Box sx={{flex: 1, display: 'flex', gap: 2, minHeight: 0}}>
                {/* Left Column - List or Calendar */}
                <Box sx={{flex: '0 0 50%', display: 'flex', flexDirection: 'column', minHeight: 0}}>
                    {!showFullCalendar ? (
                        <>
                            {/* Filters Card */}
                            <Card sx={{mb: 2, flexShrink: 0}}>
                                <Toolbar
                                    variant="dense"
                                    sx={{
                                        bgcolor: 'primary.main',
                                        color: 'primary.contrastText',
                                        minHeight: 48,
                                    }}
                                >
                                    <TuneIcon sx={{mr: 1}} />
                                    <Typography variant="subtitle1">Filters</Typography>
                                </Toolbar>
                                <CardContent>
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

                            {/* Task List Card */}
                            <Card sx={{flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0}}>
                                <Toolbar
                                    variant="dense"
                                    sx={{
                                        bgcolor: 'primary.main',
                                        color: 'primary.contrastText',
                                        minHeight: 48,
                                        flexShrink: 0,
                                    }}
                                >
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
                        </>
                    ) : (
                        /* Calendar View */
                        <Box sx={{flex: 1, minHeight: 0}}>
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
                    )}
                </Box>

                {/* Right Column - Task History */}
                <Box sx={{flex: '0 0 50%', display: 'flex', flexDirection: 'column', minHeight: 0}}>
                    <Card sx={{flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0}}>
                        <Toolbar
                            variant="dense"
                            sx={{
                                bgcolor: 'primary.main',
                                color: 'primary.contrastText',
                                minHeight: 48,
                                flexShrink: 0,
                            }}
                        >
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
                </Box>
            </Box>
        </Box>
    );
};

export default TaskDashboardPage;
