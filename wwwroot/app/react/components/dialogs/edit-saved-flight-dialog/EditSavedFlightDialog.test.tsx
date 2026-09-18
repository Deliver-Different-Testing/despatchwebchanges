/**
 * EditSavedFlightDialog Component Tests
 */

import React from 'react';
import {screen, waitFor} from '@testing-library/react';
import dayjs from 'dayjs';
import {EditSavedFlightDialog} from './EditSavedFlightDialog';
import { setupUser } from '../../../__testUtils__/setupUser';
import {nationwideApi} from '../../../services/nationwideApi';
import {renderWithMantine as renderWithTheme} from '../../../__testUtils__';

jest.mock('../../../services/nationwideApi', () => ({
    nationwideApi: {getRecurringFlightOptions: jest.fn(), getAllActiveAirportSuggestions: jest.fn()},
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
    mockedApi.getAllActiveAirportSuggestions.mockResolvedValue([
        {id: 10, text: 'AKL - Auckland'},
        {id: 20, text: 'WLG - Wellington'},
    ]);
});

describe('EditSavedFlightDialog', () => {
    it('searches the route on open and submits the picked flight number', async () => {
        const user = setupUser();
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
        const user = setupUser();
        const onSubmit = jest.fn();
        renderWithTheme(<EditSavedFlightDialog {...defaultProps({onSubmit})} />);

        await waitFor(() => expect(mockedApi.getRecurringFlightOptions).toHaveBeenCalled());

        await user.type(screen.getByRole('combobox'), 'qf999');

        expect(await screen.findByRole('alert')).toHaveTextContent(/custom flight number/i);

        await user.click(screen.getByRole('button', {name: /save/i}));
        expect(onSubmit).toHaveBeenCalledWith('QF999');
    });

    it('pre-fills the current saved flight and can clear it to an empty value', async () => {
        const user = setupUser();
        const onSubmit = jest.fn();
        renderWithTheme(<EditSavedFlightDialog {...defaultProps({currentValue: 'NZ123', onSubmit})} />);

        const input = screen.getByRole('combobox') as HTMLInputElement;
        await waitFor(() => expect(input.value).toBe('NZ123'));

        await user.clear(input);
        await user.click(screen.getByRole('button', {name: /save/i}));
        expect(onSubmit).toHaveBeenCalledWith('');
    });

    it('collapses duplicate flight options from the search result instead of crashing', async () => {
        mockedApi.getRecurringFlightOptions.mockResolvedValue({
            flights: [
                flight('WN', '3771', 'OAK', 'BUR', '2026-07-08T11:20:00'),
                flight('WN', '3771', 'OAK', 'BUR', '2026-07-08T11:20:00'),
            ],
        });
        const user = setupUser();
        const onSubmit = jest.fn();
        renderWithTheme(<EditSavedFlightDialog {...defaultProps({onSubmit})} />);

        await waitFor(() => expect(mockedApi.getRecurringFlightOptions).toHaveBeenCalled());

        await user.click(screen.getByRole('combobox'));
        const matches = await screen.findAllByText(/WN3771/);
        expect(matches).toHaveLength(1);

        await user.click(matches[0]);
        await user.click(screen.getByRole('button', {name: /save/i}));
        expect(onSubmit).toHaveBeenCalledWith('WN3771');
    });

    it('lets the operator enter a flight number when the route has no airports', async () => {
        const user = setupUser();
        const onSubmit = jest.fn();
        renderWithTheme(
            <EditSavedFlightDialog {...defaultProps({fromAirportId: undefined, toAirportId: undefined, onSubmit})} />
        );

        const input = screen.getByPlaceholderText(/enter a flight number/i);
        await user.type(input, 'nz500');
        await user.click(screen.getByRole('button', {name: /save/i}));
        expect(onSubmit).toHaveBeenCalledWith('NZ500');
    });

    describe('add-flight mode (showAirportPickers)', () => {
        it('picks airports, searches that route, and submits flight + airports', async () => {
            const user = setupUser();
            const onSubmit = jest.fn();
            renderWithTheme(
                <EditSavedFlightDialog
                    {...defaultProps({
                        fromAirportId: undefined,
                        toAirportId: undefined,
                        showAirportPickers: true,
                        onSubmit,
                    })}
                />
            );

            // Airport list loads and Save is blocked until a route + flight are chosen.
            await waitFor(() => expect(mockedApi.getAllActiveAirportSuggestions).toHaveBeenCalled());
            expect(screen.getByRole('button', {name: /save/i})).toBeDisabled();

            // Choose the From airport.
            await user.click(screen.getByPlaceholderText(/select departure airport/i));
            await user.click(await screen.findByText('AKL - Auckland'));

            // Choose the To airport.
            await user.click(screen.getByPlaceholderText(/select arrival airport/i));
            await user.click(await screen.findByText('WLG - Wellington'));

            // Flight search runs against the chosen route.
            await waitFor(() =>
                expect(mockedApi.getRecurringFlightOptions).toHaveBeenCalledWith(
                    expect.objectContaining({departureAirportId: 10, arrivalAirportId: 20})
                )
            );

            // Pick a flight and save — airports travel with the flight number.
            await user.click(screen.getByPlaceholderText(/search flights or type a number/i));
            await user.click(await screen.findByText(/NZ123/));
            await user.click(screen.getByRole('button', {name: /save/i}));

            expect(onSubmit).toHaveBeenCalledWith('NZ123', {fromAirportId: 10, toAirportId: 20});
        });

        it('disables Save until a route and flight are chosen, then enables it', async () => {
            const user = setupUser();
            renderWithTheme(
                <EditSavedFlightDialog
                    {...defaultProps({fromAirportId: undefined, toAirportId: undefined, showAirportPickers: true})}
                />
            );

            await waitFor(() => expect(mockedApi.getAllActiveAirportSuggestions).toHaveBeenCalled());
            expect(screen.getByRole('button', {name: /save/i})).toBeDisabled();

            await user.click(screen.getByPlaceholderText(/select departure airport/i));
            await user.click(await screen.findByText('AKL - Auckland'));
            await user.click(screen.getByPlaceholderText(/select arrival airport/i));
            await user.click(await screen.findByText('WLG - Wellington'));
            await user.click(screen.getByPlaceholderText(/search flights or type a number/i));
            await user.click(await screen.findByText(/NZ123/));

            expect(screen.getByRole('button', {name: /save/i})).toBeEnabled();
        });
    });

    describe('accessibility', () => {
        it('gives the dialog and its fields accessible names', async () => {
            renderWithTheme(
                <EditSavedFlightDialog
                    {...defaultProps({fromAirportId: undefined, toAirportId: undefined, showAirportPickers: true})}
                />
            );

            await waitFor(() => expect(mockedApi.getAllActiveAirportSuggestions).toHaveBeenCalled());

            // Dialog is named by its header title (aria-labelledby).
            expect(screen.getByRole('dialog', {name: /add flight/i})).toBeInTheDocument();
            // Each input carries a real accessible name, not just a placeholder.
            expect(screen.getByRole('combobox', {name: /from airport/i})).toBeInTheDocument();
            expect(screen.getByRole('combobox', {name: /to airport/i})).toBeInTheDocument();
            expect(screen.getByRole('combobox', {name: /flight number/i})).toBeInTheDocument();
        });

        it('names the dialog "Saved Flight" for an existing flight booking', async () => {
            renderWithTheme(<EditSavedFlightDialog {...defaultProps()} />);
            await waitFor(() => expect(mockedApi.getRecurringFlightOptions).toHaveBeenCalled());
            expect(screen.getByRole('dialog', {name: /saved flight/i})).toBeInTheDocument();
        });
    });
});
