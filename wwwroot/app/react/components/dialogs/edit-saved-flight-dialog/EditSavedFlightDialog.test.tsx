/**
 * EditSavedFlightDialog Component Tests
 */

import React from 'react';
import {render, screen, fireEvent, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {ThemeProvider} from '@mui/material/styles';
import dayjs from 'dayjs';
import {EditSavedFlightDialog} from './EditSavedFlightDialog';
import {testTheme} from '../../../__testUtils__';
import {nationwideApi} from '../../../services/nationwideApi';

jest.mock('../../../services/nationwideApi', () => ({
    nationwideApi: {getRecurringFlightOptions: jest.fn()},
}));

const mockedApi = nationwideApi as jest.Mocked<typeof nationwideApi>;

function flight(carrier: string, number: string, dep: string, arr: string, time: string) {
    return {
        airline: carrier,
        flightNumber: number,
        departureTime: dayjs(time),
        arrivalTime: dayjs(time).add(1, 'hour'),
        departureAirport: dep,
        arrivalAirport: arr,
        flightSegments: [{carrierFsCode: carrier, flightNumber: number}],
    } as any;
}

function renderWithTheme(ui: React.ReactElement) {
    return render(<ThemeProvider theme={testTheme}>{ui}</ThemeProvider>);
}

function defaultProps(overrides?: Record<string, any>) {
    return {
        open: true,
        bookingId: 42,
        fromAirportId: 1,
        toAirportId: 2,
        currentValue: undefined,
        departureDate: dayjs('2026-07-08'),
        onClose: jest.fn(),
        onSubmit: jest.fn(),
        ...overrides,
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    mockedApi.getRecurringFlightOptions.mockResolvedValue({
        flights: [
            flight('NZ', '123', 'AKL', 'WLG', '2026-07-08T08:00:00'),
            flight('NZ', '455', 'AKL', 'WLG', '2026-07-08T10:30:00'),
        ],
    });
});

describe('EditSavedFlightDialog', () => {
    it('searches the route on open and submits the picked flight number', async () => {
        const user = userEvent.setup();
        const onSubmit = jest.fn();
        renderWithTheme(<EditSavedFlightDialog {...defaultProps({onSubmit})} />);

        await waitFor(() =>
            expect(mockedApi.getRecurringFlightOptions).toHaveBeenCalledWith(
                expect.objectContaining({bookingId: 42, departureAirportId: 1, arrivalAirportId: 2, departureDate: '2026-07-08'})
            )
        );

        await user.click(screen.getByRole('combobox'));
        const option = await screen.findByText(/NZ455/);
        await user.click(option);

        await user.click(screen.getByRole('button', {name: /save/i}));
        expect(onSubmit).toHaveBeenCalledWith('NZ455');
    });

    it('warns on a custom flight number not on the route but still saves it', async () => {
        const user = userEvent.setup();
        const onSubmit = jest.fn();
        renderWithTheme(<EditSavedFlightDialog {...defaultProps({onSubmit})} />);

        await waitFor(() => expect(mockedApi.getRecurringFlightOptions).toHaveBeenCalled());

        await user.type(screen.getByRole('combobox'), 'qf999');

        expect(await screen.findByRole('alert')).toHaveTextContent(/custom flight number/i);

        await user.click(screen.getByRole('button', {name: /save/i}));
        expect(onSubmit).toHaveBeenCalledWith('QF999');
    });

    it('pre-fills the current saved flight and can clear it to an empty value', async () => {
        const user = userEvent.setup();
        const onSubmit = jest.fn();
        renderWithTheme(<EditSavedFlightDialog {...defaultProps({currentValue: 'NZ123', onSubmit})} />);

        const input = screen.getByRole('combobox') as HTMLInputElement;
        await waitFor(() => expect(input.value).toBe('NZ123'));

        await user.clear(input);
        await user.click(screen.getByRole('button', {name: /save/i}));
        expect(onSubmit).toHaveBeenCalledWith('');
    });

    it('lets the operator enter a flight number when the route has no airports', async () => {
        const user = userEvent.setup();
        const onSubmit = jest.fn();
        renderWithTheme(
            <EditSavedFlightDialog {...defaultProps({fromAirportId: undefined, toAirportId: undefined, onSubmit})} />
        );

        const input = screen.getByPlaceholderText(/enter a flight number/i);
        await user.type(input, 'nz500');
        await user.click(screen.getByRole('button', {name: /save/i}));
        expect(onSubmit).toHaveBeenCalledWith('NZ500');
    });
});
