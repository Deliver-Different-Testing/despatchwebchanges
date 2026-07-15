/**
 * JobListViewOptions Tests
 */

import React from 'react';
import {screen} from '@testing-library/react';
import {renderWithTheme} from '../../__testUtils__';
import {JobListViewOptions} from './JobListViewOptions';
import type {DensityMode} from '../../interfaces/dispatchJob';

function createDefaultProps(overrides?: Partial<React.ComponentProps<typeof JobListViewOptions>>) {
    return {
        densityMode: 'dense' as DensityMode,
        onDensityModeChange: jest.fn(),
        onResetColumns: jest.fn(),
        loggedInCouriersOnly: false,
        onLoggedInCouriersOnlyChange: jest.fn(),
        showLoggedInSwitch: true,
        ...overrides,
    };
}

/**
 * Collect the emotion CSS rules for the rendered switch's track. jsdom's
 * getComputedStyle can't resolve MUI's nested-slot cascade, so we assert on the
 * generated stylesheet text instead of the computed colour.
 */
function switchTrackRules(): string {
    const root = document.querySelector('.MuiSwitch-root') as Element;
    const hash = Array.from(root.classList).find((c) => c.startsWith('css-'))!.split('-')[1];
    let text = '';
    for (const styleEl of Array.from(document.querySelectorAll('style'))) {
        const sheet = (styleEl as HTMLStyleElement).sheet;
        if (!sheet) continue;
        for (const rule of Array.from(sheet.cssRules)) {
            if (rule.cssText.includes(hash) && rule.cssText.includes('MuiSwitch-track')) {
                text += rule.cssText;
            }
        }
    }
    return text;
}

describe('JobListViewOptions', () => {
    it('renders the logged-in only switch', () => {
        renderWithTheme(<JobListViewOptions {...createDefaultProps()}/>);
        expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    it('forces a white switch track in the header variant so it stands out from the header', () => {
        renderWithTheme(<JobListViewOptions {...createDefaultProps({headerVariant: true})}/>);
        expect(switchTrackRules()).toMatch(/background-color:\s*#fff/i);
    });

    it('leaves the switch track at the theme default in the toolbar variant', () => {
        renderWithTheme(<JobListViewOptions {...createDefaultProps({headerVariant: false})}/>);
        // No white override on the track — the default (dark) track applies.
        expect(switchTrackRules()).not.toMatch(/background-color:\s*#fff/i);
    });
});
