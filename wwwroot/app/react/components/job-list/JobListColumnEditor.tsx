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
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import DoneIcon from '@mui/icons-material/Done';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import type {SxProps, Theme} from '@mui/material/styles';
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

const panelSx = {
    m: 1,
    p: 1.5,
    borderRadius: 1.5,
    border: '1px solid',
    borderColor: 'divider',
    bgcolor: 'background.paper',
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    flexShrink: 0,
} satisfies SxProps<Theme>;

const rowSx = {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    px: 0.5,
    py: 0.25,
    borderRadius: 1,
    '&:hover': {bgcolor: 'action.hover'},
} satisfies SxProps<Theme>;

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

    const handleWidth = (key: string, raw: string) => {
        const parsed = Number.parseInt(raw, 10);
        if (!Number.isFinite(parsed)) return;
        onColumnWidthsChange({...columnWidths, [key]: Math.max(MIN_COLUMN_WIDTH, parsed)});
    };

    const handleReorderKeyDown = (index: number) => (event: React.KeyboardEvent) => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        event.preventDefault();
        emitOrder(index, event.key === 'ArrowUp' ? index - 1 : index + 1);
    };

    return (
        <Paper elevation={0} sx={panelSx} aria-label="Edit columns">
            <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                <Typography variant="subtitle2" sx={{flex: 1}}>
                    Edit columns
                </Typography>
                <Button size="small" startIcon={<RestartAltIcon />} onClick={onReset}>
                    Reset to defaults
                </Button>
                <Button size="small" variant="contained" startIcon={<DoneIcon />} onClick={onDone}>
                    Done
                </Button>
            </Box>

            <Box sx={{maxHeight: 240, overflow: 'auto'}}>
                {editable.map((col, index) => (
                    <Box
                        key={col.key}
                        sx={rowSx}
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
                        <Tooltip title="Drag, or use the arrow keys, to reorder">
                            <IconButton
                                size="small"
                                aria-label={`Reorder ${col.label || col.key} — use the up and down arrow keys`}
                                aria-roledescription="sortable"
                                draggable
                                onDragStart={(event) => {
                                    dragIndexRef.current = index;
                                    event.dataTransfer.effectAllowed = 'move';
                                    event.dataTransfer.setData(DRAG_MIME, '1');
                                }}
                                onKeyDown={handleReorderKeyDown(index)}
                                sx={{cursor: 'grab'}}
                            >
                                <DragIndicatorIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>

                        <Typography variant="body2" sx={{flex: 1}}>
                            {col.label || col.key}
                        </Typography>

                        <TextField
                            size="small"
                            type="number"
                            label="Width"
                            value={columnWidths[col.key] ?? col.width}
                            onChange={(event) => handleWidth(col.key, event.target.value)}
                            slotProps={{
                                htmlInput: {min: MIN_COLUMN_WIDTH, 'aria-label': `${col.label || col.key} width`},
                                inputLabel: {shrink: true},
                            }}
                            sx={{width: 104, '& .MuiOutlinedInput-root': {bgcolor: 'background.paper'}}}
                        />

                        <Switch
                            size="small"
                            checked={!hiddenSet.has(col.key)}
                            onChange={() => handleToggle(col.key)}
                            slotProps={{input: {'aria-label': `Show ${col.label || col.key}`}}}
                        />
                    </Box>
                ))}
            </Box>
        </Paper>
    );
};
