/**
 * Job List Stats Header
 *
 * Displays summary counts for the current job list. Each count is named after
 * the category tab it predicts, so picking a tab shows exactly that many rows;
 * transit is shown inside Active because in-transit jobs are a part of it.
 * Uses theme tokens for colors following the app's design conventions.
 */

import React from 'react';
import {Group, Text} from '@mantine/core';
import type {JobCategory, JobListStatusCounts} from '../../types/dispatchJob';

interface JobListStatsHeaderProps {
    stats: JobListStatusCounts;
    /** Tabs the list doesn't offer; their counts are left out too. */
    hiddenCategories?: readonly JobCategory[];
}

const containerStyle: React.CSSProperties = {
    borderBottom: '1px solid var(--mantine-color-default-border)',
    backgroundColor: 'var(--mantine-color-gray-1)',
    minHeight: 36,
};

const statDotStyle = (color: string): React.CSSProperties => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: color,
    display: 'inline-block',
    flexShrink: 0,
});

export const JobListStatsHeader: React.FC<JobListStatsHeaderProps> = ({stats, hiddenCategories}) => {
    const offers = (category: JobCategory) => !hiddenCategories?.includes(category);
    return (
        <Group align="center" gap="lg" px="md" py={6} wrap="nowrap" style={containerStyle}>
            <StatItem color="var(--mantine-color-gray-5)" label="Total" value={stats.total}/>
            {offers('needs-dispatch') && (
                <StatItem color="var(--mantine-color-orange-5)" label="Unassigned" value={stats.unassigned}/>
            )}
            {offers('in-progress') && (
                <StatItem
                    color="var(--mantine-color-reflex-5)"
                    label="Active"
                    value={stats.active}
                    detail={`${stats.transit} in transit`}
                />
            )}
            {offers('delivered') && (
                <StatItem color="var(--mantine-color-green-5)" label="Done" value={stats.done}/>
            )}
        </Group>
    );
};

const StatItem: React.FC<{color: string; label: string; value: number; detail?: string}> = ({
    color,
    label,
    value,
    detail,
}) => (
    <Group align="center" gap={6} wrap="nowrap">
        <span style={statDotStyle(color)}/>
        <Text size="xs" c="dimmed" fw={500} lh={1}>
            {label}
        </Text>
        <Text size="xs" fw={700} lh={1}>
            {value}
        </Text>
        {detail && (
            <Text size="xs" c="dimmed" lh={1} style={{whiteSpace: 'nowrap'}}>
                {detail}
            </Text>
        )}
    </Group>
);
