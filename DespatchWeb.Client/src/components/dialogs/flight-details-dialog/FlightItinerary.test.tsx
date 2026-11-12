/**
 * Tests for FlightItinerary component
 */

import React from 'react';
import { screen } from '@testing-library/react';
import dayjs from 'dayjs';
import { FlightItinerary } from './FlightItinerary';
import { FlightSegmentData } from './types';
import {renderWithMantine as renderWithTheme} from '../../../test/utils';

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

function renderItinerary(
    segments: FlightSegmentData[],
    getConnectionTime: (first: FlightSegmentData, second: FlightSegmentData) => string = defaultGetConnectionTime
) {
    return renderWithTheme(<FlightItinerary segments={segments} getConnectionTime={getConnectionTime} />);
}

describe('FlightItinerary', () => {
    describe('Null/Empty Rendering', () => {
        /*
         * Not container.firstChild: MantineProvider injects a <style> element, so
         * the container is never empty. Assert the card itself is absent.
         */
        it.each([
            ['segments array is empty', []],
            ['segments is undefined', undefined as unknown as FlightSegmentData[]],
        ])('renders nothing when %s', (_label, segments) => {
            renderItinerary(segments);
            expect(screen.queryByText('Flight itinerary')).not.toBeInTheDocument();
        });
    });

    it('displays "Flight itinerary" title', () => {
        renderItinerary([createSegment()]);
        expect(screen.getByText('Flight itinerary')).toBeInTheDocument();
    });

    describe('Two-segment display and connection time', () => {
        beforeEach(() => {
            renderItinerary(createTwoSegments());
        });

        it('displays segment numbers (1-indexed) and flight numbers', () => {
            expect(screen.getByText('Segment 1')).toBeInTheDocument();
            expect(screen.getByText('Segment 2')).toBeInTheDocument();
            expect(screen.getByText('DL400')).toBeInTheDocument();
            expect(screen.getByText('DL800')).toBeInTheDocument();
        });

        it('displays airport codes, times and names for each segment', () => {
            expect(screen.getByText('ATL')).toBeInTheDocument();
            // DTW appears as both arrival of seg 1 and departure of seg 2
            expect(screen.getAllByText('DTW').length).toBe(2);
            expect(screen.getByText('SEA')).toBeInTheDocument();
            expect(screen.getByText('06:00')).toBeInTheDocument();
            expect(screen.getByText('09:30')).toBeInTheDocument();
            expect(screen.getByText('11:00')).toBeInTheDocument();
            expect(screen.getByText('14:00')).toBeInTheDocument();
            expect(screen.getByText('Hartsfield-Jackson Atlanta International')).toBeInTheDocument();
            expect(screen.getByText('Seattle-Tacoma International')).toBeInTheDocument();
        });

        it('displays one connection time between segments, none after the last', () => {
            // Connection: 09:30 -> 11:00 = 1h 30m
            expect(screen.getByText(/1h 30m connection time in DTW/)).toBeInTheDocument();
            expect(screen.getAllByText(/connection time in/)).toHaveLength(1);
        });
    });

    describe('Duration Display (formatDuration)', () => {
        it.each([
            [130, '2h 10m'],
            [0, 'N/A'],
            [45, '45m'],
            [65, '1h 05m'],
            [120, '2h 00m'],
        ])('formats elapsed time %i as %s', (elapsedTime, expected) => {
            renderItinerary([createSegment({ elapsedTime })]);
            expect(screen.getByText(expected)).toBeInTheDocument();
        });
    });

    describe('Connection Time callback', () => {
        it('calls getConnectionTime with correct segment pairs', () => {
            const segments = createTwoSegments();
            const mockGetConnectionTime = vi.fn().mockReturnValue('2h 00m');

            renderItinerary(segments, mockGetConnectionTime);

            expect(mockGetConnectionTime).toHaveBeenCalledTimes(1);
            expect(mockGetConnectionTime).toHaveBeenCalledWith(segments[0], segments[1]);
        });

        it('does not call getConnectionTime for single segment', () => {
            const mockGetConnectionTime = vi.fn();

            renderItinerary([createSegment()], mockGetConnectionTime);

            expect(mockGetConnectionTime).not.toHaveBeenCalled();
        });
    });

    describe('Terminal Information', () => {
        it.each([
            ['departure', { departureTerminal: 'A' }, 'Terminal A'],
            ['arrival', { arrivalTerminal: 'B' }, 'Terminal B'],
        ])('displays %s terminal when available', (_label, overrides, expected) => {
            renderItinerary([createSegment(overrides)]);
            expect(screen.getByText(expected)).toBeInTheDocument();
        });

        it('hides terminal badges when terminals are not available', () => {
            renderItinerary([createSegment({ departureTerminal: undefined, arrivalTerminal: undefined })]);
            expect(screen.queryByText(/^Terminal/)).not.toBeInTheDocument();
        });
    });

    describe('Aircraft Information', () => {
        it('displays aircraft name when available', () => {
            renderItinerary([createSegment({ aircraftName: 'Boeing 757-200' })]);
            expect(screen.getByText('Boeing 757-200')).toBeInTheDocument();
        });

        it('falls back to IATA equipment code when aircraft name is missing', () => {
            renderItinerary([createSegment({ aircraftName: undefined, flightEquipmentIataCode: '752' })]);
            expect(screen.getByText('752')).toBeInTheDocument();
        });

        it('hides aircraft badge when neither name nor IATA code is available', () => {
            renderItinerary([createSegment({ aircraftName: undefined, flightEquipmentIataCode: undefined })]);
            expect(screen.queryByText('Boeing 757-200')).not.toBeInTheDocument();
            expect(screen.queryByText('752')).not.toBeInTheDocument();
        });
    });

    describe('Three-Segment Flight', () => {
        it('renders all three segments with two connection times', () => {
            const leg = (
                segmentOrder: number,
                flightNumber: string,
                from: string,
                to: string,
                dep: string,
                arr: string,
                elapsedTime: number
            ) =>
                createSegment({
                    segmentOrder,
                    flightNumber,
                    departureAirportFsCode: from,
                    arrivalAirportFsCode: to,
                    departureTime: dayjs(dep),
                    arrivalTime: dayjs(arr),
                    elapsedTime,
                });

            renderItinerary([
                leg(0, '100', 'ATL', 'JFK', '2024-08-20T06:00:00', '2024-08-20T08:30:00', 150),
                leg(1, '200', 'JFK', 'LHR', '2024-08-20T10:00:00', '2024-08-20T22:00:00', 420),
                leg(2, '300', 'LHR', 'CDG', '2024-08-21T07:00:00', '2024-08-21T09:15:00', 75),
            ]);

            expect(screen.getByText('Segment 1')).toBeInTheDocument();
            expect(screen.getByText('Segment 2')).toBeInTheDocument();
            expect(screen.getByText('Segment 3')).toBeInTheDocument();
            expect(screen.getAllByText(/connection time in/)).toHaveLength(2);
        });
    });
});
