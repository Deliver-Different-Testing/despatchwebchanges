/**
 * Design Tokens
 *
 * Semantic color constants for use outside MUI's sx prop / theme context.
 * For MUI sx props, prefer theme path strings (e.g. bgcolor: 'background.default').
 *
 * These re-export values from muiTheme.ts to keep a single source of truth.
 */

import {accentPalette, sharedColors} from './muiTheme';

/** Toolbar / dark-accent color (#57534e) */
export const toolbarColor = accentPalette[600];

/** Surface / dialog body background (#FAFAFA) */
export const surfaceDefault = sharedColors.surface.default;

/** AI feature accent color (deep purple) */
export const aiAccentColor = '#7c4dff';

/** Status palette for feature-specific status indicators */
export const statusColors = {
    success: {main: sharedColors.success.main, light: sharedColors.success.lighter},
    warning: {main: sharedColors.warning.main, light: sharedColors.warning.lighter},
    error: {main: sharedColors.error.main, light: sharedColors.error.lighter},
    info: {main: sharedColors.info.main, light: sharedColors.info.lighter},
} as const;

/**
 * Driver Locations board colors
 *
 * Domain-specific color scheme for the three-section driver location board.
 * These are design data differentiating board sections (top/middle/bottom),
 * not general UI chrome, so they live outside the MUI theme.
 */
export const driverLocationColors = {
    title: {
        bg: accentPalette[600],
        bgHover: accentPalette[500],
        activeBg: '#ffeb3b',
        activeBgHover: '#fdd835',
    },
    top: {
        bg: '#bae1ff',
        bgHover: '#a8d4f5',
        bgActive: '#96c7eb',
        numberBg: '#94c5ea',
        numberBgActive: '#82b8e0',
        border: '#a4d2f5',
    },
    middle: {
        bg: '#d4c7ff',
        bgHover: '#c6b6fd',
        numberBg: '#bdaeef',
        numberBgActive: '#ab9ce5',
        border: '#c6b6fd',
    },
    bottom: {
        bg: '#ffdfba',
        bgHover: '#f5d0a5',
        numberBg: '#ffc888',
        numberBgActive: '#f5b870',
        border: '#efcea9',
    },
    area: accentPalette[300],
    destination: {
        bg: sharedColors.surface.default,
        border: sharedColors.divider,
    },
} as const;
