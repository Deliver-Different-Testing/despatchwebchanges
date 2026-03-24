/** @jest-environment jest-environment-jsdom */
/**
 * useCurrentWork Hook Tests
 */

import {renderHook, waitFor, act} from '@testing-library/react';
import {useCurrentWork} from './useCurrentWork';
import {createTestQueryClient, createWrapper} from '../../../__testUtils__';
import type {IDriverWorkOverview} from '../../../components/common/current-work-all-drivers/CurrentWorkAllDrivers.types';

// Mock API modules
jest.mock('../../../services/dispatchApi', () => ({
    getDriverWorkOverview: jest.fn(),
    createCurrentWorkFetchFn: jest.fn(),
}));

import {getDriverWorkOverview, createCurrentWorkFetchFn} from '../../../services/dispatchApi';

const mockGetDriverWorkOverview = getDriverWorkOverview as jest.MockedFunction<typeof getDriverWorkOverview>;
const mockCreateCurrentWorkFetchFn = createCurrentWorkFetchFn as jest.MockedFunction<typeof createCurrentWorkFetchFn>;

const mockDriver: IDriverWorkOverview = {
    courierId: 10,
    name: 'John Smith',
    jobCount: 5,
} as IDriverWorkOverview;

describe('useCurrentWork', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        mockGetDriverWorkOverview.mockResolvedValue([]);
        mockCreateCurrentWorkFetchFn.mockReturnValue(jest.fn());
    });

    it('initially in overview mode with empty drivers', () => {
        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(() => useCurrentWork(), {wrapper});

        expect(result.current.viewMode).toBe('overview');
        expect(result.current.drivers).toEqual([]);
        expect(result.current.selectedCourierId).toBeUndefined();
        expect(result.current.selectedDriverName).toBe('');
    });

    it('fetches driver overview data', async () => {
        mockGetDriverWorkOverview.mockResolvedValue([mockDriver]);

        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(() => useCurrentWork(), {wrapper});

        await waitFor(() => {
            expect(result.current.drivers).toEqual([mockDriver]);
        });
        expect(mockGetDriverWorkOverview).toHaveBeenCalled();
    });

    it('selectDriver switches to selectedDriver mode and sets driver name', async () => {
        mockGetDriverWorkOverview.mockResolvedValue([mockDriver]);

        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(() => useCurrentWork(), {wrapper});

        await waitFor(() => {
            expect(result.current.drivers).toHaveLength(1);
        });

        act(() => {
            result.current.selectDriver(mockDriver);
        });

        expect(result.current.viewMode).toBe('selectedDriver');
        expect(result.current.selectedCourierId).toBe(10);
        expect(result.current.selectedDriverName).toBe('John Smith');
    });

    it('backToOverview resets to overview mode', async () => {
        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(() => useCurrentWork(), {wrapper});

        act(() => {
            result.current.selectDriver(mockDriver);
        });
        expect(result.current.viewMode).toBe('selectedDriver');

        act(() => {
            result.current.backToOverview();
        });

        expect(result.current.viewMode).toBe('overview');
        expect(result.current.selectedCourierId).toBeUndefined();
        expect(result.current.selectedDriverName).toBe('');
        expect(result.current.currentWorkSelection).toBe('');
    });

    it('driverJobsFetchConfig is null in overview mode', () => {
        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(() => useCurrentWork(), {wrapper});

        expect(result.current.driverJobsFetchConfig).toBeNull();
    });

    it('driverJobsFetchConfig has fetchFn in selectedDriver mode', () => {
        const mockFetchFn = jest.fn();
        mockCreateCurrentWorkFetchFn.mockReturnValue(mockFetchFn);

        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(() => useCurrentWork(), {wrapper});

        act(() => {
            result.current.selectDriver(mockDriver);
        });

        expect(result.current.driverJobsFetchConfig).not.toBeNull();
        expect(result.current.driverJobsFetchConfig!.fetchFn).toBe(mockFetchFn);
        expect(mockCreateCurrentWorkFetchFn).toHaveBeenCalledWith(10);
    });

    it('currentWorkSelection shows driver name when selected', () => {
        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(() => useCurrentWork(), {wrapper});

        act(() => {
            result.current.selectDriver(mockDriver);
        });

        expect(result.current.currentWorkSelection).toBe(' - John Smith');
    });
});
