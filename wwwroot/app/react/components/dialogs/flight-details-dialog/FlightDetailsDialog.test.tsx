/**
 * Tests for FlightDetailsDialog React component
 * Optimised: read-only tests consolidated to reduce render count.
 */

import React from 'react';
import {screen, within} from '@testing-library/react';
import {fireEvent} from '@testing-library/react';
import dayjs from 'dayjs';
import {FlightDetailsDialog} from './FlightDetailsDialog';
import {FlightData, FlightSegmentData} from './types';
import {renderWithMantine as renderWithTheme} from '../../../__testUtils__';

// Create a theme for testing
// Create sample single-segment flight
function createSingleSegmentFlight(overrides?: Partial<FlightData>): FlightData {
    return {
        airline: 'United Airlines',
        flightNumber: 'UA1234',
        departureTime: dayjs('2024-03-15T08:00:00'),
        arrivalTime: dayjs('2024-03-15T12:30:00'),
        departureAirport: 'SFO',
        arrivalAirport: 'JFK',
        departureTimeZone: 'America/Los_Angeles',
        arrivalTimeZone: 'America/New_York',
        duration: '05:30:00',
        stops: 0,
        aircraft: 'Boeing 737-800',
        elapsedTime: 330, // 5h 30m in minutes
        isMultiSegment: false,
        flightSegments: [],
        ...overrides,
    };
}

// Create sample multi-segment flight
function createMultiSegmentFlight(): FlightData {
    const segments: FlightSegmentData[] = [
        {
            segmentOrder: 0,
            carrierFsCode: 'UA',
            flightNumber: '1234',
            departureTime: dayjs('2024-03-15T08:00:00'),
            arrivalTime: dayjs('2024-03-15T10:30:00'),
            departureAirportFsCode: 'SFO',
            arrivalAirportFsCode: 'DEN',
            departureAirportName: 'San Francisco International',
            arrivalAirportName: 'Denver International',
            departureAirportCity: 'San Francisco',
            arrivalAirportCity: 'Denver',
            departureAirportCountry: 'United States',
            arrivalAirportCountry: 'United States',
            departureAirportTimeZone: 'America/Los_Angeles',
            arrivalAirportTimeZone: 'America/Denver',
            departureTerminal: '3',
            arrivalTerminal: 'B',
            elapsedTime: 150, // 2h 30m
            aircraftName: 'Boeing 737-800',
            airlineName: 'United Airlines',
            stopsInSegment: 0,
        },
        {
            segmentOrder: 1,
            carrierFsCode: 'UA',
            flightNumber: '5678',
            departureTime: dayjs('2024-03-15T12:00:00'),
            arrivalTime: dayjs('2024-03-15T17:00:00'),
            departureAirportFsCode: 'DEN',
            arrivalAirportFsCode: 'JFK',
            departureAirportName: 'Denver International',
            arrivalAirportName: 'John F. Kennedy International',
            departureAirportCity: 'Denver',
            arrivalAirportCity: 'New York',
            departureAirportCountry: 'United States',
            arrivalAirportCountry: 'United States',
            departureAirportTimeZone: 'America/Denver',
            arrivalAirportTimeZone: 'America/New_York',
            departureTerminal: 'B',
            arrivalTerminal: '7',
            elapsedTime: 240, // 4h
            aircraftName: 'Airbus A320',
            airlineName: 'United Airlines',
            stopsInSegment: 0,
        },
    ];

    return {
        airline: 'United Airlines',
        flightNumber: 'UA1234',
        departureTime: dayjs('2024-03-15T08:00:00'),
        arrivalTime: dayjs('2024-03-15T17:00:00'),
        departureAirport: 'SFO',
        arrivalAirport: 'JFK',
        departureTimeZone: 'America/Los_Angeles',
        arrivalTimeZone: 'America/New_York',
        duration: '09:00:00',
        stops: 1,
        aircraft: 'Boeing 737-800',
        elapsedTime: 540, // 9h in minutes (including layover)
        isMultiSegment: true,
        flightSegments: segments,
    };
}

