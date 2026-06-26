import React, {useMemo, useState} from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Popover from '@mui/material/Popover';
import LinearProgress from '@mui/material/LinearProgress';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import RadioGroup from '@mui/material/RadioGroup';
import Radio from '@mui/material/Radio';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import FilterListIcon from '@mui/icons-material/FilterList';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArticleIcon from '@mui/icons-material/Article';
import PersonIcon from '@mui/icons-material/Person';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import type {Dayjs} from 'dayjs';
import {HeaderSlotPortal} from '../../../components/common/header-slot/HeaderSlotPortal';
import type {ShowToastFn} from '../../../services/toastService';
import {TaskItem} from '../../../components/common/task-item/TaskItem';
import {
    buildFilterRequest,
    getTasksStatusCount,
    TaskFilterType,
    AppPage as TasksAppPage,
    initializePageFilters,
    saveStaffFilter,
    saveEventTypeFilter,
    StatusFilterValue,
    getCurrentUserId,
} from '../../../services/tasksService';
import {
    useTasks,
    useActiveStaff,
    useEventTypes,
    useMarkTaskAsClosed,
    useUpdateTaskDate,
    useUpdateTaskTime,
    useReassignTask,
} from '../../../hooks/useTasksApi';
import {tasksApi} from '../../../services/tasksApi';

export interface SupportsBoxProps {
    /** The selected job whose tasks to show. Tasks only load when a job is selected. */
    jobId?: number;
    showToast: ShowToastFn;
    /** Auto-refresh interval in ms (React Query refetchInterval); false/undefined = off. */
    refetchIntervalMs?: number | false;
    /** Select a job by id when a task is clicked (mirrors V1 selectSupportJobDetail). */
    onSelectJob?: (jobId: number) => void;
    /** Card header DOM node; the Filters menu button portals into it. */
    headerSlot?: HTMLElement | null;
}

interface FilterChip {
    type: TaskFilterType;
    label: string;
    icon: React.ReactNode;
    /** Counts that reflect the loaded set rather than the total are 'mine'/'unassigned'. */
    countType: TaskFilterType;
}

const FILTER_CHIPS: FilterChip[] = [
    {type: 'all', label: 'Total', icon: <ArticleIcon fontSize="small" />, countType: 'all'},
    {type: 'mine', label: 'Mine', icon: <PersonIcon fontSize="small" />, countType: 'mine'},
    {type: 'unassigned', label: 'Unassigned', icon: <PersonOffIcon fontSize="small" />, countType: 'unassigned'},
    {type: 'newest', label: 'Newest', icon: <ArrowDownwardIcon fontSize="small" />, countType: 'newest'},
    {type: 'oldest', label: 'Oldest', icon: <ArrowUpwardIcon fontSize="small" />, countType: 'oldest'},
];

const EmptyMessage: React.FC<{children: React.ReactNode}> = ({children}) => (
    <Box sx={{p: 3, color: 'text.secondary', textAlign: 'center'}}>{children}</Box>
);

/**
 * "Supports" (tasks) panel for the React dispatch page. Mirrors the AngularJS
 * home `supports` partial: tasks for the selected job, with the Total / Mine /
 * Unassigned / Newest / Oldest filter chips. Reuses the shared `TaskItem`
 * component and the `useTasks` / task-mutation hooks (same wiring as
 * TaskDashboardPage) rather than the AngularJS data-push bridge.
 */
