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
    formatRelativeTime,
    getTimezoneAbbreviation,
    getTimezoneName,
    formatDateForApiWithTzs,
    formatMins,
    formatInfoLogDateTimeString,
    formatDateFromApi,
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

        it('returns invalid dayjs for empty string', () => {
            const result = parseDateFromApi('');
            expect(result.isValid()).toBe(false);
        });

        it('handles Z (UTC) timezone offset', () => {
            const result = parseDateFromApi('2024-01-15T10:00:00Z');
            expect(result.isValid()).toBe(true);
            expect(result.format('HH:mm')).toBe('10:00');
            expect(result.utcOffset()).toBe(0);
        });

        it('handles positive timezone offset', () => {
            const result = parseDateFromApi('2024-01-15T10:00:00+05:30');
            expect(result.isValid()).toBe(true);
            expect(result.format('HH:mm')).toBe('10:00');
            expect(result.utcOffset()).toBe(330);
        });

        it('handles date string without timezone offset', () => {
            const result = parseDateFromApi('2024-01-15T10:00:00');
            expect(result.isValid()).toBe(true);
            expect(result.format('YYYY-MM-DD')).toBe('2024-01-15');
        });

        it('preserves wall-clock time regardless of local timezone', () => {
            // This test verifies the fix for the double-conversion bug
            // The time should be 07:00 as specified, not shifted by local timezone
            const result = parseDateFromApi('2024-01-15T07:00:00-08:00');
            expect(result.format('HH:mm')).toBe('07:00');
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
            // Use UTC dates with Z suffix since tenant TZ is UTC — avoids local timezone shifting
            (window as any).serverConfig = {isUSCustomer: false};
            const today = dayjs.utc().format('YYYY-MM-DD') + 'T14:30:00Z';
            const tomorrow = dayjs.utc().add(1, 'day').format('YYYY-MM-DD') + 'T09:00:00Z';

            expect(formatRelativeDateTime(today)).toBe('14:30');
            expect(formatRelativeDateTime(tomorrow)).toBe('Tomorrow 09:00');
        });

        it('preserves wall-clock time from offset-bearing API date', () => {
            // An API date with a non-UTC offset should still show the wall-clock time
            // after parseDateFromApi strips and re-applies the offset
            (window as any).serverConfig = {isUSCustomer: false};
            const today = dayjs.utc().format('YYYY-MM-DD') + 'T14:30:00+00:00';
            expect(formatRelativeDateTime(today)).toBe('14:30');
        });

        it('formats today/tomorrow time in 12-hour form for US tenants', () => {
            (window as any).serverConfig = {isUSCustomer: true};
            const today = dayjs.utc().format('YYYY-MM-DD') + 'T14:30:00Z';
            const tomorrow = dayjs.utc().add(1, 'day').format('YYYY-MM-DD') + 'T09:00:00Z';

            expect(formatRelativeDateTime(today)).toBe('2:30 PM');
            expect(formatRelativeDateTime(tomorrow)).toBe('Tomorrow 9:00 AM');
        });

        it('formats today/tomorrow time in 24-hour form for non-US tenants', () => {
            (window as any).serverConfig = {isUSCustomer: false};
            const today = dayjs.utc().format('YYYY-MM-DD') + 'T14:30:00Z';
            const tomorrow = dayjs.utc().add(1, 'day').format('YYYY-MM-DD') + 'T09:00:00Z';

            expect(formatRelativeDateTime(today)).toBe('14:30');
            expect(formatRelativeDateTime(tomorrow)).toBe('Tomorrow 09:00');
        });
    });

    describe('parse-format round-trip', () => {
        it('parseDateFromApi → formatShortDateTime preserves wall-clock (non-US)', () => {
            const parsed = parseDateFromApi('2024-06-15T09:37:00-07:00');
            expect(formatShortDateTime(parsed, false)).toBe('15/Jun 09:37');
        });

        it('parseDateFromApi → formatShortDateTime preserves wall-clock (US)', () => {
            const parsed = parseDateFromApi('2024-06-15T09:37:00-07:00');
            expect(formatShortDateTime(parsed, true)).toBe('Jun/15 09:37');
        });

        it('parseDateFromApi → formatLongDateTime with NZST offset', () => {
            const parsed = parseDateFromApi('2024-06-15T14:30:00+12:00');
            expect(formatLongDateTime(parsed, false)).toBe('15/Jun/2024 14:30');
        });

        it.each([
            ['+00:00'],
            ['-05:00'],
            ['+12:00'],
            ['+05:30'],
        ])('parseDateFromApi → formatTime preserves 14:30 regardless of offset %s', (offset) => {
            const parsed = parseDateFromApi(`2024-06-15T14:30:00${offset}`);
            expect(formatTime(parsed)).toBe('14:30');
        });
    });

    describe('formatRelativeDateTime cross-timezone behavior', () => {
        it('with matching TZ offset works correctly for today', () => {
            (window as any).TimeZone = 'UTC';
            (window as any).serverConfig = {isUSCustomer: false};
            const today = dayjs().utc().format('YYYY-MM-DD') + 'T14:30:00+00:00';
            // When input offset matches tenant TZ, conversion doesn't change the day
            expect(formatRelativeDateTime(today)).toBe('14:30');
        });

        // Regression: formatRelativeDateTime used to re-project the parsed value through
        // window.TimeZone, so a 16:24 NZ (+12:00) booking viewed by a browser in a
        // different zone flipped across midnight and rendered "Tomorrow 04:24". The
        // wall-clock + offset the backend already stamped must win, regardless of
        // window.TimeZone.
        it.each([
            ['UTC'],
            ['Pacific Standard Time'],
            ['New Zealand Standard Time'],
        ])('shows the input-offset wall-clock for a same-day booking (window.TimeZone=%s)', (tz) => {
            (window as any).TimeZone = tz;
            (window as any).serverConfig = {isUSCustomer: false};
            // "Today" expressed in the +12:00 frame, at 16:24.
            const input = dayjs().utcOffset(12 * 60).format('YYYY-MM-DD') + 'T16:24:00+12:00';
            expect(formatRelativeDateTime(input)).toBe('16:24');
        });

        it('labels Tomorrow using the input-offset wall-clock, not window.TimeZone', () => {
            (window as any).TimeZone = 'UTC';
            (window as any).serverConfig = {isUSCustomer: false};
            const input = dayjs().utcOffset(12 * 60).add(1, 'day').format('YYYY-MM-DD') + 'T09:15:00+12:00';
            expect(formatRelativeDateTime(input)).toBe('Tomorrow 09:15');
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

    describe('backward-compatible aliases', () => {
        it('formatDateForApiWithTzs is an alias for formatDateForApi', () => {
            expect(formatDateForApiWithTzs).toBe(formatDateForApi);
        });

        it('formatMins is an alias for formatTime', () => {
            expect(formatMins).toBe(formatTime);
        });

        it('formatInfoLogDateTimeString is an alias for formatRelativeDateTime', () => {
            expect(formatInfoLogDateTimeString).toBe(formatRelativeDateTime);
        });

        it('formatDateFromApi is an alias for parseDateFromApi', () => {
            expect(formatDateFromApi).toBe(parseDateFromApi);
        });
    });

    describe('formatInfoLogDateTimeString cross-timezone behavior (from formatDates)', () => {
        it('with cross-TZ offset documents conversion behavior', () => {
            (window as any).TimeZone = 'New Zealand Standard Time';

            const pdtString = dayjs().tz('America/Los_Angeles').format('YYYY-MM-DD') + 'T09:00:00-07:00';

            const result = formatInfoLogDateTimeString(pdtString);
            expect(result).not.toBe('No date');
            expect(result).not.toBe('Invalid date');
        });
    });

    describe('formatRelativeTime', () => {
        // Fixed "now" so each branch is deterministic regardless of when the suite runs.
        const now = new Date('2024-06-15T12:00:00Z');

        beforeEach(() => {
            jest.useFakeTimers().setSystemTime(now);
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        const ago = (ms: number) => new Date(now.getTime() - ms);

        it.each([
            ['just now under 10s', ago(5 * 1000), 'just now'],
            ['seconds', ago(45 * 1000), '45s ago'],
            ['minutes', ago(3 * 60 * 1000), '3m ago'],
            ['hours', ago(5 * 60 * 60 * 1000), '5h ago'],
            ['days', ago(2 * 24 * 60 * 60 * 1000), '2d ago'],
        ])('formats %s as %s', (_, date, expected) => {
            expect(formatRelativeTime(date)).toBe(expected);
        });

        it.each([
            ['second/minute boundary (60s)', ago(60 * 1000), '1m ago'],
            ['minute/hour boundary (60m)', ago(60 * 60 * 1000), '1h ago'],
            ['hour/day boundary (24h)', ago(24 * 60 * 60 * 1000), '1d ago'],
        ])('handles %s', (_, date, expected) => {
            expect(formatRelativeTime(date)).toBe(expected);
        });
    });
});
