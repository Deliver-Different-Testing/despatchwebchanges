import React from 'react';
import {render, screen, within} from '@testing-library/react';
import { setupUser } from '../../../__testUtils__/setupUser';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {TruckModeMenu} from './TruckModeMenu';

// Shared fast userEvent instance (see setupUser).
const userEvent = setupUser();

function renderMenu(value: 'On' | 'Off' | 'Only' = 'On', onChange = jest.fn()) {
    render(
        <ThemeProvider theme={createTheme()}>
            <TruckModeMenu value={value} onChange={onChange} />
        </ThemeProvider>,
    );
    return {onChange};
}

describe('TruckModeMenu', () => {
    it('shows the current mode on the header button', () => {
        renderMenu('Off');
        expect(screen.getByRole('button', {name: 'Truck mode'})).toHaveTextContent('Trucks: Off');
    });

    it('opens the menu, marks the active mode selected, and fires onChange on select', async () => {
        const {onChange} = renderMenu('On');

        await userEvent.click(screen.getByRole('button', {name: 'Truck mode'}));

        const menu = screen.getByRole('menu');
        const items = within(menu).getAllByRole('menuitem');
        expect(items.map((i) => i.textContent)).toEqual(['On', 'Off', 'Only']);
        // The active mode is marked with a check; the others aren't.
        expect(within(within(menu).getByRole('menuitem', {name: 'On'})).getByTestId('CheckIcon')).toBeInTheDocument();
        expect(within(within(menu).getByRole('menuitem', {name: 'Off'})).queryByTestId('CheckIcon')).not.toBeInTheDocument();

        await userEvent.click(within(menu).getByRole('menuitem', {name: 'Only'}));
        expect(onChange).toHaveBeenCalledWith('Only');
    });
});
