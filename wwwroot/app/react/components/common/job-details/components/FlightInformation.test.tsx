/** @jest-environment jest-environment-jsdom */
/**
 * FlightInformation Component Tests
 */

import React from 'react';
import {render, screen} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {FlightInformation} from './FlightInformation';
import {createMockFlight} from '../__testUtils__/mockJob';
import dayjs from 'dayjs';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
    return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('FlightInformation', () => {
    it('renders nothing when flight has no or undefined segments', () => {
        const {container: c1} = renderWithTheme(
            <FlightInformation flight={createMockFlight({flightSegments: []})} />
        );
        expect(c1.firstChild).toBeNull();

        const {container: c2} = renderWithTheme(
            <FlightInformation flight={createMockFlight({flightSegments: undefined})} />
        );
        expect(c2.firstChild).toBeNull();
    });

    it('renders flight segment details', () => {
        const flight = createMockFlight();
        renderWithTheme(<FlightInformation flight={flight} />);
        expect(screen.getByText('Flight Information')).toBeInTheDocument();
        expect(screen.getByText('NZ123')).toBeInTheDocument();
        expect(screen.getByText('AKL')).toBeInTheDocument();
        expect(screen.getByText('SYD')).toBeInTheDocument();
        expect(screen.getByText(/10:00/)).toBeInTheDocument();
        expect(screen.getByText(/14:00/)).toBeInTheDocument();
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
        renderWithTheme(<FlightInformation flight={flight} />);

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
        renderWithTheme(<FlightInformation flight={flight} />);
        expect(screen.getByText(/45m connection/)).toBeInTheDocument();
    });
});
