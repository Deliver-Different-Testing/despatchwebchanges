/**
 * PanelHeader — the gradient hero header used at the top of every card panel
 * on a workspace page (Filters, Recurring Jobs, Job Details, Recurring Log…).
 *
 * A coloured 135° gradient bar with a white icon badge, title, an optional
 * trailing count, an optional uppercase badge chip, and an optional
 * right-aligned action slot (e.g. a refresh button). The gradient itself
 * separates the header from card content, so there is no trailing Divider.
 *
 * Text colour defers to `theme.palette.primary.contrastText` (not a hard-coded
 * white) so the US amber theme picks up dark text and the NZ blue theme picks
 * up white — keeping the header legible on either palette. This mirrors the
 * approach in `SectionHeader.tsx`, which is the in-card-section equivalent;
 * PanelHeader is the page/card-level header and additionally carries an icon
 * badge, count, and badge chip.
 */

import React from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import type {SxProps, Theme} from '@mui/material/styles';

interface PanelHeaderProps {
    /**
     * The leading glyph, rendered inside the badge. Pass a rendered element —
     * an MUI icon (`<TuneIcon />`) or a Material Symbols span
     * (`<span className="material-symbols-outlined">tune</span>`). The badge
     * forces it to 20px and inherits the header's contrast colour, so callers
     * don't size or colour it themselves.
     */
    icon: React.ReactNode;
    title: string;
    /** Optional trailing count, rendered as `(n)` after the title. */
    count?: number;
    /** Optional uppercase chip rendered after the title (e.g. "RECURRING"). */
    badge?: string;
    /** Right-aligned slot for buttons / status indicators. */
    action?: React.ReactNode;
}

const rootSx = ((theme: Theme) => ({
    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
    color: theme.palette.primary.contrastText,
    px: 2,
    py: 1.25,
    minHeight: 48,
    display: 'flex',
    alignItems: 'center',
    gap: 1.5,
    flexShrink: 0,
})) satisfies SxProps<Theme>;

const iconBadgeSx = {
    width: 36,
    height: 36,
    borderRadius: 1.5,
    bgcolor: 'rgba(255,255,255,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: 'inherit',
    // Force a consistent 20px glyph whether the caller passes an MUI SvgIcon
    // (sizes itself via font-size) or a Material Symbols span.
    '& svg': {fontSize: 20},
    '& .material-symbols-outlined': {fontSize: 20},
} satisfies SxProps<Theme>;

const titleRowSx = {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 1,
} satisfies SxProps<Theme>;

const badgeChipSx = {
    color: 'inherit',
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: '0.6px',
    bgcolor: 'rgba(255,255,255,0.18)',
    border: 'none',
    height: 20,
} satisfies SxProps<Theme>;

const actionSlotSx = {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 0.5,
    color: 'inherit',
} satisfies SxProps<Theme>;

export const PanelHeader = React.memo(function PanelHeader({
    icon,
    title,
    count,
    badge,
    action,
}: PanelHeaderProps) {
    return (
        <Box sx={rootSx}>
            <Box sx={iconBadgeSx}>{icon}</Box>
            <Box sx={titleRowSx}>
                <Typography variant="subtitle1" noWrap sx={{fontWeight: 600, color: 'inherit'}}>
                    {count != null ? `${title} (${count})` : title}
                </Typography>
                {badge && <Chip label={badge} size="small" sx={badgeChipSx} />}
            </Box>
            {action && <Box sx={actionSlotSx}>{action}</Box>}
        </Box>
    );
});

export default PanelHeader;
