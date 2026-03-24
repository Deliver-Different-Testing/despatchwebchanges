/** @jest-environment jest-environment-jsdom */
/**
 * useDriverLocations Hook Tests
 */

import {renderHook, waitFor, act} from '@testing-library/react';
import {useDriverLocations} from './useDriverLocations';
import {createTestQueryClient, createWrapper} from '../../../__testUtils__';

// Mock API modules
jest.mock('../../../services/dispatchApi', () => ({
    getDriverLocations: jest.fn(),
}));

import {getDriverLocations} from '../../../services/dispatchApi';

const mockGetDriverLocations = getDriverLocations as jest.MockedFunction<typeof getDriverLocations>;

const mockLocationData = {
    areas: [{
        id: 1,
        name: 'Area 1',
        order: 1,
        percentHeight: 100,
        top: [],
        middle: [],
        bottom: [],
        totalRemaining: 0,
        isActive: true,
    }],
};

describe('useDriverLocations', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        mockGetDriverLocations.mockResolvedValue(mockLocationData);
    });

    it('does not fetch when despatchViewIds is empty', () => {
        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        renderHook(() => useDriverLocations([]), {wrapper});

        expect(mockGetDriverLocations).not.toHaveBeenCalled();
    });

    it('fetches driver locations when view IDs are provided', async () => {
        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(() => useDriverLocations([1, 2]), {wrapper});

        await waitFor(() => {
            expect(result.current.driverLocations).toEqual(mockLocationData);
        });
        expect(mockGetDriverLocations).toHaveBeenCalledWith([1, 2], undefined, undefined);
    });

    it('truckMode defaults to On', () => {
        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(() => useDriverLocations([]), {wrapper});

        expect(result.current.truckMode).toBe('On');
    });

    it('setTruckMode updates truckMode', () => {
        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(() => useDriverLocations([]), {wrapper});

        act(() => {
            result.current.setTruckMode('Off' as any);
        });

        expect(result.current.truckMode).toBe('Off');
    });

    it('activeAreaId defaults to undefined', () => {
        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(() => useDriverLocations([]), {wrapper});

        expect(result.current.activeAreaId).toBeUndefined();
    });

    it('setActiveAreaId updates activeAreaId', () => {
        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(() => useDriverLocations([]), {wrapper});

        act(() => {
            result.current.setActiveAreaId(42);
        });

        expect(result.current.activeAreaId).toBe(42);
    });

    it('passes startDate and endDate to the API call', async () => {
        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const start = '2026-03-01T00:00:00.000Z';
        const end = '2026-03-15T23:59:59.000Z';

        renderHook(() => useDriverLocations([1], start, end), {wrapper});

        await waitFor(() => {
            expect(mockGetDriverLocations).toHaveBeenCalledWith([1], start, end);
        });
    });

    it('passes undefined dates when no date params provided', async () => {
        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});

        renderHook(() => useDriverLocations([1]), {wrapper});

        await waitFor(() => {
            expect(mockGetDriverLocations).toHaveBeenCalledWith([1], undefined, undefined);
        });
    });

    it('includes dates in the query key so date changes trigger refetch', async () => {
        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});

        const {rerender} = renderHook(
            ({viewIds, start, end}: { viewIds: number[]; start?: string; end?: string }) =>
                useDriverLocations(viewIds, start, end),
            {wrapper, initialProps: {viewIds: [1], start: '2026-03-01T00:00:00Z', end: '2026-03-15T00:00:00Z'}},
        );

        await waitFor(() => {
            expect(mockGetDriverLocations).toHaveBeenCalledTimes(1);
        });

        mockGetDriverLocations.mockClear();

        rerender({viewIds: [1], start: '2026-04-01T00:00:00Z', end: '2026-04-15T00:00:00Z'});

        await waitFor(() => {
            expect(mockGetDriverLocations).toHaveBeenCalledWith([1], '2026-04-01T00:00:00Z', '2026-04-15T00:00:00Z');
        });
    });
});
