import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Box, Checkbox, Paper, Select, Table, Text,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { CalendarOff, ListChecks, ListPlus } from 'lucide-react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {
    DialogShell, DialogHeader, DialogFooter, dialogContentBg, dialogSize, sectionPaperProps,
} from '../shared/mantine';
import { EventGroupViewModel, StaffSuggestion } from '../../../types';
import { formatDateForApi, getInputDateFormat, getTimezoneAbbreviation } from '../../../utils/dateUtils';
import { Icon } from '../../common/icon/Icon';
import { NoData } from '../../common/no-data/NoData';

dayjs.extend(utc);
dayjs.extend(timezone);

/** The string form `DateTimePicker` exchanges values in. */
const PICKER_VALUE_FORMAT = 'YYYY-MM-DD HH:mm';

/** Mantine table heads are sentence-case by default; this restores the tracked caps. */
const thProps = {fz: 'xs', fw: 600, tt: 'uppercase', style: {letterSpacing: '0.05em'}} as const;

const NOTHING_SELECTED = 'Select at least one task to add.';

const taskCountLabel = (count: number) => `${count} task${count === 1 ? '' : 's'}`;

export interface EventGroupDialogProps {
    open: boolean;
    events: EventGroupViewModel[];
    users: StaffSuggestion[];
    jobNumber?: string;
    onClose: () => void;
    onSave: (events: EventGroupViewModel[]) => Promise<void>;
    onOpenAdminManager: () => void;
    timezone: string;
}

