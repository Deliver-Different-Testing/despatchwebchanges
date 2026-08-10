/**
 * Thin adapter that maps a Job Search box's metadata (Material Symbols
 * glyph name, title, refresh + collapse handlers) onto the shared
 * `PanelHeader` so the boxes pick up the same gradient hero header used
 * by Recurring Jobs, Overview, Task Dashboard, etc.
 */

import React, {useEffect, useRef} from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import RefreshIcon from '@mui/icons-material/Refresh';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import type {Theme} from '@mui/material/styles';
import {headerOverlayColor} from '../../../components/dialogs/shared/styles';
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

const actionButtonSx = (theme: Theme) => ({
    color: 'inherit',
    // Subtle hover derived from the header's own on-colour, so it darkens the
    // paper bar rather than washing out against it.
    '&:hover': {bgcolor: headerOverlayColor(theme, 0.08, 'surface')},
});

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
                <Tooltip title="Refresh">
                    <IconButton size="small" onClick={onRefresh} aria-label="Refresh" sx={actionButtonSx}>
                        <RefreshIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            ) : null}
            {showDragHandle ? (
                <Tooltip title="Drag, or use the arrow keys, to reorder">
                    <IconButton
                        ref={dragHandleRef}
                        size="small"
                        aria-label={`Reorder ${title} — use the up and down arrow keys`}
                        aria-roledescription="sortable"
                        onKeyDown={handleReorderKeyDown}
                        sx={[actionButtonSx, {cursor: 'grab', opacity: 0.85, '&:active': {cursor: 'grabbing'}}]}
                    >
                        <DragIndicatorIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            ) : null}
        </>
    );

    return (
        <Box draggable={!!onDragStart} onDragStart={onDragStart} sx={{cursor: onDragStart ? 'grab' : 'default'}}>
            <PanelHeader
                icon={<SymbolIcon name={icon} aria-hidden />}
                title={composedTitle}
                badge={locked ? 'LOCKED' : undefined}
                action={action}
            />
        </Box>
    );
};
