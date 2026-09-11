/**
 * Flight display helpers for the Nationwide page.
 *
 * Framework-free on purpose: the AngularJS controller
 * (`components/Nationwide/nationwide.controller.ts`) delegates to these, and the
 * React page uses the same functions, so the two cannot drift apart while both
 * exist. Extracted from `formatAirportCodeForDropdown` (1817),
 * `getConnectionTime` (1825), `formatMinutesToTimeReact` (2034) and
 * `filterFlights` (2211).
 */

import dayjs from 'dayjs';
import type {ConfigType} from 'dayjs';

/**
 * Only the fields these helpers read, declared structurally rather than
 * imported.
 *
 * The AngularJS flight types live in `components/Nationwide/nationwide.interfaces.ts`,
 * which Phase 3 deletes, and the React ones in `react/interfaces/nationwideJobs.ts`.
 * A shared module must not depend on either, and both satisfy these shapes.
 */
export interface FlightSegmentTimes {
    departureTime: ConfigType;
    arrivalTime: ConfigType;
}

export interface FlightSearchFields {
    flightNumber?: string;
    airline?: string;
    departureAirport?: string;
    arrivalAirport?: string;
    aircraft?: string;
}

/**
 * Minutes as `"2h 05m"`, or `"45m"` under an hour.
 *
 * V1 carried this twice — in `getConnectionTime` and `formatMinutesToTimeReact`
 * — with the same single-digit zero-padding. One implementation now.
 */
export function formatMinutesAsDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
        return `${hours}h ${mins < 10 ? `0${mins}` : mins}m`;
    }
    return `${mins}m`;
}

/**
 * Layover between two flight segments — the second's departure less the
 * first's arrival.
 */
export function getConnectionTime<T extends FlightSegmentTimes>(
    firstSegment: T,
    secondSegment: T,
): string {
    if (!firstSegment || !secondSegment) return '';

    const firstArrival = dayjs(firstSegment.arrivalTime);
    const secondDeparture = dayjs(secondSegment.departureTime);

    return formatMinutesAsDuration(secondDeparture.diff(firstArrival, 'minutes'));
}

/**
 * The bare airport code from a `"AKL Auckland International"` label.
 *
 * Keeps the trailing space, matching V1 (`substring(0, spaceIndex + 1)`).
 */
export function formatAirportCodeForDropdown(text: string): string {
    if (!text) return '';

    const spaceIndex = text.indexOf(' ');
    if (spaceIndex === -1) return text;
    return text.substring(0, spaceIndex + 1);
}

/**
 * Client-side flight search across number, airline, both airports and aircraft.
 *
 * Returns the input array unchanged when there is nothing to filter by, so
 * callers can rely on referential equality to skip re-renders.
 */
export function filterFlights<T extends FlightSearchFields>(
    flights: T[] | undefined,
    searchText: string | undefined,
): T[] {
    if (!flights) return [];

    if (!searchText || searchText.trim() === '') return flights;

    const term = searchText.toLowerCase().trim();

    return flights.filter(flight =>
        flight.flightNumber?.toLowerCase().includes(term) ||
        flight.airline?.toLowerCase().includes(term) ||
        flight.departureAirport?.toLowerCase().includes(term) ||
        flight.arrivalAirport?.toLowerCase().includes(term) ||
        flight.aircraft?.toLowerCase().includes(term),
    );
}
