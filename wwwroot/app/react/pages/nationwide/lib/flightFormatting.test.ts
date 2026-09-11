/** @jest-environment node */
/**
 * Extracted from `NationwideControl` so the AngularJS page and the React page
 * share one implementation. The AngularJS controller delegates to these, and
 * its existing suites in `components/Nationwide/__tests__/` remain the parity
 * check on the extraction.
 */

import dayjs from 'dayjs';
import {
    filterFlights,
    formatAirportCodeForDropdown,
    formatMinutesAsDuration,
    getConnectionTime,
} from './flightFormatting';

describe('formatMinutesAsDuration', () => {
    // V1 had this logic twice -- `getConnectionTime` (1825) and
    // `formatMinutesToTimeReact` (2034) -- with identical zero-padding.
    it.each([
        [0, '0m'],
        [5, '5m'],
        [59, '59m'],
        [60, '1h 00m'],
        [65, '1h 05m'],
        [70, '1h 10m'],
        [125, '2h 05m'],
        [600, '10h 00m'],
    ])('formats %i minutes as %s', (minutes, expected) => {
        expect(formatMinutesAsDuration(minutes)).toBe(expected);
    });

    it('pads single-digit minutes but not double-digit ones', () => {
        expect(formatMinutesAsDuration(61)).toBe('1h 01m');
        expect(formatMinutesAsDuration(75)).toBe('1h 15m');
    });
});

describe('getConnectionTime', () => {
    const segment = (arrival: string, departure: string) => ({
        arrivalTime: arrival,
        departureTime: departure,
    });

    it('returns the gap between the first arrival and the second departure', () => {
        const first = segment('2026-03-15T10:00:00', '2026-03-15T08:00:00');
        const second = segment('2026-03-15T14:00:00', '2026-03-15T11:30:00');

        expect(getConnectionTime(first as never, second as never)).toBe('1h 30m');
    });

    it('returns minutes only for a sub-hour connection', () => {
        const first = segment('2026-03-15T10:00:00', '2026-03-15T08:00:00');
        const second = segment('2026-03-15T14:00:00', '2026-03-15T10:45:00');

        expect(getConnectionTime(first as never, second as never)).toBe('45m');
    });

    it('returns an empty string when either segment is missing', () => {
        const s = segment('2026-03-15T10:00:00', '2026-03-15T11:00:00');
        expect(getConnectionTime(undefined as never, s as never)).toBe('');
        expect(getConnectionTime(s as never, undefined as never)).toBe('');
    });

    it('accepts Dayjs segment times as well as strings', () => {
        const first = {arrivalTime: dayjs('2026-03-15T10:00:00'), departureTime: dayjs('2026-03-15T08:00:00')};
        const second = {arrivalTime: dayjs('2026-03-15T14:00:00'), departureTime: dayjs('2026-03-15T12:00:00')};

        expect(getConnectionTime(first as never, second as never)).toBe('2h 00m');
    });
});

describe('formatAirportCodeForDropdown', () => {
    it('keeps everything up to and including the first space', () => {
        // V1 deliberately kept the trailing space.
        expect(formatAirportCodeForDropdown('AKL Auckland International')).toBe('AKL ');
    });

    it('returns the whole string when there is no space', () => {
        expect(formatAirportCodeForDropdown('AKL')).toBe('AKL');
    });

    it('returns an empty string for empty input', () => {
        expect(formatAirportCodeForDropdown('')).toBe('');
        expect(formatAirportCodeForDropdown(undefined as never)).toBe('');
    });
});

describe('filterFlights', () => {
    const flights = [
        {flightNumber: 'NZ123', airline: 'Air New Zealand', departureAirport: 'AKL', arrivalAirport: 'WLG', aircraft: 'A320'},
        {flightNumber: 'QF456', airline: 'Qantas', departureAirport: 'SYD', arrivalAirport: 'MEL', aircraft: 'B737'},
    ] as never[];

    it('returns every flight when the search text is empty or whitespace', () => {
        expect(filterFlights(flights, '')).toBe(flights);
        expect(filterFlights(flights, '   ')).toBe(flights);
        expect(filterFlights(flights, undefined)).toBe(flights);
    });

    it('returns an empty array when there are no flights', () => {
        expect(filterFlights(undefined, 'NZ')).toEqual([]);
    });

    it('matches on flight number, airline, either airport, and aircraft', () => {
        expect(filterFlights(flights, 'nz123')).toHaveLength(1);
        expect(filterFlights(flights, 'qantas')).toHaveLength(1);
        expect(filterFlights(flights, 'akl')).toHaveLength(1);
        expect(filterFlights(flights, 'mel')).toHaveLength(1);
        expect(filterFlights(flights, 'b737')).toHaveLength(1);
    });

    it('is case-insensitive and trims the search text', () => {
        expect(filterFlights(flights, '  QANTAS  ')).toHaveLength(1);
    });

    it('returns nothing when no flight matches', () => {
        expect(filterFlights(flights, 'zzz')).toEqual([]);
    });

    it('tolerates flights with missing fields', () => {
        const sparse = [{flightNumber: 'NZ1'}] as never[];
        expect(filterFlights(sparse, 'nz1')).toHaveLength(1);
        expect(filterFlights(sparse, 'airbus')).toEqual([]);
    });
});
