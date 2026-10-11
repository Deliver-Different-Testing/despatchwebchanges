import React from 'react';
import {fireEvent, screen} from '@testing-library/react';
import {renderWithMantine} from '../../../__testUtils__';
import {ColorModeContext} from '../../../hooks/useColorMode';
import {getNationwideBetaEnabled} from '../../../pages/nationwide/lib/betaPreference';
import {ColorModeSwitcher} from './ColorModeSwitcher';
import {SideNav} from './SideNav';

jest.mock('../../../pages/nationwide/lib/betaPreference');

const setPreference = jest.fn();

const renderSwitcher = (preference: 'system' | 'light' | 'dark' = 'system') =>
    renderWithMantine(
        <ColorModeContext.Provider value={{mode: 'light', preference, setPreference}}>
            <ColorModeSwitcher />
        </ColorModeContext.Provider>,
    );

describe('ColorModeSwitcher', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getNationwideBetaEnabled as jest.Mock).mockReturnValue(true);
    });

    it('offers system, light and dark, checks the current preference, and applies a pick', () => {
        renderSwitcher('light');

        expect(screen.getByRole('radiogroup', {name: 'Colour mode'})).toBeInTheDocument();
        expect(screen.getByRole('radio', {name: 'Match device'})).not.toBeChecked();
        expect(screen.getByRole('radio', {name: 'Light'})).toBeChecked();

        fireEvent.click(screen.getByRole('radio', {name: 'Dark'}));
        expect(setPreference).toHaveBeenCalledWith('dark');
    });

    it('locks dark and system out while Nationwide v1 is on, since v1 has no dark styling', () => {
        (getNationwideBetaEnabled as jest.Mock).mockReturnValue(false);
        renderSwitcher('light');

        expect(screen.getByRole('radio', {name: 'Match device'})).toBeDisabled();
        expect(screen.getByRole('radio', {name: 'Dark'})).toBeDisabled();
        expect(screen.getByRole('radio', {name: 'Light'})).toBeEnabled();
    });

    it('sits in the side nav account header', () => {
        renderWithMantine(
            <SideNav open userName="John Doe" isUsCustomer={false} currentState="home" onClose={jest.fn()} onNavigate={jest.fn()} />,
        );

        expect(screen.getByTestId('sidenav-account')).toContainElement(screen.getByRole('radiogroup', {name: 'Colour mode'}));
    });
});
