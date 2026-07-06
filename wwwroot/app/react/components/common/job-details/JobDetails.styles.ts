/**
 * Shared styles for the job detail component tree.
 *
 * Mirrors the AngularJS job-details LESS spacing and card patterns
 * using MUI theme tokens and sx-prop conventions.
 *
 * Spacing reference (AngularJS 4px grid → MUI 8px scale):
 *   4px → 0.5    8px → 1    12px → 1.5    16px → 2    24px → 3
 */

import type {SxProps, Theme} from '@mui/material/styles';

/* ── Card container (Option B — bordered card + gradient header) ──── */

export const cardContainerSx: SxProps<Theme> = {
    bgcolor: 'background.paper',
    borderRadius: 2,
    overflow: 'hidden',
    border: 1,
    borderColor: 'divider',
};

/* ── Section toolbar (legacy 40px grey bar — superseded by SectionHeader)
 *  Still exported for any non-job-details callers; new code should use
 *  the SectionHeader component instead. */

export const sectionToolbarSx: SxProps<Theme> = {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    px: 2,
    height: 40,
    minHeight: 40,
    bgcolor: 'grey.100',
    borderBottom: 1,
    borderColor: 'divider',
};

export const sectionToolbarTitleSx: SxProps<Theme> = {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: 'text.primary',
    letterSpacing: '0.01em',
};

export const sectionToolbarIconSx: SxProps<Theme> = {
    fontSize: 18,
    color: 'action.active',
};

/* ── Section border separator ─────────────────────────────────────── */

export const sectionBorderSx: SxProps<Theme> = {
    borderTop: 1,
    borderColor: 'divider',
};

/* ── ListItemText slotProps (two-line md-list-item pattern) ──────── */
/* h3: 12px 500 muted  /  p: 13px normal primary                     */
/* Uses slotProps.primary / slotProps.secondary (MUI v7)              */

export const listItemTextSlotProps = {
    primary: {
        variant: 'caption' as const,
        color: 'text.secondary',
        fontSize: '0.6875rem',
        fontWeight: 500,
        sx: {mb: 0.25},
    },
    secondary: {
        variant: 'body2' as const,
        color: 'text.primary',
        fontSize: '0.875rem',
        lineHeight: 1.4,
        noWrap: true,
    },
};

/* ── List-item icon (32 × 32 circle avatar) ───────────────────────── */

export const listItemIconSx: SxProps<Theme> = {
    minWidth: 36,
};

export const listItemIconInnerSx: SxProps<Theme> = {
    fontSize: 18,
    color: 'text.secondary',
};

/* ── Metric label / value ─────────────────────────────────────────── */

export const metricLabelSx: SxProps<Theme> = {
    fontSize: '0.6875rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    mb: 0.75,
};

export const metricValueSx: SxProps<Theme> = {
    fontSize: '0.875rem',
    fontWeight: 700,
    lineHeight: 1.2,
    color: 'text.primary',
    fontVariantNumeric: 'tabular-nums',
};

/* ── Card content padding ────────────────────────────────────────── */

export const cardContentSx: SxProps<Theme> = {
    px: 2,
    py: 1.5,
};

export const cardContentDenseSx: SxProps<Theme> = {
    px: 1.5,
    py: 1,
};

/* ── Notes container (shared by AgentInformation, FlightInformation) */

export const cardNotesContainerSx: SxProps<Theme> = {
    px: 2,
    py: 1,
    borderTop: 1,
    borderColor: 'divider',
};

/* ── Dense-aware helpers ─────────────────────────────────────────── */

export const getSectionToolbarSx = (dense: boolean): SxProps<Theme> => ({
    ...sectionToolbarSx as object,
    height: dense ? 32 : 40,
    minHeight: dense ? 32 : 40,
    px: dense ? 1.5 : 2,
});

export const getMetricLabelSx = (dense: boolean): SxProps<Theme> => ({
    ...metricLabelSx as object,
    mb: dense ? 0.25 : 0.75,
    fontSize: dense ? '0.625rem' : '0.6875rem',
});

export const getMetricValueSx = (dense: boolean): SxProps<Theme> => ({
    ...metricValueSx as object,
    fontSize: dense ? '0.8125rem' : '0.875rem',
});

export const getListItemTextSlotProps = (dense: boolean) => ({
    primary: {
        ...listItemTextSlotProps.primary,
        fontSize: dense ? '0.625rem' : '0.6875rem',
        sx: {mb: dense ? 0 : 0.25},
    },
    secondary: {
        ...listItemTextSlotProps.secondary,
        fontSize: dense ? '0.8125rem' : '0.875rem',
    },
});
