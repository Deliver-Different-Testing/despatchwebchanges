/**
 * ToolbarActionsBar
 *
 * Renders the app-bar trailing actions and, on narrow viewports, collapses the
 * lower-priority "simple" actions into a Material Design overflow ("More") menu.
 * Actions that are themselves dropdown menus (Views, Layouts, Date filter, …)
 * stay inline — they're the primary surfaces and can't be flattened into a
 * single menu item — so only actions that supply an `overflow` descriptor move.
 *
 * Compact mode is derived from the viewport via `useMediaQuery` (deterministic
 * and easy to test). A ResizeObserver-measured variant was considered but the
 * self-contained dropdown triggers make width measurement fragile; the
 * breakpoint approach matches MD3's "collapse at smaller window sizes" guidance.
 */

import React, {useState} from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import useMediaQuery from '@mui/material/useMediaQuery';
import {useTheme} from '@mui/material/styles';
import {toolbarIconButtonSx} from './ToolbarActions';

export interface ToolbarOverflowEntry {
    label: string;
    icon?: React.ReactNode;
    onSelect: (event: React.MouseEvent) => void;
}

export interface ToolbarActionItem {
    key: string;
    /** Inline rendering (the existing icon button / menu component). */
    node: React.ReactNode;
    /**
     * When provided, this action collapses into the overflow menu in compact
     * mode. Omit for actions that must always stay inline (e.g. dropdown menus).
     */
    overflow?: ToolbarOverflowEntry;
}

export interface ToolbarActionsBarProps {
    actions: ToolbarActionItem[];
    /** Force compact mode (testing/stories). Otherwise derived from viewport width. */
    compact?: boolean;
}

export const ToolbarActionsBar: React.FC<ToolbarActionsBarProps> = ({actions, compact}) => {
    const theme = useTheme();
    const isNarrow = useMediaQuery(theme.breakpoints.down('md'));
    const compactMode = compact ?? isNarrow;

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    const handleOpen = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
    const handleClose = () => setAnchorEl(null);

    const inlineItems = compactMode ? actions.filter(a => !a.overflow) : actions;
    const overflowItems = compactMode
        ? actions.filter((a): a is ToolbarActionItem & {overflow: ToolbarOverflowEntry} => !!a.overflow)
        : [];

    return (
        <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
            {inlineItems.map(item => (
                <React.Fragment key={item.key}>{item.node}</React.Fragment>
            ))}

            {overflowItems.length > 0 && (
                <>
                    <Tooltip title="More actions">
                        <IconButton
                            color="inherit"
                            aria-label="More actions"
                            aria-haspopup="true"
                            aria-expanded={open ? 'true' : undefined}
                            onClick={handleOpen}
                            sx={toolbarIconButtonSx}
                        >
                            <MoreVertIcon sx={{fontSize: 22}}/>
                        </IconButton>
                    </Tooltip>
                    <Menu
                        anchorEl={anchorEl}
                        open={open}
                        onClose={handleClose}
                        anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
                        transformOrigin={{vertical: 'top', horizontal: 'right'}}
                        slotProps={{paper: {elevation: 3, sx: {minWidth: 200, mt: 0.5}}}}
                    >
                        {overflowItems.map(item => (
                            <MenuItem
                                key={item.key}
                                onClick={(event) => {
                                    item.overflow.onSelect(event);
                                    handleClose();
                                }}
                            >
                                {item.overflow.icon && (
                                    <ListItemIcon>{item.overflow.icon}</ListItemIcon>
                                )}
                                <ListItemText>{item.overflow.label}</ListItemText>
                            </MenuItem>
                        ))}
                    </Menu>
                </>
            )}
        </Box>
    );
};

export default ToolbarActionsBar;
