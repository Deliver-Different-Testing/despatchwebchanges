/**
 * Tests for FlightSummaryCard component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import dayjs from 'dayjs';
import { FlightSummaryCard } from './FlightSummaryCard';
import { FlightData, FlightSegmentData } from './types';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
    return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

function createSegment(overrides?: Partial<FlightSegmentData>): FlightSegmentData {
    return {
        segmentOrder: 0,
        carrierFsCode: 'BA',
        flightNumber: '117',
        departureTime: dayjs('2024-06-01T09:00:00'),
        arrivalTime: dayjs('2024-06-01T13:30:00'),
        departureAirportFsCode: 'LHR',
        arrivalAirportFsCode: 'JFK',
        departureAirportTimeZone: 'Europe/London',
        arrivalAirportTimeZone: 'America/New_York',
        elapsedTime: 270,
        airlineName: 'British Airways',
        stopsInSegment: 0,
        ...overrides,
    };
}

function createFlight(overrides?: Partial<FlightData>): FlightData {
    return {
        airline: 'British Airways',
        flightNumber: 'BA117',
        departureTime: dayjs('2024-06-01T09:00:00'),
        arrivalTime: dayjs('2024-06-01T13:30:00'),
        departureAirport: 'LHR',
        arrivalAirport: 'JFK',
        departureTimeZone: 'Europe/London',
        arrivalTimeZone: 'America/New_York',
        duration: '04:30:00',
        stops: 0,
        elapsedTime: 270,
        isMultiSegment: false,
        flightSegments: [],
        ...overrides,
    };
}

describe('FlightSummaryCard', () => {
    const defaultProps = {
        segment: createSegment(),
        flight: createFlight(),
        duration: '4h 30m',
        isOverview: false,
    };

    describe('Airline Information', () => {
        it('displays the airline name', () => {
            renderWithTheme(<FlightSummaryCard {...defaultProps} />);
            expect(screen.getByText('British Airways')).toBeInTheDocument();
        });

        it('displays the carrier code in the logo placeholder', () => {
            renderWithTheme(<FlightSummaryCard {...defaultProps} />);
            // Carrier code appears in the logo box and in the flight number line
            const baElements = screen.getAllByText('BA');
            expect(baElements.length).toBeGreaterThanOrEqual(1);
        });

        it('displays the flight number', () => {
            renderWithTheme(<FlightSummaryCard {...defaultProps} />);
            expect(screen.getByText('BA 117')).toBeInTheDocument();
        });

        it('falls back to flight-level data when segment airline info is missing', () => {
            const segment = createSegment({ airlineName: undefined, carrierFsCode: '', flightNumber: '' });
            const flight = createFlight({ flightNumber: 'UA999' });
            renderWithTheme(
                <FlightSummaryCard
                    segment={segment}
                    flight={flight}
                    duration="4h 30m"
                    isOverview={false}
                />
            );
            // Falls back to flight.airline for the name
            expect(screen.getByText('British Airways')).toBeInTheDocument();
            // Falls back to flightNumber.substring(0,2) for carrier code and substring(2) for flight num
            expect(screen.getByText('UA 999')).toBeInTheDocument();
        });
    });

    describe('Date Display', () => {
        it('displays the departure date formatted correctly', () => {
            renderWithTheme(<FlightSummaryCard {...defaultProps} />);
            expect(screen.getByText('Sat, Jun 1, 2024')).toBeInTheDocument();
        });

        it('uses segment departure time for the date', () => {
            const segment = createSegment({
                departureTime: dayjs('2024-12-25T10:00:00'),
            });
            renderWithTheme(
                <FlightSummaryCard
                    segment={segment}
                    flight={createFlight()}
                    duration="4h 30m"
                    isOverview={false}
                />
            );
            expect(screen.getByText('Wed, Dec 25, 2024')).toBeInTheDocument();
        });
    });

    describe('Route Display', () => {
        it('displays departure airport code', () => {
            renderWithTheme(<FlightSummaryCard {...defaultProps} />);
            expect(screen.getByText('LHR')).toBeInTheDocument();
        });

        it('displays arrival airport code', () => {
            renderWithTheme(<FlightSummaryCard {...defaultProps} />);
            expect(screen.getByText('JFK')).toBeInTheDocument();
        });

        it('displays departure time in HH:mm format', () => {
            renderWithTheme(<FlightSummaryCard {...defaultProps} />);
            expect(screen.getByText('09:00')).toBeInTheDocument();
        });

        it('displays arrival time in HH:mm format', () => {
            renderWithTheme(<FlightSummaryCard {...defaultProps} />);
            expect(screen.getByText('13:30')).toBeInTheDocument();
        });

        it('displays the duration badge', () => {
            renderWithTheme(<FlightSummaryCard {...defaultProps} />);
            expect(screen.getByText('4h 30m')).toBeInTheDocument();
        });
    });

    describe('Overview Mode with Multi-segment Flight', () => {
        it('shows last segment arrival in overview mode', () => {
            const segments: FlightSegmentData[] = [
                createSegment({
                    segmentOrder: 0,
                    departureAirportFsCode: 'LHR',
                    arrivalAirportFsCode: 'ORD',
                    arrivalTime: dayjs('2024-06-01T14:00:00'),
                }),
                createSegment({
                    segmentOrder: 1,
                    departureAirportFsCode: 'ORD',
                    arrivalAirportFsCode: 'LAX',
                    arrivalTime: dayjs('2024-06-01T18:00:00'),
                }),
            ];

            const flight = createFlight({
                isMultiSegment: true,
                flightSegments: segments,
                arrivalAirport: 'LAX',
            });

            renderWithTheme(
                <FlightSummaryCard
                    segment={segments[0]}
                    flight={flight}
                    duration="9h 00m"
                    isOverview={true}
                />
            );

            // Should show LAX (final destination) as arrival, not ORD
            expect(screen.getByText('LAX')).toBeInTheDocument();
            expect(screen.getByText('18:00')).toBeInTheDocument();
        });

        it('shows segment arrival in non-overview mode even for multi-segment flight', () => {
            const segments: FlightSegmentData[] = [
                createSegment({
                    segmentOrder: 0,
                    arrivalAirportFsCode: 'ORD',
                    arrivalTime: dayjs('2024-06-01T14:00:00'),
                }),
                createSegment({
                    segmentOrder: 1,
                    arrivalAirportFsCode: 'LAX',
                    arrivalTime: dayjs('2024-06-01T18:00:00'),
                }),
            ];

            const flight = createFlight({
                isMultiSegment: true,
                flightSegments: segments,
            });

            renderWithTheme(
                <FlightSummaryCard
                    segment={segments[0]}
                    flight={flight}
                    duration="5h 00m"
                    isOverview={false}
                />
            );

            // Non-overview: should show segment 0's arrival (ORD), not LAX
            expect(screen.getByText('ORD')).toBeInTheDocument();
            expect(screen.getByText('14:00')).toBeInTheDocument();
        });
    });

    describe('Fallback Behavior', () => {
        it('uses flight-level airport codes when segment codes are empty', () => {
            const segment = createSegment({
                departureAirportFsCode: '',
                arrivalAirportFsCode: '',
            });
            const flight = createFlight({
                departureAirport: 'SFO',
                arrivalAirport: 'MIA',
            });

            renderWithTheme(
                <FlightSummaryCard
                    segment={segment}
                    flight={flight}
                    duration="5h 00m"
                    isOverview={false}
                />
            );

            expect(screen.getByText('SFO')).toBeInTheDocument();
            expect(screen.getByText('MIA')).toBeInTheDocument();
        });
    });
});
