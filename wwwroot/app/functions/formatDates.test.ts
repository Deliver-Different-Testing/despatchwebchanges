/**
 * formatDates.ts Unit Tests
 */

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

import { formatDateFromApi } from './formatDates';

describe('formatDates', () => {
    describe('formatDateFromApi', () => {
        it('parses ISO date string and preserves timezone offset', () => {
            const result = formatDateFromApi('2024-01-15T10:00:00-05:00');
            expect(result.isValid()).toBe(true);
            expect(result.format('YYYY-MM-DD')).toBe('2024-01-15');
            expect(result.utcOffset()).toBe(-300);
        });

        it('returns invalid dayjs for empty string', () => {
            const result = formatDateFromApi('');
            expect(result.isValid()).toBe(false);
        });

        it('returns invalid dayjs for null-like input', () => {
            const result = formatDateFromApi(null as unknown as string);
            expect(result.isValid()).toBe(false);
        });

        it('handles Z (UTC) timezone offset', () => {
            const result = formatDateFromApi('2024-01-15T10:00:00Z');
            expect(result.isValid()).toBe(true);
            expect(result.format('HH:mm')).toBe('10:00');
            expect(result.utcOffset()).toBe(0);
        });

        it('handles positive timezone offset', () => {
            const result = formatDateFromApi('2024-01-15T10:00:00+05:30');
            expect(result.isValid()).toBe(true);
            expect(result.format('HH:mm')).toBe('10:00');
            expect(result.utcOffset()).toBe(330);
        });

        it('handles negative timezone offset', () => {
            const result = formatDateFromApi('2024-01-15T10:00:00-08:00');
            expect(result.isValid()).toBe(true);
            expect(result.format('HH:mm')).toBe('10:00');
            expect(result.utcOffset()).toBe(-480);
        });

        it('handles date string without timezone offset', () => {
            const result = formatDateFromApi('2024-01-15T10:00:00');
            expect(result.isValid()).toBe(true);
            expect(result.format('YYYY-MM-DD')).toBe('2024-01-15');
        });

        it('preserves wall-clock time regardless of local timezone', () => {
            // This test verifies the fix for the double-conversion bug
            // The time should be 07:00 as specified, not shifted by local timezone
            const result = formatDateFromApi('2024-01-15T07:00:00-08:00');
            expect(result.format('HH:mm')).toBe('07:00');
        });

        it('handles various US timezone offsets correctly', () => {
            // Eastern Time (EST: -05:00)
            const eastern = formatDateFromApi('2024-01-15T09:00:00-05:00');
            expect(eastern.format('HH:mm')).toBe('09:00');

            // Pacific Time (PST: -08:00)
            const pacific = formatDateFromApi('2024-01-15T06:00:00-08:00');
            expect(pacific.format('HH:mm')).toBe('06:00');

            // Central Time (CST: -06:00)
            const central = formatDateFromApi('2024-01-15T08:00:00-06:00');
            expect(central.format('HH:mm')).toBe('08:00');
        });
    });
});
