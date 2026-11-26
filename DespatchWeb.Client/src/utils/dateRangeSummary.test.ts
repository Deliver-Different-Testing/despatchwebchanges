import dayjs from 'dayjs';
import {expiredRangeMessage, formatDateRange} from './dateRangeSummary';

// The date picker saves each day as midnight in the browser's zone, so these are browser-local days.
const day = (iso: string) => dayjs(iso);
const now = day('2026-11-26T10:00:00');

describe('formatDateRange', () => {
    it('names both days in the tenant format', () => {
        expect(formatDateRange(day('2026-11-21'), day('2026-11-23'), {isUs: false, now})).toBe('21/Nov to 23/Nov');
        expect(formatDateRange(day('2026-11-21'), day('2026-11-23'), {isUs: true, now})).toBe('Nov/21 to Nov/23');
    });

    it('names the days the user picked, whatever zone the dates were moved into', () => {
        const start = day('2026-11-21').tz('Pacific/Honolulu');
        const end = day('2026-11-23').tz('Pacific/Honolulu');

        expect(formatDateRange(start, end, {isUs: false, now})).toBe('21/Nov to 23/Nov');
    });

    it('names a single day once', () => {
        expect(formatDateRange(day('2026-11-21'), day('2026-11-21T23:59:59'), {isUs: false, now})).toBe('21/Nov');
    });

    it('includes the year when the range crosses one', () => {
        expect(formatDateRange(day('2026-12-30'), day('2027-01-02'), {isUs: false, now}))
            .toBe('30/Dec/2026 to 02/Jan/2027');
    });

    it('includes the year when the range is not in the current year', () => {
        expect(formatDateRange(day('2025-11-21'), day('2025-11-23'), {isUs: false, now}))
            .toBe('21/Nov/2025 to 23/Nov/2025');
    });
});

describe('expiredRangeMessage', () => {
    it('says the saved dates ended and what is shown instead', () => {
        expect(expiredRangeMessage({startDate: day('2026-11-21'), endDate: day('2026-11-23')}, {isUs: false, now}))
            .toBe('Your saved date range (21/Nov to 23/Nov) has ended. Showing all dates.');
    });
});