describe('FlightDetailsDialog', () => {
    // ---------------------------------------------------------------
    // Single-segment flight rendering (1 render)
    // Covers: dialog title, flight number, airline name, departure date,
    //   airport codes, formatted duration, Flight Details Card sections,
    //   aircraft info, departure time, arrival time
    // ---------------------------------------------------------------
    it('renders all expected content for a single-segment flight', () => {
        const flight = createSingleSegmentFlight();
        renderWithTheme(
            <FlightDetailsDialog open={true} flight={flight} onClose={jest.fn()} />
        );

        // Dialog is present
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        // Rendering: dialog title, flight number, airline, departure date
        expect(screen.getByText('Flight Details')).toBeInTheDocument();
        expect(screen.getByText('UA 1234')).toBeInTheDocument();
        expect(screen.getByText('United Airlines')).toBeInTheDocument();
        expect(screen.getByText('Fri, Mar 15, 2024')).toBeInTheDocument();

        // Airport codes
        expect(screen.getAllByText('SFO').length).toBeGreaterThan(0);
        expect(screen.getAllByText('JFK').length).toBeGreaterThan(0);

        // Duration: formatted (elapsedTime = 330 => 5h 30m)
        expect(screen.getByText('5h 30m')).toBeInTheDocument();

        // Flight Details Card sections
        expect(screen.getByText('Flight Information')).toBeInTheDocument();
        expect(screen.getByText('Departure')).toBeInTheDocument();
        expect(screen.getByText('Arrival')).toBeInTheDocument();

        // Aircraft information
        expect(screen.getByText('Aircraft')).toBeInTheDocument();
        expect(screen.getByText('Boeing 737-800')).toBeInTheDocument();

        // Time display: departure and arrival in correct format
        const departureTimeElements = screen.getAllByText('08:00');
        expect(departureTimeElements.length).toBeGreaterThan(0);
        const arrivalTimeElements = screen.getAllByText('12:30');
        expect(arrivalTimeElements.length).toBeGreaterThan(0);
    });

    // ---------------------------------------------------------------
    // Single-segment negative tests (shared default flight)
    // Covers: renders nothing when not open, no tabs for single-segment,
    //   no Flight Itinerary for single-segment
    // ---------------------------------------------------------------
    it('does not render dialog, tabs, or itinerary for a single-segment flight when closed or irrelevant', () => {
        // Not-open case
        const flight = createSingleSegmentFlight();
        const {unmount} = renderWithTheme(
            <FlightDetailsDialog open={false} flight={flight} onClose={jest.fn()} />
        );
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        unmount();

        // Open but single-segment: no tabs, no itinerary
        renderWithTheme(
            <FlightDetailsDialog open={true} flight={flight} onClose={jest.fn()} />
        );
        expect(screen.queryByRole('tab', {name: /Overview/i})).not.toBeInTheDocument();
        expect(screen.queryByText('Flight Itinerary')).not.toBeInTheDocument();
    });

    // ---------------------------------------------------------------
    // Single-segment negative tests (different flight overrides)
    // Covers: Duration "N/A", Duration "parses duration string",
    //   "does not display aircraft"
    // ---------------------------------------------------------------
    it('handles missing elapsedTime and missing aircraft in single-segment flights', () => {
        // Duration N/A when both elapsedTime and duration are undefined
        const flightNA = createSingleSegmentFlight({elapsedTime: undefined, duration: undefined});
        const {unmount: unmount1} = renderWithTheme(
            <FlightDetailsDialog open={true} flight={flightNA} onClose={jest.fn()} />
        );
        expect(screen.getByText('N/A')).toBeInTheDocument();
        unmount1();

        // Duration parsed from duration string when elapsedTime is missing
        const flightParsed = createSingleSegmentFlight({elapsedTime: undefined, duration: '03:45:00'});
        const {unmount: unmount2} = renderWithTheme(
            <FlightDetailsDialog open={true} flight={flightParsed} onClose={jest.fn()} />
        );
        expect(screen.getByText('3h 45m')).toBeInTheDocument();
        unmount2();

        // Aircraft section hidden when aircraft is undefined
        const flightNoAircraft = createSingleSegmentFlight({aircraft: undefined});
        renderWithTheme(
            <FlightDetailsDialog open={true} flight={flightNoAircraft} onClose={jest.fn()} />
        );
        expect(screen.queryByText('Aircraft')).not.toBeInTheDocument();
    });

    // ---------------------------------------------------------------
    // Multi-segment flight rendering (1 render)
    // Covers: tab navigation, Overview selected by default,
    //   Flight Itinerary section, segment numbers, connection time,
    //   segment flight numbers, total duration, final destination,
    //   Terminal info
    // ---------------------------------------------------------------
    it('renders all expected content for a multi-segment flight in overview', () => {
        const flight = createMultiSegmentFlight();
        renderWithTheme(
            <FlightDetailsDialog open={true} flight={flight} onClose={jest.fn()} />
        );

        // Tab navigation present
        expect(screen.getByRole('tab', {name: /Overview/i})).toBeInTheDocument();
        expect(screen.getByRole('tab', {name: /Segment 1/i})).toBeInTheDocument();
        expect(screen.getByRole('tab', {name: /Segment 2/i})).toBeInTheDocument();

        // Overview tab selected by default
        const overviewTab = screen.getByRole('tab', {name: /Overview/i});
        expect(overviewTab).toHaveAttribute('aria-selected', 'true');

        // Flight Itinerary section
        expect(screen.getByText('Flight Itinerary')).toBeInTheDocument();

        // Segment numbers in itinerary (appear in both tabs and itinerary)
        const segment1Elements = screen.getAllByText('Segment 1');
        const segment2Elements = screen.getAllByText('Segment 2');
        expect(segment1Elements.length).toBeGreaterThan(0);
        expect(segment2Elements.length).toBeGreaterThan(0);

        // Connection time: 1h 30m (10:30 arrival -> 12:00 departure)
        expect(screen.getByText(/1h 30m connection time in DEN/)).toBeInTheDocument();

        // Segment flight numbers in itinerary
        expect(screen.getByText('UA1234')).toBeInTheDocument();
        expect(screen.getByText('UA5678')).toBeInTheDocument();

        // Total duration: 540 min = 9h 00m
        expect(screen.getByText('9h 00m')).toBeInTheDocument();

        // Final destination JFK
        const jfkElements = screen.getAllByText('JFK');
        expect(jfkElements.length).toBeGreaterThan(0);

        // Terminal information
        const terminal3Elements = screen.getAllByText('Terminal 3');
        expect(terminal3Elements.length).toBeGreaterThan(0);
    });

    // ---------------------------------------------------------------
    // Multi-segment interactions
    // ---------------------------------------------------------------
    it('switches to segment view when segment tab is clicked', () => {
        const flight = createMultiSegmentFlight();
        renderWithTheme(
            <FlightDetailsDialog open={true} flight={flight} onClose={jest.fn()} />
        );

        // Click on Segment 1 tab
        fireEvent.click(screen.getByRole('tab', {name: /Segment 1/i}));

        // Should show segment 1 as selected
        const segment1Tab = screen.getByRole('tab', {name: /Segment 1/i});
        expect(segment1Tab).toHaveAttribute('aria-selected', 'true');
    });

    it('shows segment-specific data when segment tab is selected', () => {
        const flight = createMultiSegmentFlight();
        renderWithTheme(
            <FlightDetailsDialog open={true} flight={flight} onClose={jest.fn()} />
        );

        // Click on Segment 2 tab
        fireEvent.click(screen.getByRole('tab', {name: /Segment 2/i}));

        // Segment 2 duration: 4h 00m = 240 minutes
        expect(screen.getByText('4h 00m')).toBeInTheDocument();
    });

    // ---------------------------------------------------------------
    // Dialog Actions
    // ---------------------------------------------------------------
    it('calls onClose when close button is clicked', () => {
        const onClose = jest.fn();
        const flight = createSingleSegmentFlight();
        renderWithTheme(
            <FlightDetailsDialog open={true} flight={flight} onClose={onClose} />
        );

        // Find and click the close button
        fireEvent.click(screen.getByRole('button'));

        expect(onClose).toHaveBeenCalled();
    });
});
