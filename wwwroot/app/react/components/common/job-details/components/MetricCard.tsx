/**
 * MetricCard - Single metric tile for the timing/pricing grid.
 * Centered text with category-aware accent colors and hover interactions.
 */

import React from 'react';
import {Box, Text, UnstyledButton} from '@mantine/core';
import {metricLabelStyle, metricValueStyle} from '../JobDetails.styles';
import classes from './MetricCard.module.css';

export type MetricCategory = 'pricing' | 'time' | 'pod' | 'info';

interface MetricCardProps {
    label: string;
    value: string;
    onClick?: () => void;
    disabled?: boolean;
    highlight?: boolean;
    category?: MetricCategory;
    filled?: boolean;
    dense?: boolean;
    /**
     * Optional overlay rendered absolutely on top of the card. Used for the
     * partner-job "change pending" indicator — the wrapping container is
     * already position: relative.
     */
    overlay?: React.ReactNode;
}

const categoryAccentMap: Record<MetricCategory, string> = {
    pricing: 'var(--mantine-color-orange-5)',
    time: 'var(--mantine-primary-color-filled)',
    pod: 'var(--mantine-color-green-5)',
    info: 'var(--mantine-color-gray-4)',
};

const cardStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    width: '100%',
    height: '100%',
    backgroundColor: 'var(--dd-surface-container)',
    position: 'relative',
};

export const MetricCard = React.memo(({
    label,
    value,
    onClick,
    disabled,
    highlight,
    category = 'info',
    filled,
    dense,
    overlay,
}: MetricCardProps) => {
    const isClickable = onClick && !disabled;
    const accentColor = categoryAccentMap[category];
    const hasValue = !!value && value !== '-' && value !== '—';

    const content = (
        <Box
            className={[
                isClickable ? classes.clickable : '',
                filled && hasValue ? classes.filled : '',
            ].filter(Boolean).join(' ') || undefined}
            style={{
                ...cardStyle,
                paddingInline: dense ? 8 : 12,
                paddingBlock: dense ? 4 : 12,
                // Longhands: jsdom drops a `border-top` shorthand carrying a
                // `var()`, which would make the accent rule untestable.
                ...(highlight ? {
                    borderTopWidth: 3,
                    borderTopStyle: 'solid' as const,
                    borderTopColor: accentColor,
                } : {}),
                '--metric-accent': accentColor,
            } as React.CSSProperties}
        >
            <Text className={classes.label} span style={metricLabelStyle(!!dense)}>
                {label}
            </Text>
            <Text
                className={hasValue ? classes.value : classes.valueEmpty}
                span
                style={{
                    ...metricValueStyle(!!dense),
                    fontWeight: hasValue ? 700 : 400,
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    maxWidth: '100%',
                }}
            >
                {value || '—'}
            </Text>
            {overlay}
        </Box>
    );

    if (isClickable) {
        return (
            <UnstyledButton onClick={onClick} style={{width: '100%', height: '100%'}}>
                {content}
            </UnstyledButton>
        );
    }

    return content;
});
