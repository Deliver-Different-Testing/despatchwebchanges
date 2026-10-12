/**
 * Flight Details Dialog Types
 *
 * Types for the React flight details dialog component.
 */

import { Dayjs } from 'dayjs';

// Re-export types from nationwide interfaces for convenience
export type { IFlightViewModel, IFlightSegment } from '../../../../interfaces/nationwideFlight.interfaces';

/**
 * Props for the main FlightDetailsDialog component
 */
export interface FlightDetailsDialogProps {
    open: boolean;
    flight: FlightData;
    onClose: () => void;
}

/**
 * Flight data structure matching IFlightViewModel
 */
export interface FlightData {
    airline: string;
    flightNumber: string;
    departureTime: Dayjs;
    arrivalTime: Dayjs;
    departureAirport: string;
    arrivalAirport: string;
    departureTimeZone: string;
    arrivalTimeZone: string;
    duration?: string;
    stops: number;
    aircraft?: string;
    elapsedTime?: number;
    isMultiSegment: boolean;
    flightSegments?: FlightSegmentData[];
}

/**
 * Flight segment data structure matching IFlightSegment
 */
export interface FlightSegmentData {
    segmentOrder: number;
    carrierFsCode: string;
    flightNumber: string;
    departureTime: Dayjs;
    arrivalTime: Dayjs;
    departureAirportFsCode: string;
    arrivalAirportFsCode: string;
    departureAirportName?: string;
    arrivalAirportName?: string;
    departureAirportCity?: string;
    arrivalAirportCity?: string;
    departureAirportCountry?: string;
    arrivalAirportCountry?: string;
    departureAirportTimeZone: string;
    arrivalAirportTimeZone: string;
    departureTerminal?: string;
    arrivalTerminal?: string;
    elapsedTime: number;
    flightEquipmentIataCode?: string;
    aircraftName?: string;
    aircraftType?: string;
    airlineName?: string;
    stopsInSegment: number;
}

/**
 * Props for the FlightSummaryCard component
 */
export interface FlightSummaryCardProps {
    segment: FlightSegmentData;
    flight: FlightData;
    duration: string;
    isOverview: boolean;
}

/**
 * Props for the FlightDetailsCard component
 */
export interface FlightDetailsCardProps {
    segment: FlightSegmentData;
    flight: FlightData;
    isOverview: boolean;
}

/**
 * Props for the FlightItinerary component
 */
export interface FlightItineraryProps {
    segments: FlightSegmentData[];
    getConnectionTime: (first: FlightSegmentData, second: FlightSegmentData) => string;
}
