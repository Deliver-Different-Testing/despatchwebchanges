/** @jest-environment jest-environment-jsdom */
/**
 * useDateFilter Hook Tests
 *
 * Tests for date filter state management and localStorage persistence.
 */

import {renderHook, act} from '@testing-library/react';
import {useDateFilter} from './useDateFilter';
import type {DateFilterData} from '../../../components/common/app-toolbar/ToolbarActions';
import dayjs from 'dayjs';

describe('useDateFilter', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    function createMockData(overrides?: Partial<DateFilterData>): DateFilterData {
        return {
            startDate: dayjs('2026-03-01T08:00:00.000Z'),
            endDate: dayjs('2026-03-02T17:00:00.000Z'),
            useTime: true,
            ...overrides,
        };
    }

    it('returns null dateFilterData initially', () => {
        const {result} = renderHook(() => useDateFilter());

        expect(result.current.dateFilterData).toBeNull();
    });

    it('updates dateFilterData state and persists to localStorage on onRefreshData', () => {
        const {result} = renderHook(() => useDateFilter());
        const mockData = createMockData();

        act(() => {
            result.current.onRefreshData(mockData);
        });

        // State is updated
        expect(result.current.dateFilterData).toBe(mockData);
        expect(result.current.dateFilterData!.startDate).toBe(mockData.startDate);
        expect(result.current.dateFilterData!.endDate).toBe(mockData.endDate);
        expect(result.current.dateFilterData!.useTime).toBe(true);

        // localStorage contains ISO strings
        const stored = JSON.parse(localStorage.getItem('dispatch_dateFilter')!);
        expect(stored).toEqual({
            startDate: '2026-03-01T08:00:00.000Z',
            endDate: '2026-03-02T17:00:00.000Z',
            useTime: true,
        });
    });

    it('updates state correctly across multiple calls', () => {
        const {result} = renderHook(() => useDateFilter());
        const firstData = createMockData();
        const secondData = createMockData({
            startDate: dayjs('2026-04-10T00:00:00.000Z'),
            endDate: dayjs('2026-04-11T23:59:59.000Z'),
            useTime: false,
        });

        act(() => {
            result.current.onRefreshData(firstData);
        });

        expect(result.current.dateFilterData).toBe(firstData);

        act(() => {
            result.current.onRefreshData(secondData);
        });

        expect(result.current.dateFilterData).toBe(secondData);
        expect(result.current.dateFilterData!.useTime).toBe(false);

        const stored = JSON.parse(localStorage.getItem('dispatch_dateFilter')!);
        expect(stored).toEqual({
            startDate: '2026-04-10T00:00:00.000Z',
            endDate: '2026-04-11T23:59:59.000Z',
            useTime: false,
        });
    });
});
