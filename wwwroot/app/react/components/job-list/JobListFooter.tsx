/**
 * Job List Footer
 *
 * Shows the count of displayed jobs and last updated timestamp.
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type {SxProps, Theme} from '@mui/material';

interface JobListFooterProps {
    displayedCount: number;
    totalCount: number;
    lastUpdated: string;
    isLoadingMore?: boolean;
    allJobsLoaded?: boolean;
}

const styles: Record<string, SxProps<Theme>> = {
    container: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 2,
        py: 0.5,
        borderTop: 1,
        borderColor: 'divider',
        bgcolor: 'grey.50',
        minHeight: 32,
    },
};

export const JobListFooter: React.FC<JobListFooterProps> = ({
    displayedCount,
    totalCount,
    lastUpdated,
    isLoadingMore,
    allJobsLoaded,
}) => {
    if (displayedCount === 0 && !isLoadingMore) {
        return null;
    }

    let displayText: string;
    if (isLoadingMore) {
        displayText = 'Loading more jobs...';
    } else if (totalCount > 0 && !allJobsLoaded) {
        displayText = `Showing ${displayedCount} of ${totalCount} jobs`;
    } else {
        displayText = `Showing ${displayedCount} jobs`;
    }

    return (
        <Box sx={styles.container}>
            <Typography
                variant="caption"
                sx={{
                    color: "text.secondary",
                    fontWeight: 500
                }}>
                {displayText}
            </Typography>
            <Typography variant="caption" sx={{
                color: "text.disabled"
            }}>
                {lastUpdated}
            </Typography>
        </Box>
    );
};
