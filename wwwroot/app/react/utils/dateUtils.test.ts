/**
 * Date Utilities Unit Tests
 */

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const originalTimeZone = (window as any).TimeZone;
const originalServerConfig = (window as any).serverConfig;

import {
    getTenantTimezone,
    isUsCustomer,
    getIanaTimezone,
    formatDateForApi,
    parseDateFromApi,
    formatLongDateTime,
    formatLongDate,
    formatShortDateTime,
    formatShortDate,
    formatTime,
    formatRelativeDateTime,
    getTimezoneAbbreviation,
    getTimezoneName,
} from './dateUtils';

describe('dateUtils', () => {
    beforeEach(() => {
        delete (window as any).TimeZone;
        delete (window as any).serverConfig;
    });

    afterEach(() => {
        (window as any).TimeZone = originalTimeZone;
        (window as any).serverConfig = originalServerConfig;
    });

    describe('getTenantTimezone', () => {
        it.each([
            ['Pacific Standard Time', 'Pacific Standard Time'],
            [undefined, 'UTC'],
            ['', 'UTC'],
        ])('returns %s when window.TimeZone is %s', (windowValue, expected) => {
            if (windowValue !== undefined) (window as any).TimeZone = windowValue;
            expect(getTenantTimezone()).toBe(expected);
        });
    });

    describe('isUsCustomer', () => {
        it.each([
            [{isUSCustomer: true}, true],
            [{isUSCustomer: false}, false],
            [undefined, true],
            [{}, true],
        ])('returns correct value for serverConfig=%j', (config, expected) => {
            if (config !== undefined) (window as any).serverConfig = config;
            expect(isUsCustomer()).toBe(expected);
        });
    });

    describe('getIanaTimezone', () => {
        it.each([
            ['Pacific Standard Time', 'America/Los_Angeles'],
            ['Eastern Standard Time', 'America/New_York'],
            ['Central Standard Time', 'America/Chicago'],
            ['Mountain Standard Time', 'America/Denver'],
            ['New Zealand Standard Time', 'Pacific/Auckland'],
            ['America/New_York', 'America/New_York'],
        ])('converts %s to %s', (input, expected) => {
            expect(getIanaTimezone(input)).toBe(expected);
        });

        it('uses tenant timezone when no argument provided', () => {
            (window as any).TimeZone = 'Eastern Standard Time';
            expect(getIanaTimezone()).toBe('America/New_York');
        });
    });

    describe('formatDateForApi', () => {
        beforeEach(() => {
            (window as any).TimeZone = 'UTC';
        });

        it('formats Date, dayjs, and string inputs correctly', () => {
            const dateObj = new Date(2024, 0, 15, 10, 30, 0);
            const dayjsObj = dayjs('2024-01-15T14:30:00');
            const dateStr = '2024-01-15T10:00:00';

            expect(formatDateForApi(dateObj)).toContain('2024-01-15');
            expect(formatDateForApi(dayjsObj)).toContain('14:30:00');
            expect(formatDateForApi(dateStr)).toContain('10:00:00');
        });

        it('applies specified timezone', () => {
            const result = formatDateForApi(dayjs('2024-01-15T10:00:00'), 'Pacific Standard Time');
            expect(result).toContain('-08:00');
        });
    });

    describe('parseDateFromApi', () => {
        it('parses ISO date string and preserves timezone offset', () => {
            const result = parseDateFromApi('2024-01-15T10:00:00-05:00');
            expect(result.isValid()).toBe(true);
            expect(result.format('YYYY-MM-DD')).toBe('2024-01-15');
            expect(result.utcOffset()).toBe(-300);
        });
    });

    describe('locale-aware formatting', () => {
        const testDate = dayjs('2024-01-15T14:30:00');

        it.each([
            ['formatLongDateTime', formatLongDateTime, true, 'Jan/15/2024 2:30 PM'],
            ['formatLongDateTime', formatLongDateTime, false, '15/Jan/2024 14:30'],
            ['formatLongDate', formatLongDate, true, 'Jan/15/2024'],
            ['formatLongDate', formatLongDate, false, '15/Jan/2024'],
            ['formatShortDateTime', formatShortDateTime, true, 'Jan/15 14:30'],
            ['formatShortDateTime', formatShortDateTime, false, '15/Jan 14:30'],
            ['formatShortDate', formatShortDate, true, 'Jan/15'],
            ['formatShortDate', formatShortDate, false, '15/Jan'],
        ])('%s with isUs=%s returns %s', (_, fn, isUs, expected) => {
            expect(fn(testDate, isUs)).toBe(expected);
        });

        it('uses tenant setting when isUs not specified', () => {
            (window as any).serverConfig = {isUSCustomer: false};
            expect(formatLongDate(testDate)).toBe('15/Jan/2024');
        });
    });

    describe('formatTime', () => {
        it.each([
            ['2024-01-15T14:30:00', '14:30'],
            ['2024-01-15T00:00:00', '00:00'],
            ['2024-01-15T12:00:00', '12:00'],
        ])('formats %s as %s', (input, expected) => {
            expect(formatTime(dayjs(input))).toBe(expected);
        });
    });

    describe('formatRelativeDateTime', () => {
        beforeEach(() => {
            (window as any).TimeZone = 'UTC';
        });

        it('handles edge cases', () => {
            expect(formatRelativeDateTime('')).toBe('No date');
            expect(formatRelativeDateTime('not-a-date')).toBe('Invalid date');
        });

        it('formats today as time only and tomorrow with prefix', () => {
            const today = dayjs().format('YYYY-MM-DD') + 'T14:30:00';
            const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD') + 'T09:00:00';

            expect(formatRelativeDateTime(today)).toBe('14:30');
            expect(formatRelativeDateTime(tomorrow)).toBe('Tomorrow 09:00');
        });
    });

    describe('getTimezoneAbbreviation', () => {
        it.each([
            ['', ''],
            ['New Zealand Standard Time', ''],
            ['Pacific/Auckland', ''],
            ['NZ Standard Time', ''],
        ])('returns empty for %s', (input, expected) => {
            expect(getTimezoneAbbreviation(input)).toBe(expected);
        });

        it.each([
            ['Pacific Standard Time', /\(P[SD]T\)/],
            ['Eastern Standard Time', /\(E[SD]T\)/],
        ])('returns abbreviation for %s', (input, pattern) => {
            expect(getTimezoneAbbreviation(input)).toMatch(pattern);
        });
    });

    describe('getTimezoneName', () => {
        it('returns empty for empty input', () => {
            expect(getTimezoneName('')).toBe('');
        });

        it.each([
            ['New Zealand Standard Time'],
            ['Pacific/Auckland'],
        ])('returns NZ time name for %s', (input) => {
            expect(getTimezoneName(input)).toMatch(/New Zealand (Standard|Daylight) Time/);
        });

        it.each([
            ['Pacific Standard Time', 'pacific'],
            ['Eastern Standard Time', 'eastern'],
        ])('returns timezone name containing %s', (input, keyword) => {
            expect(getTimezoneName(input).toLowerCase()).toContain(keyword);
        });

        it('returns original timezone on error', () => {
            expect(getTimezoneName('Invalid/Timezone')).toBe('Invalid/Timezone');
        });
    });
});
