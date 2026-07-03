/**
 * Task List Context Menu
 *
 * Right-click context menu for a task row, mirroring the job-list context menu.
 * Currently ships a single "Unassign" action that clears the task's assigned
 * staff member; built to be extended with further task actions.
 */

import React, {useCallback, useState} from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import type {Task, TasksServiceInterface} from './TaskItem.interfaces';

export interface TaskListContextMenuProps {
    task: Task | null;
    position: {mouseX: number; mouseY: number} | null;
    onClose: () => void;
    tasksService: TasksServiceInterface;
    onTaskUpdated?: () => void;
    showSuccessToast?: (message: string) => void;
    showErrorToast?: (message: string) => void;
}

export const TaskListContextMenu: React.FC<TaskListContextMenuProps> = ({
    task,
    position,
    onClose,
    tasksService,
    onTaskUpdated,
    showSuccessToast,
    showErrorToast,
}) => {
    const [isUnassigning, setIsUnassigning] = useState(false);

    const hasAssignee = Boolean(task?.assignee?.id);

    const handleUnassign = useCallback(async () => {
        if (!task) return;

        setIsUnassigning(true);
        try {
            await tasksService.unassignTask(task.id);
            showSuccessToast?.('Task unassigned');
            onTaskUpdated?.();
            onClose();
        } catch (error) {
            showErrorToast?.('Error unassigning task');
            console.error('Error unassigning task:', error);
        } finally {
            setIsUnassigning(false);
        }
    }, [task, tasksService, showSuccessToast, showErrorToast, onTaskUpdated, onClose]);

    const open = Boolean(task && position);

    return (
        <Menu
            open={open}
            onClose={onClose}
            anchorReference="anchorPosition"
            anchorPosition={position ? {top: position.mouseY, left: position.mouseX} : undefined}
        >
            <Tooltip title={hasAssignee ? '' : 'Task is already unassigned'} placement="left">
                <span>
                    <MenuItem onClick={handleUnassign} disabled={!hasAssignee || isUnassigning}>
                        <ListItemIcon>
                            <PersonOffIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>Unassign</ListItemText>
                    </MenuItem>
                </span>
            </Tooltip>
        </Menu>
    );
};

export default TaskListContextMenu;
