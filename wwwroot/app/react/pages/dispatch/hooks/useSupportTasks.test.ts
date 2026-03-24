/** @jest-environment jest-environment-jsdom */
/**
 * useSupportTasks Hook Tests
 */

import {renderHook, waitFor, act} from '@testing-library/react';
import {useSupportTasks} from './useSupportTasks';
import {createTestQueryClient, createWrapper} from '../../../__testUtils__';

// Mock API modules
jest.mock('../../../services/tasksApi', () => ({
    getAllTasks: jest.fn(),
    getActiveStaff: jest.fn(),
    getEventTypes: jest.fn(),
    markTaskAsClosed: jest.fn(),
}));

import {getAllTasks, getActiveStaff, getEventTypes, markTaskAsClosed} from '../../../services/tasksApi';

const mockGetAllTasks = getAllTasks as jest.MockedFunction<typeof getAllTasks>;
const mockGetActiveStaff = getActiveStaff as jest.MockedFunction<typeof getActiveStaff>;
const mockGetEventTypes = getEventTypes as jest.MockedFunction<typeof getEventTypes>;
const mockMarkTaskAsClosed = markTaskAsClosed as jest.MockedFunction<typeof markTaskAsClosed>;

const mockTasks = [{id: 1, title: 'Test Task'}];
const mockStaff = [{id: 10, text: 'Jane Doe'}];
const mockEventTypesList = [{id: 20, text: 'Follow Up'}];

describe('useSupportTasks', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        mockGetAllTasks.mockResolvedValue([]);
        mockGetActiveStaff.mockResolvedValue([]);
        mockGetEventTypes.mockResolvedValue([]);
        mockMarkTaskAsClosed.mockResolvedValue(undefined);
    });

    it('returns empty tasks when jobId is null', () => {
        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(() => useSupportTasks(null), {wrapper});

        expect(result.current.tasks).toEqual([]);
        expect(mockGetAllTasks).not.toHaveBeenCalled();
    });

    it('fetches tasks when jobId is provided', async () => {
        mockGetAllTasks.mockResolvedValue(mockTasks as any);

        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(() => useSupportTasks(100), {wrapper});

        await waitFor(() => {
            expect(result.current.tasks).toEqual(mockTasks);
        });
        expect(mockGetAllTasks).toHaveBeenCalled();
    });

    it('fetches staff list and event type list', async () => {
        mockGetActiveStaff.mockResolvedValue(mockStaff as any);
        mockGetEventTypes.mockResolvedValue(mockEventTypesList as any);

        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(() => useSupportTasks(100), {wrapper});

        await waitFor(() => {
            expect(result.current.staffList).toEqual(mockStaff);
            expect(result.current.eventTypeList).toEqual(mockEventTypesList);
        });
    });

    it('setStaffId updates filter and persists to localStorage', () => {
        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(() => useSupportTasks(100), {wrapper});

        act(() => {
            result.current.setStaffId(10);
        });

        expect(result.current.selectedStaffId).toBe(10);
        expect(localStorage.getItem('dispatch_supportStaffFilter')).toBe('10');
    });

    it('setEventTypeId updates filter and persists to localStorage', () => {
        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(() => useSupportTasks(100), {wrapper});

        act(() => {
            result.current.setEventTypeId(20);
        });

        expect(result.current.selectedEventTypeId).toBe(20);
        expect(localStorage.getItem('dispatch_supportEventTypeFilter')).toBe('20');
    });

    it('loads initial filter from localStorage', () => {
        localStorage.setItem('dispatch_supportStaffFilter', '10');
        localStorage.setItem('dispatch_supportEventTypeFilter', '20');

        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(() => useSupportTasks(100), {wrapper});

        expect(result.current.selectedStaffId).toBe(10);
        expect(result.current.selectedEventTypeId).toBe(20);
    });

    it('closeTask calls markTaskAsClosed and refetches', async () => {
        mockGetAllTasks.mockResolvedValue(mockTasks as any);
        mockMarkTaskAsClosed.mockResolvedValue(undefined);

        const queryClient = createTestQueryClient();
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        const {result} = renderHook(() => useSupportTasks(100), {wrapper});

        await waitFor(() => {
            expect(result.current.tasks).toEqual(mockTasks);
        });

        await act(async () => {
            await result.current.closeTask(1);
        });

        expect(mockMarkTaskAsClosed).toHaveBeenCalledWith(1, true);
    });
});
