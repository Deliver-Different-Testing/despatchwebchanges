/**
 * Pending-change badge — small overlay rendered on a field card when an
 * inter-tenant change request is awaiting approval for that field.
 *
 * Pure presentation; the data fetch lives in `usePendingChangeForField`
 * so the badge can be dropped onto any card without coupling that card
 * to React Query directly. The variant prop swaps between two layouts:
 *   - "corner": small floating chip absolutely positioned in the upper
 *     right of the parent (parent must be position: relative). Used on
 *     MetricCards.
 *   - "inline": full-width strip rendered beneath the field's primary
 *     value. Used on the larger sections (addresses, contacts).
 */

import React from 'react';
import {Badge, Box, Text, Tooltip} from '@mantine/core';
import {ageLevel, formatChangeRequestValue, relativeAgeShort} from './jobChangeRequestFormatting';
import classes from './PendingChangeBadge.module.css';
import {PendingChangeBadgeProps} from "./PendingChangeBadgeProps";

/**
 * Amber while the request is merely waiting, red once it is overdue. `ink` is the
 * deep step of the same ramp, for the inline strip's text on its own 10% tint.
 */
const accentFor = (overdue: boolean) => ({
    '--pending-accent': overdue ? 'var(--mantine-color-red-6)' : 'var(--mantine-color-orange-6)',
    '--pending-ink': overdue ? 'var(--mantine-color-red-8)' : 'var(--mantine-color-orange-8)',
} as React.CSSProperties);

export const PendingChangeBadge: React.FC<PendingChangeBadgeProps> = ({request, variant = 'corner'}) => {
    const display = formatChangeRequestValue(request.fieldName, request.requestedValue);
    const age = relativeAgeShort(request.requestedAt);
    const isOverdue = ageLevel(request.requestedAt) === 'overdue';
    const isOwn = request.origin === 'Local';
    const tooltip = (
        <Box>
            <Text size="xs" fw={600}>
                {isOwn ? 'You requested' : 'Partner requested'} · {age} ago
            </Text>
            <Text size="xs">Pending → {display}</Text>
            {request.reason && (
                <Text size="xs" fs="italic" mt={4}>“{request.reason}”</Text>
            )}
        </Box>
    );

    const dotClass = (layout: 'corner' | 'inline') =>
        [classes.dot, classes[layout], isOverdue ? classes.overdue : ''].filter(Boolean).join(' ');

    if (variant === 'corner') {
        return (
            <Tooltip label={tooltip} withArrow>
                <Box
                    aria-label={`Change pending: ${display}`}
                    className={dotClass('corner')}
                    style={accentFor(isOverdue)}
                />
            </Tooltip>
        );
    }

    // A tinted, hairline-bordered pill is exactly Mantine's `light` Badge, so the
    // strip is one rather than a hand-styled Box; only the dot's pulse needs CSS.
    return (
        <Tooltip label={tooltip} withArrow position="bottom-start">
            <Badge
                variant="light"
                color={isOverdue ? 'red' : 'orange'}
                size="sm"
                tt="none"
                mt={4}
                maw="100%"
                leftSection={<Box className={dotClass('inline')} style={accentFor(isOverdue)}/>}
            >
                <Text component="span" size="xs" fw={600} span>Change pending →</Text>
                <Text component="span" size="xs" span ff="monospace" ml={4}>{display}</Text>
            </Badge>
        </Tooltip>
    );
};
