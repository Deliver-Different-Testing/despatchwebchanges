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

function renderCurrentWork(isUsCustomer: boolean) {
    const queryClient = createTestQueryClient();
    const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
    return renderHook(() => useCurrentWork(isUsCustomer), {wrapper});
}

describe('useCurrentWork', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        mockGetDriverWorkOverview.mockResolvedValue([]);
        mockCreateCurrentWorkFetchFn.mockReturnValue(jest.fn());
    });

    // ── US tenant (has driver overview) ─────────────────────────────────

    describe('US tenant (isUsCustomer=true)', () => {
        it('initially in overview mode with empty drivers', () => {
            const {result} = renderCurrentWork(true);

            expect(result.current.viewMode).toBe('overview');
            expect(result.current.drivers).toEqual([]);
            expect(result.current.selectedCourierId).toBeUndefined();
            expect(result.current.selectedDriverName).toBe('');
        });

        it('fetches driver overview data', async () => {
            mockGetDriverWorkOverview.mockResolvedValue([mockDriver]);
            const {result} = renderCurrentWork(true);

            await waitFor(() => {
                expect(result.current.drivers).toEqual([mockDriver]);
            });
            expect(mockGetDriverWorkOverview).toHaveBeenCalled();
        });

        it('selectDriver switches to selectedDriver mode and sets driver name', async () => {
            mockGetDriverWorkOverview.mockResolvedValue([mockDriver]);
            const {result} = renderCurrentWork(true);

            await waitFor(() => {
                expect(result.current.drivers).toHaveLength(1);
            });

            act(() => result.current.selectDriver(mockDriver));

            expect(result.current.viewMode).toBe('selectedDriver');
            expect(result.current.selectedCourierId).toBe(10);
            expect(result.current.selectedDriverName).toBe('John Smith');
        });

        it('backToOverview resets to overview mode', () => {
            const {result} = renderCurrentWork(true);

            act(() => result.current.selectDriver(mockDriver));
            expect(result.current.viewMode).toBe('selectedDriver');

            act(() => result.current.backToOverview());

            expect(result.current.viewMode).toBe('overview');
            expect(result.current.selectedCourierId).toBeUndefined();
            expect(result.current.selectedDriverName).toBe('');
            expect(result.current.currentWorkSelection).toBe('');
        });

        it('driverJobsFetchConfig is null in overview mode', () => {
            const {result} = renderCurrentWork(true);
            expect(result.current.driverJobsFetchConfig).toBeNull();
        });

        it('driverJobsFetchConfig has fetchFn in selectedDriver mode', () => {
            const mockFetchFn = jest.fn();
            mockCreateCurrentWorkFetchFn.mockReturnValue(mockFetchFn);
            const {result} = renderCurrentWork(true);

            act(() => result.current.selectDriver(mockDriver));

            expect(result.current.driverJobsFetchConfig).not.toBeNull();
            expect(result.current.driverJobsFetchConfig!.fetchFn).toBe(mockFetchFn);
            expect(mockCreateCurrentWorkFetchFn).toHaveBeenCalledWith(10);
        });

        it('currentWorkSelection shows driver name when selected', () => {
            const {result} = renderCurrentWork(true);

            act(() => result.current.selectDriver(mockDriver));

            expect(result.current.currentWorkSelection).toBe(' - John Smith');
        });
    });

    // ── NZ tenant (no driver overview) ──────────────────────────────────

    describe('NZ tenant (isUsCustomer=false)', () => {
        it('initially in selectedDriver mode (skips overview)', () => {
            const {result} = renderCurrentWork(false);

            expect(result.current.viewMode).toBe('selectedDriver');
            expect(result.current.selectedCourierId).toBeUndefined();
        });

        it('does NOT fetch driver overview data', async () => {
            const {result} = renderCurrentWork(false);

            // Give React Query a tick to potentially fire
            await waitFor(() => {
                expect(result.current.drivers).toEqual([]);
            });

            expect(mockGetDriverWorkOverview).not.toHaveBeenCalled();
        });

        it('selectDriver sets courier and stays in selectedDriver mode', () => {
            const {result} = renderCurrentWork(false);

            act(() => result.current.selectDriver(mockDriver));

            expect(result.current.viewMode).toBe('selectedDriver');
            expect(result.current.selectedCourierId).toBe(10);
            expect(result.current.selectedDriverName).toBe('John Smith');
        });

        it('backToOverview clears selection but stays in selectedDriver mode', () => {
            const {result} = renderCurrentWork(false);

            act(() => result.current.selectDriver(mockDriver));
            act(() => result.current.backToOverview());

            expect(result.current.viewMode).toBe('selectedDriver');
            expect(result.current.selectedCourierId).toBeUndefined();
            expect(result.current.selectedDriverName).toBe('');
            expect(result.current.currentWorkSelection).toBe('');
        });

        it('driverJobsFetchConfig is null when no driver selected', () => {
            const {result} = renderCurrentWork(false);
            expect(result.current.driverJobsFetchConfig).toBeNull();
        });

        it('driverJobsFetchConfig has fetchFn when driver selected', () => {
            const mockFetchFn = jest.fn();
            mockCreateCurrentWorkFetchFn.mockReturnValue(mockFetchFn);
            const {result} = renderCurrentWork(false);

            act(() => result.current.selectDriver(mockDriver));

            expect(result.current.driverJobsFetchConfig).not.toBeNull();
            expect(result.current.driverJobsFetchConfig!.fetchFn).toBe(mockFetchFn);
        });
    });
});
