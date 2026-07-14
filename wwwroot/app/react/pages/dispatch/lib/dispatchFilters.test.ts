import dayjs from 'dayjs';
import {
    SELECTED_VIEWS_KEY,
    DATE_FILTER_KEY,
    REFRESH_INTERVAL_KEY,
    DRIVER_LOCATION_REFRESH_KEY,
    loadSelectedViewIds,
    loadSelectedViews,
    loadDateFilter,
    loadDispatchFilters,
    loadRefreshIntervals,
    filtersKey,
} from './dispatchFilters';

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
        it('returns false for both when nothing is stored', () => {
            expect(loadRefreshIntervals()).toEqual({jobsMs: false, driverLocationsMs: false});
        });

        it('converts stored seconds to ms', () => {
            localStorage.setItem(REFRESH_INTERVAL_KEY, '30');
            localStorage.setItem(DRIVER_LOCATION_REFRESH_KEY, '60');
            expect(loadRefreshIntervals()).toEqual({jobsMs: 30000, driverLocationsMs: 60000});
        });

        it('treats 0 / Disabled as false', () => {
            localStorage.setItem(REFRESH_INTERVAL_KEY, '0');
            localStorage.setItem(DRIVER_LOCATION_REFRESH_KEY, 'not a number');
            expect(loadRefreshIntervals()).toEqual({jobsMs: false, driverLocationsMs: false});
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
