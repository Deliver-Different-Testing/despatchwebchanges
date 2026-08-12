/**
 * React Task Item Component
 *
 * A list-item for a dispatch task. Anatomy: leading completion control, headline
 * (priority + title + status), supporting description text, metadata pills, and
 * trailing date/time pills that open editors.
 *
 * **Wall-clock only.** The date editor is Mantine's string-valued `DatePicker`
 * (`YYYY-MM-DD`) and the time editor its `TimePicker` (`HH:mm`), so neither builds
 * an instant. Both are applied to the task's existing `dueDate` by setting calendar
 * fields, which is what `tasksService.updateTaskDate/Time` already expect.
 */

import React, {useState, useMemo, useCallback} from 'react';
import {
    Avatar, Badge, Box, Button, Checkbox, Group, Loader, NavLink, Popover, Stack, Text,
    TextInput, Tooltip, UnstyledButton,
} from '@mantine/core';
import {DatePicker, TimePicker} from '@mantine/dates';
import {
    Building2, Calendar, Clock, Flag, Search, Truck, User, UserMinus,
} from 'lucide-react';
import dayjs, {Dayjs} from 'dayjs';
import {TaskItemProps, TaskItemConfig, Task} from './TaskItem.interfaces';
import {getIanaTimezone, getTenantTimezone, getTimezoneAbbreviation} from '../../../utils/dateUtils';
import {Icon} from '../icon/Icon';
import classes from './TaskItem.module.css';

/** The string forms the two editors exchange values in. */
const ISO_DATE = 'YYYY-MM-DD';
const TIME_24H = 'HH:mm';

const defaultConfig: TaskItemConfig = {
    showJobId: true,
    showAssignee: true,
    showJobType: true,
    showCourierCode: true,
    showClientCode: true,
    showDateTime: true,
    showStatusIndicators: true,
    allowCompletion: true,
    showOverdueWarning: true,
    onTaskClick: true,
};

type PopoverType = 'date' | 'time' | 'assignee' | null;

const getStatusChip = (task: Task, isOverdue: boolean): {label: string; color: string} => {
    if (task.closed) return {label: 'Done', color: 'green'};
    if (isOverdue) return {label: 'Overdue', color: 'red'};
    return {label: 'To do', color: 'blue'};
};

/** The 4px leading keyline that carries the task's state. */
const getStatusBorderColor = (task: Task, isOverdue: boolean): string => {
    if (task.closed) return 'var(--mantine-color-green-filled)';
    if (isOverdue) return 'var(--mantine-color-red-filled)';
    return 'var(--mantine-primary-color-filled)';
};

const priorityColor: Record<NonNullable<Task['priority']>, string> = {
    high: 'var(--mantine-color-red-filled)',
    medium: 'var(--mantine-color-orange-filled)',
    low: 'var(--mantine-color-blue-filled)',
};

/** First letters of up to two name words, e.g. "John Doe" -> "JD". */
const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

/** Deterministic, readable avatar background derived from the assignee name. */
const getAvatarColor = (name: string): string => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return `hsl(${Math.abs(hash) % 360}, 42%, 42%)`;
};

/**
 * The metadata pills. `Badge` uppercases and truncates by default, and these carry
 * sentence-case labels of arbitrary length, so both are turned off here rather than
 * per pill.
 */
const metadataBadgeProps = {
    size: 'md',
    variant: 'default',
    tt: 'none',
    styles: {label: {overflow: 'visible', textOverflow: 'clip'}},
} as const;

// Compute timezone abbreviation once at module level (it doesn't change per-render)
const ianaTimeZone = getIanaTimezone(getTenantTimezone());
const timeZoneShort = getTimezoneAbbreviation(ianaTimeZone);

