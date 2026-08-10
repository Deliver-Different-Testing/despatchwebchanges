/**
 * SectionHeader - the header used by every job-detail section card.
 *
 * A bar carrying an icon, title, optional subtitle, and an optional end-action
 * slot for buttons / chips.
 *
 * Variants:
 *   - 'primary'   →  plain paper bar with a divider keyline (the default)
 *   - 'pickup'    →  map-blue fill (the `info` palette)
 *   - 'delivery'  →  green fill (the `success` palette)
 *
 * Only pickup and delivery are filled: they carry the universal pickup-blue /
 * delivery-green convention used on every map, so the colour is meaning rather
 * than decoration. Every other section is neutral, matching `PanelHeader` — the
 * page/card-level equivalent.
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type {Theme} from '@mui/material/styles';
import type {SvgIconProps} from '@mui/material/SvgIcon';
import {
    headerAccentColor,
    headerSurfaceSx,
    type PanelHeaderVariant,
} from '../../../dialogs/shared/styles';

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
 * Section headers are keyed to the section type: pickup is a map-blue fill (via
 * the `info` palette), delivery is `success` (green), and everything else is the
 * neutral `'surface'` bar. Text inherits the surface's on-colour — white on the
 * two coloured fills, body text on the paper bar.
 */
const surfaceVariantFor = (variant: SectionHeaderVariant): PanelHeaderVariant =>
    variant === 'pickup' ? 'info' : variant === 'delivery' ? 'success' : 'surface';

export const SectionHeader = React.memo(function SectionHeader({
    icon: Icon,
    title,
    subtitle,
    endAction,
    dense,
    variant = 'primary',
}: SectionHeaderProps) {
    const surfaceVariant = surfaceVariantFor(variant);
    return (
        <Box
            data-testid="section-header"
            sx={(theme: Theme) => ({
                display: 'flex',
                alignItems: 'center',
                gap: dense ? 1 : 1.25,
                px: dense ? 1.5 : 2,
                py: dense ? 0.75 : 1,
                minHeight: dense ? 40 : 48,
                // Bar keyed to the section type; text inherits its on-colour.
                ...headerSurfaceSx(theme, surfaceVariant),
            })}
        >
            <Icon sx={(theme: Theme) => ({
                fontSize: dense ? 18 : 20,
                // The glyph is the only brand colour on the neutral bar; on the
                // pickup/delivery fills it matches the text.
                color: headerAccentColor(theme, surfaceVariant),
                flexShrink: 0,
            })} />
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
