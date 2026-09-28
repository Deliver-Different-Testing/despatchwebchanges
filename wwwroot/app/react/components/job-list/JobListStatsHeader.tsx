/**
 * Job List Stats Header
 *
 * Displays summary counts (total, active, transit, done) for the current job list.
 * Uses theme tokens for colors following the app's design conventions.
 */

import React from 'react';
import {Group, Text} from '@mantine/core';

interface JobStats {
    total: number;
    active: number;
    transit: number;
    done: number;
}

interface JobListStatsHeaderProps {
    stats: JobStats;
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

export const JobListStatsHeader: React.FC<JobListStatsHeaderProps> = ({stats}) => (
    <Group align="center" gap="lg" px="md" py={6} wrap="nowrap" style={containerStyle}>
        <StatItem color="var(--mantine-color-gray-5)" label="Total" value={stats.total}/>
        <StatItem color="var(--mantine-color-reflex-5)" label="Active" value={stats.active}/>
        <StatItem color="var(--mantine-color-orange-5)" label="Transit" value={stats.transit}/>
        <StatItem color="var(--mantine-color-green-5)" label="Done" value={stats.done}/>
    </Group>
);

const StatItem: React.FC<{color: string; label: string; value: number}> = ({color, label, value}) => (
    <Group align="center" gap={6} wrap="nowrap">
        <span style={statDotStyle(color)}/>
        <Text size="xs" c="dimmed" fw={500} lh={1}>
            {label}
        </Text>
        <Text size="xs" fw={700} lh={1}>
            {value}
        </Text>
    </Group>
);
