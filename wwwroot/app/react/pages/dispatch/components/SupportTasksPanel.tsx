/**
 * SupportTasksPanel
 *
 * Displays support tasks for the currently selected job.
 * Includes per-task close button for open tasks.
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import type {SxProps, Theme} from '@mui/material';
import type {Task} from '../../../interfaces';

const styles: Record<string, SxProps<Theme>> = {
    container: {
        height: '100%',
        overflow: 'auto',
        p: 1,
    },
    empty: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        p: 2,
    },
    taskItem: {
        p: 1.5,
        borderBottom: 1,
        borderColor: 'divider',
        '&:last-child': {
            borderBottom: 0,
        },
    },
    loading: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
    },
};

interface SupportTasksPanelProps {
    tasks: Task[];
    loading: boolean;
    jobId: number | null;
    onCloseTask?: (taskId: number) => void;
}

export function SupportTasksPanel({tasks, loading, jobId, onCloseTask}: SupportTasksPanelProps) {
    if (!jobId) {
        return (
            <Box sx={styles.empty}>
                <Typography variant="body2" color="text.secondary">
                    Select a job to view support tasks
                </Typography>
            </Box>
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
            <Box sx={styles.empty}>
                <Typography variant="body2" color="text.secondary">
                    No support tasks for this job
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={styles.container}>
            {tasks.map(task => (
                <Box key={task.id} sx={styles.taskItem}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" sx={{flex: 1}}>
                            {task.description || task.eventType || `Task #${task.id}`}
                        </Typography>
                        <Chip
                            label={task.closed ? 'Closed' : 'Open'}
                            size="small"
                            color={task.closed ? 'default' : 'primary'}
                            variant="outlined"
                        />
                        {!task.closed && onCloseTask && (
                            <Tooltip title="Close Task">
                                <IconButton
                                    size="small"
                                    onClick={() => onCloseTask(task.id)}
                                    sx={{p: 0.25}}
                                >
                                    <EventAvailableIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Stack>
                    {task.assignee && (
                        <Typography variant="caption" color="text.secondary">
                            Assigned to: {task.assignee.text}
                        </Typography>
                    )}
                </Box>
            ))}
        </Box>
    );
}
