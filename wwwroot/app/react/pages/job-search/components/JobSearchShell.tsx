import React, {Fragment, useRef} from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import EditIcon from '@mui/icons-material/Edit';
import type {SxProps, Theme} from '@mui/material/styles';
import {alpha} from '@mui/material/styles';
import {Panel, PanelGroup, PanelResizeHandle} from 'react-resizable-panels';
import {IBox, ILayout} from '../../../../interfaces/layout.interfaces';
import {BoxHeader} from './BoxHeader';

export interface JobSearchShellProps {
    layout: ILayout;
    /** Bumped on layout switch or box reorder to force a clean PanelGroup remount. */
    layoutVersion: number;
    boxes: Record<string, IBox>;
    isDefaultLayout: boolean;
    renderBoxContent: (boxName: string) => React.ReactNode;
    onRefreshBox: (boxName: string) => void;
    onToggleCollapse: (boxName: string) => void;
    boxSubtitle?: (boxName: string) => string | undefined;
    boxLocked?: (boxName: string) => boolean;
    onColumnSizes?: (sizes: number[]) => void;
    onBoxHeights?: (columnId: string, sizes: number[], visibleBoxNames: string[]) => void;
    onMoveBox?: (
        sourceColumnId: string,
        sourceIndex: number,
        targetColumnId: string,
        targetIndex: number,
    ) => void;
}

// The gutter affordance is the same shape used by recurring-jobs:
// transparent by default, glows on hover, intensifies on drag.
const horizontalHandleSx = ((theme: Theme) => ({
    width: 8,
    mx: 0.25,
    bgcolor: 'transparent',
    cursor: 'col-resize',
    borderRadius: 1,
    transition: 'background-color 0.2s cubic-bezier(0.4,0,0.2,1), box-shadow 0.2s cubic-bezier(0.4,0,0.2,1)',
    '[data-resize-handle-state="hover"] &': {
        bgcolor: alpha(theme.palette.primary.main, 0.3),
        boxShadow: `0 0 8px ${alpha(theme.palette.primary.main, 0.3)}`,
    },
    '[data-resize-handle-state="drag"] &': {
        bgcolor: alpha(theme.palette.primary.main, 0.5),
        boxShadow: `0 0 12px ${alpha(theme.palette.primary.main, 0.5)}`,
    },
})) satisfies SxProps<Theme>;

const verticalHandleSx = ((theme: Theme) => ({
    height: 8,
    my: 0.25,
    bgcolor: 'transparent',
    cursor: 'row-resize',
    borderRadius: 1,
    transition: 'background-color 0.2s cubic-bezier(0.4,0,0.2,1), box-shadow 0.2s cubic-bezier(0.4,0,0.2,1)',
    '[data-resize-handle-state="hover"] &': {
        bgcolor: alpha(theme.palette.primary.main, 0.3),
        boxShadow: `0 0 8px ${alpha(theme.palette.primary.main, 0.3)}`,
    },
    '[data-resize-handle-state="drag"] &': {
        bgcolor: alpha(theme.palette.primary.main, 0.5),
        boxShadow: `0 0 12px ${alpha(theme.palette.primary.main, 0.5)}`,
    },
})) satisfies SxProps<Theme>;

const boxCardSx: SxProps<Theme> = {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    height: '100%',
    bgcolor: 'background.paper',
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: 1,
    overflow: 'hidden',
};

const boxContentSx: SxProps<Theme> = {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
};

// Insets each card inside its panel so neighbouring cards get a small,
// uniform gap. border-box keeps the card at the panel's full size minus
// the padding, so it never overflows / triggers a scrollbar.
const boxPanelPadSx: SxProps<Theme> = {
    height: '100%',
    p: 0.5,
    boxSizing: 'border-box',
};

const DRAG_MIME = 'application/x-jobsearch-box';

interface DragRef {
    sourceColumnId: string;
    sourceIndex: number;
}

function parsePercent(value: string | undefined, fallback: number): number {
    if (!value) return fallback;
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
}

