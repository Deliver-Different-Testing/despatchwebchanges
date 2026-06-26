/**
 * FlightInformation Component Tests
 */

import React from 'react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {FlightInformation} from './FlightInformation';
import {createMockFlight} from '../__testUtils__/mockJob';
import dayjs from 'dayjs';
import nationwideApi from '../../../../services/nationwideApi';

jest.mock('../../../../services/nationwideApi', () => ({
    __esModule: true,
    default: {
        getFlightWebhookStatus: jest.fn(),
    },
}));

const mockGetFlightWebhookStatus = nationwideApi.getFlightWebhookStatus as jest.Mock;

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
    return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('FlightInformation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders nothing when flight has no or undefined segments', () => {
        const {container: c1} = renderWithTheme(
            <FlightInformation flight={createMockFlight({flightSegments: []})} jobId={1} />
        );
        expect(c1.firstChild).toBeNull();

        const {container: c2} = renderWithTheme(
            <FlightInformation flight={createMockFlight({flightSegments: undefined})} jobId={1} />
        );
        expect(c2.firstChild).toBeNull();
    });

    it('renders flight segment details and the Check Webhooks button', () => {
        const flight = createMockFlight();
        renderWithTheme(<FlightInformation flight={flight} jobId={1} />);
        expect(screen.getByText('Flight Information')).toBeInTheDocument();
        expect(screen.getByText('NZ123')).toBeInTheDocument();
        expect(screen.getByText('AKL')).toBeInTheDocument();
        expect(screen.getByText('SYD')).toBeInTheDocument();
        expect(screen.getByText(/10:00/)).toBeInTheDocument();
        expect(screen.getByText(/14:00/)).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /check webhooks/i})).toBeInTheDocument();
    });

    it('renders connection time between segments', () => {
        const flight = createMockFlight({
            flightSegments: [
                {
                    flightNumber: 'NZ100',
                    departureAirportFsCode: 'AKL',
                    arrivalAirportFsCode: 'MEL',
                    departureTime: dayjs('2026-03-23T08:00:00'),
                    arrivalTime: dayjs('2026-03-23T10:00:00'),
                    _departureTimeStr: '08:00',
                    _arrivalTimeStr: '10:00',
                    _departureTimeZoneStr: 'NZDT',
                    _arrivalTimeZoneStr: 'AEDT',
                } as any,
                {
                    flightNumber: 'NZ200',
                    departureAirportFsCode: 'MEL',
                    arrivalAirportFsCode: 'SYD',
                    departureTime: dayjs('2026-03-23T11:30:00'),
                    arrivalTime: dayjs('2026-03-23T12:30:00'),
                    _departureTimeStr: '11:30',
                    _arrivalTimeStr: '12:30',
                    _departureTimeZoneStr: 'AEDT',
                    _arrivalTimeZoneStr: 'AEDT',
                } as any,
            ],
        });
        renderWithTheme(<FlightInformation flight={flight} jobId={1} />);

        expect(screen.getByText('NZ100')).toBeInTheDocument();
        expect(screen.getByText('NZ200')).toBeInTheDocument();
        expect(screen.getAllByText('MEL')).toHaveLength(2);
        expect(screen.getByText(/1h 30m connection/)).toBeInTheDocument();
    });

    it('renders short connection time without hours', () => {
        const flight = createMockFlight({
            flightSegments: [
                {
                    flightNumber: 'NZ100',
                    departureAirportFsCode: 'AKL',
                    arrivalAirportFsCode: 'WLG',
                    departureTime: dayjs('2026-03-23T08:00:00'),
                    arrivalTime: dayjs('2026-03-23T09:00:00'),
                    _departureTimeStr: '08:00',
                    _arrivalTimeStr: '09:00',
                } as any,
                {
                    flightNumber: 'NZ200',
                    departureAirportFsCode: 'WLG',
                    arrivalAirportFsCode: 'CHC',
                    departureTime: dayjs('2026-03-23T09:45:00'),
                    arrivalTime: dayjs('2026-03-23T10:30:00'),
                    _departureTimeStr: '09:45',
                    _arrivalTimeStr: '10:30',
                } as any,
            ],
        });
        renderWithTheme(<FlightInformation flight={flight} jobId={1} />);
        expect(screen.getByText(/45m connection/)).toBeInTheDocument();
    });

    it('shows "Webhooks Active" when API returns active', async () => {
        mockGetFlightWebhookStatus.mockResolvedValue({active: true});
        const flight = createMockFlight();
        renderWithTheme(<FlightInformation flight={flight} jobId={42} />);

        await userEvent.click(screen.getByRole('button', {name: /check webhooks/i}));

        expect(await screen.findByText('Webhooks Active')).toBeInTheDocument();
        expect(mockGetFlightWebhookStatus).toHaveBeenCalledWith(42);
    });

    it('shows "Webhooks Inactive" when API returns inactive', async () => {
        mockGetFlightWebhookStatus.mockResolvedValue({active: false});
        const flight = createMockFlight();
        renderWithTheme(<FlightInformation flight={flight} jobId={7} />);

        await userEvent.click(screen.getByRole('button', {name: /check webhooks/i}));

        expect(await screen.findByText('Webhooks Inactive')).toBeInTheDocument();
        expect(mockGetFlightWebhookStatus).toHaveBeenCalledWith(7);
    });

    it('shows "Webhooks Inactive" when API call fails', async () => {
        mockGetFlightWebhookStatus.mockRejectedValue(new Error('Network error'));
        const flight = createMockFlight();
        renderWithTheme(<FlightInformation flight={flight} jobId={1} />);

        await userEvent.click(screen.getByRole('button', {name: /check webhooks/i}));

        expect(await screen.findByText('Webhooks Inactive')).toBeInTheDocument();
    });

    it('shows loading state while checking webhooks', async () => {
        let resolve: (value: {active: boolean}) => void;
        mockGetFlightWebhookStatus.mockReturnValue(new Promise(r => { resolve = r; }));

        const flight = createMockFlight();
        renderWithTheme(<FlightInformation flight={flight} jobId={1} />);

        await userEvent.click(screen.getByRole('button', {name: /check webhooks/i}));

        expect(screen.getByText('Checking...')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /checking/i})).toBeDisabled();

        resolve!({active: true});
        expect(await screen.findByText('Webhooks Active')).toBeInTheDocument();
    });
});
