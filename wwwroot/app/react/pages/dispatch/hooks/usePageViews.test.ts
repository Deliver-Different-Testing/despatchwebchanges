/** @jest-environment jest-environment-jsdom */
/**
 * usePageViews Hook Tests
 */

import {renderHook, waitFor, act} from '@testing-library/react';
import {usePageViews} from './usePageViews';
import {createTestQueryClient, createWrapper} from '../../../__testUtils__';

// Mock API modules
jest.mock('../../../services/dispatchApi', () => ({
    getPageViews: jest.fn(),
}));

import {getPageViews} from '../../../services/dispatchApi';

const mockGetPageViews = getPageViews as jest.MockedFunction<typeof getPageViews>;

const mockPageViewsData = [
    {id: 1, name: 'Sydney'},
    {id: 2, name: 'Melbourne'},
    {id: 3, name: 'Brisbane'},
];

function renderPageViews() {
    const queryClient = createTestQueryClient();
    const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
    return renderHook(() => usePageViews(), {wrapper});
}

describe('usePageViews', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        mockGetPageViews.mockResolvedValue(mockPageViewsData as any);
    });

    it('fetches page views from API', async () => {
        const {result} = renderPageViews();

        await waitFor(() => {
            expect(result.current.views).not.toBeNull();
            expect(result.current.views).toHaveLength(3);
        });
        expect(mockGetPageViews).toHaveBeenCalled();
    });

    // ── Auto-selection (regression: empty views → no jobs loaded) ────

    it('auto-selects all views when API data arrives and nothing is saved', async () => {
        const {result} = renderPageViews();

        await waitFor(() => {
            expect(result.current.selectedViewIds).toEqual(
                expect.arrayContaining([1, 2, 3]),
            );
        });
        expect(result.current.selectedViewIds).toHaveLength(3);

        // Should also persist the auto-selection
        const stored = JSON.parse(localStorage.getItem('dispatch_selectedViews')!);
        expect(stored).toEqual(expect.arrayContaining([1, 2, 3]));
    });

    it('does NOT auto-select when views are already saved in localStorage', async () => {
        localStorage.setItem('dispatch_selectedViews', JSON.stringify([2]));

        const {result} = renderPageViews();

        await waitFor(() => {
            expect(result.current.views).not.toBeNull();
        });

        // Should keep only the saved selection, not auto-select all
        expect(result.current.selectedViewIds).toEqual([2]);
    });

    // ── Toggle & clear ───────────────────────────────────────────────

    it('toggleView removes an auto-selected view', async () => {
        const {result} = renderPageViews();

        await waitFor(() => {
            expect(result.current.selectedViewIds).toHaveLength(3);
        });

        act(() => {
            result.current.toggleView({id: 1, name: 'Sydney', selected: true});
        });

        expect(result.current.selectedViewIds).not.toContain(1);
        expect(result.current.selectedViewIds).toContain(2);
        expect(result.current.selectedViewIds).toContain(3);
    });

    it('toggleView adds back a deselected view', async () => {
        localStorage.setItem('dispatch_selectedViews', JSON.stringify([2, 3]));
        const {result} = renderPageViews();

        await waitFor(() => {
            expect(result.current.views).not.toBeNull();
        });

        act(() => {
            result.current.toggleView({id: 1, name: 'Sydney', selected: false});
        });

        expect(result.current.selectedViewIds).toContain(1);
        expect(result.current.selectedViewIds).toContain(2);
        expect(result.current.selectedViewIds).toContain(3);
    });

    it('clearAll empties all selections', async () => {
        const {result} = renderPageViews();

        await waitFor(() => {
            expect(result.current.selectedViewIds).toHaveLength(3);
        });

        act(() => {
            result.current.clearAll();
        });

        expect(result.current.selectedViewIds).toEqual([]);
    });

    // ── Persistence ──────────────────────────────────────────────────

    it('persists toggle changes to localStorage', async () => {
        const {result} = renderPageViews();

        await waitFor(() => {
            expect(result.current.selectedViewIds).toHaveLength(3);
        });

        act(() => {
            result.current.toggleView({id: 3, name: 'Brisbane', selected: true});
        });

        const stored = JSON.parse(localStorage.getItem('dispatch_selectedViews')!);
        expect(stored).toContain(1);
        expect(stored).toContain(2);
        expect(stored).not.toContain(3);
    });

    it('loads saved selections from localStorage on mount', () => {
        localStorage.setItem('dispatch_selectedViews', JSON.stringify([2, 3]));

        const {result} = renderPageViews();

        expect(result.current.selectedViewIds).toContain(2);
        expect(result.current.selectedViewIds).toContain(3);
        expect(result.current.selectedViewIds).not.toContain(1);
    });
});
