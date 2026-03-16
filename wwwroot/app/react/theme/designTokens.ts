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

/** Status palette for feature-specific status indicators */
export const statusColors = {
    success: {main: sharedColors.success.main, light: sharedColors.success.lighter},
    warning: {main: sharedColors.warning.main, light: sharedColors.warning.lighter},
    error: {main: sharedColors.error.main, light: sharedColors.error.lighter},
    info: {main: sharedColors.info.main, light: sharedColors.info.lighter},
} as const;
