/**
 * React Task Item Component
 *
 * A dispatch task as a run-sheet line. Anatomy: state keyline, completion checkbox,
 * **due rail** (bold tabular time over a day / "how late" line), headline, plain-text
 * metadata, and a trailing assignee control.
 *
 * Two rules hold the design together:
 *
 * 1. **A control shape means "you can change this."** Only the due instant and the
 *    assignee are editable, so only those two are buttons; the job number, event
 *    type, courier and client are plain text. Everything used to be an identical
 *    `Badge`, which made the controls invisible and the facts look clickable.
 * 2. **Ink is spent on exceptions.** No status word (the keyline and the rail carry
 *    state), no day line on a task due today, no mark for `low` priority.
 *
 * **Wall-clock only.** The date editor is Mantine's string-valued `DatePicker`
 * (`YYYY-MM-DD`) and the time editor its `TimePicker` (`HH:mm`), so neither builds
 * an instant. Both are applied to the task's existing `dueDate` by setting calendar
 * fields, which is what `tasksService.updateTaskDate/Time` already expect. The
 * *displayed* date and time stay `task._dueDateString`/`_dueTimeString` — that
 * formatting is tenant/locale-owned and must not be re-derived here.
 */

import React, {useState, useMemo, useCallback} from 'react';
import {
    Avatar, Box, Button, Checkbox, Divider, Group, Loader, NavLink, Popover, Stack, Text,
    TextInput, Tooltip, UnstyledButton,
} from '@mantine/core';
import {DatePicker, TimePicker} from '@mantine/dates';
import {Building2, Flag, Search, Truck, User, UserMinus} from 'lucide-react';
import dayjs from 'dayjs';
import {TaskItemProps, TaskItemConfig, Task} from './TaskItem.interfaces';
import {
    formatRelativeTime, getIanaTimezone, getTenantTimezone, getTimezoneAbbreviation,
} from '../../../utils/dateUtils';
import {Icon} from '../icon/Icon';
import classes from './TaskItem.module.css';

/** The string forms the two editors exchange values in. */
const ISO_DATE = 'YYYY-MM-DD';
const TIME_24H = 'HH:mm';
/** The rail's second line for a task due on another day, e.g. "Thu 11". */
const DAY_LABEL = 'ddd D';

const defaultConfig: TaskItemConfig = {
    showJobId: true,
    showAssignee: true,
    showJobType: true,
    showCourierCode: true,
    showClientCode: true,
    showDateTime: true,
    showStatusIndicators: true,
    allowCompletion: true,
    onTaskClick: true,
};

type PopoverType = 'due' | 'assignee' | null;
type TaskState = 'open' | 'overdue' | 'done';

/** The 4px leading keyline that carries the task's state. */
const NEUTRAL_KEYLINE = 'var(--mantine-color-default-border)';
const keylineColor: Record<TaskState, string> = {
    done: 'var(--mantine-color-green-filled)',
    overdue: 'var(--mantine-color-red-filled)',
    // `open` is the 90% case: a colour here would compete with the two exceptions.
    open: NEUTRAL_KEYLINE,
};

