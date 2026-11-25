import React from 'react';
import {Group, Text} from '@mantine/core';

interface JobListFooterProps {
    displayedCount: number;
    totalCount: number;
    lastUpdated: string;
    isLoadingMore?: boolean;
    allJobsLoaded?: boolean;
    /** The search stopped at its match cap, so the total is a lower bound. */
    totalIsCapped?: boolean;
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
    totalIsCapped,
}) => {
    if (displayedCount === 0 && !isLoadingMore) {
        return null;
    }

    let displayText: string;
    if (isLoadingMore) {
        displayText = 'Loading more jobs…';
    } else if (totalIsCapped) {
        displayText = `Showing ${displayedCount} of ${totalCount.toLocaleString()}+ jobs. Narrow the search to see the rest.`;
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
            <Text size="xs" c="light-dark(var(--mantine-color-gray-5), var(--mantine-color-dark-2))">
                {lastUpdated}
            </Text>
        </Group>
    );
};
