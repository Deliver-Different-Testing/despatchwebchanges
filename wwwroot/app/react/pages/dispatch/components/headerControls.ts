/**
 * Shared chrome for the controls that sit on the dispatch panels' header bars
 * (Current Work scope, Tasks scope + "Filters", Driver Locations "Trucks").
 *
 * Those bars are the neutral `'surface'` header, not a brand fill, so every
 * control inherits the bar's own text colour and washes with a translucent step
 * of it rather than assuming a coloured background. Kept in one place so the
 * panels stay visually identical.
 *
 * Expressed as plain `style` objects over Mantine's per-component CSS variables
 * (`--ai-hover`, `--button-hover`), the same idiom as
 * `app-toolbar/toolbarIconStyles.ts`. A `styles={{root: {'&:hover': …}}}` object
 * would NOT work: Mantine's `styles` values land as inline styles, which silently
 * drop pseudo-selectors.
 */

import React from 'react';
import {headerOverlayColor} from '../../../components/dialogs/shared/mantine/styles';

/** Rest-state wash for a control on the header bar. */
export const HEADER_CONTROL_HOVER = headerOverlayColor(0.08, 'surface');
/** Fill for the selected segment of a header scope toggle. */
export const HEADER_CONTROL_SELECTED = headerOverlayColor(0.12, 'surface');

/** Low-emphasis text button that opens a menu from a panel header. */
export const headerTextButtonStyle = {
    color: 'inherit',
    '--button-hover': HEADER_CONTROL_HOVER,
} as React.CSSProperties;

/** Icon-button counterpart of {@link headerTextButtonStyle}. */
export const headerIconButtonStyle = {
    color: 'inherit',
    '--ai-hover': HEADER_CONTROL_HOVER,
} as React.CSSProperties;

/**
 * `styles` for a `SegmentedControl` on a panel header: transparent track, the
 * bar's on-colour for labels, and the selected segment marked by the overlay
 * fill rather than a white indicator (which would disappear on the bar).
 */
export const headerScopeToggleStyles = {
    root: {
        backgroundColor: 'transparent',
        border: '1px solid var(--mantine-color-default-border)',
        marginRight: 'var(--mantine-spacing-xs)',
    },
    indicator: {backgroundColor: HEADER_CONTROL_SELECTED, boxShadow: 'none'},
    label: {color: 'inherit', fontSize: 'var(--mantine-font-size-xs)'},
} as const;
