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

        const {result} = renderHook(() => useDateFilter(KEY, () => loadDateFilterFrom(KEY, {now: dayjs('2026-01-15T00:00:00.000Z')})));
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

    describe('a stored range that has already ended', () => {
        const ended = {startDate: '2026-11-21T00:00:00.000Z', endDate: '2026-11-23T00:00:00.000Z', useTime: false};
        const loadAt = () => loadDateFilterFrom(KEY, {timeZone: 'UTC', now: dayjs('2026-11-25T09:00:00.000Z')});

        it('persists all time in its place so the next load restores all time', () => {
            localStorage.setItem(KEY, JSON.stringify(ended));

            const {result} = renderHook(() => useDateFilter(KEY, loadAt));

            expect(result.current[0].startDate.valueOf()).toBe(0);
            const persisted = JSON.parse(localStorage.getItem(KEY)!);
            expect(dayjs(persisted.startDate).valueOf()).toBe(0);
            expect(persisted).not.toHaveProperty('expiredRange');
        });

        it('reports the expired range once, even if the page re-renders', () => {
            localStorage.setItem(KEY, JSON.stringify(ended));
            const onExpired = vi.fn();

            const {rerender} = renderHook(() => useDateFilter(KEY, loadAt, onExpired));
            rerender();

            expect(onExpired).toHaveBeenCalledTimes(1);
            expect(onExpired.mock.calls[0][0].endDate.toISOString()).toBe(ended.endDate);
        });

        it('does not report anything for a range that is still current', () => {
            localStorage.setItem(KEY, JSON.stringify({...ended, endDate: '2026-11-30T00:00:00.000Z'}));
            const onExpired = vi.fn();

            renderHook(() => useDateFilter(KEY, loadAt, onExpired));

            expect(onExpired).not.toHaveBeenCalled();
        });
    });
});
