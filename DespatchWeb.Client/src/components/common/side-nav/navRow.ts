import type React from 'react';
import {sideMenuColors as shell} from '../../../theme/dfrntMantineTheme';

export const getInitials = (name: string): string =>
    name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join('');

/**
 * Rows read the shell tokens, never the theme primary, so a tenant's Branding primary
 * can't leak into the menu. Active = inset accent bar + 600 weight, no fill; the hover
 * tint lives in each menu's CSS module because Mantine only applies `--nl-hover` to the active row.
 */
export const rowStyle = (active: boolean): React.CSSProperties => ({
    color: active ? shell.textPrimary : shell.textSecondary,
    fontWeight: active ? 600 : 500,
    boxShadow: active ? `inset 3px 0 0 ${shell.activeAccent}` : undefined,
    '--nl-bg': shell.hoverBg,
    '--nl-hover': shell.hoverBg,
    '--nl-color': shell.textPrimary,
} as React.CSSProperties);
