import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Avatar, Badge, Box, Checkbox, Paper, Select, Stack, Table, Text,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { CalendarOff, ListChecks, Save } from 'lucide-react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { DialogShell, DialogHeader, DialogFooter, dialogContentBg } from '../shared/mantine';
import { EventGroupViewModel, StaffSuggestion } from '../../../types';
import { getInputDateFormat, getTimezoneAbbreviation } from '../../../utils/dateUtils';
import { Icon } from '../../common/icon/Icon';
import { NoData } from '../../common/no-data/NoData';
import type { ShowToastFn } from '../../../services/toastService';

dayjs.extend(utc);
dayjs.extend(timezone);

/** The string form `DateTimePicker` exchanges values in. */
const PICKER_VALUE_FORMAT = 'YYYY-MM-DD HH:mm';

/** Mantine table heads are sentence-case by default; this restores the tracked caps. */
const thProps = {fz: 'xs', fw: 600, tt: 'uppercase', style: {letterSpacing: '0.05em'}} as const;

export interface EventGroupDialogProps {
    open: boolean;
    events: EventGroupViewModel[];
    users: StaffSuggestion[];
    onClose: () => void;
    onSave: (events: EventGroupViewModel[]) => Promise<void>;
    onOpenAdminManager: () => void;
    showToast: ShowToastFn;
    timezone: string;
}

export const EventGroupDialog: React.FC<EventGroupDialogProps> = ({
    open,
    events,
    users,
    onClose,
    onSave,
    onOpenAdminManager,
    showToast,
    timezone: tz,
}) => {
    const [localEvents, setLocalEvents] = useState<EventGroupViewModel[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset local state when dialog opens with new events
    useEffect(() => {
        if (open && events.length > 0) {
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
        setLocalEvents(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], active: !updated[index].active };
            return updated;
        });
    }, []);

    const handleSave = useCallback(async () => {
        const activeEvents = localEvents.filter(e => e.active);
        if (activeEvents.length === 0) {
            showToast('Select at least one event to add to the job', 'warning');
            return;
        }

        setIsSubmitting(true);
        try {
            const formattedEvents = activeEvents.map(event => ({
                ...event,
                dueTime: event.dueTime ? dayjs(event.dueTime).format() : undefined,
            }));
            await onSave(formattedEvents);
        } catch {
            setIsSubmitting(false);
        }
    }, [localEvents, onSave, showToast]);

    // `Select` is string-valued, so the staff ids round-trip through
    // `String()`/`Number()` and the picked option is mapped back to its record.
    const userOptions = useMemo(
        () => users.map(({id, text}) => ({value: String(id), label: text})),
        [users],
    );

    const hasEvents = localEvents.length > 0;
    const tzAbbreviation = getTimezoneAbbreviation(tz);

    return (
        <DialogShell opened={open} onClose={onClose} size="85%" label="Task groups management">
            <DialogHeader
                icon={<Icon lucide={ListChecks}/>}
                title="Task groups management"
                subtitle="Manage task group assignments for jobs"
                onClose={onClose}
                closeDisabled={isSubmitting}
            />

            <Box p="lg" bg={dialogContentBg}>
                {hasEvents ? (
                    <Paper p="lg" radius="md" withBorder>
                        <Stack gap={4} pb="sm" mb="md" style={{borderBottom: '2px solid var(--mantine-color-default-border)'}}>
                            <Text fw={600} size="lg">Active task groups</Text>
                            <Text size="sm" c="dimmed">Manage task assignments and schedules</Text>
                        </Stack>

                        {/* `highlightOnHover`/`withTableBorder` replace the row-hover and
                            container-border rules the MUI version hand-wrote. */}
                        <Table
                            highlightOnHover
                            withTableBorder
                            layout="fixed"
                            verticalSpacing="sm"
                        >
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th w="18%" {...thProps}>Task type</Table.Th>
                                    <Table.Th w="15%" {...thProps}>Group</Table.Th>
                                    <Table.Th w="10%" {...thProps}>Sequence</Table.Th>
                                    <Table.Th w="22%" {...thProps}>
                                        Due date
                                        {tzAbbreviation && (
                                            <Text size="xs" c="dimmed" fs="italic" tt="none" fw={400}>
                                                {tzAbbreviation}
                                            </Text>
                                        )}
                                    </Table.Th>
                                    <Table.Th w="25%" {...thProps}>Assign to</Table.Th>
                                    <Table.Th w="10%" {...thProps}>Active</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {localEvents.map((item, index) => (
                                    <Table.Tr key={item.eventTypeGroupTypeGroupId}>
                                        <Table.Td fw={500}>{item.eventType.text}</Table.Td>
                                        <Table.Td>
                                            <Badge color="gray" variant="filled" size="sm">{item.group}</Badge>
                                        </Table.Td>
                                        <Table.Td>
                                            <Avatar size={32} radius="xl" color="gray">{item.sequence}</Avatar>
                                        </Table.Td>
                                        <Table.Td>
                                            <DateTimePicker
                                                aria-label={`Due date for ${item.eventType.text}`}
                                                value={item.dueTime ? dayjs(item.dueTime).format(PICKER_VALUE_FORMAT) : null}
                                                onChange={(value) => handleDueDateChange(index, value)}
                                                valueFormat={`${getInputDateFormat()} HH:mm`}
                                                timePickerProps={{format: '24h', withDropdown: true}}
                                                disabled={isSubmitting}
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
                                                disabled={isSubmitting}
                                                size="sm"
                                            />
                                        </Table.Td>
                                        <Table.Td>
                                            <Checkbox
                                                aria-label={`${item.eventType.text} active`}
                                                checked={item.active}
                                                onChange={() => handleActiveToggle(index)}
                                                disabled={isSubmitting}
                                            />
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
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
                confirmLabel={isSubmitting ? 'Saving…' : 'Save changes'}
                confirmIcon={<Icon lucide={Save} size={16}/>}
                confirmDisabled={!hasEvents}
                submitting={isSubmitting}
            />
        </DialogShell>
    );
};

export default EventGroupDialog;
