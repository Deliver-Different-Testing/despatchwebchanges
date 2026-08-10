import React from 'react';
import { setupUser } from '../../../__testUtils__/setupUser';
import {render, screen, waitFor} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';

const useCourierSearchMock = jest.fn();
jest.mock('../../../hooks/useCourierApi', () => ({
    useCourierSearch: (...args: unknown[]) => useCourierSearchMock(...args),
}));

const getExactCourierByCodeMock = jest.fn();
jest.mock('../../../services/courierApi', () => ({
    getExactCourierByCode: (...args: unknown[]) => getExactCourierByCodeMock(...args),
}));

import {CourierSearchField} from './CourierSearchField';

function renderField(overrides: Partial<React.ComponentProps<typeof CourierSearchField>> = {}) {
    const onSelect = jest.fn();
    const showToast = jest.fn();
    render(
        <ThemeProvider theme={createTheme()}>
            <CourierSearchField onSelect={onSelect} showToast={showToast} {...overrides} />
        </ThemeProvider>,
    );
    return {onSelect, showToast};
}

describe('CourierSearchField', () => {
    beforeEach(() => {
        useCourierSearchMock.mockReset();
        getExactCourierByCodeMock.mockReset();
        useCourierSearchMock.mockReturnValue({
            data: [{id: 9, text: '101 - Alice'}, {id: 10, text: '102 - Bob'}],
            isFetching: false,
        });
        getExactCourierByCodeMock.mockResolvedValue(null);
    });

    it('renders a courier search input and searches from a single character', () => {
        renderField();
        expect(screen.getByLabelText('Search courier')).toBeInTheDocument();
        // Courier codes can be one digit, so this field lowers the shared 2-char floor.
        expect(useCourierSearchMock).toHaveBeenCalledWith('', {minLength: 1});
    });

    it('calls onSelect with the chosen courier', async () => {
        const user = setupUser();
        const {onSelect} = renderField();

        // Open the dropdown (options come from the mocked search hook).
        await user.click(screen.getByRole('button', {name: 'Open'}));
        await user.click(await screen.findByRole('option', {name: '101 - Alice'}));

        expect(onSelect).toHaveBeenCalledWith({id: 9, text: '101 - Alice'});
    });

    it('picks the exact code match on Enter rather than the first substring hit', async () => {
        const user = setupUser();
        useCourierSearchMock.mockReturnValue({
            data: [{id: 1, text: '178 (Ann Smith)'}, {id: 2, text: '78 (Bob Jones)'}],
            isFetching: false,
        });
        const {onSelect} = renderField();

        await user.type(screen.getByRole('combobox'), '78');
        // The exact-code match is the only option offered, so Enter cannot pick 178.
        expect(await screen.findByRole('option', {name: '78 (Bob Jones)'})).toBeInTheDocument();
        expect(screen.queryByRole('option', {name: '178 (Ann Smith)'})).not.toBeInTheDocument();

        await user.keyboard('{Enter}');

        expect(onSelect).toHaveBeenCalledWith({id: 2, text: '78 (Bob Jones)'});
        expect(getExactCourierByCodeMock).not.toHaveBeenCalled();
    });

    it('falls back to an exact-code lookup when the search returns nothing', async () => {
        const user = setupUser();
        useCourierSearchMock.mockReturnValue({data: [], isFetching: false});
        getExactCourierByCodeMock.mockResolvedValue({id: 78, text: '78: Bob Jones'});
        const {onSelect} = renderField();

        const input = screen.getByRole('combobox');
        await user.type(input, '78');
        await user.keyboard('{Enter}');

        await waitFor(() => expect(onSelect).toHaveBeenCalledWith({id: 78, text: '78: Bob Jones'}));
        expect(getExactCourierByCodeMock).toHaveBeenCalledWith('78');
        // V1 cleared the code box so the next code can be typed straight away.
        await waitFor(() => expect(input).toHaveValue(''));
    });

    it('warns and selects nothing when no courier has the typed code', async () => {
        const user = setupUser();
        useCourierSearchMock.mockReturnValue({data: [], isFetching: false});
        getExactCourierByCodeMock.mockResolvedValue(null);
        const {onSelect, showToast} = renderField();

        await user.type(screen.getByRole('combobox'), '999');
        await user.keyboard('{Enter}');

        await waitFor(() =>
            expect(showToast).toHaveBeenCalledWith('No courier found with code: 999', 'warning'));
        expect(onSelect).not.toHaveBeenCalled();
    });

    it('reports a failed lookup separately from a code that does not exist', async () => {
        const user = setupUser();
        useCourierSearchMock.mockReturnValue({data: [], isFetching: false});
        getExactCourierByCodeMock.mockRejectedValue(new Error('boom'));
        const {onSelect, showToast} = renderField();

        await user.type(screen.getByRole('combobox'), '78');
        await user.keyboard('{Enter}');

        await waitFor(() =>
            expect(showToast).toHaveBeenCalledWith('Could not look up courier code: 78', 'error'));
        expect(onSelect).not.toHaveBeenCalled();
    });
});
