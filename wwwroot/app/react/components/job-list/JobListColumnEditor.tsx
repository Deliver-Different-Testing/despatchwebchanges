/**
 * Job List Column Editor — an inline "edit columns" mode for the job list.
 *
 * Rendered above the table while active. One row per configurable column:
 * reorder by dragging the handle (or arrow keys on it), set an exact width, and
 * toggle visibility. Locked columns are structural and are not listed.
 *
 * Drag/keyboard reordering mirrors the panel shell (JobSearchShell + BoxHeader)
 * so the two reorder interactions in the app behave the same way.
 */

import React, {useRef} from 'react';
import {ActionIcon, Box, Button, Group, NumberInput, Paper, Stack, Switch, Text, Tooltip} from '@mantine/core';
import {Check, GripVertical, RotateCcw} from 'lucide-react';

import {Icon} from '../common/icon/Icon';
import type {ColumnDef} from './jobListColumns';
import {MIN_COLUMN_WIDTH} from './useColumnResize';

const DRAG_MIME = 'application/x-joblist-column';

export interface JobListColumnEditorProps {
    /** Every configurable column for this tenant/page, in the user's current order. */
    columns: ColumnDef[];
    hiddenColumns: string[];
    columnWidths: Record<string, number>;
    onOrderChange: (order: string[]) => void;
    onHiddenChange: (hidden: string[]) => void;
    onColumnWidthsChange: (widths: Record<string, number>) => void;
    onReset: () => void;
    onDone: () => void;
}

const rowStyle: React.CSSProperties = {
    paddingInline: 4,
    paddingBlock: 2,
    borderRadius: 'var(--mantine-radius-sm)',
};

export const JobListColumnEditor: React.FC<JobListColumnEditorProps> = ({
    columns,
    hiddenColumns,
    columnWidths,
    onOrderChange,
    onHiddenChange,
    onColumnWidthsChange,
    onReset,
    onDone,
}) => {
    const dragIndexRef = useRef<number | null>(null);
    const editable = columns.filter(col => !col.locked);
    const hiddenSet = new Set(hiddenColumns);

    const emitOrder = (from: number, to: number) => {
        if (from === to || to < 0 || to >= editable.length) return;
        const next = [...editable];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        onOrderChange([
            ...columns.filter(col => col.locked).map(col => col.key),
            ...next.map(col => col.key),
        ]);
    };

    const handleToggle = (key: string) => {
        onHiddenChange(hiddenSet.has(key)
            ? hiddenColumns.filter(k => k !== key)
            : [...hiddenColumns, key]);
    };

    const handleWidth = (key: string, raw: number | string) => {
        const parsed = typeof raw === 'number' ? raw : Number.parseInt(raw, 10);
        if (!Number.isFinite(parsed)) return;
        onColumnWidthsChange({...columnWidths, [key]: Math.max(MIN_COLUMN_WIDTH, parsed)});
    };

    const handleReorderKeyDown = (index: number) => (event: React.KeyboardEvent) => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        event.preventDefault();
        emitOrder(index, event.key === 'ArrowUp' ? index - 1 : index + 1);
    };

    return (
        <Paper withBorder radius="md" p="sm" m="xs" aria-label="Edit columns" style={{flexShrink: 0}}>
            <Stack gap="xs">
                <Group align="center" gap="xs">
                    <Text size="sm" fw={600} style={{flex: 1}}>
                        Edit columns
                    </Text>
                    <Button size="compact-sm" variant="subtle" leftSection={<Icon lucide={RotateCcw} size={16}/>} onClick={onReset}>
                        Reset to defaults
                    </Button>
                    <Button size="compact-sm" leftSection={<Icon lucide={Check} size={16}/>} onClick={onDone}>
                        Done
                    </Button>
                </Group>

                <Box style={{maxHeight: 240, overflow: 'auto'}}>
                    {editable.map((col, index) => (
                        <Group
                            key={col.key}
                            align="center"
                            gap="xs"
                            wrap="nowrap"
                            style={rowStyle}
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
                                    aria-label={`Reorder ${col.label || col.key} — use the up and down arrow keys`}
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

                            <Text size="sm" style={{flex: 1}}>
                                {col.label || col.key}
                            </Text>

                            <NumberInput
                                size="xs"
                                label="Width"
                                w={104}
                                min={MIN_COLUMN_WIDTH}
                                value={columnWidths[col.key] ?? col.width}
                                onChange={(value) => handleWidth(col.key, value)}
                                aria-label={`${col.label || col.key} width`}
                            />

                            <Switch
                                size="sm"
                                checked={!hiddenSet.has(col.key)}
                                onChange={() => handleToggle(col.key)}
                                aria-label={`Show ${col.label || col.key}`}
                            />
                        </Group>
                    ))}
                </Box>
            </Stack>
        </Paper>
    );
};
