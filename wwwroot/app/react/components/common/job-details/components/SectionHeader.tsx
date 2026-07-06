/**
 * SectionHeader - Gradient header used by every job-detail section card.
 *
 * Matches the AddressSection toolbar pattern: a coloured 135° gradient bar
 * with a white icon, title, optional subtitle, and an optional end-action
 * slot for buttons / chips. The gradient itself separates the header from
 * card content, so there is no trailing Divider.
 *
 * Variants:
 *   - 'primary'   →  theme primary  (default for non-address sections)
 *   - 'pickup'    →  fixed map-blue (#2196F3 → #1976D2), regardless of theme
 *   - 'delivery'  →  theme success  (green family)
 *
 * Pickup is intentionally hard-coded — the non-US theme's primary is amber
 * which clashes with the universal pickup-blue / delivery-green convention
 * used on every map.
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type {Theme} from '@mui/material/styles';
import type {SvgIconProps} from '@mui/material/SvgIcon';
import {headerSurfaceSx, type HeaderVariant} from '../../../dialogs/shared/styles';

export type SectionHeaderVariant = 'primary' | 'pickup' | 'delivery';

interface SectionHeaderProps {
    icon: React.ComponentType<SvgIconProps>;
    title: string;
    subtitle?: string;
    /** Right-aligned slot for buttons, chips, or status indicators. */
    endAction?: React.ReactNode;
    dense?: boolean;
    variant?: SectionHeaderVariant;
}

/**
 * Section headers are a 135° gradient bar keyed to the section type: pickup is a
 * fixed map-blue (via the `info` palette), delivery is `success` (green), and
 * primary is the tenant brand. Text and the icon inherit the surface's
 * on-colour (white on the coloured gradients), matching the universal
 * pickup-blue / delivery-green map convention.
 */
const surfaceVariantFor = (variant: SectionHeaderVariant): HeaderVariant =>
    variant === 'pickup' ? 'info' : variant === 'delivery' ? 'success' : 'primary';

export const SectionHeader = React.memo(function SectionHeader({
    icon: Icon,
    title,
    subtitle,
    endAction,
    dense,
    variant = 'primary',
}: SectionHeaderProps) {
    return (
        <Box sx={(theme: Theme) => ({
            display: 'flex',
            alignItems: 'center',
            gap: dense ? 1 : 1.25,
            px: dense ? 1.5 : 2,
            py: dense ? 0.75 : 1,
            minHeight: dense ? 40 : 48,
            // Coloured gradient bar keyed to the section type; text and icon
            // inherit its on-colour.
            ...headerSurfaceSx(theme, surfaceVariantFor(variant)),
        })}>
            <Icon sx={{fontSize: dense ? 18 : 20, color: 'inherit', flexShrink: 0}} />
            <Box sx={{flex: 1, minWidth: 0}}>
                <Typography sx={{
                    fontSize: dense ? '0.8125rem' : '0.9375rem',
                    fontWeight: 700,
                    letterSpacing: '-0.005em',
                    color: 'inherit',
                    lineHeight: 1.2,
                }}>
                    {title}
                </Typography>
                {subtitle && (
                    <Typography sx={{
                        fontSize: dense ? '0.6875rem' : '0.75rem',
                        color: 'inherit',
                        opacity: 0.85,
                        lineHeight: 1.4,
                        mt: 0.125,
                    }}>
                        {subtitle}
                    </Typography>
                )}
            </Box>
            {endAction && (
                <Box sx={{
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    color: 'inherit',
                }}>
                    {endAction}
                </Box>
            )}
        </Box>
    );
});
