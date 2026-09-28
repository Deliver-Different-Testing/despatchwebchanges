/**
 * React Task Item Component
 *
 * A dispatch task as a flat two-line row. Line one is the checkbox, the headline and
 * the **due button** (top right); line two is the task's facts as filled key/value
 * chips, with the assignee control trailing.
 *
 * Three rules hold the design together:
 *
 * 1. **Every fact names its own type.** `Job 100482`, `Courier ABC123 — John Smith`,
 *    `Client ACME` — the key word is in the chip, not implied by an icon. Four
 *    unlabelled grey strings in a row are unreadable at a glance, which is what the
 *    icon-led version was.
 * 2. **One hue vocabulary, and it means one thing.** Grey carries facts; red means
 *    late or high priority, orange medium, green done. Nothing else in the row is
 *    coloured — no per-assignee avatar hue, no state keyline competing with the due
 *    button. A row of ordinary tasks is monochrome, so an exception is visible from
 *    across the list.
 * 3. **Fill for facts, hover for controls.** Every chip is filled; the two editable
 *    things — the due instant and the assignee — are the only ones that repaint on
 *    approach. Fill no longer implies clickable; hover does.
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
    Badge, Box, Button, Checkbox, Divider, Group, Loader, NavLink, Popover, SegmentedControl,
    Stack, Text, TextInput, UnstyledButton,
} from '@mantine/core';
import {DatePicker, TimePicker} from '@mantine/dates';
import {Clock, Search, User, UserMinus, UserPlus} from 'lucide-react';
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

/**
 * The row's type scale, published by the stylesheet so a container query can
 * re-scale it for the narrow dispatch Supports box. A Mantine `fz` prop lands as an
 * inline style, which a container query cannot override — hence the variables. The
 * fallbacks cover Jest, where CSS modules are mocked to `{}`.
 */
const FZ_TITLE = 'var(--task-fz-title, var(--mantine-font-size-sm))';
const FZ_BODY = 'var(--task-fz-body, var(--mantine-font-size-sm))';
const FZ_CHIP = 'var(--task-fz-chip, var(--mantine-font-size-xs))';
/** The due button's qualifier for a task due on another day, e.g. "Thu 11". */
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
/** What the due button is painted as. `unset` is a task with no due instant at all. */
type DueState = TaskState | 'unset';
type DueTab = 'date' | 'time';

/**
 * `low` is the default case and gets no chip — only escalations are called out. The
 * two that do share the row's one hue scale rather than introducing colours of
 * their own.
 */
const priorityColor: Partial<Record<NonNullable<Task['priority']>, string>> = {
    high: 'red',
    medium: 'orange',
};

/**
 * Chips are filled, not tinted. Mantine's `light` variant is a ~10% wash, which on a
 * white row reads as plain text with a faint halo — the thing this row was rebuilt to
 * stop doing.
 *
 * The shade differs per ramp because the theme's ramps do not share a lightness
 * curve: the neutral is a warm near-white family (`gray.2` is `#f4f2f1`, invisible on
 * a white row) while `red`/`orange` reach a real tint two steps in. Picking one shade
 * number for all three is what makes a "filled" chip disappear.
 */
const factTone: Record<string, {bg: string; fg: string}> = {
    gray: {bg: 'gray.3', fg: 'gray.8'},
    red: {bg: 'red.2', fg: 'red.9'},
    orange: {bg: 'orange.2', fg: 'orange.9'},
};

/**
 * A task may have no due date; guard against rendering the raw
 * "undefined"/"Invalid Date" string the formatters produce for one.
 */
const hasValidDate = (s?: string): boolean => Boolean(s) && s !== 'Invalid Date';

// Compute timezone abbreviation once at module level (it doesn't change per-render)
const ianaTimeZone = getIanaTimezone(getTenantTimezone());
const timeZoneShort = getTimezoneAbbreviation(ianaTimeZone);

interface FactProps {
    /** The datum's type, e.g. "Courier". Omitted where the value is self-naming. */
    label?: string;
    /** Suppresses `label` — the compact row has no width for the key words. */
    hideLabel?: boolean;
    value: string;
    /** Test/QA hook — Lucide and Tabler emit none of their own. */
    stamp: string;
    color?: string;
    maw?: number;
}

