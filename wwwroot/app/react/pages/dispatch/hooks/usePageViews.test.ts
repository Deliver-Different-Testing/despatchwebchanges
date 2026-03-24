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

describe('usePageViews', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        mockGetPageViews.mockResolvedValue(mockPageViewsData as any);
    });

    it('fetches page views from API', async () => {
        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(() => usePageViews(), {wrapper});

        await waitFor(() => {
            expect(result.current.views).not.toBeNull();
            expect(result.current.views).toHaveLength(3);
        });
        expect(mockGetPageViews).toHaveBeenCalled();
    });

    it('initially has empty selected view IDs', () => {
        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(() => usePageViews(), {wrapper});

        expect(result.current.selectedViewIds).toEqual([]);
    });

    it('toggleView adds a view ID to selection', async () => {
        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(() => usePageViews(), {wrapper});

        await waitFor(() => {
            expect(result.current.views).not.toBeNull();
        });

        act(() => {
            result.current.toggleView({id: 1, name: 'Sydney', selected: false});
        });

        expect(result.current.selectedViewIds).toContain(1);
    });

    it('toggleView removes an already-selected view ID', async () => {
        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(() => usePageViews(), {wrapper});

        await waitFor(() => {
            expect(result.current.views).not.toBeNull();
        });

        act(() => {
            result.current.toggleView({id: 1, name: 'Sydney', selected: false});
        });
        expect(result.current.selectedViewIds).toContain(1);

        act(() => {
            result.current.toggleView({id: 1, name: 'Sydney', selected: true});
        });
        expect(result.current.selectedViewIds).not.toContain(1);
    });

    it('clearAll empties all selections', async () => {
        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(() => usePageViews(), {wrapper});

        await waitFor(() => {
            expect(result.current.views).not.toBeNull();
        });

        act(() => {
            result.current.toggleView({id: 1, name: 'Sydney', selected: false});
            result.current.toggleView({id: 2, name: 'Melbourne', selected: false});
        });
        expect(result.current.selectedViewIds.length).toBeGreaterThan(0);

        act(() => {
            result.current.clearAll();
        });

        expect(result.current.selectedViewIds).toEqual([]);
    });

    it('persists selections to localStorage', async () => {
        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(() => usePageViews(), {wrapper});

        await waitFor(() => {
            expect(result.current.views).not.toBeNull();
        });

        act(() => {
            result.current.toggleView({id: 1, name: 'Sydney', selected: false});
        });

        const stored = JSON.parse(localStorage.getItem('dispatch_selectedViews')!);
        expect(stored).toContain(1);
    });

    it('loads saved selections from localStorage', () => {
        localStorage.setItem('dispatch_selectedViews', JSON.stringify([2, 3]));

        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(() => usePageViews(), {wrapper});

        expect(result.current.selectedViewIds).toContain(2);
        expect(result.current.selectedViewIds).toContain(3);
    });
});
