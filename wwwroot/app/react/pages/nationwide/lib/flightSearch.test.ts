/** @jest-environment node */
/**
 * Extracted from `NationwideControl.loadFlights` (1135) and
 * `loadNextDayFlights`. The guard order and the departure-date priority chain
 * are the load-bearing parts.
 */

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {
    MINIMUM_LAYOVER_MINUTES,
    flightSearchErrorMessage,
    flightSearchGuard,
    flightResultMessage,
    nextDayDeparture,
    resolveDepartureDate,
} from './flightSearch';

dayjs.extend(utc);
dayjs.extend(timezone);

const PAGE_TZ = 'Pacific/Auckland';

describe('flightSearchGuard', () => {
    const airports = {outbound: {id: 1}, inbound: {id: 2}};

    it('asks for a job when none is selected', () => {
        expect(flightSearchGuard({job: undefined, airports, loading: false})).toEqual({
            action: 'block',
            clearFlights: true,
            message: 'Please select a job to view flight options',
        });
    });

    it('does nothing when the job already has a flight', () => {
        // V1 returned early without clearing or messaging: the assigned-flight
        // message comes from the UI-state derivation instead.
        expect(flightSearchGuard({job: {assignedFlight: {}}, airports, loading: false}))
            .toEqual({action: 'skip'});
    });

    it('does nothing while a search is already in flight', () => {
        expect(flightSearchGuard({job: {}, airports, loading: true})).toEqual({action: 'skip'});
    });

    it('asks for both airports when either is missing', () => {
        const expected = {
            action: 'block',
            clearFlights: true,
            message: 'Please select both outbound and inbound airports to search for flights',
        };

        expect(flightSearchGuard({job: {}, airports: {outbound: {id: 1}}, loading: false}))
            .toEqual(expected);
        expect(flightSearchGuard({job: {}, airports: {inbound: {id: 2}}, loading: false}))
            .toEqual(expected);
        expect(flightSearchGuard({job: {}, airports: {}, loading: false})).toEqual(expected);
    });

    it('proceeds when a job, both airports and no in-flight search line up', () => {
        expect(flightSearchGuard({job: {}, airports, loading: false})).toEqual({action: 'search'});
    });

    it('checks the assigned flight before the airports', () => {
        // An assigned flight wins even with no airports picked, so the operator
        // is not told to choose airports for a job that is already flown.
        expect(flightSearchGuard({job: {assignedFlight: {}}, airports: {}, loading: false}))
            .toEqual({action: 'skip'});
    });
});

describe('resolveDepartureDate', () => {
    it('prefers the paging cursor from the previous result', () => {
        const cursor = dayjs('2026-03-20T06:00:00');
        const resolved = resolveDepartureDate({
            lastDepartureTime: cursor,
            booked: dayjs('2026-03-01T00:00:00'),
            jobTimeZone: PAGE_TZ,
            pageTimeZone: PAGE_TZ,
        });

        expect(resolved.valueOf()).toBe(cursor.valueOf());
    });

    it('falls back to the job booked time', () => {
        const booked = dayjs('2026-03-01T09:30:00');
        const resolved = resolveDepartureDate({
            booked,
            jobTimeZone: PAGE_TZ,
            pageTimeZone: PAGE_TZ,
        });

        expect(resolved.valueOf()).toBe(booked.valueOf());
    });

    it('falls back to now in the job timezone when there is no booked time', () => {
        const resolved = resolveDepartureDate({
            jobTimeZone: PAGE_TZ,
            pageTimeZone: 'America/New_York',
        });

        expect(Math.abs(resolved.diff(dayjs(), 'minutes'))).toBeLessThan(2);
    });

    it('falls back to now in the page timezone when the job has none', () => {
        const resolved = resolveDepartureDate({pageTimeZone: PAGE_TZ});
        expect(Math.abs(resolved.diff(dayjs(), 'minutes'))).toBeLessThan(2);
    });
});

describe('nextDayDeparture', () => {
    it('advances the paging cursor by a day and snaps to midnight', () => {
        const result = nextDayDeparture(dayjs('2026-03-20T14:45:00'), dayjs('2026-03-01T00:00:00'));

        expect(result.format('YYYY-MM-DD HH:mm')).toBe('2026-03-21 00:00');
    });

    it('advances the booked time when there is no cursor yet', () => {
        const result = nextDayDeparture(undefined, dayjs('2026-03-01T09:30:00'));

        expect(result.format('YYYY-MM-DD HH:mm')).toBe('2026-03-02 00:00');
    });
});

describe('flightResultMessage', () => {
    it('passes a server message straight through', () => {
        expect(flightResultMessage({flights: [], message: 'Bad airport code'}))
            .toBe('Bad airport code');
    });

    it('reports no flights when the search came back empty', () => {
        expect(flightResultMessage({flights: []}))
            .toBe('No flights available for the selected criteria');
    });

    it('has no message when flights were found', () => {
        expect(flightResultMessage({flights: [{}] as never[]})).toBeUndefined();
    });

    it('prefers the server message even when flights came back', () => {
        expect(flightResultMessage({flights: [{}] as never[], message: 'Partial results'}))
            .toBe('Partial results');
    });
});

describe('flightSearchErrorMessage', () => {
    it('surfaces the server detail when there is one', () => {
        expect(flightSearchErrorMessage({data: 'Bad airport code'}))
            .toBe('Flight search failed: Bad airport code');
    });

    it('falls back to the error message', () => {
        expect(flightSearchErrorMessage(new Error('Network down')))
            .toBe('Flight search failed: Network down');
    });

    it('uses a generic message when the error carries no detail', () => {
        expect(flightSearchErrorMessage({}))
            .toBe('An error occurred while loading flights. Please try again.');
        expect(flightSearchErrorMessage(undefined))
            .toBe('An error occurred while loading flights. Please try again.');
    });
});

describe('MINIMUM_LAYOVER_MINUTES', () => {
    it('is 60, as hard-coded in V1', () => {
        expect(MINIMUM_LAYOVER_MINUTES).toBe(60);
    });
});
