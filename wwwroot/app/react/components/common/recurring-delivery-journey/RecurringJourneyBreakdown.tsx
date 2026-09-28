/**
 * 4-cell breakdown bar at the top of the Recurring Log panel.
 * Total / Completed / Voided / Pending.
 */

import React from 'react';
import {Box, SimpleGrid, Stack, Text} from '@mantine/core';
import type {RecurringJourneyBreakdown as RecurringJourneyBreakdownData} from './RecurringDeliveryJourney.types';

interface RecurringJourneyBreakdownProps {
    breakdown: RecurringJourneyBreakdownData;
}

interface CellProps {
    label: string;
    value: number;
    color?: string;
}

const Cell: React.FC<CellProps> = ({label, value, color}) => (
    <Stack align="center" gap={2} px={8} py={10} bg="var(--mantine-color-body)">
        <Text component="div" fz={18} fw={700} lh={1.1} c={color}>
            {value}
        </Text>
        <Text component="div" fz={9} fw={600} tt="uppercase" c="dimmed" style={{letterSpacing: '0.4px'}}>
            {label}
        </Text>
    </Stack>
);

export const RecurringJourneyBreakdown: React.FC<RecurringJourneyBreakdownProps> = ({breakdown}) => (
    // The 1px grid gap over a divider-coloured background is what draws the
    // hairlines between cells — cheaper than a border on each.
    <Box
        mx={16}
        mt={16}
        bg="var(--mantine-color-default-border)"
        style={{
            border: '1px solid var(--mantine-color-default-border)',
            borderRadius: 4,
            overflow: 'hidden',
        }}
    >
        <SimpleGrid cols={4} spacing={1} verticalSpacing={1}>
            <Cell label="Total" value={breakdown.total}/>
            <Cell label="Completed" value={breakdown.completed} color="var(--mantine-color-green-8)"/>
            <Cell label="Voided" value={breakdown.voided} color="var(--mantine-color-red-8)"/>
            <Cell label="Pending" value={breakdown.pending} color="var(--mantine-color-yellow-8)"/>
        </SimpleGrid>
    </Box>
);

export default RecurringJourneyBreakdown;