export const SupportsBox: React.FC<SupportsBoxProps> = ({jobId, showToast, refetchIntervalMs = false, onSelectJob, headerSlot}) => {
    const [filterType, setFilterType] = useState<TaskFilterType>('all');
    const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);

    // Staff + event-type filters (persisted per page, mirror V1 filterByStaff /
    // filterBySupportType). Options come from the shared task hooks.
    const initialFilters = useMemo(() => initializePageFilters(TasksAppPage.Dispatch), []);
    const [staffFilter, setStaffFilter] = useState(initialFilters.staffFilter);
    const [eventTypeFilter, setEventTypeFilter] = useState(initialFilters.eventTypeFilter);

    const {data: staffList = []} = useActiveStaff({enabled: !!jobId});
    const {data: eventTypes = []} = useEventTypes({enabled: !!jobId});

    const handleStaffChange = (value: string) => {
        setStaffFilter(value);
        saveStaffFilter(value, TasksAppPage.Dispatch);
    };
    const handleEventTypeChange = (value: string) => {
        setEventTypeFilter(value);
        saveEventTypeFilter(value, TasksAppPage.Dispatch);
    };

    const filterRequest = useMemo(
        () => buildFilterRequest(filterType, {jobId, staffFilter, eventTypeFilter}),
        [filterType, jobId, staffFilter, eventTypeFilter],
    );

    const {data: tasks = [], isLoading, refetch} = useTasks(filterRequest, {enabled: !!jobId, refetchInterval: refetchIntervalMs});

    const markTaskAsClosedMutation = useMarkTaskAsClosed();
    const updateTaskDateMutation = useUpdateTaskDate();
    const updateTaskTimeMutation = useUpdateTaskTime();
    const reassignTaskMutation = useReassignTask();

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

    const dispatchServiceForComponents = useMemo(() => ({
        getActiveStaff: () => tasksApi.getActiveStaff(),
        getDeliveryJourney: (id: number) => tasksApi.getDeliveryJourney(id),
    }), []);

    const showSuccessToast = (msg: string) => showToast(msg, 'success');
    const showErrorToast = (msg: string) => showToast(msg, 'error');

    if (!jobId) {
        return <EmptyMessage>Select a job to see its tasks.</EmptyMessage>;
    }

    const activeFilterCount =
        (staffFilter !== StatusFilterValue.All ? 1 : 0)
        + (eventTypeFilter !== StatusFilterValue.All ? 1 : 0)
        + (filterType !== 'all' ? 1 : 0);

    return (
        <Box sx={{height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0}}>
            <HeaderSlotPortal slot={headerSlot}>
                <Button
                    size="small"
                    startIcon={<FilterListIcon />}
                    endIcon={<ArrowDropDownIcon />}
                    onClick={(e) => setFilterAnchor(e.currentTarget)}
                    aria-haspopup="true"
                    aria-expanded={filterAnchor ? 'true' : undefined}
                    sx={{color: 'inherit', textTransform: 'none', '&:hover': {bgcolor: 'rgba(255,255,255,0.12)'}}}
                >
                    {activeFilterCount ? `Filters (${activeFilterCount})` : 'Filters'}
                </Button>
            </HeaderSlotPortal>
            <Popover
                open={Boolean(filterAnchor)}
                anchorEl={filterAnchor}
                onClose={() => setFilterAnchor(null)}
                anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
                transformOrigin={{vertical: 'top', horizontal: 'right'}}
            >
                <Box sx={{p: 2, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 260}}>
                    <FormControl size="small" fullWidth>
                        <InputLabel id="supports-staff-filter-label">Staff</InputLabel>
                        <Select
                            labelId="supports-staff-filter-label"
                            label="Staff"
                            value={staffFilter}
                            onChange={(e) => handleStaffChange(e.target.value)}
                        >
                            <MenuItem value={StatusFilterValue.All}>All staff</MenuItem>
                            {staffList.map(s => (
                                <MenuItem key={s.id} value={String(s.id)}>{s.text}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl size="small" fullWidth>
                        <InputLabel id="supports-type-filter-label">Type</InputLabel>
                        <Select
                            labelId="supports-type-filter-label"
                            label="Type"
                            value={eventTypeFilter}
                            onChange={(e) => handleEventTypeChange(e.target.value)}
                        >
                            <MenuItem value={StatusFilterValue.All}>All types</MenuItem>
                            {eventTypes.map(t => (
                                <MenuItem key={t.id} value={String(t.id)}>{t.text}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl>
                        <Typography variant="caption" sx={{color: 'text.secondary', fontWeight: 500, mb: 0.5}}>
                            Show
                        </Typography>
                        <RadioGroup
                            value={filterType}
                            onChange={(_, value) => setFilterType(value as TaskFilterType)}
                        >
                            {FILTER_CHIPS.map(chip => (
                                <FormControlLabel
                                    key={chip.type}
                                    value={chip.type}
                                    control={<Radio size="small" />}
                                    label={`${chip.label} (${getTasksStatusCount(tasks, chip.countType)})`}
                                />
                            ))}
                        </RadioGroup>
                    </FormControl>
                </Box>
            </Popover>
            {isLoading && <LinearProgress />}
            <Box sx={{flex: 1, minHeight: 0, overflow: 'auto', p: 0.5}}>
                {tasks.length === 0 && !isLoading ? (
                    <EmptyMessage>This job has no tasks matching your filter.</EmptyMessage>
                ) : (
                    tasks.map(task => (
                        <Box key={task.id} sx={{mb: 0.5}}>
                            <TaskItem
                                task={task}
                                config={{
                                    showJobId: false,
                                    showAssignee: true,
                                    showJobType: true,
                                    showDateTime: true,
                                    allowCompletion: true,
                                    showStatusIndicators: true,
                                    showOverdueWarning: true,
                                    onTaskClick: !!onSelectJob,
                                    autoAssignOnClick: true,
                                }}
                                currentUserId={getCurrentUserId()}
                                onTaskUpdated={() => refetch()}
                                onTaskClick={onSelectJob ? (t) => t.jobId && onSelectJob(t.jobId) : undefined}
                                tasksService={tasksServiceForComponents}
                                dispatchService={dispatchServiceForComponents}
                                showSuccessToast={showSuccessToast}
                                showErrorToast={showErrorToast}
                            />
                        </Box>
                    ))
                )}
            </Box>
        </Box>
    );
};
