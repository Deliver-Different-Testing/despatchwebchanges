/**
 * Address Format Editor — pick which address fields show on the job list, and
 * in what order. One row per field: toggle it on/off, drag the handle (or use
 * the arrow keys on it) to reorder the ones that are on.
 *
 * A field that's toggled off keeps no persisted position — it just settles to
 * the bottom of the list, in the fixed canonical order, until switched back
 * on. Only the order of the *included* fields is ever saved.
 *
 * Mirrors the drag/keyboard reorder interaction in JobListColumnEditor.tsx so
 * the app's two field-reorder UIs behave the same way.
 */

import React, {useRef} from 'react';
import {ActionIcon, Group, Paper, Stack, Switch, Text, Tooltip} from '@mantine/core';
import {GripVertical} from 'lucide-react';

import {Icon} from '../../components/common/icon/Icon';
import {ADDRESS_FIELD_OPTIONS} from '../../components/job-list/jobAddressFormat';
import type {AddressFieldKey} from '../../interfaces/address';

const DRAG_MIME = 'application/x-address-field';

export interface AddressFormatEditorProps {
    /** Currently included fields, in display order. */
    fields: AddressFieldKey[];
    onChange: (fields: AddressFieldKey[]) => void;
}

/** Included fields first (in their saved order), then the rest in canonical order. */
function buildDisplayOrder(fields: AddressFieldKey[]): AddressFieldKey[] {
    const remaining = ADDRESS_FIELD_OPTIONS.map((o) => o.key).filter((k) => !fields.includes(k));
    return [...fields, ...remaining];
}

const labelFor = (key: AddressFieldKey): string =>
    ADDRESS_FIELD_OPTIONS.find((o) => o.key === key)?.label ?? key;

export const AddressFormatEditor: React.FC<AddressFormatEditorProps> = ({fields, onChange}) => {
    const dragIndexRef = useRef<number | null>(null);
    const order = buildDisplayOrder(fields);
    const includedSet = new Set(fields);

    const emitOrder = (from: number, to: number) => {
        if (from === to || to < 0 || to >= order.length) return;
        const next = [...order];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        onChange(next.filter((key) => includedSet.has(key)));
    };

    const handleToggle = (key: AddressFieldKey) => {
        onChange(includedSet.has(key)
            ? fields.filter((k) => k !== key)
            : [...fields, key]);
    };

    const handleReorderKeyDown = (index: number) => (event: React.KeyboardEvent) => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        event.preventDefault();
        emitOrder(index, event.key === 'ArrowUp' ? index - 1 : index + 1);
    };

    return (
        <Paper withBorder radius="md" p="sm">
            <Stack gap={4}>
                {order.map((key, index) => (
                    <Group
                        key={key}
                        align="center"
                        gap="xs"
                        wrap="nowrap"
                        py={2}
                        onDragOver={(event) => {
                            if (dragIndexRef.current === null) return;
                            event.preventDefault();
                            event.dataTransfer.dropEffect = 'move';
                        }}
                        onDrop={(event) => {
                            const from = dragIndexRef.current;
                            dragIndexRef.current = null;
                            if (from === null) return;
                            event.preventDefault();
                            emitOrder(from, index);
                        }}
                    >
                        <Tooltip label="Drag, or use the arrow keys, to reorder" withArrow>
                            <ActionIcon
                                size="md"
                                variant="subtle"
                                color="gray"
                                aria-label={`Reorder ${labelFor(key)} — use the up and down arrow keys`}
                                aria-roledescription="sortable"
                                draggable
                                onDragStart={(event) => {
                                    dragIndexRef.current = index;
                                    event.dataTransfer.effectAllowed = 'move';
                                    event.dataTransfer.setData(DRAG_MIME, '1');
                                }}
                                onKeyDown={handleReorderKeyDown(index)}
                                style={{cursor: 'grab'}}
                            >
                                <Icon lucide={GripVertical} size={16}/>
                            </ActionIcon>
                        </Tooltip>

                        <Text size="sm" style={{flex: 1}}>{labelFor(key)}</Text>

                        <Switch
                            size="sm"
                            checked={includedSet.has(key)}
                            onChange={() => handleToggle(key)}
                            aria-label={`Show ${labelFor(key)}`}
                        />
                    </Group>
                ))}
            </Stack>
        </Paper>
    );
};
