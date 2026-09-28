/**
 * Shared styles for the job detail component tree.
 *
 * Mirrors the AngularJS job-details LESS spacing and card patterns, expressed as
 * plain style objects over `var(--mantine-*)` tokens — the idiom the converted
 * dialogs use (`dialogs/shared/mantine/styles.ts`). Sizes stay in raw px where
 * the AngularJS 4px grid does not land on a Mantine spacing step.
 *
 * Spacing reference (AngularJS 4px grid → the MUI 8px scale these were ported
 * from): 4px → 0.5, 8px → 1, 12px → 1.5, 16px → 2, 24px → 3.
 */

import type React from 'react';

/**
 * Props for the bordered card that wraps a job-detail section. The 16px corner
 * matches the MUI `borderRadius: 2` these cards used (the `sx` multiplier base
 * was pinned to 8), and `Paper`'s theme default already supplies the
 * `--dd-surface-container` fill, so this only has to add the keyline and clip
 * the header.
 */
export const cardContainerProps = {
    withBorder: true,
    radius: 'lg',
    style: {overflow: 'hidden'},
} as const;

/** The keyline that separates stacked sections inside one card. */
export const sectionBorderStyle: React.CSSProperties = {
    borderTop: '1px solid var(--mantine-color-default-border)',
};

export const metricLabelStyle = (dense: boolean): React.CSSProperties => ({
    fontSize: dense ? '0.625rem' : '0.6875rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: dense ? 2 : 6,
});

export const metricValueStyle = (dense: boolean): React.CSSProperties => ({
    fontSize: dense ? '0.8125rem' : '0.875rem',
    fontWeight: 700,
    lineHeight: 1.2,
    fontVariantNumeric: 'tabular-nums',
});

export const cardContentStyle = (dense: boolean): React.CSSProperties => ({
    paddingInline: dense ? 12 : 16,
    paddingBlock: dense ? 8 : 12,
});

/** Notes strip under a card body (AgentInformation, FlightInformation). */
export const cardNotesContainerStyle: React.CSSProperties = {
    paddingInline: 16,
    paddingBlock: 8,
    borderTop: '1px solid var(--mantine-color-default-border)',
};

/**
 * The two-line field row — label above value, the `md-list-item md-2-line`
 * pattern the AngularJS detail template used.
 */
export const fieldLabelStyle = (dense: boolean): React.CSSProperties => ({
    fontSize: dense ? '0.625rem' : '0.6875rem',
    fontWeight: 500,
    marginBottom: dense ? 0 : 2,
});

/**
 * The value line. Truncation is **not** here: the row renders it as
 * `<Text truncate>`, which is Mantine's own single-line ellipsis.
 */
export const fieldValueStyle = (dense: boolean): React.CSSProperties => ({
    fontSize: dense ? '0.8125rem' : '0.875rem',
    lineHeight: 1.4,
});

/** The 36px icon gutter in front of a field row. */
export const fieldIconGutterStyle: React.CSSProperties = {
    minWidth: 36,
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
};
