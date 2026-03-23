/**
 * WidgetPanel - Container for each dashboard widget
 *
 * Renders the toolbar header (icon, title, subtitle, actions, refresh, drag handle)
 * and the content area. Matches the existing AngularJS md-toolbar widget-toolbar design.
 */

import React, {memo} from 'react';
import {alpha} from '@mui/material/styles';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Icon from '@mui/material/Icon';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type {SxProps, Theme} from '@mui/material';
import type {BoxConfig} from '../DispatchPage.interfaces';

interface WidgetPanelProps {
    config: BoxConfig;
    subtitle?: string;
    isDefaultLayout: boolean;
    onRefresh?: () => void;
    /** Extra toolbar content (e.g., view tabs, menus) rendered before spacer */
    toolbarContent?: React.ReactNode;
    /** Extra toolbar actions rendered after spacer (e.g., truck mode menu) */
    toolbarActions?: React.ReactNode;
    children: React.ReactNode;
}

const styles: Record<string, SxProps<Theme>> = {
    root: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        borderRadius: 1.5,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: 1,
    },
    toolbar: (theme: Theme) => ({
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        minHeight: 40,
        px: 1.25,
        gap: 0.5,
        flexShrink: 0,
        boxShadow: `0 1px 3px ${alpha(theme.palette.common.black, 0.2)}`,
        '& .MuiIconButton-root': {
            color: 'inherit',
            p: 0.5,
            borderRadius: 1,
            transition: 'background-color 150ms ease, transform 150ms ease',
            '&:hover': {
                bgcolor: alpha(theme.palette.common.white, 0.15),
            },
            '&:active': {
                transform: 'scale(0.92)',
            },
        },
    }),
    icon: {
        fontSize: 20,
        mr: 0.75,
        opacity: 0.9,
    },
    title: {
        fontWeight: 600,
        fontSize: '0.85rem',
        letterSpacing: '0.01em',
    },
    subtitle: {
        ml: 0.75,
        opacity: 0.75,
        fontWeight: 400,
        fontSize: '0.75rem',
    },
    spacer: {
        flex: 1,
    },
    toolbarIcon: {
        fontSize: 18,
    },
    dragHandle: (theme: Theme) => ({
        cursor: 'grab',
        display: 'flex',
        alignItems: 'center',
        borderRadius: 1,
        p: 0.25,
        ml: 0.25,
        opacity: 0.6,
        transition: 'opacity 150ms ease, background-color 150ms ease',
        '&:hover': {
            opacity: 1,
            bgcolor: alpha(theme.palette.common.white, 0.1),
        },
        '&:active': {cursor: 'grabbing', opacity: 1},
    }),
    content: {
        flex: 1,
        overflow: 'auto',
        minHeight: 0,
    },
};

export const WidgetPanel = memo(function WidgetPanel({
    config,
    subtitle,
    isDefaultLayout,
    onRefresh,
    toolbarContent,
    toolbarActions,
    children,
}: WidgetPanelProps) {
    return (
        <Box sx={styles.root}>
            {/* Toolbar header */}
            <Toolbar variant="dense" disableGutters sx={styles.toolbar}>
                {/* Box icon */}
                <Icon sx={styles.icon} baseClassName="material-symbols-outlined">
                    {config.icon}
                </Icon>

                {/* Title + subtitle */}
                <Typography variant="subtitle2" noWrap sx={styles.title}>
                    {config.title}
                    {subtitle && (
                        <Box component="span" sx={styles.subtitle}>
                            {subtitle}
                        </Box>
                    )}
                </Typography>

                {/* Extra toolbar content (e.g., view tabs) */}
                {toolbarContent}

                {/* Spacer */}
                <Box sx={styles.spacer} />

                {/* Extra toolbar actions */}
                {toolbarActions}

                {/* Refresh button */}
                {config.showRefresh && onRefresh && (
                    <Tooltip title="Refresh" enterDelay={400}>
                        <IconButton
                            size="small"
                            onClick={onRefresh}
                            aria-label={`Refresh ${config.title}`}
                        >
                            <Icon sx={styles.toolbarIcon} baseClassName="material-symbols-outlined">
                                refresh
                            </Icon>
                        </IconButton>
                    </Tooltip>
                )}

                {/* Drag handle */}
                {!isDefaultLayout && (
                    <Box className="drag-handle" sx={styles.dragHandle}>
                        <Icon sx={styles.toolbarIcon} baseClassName="material-symbols-outlined">
                            drag_indicator
                        </Icon>
                    </Box>
                )}
            </Toolbar>

            {/* Content */}
            <Box sx={styles.content}>
                {children}
            </Box>
        </Box>
    );
});
