import React, {useMemo, useState} from 'react';
import {
    Box,
    Group,
    Popover,
    Progress,
    Select,
    Stack,
    Text,
} from '@mantine/core';
import {
    ArrowDown,
    ArrowUp,
    FileText,
    ListFilter,
    User,
    UserX,
} from 'lucide-react';
import {Icon} from '../icon/Icon';
import {NoData} from '../no-data/NoData';
import {HeaderSlotPortal} from '../header-slot/HeaderSlotPortal';
import {HeaderMenuButton, PANEL_CONTROL_GLYPH_SIZE} from '../panel-controls';
import {SegmentedToggle} from '../segmented-toggle';
import type {ShowToastFn} from '../../../services/toastService';
import {TaskItem} from '../task-item/TaskItem';
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
    useTaskComponentServices,
} from '../../../hooks/useTasksApi';

export interface TasksBoxProps {
    /** The selected job whose tasks to show. Tasks only load when a job is selected. */
    jobId?: number;
    /**
     * Which page's task filters to read and write. Required rather than
     * defaulted: the staff and event-type choices persist per page, and
     * silently inheriting another page's is hard to spot.
     */
    appPage: TasksAppPage;
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
    {type: 'all', label: 'Total', icon: <Icon lucide={FileText} size={16}/>, countType: 'all'},
    {type: 'mine', label: 'Mine', icon: <Icon lucide={User} size={16}/>, countType: 'mine'},
    {type: 'unassigned', label: 'Unassigned', icon: <Icon lucide={UserX} size={16}/>, countType: 'unassigned'},
    {type: 'newest', label: 'Newest', icon: <Icon lucide={ArrowDown} size={16}/>, countType: 'newest'},
    {type: 'oldest', label: 'Oldest', icon: <Icon lucide={ArrowUp} size={16}/>, countType: 'oldest'},
];

/**
 * "Supports" (tasks) panel for the React dispatch page. Mirrors the AngularJS
 * home `supports` partial: tasks for the selected job, with the Total / Mine /
 * Unassigned / Newest / Oldest filter chips. Reuses the shared `TaskItem`
 * component and the `useTasks` / task-mutation hooks (same wiring as
 * TaskDashboardPage) rather than the AngularJS data-push bridge.
 */
