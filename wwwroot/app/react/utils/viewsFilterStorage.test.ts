import {
    loadSelectedViewIdsFrom,
    loadSelectedViewsFrom,
    hasStoredViewSelectionAt,
    persistSelectedViewsTo,
    resolveInitialViewSelection,
} from './viewsFilterStorage';
import type {DfrntPageViewModel} from '../../interfaces/dfrnt-page-view-model.interface';

const KEY = 'selectedViews-test-1';

const view = (id: number, name: string): DfrntPageViewModel => ({
    id,
    name,
    centerLatitude: -36.8,
    centerLongitude: 174.7,
    selected: false,
});

describe('viewsFilterStorage', () => {
    beforeEach(() => localStorage.clear());

    describe('loadSelectedViewIdsFrom', () => {
        it('returns [] when nothing is stored', () => {
            expect(loadSelectedViewIdsFrom(KEY)).toEqual([]);
        });

        it('returns ids of stored selected views', () => {
            localStorage.setItem(KEY, JSON.stringify([
                {id: 11, selected: true},
                {id: 22, selected: true},
            ]));
            expect(loadSelectedViewIdsFrom(KEY)).toEqual([11, 22]);
        });

        it('drops views explicitly marked unselected', () => {
            localStorage.setItem(KEY, JSON.stringify([
                {id: 11, selected: true},
                {id: 22, selected: false},
            ]));
            expect(loadSelectedViewIdsFrom(KEY)).toEqual([11]);
        });

        it('returns [] on malformed storage', () => {
            localStorage.setItem(KEY, 'not json');
            expect(loadSelectedViewIdsFrom(KEY)).toEqual([]);
        });

        it('keeps separate keys independent', () => {
            localStorage.setItem(KEY, JSON.stringify([{id: 11, selected: true}]));
            localStorage.setItem('selectedViews-test-2', JSON.stringify([{id: 99, selected: true}]));
            expect(loadSelectedViewIdsFrom(KEY)).toEqual([11]);
            expect(loadSelectedViewIdsFrom('selectedViews-test-2')).toEqual([99]);
        });
    });

    describe('loadSelectedViewsFrom', () => {
        it('returns [] when nothing is stored', () => {
            expect(loadSelectedViewsFrom(KEY)).toEqual([]);
        });

        it('returns full selected view objects including centre coordinates', () => {
            localStorage.setItem(KEY, JSON.stringify([
                {id: 11, name: 'North', centerLatitude: -36.8, centerLongitude: 174.7, selected: true},
                {id: 22, name: 'South', centerLatitude: -43.5, centerLongitude: 172.6, selected: false},
            ]));
            expect(loadSelectedViewsFrom(KEY)).toEqual([
                {id: 11, name: 'North', centerLatitude: -36.8, centerLongitude: 174.7, selected: true},
            ]);
        });

        it('returns [] on malformed storage', () => {
            localStorage.setItem(KEY, 'not json');
            expect(loadSelectedViewsFrom(KEY)).toEqual([]);
        });
    });

    describe('persistSelectedViewsTo', () => {
        it('writes the full view objects so the map can read their coordinates back', () => {
            persistSelectedViewsTo(KEY, [{...view(11, 'North'), selected: true}]);
            expect(loadSelectedViewsFrom(KEY)).toEqual([
                {id: 11, name: 'North', centerLatitude: -36.8, centerLongitude: 174.7, selected: true},
            ]);
        });

        it('marks an explicitly cleared selection so it survives a reload', () => {
            persistSelectedViewsTo(KEY, []);
            expect(localStorage.getItem(KEY)).toBe('[]');
            expect(loadSelectedViewIdsFrom(KEY)).toEqual([]);
        });
    });

    describe('hasStoredViewSelectionAt', () => {
        it('is false when nothing has been written', () => {
            expect(hasStoredViewSelectionAt(KEY)).toBe(false);
        });

        it('is true once a selection (even empty) has been persisted', () => {
            persistSelectedViewsTo(KEY, []);
            expect(hasStoredViewSelectionAt(KEY)).toBe(true);
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
});
