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
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {alpha} from '@mui/material/styles';
import type {JobChangeRequestDto} from '../../services/jobChangeRequestApi';
import {formatChangeRequestValue, relativeAgeShort, ageLevel} from './jobChangeRequestFormatting';

export interface PendingChangeBadgeProps {
    request: JobChangeRequestDto;
    variant?: 'corner' | 'inline';
}

export const PendingChangeBadge: React.FC<PendingChangeBadgeProps> = ({request, variant = 'corner'}) => {
    const display = formatChangeRequestValue(request.fieldName, request.requestedValue);
    const age = relativeAgeShort(request.requestedAt);
    const level = ageLevel(request.requestedAt);
    const isOwn = request.origin === 'Local';
    const tooltip = (
        <Box>
            <Typography variant="caption" sx={{display: 'block', fontWeight: 600}}>
                {isOwn ? 'You requested' : 'Partner requested'} · {age} ago
            </Typography>
            <Typography variant="caption" sx={{display: 'block'}}>
                Pending → {display}
            </Typography>
            {request.reason && (
                <Typography variant="caption" sx={{display: 'block', fontStyle: 'italic', mt: 0.5}}>
                    “{request.reason}”
                </Typography>
            )}
        </Box>
    );

    if (variant === 'corner') {
        return (
            <Tooltip title={tooltip} arrow>
                <Box
                    aria-label={`Change pending: ${display}`}
                    sx={(theme) => ({
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        height: 8,
                        width: 8,
                        borderRadius: '50%',
                        bgcolor: level === 'overdue' ? 'error.main' : 'warning.main',
                        boxShadow: `0 0 0 2px ${theme.palette.background.paper}, 0 0 0 3px ${alpha(theme.palette.warning.main, 0.4)}`,
                        animation: level === 'overdue' ? 'pendingPulse 1.5s ease-in-out infinite' : 'none',
                        '@keyframes pendingPulse': {
                            '0%, 100%': {transform: 'scale(1)', opacity: 1},
                            '50%': {transform: 'scale(1.3)', opacity: 0.7},
                        },
                    })}
                />
            </Tooltip>
        );
    }

    return (
        <Tooltip title={tooltip} arrow placement="bottom-start">
            <Box
                sx={(theme) => ({
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 1,
                    py: 0.25,
                    mt: 0.5,
                    borderRadius: 0.75,
                    fontSize: '0.7rem',
                    color: level === 'overdue' ? 'error.dark' : 'warning.dark',
                    bgcolor: alpha(level === 'overdue' ? theme.palette.error.main : theme.palette.warning.main, 0.1),
                    border: 1,
                    borderColor: alpha(level === 'overdue' ? theme.palette.error.main : theme.palette.warning.main, 0.3),
                    maxWidth: '100%',
                })}
            >
                <Box
                    sx={(theme) => ({
                        height: 6,
                        width: 6,
                        borderRadius: '50%',
                        flexShrink: 0,
                        bgcolor: level === 'overdue' ? 'error.main' : 'warning.main',
                        animation: level === 'overdue' ? 'pendingPulseInline 1.5s ease-in-out infinite' : 'none',
                        '@keyframes pendingPulseInline': {
                            '0%, 100%': {opacity: 1},
                            '50%': {opacity: 0.4},
                        },
                    })}
                />
                <Typography component="span" variant="caption" sx={{fontWeight: 600, lineHeight: 1.3}}>
                    Change pending →
                </Typography>
                <Typography
                    component="span"
                    variant="caption"
                    sx={{
                        fontFamily: 'monospace',
                        lineHeight: 1.3,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 240,
                    }}
                >
                    {display}
                </Typography>
            </Box>
        </Tooltip>
    );
};
