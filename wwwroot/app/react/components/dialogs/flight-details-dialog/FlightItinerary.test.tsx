/** @jest-environment jest-environment-jsdom */
/**
 * Tests for FlightItinerary component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import dayjs from 'dayjs';
import { FlightItinerary } from './FlightItinerary';
import { FlightSegmentData } from './types';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
    return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

function createSegment(overrides?: Partial<FlightSegmentData>): FlightSegmentData {
    return {
        segmentOrder: 0,
        carrierFsCode: 'DL',
        flightNumber: '400',
        departureTime: dayjs('2024-08-20T06:00:00'),
        arrivalTime: dayjs('2024-08-20T09:30:00'),
        departureAirportFsCode: 'ATL',
        arrivalAirportFsCode: 'DTW',
        departureAirportName: 'Hartsfield-Jackson Atlanta International',
        arrivalAirportName: 'Detroit Metropolitan Wayne County',
        departureAirportCity: 'Atlanta',
        arrivalAirportCity: 'Detroit',
        departureAirportCountry: 'United States',
        arrivalAirportCountry: 'United States',
        departureAirportTimeZone: 'America/New_York',
        arrivalAirportTimeZone: 'America/Detroit',
        departureTerminal: 'S',
        arrivalTerminal: 'EM',
        elapsedTime: 130,
        aircraftName: 'Boeing 757-200',
        flightEquipmentIataCode: '752',
        airlineName: 'Delta Air Lines',
        stopsInSegment: 0,
        ...overrides,
    };
}

function createTwoSegments(): FlightSegmentData[] {
    return [
        createSegment({
            segmentOrder: 0,
            carrierFsCode: 'DL',
            flightNumber: '400',
            departureTime: dayjs('2024-08-20T06:00:00'),
            arrivalTime: dayjs('2024-08-20T09:30:00'),
            departureAirportFsCode: 'ATL',
            arrivalAirportFsCode: 'DTW',
            departureTerminal: 'S',
            arrivalTerminal: 'EM',
            elapsedTime: 130,
            aircraftName: 'Boeing 757-200',
        }),
        createSegment({
            segmentOrder: 1,
            carrierFsCode: 'DL',
            flightNumber: '800',
            departureTime: dayjs('2024-08-20T11:00:00'),
            arrivalTime: dayjs('2024-08-20T14:00:00'),
            departureAirportFsCode: 'DTW',
            arrivalAirportFsCode: 'SEA',
            departureAirportName: 'Detroit Metropolitan Wayne County',
            arrivalAirportName: 'Seattle-Tacoma International',
            departureTerminal: 'EM',
            arrivalTerminal: undefined,
            elapsedTime: 300,
            aircraftName: 'Airbus A321',
        }),
    ];
}

function defaultGetConnectionTime(first: FlightSegmentData, second: FlightSegmentData): string {
    const diffMinutes = second.departureTime.diff(first.arrivalTime, 'minute');
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    if (hours > 0) {
        return `${hours}h ${mins < 10 ? '0' + mins : mins}m`;
    }
    return `${mins}m`;
}

describe('FlightItinerary', () => {
    describe('Null/Empty Rendering', () => {
        it('renders nothing when segments array is empty', () => {
            const { container } = renderWithTheme(
                <FlightItinerary segments={[]} getConnectionTime={defaultGetConnectionTime} />
            );
            expect(container.firstChild).toBeNull();
        });

        it('renders nothing when segments is undefined', () => {
            const { container } = renderWithTheme(
                <FlightItinerary
                    segments={undefined as unknown as FlightSegmentData[]}
                    getConnectionTime={defaultGetConnectionTime}
                />
            );
            expect(container.firstChild).toBeNull();
        });
    });

    describe('Card Header', () => {
        it('displays "Flight Itinerary" title', () => {
            const segments = [createSegment()];
            renderWithTheme(
                <FlightItinerary segments={segments} getConnectionTime={defaultGetConnectionTime} />
            );
            expect(screen.getByText('Flight Itinerary')).toBeInTheDocument();
        });
    });

    describe('Segment Display', () => {
        it('displays segment numbers (1-indexed)', () => {
            const segments = createTwoSegments();
            renderWithTheme(
                <FlightItinerary segments={segments} getConnectionTime={defaultGetConnectionTime} />
            );
            expect(screen.getByText('Segment 1')).toBeInTheDocument();
            expect(screen.getByText('Segment 2')).toBeInTheDocument();
        });

        it('displays flight numbers for each segment', () => {
            const segments = createTwoSegments();
            renderWithTheme(
                <FlightItinerary segments={segments} getConnectionTime={defaultGetConnectionTime} />
            );
            expect(screen.getByText('DL400')).toBeInTheDocument();
            expect(screen.getByText('DL800')).toBeInTheDocument();
        });

        it('displays departure and arrival airport codes for each segment', () => {
            const segments = createTwoSegments();
            renderWithTheme(
                <FlightItinerary segments={segments} getConnectionTime={defaultGetConnectionTime} />
            );
            expect(screen.getByText('ATL')).toBeInTheDocument();
            // DTW appears as both arrival of seg 1 and departure of seg 2
            const dtwElements = screen.getAllByText('DTW');
            expect(dtwElements.length).toBe(2);
            expect(screen.getByText('SEA')).toBeInTheDocument();
        });

        it('displays departure and arrival times for each segment', () => {
            const segments = createTwoSegments();
            renderWithTheme(
                <FlightItinerary segments={segments} getConnectionTime={defaultGetConnectionTime} />
            );
            expect(screen.getByText('06:00')).toBeInTheDocument();
            expect(screen.getByText('09:30')).toBeInTheDocument();
            expect(screen.getByText('11:00')).toBeInTheDocument();
            expect(screen.getByText('14:00')).toBeInTheDocument();
        });

        it('displays airport names when available', () => {
            const segments = createTwoSegments();
            renderWithTheme(
                <FlightItinerary segments={segments} getConnectionTime={defaultGetConnectionTime} />
            );
            expect(screen.getByText('Hartsfield-Jackson Atlanta International')).toBeInTheDocument();
            expect(screen.getByText('Seattle-Tacoma International')).toBeInTheDocument();
        });
    });

    describe('Duration Display (formatDuration)', () => {
        it('displays formatted elapsed time for a segment', () => {
            const segments = [createSegment({ elapsedTime: 130 })]; // 2h 10m
            renderWithTheme(
                <FlightItinerary segments={segments} getConnectionTime={defaultGetConnectionTime} />
            );
            expect(screen.getByText('2h 10m')).toBeInTheDocument();
        });

        it('displays N/A when elapsed time is 0', () => {
            const segments = [createSegment({ elapsedTime: 0 })];
            renderWithTheme(
                <FlightItinerary segments={segments} getConnectionTime={defaultGetConnectionTime} />
            );
            expect(screen.getByText('N/A')).toBeInTheDocument();
        });

        it('displays minutes only when under an hour', () => {
            const segments = [createSegment({ elapsedTime: 45 })];
            renderWithTheme(
                <FlightItinerary segments={segments} getConnectionTime={defaultGetConnectionTime} />
            );
            expect(screen.getByText('45m')).toBeInTheDocument();
        });

        it('pads single-digit minutes with leading zero', () => {
            const segments = [createSegment({ elapsedTime: 65 })]; // 1h 05m
            renderWithTheme(
                <FlightItinerary segments={segments} getConnectionTime={defaultGetConnectionTime} />
            );
            expect(screen.getByText('1h 05m')).toBeInTheDocument();
        });

        it('displays exact hours with 00 minutes', () => {
            const segments = [createSegment({ elapsedTime: 120 })]; // 2h 00m
            renderWithTheme(
                <FlightItinerary segments={segments} getConnectionTime={defaultGetConnectionTime} />
            );
            expect(screen.getByText('2h 00m')).toBeInTheDocument();
        });
    });

    describe('Connection Time', () => {
        it('displays connection time between segments', () => {
            const segments = createTwoSegments();
            // Connection: 09:30 -> 11:00 = 1h 30m
            renderWithTheme(
                <FlightItinerary segments={segments} getConnectionTime={defaultGetConnectionTime} />
            );
            expect(screen.getByText(/1h 30m connection time in DTW/)).toBeInTheDocument();
        });

        it('does not display connection time after the last segment', () => {
            const segments = createTwoSegments();
            renderWithTheme(
                <FlightItinerary segments={segments} getConnectionTime={defaultGetConnectionTime} />
            );
            // Only one connection time message should exist (between seg 1 and 2)
            const connectionMessages = screen.getAllByText(/connection time in/);
            expect(connectionMessages).toHaveLength(1);
        });

        it('calls getConnectionTime with correct segment pairs', () => {
            const segments = createTwoSegments();
            const mockGetConnectionTime = jest.fn().mockReturnValue('2h 00m');

            renderWithTheme(
                <FlightItinerary segments={segments} getConnectionTime={mockGetConnectionTime} />
            );

            expect(mockGetConnectionTime).toHaveBeenCalledTimes(1);
            expect(mockGetConnectionTime).toHaveBeenCalledWith(segments[0], segments[1]);
        });

        it('does not call getConnectionTime for single segment', () => {
            const segments = [createSegment()];
            const mockGetConnectionTime = jest.fn();

            renderWithTheme(
                <FlightItinerary segments={segments} getConnectionTime={mockGetConnectionTime} />
            );

            expect(mockGetConnectionTime).not.toHaveBeenCalled();
        });
    });

    describe('Terminal Information', () => {
        it('displays departure terminal when available', () => {
            const segments = [createSegment({ departureTerminal: 'A' })];
            renderWithTheme(
                <FlightItinerary segments={segments} getConnectionTime={defaultGetConnectionTime} />
            );
            expect(screen.getByText('Terminal A')).toBeInTheDocument();
        });

        it('displays arrival terminal when available', () => {
            const segments = [createSegment({ arrivalTerminal: 'B' })];
            renderWithTheme(
                <FlightItinerary segments={segments} getConnectionTime={defaultGetConnectionTime} />
            );
            expect(screen.getByText('Terminal B')).toBeInTheDocument();
        });

        it('hides terminal badges when terminals are not available', () => {
            const segments = [createSegment({
                departureTerminal: undefined,
                arrivalTerminal: undefined,
            })];
            renderWithTheme(
                <FlightItinerary segments={segments} getConnectionTime={defaultGetConnectionTime} />
            );
            expect(screen.queryByText(/^Terminal/)).not.toBeInTheDocument();
        });
    });

    describe('Aircraft Information', () => {
        it('displays aircraft name when available', () => {
            const segments = [createSegment({ aircraftName: 'Boeing 757-200' })];
            renderWithTheme(
                <FlightItinerary segments={segments} getConnectionTime={defaultGetConnectionTime} />
            );
            expect(screen.getByText('Boeing 757-200')).toBeInTheDocument();
        });

        it('falls back to IATA equipment code when aircraft name is missing', () => {
            const segments = [createSegment({
                aircraftName: undefined,
                flightEquipmentIataCode: '752',
            })];
            renderWithTheme(
                <FlightItinerary segments={segments} getConnectionTime={defaultGetConnectionTime} />
            );
            expect(screen.getByText('752')).toBeInTheDocument();
        });

        it('hides aircraft badge when neither name nor IATA code is available', () => {
            const segments = [createSegment({
                aircraftName: undefined,
                flightEquipmentIataCode: undefined,
            })];
            renderWithTheme(
                <FlightItinerary segments={segments} getConnectionTime={defaultGetConnectionTime} />
            );
            expect(screen.queryByText('Boeing 757-200')).not.toBeInTheDocument();
            expect(screen.queryByText('752')).not.toBeInTheDocument();
        });
    });

    describe('Three-Segment Flight', () => {
        it('renders all three segments with two connection times', () => {
            const segments: FlightSegmentData[] = [
                createSegment({
                    segmentOrder: 0,
                    carrierFsCode: 'DL',
                    flightNumber: '100',
                    departureAirportFsCode: 'ATL',
                    arrivalAirportFsCode: 'JFK',
                    departureTime: dayjs('2024-08-20T06:00:00'),
                    arrivalTime: dayjs('2024-08-20T08:30:00'),
                    elapsedTime: 150,
                }),
                createSegment({
                    segmentOrder: 1,
                    carrierFsCode: 'DL',
                    flightNumber: '200',
                    departureAirportFsCode: 'JFK',
                    arrivalAirportFsCode: 'LHR',
                    departureTime: dayjs('2024-08-20T10:00:00'),
                    arrivalTime: dayjs('2024-08-20T22:00:00'),
                    elapsedTime: 420,
                }),
                createSegment({
                    segmentOrder: 2,
                    carrierFsCode: 'DL',
                    flightNumber: '300',
                    departureAirportFsCode: 'LHR',
                    arrivalAirportFsCode: 'CDG',
                    departureTime: dayjs('2024-08-21T07:00:00'),
                    arrivalTime: dayjs('2024-08-21T09:15:00'),
                    elapsedTime: 75,
                }),
            ];

            renderWithTheme(
                <FlightItinerary segments={segments} getConnectionTime={defaultGetConnectionTime} />
            );

            expect(screen.getByText('Segment 1')).toBeInTheDocument();
            expect(screen.getByText('Segment 2')).toBeInTheDocument();
            expect(screen.getByText('Segment 3')).toBeInTheDocument();

            // Two connection times
            const connectionMessages = screen.getAllByText(/connection time in/);
            expect(connectionMessages).toHaveLength(2);
        });
    });
});
