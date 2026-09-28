/**
 * Metrics and accent resolution for {@link ActionButton}.
 *
 * Plain values rather than CSS-module rules because CSS modules are mocked to
 * `{}` in Jest: the numbers stay unit-testable here while the pseudo-state and
 * `[data-*]` selectors that consume them live in `ActionButton.module.css`.
 */

import {segmentedToggleAccent} from '../segmented-toggle';

/**
 * Control height. The same 32px band `PanelHeader` and `SegmentedToggle` sit on,
 * so a chip in a card bar lines up with the toggles and icon buttons beside it
 * instead of picking its own height.
 */
export const ACTION_BUTTON_HEIGHT = 32;

/**
 * The band for a button inside a table row. 22px is what Mantine's `compact-xs`
 * measured, so a row keeps its height — `ultra-dense` rows have zero cell
 * padding and a taller button would set the row height on its own.
 */
export const ACTION_BUTTON_COMPACT_HEIGHT = 22;

/**
 * `chip` is the raised surface every secondary action takes; `filled` is the
 * solid brand lozenge reserved for the one primary action on a bar.
 */
export type ActionButtonVariant = 'chip' | 'filled';

/** `default` is the 32px control band; `compact` is the in-row band. */
export type ActionButtonSize = 'default' | 'compact';

export function actionButtonHeight(size: ActionButtonSize): number {
    return size === 'compact' ? ACTION_BUTTON_COMPACT_HEIGHT : ACTION_BUTTON_HEIGHT;
}

/** Glyph size for a `leftSection`/`rightSection` icon inside the chip. */
export const ACTION_BUTTON_GLYPH_SIZE = 16;

/** Glyph size on the compact band, where a 16px icon crowds the label. */
export const ACTION_BUTTON_COMPACT_GLYPH_SIZE = 14;

/**
 * The selected chip's border and fill colour — the same ladder `SegmentedToggle`
 * uses, so a selection means one colour across single- and multi-select controls.
 * `'brand'` resolves to the tenant's WCAG 1.4.11-safe accent (cyan-7 / gold-9);
 * any other Mantine colour key takes its shade-7 step.
 */
export const actionButtonAccent = segmentedToggleAccent;
