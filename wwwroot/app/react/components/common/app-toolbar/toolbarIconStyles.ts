/**
 * Shared chrome for the app bar's icon buttons.
 *
 * A leaf module on purpose: `ToolbarActions` re-exports `DateFilterMenu`, so the MUI
 * holdout in that file cannot import these tokens from `ToolbarActions` without a cycle.
 */

import React from 'react';
import {onBrandScrim} from '../../../theme/dfrntMantineTheme';

/**
 * The cyan wash a shell icon button shows on hover, at the strength Integration
 * Manager renders: `--mantine-color-brand-light-hover` in a light scheme, i.e.
 * brand-5 at 12%.
 *
 * IM lets `variant="subtle"` supply this. We pin it because that variable is resolved
 * against the *page's* colour scheme, and the Ink bar stays navy in both — so when
 * `DARK_MODE_ENABLED` flips, Mantine would swap in the brighter dark-scheme tint
 * (brand-2 at 20%) over a background that never changed. Pinning keeps one constant
 * wash on the bar.
 */
export const SHELL_ICON_HOVER_FILL = 'color-mix(in srgb, var(--mantine-color-brand-5) 12%, transparent)';

/** Mantine's `ActionIcon size="lg"` box — the size every shell icon button matches. */
export const SHELL_ICON_BUTTON_PX = 34;

/**
 * Applied to every toolbar icon button: `variant="subtle" size="lg"`, round via the
 * theme's `ActionIcon` radius, white glyph on the Ink bar. The variant supplies the
 * transparent rest state; this overrides the glyph colour and the hover wash.
 */
export const toolbarIconButtonStyle = {
    color: onBrandScrim.text,
    '--ai-hover': SHELL_ICON_HOVER_FILL,
} as React.CSSProperties;

/**
 * Opts a button out of `ActionIcon`'s `overflow: hidden` root.
 *
 * An `Indicator` badge is positioned to sit proud of its host's top-right corner, so the
 * button's own clip cuts it — invisibly while the buttons were square, but visibly once
 * the round border came back. Spread this onto any icon button that carries a count.
 */
export const badgeOverflowStyle = {overflow: 'visible'} as React.CSSProperties;
