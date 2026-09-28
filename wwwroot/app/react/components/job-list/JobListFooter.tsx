/**
 * Job List Footer
 *
 * Shows the count of displayed jobs and last updated timestamp.
 */

import React from 'react';
import {Group, Text} from '@mantine/core';

interface JobListFooterProps {
    displayedCount: number;
    totalCount: number;
    lastUpdated: string;
    isLoadingMore?: boolean;
    allJobsLoaded?: boolean;
}

const containerStyle: React.CSSProperties = {
    borderTop: '1px solid var(--mantine-color-default-border)',
    backgroundColor: 'var(--mantine-color-gray-1)',
    minHeight: 32,
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
        <Group justify="space-between" align="center" px="md" py={4} gap="xs" style={containerStyle}>
            <Text size="xs" c="dimmed" fw={500}>
                {displayText}
            </Text>
            <Text size="xs" c="var(--mantine-color-gray-5)">
                {lastUpdated}
            </Text>
        </Group>
    );
};
