/**
 * JobDetailFab - Speed dial FAB menu for job detail widget toolbar.
 *
 * Mirrors the AngularJS md-fab-speed-dial in the dispatch page.
 * Expands left on hover to show contextual action mini FABs.
 */

import React, {useState} from 'react';
import {alpha} from '@mui/material/styles';
import Fab from '@mui/material/Fab';
import Tooltip from '@mui/material/Tooltip';
import Zoom from '@mui/material/Zoom';
import Box from '@mui/material/Box';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import PinDropIcon from '@mui/icons-material/PinDrop';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import EditCalendarIcon from '@mui/icons-material/EditCalendar';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import SwapCallsIcon from '@mui/icons-material/SwapCalls';
import type {SxProps, Theme} from '@mui/material';
import type {DispatchJob} from '../../../interfaces/dispatchJob';

export interface JobDetailFabProps {
    job: DispatchJob;
    onAddStop?: () => void;
    onAccessorialCharges?: () => void;
    onAttachments?: () => void;
    onAddTask?: () => void;
    onCloseTask?: () => void;
    onLockUnlock?: () => void;
    onSplitJob?: () => void;
    onSwapPod?: () => void;
    hasOpenTask?: boolean;
}

const fabContainerSx: SxProps<Theme> = {
    display: 'flex',
    alignItems: 'center',
    gap: 0.5,
    flexDirection: 'row-reverse',
};

const triggerFabSx: SxProps<Theme> = (theme: Theme) => ({
    width: 30,
    height: 30,
    minHeight: 30,
    boxShadow: 'none',
    bgcolor: alpha(theme.palette.common.white, 0.2),
    color: 'inherit',
    transition: 'background-color 200ms ease, transform 200ms ease',
    '&:hover': {
        bgcolor: alpha(theme.palette.common.white, 0.3),
        transform: 'scale(1.08)',
    },
});

const actionFabSx: SxProps<Theme> = (theme: Theme) => ({
    width: 26,
    height: 26,
    minHeight: 26,
    boxShadow: `0 1px 4px ${alpha(theme.palette.common.black, 0.2)}`,
    bgcolor: 'background.paper',
    color: 'text.secondary',
    transition: 'transform 150ms ease, box-shadow 150ms ease',
    '&:hover': {
        bgcolor: 'background.paper',
        color: 'primary.main',
        transform: 'scale(1.12)',
        boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.25)}`,
    },
    '&.Mui-disabled': {
        bgcolor: 'action.disabledBackground',
    },
});

const actionIconSx = {fontSize: 15};

export function JobDetailFab({
    job,
    onAddStop,
    onAccessorialCharges,
    onAttachments,
    onAddTask,
    onCloseTask,
    onLockUnlock,
    onSplitJob,
    onSwapPod,
    hasOpenTask,
}: JobDetailFabProps) {
    const [open, setOpen] = useState(false);

    const isLocked = !!job.locked;
    const isInvoiced = !!job.invoiced;
    const hasAccessorialCharges = !!job.accessorialChargeGroupId;
    const isAgentJob = job.isAgentJob;
    const canSplit = !!job.allowSplit;
    const canSwapPod = !!job.done && !job.isBulkJob && !job.preBook;

    // Build actions list based on job state (same order as AngularJS)
    const actions: Array<{
        key: string;
        tooltip: string;
        icon: React.ReactNode;
        onClick: () => void;
        disabled?: boolean;
    }> = [];

    if (isAgentJob && onAddStop) {
        actions.push({
            key: 'addStop',
            tooltip: 'Add Stop',
            icon: <PinDropIcon sx={actionIconSx} />,
            onClick: onAddStop,
        });
    }

    if (hasAccessorialCharges && onAccessorialCharges) {
        actions.push({
            key: 'accessorial',
            tooltip: 'Accessorial Charges',
            icon: <ReceiptLongIcon sx={actionIconSx} />,
            onClick: onAccessorialCharges,
        });
    }

    if (onAttachments) {
        actions.push({
            key: 'attachments',
            tooltip: 'Attachments',
            icon: <CloudUploadIcon sx={actionIconSx} />,
            onClick: onAttachments,
        });
    }

    if (onAddTask) {
        actions.push({
            key: 'addTask',
            tooltip: 'Add Task',
            icon: <EditCalendarIcon sx={actionIconSx} />,
            onClick: onAddTask,
        });
    }

    if (onCloseTask) {
        actions.push({
            key: 'closeTask',
            tooltip: 'Close Task',
            icon: <EventAvailableIcon sx={actionIconSx} />,
            onClick: onCloseTask,
            disabled: !hasOpenTask,
        });
    }

    if (!isInvoiced && onLockUnlock) {
        actions.push({
            key: 'lock',
            tooltip: isLocked ? 'Unlock Job' : 'Lock Job',
            icon: isLocked ? <LockOpenIcon sx={actionIconSx} /> : <LockIcon sx={actionIconSx} />,
            onClick: onLockUnlock,
        });
    }

    if (canSplit && onSplitJob) {
        actions.push({
            key: 'split',
            tooltip: 'Split Job',
            icon: <ShuffleIcon sx={actionIconSx} />,
            onClick: onSplitJob,
        });
    }

    if (canSwapPod && onSwapPod) {
        actions.push({
            key: 'swapPod',
            tooltip: 'Swap POD',
            icon: <SwapCallsIcon sx={actionIconSx} />,
            onClick: onSwapPod,
        });
    }

    return (
        <Box
            sx={fabContainerSx}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
        >
            {/* Trigger FAB */}
            <Tooltip title="Actions" enterDelay={400}>
                <Fab
                    size="small"
                    sx={triggerFabSx}
                    aria-label="Job detail options"
                >
                    <MoreHorizIcon sx={{fontSize: 18}} />
                </Fab>
            </Tooltip>

            {/* Action FABs - expand left */}
            {actions.map((action, index) => (
                <Zoom
                    key={action.key}
                    in={open}
                    style={{transitionDelay: open ? `${index * 40}ms` : '0ms'}}
                    unmountOnExit
                >
                    <Tooltip title={action.tooltip} enterDelay={200}>
                        <span>
                            <Fab
                                size="small"
                                sx={actionFabSx}
                                onClick={action.onClick}
                                disabled={action.disabled}
                                aria-label={action.tooltip}
                            >
                                {action.icon}
                            </Fab>
                        </span>
                    </Tooltip>
                </Zoom>
            ))}
        </Box>
    );
}
