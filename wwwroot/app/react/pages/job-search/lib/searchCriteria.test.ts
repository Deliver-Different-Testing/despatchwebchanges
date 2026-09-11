/** @jest-environment node */
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import JobSearchDateRange from './jobSearchDateRange';
import {
    filterCouriersForNumericSearch,
    resolveDateRange,
    toSelectedIds,
} from './searchCriteria';

dayjs.extend(utc);
dayjs.extend(timezone);

describe('toSelectedIds', () => {
    it('returns undefined for empty / undefined input', () => {
        expect(toSelectedIds(undefined)).toBeUndefined();
        expect(toSelectedIds([])).toBeUndefined();
    });

    it('returns the id array when items are selected', () => {
        expect(toSelectedIds([
            {id: 1, text: 'Client A'},
            {id: 2, text: 'Client B'},
        ])).toEqual([1, 2]);
    });

    it('drops entries with non-numeric ids', () => {
        expect(toSelectedIds([
            {id: 1, text: 'Client A'},
            {id: undefined as any, text: 'Client B'},
        ])).toEqual([1]);
    });
});

describe('filterCouriersForNumericSearch', () => {
    const results = [
        {id: 1, text: '100 Mike Runner'},
        {id: 2, text: '1001 Jane Walker'},
        {id: 3, text: '200 Bob Sprinter'},
    ];

    it('returns input unchanged for non-numeric search', () => {
        expect(filterCouriersForNumericSearch(results, 'Mike')).toEqual(results);
    });

    it('filters to exact courier-code matches for numeric search', () => {
        expect(filterCouriersForNumericSearch(results, '100'))
            .toEqual([{id: 1, text: '100 Mike Runner'}]);
    });

    it('treats whitespace-padded numeric input as numeric', () => {
        expect(filterCouriersForNumericSearch(results, '  100  '))
            .toEqual([{id: 1, text: '100 Mike Runner'}]);
    });

    it('falls back to all results if no exact numeric match exists', () => {
        expect(filterCouriersForNumericSearch(results, '999')).toEqual(results);
    });

    it('handles parenthesised courier-code suffix', () => {
        const withParen = [{id: 1, text: '100(active) Mike Runner'}];
        expect(filterCouriersForNumericSearch(withParen, '100')).toEqual(withParen);
    });

    it('safely skips entries without text', () => {
        const mixed = [{id: 1}, {id: 2, text: '100 Mike Runner'}];
        expect(filterCouriersForNumericSearch(mixed, '100'))
            .toEqual([{id: 2, text: '100 Mike Runner'}]);
    });
});

describe('resolveDateRange', () => {
    const baseTz = 'Pacific/Auckland';
    const fixedNow = dayjs.tz('2026-06-17T10:00:00', baseTz);

    it('returns null for Custom (caller keeps existing dates)', () => {
        expect(resolveDateRange(JobSearchDateRange.Custom, 'New Zealand Standard Time', fixedNow))
            .toBeNull();
    });

    it('Today returns the same instant for both bounds', () => {
        const result = resolveDateRange(JobSearchDateRange.Today, 'New Zealand Standard Time', fixedNow);
        expect(result).not.toBeNull();
        expect(result!.from_date.isSame(result!.to_date)).toBe(true);
    });

    it('Fortnight returns 7-days-ago → 7-days-ahead', () => {
        const result = resolveDateRange(JobSearchDateRange.Fortnight, 'New Zealand Standard Time', fixedNow);
        expect(result).not.toBeNull();
        expect(result!.to_date.diff(result!.from_date, 'day')).toBe(14);
    });

    it('Month returns start-of-month → end-of-month', () => {
        const result = resolveDateRange(JobSearchDateRange.Month, 'New Zealand Standard Time', fixedNow);
        expect(result).not.toBeNull();
        expect(result!.from_date.date()).toBe(1);
        expect(result!.from_date.month()).toBe(fixedNow.tz(baseTz).month());
        expect(result!.to_date.date()).toBeGreaterThanOrEqual(28);
    });

    it('accepts an already-IANA timezone string', () => {
        const result = resolveDateRange(JobSearchDateRange.Today, baseTz, fixedNow);
        expect(result).not.toBeNull();
    });
});
