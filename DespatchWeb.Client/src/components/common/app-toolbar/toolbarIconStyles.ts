/**
 * Shared chrome for the app bar's icon buttons.
 *
 * A leaf module on purpose: `ToolbarActions` re-exports `DateFilterMenu`, so that file
 * cannot import these tokens from `ToolbarActions` without a cycle.
 */

import React from 'react';
import {growOnHoverClassName} from '../growOnHoverIcon';

/**
 * Applied to every toolbar icon button: `variant="subtle" size="lg"`, round via the
 * theme's `ActionIcon` radius, and the shell's on-colour for the glyph.
 */
export const toolbarIconButtonStyle = {
    color: 'var(--dd-on-shell)',
} as React.CSSProperties;

/**
 * Pair with `style={toolbarIconButtonStyle}` on every toolbar `ActionIcon` — grows
 * the button on hover/focus instead of a background wash, so it reads the same
 * on both tenants' bar fills. See `growOnHoverIcon.module.css`.
 */
export const toolbarIconButtonClassName = growOnHoverClassName;

/**
 * Opts a button out of `ActionIcon`'s `overflow: hidden` root.
 *
 * An `Indicator` badge is positioned to sit proud of its host's top-right corner, so the
 * button's own clip cuts it — invisibly while the buttons were square, but visibly once
 * the round border came back. Spread this onto any icon button that carries a count.
 */
export const badgeOverflowStyle = {overflow: 'visible'} as React.CSSProperties;
