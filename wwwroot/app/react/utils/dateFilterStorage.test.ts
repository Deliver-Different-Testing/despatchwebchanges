/**
 * One implementation of the persisted date-filter behaviour that the Dispatch
 * and Nationwide pages both need. Extracted from
 * `pages/dispatch/lib/dispatchFilters.loadDateFilter` and
 * `NationwideControl.loadDateFilterFromStorage` / `saveDateFilterToStorage`.
 */

import dayjs from 'dayjs';
import {loadDateFilterFrom, saveDateFilterTo} from './dateFilterStorage';

const KEY = 'dateFilter-test';

describe('saveDateFilterTo / loadDateFilterFrom', () => {
    beforeEach(() => localStorage.clear());

    it('round-trips a stored range', () => {
        saveDateFilterTo(KEY, {
            startDate: dayjs('2026-03-01T00:00:00'),
            endDate: dayjs('2026-03-05T00:00:00'),
            useTime: true,
        });

        const loaded = loadDateFilterFrom(KEY);

        expect(loaded.startDate.format('YYYY-MM-DD')).toBe('2026-03-01');
        expect(loaded.endDate.format('YYYY-MM-DD')).toBe('2026-03-05');
        expect(loaded.useTime).toBe(true);
    });

    it('falls back to the defaults when nothing is stored', () => {
        const loaded = loadDateFilterFrom(KEY);
        expect(loaded.startDate).toBeDefined();
        expect(loaded.endDate).toBeDefined();
        expect(loaded.useTime).toBe(false);
    });

    it('falls back to the defaults when the stored value is unparseable', () => {
        localStorage.setItem(KEY, 'not-json');
        expect(() => loadDateFilterFrom(KEY)).not.toThrow();
        expect(loadDateFilterFrom(KEY).startDate).toBeDefined();
    });

    it('defaults useTime to false when the stored value omits it', () => {
        localStorage.setItem(KEY, JSON.stringify({
            startDate: '2026-03-01T00:00:00',
            endDate: '2026-03-05T00:00:00',
        }));

        expect(loadDateFilterFrom(KEY).useTime).toBe(false);
    });

    describe('the "all time" rule', () => {
        // A stored epoch start means "all time". The stored end is stale by
        // definition, so it is recomputed to now+24h to keep future jobs in
        // range -- otherwise reloading the page would silently drop them.
        const allTime = () => localStorage.setItem(KEY, JSON.stringify({
            startDate: new Date(0).toISOString(),
            endDate: '2020-01-01T00:00:00',
            useTime: false,
        }));

        it('recomputes the end to roughly 24 hours from now', () => {
            allTime();
            const {endDate} = loadDateFilterFrom(KEY);
            const hoursOut = endDate.diff(dayjs(), 'hours');

            expect(hoursOut).toBeGreaterThanOrEqual(23);
            expect(hoursOut).toBeLessThanOrEqual(24);
        });

        it('keeps the epoch start', () => {
            allTime();
            expect(loadDateFilterFrom(KEY).startDate.valueOf()).toBe(0);
        });

        it('leaves a normal stored end untouched', () => {
            saveDateFilterTo(KEY, {
                startDate: dayjs('2026-03-01T00:00:00'),
                endDate: dayjs('2026-03-05T00:00:00'),
                useTime: false,
            });

            expect(loadDateFilterFrom(KEY).endDate.format('YYYY-MM-DD')).toBe('2026-03-05');
        });

        it('resolves the recomputed end in the given timezone when one is passed', () => {
            // Nationwide passes the page timezone; Dispatch does not. Same
            // instant either way -- the zone only affects later formatting --
            // but both call sites keep their existing behaviour.
            allTime();
            const withZone = loadDateFilterFrom(KEY, {timeZone: 'Pacific/Auckland'});
            const withoutZone = loadDateFilterFrom(KEY);

            expect(Math.abs(withZone.endDate.valueOf() - withoutZone.endDate.valueOf()))
                .toBeLessThan(2000);
        });
    });

    it('does not throw when localStorage rejects the write', () => {
        const setItem = jest.spyOn(Storage.prototype, 'setItem')
            .mockImplementation(() => { throw new Error('quota'); });

        expect(() => saveDateFilterTo(KEY, {
            startDate: dayjs(), endDate: dayjs(), useTime: false,
        })).not.toThrow();

        setItem.mockRestore();
    });
});
