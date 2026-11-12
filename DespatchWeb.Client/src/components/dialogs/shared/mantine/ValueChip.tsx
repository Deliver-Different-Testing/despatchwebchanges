import React from 'react';
import {Box, Text} from '@mantine/core';

export interface ValueChipProps {
    label: string;
    value: string;
}

/** A label/value tile, shown side by side with its peers in a confirm step. */
export const ValueChip: React.FC<ValueChipProps> = ({label, value}) => (
    <Box
        p="sm"
        ta="center"
        style={{
            flex: 1,
            borderRadius: 'var(--mantine-radius-sm)',
            backgroundColor: 'var(--mantine-color-brand-light)',
            border: '1px solid var(--mantine-color-brand-3)',
        }}
    >
        <Text fz="xs" c="dimmed">{label}</Text>
        <Text fz="lg" fw={700} c="var(--mantine-color-brand-light-color)">{value}</Text>
    </Box>
);