export const TasksBox: React.FC<TasksBoxProps> = ({jobId, appPage, showToast, refetchIntervalMs = false, onSelectJob, headerSlot}) => {
    const [filterType, setFilterType] = useState<TaskFilterType>('all');
    const [filtersOpen, setFiltersOpen] = useState(false);
    // 'current' scopes tasks to the selected job; 'all' drops the jobId so the
    // shared getAllTasks endpoint returns tasks across every job.
    const [taskScope, setTaskScope] = useState<'current' | 'all'>('current');

    // In 'all' mode the query must run without a job, and every task-scoped
    // request drops the jobId. In 'current' mode nothing loads until a job is set.
    const effectiveJobId = taskScope === 'all' ? undefined : jobId;
    const tasksEnabled = taskScope === 'all' || !!jobId;

    // Staff + event-type filters (persisted per page, mirror V1 filterByStaff /
    // filterBySupportType). Options come from the shared task hooks.
    const initialFilters = useMemo(() => initializePageFilters(appPage), [appPage]);
    const [staffFilter, setStaffFilter] = useState(initialFilters.staffFilter);
    const [eventTypeFilter, setEventTypeFilter] = useState(initialFilters.eventTypeFilter);

    const {data: staffList = []} = useActiveStaff({enabled: tasksEnabled});
    const {data: eventTypes = []} = useEventTypes({enabled: tasksEnabled});

    const handleStaffChange = (value: string) => {
        setStaffFilter(value);
        saveStaffFilter(value, appPage);
    };
    const handleEventTypeChange = (value: string) => {
        setEventTypeFilter(value);
        saveEventTypeFilter(value, appPage);
    };

    const filterRequest = useMemo(
        () => buildFilterRequest(filterType, {jobId: effectiveJobId, staffFilter, eventTypeFilter}),
        [filterType, effectiveJobId, staffFilter, eventTypeFilter],
    );

    const {data: tasks = [], isLoading, refetch} = useTasks(filterRequest, {enabled: tasksEnabled, refetchInterval: refetchIntervalMs});

    const {tasksService: tasksServiceForComponents, dispatchService: dispatchServiceForComponents} = useTaskComponentServices();

    const showSuccessToast = (msg: string) => showToast(msg, 'success');
    const showErrorToast = (msg: string) => showToast(msg, 'error');

    const needsJobSelection = taskScope === 'current' && !jobId;

    const activeFilterCount =
        (staffFilter !== StatusFilterValue.All ? 1 : 0)
        + (eventTypeFilter !== StatusFilterValue.All ? 1 : 0)
        + (filterType !== 'all' ? 1 : 0);

    return (
        <Stack h="100%" gap={0} style={{minHeight: 0}}>
            <HeaderSlotPortal slot={headerSlot}>
                {/* Mirrors Current Work's header cluster so both card bars space alike. */}
                <Group align="center" gap={4} wrap="nowrap" style={{minWidth: 0}}>
                    <SegmentedToggle<'current' | 'all'>
                        aria-label="Task scope"
                        value={taskScope}
                        onChange={setTaskScope}
                        data={[
                            {value: 'current', label: 'This job'},
                            {value: 'all', label: 'All tasks'},
                        ]}
                    />
                    <Popover
                        opened={filtersOpen}
                        onChange={setFiltersOpen}
                        position="bottom-end"
                        shadow="md"
                        withinPortal
                    >
                        <Popover.Target>
                            <HeaderMenuButton
                                icon={<Icon lucide={ListFilter} size={PANEL_CONTROL_GLYPH_SIZE}/>}
                                opened={filtersOpen}
                                onClick={() => setFiltersOpen(o => !o)}
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
                                    onChange={(value) => handleStaffChange(value ?? StatusFilterValue.All)}
                                    comboboxProps={{keepMounted: false}}
                                    data={[
                                        {value: StatusFilterValue.All, label: 'All staff'},
                                        ...staffList.map(s => ({value: String(s.id), label: s.text})),
                                    ]}
                                />
                                <Select
                                    size="sm"
                                    label="Type"
                                    value={eventTypeFilter}
                                    onChange={(value) => handleEventTypeChange(value ?? StatusFilterValue.All)}
                                    comboboxProps={{keepMounted: false}}
                                    data={[
                                        {value: StatusFilterValue.All, label: 'All types'},
                                        ...eventTypes.map(t => ({value: String(t.id), label: t.text})),
                                    ]}
                                />
                                <Box>
                                    <Text size="sm" fw={500} mb={4}>Show</Text>
                                    <SegmentedToggle<TaskFilterType>
                                        aria-label="Show"
                                        orientation="vertical"
                                        variant="inline"
                                        value={filterType}
                                        onChange={setFilterType}
                                        data={FILTER_CHIPS.map(chip => ({
                                            value: chip.type,
                                            label: (
                                                <Group gap={6} wrap="nowrap" style={{flex: 1}}>
                                                    <span>{chip.label}</span>
                                                    {/* Lighter weight, not grey — the count is secondary copy. */}
                                                    <Text component="span" size="sm" fw={400} c="dimmed">
                                                        ({getTasksStatusCount(tasks, chip.countType)})
                                                    </Text>
                                                </Group>
                                            ),
                                        }))}
                                    />
                                </Box>
                            </Stack>
                        </Popover.Dropdown>
                    </Popover>
                </Group>
            </HeaderSlotPortal>
            {isLoading && (
                <Progress.Root size="xs">
                    <Progress.Section value={100} animated aria-label="Loading tasks"/>
                </Progress.Root>
            )}
            <Box p={4} style={{flex: 1, minHeight: 0, overflow: 'auto'}}>
                {needsJobSelection ? (
                    <NoData
                        title="No job selected"
                        message="Select a job to see its tasks."
                    />
                ) : tasks.length === 0 && !isLoading ? (
                    <NoData
                        title="No tasks"
                        message={taskScope === 'all'
                            ? 'No tasks match your filter.'
                            : 'This job has no tasks matching your filter.'}
                    />
                ) : (
                    tasks.map(task => (
                        <Box key={task.id} mb={4}>
                            <TaskItem
                                task={task}
                                config={{
                                    showJobId: taskScope === 'all',
                                    showAssignee: true,
                                    showJobType: true,
                                    showDateTime: true,
                                    allowCompletion: true,
                                    showStatusIndicators: true,
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
        </Stack>
    );
};
