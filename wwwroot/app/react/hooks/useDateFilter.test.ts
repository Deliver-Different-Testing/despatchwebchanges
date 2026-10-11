import {act, renderHook} from '@testing-library/react';
import dayjs from 'dayjs';
import {useDateFilter} from './useDateFilter';
import {loadDateFilterFrom} from '../utils/dateFilterStorage';

const KEY = 'dateFilterHook-1';

describe('useDateFilter', () => {
    beforeEach(() => localStorage.clear());

    it('loads from storage and persists updates under the given key', () => {
        const stored = {startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-01-31T00:00:00.000Z', useTime: true};
        localStorage.setItem(KEY, JSON.stringify(stored));

        const {result} = renderHook(() => useDateFilter(KEY, () => loadDateFilterFrom(KEY)));
        const [initial] = result.current;
        expect(initial.startDate.toISOString()).toBe(stored.startDate);
        expect(initial.useTime).toBe(true);

        const next = {startDate: dayjs('2026-02-01T00:00:00.000Z'), endDate: dayjs('2026-02-02T00:00:00.000Z'), useTime: false};
        act(() => result.current[1](next));

        expect(result.current[0]).toBe(next);
        expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({
            startDate: next.startDate.toISOString(),
            endDate: next.endDate.toISOString(),
            useTime: false,
        });
    });
});
