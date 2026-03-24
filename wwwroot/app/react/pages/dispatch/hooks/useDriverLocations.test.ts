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
});
