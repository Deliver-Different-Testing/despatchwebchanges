/**
 * Metrics and accent resolution for {@link SegmentedToggle}.
 *
 * Kept as plain values rather than CSS-module rules because CSS modules are
 * mocked to `{}` in Jest: the numbers stay unit-testable here while the
 * pseudo-state and `[data-*]` selectors that consume them live in
 * `SegmentedToggle.module.css`.
 */

import {headerSurfaceAccent} from '../../dialogs/shared/mantine/styles';

/**
 * Control height on a panel card bar. `PanelHeader` is 48px built as a 32px icon
 * badge plus 2×8px padding, so 32 is the bar's existing grid line — every control
 * on it lines up with the badge instead of picking its own height.
 */
export const SEGMENTED_TOGGLE_HEADER_HEIGHT = 32;

/** Control height in normal page/dialog flow, where form density rules instead. */
export const SEGMENTED_TOGGLE_INLINE_HEIGHT = 36;

/**
 * Glyph size inside the band. Matches `headerChipSx`'s `size × 0.55` rule for the
 * 32px header badge (17.6), so control glyphs and the badge glyph read as one set.
 */
export const SEGMENTED_TOGGLE_GLYPH_SIZE = 18;

/** Opacity of the indicator's tonal fill. The 1px accent border carries the contrast. */
export const SEGMENTED_TOGGLE_FILL_OPACITY = 12;

export type SegmentedToggleVariant = 'header' | 'inline';

export function segmentedToggleHeight(variant: SegmentedToggleVariant): number {
    return variant === 'header' ? SEGMENTED_TOGGLE_HEADER_HEIGHT : SEGMENTED_TOGGLE_INLINE_HEIGHT;
}

/**
 * The indicator's border/accent colour.
 *
 * `'brand'` resolves to {@link headerSurfaceAccent} — cyan-7 `#1590c0` on US
 * tenants, gold-9 on the rest. Those are the steps dark enough to clear WCAG
 * 1.4.11's 3:1 against a white card bar (3.67:1 and 4.11:1); the brand-5 primaries
 * are only ~2:1 and would leave the selected state resting on an invisible fill.
 * Any other Mantine colour key takes the same shade-7 step for the same reason.
 */
export function segmentedToggleAccent(color: string): string {
    return color === 'brand' ? headerSurfaceAccent : `var(--mantine-color-${color}-7)`;
}
