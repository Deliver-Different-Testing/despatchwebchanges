/**
 * Shared chrome for the app bar's icon buttons.
 *
 * A leaf module on purpose: `ToolbarActions` re-exports `DateFilterMenu`, so the MUI
 * holdout in that file cannot import these tokens from `ToolbarActions` without a cycle.
 */

import React from 'react';

/**
 * The wash a shell icon button shows on hover.
 *
 * Both this and the glyph colour come from the theme via CSS variables published by
 * `dfrntCssVariablesResolver`, so the two shell fills (Ink navy on US, gold
 * elsewhere) each get a wash that reads on them without the ~11 call sites having
 * to thread the theme. See `getShellIconHoverFill` for why the wash is pinned
 * rather than left to `variant="subtle"`.
 */
export const SHELL_ICON_HOVER_FILL = 'var(--dd-shell-icon-hover)';

/** Mantine's `ActionIcon size="lg"` box — the size every shell icon button matches. */
export const SHELL_ICON_BUTTON_PX = 34;

/**
 * Applied to every toolbar icon button: `variant="subtle" size="lg"`, round via the
 * theme's `ActionIcon` radius, and the shell's on-colour for the glyph. The variant
 * supplies the transparent rest state; this overrides the glyph colour and the hover
 * wash.
 */
export const toolbarIconButtonStyle = {
    color: 'var(--dd-on-shell)',
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