/**
 * One filled key/value chip. Mantine's `Badge` is uppercase 700 by default, which is
 * both a shouted label and the "bold" half of the old row's flat/bold mix — hence
 * the explicit `tt`/`fw`.
 */
const Fact = ({label, value, stamp, hideLabel, color = 'gray', maw}: FactProps) => (
    <Badge
        variant="light"
        color={color}
        size="sm"
        radius="sm"
        tt="none"
        fz={FZ_CHIP}
        fw={500}
        bg={(factTone[color] ?? factTone.gray).bg}
        c={(factTone[color] ?? factTone.gray).fg}
        maw={maw}
        data-task-meta={stamp}
    >
        {label && !hideLabel && (
            <Text span inherit fw={400} mr={5} style={{opacity: 0.72}}>
                {label}
            </Text>
        )}
        <Text span inherit fw={600}>{value}</Text>
    </Badge>
);

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
    const [dueTab, setDueTab] = useState<DueTab>('date');
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
    const hasDueInstant = hasDueTime || hasValidDate(task._dueDateString);

    const dueState: DueState = !hasDueInstant ? 'unset'
        : stateEmphasis ? taskState
        : 'open';

    /**
     * The due button's second segment. The time alone already means "today", so a
     * qualifier appears only where it would otherwise mislead — which is also what
     * keeps the button from echoing the task dashboard's sticky Today / Tomorrow /
     * Overdue group headers.
     */
    const dueQualifier = useMemo(() => {
        if (!task.dueDate?.isValid()) return null;
        if (taskState === 'overdue' && stateEmphasis) return formatRelativeTime(task.dueDate.toDate());
        if (compact || task.dueDate.isSame(dayjs(), 'day')) return null;
        return task.dueDate.format(DAY_LABEL);
    }, [compact, task.dueDate, taskState, stateEmphasis]);

    /** The absolute due instant, named in full for the control and the popover head. */
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

    /** One control, two named options: the time editor is seeded as the popover opens. */
    const openDuePopover = useCallback((event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        setTimeDraft(task.dueDate?.isValid() ? task.dueDate.format(TIME_24H) : '');
        setDueTab('date');
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
     * Moves only the calendar fields of the task's existing due date, then advances to
     * the Time option so date-then-time is still one visit.
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
            setDueTab('time');
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
            fz={FZ_TITLE}
            fw={600}
            truncate
            title={task.title}
            c={task.closed ? 'dimmed' : undefined}
            td={task.closed ? 'line-through' : undefined}
        >
            {task.title}
        </Text>
    );

    const titleNode = config.onTaskClick ? (
        <UnstyledButton
            onClick={handleTaskClick}
            aria-label={`Open task: ${task.title}`}
            style={{textAlign: 'left', flex: 1, minWidth: 0}}
        >
            {titleText}
        </UnstyledButton>
    ) : <Box style={{flex: 1, minWidth: 0}}>{titleText}</Box>;

    /** Top right, and the only place a colour appears on an ordinary row. */
    const dueControl = config.showDateTime === false ? null : (
        <Popover
            opened={popoverType === 'due'}
            onDismiss={closePopover}
            position="bottom-end"
            width={272}
            shadow="md"
            withinPortal
        >
            <Popover.Target>
                <UnstyledButton
                    className={classes.due}
                    data-due-state={dueState}
                    onClick={openDuePopover}
                    aria-label={`Due ${dueSummary} — edit date and time`}
                    title={dueSummary}
                    px={7}
                    py={3}
                    style={{flexShrink: 0}}
                >
                    <Group gap={5} wrap="nowrap">
                        <Icon lucide={Clock} size={13}/>
                        <Text
                            span
                            fz={FZ_CHIP}
                            fw={600}
                            style={{fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap'}}
                        >
                            {hasDueTime ? task._dueTimeString : (hasDueInstant ? task._dueDateString : 'Set due')}
                        </Text>
                        {dueQualifier && (
                            <Text span fz={FZ_CHIP} fw={400} style={{whiteSpace: 'nowrap', opacity: 0.78}}>
                                {dueQualifier}
                            </Text>
                        )}
                    </Group>
                </UnstyledButton>
            </Popover.Target>
            <Popover.Dropdown p="xs">
                <Stack gap="xs">
                    <Text fz="xs" c="dimmed">{`Due ${dueSummary}`}</Text>
                    <SegmentedControl
                        size="xs"
                        fullWidth
                        value={dueTab}
                        onChange={(value) => setDueTab(value as DueTab)}
                        data={[{label: 'Date', value: 'date'}, {label: 'Time', value: 'time'}]}
                    />
                    {dueTab === 'date' ? (
                        /* `defaultDate` is load-bearing: a Mantine calendar does not
                           navigate to its `value`, so without it the editor opens on
                           the current month rather than the task's due month. */
                        <DatePicker
                            aria-label="Task due date"
                            size="sm"
                            value={task.dueDate?.isValid() ? task.dueDate.format(ISO_DATE) : null}
                            defaultDate={task.dueDate?.isValid() ? task.dueDate.format(ISO_DATE) : undefined}
                            onChange={handleDateSelect}
                        />
                    ) : (
                        <>
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
                        </>
                    )}
                </Stack>
            </Popover.Dropdown>
        </Popover>
    );

    /** Trailing content on the fact line, and the home of the unassign action. */
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
                    data-assigned={hasAssignee ? true : undefined}
                    onClick={openAssigneePopover}
                    aria-label={hasAssignee ? `Assigned to ${assigneeName} — change assignee` : 'Assign task'}
                    px={7}
                    py={3}
                    maw={compact ? 132 : 200}
                    style={{flexShrink: 0}}
                >
                    <Group gap={5} wrap="nowrap">
                        <Icon lucide={hasAssignee ? User : UserPlus} size={13}/>
                        {hasAssignee && (
                            <Text span fz={FZ_CHIP} fw={400} className={classes.assigneeKey} style={{opacity: 0.72}}>
                                Assignee
                            </Text>
                        )}
                        <Text span fz={FZ_CHIP} fw={600} truncate>
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

    /** Every datum the task carries, each chip naming its own type. */
    const facts = (
        <>
            {task.priority && priorityColor[task.priority] && (
                <Fact
                    stamp="priority"
                    hideLabel={compact}
                    color={priorityColor[task.priority]}
                    label="Priority"
                    value={task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                />
            )}

            {config.showJobId !== false && (
                <Fact stamp="jobNumber"
                    hideLabel={compact} label="Job" value={task.jobNumber}/>
            )}

            {config.showJobType !== false && task.eventType && (
                <Fact
                    stamp="jobType"
                    hideLabel={compact}
                    value={task.eventType.charAt(0).toUpperCase() + task.eventType.slice(1)}
                />
            )}

            {config.showCourierCode !== false && task.courierCode && (
                <Fact
                    stamp="courier"
                    hideLabel={compact}
                    label="Courier"
                    maw={compact ? 150 : 260}
                    value={`${task.courierCode}${task.courierName ? ` — ${task.courierName}` : ''}`}
                />
            )}

            {config.showClientCode !== false && task.clientCode && (
                <Fact stamp="client"
                    hideLabel={compact} label="Client" maw={compact ? 120 : 200} value={task.clientCode}/>
            )}
        </>
    );

    return (
        <Box
            className={classes.row}
            data-task-state={taskState}
            data-clickable={config.onTaskClick ? true : undefined}
            onClick={handleTaskClick}
            py={compact ? 7 : 'xs'}
            px="sm"
            mb={2}
            bg={task.closed ? 'var(--mantine-color-gray-0)' : 'var(--mantine-color-body)'}
            style={{
                gap: 8,
                alignItems: 'flex-start',
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
                    color="green"
                    mt={compact ? 2 : 3}
                    style={{flexShrink: 0}}
                />
            )}

            {/* One anatomy at both densities. `compact` tightens the padding and drops
                the description, the day qualifier and the chips' key words — it does
                not get a layout of its own, because a single-line variant either
                clips every chip to two characters or wraps anyway. */}
            <Stack gap={compact ? 4 : 6} style={{flex: 1, minWidth: 0}}>
                <Group gap={8} wrap="nowrap" align="center">
                    {titleNode}
                    {dueControl}
                </Group>

                {/* Supporting text — often the actual instruction, so two lines of it. */}
                {config.showDescription !== false && !compact && task.description && (
                    <Text fz={FZ_BODY} c="dimmed" lineClamp={2}>
                        {task.description}
                    </Text>
                )}

                <Group className={classes.factLine} gap={5} wrap="wrap" align="center" style={{minWidth: 0}}>
                    {facts}
                    {assigneeControl}
                </Group>
            </Stack>
        </Box>
    );
});

export default TaskItem;
