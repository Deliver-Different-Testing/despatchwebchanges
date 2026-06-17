/**
 * Thin adapter that maps a Job Search box's metadata (Material Symbols
 * glyph name, title, refresh + collapse handlers) onto the shared
 * `PanelHeader` so the boxes pick up the same gradient hero header used
 * by Recurring Jobs, Overview, Task Dashboard, etc.
 */

import React from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {PanelHeader} from '../../../components/common/panel-header';

export interface BoxHeaderProps {
    /** Material Symbols outlined glyph name, e.g. "filter_list". */
    icon: string;
    title: string;
    subtitle?: string;
    locked?: boolean;
    collapsed?: boolean;
    showRefresh?: boolean;
    showCollapse?: boolean;
    /** Show a drag-handle affordance on the right (custom layouts only). */
    showDragHandle?: boolean;
    /** Wired as the parent <div draggable=…> attribute. Leave undefined to disable drag. */
    onDragStart?: (event: React.DragEvent<HTMLDivElement>) => void;
    onRefresh?: () => void;
    onToggleCollapse?: () => void;
    rightSlot?: React.ReactNode;
}

const actionButtonSx = {
    color: 'inherit',
    // Subtle white-on-gradient hover — matches the icon-badge tone in
    // PanelHeader so the buttons feel native to the header.
    '&:hover': {bgcolor: 'rgba(255,255,255,0.12)'},
};

export const BoxHeader: React.FC<BoxHeaderProps> = ({
    icon,
    title,
    subtitle,
    locked,
    collapsed,
    showRefresh,
    showCollapse,
    showDragHandle,
    onDragStart,
    onRefresh,
    onToggleCollapse,
    rightSlot,
}) => {
    // Subtitle (typically the selected jobNo) lives in the title itself so
    // it picks up PanelHeader's existing truncation + contrast handling.
    const composedTitle = subtitle ? `${title} · ${subtitle}` : title;

    const action = (
        <>
            {rightSlot}
            {showRefresh && onRefresh ? (
                <Tooltip title="Refresh">
                    <IconButton size="small" onClick={onRefresh} aria-label="Refresh" sx={actionButtonSx}>
                        <RefreshIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            ) : null}
            {showCollapse && onToggleCollapse ? (
                <Tooltip title={collapsed ? 'Expand' : 'Collapse'}>
                    <IconButton
                        size="small"
                        onClick={onToggleCollapse}
                        aria-label={collapsed ? 'Expand' : 'Collapse'}
                        sx={actionButtonSx}
                    >
                        {collapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
                    </IconButton>
                </Tooltip>
            ) : null}
            {showDragHandle ? (
                <Tooltip title="Drag to reorder">
                    <Box
                        component="span"
                        aria-label="Drag handle"
                        sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            color: 'inherit',
                            cursor: 'grab',
                            opacity: 0.85,
                            '&:active': {cursor: 'grabbing'},
                        }}
                    >
                        <DragIndicatorIcon fontSize="small" />
                    </Box>
                </Tooltip>
            ) : null}
        </>
    );

    return (
        <Box draggable={!!onDragStart} onDragStart={onDragStart} sx={{cursor: onDragStart ? 'grab' : 'default'}}>
            <PanelHeader
                icon={<span className="material-symbols-outlined" aria-hidden>{icon}</span>}
                title={composedTitle}
                badge={locked ? 'LOCKED' : undefined}
                action={action}
            />
        </Box>
    );
};
