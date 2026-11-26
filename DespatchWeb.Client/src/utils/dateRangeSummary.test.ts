import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {expiredRangeMessage, formatDateRange} from './dateRangeSummary';

dayjs.extend(utc);
dayjs.extend(timezone);

const NZ = 'Pacific/Auckland';
const nz = (local: string) => dayjs.tz(local, NZ);

describe('formatDateRange', () => {
    it('names both days in the tenant format and zone', () => {
        const start = nz('2026-11-21T00:00:00');
        const end = nz('2026-11-23T23:59:59');

        expect(formatDateRange(start, end, {timeZone: NZ, isUs: false})).toBe('21/Nov to 23/Nov');
        expect(formatDateRange(start, end, {timeZone: NZ, isUs: true})).toBe('Nov/21 to Nov/23');
    });

    it('names a single day once', () => {
        expect(formatDateRange(nz('2026-11-21T00:00:00'), nz('2026-11-21T23:59:59'), {timeZone: NZ, isUs: false}))
            .toBe('21/Nov');
    });

    it('includes the year when the range crosses one', () => {
        expect(formatDateRange(nz('2026-12-30T00:00:00'), nz('2027-01-02T23:59:59'), {timeZone: NZ, isUs: false}))
            .toBe('30/Dec/2026 to 02/Jan/2027');
    });
});

describe('expiredRangeMessage', () => {
    it('says the saved dates ended and what is shown instead', () => {
        expect(expiredRangeMessage(
            {startDate: nz('2026-11-21T00:00:00'), endDate: nz('2026-11-23T23:59:59')},
            {timeZone: NZ, isUs: false},
        )).toBe('Your saved date range (21/Nov to 23/Nov) has ended. Showing all dates.');
    });
});
