import dayjs from 'dayjs';
import {
    SELECTED_VIEWS_KEY,
    DATE_FILTER_KEY,
    REFRESH_INTERVAL_KEY,
    DRIVER_LOCATION_REFRESH_KEY,
    TASK_REFRESH_KEY,
    loadSelectedViewIds,
    loadSelectedViews,
    loadDateFilter,
    loadDispatchFilters,
    loadRefreshIntervals,
    filtersKey,
    persistSelectedViews,
    resolveInitialViewSelection,
} from './dispatchFilters';
import type {DfrntPageViewModel} from '../../../../interfaces/dfrnt-page-view-model.interface';

const view = (id: number, name: string): DfrntPageViewModel => ({
    id,
    name,
    centerLatitude: -36.8,
    centerLongitude: 174.7,
    selected: false,
});

describe('dispatchFilters', () => {
    beforeEach(() => localStorage.clear());

    describe('loadSelectedViewIds', () => {
        it('returns [] when nothing is stored', () => {
            expect(loadSelectedViewIds()).toEqual([]);
        });

        it('returns ids of stored selected views', () => {
            localStorage.setItem(SELECTED_VIEWS_KEY, JSON.stringify([
                {id: 11, selected: true},
                {id: 22, selected: true},
            ]));
            expect(loadSelectedViewIds()).toEqual([11, 22]);
        });

        it('drops views explicitly marked unselected', () => {
            localStorage.setItem(SELECTED_VIEWS_KEY, JSON.stringify([
                {id: 11, selected: true},
                {id: 22, selected: false},
            ]));
            expect(loadSelectedViewIds()).toEqual([11]);
        });

        it('returns [] on malformed storage', () => {
            localStorage.setItem(SELECTED_VIEWS_KEY, 'not json');
            expect(loadSelectedViewIds()).toEqual([]);
        });
    });

    describe('loadSelectedViews', () => {
        it('returns [] when nothing is stored', () => {
            expect(loadSelectedViews()).toEqual([]);
        });

        it('returns full selected view objects including centre coordinates', () => {
            localStorage.setItem(SELECTED_VIEWS_KEY, JSON.stringify([
                {id: 11, name: 'North', centerLatitude: -36.8, centerLongitude: 174.7, selected: true},
                {id: 22, name: 'South', centerLatitude: -43.5, centerLongitude: 172.6, selected: false},
            ]));
            expect(loadSelectedViews()).toEqual([
                {id: 11, name: 'North', centerLatitude: -36.8, centerLongitude: 174.7, selected: true},
            ]);
        });

        it('returns [] on malformed storage', () => {
            localStorage.setItem(SELECTED_VIEWS_KEY, 'not json');
            expect(loadSelectedViews()).toEqual([]);
        });
    });

    describe('loadDateFilter', () => {
        it('defaults to all-time (epoch start) when nothing is stored', () => {
            const {startDate, endDate} = loadDateFilter();
            expect(startDate.valueOf()).toBe(0);
            expect(endDate.isAfter(dayjs())).toBe(true);
        });

        it('recomputes the end to now+24h when start is epoch (all time)', () => {
            localStorage.setItem(DATE_FILTER_KEY, JSON.stringify({
                startDate: dayjs(0).toISOString(),
                endDate: dayjs('2020-01-01').toISOString(),
                useTime: false,
            }));
            const {startDate, endDate} = loadDateFilter();
            expect(startDate.valueOf()).toBe(0);
            expect(endDate.isAfter(dayjs())).toBe(true);
        });

        it('round-trips a concrete stored range', () => {
            localStorage.setItem(DATE_FILTER_KEY, JSON.stringify({
                startDate: '2025-02-01T00:00:00.000Z',
                endDate: '2025-02-28T00:00:00.000Z',
                useTime: true,
            }));
            const {startDate, endDate, useTime} = loadDateFilter();
            expect(startDate.format('YYYY-MM-DD')).toBe('2025-02-01');
            expect(endDate.format('YYYY-MM-DD')).toBe('2025-02-28');
            expect(useTime).toBe(true);
        });
    });

    describe('loadRefreshIntervals', () => {
        it('defaults Tasks to 60s when nothing is stored', () => {
            // Tasks have no push channel, so an unset key must not leave the panel silent.
            // The job list and driver locations stay opt-in as before.
            expect(loadRefreshIntervals()).toEqual({jobsMs: false, driverLocationsMs: false, tasksMs: 60000});
        });

        it('converts stored seconds to ms', () => {
            localStorage.setItem(REFRESH_INTERVAL_KEY, '30');
            localStorage.setItem(DRIVER_LOCATION_REFRESH_KEY, '60');
            localStorage.setItem(TASK_REFRESH_KEY, '90');
            expect(loadRefreshIntervals()).toEqual({jobsMs: 30000, driverLocationsMs: 60000, tasksMs: 90000});
        });

        it('reads a stored Tasks interval independently of the job list', () => {
            localStorage.setItem(REFRESH_INTERVAL_KEY, '0');
            localStorage.setItem(TASK_REFRESH_KEY, '120');
            expect(loadRefreshIntervals()).toEqual({jobsMs: false, driverLocationsMs: false, tasksMs: 120000});
        });

        it('falls back to the 60s default when the Tasks key is unset and the job list is off', () => {
            localStorage.setItem(REFRESH_INTERVAL_KEY, '0');
            // No TASK_REFRESH_KEY written yet.
            expect(loadRefreshIntervals()).toEqual({jobsMs: false, driverLocationsMs: false, tasksMs: 60000});
        });

        it('seeds the Tasks interval from the job list on first run (Tasks key unset)', () => {
            localStorage.setItem(REFRESH_INTERVAL_KEY, '30');
            // No TASK_REFRESH_KEY written yet.
            expect(loadRefreshIntervals()).toEqual({jobsMs: 30000, driverLocationsMs: false, tasksMs: 30000});
        });

        it('keeps an explicit Tasks "Off" (stored 0) even when the job list is on', () => {
            localStorage.setItem(REFRESH_INTERVAL_KEY, '30');
            localStorage.setItem(TASK_REFRESH_KEY, '0');
            expect(loadRefreshIntervals()).toEqual({jobsMs: 30000, driverLocationsMs: false, tasksMs: false});
        });

        it('treats 0 / Disabled as false', () => {
            localStorage.setItem(REFRESH_INTERVAL_KEY, '0');
            localStorage.setItem(DRIVER_LOCATION_REFRESH_KEY, 'not a number');
            localStorage.setItem(TASK_REFRESH_KEY, '0');
            expect(loadRefreshIntervals()).toEqual({jobsMs: false, driverLocationsMs: false, tasksMs: false});
        });

        it('keeps the Tasks default out of the job-list and driver-location cadences', () => {
            expect(loadRefreshIntervals().jobsMs).toBe(false);
            expect(loadRefreshIntervals().driverLocationsMs).toBe(false);
        });
    });

    describe('persistSelectedViews', () => {
        it('writes the full view objects so the map can read their coordinates back', () => {
            persistSelectedViews([{...view(11, 'North'), selected: true}]);
            expect(loadSelectedViews()).toEqual([
                {id: 11, name: 'North', centerLatitude: -36.8, centerLongitude: 174.7, selected: true},
            ]);
        });

        it('marks an explicitly cleared selection so it survives a reload', () => {
            persistSelectedViews([]);
            expect(localStorage.getItem(SELECTED_VIEWS_KEY)).toBe('[]');
            expect(loadSelectedViewIds()).toEqual([]);
        });
    });

    describe('resolveInitialViewSelection', () => {
        const views = [view(11, 'North'), view(22, 'Central'), view(33, 'South')];

        it('defaults to the first view on a first visit (nothing stored)', () => {
            expect(resolveInitialViewSelection(views, [], false)).toEqual([11]);
        });

        it('keeps an explicitly cleared selection cleared', () => {
            expect(resolveInitialViewSelection(views, [], true)).toEqual([]);
        });

        it('restores the stored selection in server order', () => {
            expect(resolveInitialViewSelection(views, [33, 11], true)).toEqual([11, 33]);
        });

        it('drops stored ids the server no longer returns', () => {
            expect(resolveInitialViewSelection(views, [22, 999], true)).toEqual([22]);
        });

        it('falls back to the first view when every stored id is stale', () => {
            expect(resolveInitialViewSelection(views, [999], false)).toEqual([11]);
        });

        it('returns [] when the tenant has no views configured', () => {
            expect(resolveInitialViewSelection([], [], false)).toEqual([]);
        });
    });

    describe('loadDispatchFilters + filtersKey', () => {
        it('combines view ids and date range', () => {
            localStorage.setItem(SELECTED_VIEWS_KEY, JSON.stringify([{id: 5, selected: true}]));
            const filters = loadDispatchFilters();
            expect(filters.despatchViewIds).toEqual([5]);
            expect(filters.startDate).toBeDefined();
        });

        it('produces a stable key that changes with the inputs', () => {
            const base = {despatchViewIds: [1, 2], startDate: dayjs('2025-02-01'), endDate: dayjs('2025-02-02'), useTime: false};
            expect(filtersKey(base)).toBe(filtersKey({...base}));
            expect(filtersKey(base)).not.toBe(filtersKey({...base, despatchViewIds: [1]}));
            expect(filtersKey(base)).not.toBe(filtersKey({...base, useTime: true}));
        });
    });
});
