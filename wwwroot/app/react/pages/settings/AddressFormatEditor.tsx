/**
 * Address Format Editor — pick which address fields show for one side (pickup
 * or delivery), and which of the two display lines each sits on. One row per
 * field: a segmented control moves it Off / Line 1 / Line 2, the drag handle
 * (or arrow keys) reorders it within whichever line it's currently on.
 *
 * A field that's off keeps no persisted position — it just settles to the
 * bottom of the "Not shown" list, in the fixed canonical order, until moved
 * back onto a line. Only the order of each line's included fields is saved.
 *
 * Mirrors the drag/keyboard reorder interaction in JobListColumnEditor.tsx so
 * the app's field-reorder UIs behave the same way.
 */

import React, {useRef} from 'react';
import {ActionIcon, Group, Paper, SegmentedControl, Stack, Text, Tooltip} from '@mantine/core';
import {GripVertical} from 'lucide-react';

import {Icon} from '../../components/common/icon/Icon';
import {ADDRESS_FIELD_OPTIONS} from '../../components/job-list/jobAddressFormat';
import type {AddressFieldKey, AddressLineFormat} from '../../interfaces/address';

const DRAG_MIME = 'application/x-address-field';

export interface AddressFormatEditorProps {
    value: AddressLineFormat;
    onChange: (value: AddressLineFormat) => void;
}

type Zone = 'off' | 'line1' | 'line2';

const ZONE_OPTIONS: {label: string; value: Zone}[] = [
    {label: 'Off', value: 'off'},
    {label: 'Line 1', value: 'line1'},
    {label: 'Line 2', value: 'line2'},
];

const CANONICAL_ORDER = ADDRESS_FIELD_OPTIONS.map((o) => o.key);

const labelFor = (key: AddressFieldKey): string =>
    ADDRESS_FIELD_OPTIONS.find((o) => o.key === key)?.label ?? key;

/** Fields with no line assignment, in canonical order. */
function offFields(value: AddressLineFormat): AddressFieldKey[] {
    const included = new Set<AddressFieldKey>([...value.line1, ...value.line2]);
    return CANONICAL_ORDER.filter((key) => !included.has(key));
}

/** Moves a field to (or within) a zone, appending it to that zone's end when it's arriving from elsewhere. */
function moveToZone(value: AddressLineFormat, key: AddressFieldKey, zone: Zone): AddressLineFormat {
    const line1 = value.line1.filter((k) => k !== key);
    const line2 = value.line2.filter((k) => k !== key);
    if (zone === 'line1') line1.push(key);
    if (zone === 'line2') line2.push(key);
    return {line1, line2};
}

function reorderWithinZone(fields: AddressFieldKey[], from: number, to: number): AddressFieldKey[] {
    if (from === to || to < 0 || to >= fields.length) return fields;
    const next = [...fields];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
}

const ZoneSection: React.FC<{
    title: string;
    fields: AddressFieldKey[];
    zone: Zone;
    value: AddressLineFormat;
    onChange: (value: AddressLineFormat) => void;
    reorderable: boolean;
}> = ({title, fields, zone, value, onChange, reorderable}) => {
    const dragIndexRef = useRef<number | null>(null);

    const emitReorder = (from: number, to: number) => {
        const reordered = reorderWithinZone(fields, from, to);
        if (reordered === fields) return;
        onChange({...value, [zone]: reordered} as AddressLineFormat);
    };

    return (
        <Paper withBorder radius="md" p="sm">
            <Text size="xs" fw={600} c="dimmed" mb={4} tt="uppercase">{title}</Text>
            <Stack gap={4}>
                {fields.length === 0 && (
                    <Text size="sm" c="dimmed" fs="italic">Nothing here</Text>
                )}
                {fields.map((key, index) => (
                    <Group
                        key={key}
                        align="center"
                        gap="xs"
                        wrap="nowrap"
                        py={2}
                        onDragOver={(event) => {
                            if (!reorderable || dragIndexRef.current === null) return;
                            event.preventDefault();
                            event.dataTransfer.dropEffect = 'move';
                        }}
                        onDrop={(event) => {
                            const from = dragIndexRef.current;
                            dragIndexRef.current = null;
                            if (!reorderable || from === null) return;
                            event.preventDefault();
                            emitReorder(from, index);
                        }}
                    >
                        {reorderable ? (
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
                                    onKeyDown={(event) => {
                                        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                                        event.preventDefault();
                                        emitReorder(index, event.key === 'ArrowUp' ? index - 1 : index + 1);
                                    }}
                                    style={{cursor: 'grab'}}
                                >
                                    <Icon lucide={GripVertical} size={16}/>
                                </ActionIcon>
                            </Tooltip>
                        ) : (
                            <ActionIcon size="md" variant="transparent" color="gray" disabled aria-hidden>
                                <Icon lucide={GripVertical} size={16}/>
                            </ActionIcon>
                        )}

                        <Text size="sm" style={{flex: 1}}>{labelFor(key)}</Text>

                        <SegmentedControl
                            size="xs"
                            value={zone}
                            data={ZONE_OPTIONS}
                            aria-label={`${labelFor(key)} line`}
                            onChange={(next) => onChange(moveToZone(value, key, next as Zone))}
                        />
                    </Group>
                ))}
            </Stack>
        </Paper>
    );
};

export const AddressFormatEditor: React.FC<AddressFormatEditorProps> = ({value, onChange}) => {
    const notShown = offFields(value);

    return (
        <Stack gap={8}>
            <ZoneSection title="Line 1" fields={value.line1} zone="line1" value={value} onChange={onChange} reorderable/>
            <ZoneSection title="Line 2" fields={value.line2} zone="line2" value={value} onChange={onChange} reorderable/>
            <ZoneSection title="Not shown" fields={notShown} zone="off" value={value} onChange={onChange} reorderable={false}/>
        </Stack>
    );
};
