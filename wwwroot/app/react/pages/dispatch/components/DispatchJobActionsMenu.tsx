import React, {useState} from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import {SymbolIcon} from '../../../components/common/symbol-icon';
import type {DispatchJob} from '../../../interfaces/dispatchJob';

/**
 * Job-detail action menu for the React dispatch page, rendered as an overflow
 * (kebab) menu in the Job Detail panel header. Mirrors the V1
 * `md-fab-speed-dial` in `wwwroot/app/components/home/home.template.html:78-156`;
 * availability conditions match the AngularJS `ng-if`s.
 *
 * Add Stop and Close Task are intentionally omitted from V1: Add Stop has no
 * React-native flow yet, and Close Task was a dead button (`closeSupport` was
 * never defined).
 */

export type DispatchJobActionId =
    | 'dispatch'
    | 'addStop'
    | 'accessorialCharges'
    | 'attachments'
    | 'addTask'
    | 'lock'
    | 'unlock'
    | 'split'
    | 'swapPod';

export interface DispatchJobActionsMenuProps {
    currentJob?: DispatchJob;
    onAction?: (actionId: DispatchJobActionId, job: DispatchJob) => void;
}

interface JobAction {
    id: DispatchJobActionId;
    label: string;
    icon: string;
    available: (job: DispatchJob) => boolean;
}

const ACTIONS: JobAction[] = [
    {id: 'dispatch', label: 'Dispatch to Courier', icon: 'send_to_mobile',
        available: job => !job.bulkJob && !job.preBook},
    {id: 'addStop', label: 'Add Stop', icon: 'pin_drop',
        available: job => job.isAgentJob},
    {id: 'accessorialCharges', label: 'Accessorial Charges', icon: 'receipt_long',
        available: job => !!job.accessorialChargeGroupId},
    {id: 'attachments', label: 'Attachments', icon: 'cloud_upload',
        available: () => true},
    {id: 'addTask', label: 'Add Task', icon: 'edit_calendar',
        available: () => true},
    {id: 'unlock', label: 'Unlock Job', icon: 'lock_open',
        available: job => !!job.locked && !job.invoiced},
    {id: 'lock', label: 'Lock Job', icon: 'lock',
        available: job => !job.locked && !job.invoiced},
    {id: 'split', label: 'Split Job', icon: 'shuffle',
        available: job => !!job.allowSplit},
    {id: 'swapPod', label: 'Swap POD', icon: 'swap_calls',
        available: job => !!job.done && !job.bulkJob && !job.preBook},
];

const MENU_ID = 'dispatch-job-actions-menu';

export const DispatchJobActionsMenu: React.FC<DispatchJobActionsMenuProps> = ({currentJob, onAction}) => {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const open = Boolean(anchorEl);

    if (!currentJob) return null;

    const visibleActions = ACTIONS.filter(a => a.available(currentJob));

    return (
        <>
            <Tooltip title="Job actions">
                <IconButton
                    size="small"
                    aria-label="Job actions"
                    aria-haspopup="true"
                    aria-controls={open ? MENU_ID : undefined}
                    aria-expanded={open ? 'true' : undefined}
                    onClick={(e) => setAnchorEl(e.currentTarget)}
                    sx={{color: 'inherit', '&:hover': {bgcolor: 'rgba(255,255,255,0.12)'}}}
                >
                    <MoreVertIcon fontSize="small" />
                </IconButton>
            </Tooltip>
            <Menu
                id={MENU_ID}
                anchorEl={anchorEl}
                open={open}
                onClose={() => setAnchorEl(null)}
                anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
                transformOrigin={{vertical: 'top', horizontal: 'right'}}
            >
                {visibleActions.map(action => (
                    <MenuItem
                        key={action.id}
                        onClick={() => {
                            setAnchorEl(null);
                            onAction?.(action.id, currentJob);
                        }}
                    >
                        <ListItemIcon>
                            <SymbolIcon name={action.icon} sx={{fontSize: 20}} aria-hidden />
                        </ListItemIcon>
                        <ListItemText>{action.label}</ListItemText>
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
};
