/**
 * React Toolbar Action Components
 *
 * Material Design 3 compliant toolbar action buttons and menus.
 * Consistent 40px touch targets with proper hover states.
 */

import React, {useState} from 'react';
import {alpha} from '@mui/material/styles';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Popover from '@mui/material/Popover';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';
import DeleteIcon from '@mui/icons-material/Delete';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsIcon from '@mui/icons-material/Settings';
import EditIcon from '@mui/icons-material/Edit';
import DoneIcon from '@mui/icons-material/Done';
import SmsIcon from '@mui/icons-material/Sms';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import type {SxProps, Theme} from '@mui/material/styles';

// Re-export DateFilterMenu
export {DateFilterMenu} from '../date-filter-menu/DateFilterMenu';
export type {DateFilterData, DateFilterMenuProps, DateRangeOption} from '../date-filter-menu/DateFilterMenu';

// Re-export ActionsMenu
export {ActionsMenu} from './ActionsMenu';
export type {ActionsMenuProps} from './ActionsMenu';

// Shared icon button styles for consistent appearance across toolbar actions
export const toolbarIconButtonSx: SxProps<Theme> = {
    p: 1,
    '&:hover': {
        bgcolor: (theme: Theme) => alpha(theme.palette.common.white, 0.12),
    },
};

// Messages Button
export interface MessagesButtonProps {
    unreadCount: number;
    onClick: (event: React.MouseEvent) => void;
}

export const MessagesButton: React.FC<MessagesButtonProps> = ({unreadCount, onClick}) => {
    const displayCount = unreadCount > 99 ? '99+' : unreadCount;

    return (
        <Tooltip title="Messages">
            <IconButton color="inherit" onClick={onClick} sx={toolbarIconButtonSx}>
                <Badge
                    badgeContent={unreadCount > 0 ? displayCount : null}
                    color="error"
                    max={99}
                    sx={{
                        '& .MuiBadge-badge': {
                            fontSize: '0.65rem',
                            minWidth: 18,
                            height: 18,
                        },
                    }}
                >
                    <SmsIcon sx={{fontSize: 22}}/>
                </Badge>
            </IconButton>
        </Tooltip>
    );
};

// Refresh Button
export interface RefreshButtonProps {
    onClick: () => void;
    loading?: boolean;
}

export const RefreshButton: React.FC<RefreshButtonProps> = ({onClick, loading = false}) => {
    return (
        <Tooltip title={loading ? 'Refreshing...' : 'Refresh'}>
            <span>
                <IconButton
                    color="inherit"
                    onClick={onClick}
                    disabled={loading}
                    sx={toolbarIconButtonSx}
                >
                    {loading ? (
                        <CircularProgress size={22} color="inherit" thickness={3}/>
                    ) : (
                        <RefreshIcon sx={{fontSize: 22}}/>
                    )}
                </IconButton>
            </span>
        </Tooltip>
    );
};

// Settings Button
export interface SettingsButtonProps {
    onClick: (event: React.MouseEvent) => void;
}

export const SettingsButton: React.FC<SettingsButtonProps> = ({onClick}) => {
    return (
        <Tooltip title="Settings">
            <IconButton color="inherit" onClick={onClick} sx={toolbarIconButtonSx}>
                <SettingsIcon sx={{fontSize: 22}}/>
            </IconButton>
        </Tooltip>
    );
};

// Views Menu
export interface View {
    id: number;
    name: string;
    selected: boolean;
}

export interface ViewsMenuProps {
    views: View[] | null;
    loading?: boolean;
    onToggleView: (view: View) => void;
    onClearAll: () => void;
}

