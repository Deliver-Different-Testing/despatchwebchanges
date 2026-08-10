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
 * Collect the emotion CSS rules generated for `selector` under the rendered
 * `root` element's own style hash. jsdom's getComputedStyle can't resolve MUI's
 * nested-slot cascade, so we assert on the generated stylesheet text instead of
 * the computed colour.
 */
function emotionRulesFor(root: string, selector: string): string {
    const el = document.querySelector(root) as Element;
    const hash = Array.from(el.classList).find((c) => c.startsWith('css-'))!.split('-')[1];
    let text = '';
    for (const styleEl of Array.from(document.querySelectorAll('style'))) {
        const sheet = (styleEl as HTMLStyleElement).sheet;
        if (!sheet) continue;
        for (const rule of Array.from(sheet.cssRules)) {
            if (rule.cssText.includes(hash) && rule.cssText.includes(selector)) {
                text += rule.cssText;
            }
        }
    }
    return text;
}

const switchTrackRules = () => emotionRulesFor('.MuiSwitch-root', 'MuiSwitch-track');
const densityToggleRules = () => emotionRulesFor('.MuiToggleButtonGroup-root', 'MuiToggleButton-root');

const WHITE = /#fff|rgba\(\s*255,\s*255,\s*255/i;

describe('JobListViewOptions', () => {
    it('renders the logged-in only switch and keeps its track at the theme default', () => {
        renderWithTheme(<JobListViewOptions {...createDefaultProps({headerVariant: false})}/>);
        expect(screen.getByRole('switch')).toBeInTheDocument();
        expect(switchTrackRules()).not.toMatch(WHITE);
    });

    it('takes the switch and density toggle colours from the theme in the header variant', () => {
        renderWithTheme(<JobListViewOptions {...createDefaultProps({headerVariant: true})}/>);
        // The panel header is a plain `background.paper` bar, so hardcoded white
        // would be invisible against it.
        expect(switchTrackRules()).not.toMatch(WHITE);
        expect(densityToggleRules()).not.toMatch(WHITE);
    });
});
