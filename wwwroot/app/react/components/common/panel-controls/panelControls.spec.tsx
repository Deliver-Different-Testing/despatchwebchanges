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
import {headerSurfaceAccent} from '../../dialogs/shared/mantine/styles';
import {Icon} from '../icon/Icon';
import {
    HeaderActionIcon,
    HeaderMenuButton,
    PANEL_CONTROL_GLYPH_SIZE,
    PANEL_CONTROL_HEIGHT,
    PANEL_CONTROL_HOVER,
    PANEL_CONTROL_SELECTED,
    panelIconButtonStyle,
    panelTextButtonStyle,
} from './index';

describe('panel control tokens', () => {
    it('lines every control up with the 32px icon badge PanelHeader already uses', () => {
        // PanelHeader is a 48px bar = 32px badge + 2×8px padding, and the badge
        // glyph is sized `32 × 0.55`. Matching both keeps the bar on one grid.
        expect(PANEL_CONTROL_HEIGHT).toBe(32);
        expect(PANEL_CONTROL_GLYPH_SIZE).toBe(18);
    });

    it('washes every control with a translucent step of the header accent', () => {
        expect(PANEL_CONTROL_HOVER).toBe(alpha(headerSurfaceAccent, 0.08));
        expect(PANEL_CONTROL_SELECTED).toBe(alpha(headerSurfaceAccent, 0.12));
    });

    it('drives hover through Mantine CSS variables, never a styles-prop pseudo-selector', () => {
        // A `styles={{root: {'&:hover': …}}}` object would be dropped — Mantine's
        // `styles` values are applied as inline styles.
        expect(panelTextButtonStyle).toMatchObject({'--button-hover': PANEL_CONTROL_HOVER});
        expect(panelIconButtonStyle).toMatchObject({'--ai-hover': PANEL_CONTROL_HOVER});
    });

    it('leaves the disabled colour to the stylesheet instead of pinning it inline', () => {
        // `color: 'inherit'` inline outranks Mantine's disabled colour, which is
        // why the disabled truck button used to look enabled.
        expect(panelIconButtonStyle).not.toHaveProperty('color');
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
