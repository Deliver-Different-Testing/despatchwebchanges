import React from 'react';
import {Box, Paper, Text, ThemeIcon, alpha} from '@mantine/core';

export interface SummaryCardProps {
    color: string;
    icon: React.ReactNode;
    label: string;
    value: string;
    footer?: React.ReactNode;
}

/** One revenue/cost/profit tile above a pricing table (PriceBreakdownDialog, SplitPricingBreakdownDialog). */
export function SummaryCard({color, icon, label, value, footer}: SummaryCardProps): React.ReactElement {
    const accent = `var(--mantine-color-${color}-6)`;
    return (
        <Paper
            p="md"
            radius="lg"
            style={{
                border: `1px solid ${alpha(accent, 0.2)}`,
                backgroundColor: alpha(accent, 0.04),
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--mantine-spacing-md)',
            }}
        >
            <ThemeIcon
                size={52}
                radius="md"
                c={`${color}.6`}
                style={{'--ti-bg': alpha(accent, 0.12)} as React.CSSProperties}
            >
                {icon}
            </ThemeIcon>
            <Box>
                <Text size="sm" c="dimmed" fw={500}>{label}</Text>
                <Text fz="h3" fw={700} c={`${color}.8`}>{value}</Text>
                {footer}
            </Box>
        </Paper>
    );
}

export default SummaryCard;
