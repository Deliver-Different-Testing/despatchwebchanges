/**
 * JobListViewOptions Tests
 */

import React from 'react';
import {screen} from '@testing-library/react';
import {renderWithMantine} from '../../__testUtils__';
import {setupUser} from '../../__testUtils__/setupUser';
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

describe('JobListViewOptions', () => {
    it('marks the active density, and reports density, reset and switch changes', async () => {
        const props = createDefaultProps();
        renderWithMantine(<JobListViewOptions {...props}/>);
        const user = setupUser();

        expect(screen.getByRole('button', {name: 'Dense'})).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', {name: 'Normal'})).toHaveAttribute('aria-pressed', 'false');

        await user.click(screen.getByRole('button', {name: 'Ultra Dense'}));
        expect(props.onDensityModeChange).toHaveBeenCalledWith('ultra-dense');

        await user.click(screen.getByRole('button', {name: 'Reset columns'}));
        expect(props.onResetColumns).toHaveBeenCalledTimes(1);

        await user.click(screen.getByRole('switch', {name: 'Logged-in only'}));
        expect(props.onLoggedInCouriersOnlyChange).toHaveBeenCalledWith(true);
    });

    it('hides the logged-in switch outside dispatch contexts', () => {
        renderWithMantine(<JobListViewOptions {...createDefaultProps({showLoggedInSwitch: false})}/>);
        expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    });

    it('inherits the bar colour in the header variant instead of pinning one', () => {
        // The panel header is a plain `surface` bar, so a hardcoded colour would
        // either be invisible on it or stop following the colour scheme.
        renderWithMantine(<JobListViewOptions {...createDefaultProps({headerVariant: true})}/>);
        expect(screen.getByRole('button', {name: 'Reset columns'})).toHaveStyle({color: 'inherit'});
    });
});
