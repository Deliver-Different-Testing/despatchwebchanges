import React, {Fragment, useCallback, useRef, useState} from 'react';
import {ActionIcon, Badge, Box, Button, Group, Text} from '@mantine/core';
import {Check, Columns3, Minus, Plus} from 'lucide-react';
import {Panel, PanelGroup, PanelResizeHandle} from 'react-resizable-panels';
import {IBox, ILayout} from '../../../../interfaces/layout.interfaces';
import {MAX_COLUMNS, MIN_COLUMNS, parsePercent} from './columnLayout';
import {Icon} from '../../../components/common/icon/Icon';
import {BoxHeader} from './BoxHeader';
import classes from './BoxShell.module.css';

export interface BoxShellProps {
    layout: ILayout;
    /** Bumped on layout switch or box reorder to force a clean PanelGroup remount. */
    layoutVersion: number;
    boxes: Record<string, IBox>;
    /**
     * Render a box's body. `headerSlot` is that card's header DOM node — pass it
     * to a box that wants to render its own controls into the gradient header via
     * `createPortal` (kept local so state needn't be lifted). Optional 2nd arg, so
     * existing callers that ignore it are unaffected.
     */
    renderBoxContent: (boxName: string, headerSlot?: HTMLElement | null) => React.ReactNode;
    onRefreshBox: (boxName: string) => void;
    boxSubtitle?: (boxName: string) => string | undefined;
    boxLocked?: (boxName: string) => boolean;
    /** Optional per-box content rendered in the header's right action slot (before refresh/drag). */
    boxRightSlot?: (boxName: string) => React.ReactNode;
    onColumnSizes?: (sizes: number[]) => void;
    onBoxHeights?: (columnId: string, sizes: number[], visibleBoxNames: string[]) => void;
    onMoveBox?: (
        sourceColumnId: string,
        sourceIndex: number,
        targetColumnId: string,
        targetIndex: number,
    ) => void;
    /** Hide a panel from the current layout (custom layouts only, alongside the drag handle). */
    onHideBox?: (boxName: string) => void;
    /**
     * User preference: show the per-panel hide button at all (custom layouts
     * only). Defaults to true. Reorder/drag is unaffected either way.
     */
    hideButtonEnabled?: boolean;
    /**
     * The Default layout is read-only: no resize gutters, no reorder, no column
     * stepper, and stored visibility is ignored (that record belongs to a user
     * layout). A panel the definitions ship as `visible: false` still stays
     * hidden here, so an opt-in panel is opt-in on Default too. Users customise
     * by saving a layout of their own.
     */
    isDefaultLayout?: boolean;
    /**
     * "Edit columns" mode, toggled from the toolbar's Layouts menu. Reveals the
     * columns bar (layout column stepper) above the panels; each job-list panel
     * separately reveals its own column editor. Panel resize and drag/keyboard
     * reorder are independent of this mode — available any time on a custom
     * (non-Default) layout.
     */
    columnEditMode?: boolean;
    /** Leave "Edit columns" mode from the bar's Done button. */
    onExitColumnEditMode?: () => void;
    /** Append a column to the current layout. Supply both to show the stepper. */
    onAddColumn?: () => void;
    /** Remove the rightmost column from the current layout. */
    onRemoveColumn?: () => void;
}

// The gutter affordance lives in the stylesheet: its glow is keyed off
// `data-resize-handle-state` on the parent handle, which no prop can express.

const boxCardStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    height: '100%',
    backgroundColor: 'var(--dd-surface-container)',
    border: '1px solid var(--mantine-color-default-border)',
    // Rounder than the app's other `sm` chrome — a deliberate, narrow echo of
    // Xero's card radius on the dispatch page specifically, still well short
    // of the `xl` "toy" shape the theme otherwise avoids.
    borderRadius: 'var(--mantine-radius-lg)',
    overflow: 'hidden',
};

const boxContentStyle: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
};

// Insets each card inside its panel so neighbouring cards get a small,
// uniform gap. border-box keeps the card at the panel's full size minus
// the padding, so it never overflows / triggers a scrollbar.
const boxPanelPadStyle: React.CSSProperties = {
    height: '100%',
    padding: 2,
    boxSizing: 'border-box',
};

// Per-card wrapper that owns the header-slot DOM node so a box can render its own
// header controls (via createPortal) without lifting state. Header + content are
// rendered via callbacks so the shell keeps the drag/drop/reorder logic inline.
interface BoxCardBodyProps {
    onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
    onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
    renderHeader: (headerSlotRef: (el: HTMLElement | null) => void) => React.ReactNode;
    renderContent: (headerSlot: HTMLElement | null) => React.ReactNode;
}

