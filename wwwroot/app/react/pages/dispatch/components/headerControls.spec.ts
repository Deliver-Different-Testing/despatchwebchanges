/**
 * These helpers style controls that are portaled into a dispatch panel's
 * `PanelHeader` — a plain `'surface'` paper bar. Hardcoded white would be
 * invisible there, so every colour must resolve from the theme, and the text
 * colour must be inherited from the bar rather than pinned.
 */

import {alpha} from '@mantine/core';
import {headerSurfaceAccent} from '../../../components/dialogs/shared/mantine/styles';
import {
    HEADER_CONTROL_HOVER,
    HEADER_CONTROL_SELECTED,
    headerIconButtonStyle,
    headerScopeToggleStyles,
    headerTextButtonStyle,
} from './headerControls';

describe('dispatch header control styles', () => {
    it('washes every control with a translucent step of the header accent', () => {
        expect(HEADER_CONTROL_HOVER).toBe(alpha(headerSurfaceAccent, 0.08));
        expect(HEADER_CONTROL_SELECTED).toBe(alpha(headerSurfaceAccent, 0.12));
    });

    it('drives the hover through Mantine CSS variables and inherits the bar colour', () => {
        // A `styles={{root: {'&:hover': …}}}` object would be dropped — Mantine's
        // `styles` values are applied as inline styles.
        expect(headerTextButtonStyle).toMatchObject({color: 'inherit', '--button-hover': HEADER_CONTROL_HOVER});
        expect(headerIconButtonStyle).toMatchObject({color: 'inherit', '--ai-hover': HEADER_CONTROL_HOVER});
    });

    it('marks the selected scope segment with the overlay fill, not a white indicator', () => {
        expect(headerScopeToggleStyles.root.backgroundColor).toBe('transparent');
        expect(headerScopeToggleStyles.indicator.backgroundColor).toBe(HEADER_CONTROL_SELECTED);
        expect(headerScopeToggleStyles.label.color).toBe('inherit');
    });
});
