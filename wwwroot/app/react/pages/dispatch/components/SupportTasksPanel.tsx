/**
 * SupportTasksPanel
 *
 * Displays support tasks for the currently selected job using the shared TaskItem component,
 * matching the old AngularJS tasksList.html behavior.
 */

import React, {useMemo} from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import type {SxProps, Theme} from '@mui/material';
import {NoData} from '../../../components/common/no-data/NoData';
import {TaskItem} from '../../../components/common/task-item/TaskItem';
import type {Task, TaskItemConfig, TasksServiceInterface, DispatchServiceInterface} from '../../../components/common/task-item/TaskItem.interfaces';
import {markTaskAsClosed, updateTaskDate, updateTaskTime, reassignTaskToStaff, getActiveStaff} from '../../../services/tasksApi';
import type {ShowToastFn} from '../../../services/toastService';

const styles: Record<string, SxProps<Theme>> = {
    container: {
        height: '100%',
        overflow: 'auto',
        p: 1,
    },
    loading: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
    },
};

const taskItemConfig: TaskItemConfig = {
    showAssignee: true,
    allowCompletion: true,
    showJobId: false,
    showJobType: true,
    showDateTime: true,
    showDescription: true,
    showStatusIndicators: true,
    showOverdueWarning: true,
    onTaskClick: true,
};

const tasksService: TasksServiceInterface = {
    markTaskAsClosed,
    updateTaskDate,
    updateTaskTime,
    reassignTaskToStaff,
};

const dispatchService: DispatchServiceInterface = {
    getActiveStaff,
};

interface SupportTasksPanelProps {
    tasks: Task[];
    loading: boolean;
    jobId: number | null;
    onTaskUpdated?: () => void;
    onTaskClick?: (task: Task) => void;
    showToast?: ShowToastFn;
}

export function SupportTasksPanel({tasks, loading, jobId, onTaskUpdated, onTaskClick, showToast}: SupportTasksPanelProps) {
    const showSuccessToast = useMemo(
        () => showToast ? (msg: string) => showToast(msg, 'success') : undefined,
        [showToast],
    );
    const showErrorToast = useMemo(
        () => showToast ? (msg: string) => showToast(msg, 'error') : undefined,
        [showToast],
    );

    if (!jobId) {
        return (
            <NoData
                title="No Job Selected"
                message="Select a job to view support tasks"
                icon="support_agent"
            />
        );
    }

    if (loading) {
        return (
            <Box sx={styles.loading}>
                <CircularProgress size={24} />
            </Box>
        );
    }

    if (tasks.length === 0) {
        return (
            <NoData
                title="No Support Tasks"
                message="No support tasks for this job"
                icon="task_alt"
            />
        );
    }

    return (
        <Box sx={styles.container}>
            {tasks.map(task => (
                <TaskItem
                    key={task.id}
                    task={task}
                    config={taskItemConfig}
                    onTaskUpdated={onTaskUpdated}
                    onTaskClick={onTaskClick}
                    tasksService={tasksService}
                    dispatchService={dispatchService}
                    showSuccessToast={showSuccessToast}
                    showErrorToast={showErrorToast}
                />
            ))}
        </Box>
    );
}
