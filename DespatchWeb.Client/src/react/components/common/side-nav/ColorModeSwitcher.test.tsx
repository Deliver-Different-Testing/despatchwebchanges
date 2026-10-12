import React from 'react';
import {fireEvent, screen} from '@testing-library/react';
import {renderWithMantine} from '../../../__testUtils__';
import {ColorModeContext} from '../../../hooks/useColorMode';
import {ColorModeSwitcher} from './ColorModeSwitcher';
import {SideNav} from './SideNav';

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
    });

    it('offers system, light and dark, checks the current preference, and applies a pick', () => {
        renderSwitcher('light');

        expect(screen.getByRole('radiogroup', {name: 'Colour mode'})).toBeInTheDocument();
        expect(screen.getByRole('radio', {name: 'Match device'})).not.toBeChecked();
        expect(screen.getByRole('radio', {name: 'Light'})).toBeChecked();

        fireEvent.click(screen.getByRole('radio', {name: 'Dark'}));
        expect(setPreference).toHaveBeenCalledWith('dark');
    });

    it('sits in the side nav account header', () => {
        renderWithMantine(
            <SideNav open userName="John Doe" isUsCustomer={false} currentState="home" onClose={jest.fn()} onNavigate={jest.fn()} />,
        );

        expect(screen.getByTestId('sidenav-account')).toContainElement(screen.getByRole('radiogroup', {name: 'Colour mode'}));
    });
});
