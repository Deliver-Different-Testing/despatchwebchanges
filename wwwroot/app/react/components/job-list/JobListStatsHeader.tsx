/**
 * Job List Stats Header
 *
 * Displays summary counts (total, active, transit, done) for the current job list.
 * Uses theme tokens for colors following the app's design conventions.
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type {SxProps, Theme} from '@mui/material';

interface JobStats {
    total: number;
    active: number;
    transit: number;
    done: number;
}

interface JobListStatsHeaderProps {
    stats: JobStats;
}

const styles: Record<string, SxProps<Theme>> = {
    container: {
        display: 'flex',
        alignItems: 'center',
        gap: 2.5,
        px: 2,
        py: 0.75,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'grey.50',
        minHeight: 36,
    },
};

const statDot = (color: string): SxProps<Theme> => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    bgcolor: color,
    display: 'inline-block',
    flexShrink: 0,
});

export const JobListStatsHeader: React.FC<JobListStatsHeaderProps> = ({stats}) => (
    <Box sx={styles.container}>
        <StatItem color="text.disabled" label="Total" value={stats.total}/>
        <StatItem color="info.main" label="Active" value={stats.active}/>
        <StatItem color="warning.main" label="Transit" value={stats.transit}/>
        <StatItem color="success.main" label="Done" value={stats.done}/>
    </Box>
);

const StatItem: React.FC<{color: string; label: string; value: number}> = ({color, label, value}) => (
    <Box sx={{display: 'flex', alignItems: 'center', gap: 0.75}}>
        <Box sx={statDot(color)}/>
        <Typography
            variant="caption"
            sx={{
                color: "text.secondary",
                fontWeight: 500,
                lineHeight: 1
            }}>
            {label}
        </Typography>
        <Typography variant="caption" sx={{fontWeight: 700, lineHeight: 1, color: 'text.primary'}}>
            {value}
        </Typography>
    </Box>
);
