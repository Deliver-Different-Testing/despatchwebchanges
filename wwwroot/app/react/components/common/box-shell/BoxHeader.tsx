/**
 * Thin adapter that maps a Job Search box's metadata (Material Symbols
 * glyph name, title, refresh + collapse handlers) onto the shared
 * `PanelHeader` so the boxes pick up the same gradient hero header used
 * by Recurring Jobs, Overview, Task Dashboard, etc.
 */

import React, {useEffect, useRef} from 'react';
import {ActionIcon, Box, Tooltip} from '@mantine/core';
import {GripVertical, RefreshCw} from 'lucide-react';
import {PANEL_CONTROL_GLYPH_SIZE, PANEL_CONTROL_HEIGHT, panelIconButtonClassName} from '../../../components/common/panel-controls';
import {Icon} from '../../../components/common/icon/Icon';
import {PanelHeader} from '../../../components/common/panel-header';
import {SymbolIcon} from '../../../components/common/symbol-icon';

export interface BoxHeaderProps {
    /** Material Symbols outlined glyph name, e.g. "filter_list". */
    icon: string;
    title: string;
    subtitle?: string;
    locked?: boolean;
    showRefresh?: boolean;
    /** Show a drag-handle affordance on the right (custom layouts only). */
    showDragHandle?: boolean;
    /** Wired as the parent <div draggable=…> attribute. Leave undefined to disable drag. */
    onDragStart?: (event: React.DragEvent<HTMLDivElement>) => void;
    onRefresh?: () => void;
    /** Keyboard reorder: move this panel up among its visible siblings. Undefined at the top. */
    onMoveUp?: () => void;
    /** Keyboard reorder: move this panel down among its visible siblings. Undefined at the bottom. */
    onMoveDown?: () => void;
    /**
     * Re-focus the drag handle on mount. Reordering bumps the layout version,
     * which remounts the panel tree and drops focus — the shell sets this on the
     * moved panel so keyboard reordering can continue without re-tabbing.
     */
    focusHandleOnMount?: boolean;
    /** Called once the handle has been re-focused, so the shell can clear its pending flag. */
    onHandleFocused?: () => void;
    rightSlot?: React.ReactNode;
    /**
     * Ref callback for a per-card header slot DOM node. A box body can render its
     * own header controls into this node via `createPortal`, keeping the control's
     * state local while it visually lives in the gradient header. The node uses
     * `display: contents` so an empty slot adds no spacing and portaled controls
     * sit naturally alongside the refresh/collapse/drag actions.
     */
    headerSlotRef?: (el: HTMLElement | null) => void;
}

/*
 * Both buttons share the panel bar with the other Mantine controls, so they take
 * the bar's own metrics and hover behaviour from `panel-controls` rather than
 * choosing their own — grows on hover instead of a background wash (see
 * `panelControlTokens`); the box is a plain size.
 */
const actionButtonProps = {
    variant: 'subtle' as const,
    color: 'gray' as const,
    radius: 'xl' as const,
    w: PANEL_CONTROL_HEIGHT,
    h: PANEL_CONTROL_HEIGHT,
    className: panelIconButtonClassName,
};

export const BoxHeader: React.FC<BoxHeaderProps> = ({
    icon,
    title,
    subtitle,
    locked,
    showRefresh,
    showDragHandle,
    onDragStart,
    onRefresh,
    onMoveUp,
    onMoveDown,
    focusHandleOnMount,
    onHandleFocused,
    rightSlot,
    headerSlotRef,
}) => {
    // Subtitle (typically the selected jobNo) lives in the title itself so
    // it picks up PanelHeader's existing truncation + contrast handling.
    const composedTitle = subtitle ? `${title} · ${subtitle}` : title;

    const dragHandleRef = useRef<HTMLButtonElement>(null);

    // Restore focus to the handle after a reorder remounts the panel tree.
    useEffect(() => {
        if (focusHandleOnMount) {
            dragHandleRef.current?.focus();
            onHandleFocused?.();
        }
        // Mount-only: focusHandleOnMount reflects the moved panel at mount time.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleReorderKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'ArrowUp' && onMoveUp) {
            event.preventDefault();
            event.stopPropagation();
            onMoveUp();
        } else if (event.key === 'ArrowDown' && onMoveDown) {
            event.preventDefault();
            event.stopPropagation();
            onMoveDown();
        }
    };

    const action = (
        <>
            {headerSlotRef ? <span ref={headerSlotRef} style={{display: 'contents'}} /> : null}
            {rightSlot}
            {showRefresh && onRefresh ? (
                <Tooltip label="Refresh">
                    <ActionIcon {...actionButtonProps} onClick={onRefresh} aria-label="Refresh">
                        <Icon lucide={RefreshCw} size={PANEL_CONTROL_GLYPH_SIZE}/>
                    </ActionIcon>
                </Tooltip>
            ) : null}
            {showDragHandle ? (
                <Tooltip label="Drag, or use the arrow keys, to reorder">
                    <ActionIcon
                        {...actionButtonProps}
                        ref={dragHandleRef}
                        aria-label={`Reorder ${title} — use the up and down arrow keys`}
                        aria-roledescription="sortable"
                        onKeyDown={handleReorderKeyDown}
                        opacity={0.85}
                        style={{cursor: 'grab'}}
                    >
                        <Icon lucide={GripVertical} size={PANEL_CONTROL_GLYPH_SIZE}/>
                    </ActionIcon>
                </Tooltip>
            ) : null}
        </>
    );

    return (
        <Box draggable={!!onDragStart} onDragStart={onDragStart} style={{cursor: onDragStart ? 'grab' : 'default'}}>
            <PanelHeader
                icon={<SymbolIcon name={icon} aria-hidden />}
                title={composedTitle}
                badge={locked ? 'LOCKED' : undefined}
                action={action}
            />
        </Box>
    );
};
