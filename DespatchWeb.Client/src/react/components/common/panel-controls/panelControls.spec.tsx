/**
 * The controls that sit on a panel card bar (`PanelHeader`, a plain `'surface'`
 * paper bar). Hardcoded white would be invisible there, so every colour resolves
 * from the theme, and the bar's own on-colour is inherited rather than pinned.
 */

import React from 'react';
import {alpha, rem} from '@mantine/core';
import {screen} from '@testing-library/react';
import {ChevronDown} from 'lucide-react';

import {renderWithMantine} from '../../../__testUtils__';
import {setupUser} from '../../../__testUtils__/setupUser';
import {headerColors, headerSurfaceAccent} from '../../dialogs/shared/mantine/styles';
import {Icon} from '../icon/Icon';
import {
    HeaderActionIcon,
    HeaderMenuButton,
    PANEL_CONTROL_GLYPH_SIZE,
    PANEL_CONTROL_HEIGHT,
    PANEL_CONTROL_HOVER,
    PANEL_CONTROL_SELECTED,
    panelIconButtonClassName,
    panelTextButtonStyle,
} from './index';
import {growOnHoverClassName} from '../growOnHoverIcon';

describe('panel control tokens', () => {
    it('lines every control up with the 32px band PanelHeader already uses', () => {
        // PanelHeader is a 48px bar = a 32px control band + 2×8px padding, and its
        // own glyph is 20px. Matching both keeps the bar on one grid.
        expect(PANEL_CONTROL_HEIGHT).toBe(32);
        expect(PANEL_CONTROL_GLYPH_SIZE).toBe(18);
    });

    /**
     * Neutral, not brand-tinted: the bar carries no brand colour since its glyph
     * went to the body ink, and washing with the bar's own on-colour is what keeps
     * hover legible in dark mode — a fixed accent wash would not follow the scheme.
     */
    it('washes every control with a translucent step of the bar\'s own on-colour', () => {
        expect(PANEL_CONTROL_HOVER).toBe(alpha(headerColors.surface.fg, 0.08));
        expect(PANEL_CONTROL_SELECTED).toBe(alpha(headerColors.surface.fg, 0.12));

        // `alpha()` emits a `color-mix` for a CSS variable, so the wash stays a
        // live reference to the scheme-aware text colour rather than a baked hex.
        expect(PANEL_CONTROL_HOVER).toContain('var(--mantine-color-text)');
        expect(PANEL_CONTROL_HOVER).not.toContain(headerSurfaceAccent);
    });

    it('drives text-button hover through a Mantine CSS variable, never a styles-prop pseudo-selector', () => {
        // A `styles={{root: {'&:hover': …}}}` object would be dropped — Mantine's
        // `styles` values are applied as inline styles.
        expect(panelTextButtonStyle).toMatchObject({'--button-hover': PANEL_CONTROL_HOVER});
    });

    it('grows an icon button on hover via the shared class, same as the app bar', () => {
        expect(panelIconButtonClassName).toBe(growOnHoverClassName);
    });

    it('leaves the disabled colour to the stylesheet instead of pinning it inline', () => {
        // `color: 'inherit'` inline outranks Mantine's disabled colour, which is
        // why the disabled truck button used to look enabled.
        expect(panelTextButtonStyle).not.toHaveProperty('color');
    });
});

describe('HeaderActionIcon', () => {
    it('names itself, sits on the band, and reports clicks', async () => {
        const onClick = jest.fn();
        renderWithMantine(
            <HeaderActionIcon label="Truck loading status" onClick={onClick}>
                <Icon lucide={ChevronDown} size={PANEL_CONTROL_GLYPH_SIZE}/>
            </HeaderActionIcon>,
        );
        const user = setupUser();

        const button = screen.getByRole('button', {name: 'Truck loading status'});
        expect(button.style.getPropertyValue('--ai-size')).toBe(rem(PANEL_CONTROL_HEIGHT));

        await user.click(button);
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('passes a menu target its injected handler and aria state through', async () => {
        // `Menu.Target` clones this element to inject `onClick` and
        // `aria-haspopup`; a wrapper that only accepted its own named props
        // would silently swallow them and leave the kebab button inert.
        const injected = jest.fn();
        renderWithMantine(
            <HeaderActionIcon label="Job actions" aria-haspopup="menu" onClick={injected}>
                <Icon lucide={ChevronDown} size={PANEL_CONTROL_GLYPH_SIZE}/>
            </HeaderActionIcon>,
        );
        const user = setupUser();

        const button = screen.getByRole('button', {name: 'Job actions'});
        expect(button).toHaveAttribute('aria-haspopup', 'menu');

        await user.click(button);
        expect(injected).toHaveBeenCalledTimes(1);
    });

    it('does not fire when disabled', async () => {
        const onClick = jest.fn();
        renderWithMantine(
            <HeaderActionIcon label="Truck loading status" disabled onClick={onClick}>
                <Icon lucide={ChevronDown} size={PANEL_CONTROL_GLYPH_SIZE}/>
            </HeaderActionIcon>,
        );
        const user = setupUser();

        const button = screen.getByRole('button', {name: 'Truck loading status'});
        expect(button).toBeDisabled();

        await user.click(button);
        expect(onClick).not.toHaveBeenCalled();
    });
});

describe('HeaderMenuButton', () => {
    it('keeps the current value in the label and reports the open request', async () => {
        const onClick = jest.fn();
        renderWithMantine(
            <HeaderMenuButton icon={<Icon lucide={ChevronDown} size={PANEL_CONTROL_GLYPH_SIZE}/>} onClick={onClick}>
                Trucks: On
            </HeaderMenuButton>,
        );
        const user = setupUser();

        const button = screen.getByRole('button', {name: /Trucks: On/});
        expect(button).toHaveAttribute('aria-haspopup', 'true');
        expect(button).not.toHaveAttribute('aria-expanded', 'true');

        await user.click(button);
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('marks itself expanded while its menu is open', () => {
        renderWithMantine(
            <HeaderMenuButton opened>Filters (2)</HeaderMenuButton>,
        );

        expect(screen.getByRole('button', {name: /Filters \(2\)/})).toHaveAttribute('aria-expanded', 'true');
    });
});