/** `low` is the default case and gets no mark — only escalations are flagged. */
const priorityColor: Partial<Record<NonNullable<Task['priority']>, string>> = {
    high: 'var(--mantine-color-red-filled)',
    medium: 'var(--mantine-color-orange-filled)',
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
 * A task may have no due date; guard against rendering the raw
 * "undefined"/"Invalid Date" string the formatters produce for one.
 */
const hasValidDate = (s?: string): boolean => Boolean(s) && s !== 'Invalid Date';

/** Metadata is plain text — the leading icon is the label, so the value carries none. */
const metaTextProps = {fz: 'xs', c: 'dimmed'} as const;
const metaIconColor = 'var(--mantine-color-dimmed)';

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
    const stateEmphasis = config.showStatusIndicators !== false;

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

    const taskState: TaskState = task.closed ? 'done' : isOverdue ? 'overdue' : 'open';

    const filteredStaff = useMemo(() => {
        if (!staffSearchText) return staffList;
        const searchLower = staffSearchText.toLowerCase();
        return staffList.filter(s => s.text.toLowerCase().includes(searchLower));
    }, [staffList, staffSearchText]);

    const assigneeName = task.assignee?.text || '';
    const hasAssignee = Boolean(task.assignee?.id);

    const hasDueTime = hasValidDate(task._dueTimeString);

    /**
     * The rail's second line. A bare time already means "today", so a label appears
     * only when the time alone would mislead — which is also what keeps the rail from
     * echoing the task dashboard's sticky Today/Tomorrow/Overdue group headers.
     */
    const dueDayLabel = useMemo(() => {
        if (compact || !task.dueDate?.isValid()) return null;
        if (taskState === 'overdue' && stateEmphasis) return formatRelativeTime(task.dueDate.toDate());
        if (task.dueDate.isSame(dayjs(), 'day')) return null;
        return task.dueDate.format(DAY_LABEL);
    }, [compact, task.dueDate, taskState, stateEmphasis]);

    /** The absolute due instant, kept on the control rather than repeated in the row. */
    const dueSummary = useMemo(() => {
        const parts = [task._dueDateString, task._dueTimeString].filter(hasValidDate);
        return parts.length ? `${parts.join(' ')} ${timeZoneShort}`.trim() : 'not set';
    }, [task._dueDateString, task._dueTimeString]);

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
    }, [config.onTaskClick, config.autoAssignOnClick, onTaskClick, task, currentUserId, assignToCurrentUser]);

    const handleUnassign = useCallback(async (event: React.MouseEvent) => {
        event.stopPropagation();
        setIsUnassigning(true);
        try {
            await tasksService.unassignTask(task.id);
            showSuccessToast?.('Task unassigned');
            onTaskUpdated?.();
            closePopover();
        } catch (error) {
            showErrorToast?.('Error unassigning task');
            console.error('Error unassigning task:', error);
        } finally {
            setIsUnassigning(false);
        }
    }, [task.id, tasksService, showSuccessToast, showErrorToast, onTaskUpdated, closePopover]);

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

    /** One control, one popover: the time editor is seeded as the popover opens. */
    const openDuePopover = useCallback((event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        setTimeDraft(task.dueDate?.isValid() ? task.dueDate.format(TIME_24H) : '');
        setPopoverType('due');
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

    /**
     * Moves only the calendar fields of the task's existing due date. The popover
     * stays open afterwards so date-then-time is one visit.
     */
    const handleDateSelect = useCallback(async (value: string | null) => {
        const picked = value ? dayjs(value) : null;
        if (!picked?.isValid()) return;
        const newDate = (task.dueDate?.isValid() ? task.dueDate : dayjs())
            .year(picked.year()).month(picked.month()).date(picked.date());

        try {
            await tasksService.updateTaskDate(task.id, newDate);
            showSuccessToast?.('Task date updated successfully');
            onTaskUpdated?.();
        } catch (error) {
            showErrorToast?.('Error updating task date');
            console.error('Error updating task date:', error);
        }
    }, [task.id, task.dueDate, tasksService, showSuccessToast, showErrorToast, onTaskUpdated]);

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

    const titleText = (
        <Text
            className={classes.title}
            size="sm"
            fw={600}
            truncate
            title={task.title}
            c={task.closed ? 'dimmed' : undefined}
            td={task.closed ? 'line-through' : undefined}
        >
            {task.title}
        </Text>
    );

    /** The loudest thing in the row, and the only one: the due time. */
    const dueRail = config.showDateTime === false ? null : (
        <Popover
            opened={popoverType === 'due'}
            onDismiss={closePopover}
            position="bottom-start"
            shadow="md"
            withinPortal
        >
            <Popover.Target>
                <UnstyledButton
                    className={classes.dueRail}
                    onClick={openDuePopover}
                    aria-label={`Due ${dueSummary} — edit date and time`}
                    title={dueSummary}
                    w={96}
                    px={6}
                    ta="right"
                    style={{flexShrink: 0}}
                >
                    <Text
                        fz={hasDueTime && !compact ? 'md' : 'sm'}
                        fw={700}
                        c={hasDueTime ? (taskState === 'overdue' && stateEmphasis ? 'red' : undefined) : 'dimmed'}
                        style={{fontVariantNumeric: 'tabular-nums', lineHeight: 1.2, whiteSpace: 'nowrap'}}
                    >
                        {hasDueTime ? task._dueTimeString : 'Set due'}
                    </Text>
                    {dueDayLabel && (
                        <Text
                            fz="xs"
                            c={taskState === 'overdue' && stateEmphasis ? 'red' : 'dimmed'}
                            style={{lineHeight: 1.3}}
                        >
                            {dueDayLabel}
                        </Text>
                    )}
                </UnstyledButton>
            </Popover.Target>
            <Popover.Dropdown>
                <Stack gap="sm">
                    {/* `defaultDate` is load-bearing: a Mantine calendar does not
                        navigate to its `value`, so without it the editor opens on
                        the current month rather than the task's due month. */}
                    <DatePicker
                        aria-label="Task due date"
                        value={task.dueDate?.isValid() ? task.dueDate.format(ISO_DATE) : null}
                        defaultDate={task.dueDate?.isValid() ? task.dueDate.format(ISO_DATE) : undefined}
                        onChange={handleDateSelect}
                    />
                    <Divider/>
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
    );

    /** Trailing content, and the home of the unassign action. */
    const assigneeControl = config.showAssignee === false ? null : (
        <Popover
            opened={popoverType === 'assignee'}
            onDismiss={closePopover}
            position="bottom-end"
            width={280}
            shadow="md"
            withinPortal
        >
            <Popover.Target>
                <UnstyledButton
                    className={classes.assignee}
                    onClick={openAssigneePopover}
                    aria-label={hasAssignee ? `Assigned to ${assigneeName} — change assignee` : 'Assign task'}
                    px={8}
                    py={3}
                    maw={148}
                    mt={compact ? 0 : 1}
                    style={{flexShrink: 0}}
                >
                    <Group gap={6} wrap="nowrap">
                        {hasAssignee ? (
                            <Avatar
                                size={22}
                                radius="xl"
                                color="white"
                                style={{backgroundColor: getAvatarColor(assigneeName)}}
                            >
                                {getInitials(assigneeName)}
                            </Avatar>
                        ) : (
                            <Avatar
                                size={22}
                                radius="xl"
                                c="dimmed"
                                style={{border: `1px dashed ${metaIconColor}`, backgroundColor: 'transparent'}}
                            >
                                <Icon lucide={User} size={13}/>
                            </Avatar>
                        )}
                        <Text
                            className={classes.assigneeName}
                            fz="xs"
                            c={hasAssignee ? undefined : 'dimmed'}
                            truncate
                        >
                            {hasAssignee ? assigneeName : 'Assign'}
                        </Text>
                    </Group>
                </UnstyledButton>
            </Popover.Target>
            <Popover.Dropdown p={0}>
                {/* The action that clears the assignee lives with the thing it changes. */}
                {hasAssignee && (
                    <>
                        <NavLink
                            component="button"
                            type="button"
                            label="Unassign"
                            aria-label="Unassign task"
                            onClick={handleUnassign}
                            disabled={isUnassigning}
                            leftSection={isUnassigning
                                ? <Loader size={14} color="gray"/>
                                : <Icon lucide={UserMinus} size={16}/>}
                        />
                        <Divider/>
                    </>
                )}
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
    );

    return (
        <Box
            className={classes.row}
            data-task-state={taskState}
            data-clickable={config.onTaskClick ? true : undefined}
            onClick={handleTaskClick}
            py={compact ? 6 : 'xs'}
            px="sm"
            mb={2}
            bg={task.closed ? 'var(--mantine-color-default)' : 'var(--mantine-color-body)'}
            c={task.closed ? 'dimmed' : undefined}
            style={{
                gap: 8,
                alignItems: compact ? 'center' : 'flex-start',
                // Longhands, not the `border-left` shorthand: the class sets `border`,
                // and jsdom drops a shorthand carrying a `var()` (so tests can read it).
                borderLeftWidth: 4,
                borderLeftStyle: 'solid',
                borderLeftColor: stateEmphasis ? keylineColor[taskState] : NEUTRAL_KEYLINE,
                cursor: config.onTaskClick ? 'pointer' : 'default',
            }}
        >
            {config.allowCompletion !== false && (
                <Checkbox
                    checked={task.closed}
                    onChange={handleCheckboxChange}
                    onClick={(e) => e.stopPropagation()}
                    disabled={isCompleting}
                    aria-label={`Mark "${task.title}" complete`}
                    mt={compact ? 0 : 3}
                    style={{flexShrink: 0}}
                />
            )}

            {dueRail}

            <Box style={{flex: 1, minWidth: 0}}>
                {/* Headline: priority + title */}
                <Group gap={6} wrap="nowrap" align="center" style={{minWidth: 0}}>
                    {task.priority && priorityColor[task.priority] && (
                        <Tooltip label={`Priority: ${task.priority}`}>
                            <Icon
                                lucide={Flag}
                                size={15}
                                color={priorityColor[task.priority]}
                                aria-label={`Priority: ${task.priority}`}
                            />
                        </Tooltip>
                    )}

                    {config.onTaskClick ? (
                        <UnstyledButton
                            onClick={handleTaskClick}
                            aria-label={`Open task: ${task.title}`}
                            style={{textAlign: 'left', flex: 1, minWidth: 0}}
                        >
                            {titleText}
                        </UnstyledButton>
                    ) : titleText}
                </Group>

                {/* Supporting text — often the actual instruction, so two lines of it. */}
                {config.showDescription !== false && !compact && task.description && (
                    <Text size="sm" c="dimmed" lineClamp={2} mt={2}>
                        {task.description}
                    </Text>
                )}

                {/* Metadata: plain text, icon-led, no label prefixes. */}
                <Group
                    className={classes.metaLine}
                    gap={12}
                    wrap={compact ? 'nowrap' : 'wrap'}
                    mt={compact ? 0 : 3}
                    style={compact ? {overflow: 'hidden'} : undefined}
                >
                    {config.showJobId !== false && (
                        <Text
                            {...metaTextProps}
                            data-task-meta="jobNumber"
                            fw={600}
                            style={{fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap'}}
                        >
                            {`#${task.jobNumber}`}
                        </Text>
                    )}

                    {config.showJobType !== false && task.eventType && (
                        <Text {...metaTextProps} data-task-meta="jobType" style={{whiteSpace: 'nowrap'}}>
                            {task.eventType.charAt(0).toUpperCase() + task.eventType.slice(1)}
                        </Text>
                    )}

                    {config.showCourierCode !== false && task.courierCode && (
                        <Group gap={4} wrap="nowrap" data-task-meta="courier" style={{minWidth: 0}}>
                            <Icon lucide={Truck} size={13} color={metaIconColor}/>
                            <Text {...metaTextProps} truncate>
                                {`${task.courierCode}${task.courierName ? ` — ${task.courierName}` : ''}`}
                            </Text>
                        </Group>
                    )}

                    {config.showClientCode !== false && task.clientCode && (
                        <Group gap={4} wrap="nowrap" data-task-meta="client" style={{minWidth: 0}}>
                            <Icon lucide={Building2} size={13} color={metaIconColor}/>
                            <Text {...metaTextProps} truncate>{task.clientCode}</Text>
                        </Group>
                    )}
                </Group>
            </Box>

            {assigneeControl}
        </Box>
    );
});

export default TaskItem;
