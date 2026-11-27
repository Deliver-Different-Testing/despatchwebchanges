import dayjs from 'dayjs';
import {dateFilterEmptyState} from './dateFilterEmptyState';

const range = {startDate: dayjs('2026-11-21'), endDate: dayjs('2026-11-23')};
const format = {isUs: false, now: dayjs('2026-11-26')};

describe('dateFilterEmptyState', () => {
    it('names the dates and offers to show all dates', () => {
        const onShowAllDates = vi.fn();
        const state = dateFilterEmptyState(range, onShowAllDates, format);

        expect(state).toMatchObject({
            title: 'No jobs in these dates',
            message: 'The date filter is set to 21/Nov to 23/Nov.',
            actionText: 'Show all dates',
        });
        state!.onAction!();
        expect(onShowAllDates).toHaveBeenCalledTimes(1);
    });

    it('says the selected views may also be the cause', () => {
        expect(dateFilterEmptyState(range, vi.fn(), {...format, viewsSelected: true})?.message)
            .toBe('The date filter is set to 21/Nov to 23/Nov. Your selected views may also be hiding jobs.');
    });

    it('says nothing for all time, where an empty list is genuinely empty', () => {
        expect(dateFilterEmptyState({startDate: dayjs(0), endDate: dayjs()}, vi.fn(), format)).toBeUndefined();
    });

    it('says nothing when the page cannot reset the dates', () => {
        expect(dateFilterEmptyState(range, undefined, format)).toBeUndefined();
    });
});