export const ViewsMenu: React.FC<ViewsMenuProps> = ({
                                                        views,
                                                        loading = false,
                                                        onToggleView,
                                                        onClearAll,
                                                    }) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const selectedCount = views?.filter(v => v.selected).length || 0;

    return (
        <>
            <Tooltip title="Views">
                <span>
                    <IconButton color="inherit" onClick={handleClick} sx={toolbarIconButtonSx}>
                        {loading ? (
                            <CircularProgress size={22} color="inherit" thickness={3}/>
                        ) : (
                            <Badge
                                badgeContent={selectedCount > 0 ? selectedCount : null}
                                color="default"
                                sx={{
                                    '& .MuiBadge-badge': {
                                        bgcolor: 'rgba(255,255,255,0.9)',
                                        color: 'primary.main',
                                        fontSize: '0.65rem',
                                        minWidth: 16,
                                        height: 16,
                                    },
                                }}
                            >
                                <VisibilityIcon sx={{fontSize: 22}}/>
                            </Badge>
                        )}
                    </IconButton>
                </span>
            </Tooltip>
            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
                transformOrigin={{vertical: 'top', horizontal: 'right'}}
                slotProps={{
                    paper: {
                        elevation: 3,
                        sx: {minWidth: 220, maxHeight: 400, mt: 0.5},
                    }
                }}
            >
                {(!views || views.length === 0) ? (
                    <Box sx={{p: 3, textAlign: 'center'}}>
                        <VisibilityOffIcon sx={{fontSize: 40, color: 'text.disabled', mb: 1}}/>
                        <Typography variant="body2" sx={{
                            color: "text.secondary"
                        }}>
                            No views available
                        </Typography>
                    </Box>
                ) : ([
                    <MenuItem key="clear-all" onClick={() => {
                        onClearAll();
                    }}>
                        <ListItemIcon>
                            <ClearAllIcon fontSize="small"/>
                        </ListItemIcon>
                        <ListItemText>Clear Selection</ListItemText>
                    </MenuItem>,
                    <Divider key="divider" sx={{my: 0.5}}/>,
                    ...views.map((view) => (
                        <MenuItem
                            key={view.id}
                            onClick={() => onToggleView(view)}
                            sx={{py: 0.75}}
                        >
                            <Checkbox
                                checked={view.selected}
                                size="small"
                                sx={{p: 0, mr: 1.5}}
                            />
                            <ListItemText
                                slotProps={{primary: {
                                    variant: 'body2',
                                    sx: {fontWeight: view.selected ? 500 : 400},
                                }}}
                            >
                                {view.name}
                            </ListItemText>
                        </MenuItem>
                    )),
                ])}
            </Menu>
        </>
    );
};

// Layouts Menu
export interface Layout {
    name: string;
}

export interface LayoutsMenuProps {
    layouts: Layout[];
    currentLayoutName?: string;
    onSaveLayout: () => void;
    onLoadLayout: (index: number) => void;
    onDeleteLayout: (index: number) => void;
    /** Optional: rename a custom layout. When provided, a rename control appears on each custom row. */
    onRenameLayout?: (index: number) => void;
    /** Optional: copy the user's legacy (V1) layouts into this page's store. */
    onImportLayouts?: () => void;
    /** Optional: opens the panel-visibility settings (cross-link to the organiser). */
    onCustomizePanels?: () => void;
    /** Optional: current layout edit-mode state (drag/collapse/resize enabled). */
    editMode?: boolean;
    /** Optional: toggle layout edit mode. When provided, an Edit/Done item is shown. */
    onToggleEditMode?: () => void;
}

const DEFAULT_LAYOUT_NAME = 'Default';

