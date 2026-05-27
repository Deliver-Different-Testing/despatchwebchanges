/** @jest-environment node */
/**
 * Tasks API Service Tests
 */

import dayjs from 'dayjs';
import {
    tasksApi,
    getAllTasks,
    markTaskAsClosed,
    updateTaskDate,
    updateTaskTime,
    reassignTaskToStaff,
    getActiveStaff,
    getEventTypes,
    getDeliveryJourney,
} from './tasksApi';
import {apiClient} from './apiClient';
import {TaskApiResponse, StaffSuggestion, EventTypeSuggestion} from '../interfaces';
import {DeliveryJourneyDto} from '../components/common/task-history/TaskHistory.interfaces';

// Mock the apiClient
jest.mock('./apiClient', () => ({
    apiClient: {
        get: jest.fn(),
        post: jest.fn(),
    },
}));

// Mock date utilities
jest.mock('../utils/dateUtils', () => ({
    formatDateForApi: jest.fn((date) => date.toISOString()),
    parseDateFromApi: jest.fn((dateStr) => dayjs(dateStr)),
    formatRelativeDateTime: jest.fn((dateStr) => dateStr),
    formatLongDate: jest.fn((date) => date.format('MMM/DD/YYYY')),
    formatTime: jest.fn((date) => date.format('HH:mm')),
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('tasksApi', () => {
    describe('getAllTasks', () => {
        const mockTaskResponse: TaskApiResponse[] = [
            {
                id: 1,
                title: 'Follow up call',
                description: 'Call customer about delivery',
                dueDate: '2024-01-15T10:00:00Z',
                closed: false,
                assignee: {id: 5, text: 'John Doe'},
                jobId: 100,
                eventType: 'Call',
                jobNumber: 'JOB-100',
            },
            {
                id: 2,
                title: 'Email reminder',
                description: 'Send reminder email',
                dueDate: '2024-01-16T14:00:00Z',
                closed: true,
                assignee: {id: 6, text: 'Jane Smith'},
                jobId: 101,
                eventType: 'Email',
                jobNumber: 'JOB-101',
            },
        ];

        it('should call apiClient.get with correct URL and no params when no filters', async () => {
            mockApiClient.get.mockResolvedValueOnce(mockTaskResponse);

            const result = await getAllTasks();

            expect(mockApiClient.get).toHaveBeenCalledWith('task/GetAllTasks', {}, undefined);
            expect(result).toHaveLength(2);
            expect(result[0].id).toBe(1);
            expect(dayjs.isDayjs(result[0].dueDate)).toBe(true);
        });

        it.each([
            ['searchText', {searchText: 'follow up'}],
            ['staffId', {staffId: 5}],
            ['eventTypeId', {eventTypeId: 2}],
            ['date range', {startDate: '2024-01-01', endDate: '2024-01-31'}],
            ['showCompleted', {showCompleted: true}],
            ['sorting', {orderBy: 'dueDate', orderDirection: 'desc'}],
            ['courierId', {courierId: 10}],
            ['jobId', {jobId: 123}],
        ])('should pass %s filter', async (_, filters) => {
            mockApiClient.get.mockResolvedValueOnce([]);
            await getAllTasks(filters);
            expect(mockApiClient.get).toHaveBeenCalledWith('task/GetAllTasks', filters, undefined);
        });

        it('should pass multiple filters together', async () => {
            mockApiClient.get.mockResolvedValueOnce([]);

            await getAllTasks({
                searchText: 'test',
                staffId: 5,
                eventTypeId: 1,
                startDate: '2024-01-01',
                endDate: '2024-01-31',
                showCompleted: false,
                orderBy: 'staffName',
                orderDirection: 'asc',
            });

            expect(mockApiClient.get).toHaveBeenCalledWith('task/GetAllTasks', {
                searchText: 'test',
                staffId: 5,
                eventTypeId: 1,
                startDate: '2024-01-01',
                endDate: '2024-01-31',
                showCompleted: false,
                orderBy: 'staffName',
                orderDirection: 'asc',
            }, undefined);
        });

        it('should return empty array when API returns null', async () => {
            mockApiClient.get.mockResolvedValueOnce(null);

            const result = await getAllTasks();

            expect(result).toEqual([]);
        });

        it('should propagate errors from apiClient', async () => {
            const error = {status: 500, statusText: 'Internal Server Error', message: 'Server error'};
            mockApiClient.get.mockRejectedValueOnce(error);

            await expect(getAllTasks()).rejects.toEqual(error);
        });
    });

    describe('markTaskAsClosed', () => {
        it('should call apiClient.post with correct URL and closed=true', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await markTaskAsClosed(123, true);

            expect(mockApiClient.post).toHaveBeenCalledWith('task/MarkTaskAsClosed', {
                eventId: 123,
                closed: true,
            });
        });

        it('should call apiClient.post with correct URL and closed=false', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await markTaskAsClosed(456, false);

            expect(mockApiClient.post).toHaveBeenCalledWith('task/MarkTaskAsClosed', {
                eventId: 456,
                closed: false,
            });
        });

        it('should propagate errors from apiClient', async () => {
            const error = {status: 400, statusText: 'Bad Request', message: 'Invalid event'};
            mockApiClient.post.mockRejectedValueOnce(error);

            await expect(markTaskAsClosed(123, true)).rejects.toEqual(error);
        });
    });

    describe('updateTaskDate', () => {
        it('should call apiClient.post with correct URL and formatted date', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);
            const testDate = dayjs('2024-01-20');

            await updateTaskDate(123, testDate);

            expect(mockApiClient.post).toHaveBeenCalledWith('task/UpdateTaskDate', {
                eventId: 123,
                date: expect.any(String),
            });
        });

        it('should propagate errors from apiClient', async () => {
            const error = {status: 400, statusText: 'Bad Request', message: 'Invalid date'};
            mockApiClient.post.mockRejectedValueOnce(error);

            await expect(updateTaskDate(123, dayjs())).rejects.toEqual(error);
        });
    });

    describe('updateTaskTime', () => {
        it('should call apiClient.post with correct URL and formatted time', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);
            const testTime = dayjs('2024-01-20T14:30:00');

            await updateTaskTime(123, testTime);

            expect(mockApiClient.post).toHaveBeenCalledWith('task/UpdateTaskTime', {
                eventId: 123,
                time: expect.any(String),
            });
        });

        it('should propagate errors from apiClient', async () => {
            const error = {status: 400, statusText: 'Bad Request', message: 'Invalid time'};
            mockApiClient.post.mockRejectedValueOnce(error);

            await expect(updateTaskTime(123, dayjs())).rejects.toEqual(error);
        });
    });

    describe('reassignTaskToStaff', () => {
        it('should call apiClient.post with correct URL and request body', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await reassignTaskToStaff(123, 456);

            expect(mockApiClient.post).toHaveBeenCalledWith('task/ReassignTask', {
                eventId: 123,
                staffId: 456,
            });
        });

        it('should propagate errors from apiClient', async () => {
            const error = {status: 400, statusText: 'Bad Request', message: 'Invalid staff'};
            mockApiClient.post.mockRejectedValueOnce(error);

            await expect(reassignTaskToStaff(123, 456)).rejects.toEqual(error);
        });
    });

    describe('getActiveStaff', () => {
        const mockStaffResponse: StaffSuggestion[] = [
            {id: 1, text: 'John Doe'},
            {id: 2, text: 'Jane Smith'},
            {id: 3, text: 'Bob Wilson'},
        ];

        it('should call apiClient.get with correct URL', async () => {
            mockApiClient.get.mockResolvedValueOnce(mockStaffResponse);

            const result = await getActiveStaff();

            expect(mockApiClient.get).toHaveBeenCalledWith('task/GetStaff', undefined, undefined);
            expect(result).toEqual(mockStaffResponse);
        });

        it('should propagate errors from apiClient', async () => {
            const error = {status: 500, statusText: 'Internal Server Error', message: 'Server error'};
            mockApiClient.get.mockRejectedValueOnce(error);

            await expect(getActiveStaff()).rejects.toEqual(error);
        });
    });

    describe('getEventTypes', () => {
        const mockEventTypesResponse: EventTypeSuggestion[] = [
            {id: 1, text: 'Call'},
            {id: 2, text: 'Email'},
            {id: 3, text: 'Meeting'},
        ];

        it('should call apiClient.get with correct URL', async () => {
            mockApiClient.get.mockResolvedValueOnce(mockEventTypesResponse);

            const result = await getEventTypes();

            expect(mockApiClient.get).toHaveBeenCalledWith('job/EventTypeList', undefined, undefined);
            expect(result).toEqual(mockEventTypesResponse);
        });

        it('should propagate errors from apiClient', async () => {
            const error = {status: 500, statusText: 'Internal Server Error', message: 'Server error'};
            mockApiClient.get.mockRejectedValueOnce(error);

            await expect(getEventTypes()).rejects.toEqual(error);
        });
    });

    describe('getDeliveryJourney', () => {
        const mockDeliveryJourneyResponse: DeliveryJourneyDto[] = [
            {
                id: '1',
                jobId: 123,
                title: 'Package picked up',
                icon: 'local_shipping',
                description: 'Package picked up from sender',
                date: '2024-01-15T10:00:00Z',
                tags: ['pickup'],
                status: 'completed',
                notes: '',
            },
            {
                id: '2',
                jobId: 123,
                title: 'In transit',
                icon: 'directions_car',
                description: 'Package in transit',
                date: '2024-01-15T14:00:00Z',
                tags: ['transit'],
                status: 'completed',
                notes: '',
            },
            {
                id: '3',
                jobId: 123,
                title: 'Delivered',
                icon: 'check_circle',
                description: 'Package delivered to recipient',
                date: '2024-01-16T09:00:00Z',
                tags: ['delivered'],
                status: 'completed',
                notes: 'Signed by recipient',
            },
        ];

        it('should call apiClient.get with correct URL and jobId', async () => {
            mockApiClient.get.mockResolvedValueOnce(mockDeliveryJourneyResponse);

            const result = await getDeliveryJourney(123);

            expect(mockApiClient.get).toHaveBeenCalledWith('job/GetDeliveryJourney', {jobId: 123}, undefined);
            expect(result).toHaveLength(3);
            expect(result[0].title).toBe('Package picked up');
        });

        it('should return empty array when API returns null', async () => {
            mockApiClient.get.mockResolvedValueOnce(null);

            const result = await getDeliveryJourney(123);

            expect(result).toEqual([]);
        });

        it('should propagate errors from apiClient', async () => {
            const error = {status: 404, statusText: 'Not Found', message: 'Job not found'};
            mockApiClient.get.mockRejectedValueOnce(error);

            await expect(getDeliveryJourney(999)).rejects.toEqual(error);
        });
    });

    describe('tasksApi object', () => {
        it('should export all functions', () => {
            expect(tasksApi.getAllTasks).toBe(getAllTasks);
            expect(tasksApi.markTaskAsClosed).toBe(markTaskAsClosed);
            expect(tasksApi.updateTaskDate).toBe(updateTaskDate);
            expect(tasksApi.updateTaskTime).toBe(updateTaskTime);
            expect(tasksApi.reassignTaskToStaff).toBe(reassignTaskToStaff);
            expect(tasksApi.getActiveStaff).toBe(getActiveStaff);
            expect(tasksApi.getEventTypes).toBe(getEventTypes);
            expect(tasksApi.getDeliveryJourney).toBe(getDeliveryJourney);
        });
    });
});