export const TaskItem = React.memo(function TaskItem(props: TaskItemProps) {
    const {
        task,
        config: configOverrides,
        onTaskUpdated,
        onTaskClick,
        currentUserId,
        tasksService,
        dispatchService,
        showSuccessToast,
        showErrorToast,
    } = props;

    const config = useMemo(() => ({...defaultConfig, ...configOverrides}), [configOverrides]);
    const compact = config.compactView === true;

    // State
    const [popoverType, setPopoverType] = useState<PopoverType>(null);
    const [timeDraft, setTimeDraft] = useState('');
    const [staffList, setStaffList] = useState<Array<{id: number; text: string}>>([]);
    const [staffSearchText, setStaffSearchText] = useState('');
    const [loadingStaff, setLoadingStaff] = useState(false);
    const [isCompleting, setIsCompleting] = useState(false);
    const [isUnassigning, setIsUnassigning] = useState(false);

    // Derived state
    const isOverdue = useMemo(() => {
        if (task.closed) return false;
        return task.dueDate.isBefore(dayjs());
    }, [task.closed, task.dueDate]);

    const filteredStaff = useMemo(() => {
        if (!staffSearchText) return staffList;
        const searchLower = staffSearchText.toLowerCase();
        return staffList.filter(s => s.text.toLowerCase().includes(searchLower));
    }, [staffList, staffSearchText]);

    const statusChip = useMemo(() => getStatusChip(task, isOverdue), [task, isOverdue]);
    const assigneeName = task.assignee?.text || '';
    const hasAssignee = Boolean(task.assignee?.id);
    const canUnassign = config.showAssignee !== false && hasAssignee;

    // A task may have no due date; guard against rendering the raw "undefined"/"Invalid Date"
    // string and drop the timezone suffix when there's no value to qualify.
    const hasValidDate = (s?: string) => Boolean(s) && s !== 'Invalid Date';
    const dateChipLabel = hasValidDate(task._dueDateString)
        ? `${task._dueDateString} ${timeZoneShort}`.trim()
        : 'Set date';
    const timeChipLabel = hasValidDate(task._dueTimeString)
        ? `${task._dueTimeString} ${timeZoneShort}`.trim()
        : 'Set time';

    // Handlers
    const closePopover = useCallback(() => {
        setPopoverType(null);
    }, []);

    const assignToCurrentUser = useCallback(async () => {
        if (!currentUserId) return;

        try {
            await tasksService.reassignTaskToStaff(task.id, currentUserId);
            showSuccessToast?.('Task assigned to you');
            onTaskUpdated?.();
        } catch (error) {
            showErrorToast?.('Error assigning task');
            console.error('Error assigning task to current user:', error);
        }
    }, [currentUserId, task.id, tasksService, showSuccessToast, showErrorToast, onTaskUpdated]);

    const handleTaskClick = useCallback((event: React.MouseEvent) => {
        if (!config.onTaskClick) return;
        event.stopPropagation();

        // Claim an unassigned, open task for the current user before selecting the job.
        if (config.autoAssignOnClick && currentUserId && currentUserId > 0 && !task.assignee?.id && !task.closed) {
            void assignToCurrentUser();
        }

        onTaskClick?.(task);
    }, [config.onTaskClick, config.autoAssignOnClick, onTaskClick, task, currentUserId, assignToCurrentUser, task.closed]);

    const handleUnassign = useCallback(async (event: React.MouseEvent) => {
        event.stopPropagation();
        setIsUnassigning(true);
        try {
            await tasksService.unassignTask(task.id);
            showSuccessToast?.('Task unassigned');
            onTaskUpdated?.();
        } catch (error) {
            showErrorToast?.('Error unassigning task');
            console.error('Error unassigning task:', error);
        } finally {
            setIsUnassigning(false);
        }
    }, [task.id, tasksService, showSuccessToast, showErrorToast, onTaskUpdated]);

    const handleCheckboxChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        event.stopPropagation();
        const newClosedState = event.target.checked;
        setIsCompleting(true);

        try {
            await tasksService.markTaskAsClosed(task.id, newClosedState);
            showSuccessToast?.('Task completed successfully');
            onTaskUpdated?.();
        } catch (error) {
            showErrorToast?.('Error updating task');
            console.error('Error updating task:', error);
        } finally {
            setIsCompleting(false);
        }
    }, [task.id, tasksService, showSuccessToast, showErrorToast, onTaskUpdated]);

    const openPopover = useCallback((type: Exclude<PopoverType, null>) =>
        (event: React.MouseEvent<HTMLElement>) => {
            event.stopPropagation();
            setPopoverType(type);
        }, []);

    const openTimePopover = useCallback((event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        setTimeDraft(task.dueDate?.isValid() ? task.dueDate.format(TIME_24H) : '');
        setPopoverType('time');
    }, [task.dueDate]);

    const openAssigneePopover = useCallback(async (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        setPopoverType('assignee');
        setLoadingStaff(true);
        setStaffSearchText('');

        try {
            const staff = await dispatchService.getActiveStaff();
            setStaffList(staff || []);
        } catch (error) {
            console.error('Error loading staff:', error);
            showErrorToast?.('Error loading staff list');
        } finally {
            setLoadingStaff(false);
        }
    }, [dispatchService, showErrorToast]);

    /** Moves only the calendar fields of the task's existing due date. */
    const handleDateSelect = useCallback(async (value: string | null) => {
        const picked = value ? dayjs(value) : null;
        if (!picked?.isValid()) return;
        const newDate = (task.dueDate?.isValid() ? task.dueDate : dayjs())
            .year(picked.year()).month(picked.month()).date(picked.date());

        try {
            await tasksService.updateTaskDate(task.id, newDate);
            showSuccessToast?.('Task date updated successfully');
            onTaskUpdated?.();
            closePopover();
        } catch (error) {
            showErrorToast?.('Error updating task date');
            console.error('Error updating task date:', error);
        }
    }, [task.id, task.dueDate, tasksService, showSuccessToast, showErrorToast, onTaskUpdated, closePopover]);

    /**
     * Committed by an explicit button rather than on change: `TimePicker` is a
     * segmented input that fires per segment, and each fire here is an API write.
     * Times are split, not parsed — `dayjs('14:30')` is Invalid Date without the
     * `customParseFormat` plugin.
     */
    const handleTimeApply = useCallback(async () => {
        const [hours, minutes] = (timeDraft ?? '').split(':').map(Number);
        if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return;
        const newTime = (task.dueDate?.isValid() ? task.dueDate : dayjs())
            .hour(hours).minute(minutes).second(0);

        try {
            await tasksService.updateTaskTime(task.id, newTime);
            showSuccessToast?.('Task time updated successfully');
            onTaskUpdated?.();
            closePopover();
        } catch (error) {
            showErrorToast?.('Error updating task time');
            console.error('Error updating task time:', error);
        }
    }, [timeDraft, task.id, task.dueDate, tasksService, showSuccessToast, showErrorToast, onTaskUpdated, closePopover]);

    const handleAssigneeSelect = useCallback(async (staffId: number) => {
        try {
            await tasksService.reassignTaskToStaff(task.id, staffId);
            showSuccessToast?.('Task reassigned successfully');
            onTaskUpdated?.();
            closePopover();
        } catch (error) {
            showErrorToast?.('Error reassigning task');
            console.error('Error reassigning task:', error);
        }
    }, [task.id, tasksService, showSuccessToast, showErrorToast, onTaskUpdated, closePopover]);

    const unassignButton = canUnassign ? (
        <Button
            size="compact-sm"
            variant="default"
            onClick={handleUnassign}
            disabled={isUnassigning}
            aria-label="Unassign task"
            c="dimmed"
            leftSection={isUnassigning
                ? <Loader size={14} color="gray"/>
                : <Icon lucide={UserMinus} size={16}/>}
            style={compact ? undefined : {position: 'absolute', bottom: 8, right: 8}}
        >
            Unassign
        </Button>
    ) : null;

    const titleText = (
        <Text
            className={classes.title}
            size="sm"
            fw={600}
            c={task.closed ? 'dimmed' : undefined}
            td={task.closed ? 'line-through' : undefined}
        >
            {task.title}
        </Text>
    );

    /** The date/time pills are pill-shaped buttons: Mantine's Chip is a checkbox. */
    const pillButtonProps = (overdue: boolean) => overdue
        ? {size: 'md', variant: 'outline', color: 'red', tt: 'none'} as const
        : metadataBadgeProps;

    return (
        <Box
            className={classes.row}
            data-clickable={config.onTaskClick ? true : undefined}
            onClick={handleTaskClick}
            py={compact ? 'xs' : 'sm'}
            px="md"
            mb={2}
            bg={task.closed ? 'var(--mantine-color-default)' : 'var(--mantine-color-body)'}
            c={task.closed ? 'dimmed' : undefined}
            style={{
                alignItems: compact ? 'center' : 'flex-start',
                minHeight: compact ? 44 : 64,
                // Longhands, not the `border-left` shorthand: the class sets `border`,
                // and jsdom drops a shorthand carrying a `var()` (so tests can read it).
                borderLeftWidth: 4,
                borderLeftStyle: 'solid',
                borderLeftColor: getStatusBorderColor(task, isOverdue),
                cursor: config.onTaskClick ? 'pointer' : 'default',
            }}
        >
            {/* Checkbox */}
            {config.allowCompletion !== false && (
                <Checkbox
                    checked={task.closed}
                    onChange={handleCheckboxChange}
                    onClick={(e) => e.stopPropagation()}
                    disabled={isCompleting}
                    aria-label={`Mark "${task.title}" complete`}
                    mr="sm"
                    mt={compact ? 0 : 2}
                />
            )}

            {/* Task Content */}
            <Box style={{flex: 1, minWidth: 0}} mb={compact ? 0 : 'sm'}>
                {/* Headline: priority + title + status */}
                <Group gap="xs" wrap="wrap" mb={compact ? 0 : 4}>
                    {task.priority && (
                        <Tooltip label={`Priority: ${task.priority}`}>
                            <Icon
                                lucide={Flag}
                                size={16}
                                color={priorityColor[task.priority]}
                                aria-label={`Priority: ${task.priority}`}
                            />
                        </Tooltip>
                    )}

                    {config.onTaskClick ? (
                        <UnstyledButton
                            onClick={handleTaskClick}
                            aria-label={`Open task: ${task.title}`}
                            style={{textAlign: 'left'}}
                        >
                            {titleText}
                        </UnstyledButton>
                    ) : titleText}

                    {config.showStatusIndicators !== false && (
                        <Badge color={statusChip.color} variant="filled" size="sm" tt="none">
                            {statusChip.label}
                        </Badge>
                    )}
                </Group>

                {/* Supporting text */}
                {config.showDescription !== false && !compact && task.description && (
                    <Text size="sm" c="dimmed" lineClamp={2} mb="xs">
                        {task.description}
                    </Text>
                )}

                {/* Metadata pills */}
                <Group gap="xs" wrap="wrap" mt={compact ? 0 : 4}>
                    {/* Assignee */}
                    {config.showAssignee !== false && (
                        <Popover
                            opened={popoverType === 'assignee'}
                            onDismiss={closePopover}
                            position="bottom-start"
                            width={280}
                            shadow="md"
                            withinPortal
                        >
                            <Popover.Target>
                                <Badge
                                    {...(hasAssignee ? metadataBadgeProps : {size: 'md', variant: 'outline', tt: 'none'} as const)}
                                    component="button"
                                    type="button"
                                    onClick={openAssigneePopover}
                                    leftSection={hasAssignee
                                        ? (
                                            <Avatar size={18} radius="xl" color="white"
                                                    style={{backgroundColor: getAvatarColor(assigneeName)}}>
                                                {getInitials(assigneeName)}
                                            </Avatar>
                                        )
                                        : <Icon lucide={User} size={14}/>}
                                    style={{cursor: 'pointer'}}
                                >
                                    {assigneeName || 'Unassigned'}
                                </Badge>
                            </Popover.Target>
                            <Popover.Dropdown p={0}>
                                <Box p="xs" style={{borderBottom: '1px solid var(--mantine-color-default-border)'}}>
                                    <TextInput
                                        size="xs"
                                        placeholder="Search staff..."
                                        value={staffSearchText}
                                        onChange={(event) => setStaffSearchText(event.currentTarget.value)}
                                        leftSection={<Icon lucide={Search} size={16}/>}
                                    />
                                </Box>
                                {loadingStaff ? (
                                    <Group justify="center" p="md">
                                        <Loader size="sm" aria-label="Loading staff"/>
                                    </Group>
                                ) : (
                                    <Box py={4} style={{maxHeight: 300, overflowY: 'auto'}}>
                                        {filteredStaff.map((staff) => (
                                            <NavLink
                                                key={staff.id}
                                                component="button"
                                                label={staff.text}
                                                active={staff.id === task.assignee?.id}
                                                onClick={() => handleAssigneeSelect(staff.id)}
                                            />
                                        ))}
                                        {filteredStaff.length === 0 && (
                                            <Text size="sm" c="dimmed" ta="center" p="sm">No staff found</Text>
                                        )}
                                    </Box>
                                )}
                            </Popover.Dropdown>
                        </Popover>
                    )}

                    {/* Job ID */}
                    {config.showJobId !== false && (
                        <Badge
                            size="md"
                            variant="light"
                            tt="none"
                            fw={600}
                            styles={{label: {fontVariantNumeric: 'tabular-nums'}}}
                        >
                            {`Job #${task.jobNumber}`}
                        </Badge>
                    )}

                    {/* Job Type */}
                    {config.showJobType !== false && task.eventType && (
                        <Badge {...metadataBadgeProps}>
                            {task.eventType.charAt(0).toUpperCase() + task.eventType.slice(1)}
                        </Badge>
                    )}

                    {/* Courier */}
                    {config.showCourierCode !== false && task.courierCode && (
                        <Badge {...metadataBadgeProps} leftSection={<Icon lucide={Truck} size={14}/>}>
                            {`Courier: ${task.courierCode}${task.courierName ? ` — ${task.courierName}` : ''}`}
                        </Badge>
                    )}

                    {/* Client */}
                    {config.showClientCode !== false && task.clientCode && (
                        <Badge {...metadataBadgeProps} leftSection={<Icon lucide={Building2} size={14}/>}>
                            {`Client: ${task.clientCode}`}
                        </Badge>
                    )}
                </Group>
            </Box>

            {/* Trailing supporting text: due date / time */}
            {(config.showDateTime !== false || (compact && canUnassign)) && (
                <Box
                    pl="sm"
                    style={{
                        display: 'flex',
                        flexDirection: compact ? 'row' : 'column',
                        alignItems: compact ? 'center' : 'stretch',
                        gap: 4,
                        flexShrink: 0,
                    }}
                >
                    {config.showDateTime !== false && (
                        <>
                            <Popover
                                opened={popoverType === 'date'}
                                onDismiss={closePopover}
                                position="bottom-start"
                                shadow="md"
                                withinPortal
                            >
                                <Popover.Target>
                                    <Badge
                                        {...pillButtonProps(isOverdue)}
                                        component="button"
                                        type="button"
                                        onClick={openPopover('date')}
                                        leftSection={<Icon lucide={Calendar} size={14}/>}
                                        style={{cursor: 'pointer'}}
                                    >
                                        {dateChipLabel}
                                    </Badge>
                                </Popover.Target>
                                <Popover.Dropdown>
                                    {/* `defaultDate` is load-bearing: a Mantine calendar does not
                                        navigate to its `value`, so without it the editor opens on
                                        the current month rather than the task's due month. */}
                                    <DatePicker
                                        aria-label="Task due date"
                                        value={task.dueDate?.isValid() ? task.dueDate.format(ISO_DATE) : null}
                                        defaultDate={task.dueDate?.isValid() ? task.dueDate.format(ISO_DATE) : undefined}
                                        onChange={handleDateSelect}
                                    />
                                </Popover.Dropdown>
                            </Popover>

                            <Popover
                                opened={popoverType === 'time'}
                                onDismiss={closePopover}
                                position="bottom-start"
                                shadow="md"
                                withinPortal
                            >
                                <Popover.Target>
                                    <Badge
                                        {...pillButtonProps(isOverdue)}
                                        component="button"
                                        type="button"
                                        onClick={openTimePopover}
                                        leftSection={<Icon lucide={Clock} size={14}/>}
                                        style={{cursor: 'pointer'}}
                                    >
                                        {timeChipLabel}
                                    </Badge>
                                </Popover.Target>
                                <Popover.Dropdown>
                                    <Stack gap="xs">
                                        <TimePicker
                                            label="Task due time"
                                            format="24h"
                                            value={timeDraft}
                                            onChange={setTimeDraft}
                                            hoursInputLabel="Hours"
                                            minutesInputLabel="Minutes"
                                            withDropdown
                                        />
                                        <Button size="xs" onClick={handleTimeApply} disabled={!timeDraft}>
                                            Set time
                                        </Button>
                                    </Stack>
                                </Popover.Dropdown>
                            </Popover>
                        </>
                    )}
                    {/* Compact rows keep the unassign action inline; non-compact
                        anchors it to the card's bottom-right corner (below). */}
                    {compact && unassignButton}
                </Box>
            )}

            {/* Unassign action — anchored to the card's bottom-right corner. */}
            {!compact && unassignButton}
        </Box>
    );
});

export default TaskItem;
