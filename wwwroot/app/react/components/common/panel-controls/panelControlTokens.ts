/**
 * Shared chrome for the controls that sit on a panel card bar — the Current Work
 * scope, the Tasks "Filters" button, Driver Locations' "Trucks", the job-list
 * view options, the Job Detail kebab.
 *
 * Those bars are `PanelHeader`'s neutral `'surface'` variant, not a brand fill,
 * so a control inherits the bar's own text colour and washes with a translucent
 * step of the header accent rather than assuming a coloured background.
 *
 * Hover and disabled are **pseudo/attribute state**, so they cannot go through
 * Mantine's `styles` prop — those values land as inline styles and silently drop
 * the selector. Hover therefore rides Mantine's per-component CSS variables
 * (`--ai-hover`, `--button-hover`), and everything else lives in the unlayered
 * `PanelControls.module.css`. Pinning `color: 'inherit'` inline is specifically
 * avoided: it outranks Mantine's disabled colour, which is what used to make the
 * disabled truck button look enabled.
 */

import type React from 'react';
import {headerOverlayColor} from '../../dialogs/shared/mantine/styles';

/**
 * Control height on a card bar. `PanelHeader` is 48px built as a 32px control band
 * plus 2×8px padding, so 32 is the bar's existing grid line — controls line up with
 * each other instead of each picking their own height.
 */
export const PANEL_CONTROL_HEIGHT = 32;

/**
 * Glyph size inside the band. A step under the header's own 20px `UI_ICON_SIZE`
 * glyph, so a control reads as secondary to the title without looking mismatched.
 */
export const PANEL_CONTROL_GLYPH_SIZE = 18;

/** Rest-state wash for a control on the header bar. */
export const PANEL_CONTROL_HOVER = headerOverlayColor(0.08, 'surface');

/** Fill for a selected/active control on the header bar. */
export const PANEL_CONTROL_SELECTED = headerOverlayColor(0.12, 'surface');

/** Low-emphasis text button that opens a menu or popover from a panel header. */
export const panelTextButtonStyle = {
    '--button-hover': PANEL_CONTROL_HOVER,
} as React.CSSProperties;

/** Icon-button counterpart of {@link panelTextButtonStyle}. */
export const panelIconButtonStyle = {
    '--ai-hover': PANEL_CONTROL_HOVER,
} as React.CSSProperties;
