/**
 * React Toolbar Action Components
 *
 * Material Design 3 compliant toolbar action buttons and menus.
 * Consistent 40px touch targets with proper hover states.
 */

import React, {useState} from 'react';
import {
    alpha,
    Badge,
    Box,
    Checkbox,
    CircularProgress,
    Divider,
    IconButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Tooltip,
    Typography,
} from '@mui/material';
import {
    ClearAll as ClearAllIcon,
    Delete as DeleteIcon,
    GridView as GridViewIcon,
    Refresh as RefreshIcon,
    Save as SaveIcon,
    Settings as SettingsIcon,
    Sms as SmsIcon,
    Tune as TuneIcon,
    ViewList as ViewListIcon,
    VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';

// Re-export DateFilterMenu
export {DateFilterMenu} from '../date-filter-menu/DateFilterMenu';
export type {DateFilterData, DateFilterMenuProps, DateRangeOption} from '../date-filter-menu/DateFilterMenu';

// Re-export ActionsMenu
export {ActionsMenu} from './ActionsMenu';
export type {ActionsMenuProps} from './ActionsMenu';

// Shared icon button styles for consistent appearance
const toolbarIconButtonSx = {
    p: 1,
    '&:hover': {
        bgcolor: (theme: any) => alpha(theme.palette.common.white, 0.12),
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
                                <ViewListIcon sx={{fontSize: 22}}/>
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
                        <Typography variant="body2" color="text.secondary">
                            No views available
                        </Typography>
                    </Box>
                ) : (
                    <>
                        <MenuItem onClick={() => {
                            onClearAll();
                        }}>
                            <ListItemIcon>
                                <ClearAllIcon fontSize="small"/>
                            </ListItemIcon>
                            <ListItemText>Clear Selection</ListItemText>
                        </MenuItem>
                        <Divider sx={{my: 0.5}}/>
                        {views.map((view) => (
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
                                    primaryTypographyProps={{
                                        variant: 'body2',
                                        fontWeight: view.selected ? 500 : 400,
                                    }}
                                >
                                    {view.name}
                                </ListItemText>
                            </MenuItem>
                        ))}
                    </>
                )}
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
}

export const LayoutsMenu: React.FC<LayoutsMenuProps> = ({
                                                            layouts,
                                                            currentLayoutName,
                                                            onSaveLayout,
                                                            onLoadLayout,
                                                            onDeleteLayout,
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
        event.stopPropagation();
        onDeleteLayout(index);
    };

    return (
        <>
            <Tooltip title="Layouts">
                <IconButton color="inherit" onClick={handleClick} sx={toolbarIconButtonSx}>
                    <GridViewIcon sx={{fontSize: 22}}/>
                </IconButton>
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
                        sx: {minWidth: 200, mt: 0.5},
                    }
                }}
            >
                <MenuItem onClick={handleSave}>
                    <ListItemIcon>
                        <SaveIcon fontSize="small"/>
                    </ListItemIcon>
                    <ListItemText>Add Layout</ListItemText>
                </MenuItem>
                {layouts.length > 0 && <Divider sx={{my: 0.5}}/>}
                {layouts.map((layout, index) => {
                    const isActive = layout.name === currentLayoutName;
                    const isDefault = layout.name === 'Default';
                    return (
                        <MenuItem
                            key={index}
                            onClick={() => handleLoad(index)}
                            sx={(theme) => ({
                                bgcolor: isActive ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                            })}
                        >
                            <ListItemIcon>
                                {isDefault ? (
                                    <TuneIcon fontSize="small" color={isActive ? 'primary' : 'inherit'}/>
                                ) : (
                                    <IconButton
                                        size="small"
                                        onClick={(e) => handleDelete(e, index)}
                                        sx={{
                                            p: 0.25,
                                            '&:hover': {
                                                color: 'error.main',
                                            },
                                        }}
                                    >
                                        <DeleteIcon fontSize="small"/>
                                    </IconButton>
                                )}
                            </ListItemIcon>
                            <ListItemText
                                primaryTypographyProps={{
                                    variant: 'body2',
                                    fontWeight: isActive ? 600 : 400,
                                    color: isActive ? 'primary.main' : 'text.primary',
                                }}
                            >
                                {layout.name}
                            </ListItemText>
                        </MenuItem>
                    );
                })}
            </Menu>
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
