/**
 * One implementation of the persisted date-filter behaviour that the Dispatch
 * and Nationwide pages both need. Extracted from
 * `pages/dispatch/lib/dispatchFilters.loadDateFilter` and
 * `NationwideControl.loadDateFilterFromStorage` / `saveDateFilterToStorage`.
 */

import dayjs from 'dayjs';
import {getContactId} from '../api/session';
import {isAllTimeStart, loadDateFilterFrom, saveDateFilterTo} from './dateFilterStorage';

const KEY = 'dateFilter-test';
const MARCH_3 = dayjs('2026-03-03T12:00:00');

describe('saveDateFilterTo / loadDateFilterFrom', () => {
    beforeEach(() => localStorage.clear());

    it('round-trips a stored range', () => {
        saveDateFilterTo(KEY, {
            startDate: dayjs('2026-03-01T00:00:00'),
            endDate: dayjs('2026-03-05T00:00:00'),
            useTime: true,
        });

        const loaded = loadDateFilterFrom(KEY, {now: MARCH_3});

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

        expect(loadDateFilterFrom(KEY, {now: MARCH_3}).useTime).toBe(false);
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

            expect(loadDateFilterFrom(KEY, {now: MARCH_3}).endDate.format('YYYY-MM-DD')).toBe('2026-03-05');
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

    describe('a custom range that has already ended', () => {
        const NZ = 'Pacific/Auckland';
        const storeRange = (start: string, end: string) => localStorage.setItem(KEY, JSON.stringify({
            startDate: dayjs.tz(start, NZ).toISOString(),
            endDate: dayjs.tz(end, NZ).toISOString(),
            useTime: false,
        }));
        const nzNow = (local: string) => dayjs.tz(local, NZ);

        it('is not restored: loads all time and reports the expired range', () => {
            storeRange('2026-11-21T00:00:00', '2026-11-23T23:59:59');

            const loaded = loadDateFilterFrom(KEY, {timeZone: NZ, now: nzNow('2026-11-25T09:00:00')});

            expect(loaded.startDate.valueOf()).toBe(0);
            expect(loaded.expiredRange?.startDate.tz(NZ).format('YYYY-MM-DD')).toBe('2026-11-21');
            expect(loaded.expiredRange?.endDate.tz(NZ).format('YYYY-MM-DD')).toBe('2026-11-23');
        });

        it('leaves storage untouched so every caller sees the same result', () => {
            storeRange('2026-11-21T00:00:00', '2026-11-23T23:59:59');
            const before = localStorage.getItem(KEY);

            loadDateFilterFrom(KEY, {timeZone: NZ, now: nzNow('2026-11-25T09:00:00')});
            const second = loadDateFilterFrom(KEY, {timeZone: NZ, now: nzNow('2026-11-25T09:00:00')});

            expect(localStorage.getItem(KEY)).toBe(before);
            expect(second.expiredRange).toBeDefined();
        });

        it('is restored while it still covers today', () => {
            storeRange('2026-11-21T00:00:00', '2026-11-25T23:59:59');

            const loaded = loadDateFilterFrom(KEY, {timeZone: NZ, now: nzNow('2026-11-25T09:00:00')});

            expect(loaded.startDate.tz(NZ).format('YYYY-MM-DD')).toBe('2026-11-21');
            expect(loaded.expiredRange).toBeUndefined();
        });

        it('keeps a range on its last day when the tenant is already on tomorrow', () => {
            // Kiritimati (UTC+14) is ahead of every browser zone the tests run in.
            saveDateFilterTo(KEY, {startDate: dayjs('2026-11-21'), endDate: dayjs('2026-11-26'), useTime: false});

            const loaded = loadDateFilterFrom(KEY, {timeZone: 'Pacific/Kiritimati', now: dayjs('2026-11-26T23:30:00')});

            expect(loaded.expiredRange).toBeUndefined();
        });

        describe('when the page says which date option is saved', () => {
            const PAGE = 'expiryPage';
            const optionKey = `dateRangeOption-${PAGE}-${getContactId()}`;
            const storeEnded = () => saveDateFilterTo(KEY, {
                startDate: dayjs('2026-11-21'), endDate: dayjs('2026-11-23'), useTime: false,
            });
            const load = () => loadDateFilterFrom(KEY, {appPage: PAGE, now: dayjs('2026-11-25T09:00:00')});

            it('expires an ended range saved as Custom dates', () => {
                localStorage.setItem(optionKey, 'custom_date');
                storeEnded();
                expect(load().expiredRange).toBeDefined();
            });

            it('honours the per-browser option saved before options were per user', () => {
                localStorage.setItem(`dateRangeOption-${PAGE}`, 'custom_date');
                storeEnded();
                expect(load().expiredRange).toBeDefined();
            });

            it('leaves a preset alone: Today re-derives its own range', () => {
                localStorage.setItem(optionKey, 'today');
                storeEnded();

                const loaded = load();

                expect(loaded.expiredRange).toBeUndefined();
                expect(loaded.startDate.format('YYYY-MM-DD')).toBe('2026-11-21');
            });
        });

        it('keeps a range on its last day when the tenant is behind the browser', () => {
            // The picker saves days as browser-local midnights, so its last day is judged on the browser's calendar.
            saveDateFilterTo(KEY, {startDate: dayjs('2026-11-21'), endDate: dayjs('2026-11-23'), useTime: false});

            const loaded = loadDateFilterFrom(KEY, {timeZone: 'Pacific/Honolulu', now: dayjs('2026-11-23T23:30:00')});

            expect(loaded.expiredRange).toBeUndefined();
        });

        it('never expires all time', () => {
            localStorage.setItem(KEY, JSON.stringify({
                startDate: new Date(0).toISOString(),
                endDate: '2020-01-01T00:00:00',
                useTime: false,
            }));

            expect(loadDateFilterFrom(KEY, {timeZone: NZ}).expiredRange).toBeUndefined();
        });
    });

    it('treats only an epoch start as all time', () => {
        expect(isAllTimeStart({startDate: dayjs(0)})).toBe(true);
        expect(isAllTimeStart({startDate: dayjs('2026-11-21')})).toBe(false);
        expect(isAllTimeStart(null)).toBe(false);
    });

    it('does not throw when localStorage rejects the write', () => {
        const setItem = vi.spyOn(Storage.prototype, 'setItem')
            .mockImplementation(() => { throw new Error('quota'); });

        expect(() => saveDateFilterTo(KEY, {
            startDate: dayjs(), endDate: dayjs(), useTime: false,
        })).not.toThrow();

        setItem.mockRestore();
    });
});
