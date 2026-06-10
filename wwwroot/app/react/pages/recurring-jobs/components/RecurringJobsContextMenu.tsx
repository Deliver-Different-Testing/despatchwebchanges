/**
 * Recurring Jobs Context Menu Component
 *
 * Right-click context menu for recurring job actions. Surfaces:
 *  - Add Pickup / Delivery Stop (always)
 *  - Insert to live (Manual-mode rows only — opens the date+scope modal)
 *  - Mode transitions tailored to the row's current RecurringMode:
 *      Active   → Move to Manual, Deactivate
 *      Manual   → Insert to live, Activate, Deactivate
 *      Inactive → Activate, Move to Manual
 */

import React from 'react';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import BuildIcon from '@mui/icons-material/Build';
import PinDropIcon from '@mui/icons-material/PinDrop';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutlined';
import StopIcon from '@mui/icons-material/Stop';
import {PrebookListModel, RecurringMode} from '../../../interfaces';

export interface RecurringJobsContextMenuProps {
    anchorPosition: { x: number; y: number } | null;
    job: PrebookListModel | null;
    onClose: () => void;
    onAddPickupStop: (job: PrebookListModel) => void;
    onAddDeliveryStop: (job: PrebookListModel) => void;
    onInsertToLive?: (job: PrebookListModel) => void;
    onSetMode?: (job: PrebookListModel, mode: RecurringMode) => void;
}

export const RecurringJobsContextMenu: React.FC<RecurringJobsContextMenuProps> = ({
                                                                                      anchorPosition,
                                                                                      job,
                                                                                      onClose,
                                                                                      onAddPickupStop,
                                                                                      onAddDeliveryStop,
                                                                                      onInsertToLive,
                                                                                      onSetMode,
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

    const handleInsertToLive = () => {
        if (job && onInsertToLive) {
            onInsertToLive(job);
        }
        onClose();
    };

    const handleSetMode = (mode: RecurringMode) => {
        if (job && onSetMode) {
            onSetMode(job, mode);
        }
        onClose();
    };

    const currentMode = job?.recurringMode;
    const isActive = currentMode === RecurringMode.Active;
    const isManual = currentMode === RecurringMode.Manual;
    const isInactive = currentMode === RecurringMode.Inactive;
    // Insert-to-live only initiates from a parent (or standalone)
    // booking — the backend SP fans the family out from the parent's
    // ucbkID, so pushing a child in isolation isn't a supported flow.
    const isChild = job?.isChild === true;

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
                        minWidth: 200,
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
            <MenuItem onClick={handleAddDeliveryStop}>
                <ListItemIcon>
                    <PinDropIcon fontSize="small" sx={{color: 'error.main'}}/>
                </ListItemIcon>
                <ListItemText>Add Delivery Stop</ListItemText>
            </MenuItem>

            {isManual && !isChild && onInsertToLive && (
                [
                    <Divider key="insert-divider"/>,
                    <MenuItem key="insert" onClick={handleInsertToLive}>
                        <ListItemIcon>
                            <PlayCircleOutlineIcon fontSize="small" sx={{color: 'warning.main'}}/>
                        </ListItemIcon>
                        <ListItemText>Insert to live...</ListItemText>
                    </MenuItem>
                ]
            )}

            {onSetMode && currentMode !== undefined && (
                [
                    <Divider key="mode-divider"/>,
                    !isActive && (
                        <MenuItem key="activate" onClick={() => handleSetMode(RecurringMode.Active)}>
                            <ListItemIcon>
                                <PlayArrowIcon fontSize="small" sx={{color: 'success.main'}}/>
                            </ListItemIcon>
                            <ListItemText>Activate</ListItemText>
                        </MenuItem>
                    ),
                    !isManual && (
                        <MenuItem key="manual" onClick={() => handleSetMode(RecurringMode.Manual)}>
                            <ListItemIcon>
                                <BuildIcon fontSize="small" sx={{color: 'warning.main'}}/>
                            </ListItemIcon>
                            <ListItemText>Move to Manual</ListItemText>
                        </MenuItem>
                    ),
                    !isInactive && (
                        <MenuItem key="deactivate" onClick={() => handleSetMode(RecurringMode.Inactive)}>
                            <ListItemIcon>
                                <StopIcon fontSize="small" sx={{color: 'grey.600'}}/>
                            </ListItemIcon>
                            <ListItemText>Deactivate</ListItemText>
                        </MenuItem>
                    ),
                ]
            )}
        </Menu>
    );
};

export default RecurringJobsContextMenu;