const BoxCardBody: React.FC<BoxCardBodyProps> = ({onDragOver, onDrop, renderHeader, renderContent}) => {
    const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
    return (
        <Box data-testid="job-search-box-card" style={boxCardStyle} onDragOver={onDragOver} onDrop={onDrop}>
            {renderHeader(setHeaderSlot)}
            <Box style={boxContentStyle}>{renderContent(headerSlot)}</Box>
        </Box>
    );
};

const DRAG_MIME = 'application/x-jobsearch-box';

interface DragRef {
    sourceColumnId: string;
    sourceIndex: number;
}

export const BoxShell: React.FC<BoxShellProps> = ({
    layout,
    layoutVersion,
    boxes,
    renderBoxContent,
    onRefreshBox,
    boxSubtitle,
    boxLocked,
    boxRightSlot,
    onColumnSizes,
    onBoxHeights,
    onMoveBox,
    onHideBox,
    hideButtonEnabled = true,
    isDefaultLayout = false,
    columnEditMode = false,
    onExitColumnEditMode,
    onAddColumn,
    onRemoveColumn,
}) => {
    const columnCount = layout.layout.columns.length;
    const showColumnStepper = !!onAddColumn && !!onRemoveColumn;
    // Gates only the columns stepper bar. Resize and reorder are governed
    // separately, by isDefaultLayout alone — see canReorder below.
    const editable = columnEditMode && !isDefaultLayout;
    const dragRef = useRef<DragRef | null>(null);
    // Every PanelGroup emits its computed sizes once on mount. That emit carries
    // no user intent, so swallowing the first one per group keeps merely opening
    // the page from rewriting (and syncing) the layout.
    const settledGroupsRef = useRef<{version: number; ids: Set<string>}>({version: layoutVersion, ids: new Set()});

    const afterInitialLayout = useCallback((groupId: string, apply: () => void) => {
        const settled = settledGroupsRef.current;
        if (settled.version !== layoutVersion) {
            settled.version = layoutVersion;
            settled.ids = new Set();
        }
        if (!settled.ids.has(groupId)) {
            settled.ids.add(groupId);
            return;
        }
        apply();
    }, [layoutVersion]);
    // Name of the panel whose drag handle should be re-focused after a reorder
    // remounts the panel tree (see BoxHeader.focusHandleOnMount).
    const pendingFocusRef = useRef<string | null>(null);

    const handleDragStart = (sourceColumnId: string, sourceIndex: number) =>
        (event: React.DragEvent<HTMLElement>) => {
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
        <Box style={{
            height: '100%',
            width: '100%',
            padding: 4,
            boxSizing: 'border-box',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
        }}>
            {editable && (
                <Group gap="xs" px={4} wrap="nowrap" style={{flexShrink: 0}}>
                    <Badge
                        variant="outline"
                        size="md"
                        tt="none"
                        leftSection={<Icon lucide={Columns3} size={14}/>}
                    >
                        Editing columns
                    </Badge>
                    <Text size="xs" c="dimmed" style={{flex: 1}}>
                        Set the layout&rsquo;s columns here, and each list&rsquo;s columns in its own panel
                    </Text>
                    {showColumnStepper && (
                        <Group
                            role="group"
                            aria-label="Number of columns"
                            gap={4}
                            wrap="nowrap"
                            style={{flexShrink: 0}}
                        >
                            <Text size="xs" c="dimmed">Columns</Text>
                            <ActionIcon
                                variant="subtle"
                                color="gray"
                                aria-label="Remove column"
                                disabled={columnCount <= MIN_COLUMNS}
                                onClick={onRemoveColumn}
                            >
                                <Icon lucide={Minus} size={16}/>
                            </ActionIcon>
                            <Text
                                size="sm"
                                aria-live="polite"
                                ta="center"
                                style={{minWidth: 16, fontVariantNumeric: 'tabular-nums'}}
                            >
                                {columnCount}
                            </Text>
                            <ActionIcon
                                variant="subtle"
                                color="gray"
                                aria-label="Add column"
                                disabled={columnCount >= MAX_COLUMNS}
                                onClick={onAddColumn}
                            >
                                <Icon lucide={Plus} size={16}/>
                            </ActionIcon>
                        </Group>
                    )}
                    {onExitColumnEditMode && (
                        <Button
                            size="xs"
                            leftSection={<Icon lucide={Check} size={16}/>}
                            onClick={onExitColumnEditMode}
                            style={{flexShrink: 0}}
                        >
                            Done
                        </Button>
                    )}
                </Group>
            )}
            <Box style={{flex: 1, minHeight: 0}}>
            <PanelGroup
                key={`columns-${layoutVersion}`}
                direction="horizontal"
                onLayout={sizes => afterInitialLayout('columns', () => onColumnSizes?.(sizes))}
            >
                {layout.layout.columns.map((column, columnIdx) => {
                    const visibleBoxes = column.boxes
                        .map((boxRef, originalIndex) => ({
                            boxRef,
                            originalIndex,
                            meta: boxes[boxRef.name ?? ''],
                        }))
                        .filter(item => item.meta && (
                            isDefaultLayout ? item.meta.visible !== false : item.meta.visible
                        ));

                    const visibleBoxNames = visibleBoxes.map(item => item.boxRef.name ?? '');

                    return (
                        <Fragment key={column.id}>
                            {columnIdx > 0 && !isDefaultLayout && (
                                <PanelResizeHandle>
                                    <Box className={`${classes.handle} ${classes.horizontal}`} />
                                </PanelResizeHandle>
                            )}
                            <Panel
                                defaultSize={parsePercent(column.width, 25)}
                                minSize={10}
                            >
                                <Box
                                    style={{height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0}}
                                    onDragOver={handleDragOver}
                                    onDrop={handleDropAtColumnEnd(column.id, column.boxes.length)}
                                >
                                    {visibleBoxes.length === 0 ? (
                                        <Box
                                            c="dimmed"
                                            fz={12}
                                            style={{
                                                flex: 1,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                border: '1px dashed var(--mantine-primary-color-light-color)',
                                                borderRadius: 'var(--mantine-radius-sm)',
                                                margin: 2,
                                            }}
                                        >
                                            {isDefaultLayout ? 'Empty column' : 'Drop a panel here'}
                                        </Box>
                                    ) : (
                                        <PanelGroup
                                            key={`column-${column.id}-${layoutVersion}`}
                                            direction="vertical"
                                            onLayout={sizes => afterInitialLayout(
                                                column.id,
                                                () => onBoxHeights?.(column.id, sizes, visibleBoxNames),
                                            )}
                                        >
                                            {visibleBoxes.map((item, vIdx) => {
                                                const {boxRef, originalIndex, meta} = item;
                                                if (!meta) return null;
                                                const defaultSize = parsePercent(boxRef.height, 33);
                                                const boxName = meta.name ?? '';

                                                // Keyboard reorder targets the neighbouring visible panel's
                                                // original index — mirroring the drag drop-on-box semantics so
                                                // useBoxLayout.moveBox applies the same index adjustment.
                                                const canReorder = !!onMoveBox && !isDefaultLayout;
                                                const canHide = canReorder && hideButtonEnabled;
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
                                                                <Box className={`${classes.handle} ${classes.vertical}`} />
                                                            </PanelResizeHandle>
                                                        )}
                                                        <Panel defaultSize={defaultSize} minSize={12}>
                                                            <Box style={boxPanelPadStyle}>
                                                                <BoxCardBody
                                                                    onDragOver={handleDragOver}
                                                                    onDrop={handleDropOnBox(column.id, originalIndex)}
                                                                    renderHeader={(headerSlotRef) => (
                                                                        <BoxHeader
                                                                            icon={meta.icon ?? 'crop_square'}
                                                                            title={meta.title ?? meta.name ?? ''}
                                                                            subtitle={boxSubtitle?.(meta.name ?? '')}
                                                                            locked={boxLocked?.(meta.name ?? '')}
                                                                            rightSlot={boxRightSlot?.(meta.name ?? '')}
                                                                            headerSlotRef={headerSlotRef}
                                                                            showRefresh={!!meta.showRefresh}
                                                                            showDragHandle={canReorder}
                                                                            showHideButton={canHide}
                                                                            onHide={canHide ? () => onHideBox?.(boxName) : undefined}
                                                                            onDragStart={canReorder
                                                                                ? handleDragStart(column.id, originalIndex)
                                                                                : undefined}
                                                                            onRefresh={() => onRefreshBox(meta.name ?? '')}
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
                                                                    )}
                                                                    renderContent={(headerSlot) => renderBoxContent(meta.name ?? '', headerSlot)}
                                                                />
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
