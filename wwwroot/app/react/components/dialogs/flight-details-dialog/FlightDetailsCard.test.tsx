/**
 * Tests for FlightDetailsCard component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import dayjs from 'dayjs';
import { FlightDetailsCard } from './FlightDetailsCard';
import { FlightData, FlightSegmentData } from './types';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
    return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

function createSegment(overrides?: Partial<FlightSegmentData>): FlightSegmentData {
    return {
        segmentOrder: 0,
        carrierFsCode: 'AA',
        flightNumber: '100',
        departureTime: dayjs('2024-07-10T14:00:00'),
        arrivalTime: dayjs('2024-07-10T18:30:00'),
        departureAirportFsCode: 'DFW',
        arrivalAirportFsCode: 'MIA',
        departureAirportName: 'Dallas/Fort Worth International',
        arrivalAirportName: 'Miami International',
        departureAirportCity: 'Dallas',
        arrivalAirportCity: 'Miami',
        departureAirportCountry: 'United States',
        arrivalAirportCountry: 'United States',
        departureAirportTimeZone: 'America/Chicago',
        arrivalAirportTimeZone: 'America/New_York',
        departureTerminal: 'D',
        arrivalTerminal: 'N',
        elapsedTime: 210,
        aircraftName: 'Boeing 777-300ER',
        airlineName: 'American Airlines',
        stopsInSegment: 0,
        ...overrides,
    };
}

function createFlight(overrides?: Partial<FlightData>): FlightData {
    return {
        airline: 'American Airlines',
        flightNumber: 'AA100',
        departureTime: dayjs('2024-07-10T14:00:00'),
        arrivalTime: dayjs('2024-07-10T18:30:00'),
        departureAirport: 'DFW',
        arrivalAirport: 'MIA',
        departureTimeZone: 'America/Chicago',
        arrivalTimeZone: 'America/New_York',
        duration: '03:30:00',
        stops: 0,
        aircraft: 'Boeing 777-300ER',
        elapsedTime: 210,
        isMultiSegment: false,
        flightSegments: [],
        ...overrides,
    };
}

describe('FlightDetailsCard', () => {
    const defaultProps = {
        segment: createSegment(),
        flight: createFlight(),
        isOverview: false,
    };

    describe('Section Headings', () => {
        it('displays "Flight Information" title', () => {
            renderWithTheme(<FlightDetailsCard {...defaultProps} />);
            expect(screen.getByText('Flight Information')).toBeInTheDocument();
        });

        it('displays "Departure" section heading', () => {
            renderWithTheme(<FlightDetailsCard {...defaultProps} />);
            expect(screen.getByText('Departure')).toBeInTheDocument();
        });

        it('displays "Arrival" section heading', () => {
            renderWithTheme(<FlightDetailsCard {...defaultProps} />);
            expect(screen.getByText('Arrival')).toBeInTheDocument();
        });
    });

    describe('Departure Information', () => {
        it('displays departure airport name', () => {
            renderWithTheme(<FlightDetailsCard {...defaultProps} />);
            expect(screen.getByText('Dallas/Fort Worth International')).toBeInTheDocument();
        });

        it('displays departure airport code', () => {
            renderWithTheme(<FlightDetailsCard {...defaultProps} />);
            expect(screen.getByText('DFW')).toBeInTheDocument();
        });

        it('displays departure city and country', () => {
            renderWithTheme(<FlightDetailsCard {...defaultProps} />);
            expect(screen.getByText('Dallas, United States')).toBeInTheDocument();
        });

        it('displays departure time in HH:mm format', () => {
            renderWithTheme(<FlightDetailsCard {...defaultProps} />);
            expect(screen.getByText('14:00')).toBeInTheDocument();
        });

        it('displays departure date', () => {
            renderWithTheme(<FlightDetailsCard {...defaultProps} />);
            // Date appears in both departure and arrival sections
            const dateElements = screen.getAllByText('Jul 10, 2024');
            expect(dateElements.length).toBeGreaterThanOrEqual(1);
        });

        it('displays departure terminal when available', () => {
            renderWithTheme(<FlightDetailsCard {...defaultProps} />);
            expect(screen.getByText('Terminal D')).toBeInTheDocument();
        });

        it('hides departure terminal when not available', () => {
            const segment = createSegment({ departureTerminal: undefined });
            renderWithTheme(
                <FlightDetailsCard segment={segment} flight={createFlight()} isOverview={false} />
            );
            expect(screen.queryByText(/Terminal D/)).not.toBeInTheDocument();
        });
    });

    describe('Arrival Information', () => {
        it('displays arrival airport name', () => {
            renderWithTheme(<FlightDetailsCard {...defaultProps} />);
            expect(screen.getByText('Miami International')).toBeInTheDocument();
        });

        it('displays arrival airport code', () => {
            renderWithTheme(<FlightDetailsCard {...defaultProps} />);
            expect(screen.getByText('MIA')).toBeInTheDocument();
        });

        it('displays arrival city and country', () => {
            renderWithTheme(<FlightDetailsCard {...defaultProps} />);
            expect(screen.getByText('Miami, United States')).toBeInTheDocument();
        });

        it('displays arrival time in HH:mm format', () => {
            renderWithTheme(<FlightDetailsCard {...defaultProps} />);
            expect(screen.getByText('18:30')).toBeInTheDocument();
        });

        it('displays arrival terminal when available', () => {
            renderWithTheme(<FlightDetailsCard {...defaultProps} />);
            expect(screen.getByText('Terminal N')).toBeInTheDocument();
        });

        it('hides arrival terminal when not available', () => {
            const segment = createSegment({ arrivalTerminal: undefined });
            renderWithTheme(
                <FlightDetailsCard segment={segment} flight={createFlight()} isOverview={false} />
            );
            expect(screen.queryByText(/Terminal N/)).not.toBeInTheDocument();
        });
    });

    describe('City and Country Display', () => {
        it('displays city without country when country is not available', () => {
            const segment = createSegment({
                departureAirportCity: 'Tokyo',
                departureAirportCountry: undefined,
            });
            renderWithTheme(
                <FlightDetailsCard segment={segment} flight={createFlight()} isOverview={false} />
            );
            expect(screen.getByText('Tokyo')).toBeInTheDocument();
        });

        it('hides city line when city is not available', () => {
            const segment = createSegment({
                departureAirportCity: undefined,
                arrivalAirportCity: undefined,
            });
            renderWithTheme(
                <FlightDetailsCard segment={segment} flight={createFlight()} isOverview={false} />
            );
            expect(screen.queryByText('Dallas, United States')).not.toBeInTheDocument();
            expect(screen.queryByText('Miami, United States')).not.toBeInTheDocument();
        });
    });

    describe('Aircraft Information', () => {
        it('displays aircraft section when aircraft name is available', () => {
            renderWithTheme(<FlightDetailsCard {...defaultProps} />);
            expect(screen.getByText('Aircraft')).toBeInTheDocument();
            expect(screen.getByText('Boeing 777-300ER')).toBeInTheDocument();
        });

        it('hides aircraft section when neither segment nor flight has aircraft', () => {
            const segment = createSegment({ aircraftName: undefined });
            const flight = createFlight({ aircraft: undefined });
            renderWithTheme(
                <FlightDetailsCard segment={segment} flight={flight} isOverview={false} />
            );
            expect(screen.queryByText('Aircraft')).not.toBeInTheDocument();
        });

        it('falls back to flight-level aircraft when segment aircraft is missing', () => {
            const segment = createSegment({ aircraftName: undefined });
            const flight = createFlight({ aircraft: 'Airbus A380' });
            renderWithTheme(
                <FlightDetailsCard segment={segment} flight={flight} isOverview={false} />
            );
            expect(screen.getByText('Airbus A380')).toBeInTheDocument();
        });
    });

    describe('Overview Mode with Multi-segment Flight', () => {
        it('shows final destination arrival info in overview mode', () => {
            const segments: FlightSegmentData[] = [
                createSegment({
                    segmentOrder: 0,
                    arrivalAirportFsCode: 'ORD',
                    arrivalAirportName: 'Chicago O\'Hare International',
                    arrivalAirportCity: 'Chicago',
                    arrivalAirportCountry: 'United States',
                    arrivalTime: dayjs('2024-07-10T16:00:00'),
                    arrivalTerminal: '5',
                }),
                createSegment({
                    segmentOrder: 1,
                    departureAirportFsCode: 'ORD',
                    arrivalAirportFsCode: 'LAX',
                    arrivalAirportName: 'Los Angeles International',
                    arrivalAirportCity: 'Los Angeles',
                    arrivalAirportCountry: 'United States',
                    arrivalTime: dayjs('2024-07-10T20:00:00'),
                    arrivalTerminal: '4',
                }),
            ];

            const flight = createFlight({
                isMultiSegment: true,
                flightSegments: segments,
                arrivalAirport: 'LAX',
            });

            renderWithTheme(
                <FlightDetailsCard
                    segment={segments[0]}
                    flight={flight}
                    isOverview={true}
                />
            );

            // In overview, arrival should show the last segment's info (LAX)
            expect(screen.getByText('Los Angeles International')).toBeInTheDocument();
            expect(screen.getByText('LAX')).toBeInTheDocument();
            expect(screen.getByText('20:00')).toBeInTheDocument();
            expect(screen.getByText('Terminal 4')).toBeInTheDocument();
        });

        it('shows segment-specific arrival in non-overview mode', () => {
            const segments: FlightSegmentData[] = [
                createSegment({
                    segmentOrder: 0,
                    arrivalAirportFsCode: 'ORD',
                    arrivalAirportName: 'Chicago O\'Hare International',
                    arrivalTime: dayjs('2024-07-10T16:00:00'),
                    arrivalTerminal: '5',
                }),
                createSegment({
                    segmentOrder: 1,
                    arrivalAirportFsCode: 'LAX',
                    arrivalAirportName: 'Los Angeles International',
                    arrivalTime: dayjs('2024-07-10T20:00:00'),
                }),
            ];

            const flight = createFlight({
                isMultiSegment: true,
                flightSegments: segments,
            });

            renderWithTheme(
                <FlightDetailsCard
                    segment={segments[0]}
                    flight={flight}
                    isOverview={false}
                />
            );

            // Non-overview: should show segment 0's arrival (ORD)
            expect(screen.getByText('Chicago O\'Hare International')).toBeInTheDocument();
            expect(screen.getByText('ORD')).toBeInTheDocument();
            expect(screen.getByText('Terminal 5')).toBeInTheDocument();
        });
    });

    describe('Fallback Behavior', () => {
        it('uses flight-level airport name when segment name is missing', () => {
            const segment = createSegment({
                departureAirportName: undefined,
                arrivalAirportName: undefined,
            });
            const flight = createFlight({
                departureAirport: 'DFW',
                arrivalAirport: 'MIA',
            });

            renderWithTheme(
                <FlightDetailsCard segment={segment} flight={flight} isOverview={false} />
            );

            // Falls back to airport codes as display names
            const dfwElements = screen.getAllByText('DFW');
            const miaElements = screen.getAllByText('MIA');
            expect(dfwElements.length).toBeGreaterThanOrEqual(2); // name + code
            expect(miaElements.length).toBeGreaterThanOrEqual(2);
        });
    });
});
