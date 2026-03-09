/**
 * Tests for FlightDetailsDialog React component
 */

import React from 'react';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createTheme, ThemeProvider} from '@mui/material';
import dayjs from 'dayjs';
import {FlightDetailsDialog} from './FlightDetailsDialog';
import {FlightData, FlightSegmentData} from './types';

// Create a theme for testing
const theme = createTheme();

// Helper to render component with theme
function renderWithTheme(ui: React.ReactElement) {
    return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

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
    describe('Rendering', () => {
        it('renders nothing when not open', () => {
            const flight = createSingleSegmentFlight();
            const { container } = renderWithTheme(
                <FlightDetailsDialog open={false} flight={flight} onClose={jest.fn()} />
            );
            expect(container.querySelector('.MuiDialog-root')).toBeNull();
        });

        it('renders the dialog when open', () => {
            const flight = createSingleSegmentFlight();
            renderWithTheme(
                <FlightDetailsDialog open={true} flight={flight} onClose={jest.fn()} />
            );
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it.each([
            ['dialog title', 'Flight Details'],
            ['flight number', 'UA 1234'],
            ['airline name', 'United Airlines'],
            ['departure date', 'Fri, Mar 15, 2024'],
        ])('displays %s', (_, expectedText) => {
            const flight = createSingleSegmentFlight();
            renderWithTheme(
                <FlightDetailsDialog open={true} flight={flight} onClose={jest.fn()} />
            );
            expect(screen.getByText(expectedText)).toBeInTheDocument();
        });

        it('displays departure and arrival airport codes', () => {
            const flight = createSingleSegmentFlight();
            renderWithTheme(
                <FlightDetailsDialog open={true} flight={flight} onClose={jest.fn()} />
            );
            expect(screen.getAllByText('SFO').length).toBeGreaterThan(0);
            expect(screen.getAllByText('JFK').length).toBeGreaterThan(0);
        });
    });

    describe('Duration Display', () => {
        it('displays formatted duration for single-segment flight', () => {
            const flight = createSingleSegmentFlight({ elapsedTime: 330 }); // 5h 30m
            renderWithTheme(
                <FlightDetailsDialog open={true} flight={flight} onClose={jest.fn()} />
            );
            expect(screen.getByText('5h 30m')).toBeInTheDocument();
        });

        it('displays N/A when duration is not available', () => {
            const flight = createSingleSegmentFlight({ elapsedTime: undefined, duration: undefined });
            renderWithTheme(
                <FlightDetailsDialog open={true} flight={flight} onClose={jest.fn()} />
            );
            expect(screen.getByText('N/A')).toBeInTheDocument();
        });

        it('parses duration string when elapsedTime not available', () => {
            const flight = createSingleSegmentFlight({ elapsedTime: undefined, duration: '03:45:00' });
            renderWithTheme(
                <FlightDetailsDialog open={true} flight={flight} onClose={jest.fn()} />
            );
            expect(screen.getByText('3h 45m')).toBeInTheDocument();
        });
    });

    describe('Flight Details Card', () => {
        it.each([
            'Flight Information',
            'Departure',
            'Arrival',
        ])('displays %s section', (sectionTitle) => {
            const flight = createSingleSegmentFlight();
            renderWithTheme(
                <FlightDetailsDialog open={true} flight={flight} onClose={jest.fn()} />
            );
            expect(screen.getByText(sectionTitle)).toBeInTheDocument();
        });

        it('displays aircraft information when available', () => {
            const flight = createSingleSegmentFlight({ aircraft: 'Boeing 737-800' });
            renderWithTheme(
                <FlightDetailsDialog open={true} flight={flight} onClose={jest.fn()} />
            );
            expect(screen.getByText('Aircraft')).toBeInTheDocument();
            expect(screen.getByText('Boeing 737-800')).toBeInTheDocument();
        });

        it('does not display aircraft section when not available', () => {
            const flight = createSingleSegmentFlight({ aircraft: undefined });
            renderWithTheme(
                <FlightDetailsDialog open={true} flight={flight} onClose={jest.fn()} />
            );
            expect(screen.queryByText('Aircraft')).not.toBeInTheDocument();
        });
    });

    describe('Multi-segment Flight Tabs', () => {
        it('displays tab navigation for multi-segment flights', () => {
            const flight = createMultiSegmentFlight();
            renderWithTheme(
                <FlightDetailsDialog open={true} flight={flight} onClose={jest.fn()} />
            );
            expect(screen.getByRole('tab', { name: /Overview/i })).toBeInTheDocument();
            expect(screen.getByRole('tab', { name: /Segment 1/i })).toBeInTheDocument();
            expect(screen.getByRole('tab', { name: /Segment 2/i })).toBeInTheDocument();
        });

        it('does not display tabs for single-segment flights', () => {
            const flight = createSingleSegmentFlight();
            renderWithTheme(
                <FlightDetailsDialog open={true} flight={flight} onClose={jest.fn()} />
            );
            expect(screen.queryByRole('tab', { name: /Overview/i })).not.toBeInTheDocument();
        });

        it('shows Overview tab selected by default', () => {
            const flight = createMultiSegmentFlight();
            renderWithTheme(
                <FlightDetailsDialog open={true} flight={flight} onClose={jest.fn()} />
            );
            const overviewTab = screen.getByRole('tab', { name: /Overview/i });
            expect(overviewTab).toHaveAttribute('aria-selected', 'true');
        });

        it('switches to segment view when segment tab is clicked', async () => {
            const user = userEvent.setup();
            const flight = createMultiSegmentFlight();
            renderWithTheme(
                <FlightDetailsDialog open={true} flight={flight} onClose={jest.fn()} />
            );

            // Click on Segment 1 tab
            await user.click(screen.getByRole('tab', { name: /Segment 1/i }));

            // Should show segment 1 as selected
            await waitFor(() => {
                const segment1Tab = screen.getByRole('tab', { name: /Segment 1/i });
                expect(segment1Tab).toHaveAttribute('aria-selected', 'true');
            });
        });
    });

    describe('Flight Itinerary', () => {
        it('displays Flight Itinerary section for multi-segment flights in overview', () => {
            const flight = createMultiSegmentFlight();
            renderWithTheme(
                <FlightDetailsDialog open={true} flight={flight} onClose={jest.fn()} />
            );
            expect(screen.getByText('Flight Itinerary')).toBeInTheDocument();
        });

        it('does not display Flight Itinerary for single-segment flights', () => {
            const flight = createSingleSegmentFlight();
            renderWithTheme(
                <FlightDetailsDialog open={true} flight={flight} onClose={jest.fn()} />
            );
            expect(screen.queryByText('Flight Itinerary')).not.toBeInTheDocument();
        });

        it('displays segment numbers in itinerary', () => {
            const flight = createMultiSegmentFlight();
            renderWithTheme(
                <FlightDetailsDialog open={true} flight={flight} onClose={jest.fn()} />
            );
            // Segment labels appear in both tabs and itinerary
            const segment1Elements = screen.getAllByText('Segment 1');
            const segment2Elements = screen.getAllByText('Segment 2');
            expect(segment1Elements.length).toBeGreaterThan(0);
            expect(segment2Elements.length).toBeGreaterThan(0);
        });

        it('displays connection time between segments', () => {
            const flight = createMultiSegmentFlight();
            renderWithTheme(
                <FlightDetailsDialog open={true} flight={flight} onClose={jest.fn()} />
            );
            // 1h 30m connection time (10:30 arrival, 12:00 departure)
            expect(screen.getByText(/1h 30m connection time in DEN/)).toBeInTheDocument();
        });

        it('displays segment flight numbers in itinerary', () => {
            const flight = createMultiSegmentFlight();
            renderWithTheme(
                <FlightDetailsDialog open={true} flight={flight} onClose={jest.fn()} />
            );
            expect(screen.getByText('UA1234')).toBeInTheDocument();
            expect(screen.getByText('UA5678')).toBeInTheDocument();
        });
    });

    describe('Dialog Actions', () => {
        it('calls onClose when close button is clicked', async () => {
            const user = userEvent.setup();
            const onClose = jest.fn();
            const flight = createSingleSegmentFlight();
            renderWithTheme(
                <FlightDetailsDialog open={true} flight={flight} onClose={onClose} />
            );

            // Find and click the close button
            const closeButton = screen.getByRole('button');
            await user.click(closeButton);

            expect(onClose).toHaveBeenCalled();
        });
    });

    describe('Overview vs Segment View', () => {
        it('shows total duration in overview', () => {
            const flight = createMultiSegmentFlight();
            renderWithTheme(
                <FlightDetailsDialog open={true} flight={flight} onClose={jest.fn()} />
            );
            // Total elapsed time is 540 minutes = 9h 00m
            expect(screen.getByText('9h 00m')).toBeInTheDocument();
        });

        it('shows final destination in overview for multi-segment', () => {
            const flight = createMultiSegmentFlight();
            renderWithTheme(
                <FlightDetailsDialog open={true} flight={flight} onClose={jest.fn()} />
            );
            // Final destination should be JFK
            const jfkElements = screen.getAllByText('JFK');
            expect(jfkElements.length).toBeGreaterThan(0);
        });

        it('shows segment-specific data when segment tab is selected', async () => {
            const user = userEvent.setup();
            const flight = createMultiSegmentFlight();
            renderWithTheme(
                <FlightDetailsDialog open={true} flight={flight} onClose={jest.fn()} />
            );

            // Click on Segment 2 tab
            await user.click(screen.getByRole('tab', { name: /Segment 2/i }));

            // Wait for segment 2 duration (4h 00m = 240 minutes)
            expect(await screen.findByText('4h 00m')).toBeInTheDocument();
        });
    });

    describe('Terminal Information', () => {
        it('displays terminal information when available', () => {
            const flight = createMultiSegmentFlight();
            renderWithTheme(
                <FlightDetailsDialog open={true} flight={flight} onClose={jest.fn()} />
            );
            // Segment 1 has Terminal 3 for departure - appears in multiple places
            const terminal3Elements = screen.getAllByText('Terminal 3');
            expect(terminal3Elements.length).toBeGreaterThan(0);
        });
    });

    describe('Time Display', () => {
        it('displays departure time in correct format', () => {
            const flight = createSingleSegmentFlight();
            renderWithTheme(
                <FlightDetailsDialog open={true} flight={flight} onClose={jest.fn()} />
            );
            // Time appears in multiple places (summary card and details card)
            const departureTimeElements = screen.getAllByText('08:00');
            expect(departureTimeElements.length).toBeGreaterThan(0);
        });

        it('displays arrival time in correct format', () => {
            const flight = createSingleSegmentFlight();
            renderWithTheme(
                <FlightDetailsDialog open={true} flight={flight} onClose={jest.fn()} />
            );
            // Time appears in multiple places (summary card and details card)
            const arrivalTimeElements = screen.getAllByText('12:30');
            expect(arrivalTimeElements.length).toBeGreaterThan(0);
        });
    });
});