export const LayoutsMenu: React.FC<LayoutsMenuProps> = ({
                                                            layouts,
                                                            currentLayoutName,
                                                            onSaveLayout,
                                                            onLoadLayout,
                                                            onDeleteLayout,
                                                            onRenameLayout,
                                                            onImportLayouts,
                                                            onCustomizePanels,
                                                            editMode,
                                                            onToggleEditMode,
                                                        }) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleSave = () => {
        onSaveLayout();
        handleClose();
    };

    const handleLoad = (index: number) => {
        onLoadLayout(index);
        handleClose();
    };

    const handleDelete = (event: React.MouseEvent, index: number) => {
        // Keep the row's load action from firing; the confirmation dialog
        // owns the actual deletion.
        event.stopPropagation();
        onDeleteLayout(index);
    };

    const handleRename = (event: React.MouseEvent, index: number) => {
        // Keep the row's load action from firing; the rename dialog owns the change.
        event.stopPropagation();
        onRenameLayout?.(index);
        handleClose();
    };

    const handleCustomize = () => {
        onCustomizePanels?.();
        handleClose();
    };

    const handleToggleEditMode = () => {
        onToggleEditMode?.();
        handleClose();
    };

    const handleImportLayouts = () => {
        onImportLayouts?.();
        handleClose();
    };

    const tooltip = currentLayoutName ? `Layouts · ${currentLayoutName}` : 'Layouts';

    // Panel visibility only applies to a custom layout — the Default layout is
    // read-only, so the entry is disabled with an explanatory tooltip.
    const isDefaultLayout = !currentLayoutName || currentLayoutName === DEFAULT_LAYOUT_NAME;
    const customizeDisabledReason =
        'Panel visibility is only available with a custom layout. Add or select a custom layout to choose which panels appear.';

    return (
        <>
            <Tooltip title={tooltip}>
                <IconButton color="inherit" onClick={handleClick} sx={toolbarIconButtonSx}>
                    <DashboardCustomizeIcon sx={{fontSize: 22}}/>
                </IconButton>
            </Tooltip>
            <Popover
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
                transformOrigin={{vertical: 'top', horizontal: 'right'}}
                slotProps={{
                    paper: {
                        elevation: 3,
                        sx: {minWidth: 240, mt: 0.5},
                    }
                }}
            >
                <List dense disablePadding sx={{py: 0.5}}>
                    <ListItemButton onClick={handleSave}>
                        <ListItemIcon sx={{minWidth: 36}}>
                            <AddIcon fontSize="small"/>
                        </ListItemIcon>
                        <ListItemText
                            slotProps={{primary: {variant: 'body2'}}}
                        >
                            Add layout
                        </ListItemText>
                    </ListItemButton>

                    {layouts.length > 0 && (
                        <ListSubheader
                            disableSticky
                            sx={{
                                lineHeight: '32px',
                                bgcolor: 'transparent',
                                color: 'text.secondary',
                                fontWeight: 600,
                            }}
                        >
                            Switch layout
                        </ListSubheader>
                    )}

                    {layouts.map((layout, index) => {
                        const isActive = layout.name === currentLayoutName;
                        const isDefault = layout.name === DEFAULT_LAYOUT_NAME;
                        return (
                            <ListItem
                                key={index}
                                disablePadding
                                secondaryAction={isDefault ? undefined : (
                                    <Box sx={{display: 'flex', alignItems: 'center'}}>
                                        {onRenameLayout && (
                                            <Tooltip title="Rename layout">
                                                <IconButton
                                                    className="layout-action"
                                                    edge="end"
                                                    size="small"
                                                    aria-label={`Rename ${layout.name}`}
                                                    onClick={(e) => handleRename(e, index)}
                                                    sx={{'&:hover': {color: 'primary.main'}}}
                                                >
                                                    <DriveFileRenameOutlineIcon fontSize="small"/>
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                        <Tooltip title="Delete layout">
                                            <IconButton
                                                className="layout-action"
                                                edge="end"
                                                size="small"
                                                aria-label={`Delete ${layout.name}`}
                                                onClick={(e) => handleDelete(e, index)}
                                                sx={{'&:hover': {color: 'error.main'}}}
                                            >
                                                <DeleteIcon fontSize="small"/>
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                )}
                                sx={{
                                    '& .layout-action': {opacity: 0, transition: 'opacity 0.15s'},
                                    '&:hover .layout-action, &:focus-within .layout-action': {opacity: 1},
                                }}
                            >
                                <ListItemButton selected={isActive} onClick={() => handleLoad(index)}>
                                    <ListItemIcon sx={{minWidth: 36}}>
                                        {isActive ? <CheckIcon fontSize="small" color="primary"/> : null}
                                    </ListItemIcon>
                                    <ListItemText
                                        slotProps={{primary: {
                                            variant: 'body2',
                                            color: isActive ? 'primary.main' : 'text.primary',
                                            sx: {fontWeight: isActive ? 600 : 400},
                                        }}}
                                    >
                                        {layout.name}
                                    </ListItemText>
                                </ListItemButton>
                            </ListItem>
                        );
                    })}

                    {onToggleEditMode && [
                        <Divider key="edit-divider" sx={{my: 0.5}}/>,
                        <Tooltip
                            key="edit-mode"
                            title={isDefaultLayout ? 'Save a layout to rearrange panels' : ''}
                            placement="left"
                        >
                            <Box component="span" sx={{display: 'block'}}>
                                <ListItemButton
                                    onClick={handleToggleEditMode}
                                    disabled={isDefaultLayout}
                                    selected={editMode}
                                >
                                    <ListItemIcon sx={{minWidth: 36}}>
                                        {editMode ? <DoneIcon fontSize="small"/> : <EditIcon fontSize="small"/>}
                                    </ListItemIcon>
                                    <ListItemText slotProps={{primary: {variant: 'body2'}}}>
                                        {editMode ? 'Done editing' : 'Edit layout'}
                                    </ListItemText>
                                </ListItemButton>
                            </Box>
                        </Tooltip>,
                    ]}

                    {onCustomizePanels && [
                        <Divider key="customize-divider" sx={{my: 0.5}}/>,
                        <Tooltip
                            key="customize"
                            title={isDefaultLayout ? customizeDisabledReason : ''}
                            placement="left"
                        >
                            {/* span wrapper so the tooltip still works while the button is disabled */}
                            <Box component="span" sx={{display: 'block'}}>
                                <ListItemButton
                                    onClick={handleCustomize}
                                    disabled={isDefaultLayout}
                                >
                                    <ListItemIcon sx={{minWidth: 36}}>
                                        <SettingsIcon fontSize="small"/>
                                    </ListItemIcon>
                                    <ListItemText slotProps={{primary: {variant: 'body2'}}}>
                                        Customize panels…
                                    </ListItemText>
                                </ListItemButton>
                            </Box>
                        </Tooltip>,
                    ]}

                    {onImportLayouts && [
                        <Divider key="import-divider" sx={{my: 0.5}}/>,
                        <ListItemButton key="import" onClick={handleImportLayouts}>
                            <ListItemIcon sx={{minWidth: 36}}>
                                <FileDownloadIcon fontSize="small"/>
                            </ListItemIcon>
                            <ListItemText slotProps={{primary: {variant: 'body2'}}}>
                                Import V1 layouts
                            </ListItemText>
                        </ListItemButton>,
                    ]}
                </List>
            </Popover>
        </>
    );
};

// Generic Icon Button - for custom toolbar actions
export interface ToolbarIconButtonProps {
    icon: React.ReactNode;
    tooltip: string;
    onClick: (event: React.MouseEvent) => void;
    disabled?: boolean;
}

export const ToolbarIconButton: React.FC<ToolbarIconButtonProps> = ({
                                                                        icon,
                                                                        tooltip,
                                                                        onClick,
                                                                        disabled = false,
                                                                    }) => {
    return (
        <Tooltip title={tooltip}>
            <span>
                <IconButton
                    color="inherit"
                    onClick={onClick}
                    disabled={disabled}
                    sx={toolbarIconButtonSx}
                >
                    {icon}
                </IconButton>
            </span>
        </Tooltip>
    );
};