export const JobSearchShell: React.FC<JobSearchShellProps> = ({
    layout,
    layoutVersion,
    boxes,
    isDefaultLayout,
    renderBoxContent,
    onRefreshBox,
    onToggleCollapse,
    boxSubtitle,
    boxLocked,
    onColumnSizes,
    onBoxHeights,
    onMoveBox,
}) => {
    const dragRef = useRef<DragRef | null>(null);
    // Name of the panel whose drag handle should be re-focused after a reorder
    // remounts the panel tree (see BoxHeader.focusHandleOnMount).
    const pendingFocusRef = useRef<string | null>(null);

    const handleDragStart = (sourceColumnId: string, sourceIndex: number) =>
        (event: React.DragEvent<HTMLDivElement>) => {
            dragRef.current = {sourceColumnId, sourceIndex};
            event.dataTransfer.effectAllowed = 'move';
            // Empty payload is fine — we read from the ref. Setting the MIME
            // tells onDragOver we're a job-search box (vs an external file).
            event.dataTransfer.setData(DRAG_MIME, '1');
        };

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        if (!dragRef.current) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    };

    const handleDropOnBox = (targetColumnId: string, targetIndex: number) =>
        (event: React.DragEvent<HTMLDivElement>) => {
            const drag = dragRef.current;
            dragRef.current = null;
            if (!drag || !onMoveBox) return;
            event.preventDefault();
            event.stopPropagation();
            if (drag.sourceColumnId === targetColumnId && drag.sourceIndex === targetIndex) return;
            onMoveBox(drag.sourceColumnId, drag.sourceIndex, targetColumnId, targetIndex);
        };

    const handleDropAtColumnEnd = (targetColumnId: string, length: number) =>
        (event: React.DragEvent<HTMLDivElement>) => {
            const drag = dragRef.current;
            dragRef.current = null;
            if (!drag || !onMoveBox) return;
            event.preventDefault();
            onMoveBox(drag.sourceColumnId, drag.sourceIndex, targetColumnId, length);
        };

    return (
        <Box sx={{
            height: '100%',
            width: '100%',
            p: 1,
            boxSizing: 'border-box',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
        }}>
            {/* Edit-mode signal: only shown on a custom (editable) layout. The
                read-only Default layout shows nothing so it doesn't waste space. */}
            {!isDefaultLayout && (
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1, px: 0.5, flexShrink: 0}}>
                    <Chip
                        size="small"
                        color="primary"
                        variant="outlined"
                        icon={<EditIcon/>}
                        label={`Editing: ${layout.name}`}
                    />
                    <Typography variant="caption" sx={{color: 'text.secondary'}}>
                        Drag a panel, or focus its handle and use the arrow keys, to reorder
                    </Typography>
                </Box>
            )}
            <Box sx={{flex: 1, minHeight: 0}}>
            <PanelGroup
                key={`columns-${layoutVersion}`}
                direction="horizontal"
                onLayout={sizes => onColumnSizes?.(sizes)}
            >
                {layout.layout.columns.map((column, columnIdx) => {
                    const visibleBoxes = column.boxes
                        .map((boxRef, originalIndex) => ({
                            boxRef,
                            originalIndex,
                            meta: boxes[boxRef.name ?? ''],
                        }))
                        // The Default layout is read-only — panels can't be hidden there,
                        // so always show every panel regardless of any stored visibility.
                        .filter(item => item.meta && (isDefaultLayout || item.meta.visible));

                    const visibleBoxNames = visibleBoxes.map(item => item.boxRef.name ?? '');

                    return (
                        <Fragment key={column.id}>
                            {columnIdx > 0 && !isDefaultLayout && (
                                <PanelResizeHandle>
                                    <Box sx={horizontalHandleSx} />
                                </PanelResizeHandle>
                            )}
                            <Panel
                                defaultSize={parsePercent(column.width, 25)}
                                minSize={10}
                            >
                                <Box
                                    sx={{height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0}}
                                    onDragOver={handleDragOver}
                                    onDrop={handleDropAtColumnEnd(column.id, column.boxes.length)}
                                >
                                    {visibleBoxes.length === 0 ? (
                                        <Box
                                            sx={(theme) => ({
                                                flex: 1,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'text.secondary',
                                                fontSize: 12,
                                                border: '1px dashed',
                                                borderColor: alpha(theme.palette.primary.main, 0.3),
                                                borderRadius: 1,
                                                m: 0.5,
                                            })}
                                        >
                                            {isDefaultLayout ? 'Empty column' : 'Drop a panel here'}
                                        </Box>
                                    ) : (
                                        <PanelGroup
                                            key={`column-${column.id}-${layoutVersion}`}
                                            direction="vertical"
                                            onLayout={sizes => onBoxHeights?.(column.id, sizes, visibleBoxNames)}
                                        >
                                            {visibleBoxes.map((item, vIdx) => {
                                                const {boxRef, originalIndex, meta} = item;
                                                if (!meta) return null;
                                                const collapsed = meta.collapsed ?? false;
                                                const defaultSize = collapsed ? 8 : parsePercent(boxRef.height, 33);
                                                const minSize = collapsed ? 6 : 12;
                                                const boxName = meta.name ?? '';

                                                // Keyboard reorder targets the neighbouring visible panel's
                                                // original index — mirroring the drag drop-on-box semantics so
                                                // useBoxLayout.moveBox applies the same index adjustment.
                                                const canReorder = !isDefaultLayout && !!onMoveBox;
                                                const prevVisible = vIdx > 0 ? visibleBoxes[vIdx - 1] : undefined;
                                                const nextVisible = vIdx < visibleBoxes.length - 1
                                                    ? visibleBoxes[vIdx + 1]
                                                    : undefined;
                                                const moveTo = (targetIndex: number) => {
                                                    if (!onMoveBox) return;
                                                    pendingFocusRef.current = boxName;
                                                    // Within-column only for keyboard; cross-column stays mouse-only.
                                                    onMoveBox(column.id, originalIndex, column.id, targetIndex);
                                                };

                                                return (
                                                    <Fragment key={boxRef.name}>
                                                        {vIdx > 0 && !isDefaultLayout && (
                                                            <PanelResizeHandle>
                                                                <Box sx={verticalHandleSx} />
                                                            </PanelResizeHandle>
                                                        )}
                                                        <Panel defaultSize={defaultSize} minSize={minSize}>
                                                            <Box sx={boxPanelPadSx}>
                                                                <Box
                                                                    sx={boxCardSx}
                                                                    onDragOver={handleDragOver}
                                                                    onDrop={handleDropOnBox(column.id, originalIndex)}
                                                                >
                                                                    <BoxHeader
                                                                        icon={meta.icon ?? 'crop_square'}
                                                                        title={meta.title ?? meta.name ?? ''}
                                                                        subtitle={boxSubtitle?.(meta.name ?? '')}
                                                                        locked={boxLocked?.(meta.name ?? '')}
                                                                        collapsed={collapsed}
                                                                        showRefresh={!!meta.showRefresh}
                                                                        showCollapse={!isDefaultLayout}
                                                                        showDragHandle={!isDefaultLayout}
                                                                        onDragStart={isDefaultLayout
                                                                            ? undefined
                                                                            : handleDragStart(column.id, originalIndex)}
                                                                        onRefresh={() => onRefreshBox(meta.name ?? '')}
                                                                        onToggleCollapse={() => onToggleCollapse(meta.name ?? '')}
                                                                        onMoveUp={canReorder && prevVisible
                                                                            ? () => moveTo(prevVisible.originalIndex)
                                                                            : undefined}
                                                                        onMoveDown={canReorder && nextVisible
                                                                            ? () => moveTo(nextVisible.originalIndex)
                                                                            : undefined}
                                                                        focusHandleOnMount={pendingFocusRef.current === boxName}
                                                                        onHandleFocused={() => {
                                                                            pendingFocusRef.current = null;
                                                                        }}
                                                                    />
                                                                    {!collapsed ? (
                                                                        <Box sx={boxContentSx}>
                                                                            {renderBoxContent(meta.name ?? '')}
                                                                        </Box>
                                                                    ) : null}
                                                                </Box>
                                                            </Box>
                                                        </Panel>
                                                    </Fragment>
                                                );
                                            })}
                                        </PanelGroup>
                                    )}
                                </Box>
                            </Panel>
                        </Fragment>
                    );
                })}
            </PanelGroup>
            </Box>
        </Box>
    );
};
