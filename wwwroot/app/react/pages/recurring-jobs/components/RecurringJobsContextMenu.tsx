/**
 * Recurring Jobs Context Menu Component
 *
 * Right-click context menu for recurring job actions (add stops).
 */

import React from 'react';
import {Divider, ListItemIcon, ListItemText, Menu, MenuItem,} from '@mui/material';
import {PinDrop as PinDropIcon,} from '@mui/icons-material';
import {PrebookListModel} from '../../../interfaces';

export interface RecurringJobsContextMenuProps {
    anchorPosition: { x: number; y: number } | null;
    job: PrebookListModel | null;
    onClose: () => void;
    onAddPickupStop: (job: PrebookListModel) => void;
    onAddDeliveryStop: (job: PrebookListModel) => void;
}

export const RecurringJobsContextMenu: React.FC<RecurringJobsContextMenuProps> = ({
                                                                                      anchorPosition,
                                                                                      job,
                                                                                      onClose,
                                                                                      onAddPickupStop,
                                                                                      onAddDeliveryStop,
                                                                                  }) => {
    const handleAddPickupStop = () => {
        if (job) {
            onAddPickupStop(job);
        }
        onClose();
    };

    const handleAddDeliveryStop = () => {
        if (job) {
            onAddDeliveryStop(job);
        }
        onClose();
    };

    return (
        <Menu
            open={anchorPosition !== null && job !== null}
            onClose={onClose}
            anchorReference="anchorPosition"
            anchorPosition={
                anchorPosition
                    ? {top: anchorPosition.y, left: anchorPosition.x}
                    : undefined
            }
            slotProps={{
                paper: {
                    elevation: 8,
                    sx: {
                        minWidth: 180,
                        borderRadius: 1,
                    },
                },
            }}
        >
            <MenuItem onClick={handleAddPickupStop}>
                <ListItemIcon>
                    <PinDropIcon fontSize="small" sx={{color: 'success.main'}}/>
                </ListItemIcon>
                <ListItemText>Add Pickup Stop</ListItemText>
            </MenuItem>
            <Divider/>
            <MenuItem onClick={handleAddDeliveryStop}>
                <ListItemIcon>
                    <PinDropIcon fontSize="small" sx={{color: 'error.main'}}/>
                </ListItemIcon>
                <ListItemText>Add Delivery Stop</ListItemText>
            </MenuItem>
        </Menu>
    );
};

export default RecurringJobsContextMenu;
