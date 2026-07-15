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
    it('shows the current mode on the accessible combobox', () => {
        renderMenu('Off');
        expect(screen.getByRole('combobox', {name: 'Truck mode'})).toHaveTextContent('Trucks: Off');
    });

    it('opens the dropdown, marks the active mode selected, and fires onChange on select', async () => {
        const {onChange} = renderMenu('On');

        await userEvent.click(screen.getByRole('combobox', {name: 'Truck mode'}));

        const listbox = screen.getByRole('listbox');
        const options = within(listbox).getAllByRole('option');
        expect(options.map((o) => o.textContent)).toEqual(['On', 'Off', 'Only']);
        expect(within(listbox).getByRole('option', {name: 'On'})).toHaveAttribute('aria-selected', 'true');

        await userEvent.click(within(listbox).getByRole('option', {name: 'Only'}));
        expect(onChange).toHaveBeenCalledWith('Only');
    });
});
