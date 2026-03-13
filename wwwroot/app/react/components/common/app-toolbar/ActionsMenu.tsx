/**
 * Actions Menu Component
 *
 * A dropdown menu for quick actions like creating new jobs
 * and inter-courier charges. Follows existing ToolbarActions patterns.
 */

import React, {useState} from 'react';
import {
    alpha,
    IconButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Tooltip,
} from '@mui/material';
import {
    Add as AddIcon,
    AttachMoney as AttachMoneyIcon,
} from '@mui/icons-material';
import type {Theme} from '@mui/material/styles';

// Shared icon button styles (matching ToolbarActions.tsx)
const toolbarIconButtonSx = {
    p: 1,
    '&:hover': {
        bgcolor: (theme: Theme) => alpha(theme.palette.common.white, 0.12),
    },
};

export interface ActionsMenuProps {
    onCreateNewJob: (event: React.MouseEvent) => void;
    onInterCourierCharge: (event: React.MouseEvent) => void;
}

export const ActionsMenu: React.FC<ActionsMenuProps> = ({
    onCreateNewJob,
    onInterCourierCharge,
}) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleCreateNewJob = (event: React.MouseEvent) => {
        handleClose();
        onCreateNewJob(event);
    };

    const handleInterCourierCharge = (event: React.MouseEvent) => {
        handleClose();
        onInterCourierCharge(event);
    };

    return (
        <>
            <Tooltip title="Actions">
                <IconButton
                    color="inherit"
                    onClick={handleClick}
                    sx={toolbarIconButtonSx}
                    aria-label="Actions menu"
                    aria-controls={open ? 'actions-menu' : undefined}
                    aria-haspopup="true"
                    aria-expanded={open ? 'true' : undefined}
                >
                    <AddIcon sx={{fontSize: 22}} />
                </IconButton>
            </Tooltip>
            <Menu
                id="actions-menu"
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
                <MenuItem onClick={handleCreateNewJob}>
                    <ListItemIcon>
                        <AddIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Add New Job</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleInterCourierCharge}>
                    <ListItemIcon>
                        <AttachMoneyIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Inter-Courier Charge</ListItemText>
                </MenuItem>
            </Menu>
        </>
    );
};

export default ActionsMenu;