export const EventGroupDialog: React.FC<EventGroupDialogProps> = ({
    open,
    events,
    users,
    jobNumber,
    onClose,
    onSave,
    onOpenAdminManager,
    timezone: tz,
}) => {
    const [localEvents, setLocalEvents] = useState<EventGroupViewModel[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showNothingSelected, setShowNothingSelected] = useState(false);

    // The dialog host keeps this instance mounted between opens, so each open starts fresh.
    useEffect(() => {
        if (!open) return;
        setIsSubmitting(false);
        setShowNothingSelected(false);
        if (events.length > 0) {
            setLocalEvents(events.map(e => ({ ...e })));
        }
    }, [open, events]);

    const handleDueDateChange = useCallback((index: number, value: string | null) => {
        const parsed = value ? dayjs(value) : null;
        if (!parsed?.isValid()) return;
        setLocalEvents(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], dueTime: parsed.toDate() };
            return updated;
        });
    }, []);

    const handleUserChange = useCallback((index: number, user: StaffSuggestion | null) => {
        setLocalEvents(prev => {
            const updated = [...prev];
            updated[index] = {
                ...updated[index],
                assignTo: user ? { id: user.id, text: user.text } : undefined,
            };
            return updated;
        });
    }, []);

    const handleActiveToggle = useCallback((index: number) => {
        setShowNothingSelected(false);
        setLocalEvents(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], active: !updated[index].active };
            return updated;
        });
    }, []);

    const handleToggleAll = useCallback((active: boolean) => {
        setShowNothingSelected(false);
        setLocalEvents(prev => prev.map(e => ({ ...e, active })));
    }, []);

    const handleSave = useCallback(async () => {
        const activeEvents = localEvents.filter(e => e.active);
        if (activeEvents.length === 0) {
            setShowNothingSelected(true);
            return;
        }

        setIsSubmitting(true);
        try {
            const formattedEvents = activeEvents.map(event => ({
                ...event,
                dueTime: event.dueTime ? formatDateForApi(event.dueTime, tz) : undefined,
            }));
            await onSave(formattedEvents);
        } catch {
            setIsSubmitting(false);
        }
    }, [localEvents, onSave, tz]);

    // `Select` is string-valued, so the staff ids round-trip through
    // `String()`/`Number()` and the picked option is mapped back to its record.
    const userOptions = useMemo(
        () => users.map(({id, text}) => ({value: String(id), label: text})),
        [users],
    );

    const hasEvents = localEvents.length > 0;
    const selectedCount = localEvents.filter(e => e.active).length;
    const allSelected = hasEvents && selectedCount === localEvents.length;
    const groupName = localEvents[0]?.group ?? events[0]?.group;
    const tzAbbreviation = getTimezoneAbbreviation(tz);

    return (
        <DialogShell opened={open} onClose={onClose} size={dialogSize.lg} label="Add tasks from a task group">
            <DialogHeader
                icon={<Icon lucide={ListChecks}/>}
                title={groupName ? `Add tasks from "${groupName}"` : 'Task groups'}
                subtitle={jobNumber ? `Job ${jobNumber}` : undefined}
                onClose={onClose}
                closeDisabled={isSubmitting}
            />

            <Box p="lg" bg={dialogContentBg}>
                {hasEvents ? (
                    <Paper {...sectionPaperProps}>
                        <Table highlightOnHover layout="fixed" verticalSpacing="sm">
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th w={44}>
                                        <Checkbox
                                            aria-label="Include all tasks"
                                            checked={allSelected}
                                            indeterminate={selectedCount > 0 && !allSelected}
                                            onChange={() => handleToggleAll(!allSelected)}
                                            disabled={isSubmitting}
                                        />
                                    </Table.Th>
                                    <Table.Th w={44} {...thProps}>#</Table.Th>
                                    <Table.Th w="30%" {...thProps}>Task</Table.Th>
                                    <Table.Th {...thProps}>
                                        Due date
                                        {tzAbbreviation && (
                                            <Text size="xs" c="dimmed" fs="italic" tt="none" fw={400}>
                                                {tzAbbreviation}
                                            </Text>
                                        )}
                                    </Table.Th>
                                    <Table.Th {...thProps}>Assign to</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {localEvents.map((item, index) => {
                                    const inputsDisabled = isSubmitting || !item.active;
                                    return (
                                        <Table.Tr key={item.eventTypeGroupTypeGroupId}>
                                            <Table.Td>
                                                <Checkbox
                                                    aria-label={`Include ${item.eventType.text}`}
                                                    checked={item.active}
                                                    onChange={() => handleActiveToggle(index)}
                                                    disabled={isSubmitting}
                                                />
                                            </Table.Td>
                                            <Table.Td c="dimmed">{item.sequence}</Table.Td>
                                            <Table.Td fw={500} c={item.active ? undefined : 'dimmed'}>
                                                {item.eventType.text}
                                            </Table.Td>
                                            <Table.Td>
                                                <DateTimePicker
                                                    aria-label={`Due date for ${item.eventType.text}`}
                                                    value={item.dueTime ? dayjs(item.dueTime).format(PICKER_VALUE_FORMAT) : null}
                                                    onChange={(value) => handleDueDateChange(index, value)}
                                                    valueFormat={`${getInputDateFormat()} HH:mm`}
                                                    timePickerProps={{format: '24h', withDropdown: true}}
                                                    disabled={inputsDisabled}
                                                    size="sm"
                                                />
                                            </Table.Td>
                                            <Table.Td>
                                                <Select
                                                    aria-label={`Assign ${item.eventType.text} to`}
                                                    placeholder="Search users…"
                                                    data={userOptions}
                                                    value={item.assignTo ? String(item.assignTo.id) : null}
                                                    onChange={(value) => handleUserChange(
                                                        index,
                                                        users.find(u => String(u.id) === value) ?? null,
                                                    )}
                                                    searchable
                                                    clearable
                                                    disabled={inputsDisabled}
                                                    size="sm"
                                                />
                                            </Table.Td>
                                        </Table.Tr>
                                    );
                                })}
                            </Table.Tbody>
                        </Table>
                        {showNothingSelected && (
                            <Text c="red" size="sm" mt="sm" role="alert">{NOTHING_SELECTED}</Text>
                        )}
                    </Paper>
                ) : (
                    <NoData
                        title="No task groups yet"
                        message="Get started by adding task types in the Admin Manager to create your first task group."
                        icon={<Icon lucide={CalendarOff}/>}
                        showAction={true}
                        actionText="Open admin manager"
                        onAction={onOpenAdminManager}
                    />
                )}
            </Box>

            <DialogFooter
                onCancel={onClose}
                onConfirm={handleSave}
                confirmLabel={isSubmitting ? 'Adding…' : `Add ${taskCountLabel(selectedCount)}`}
                confirmIcon={<Icon lucide={ListPlus} size={16}/>}
                confirmDisabled={!hasEvents}
                submitting={isSubmitting}
            />
        </DialogShell>
    );
};

export default EventGroupDialog;
