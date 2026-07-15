import React from 'react';
import { setupUser } from '../../../__testUtils__/setupUser';
import {render, screen} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';

const useCourierSearchMock = jest.fn();
jest.mock('../../../hooks/useCourierApi', () => ({
    useCourierSearch: (...args: unknown[]) => useCourierSearchMock(...args),
}));

import {CourierSearchField} from './CourierSearchField';

function renderField(onSelect = jest.fn()) {
    render(
        <ThemeProvider theme={createTheme()}>
            <CourierSearchField onSelect={onSelect} />
        </ThemeProvider>,
    );
    return onSelect;
}

describe('CourierSearchField', () => {
    beforeEach(() => {
        useCourierSearchMock.mockReset();
        useCourierSearchMock.mockReturnValue({
            data: [{id: 9, text: '101 - Alice'}, {id: 10, text: '102 - Bob'}],
            isFetching: false,
        });
    });

    it('renders a courier search input', () => {
        renderField();
        expect(screen.getByLabelText('Search courier')).toBeInTheDocument();
    });

    it('calls onSelect with the chosen courier', async () => {
        const user = setupUser();
        const onSelect = renderField();

        // Open the dropdown (options come from the mocked search hook).
        await user.click(screen.getByRole('button', {name: 'Open'}));
        await user.click(await screen.findByRole('option', {name: '101 - Alice'}));

        expect(onSelect).toHaveBeenCalledWith({id: 9, text: '101 - Alice'});
    });
});
