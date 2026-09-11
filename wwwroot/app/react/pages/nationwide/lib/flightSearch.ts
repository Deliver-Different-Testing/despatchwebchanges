/**
 * Decision logic for the Nationwide flight search.
 *
 * The IO lives in the caller; everything here is pure, so the AngularJS
 * controller and the React page agree on when a search may run, which date it
 * starts from, and what the operator is told. Extracted from
 * `NationwideControl.loadFlights` (1135) and `loadNextDayFlights`.
 */

import dayjs, {Dayjs} from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

/** Hard-coded in V1's `loadFlights`; connections shorter than this are excluded. */
export const MINIMUM_LAYOVER_MINUTES = 60;

export const NO_JOB_MESSAGE = 'Please select a job to view flight options';
export const NO_AIRPORTS_MESSAGE =
    'Please select both outbound and inbound airports to search for flights';
export const NO_FLIGHTS_MESSAGE = 'No flights available for the selected criteria';
export const GENERIC_ERROR_MESSAGE =
    'An error occurred while loading flights. Please try again.';

export interface FlightSearchGuardInput {
    job?: {assignedFlight?: unknown} | undefined;
    airports: {outbound?: {id: number} | unknown; inbound?: {id: number} | unknown};
    loading: boolean;
}

export type FlightSearchGuardResult =
    /** Run the search. */
    | {action: 'search'}
    /** Do nothing at all — no message, no state change. */
    | {action: 'skip'}
    /** Stop and tell the operator why. */
    | {action: 'block'; clearFlights: true; message: string};

/**
 * Whether a flight search may run, in V1's order.
 *
 * The assigned-flight check deliberately precedes the airport check, so a job
 * that is already flown never asks the operator to pick airports. `skip` is
 * distinct from `block`: V1 returned early without clearing the list or setting
 * a message, leaving the assigned-flight case to the UI-state derivation.
 */
export function flightSearchGuard(input: FlightSearchGuardInput): FlightSearchGuardResult {
    if (!input.job) {
        return {action: 'block', clearFlights: true, message: NO_JOB_MESSAGE};
    }

    if (input.job.assignedFlight) return {action: 'skip'};

    if (input.loading) return {action: 'skip'};

    if (!input.airports.outbound || !input.airports.inbound) {
        return {action: 'block', clearFlights: true, message: NO_AIRPORTS_MESSAGE};
    }

    return {action: 'search'};
}

export interface DepartureDateInput {
    /** Paging cursor returned by the previous search. */
    lastDepartureTime?: Dayjs;
    booked?: Dayjs;
    /** The job's pickup timezone, when it has one. */
    jobTimeZone?: string;
    /** The page's timezone, used as the last resort. */
    pageTimeZone?: string;
}

/**
 * Which instant a search starts from.
 *
 * Priority, from V1: the previous result's cursor, then the job's booked time,
 * then now in the job's timezone, then now in the page's.
 */
export function resolveDepartureDate(input: DepartureDateInput): Dayjs {
    if (input.lastDepartureTime) return dayjs(input.lastDepartureTime);
    if (input.booked) return dayjs(input.booked);
    if (input.jobTimeZone) return dayjs().tz(input.jobTimeZone);
    if (input.pageTimeZone) return dayjs().tz(input.pageTimeZone);
    return dayjs();
}

/**
 * The cursor for "next day" paging: a day on from wherever the last search
 * reached, snapped to midnight.
 */
export function nextDayDeparture(lastDepartureTime: Dayjs | undefined, booked: Dayjs): Dayjs {
    return (lastDepartureTime ?? booked).add(1, 'day').startOf('day');
}

/** What to tell the operator about a successful search. */
export function flightResultMessage(
    result: {flights: unknown[]; message?: string},
): string | undefined {
    if (result.message) return result.message;
    return result.flights.length === 0 ? NO_FLIGHTS_MESSAGE : undefined;
}

/**
 * What to tell the operator about a failed search.
 *
 * Prefers the server's own detail (`error.data` from the AngularJS `$http`
 * shape, `error.message` otherwise) so a real cause is not hidden behind a
 * generic string.
 */
export function flightSearchErrorMessage(error: unknown): string {
    const detail =
        (error as {data?: string} | undefined)?.data ??
        (error as {message?: string} | undefined)?.message;

    return detail ? `Flight search failed: ${detail}` : GENERIC_ERROR_MESSAGE;
}
