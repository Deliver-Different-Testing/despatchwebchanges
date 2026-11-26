import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {dateFilterEmptyState} from './dateFilterEmptyState';

dayjs.extend(utc);
dayjs.extend(timezone);

const NZ = 'Pacific/Auckland';
const format = {timeZone: NZ, isUs: false};

describe('dateFilterEmptyState', () => {
    it('names the dates and offers to show all dates', () => {
        const onShowAllDates = vi.fn();
        const state = dateFilterEmptyState(
            {startDate: dayjs.tz('2026-11-21T00:00:00', NZ), endDate: dayjs.tz('2026-11-23T23:59:59', NZ)},
            onShowAllDates,
            format,
        );

        expect(state).toMatchObject({
            title: 'No jobs in these dates',
            message: 'The date filter is set to 21/Nov to 23/Nov.',
            actionText: 'Show all dates',
        });
        state!.onAction!();
        expect(onShowAllDates).toHaveBeenCalledTimes(1);
    });

    it('says nothing for all time, where an empty list is genuinely empty', () => {
        expect(dateFilterEmptyState({startDate: dayjs(0), endDate: dayjs()}, vi.fn(), format)).toBeUndefined();
    });

    it('says nothing when the page cannot reset the dates', () => {
        expect(dateFilterEmptyState(
            {startDate: dayjs.tz('2026-11-21T00:00:00', NZ), endDate: dayjs.tz('2026-11-23T23:59:59', NZ)},
            undefined,
            format,
        )).toBeUndefined();
    });
});
