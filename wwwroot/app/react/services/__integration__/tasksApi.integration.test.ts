/**
 * Tasks API Integration Tests
 *
 * Tests the tasksApi service using MSW to intercept real HTTP requests.
 * Verifies correct endpoint URLs, request parameters, response handling,
 * and date transformations.
 */

import { server } from '../../__testUtils__/msw/server';
import { http, HttpResponse } from 'msw';
import { tasksApi } from '../tasksApi';
import {
    mockTaskApiResponses,
    mockDeliveryJourneyDtos,
} from '../../__testUtils__/msw/handlers';
import dayjs from 'dayjs';

describe('tasksApi integration', () => {
    describe('getAllTasks', () => {
        it('fetches all tasks and transforms dueDate to Dayjs', async () => {
            const result = await tasksApi.getAllTasks();

            expect(result).toHaveLength(3);
            expect(dayjs.isDayjs(result[0].dueDate)).toBe(true);
            expect(result[0].title).toBe('Follow up with client');
        });

        it('passes filter parameters correctly', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/task/GetAllTasks', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockTaskApiResponses);
                })
            );

            await tasksApi.getAllTasks({
                searchText: 'follow',
                staffId: 10,
                eventTypeId: 1,
                showCompleted: false,
            });

            expect(capturedUrl).toContain('searchText=follow');
            expect(capturedUrl).toContain('staffId=10');
            expect(capturedUrl).toContain('eventTypeId=1');
            expect(capturedUrl).toContain('showCompleted=false');
        });

        it('passes sorting parameters', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/task/GetAllTasks', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json([]);
                })
            );

            await tasksApi.getAllTasks({
                orderBy: 'dueDate',
                orderDirection: 'asc',
            });

            expect(capturedUrl).toContain('orderBy=dueDate');
            expect(capturedUrl).toContain('orderDirection=asc');
        });

        it('passes date range filters', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/task/GetAllTasks', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json([]);
                })
            );

            await tasksApi.getAllTasks({
                startDate: '2024-01-01',
                endDate: '2024-01-31',
            });

            expect(capturedUrl).toContain('startDate=2024-01-01');
            expect(capturedUrl).toContain('endDate=2024-01-31');
        });

        it('passes courierId and jobId filters', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/task/GetAllTasks', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json([]);
                })
            );

            await tasksApi.getAllTasks({
                courierId: 5,
                jobId: 100,
            });

            expect(capturedUrl).toContain('courierId=5');
            expect(capturedUrl).toContain('jobId=100');
        });

        it('returns empty array when no tasks exist', async () => {
            server.use(
                http.get('*/task/GetAllTasks', () => {
                    return HttpResponse.json([]);
                })
            );

            const result = await tasksApi.getAllTasks();

            expect(result).toHaveLength(0);
        });

        it('returns empty array when response is null', async () => {
            server.use(
                http.get('*/task/GetAllTasks', () => {
                    return HttpResponse.json(null);
                })
            );

            const result = await tasksApi.getAllTasks();

            expect(result).toHaveLength(0);
        });

        it('handles server errors', async () => {
            server.use(
                http.get('*/task/GetAllTasks', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(tasksApi.getAllTasks()).rejects.toMatchObject({
                status: 500,
            });
        });
    });

    describe('markTaskAsClosed', () => {
        it('closes a task with correct body', async () => {
            let capturedBody: unknown = null;

            server.use(
                http.post('*/task/MarkTaskAsClosed', async ({ request }) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await tasksApi.markTaskAsClosed(1, true);

            expect(capturedBody).toEqual({ eventId: 1, closed: true });
        });

        it('reopens a task', async () => {
            let capturedBody: unknown = null;

            server.use(
                http.post('*/task/MarkTaskAsClosed', async ({ request }) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await tasksApi.markTaskAsClosed(2, false);

            expect(capturedBody).toEqual({ eventId: 2, closed: false });
        });

        it('handles errors', async () => {
            server.use(
                http.post('*/task/MarkTaskAsClosed', () => {
                    return HttpResponse.json({ message: 'Task not found' }, { status: 404 });
                })
            );

            await expect(tasksApi.markTaskAsClosed(999, true)).rejects.toMatchObject({
                status: 404,
            });
        });
    });

    describe('updateTaskDate', () => {
        it('sends formatted date in request body', async () => {
            let capturedBody: unknown = null;

            server.use(
                http.post('*/task/UpdateTaskDate', async ({ request }) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            const date = dayjs('2024-02-15T10:00:00');
            await tasksApi.updateTaskDate(1, date);

            expect(capturedBody).toMatchObject({ eventId: 1 });
            expect((capturedBody as any).date).toBeDefined();
        });

        it('handles errors', async () => {
            server.use(
                http.post('*/task/UpdateTaskDate', () => {
                    return HttpResponse.json({ message: 'Invalid date' }, { status: 400 });
                })
            );

            await expect(tasksApi.updateTaskDate(1, dayjs())).rejects.toMatchObject({
                status: 400,
            });
        });
    });

    describe('updateTaskTime', () => {
        it('sends formatted time in request body', async () => {
            let capturedBody: unknown = null;

            server.use(
                http.post('*/task/UpdateTaskTime', async ({ request }) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            const time = dayjs('2024-02-15T14:30:00');
            await tasksApi.updateTaskTime(1, time);

            expect(capturedBody).toMatchObject({ eventId: 1 });
            expect((capturedBody as any).time).toBeDefined();
        });
    });

    describe('reassignTaskToStaff', () => {
        it('sends correct assignment request', async () => {
            let capturedBody: unknown = null;

            server.use(
                http.post('*/task/ReassignTask', async ({ request }) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await tasksApi.reassignTaskToStaff(1, 20);

            expect(capturedBody).toEqual({ eventId: 1, staffId: 20 });
        });

        it('handles errors', async () => {
            server.use(
                http.post('*/task/ReassignTask', () => {
                    return HttpResponse.json({ message: 'Staff not found' }, { status: 404 });
                })
            );

            await expect(tasksApi.reassignTaskToStaff(1, 999)).rejects.toMatchObject({
                status: 404,
            });
        });
    });

    describe('getActiveStaff', () => {
        it('fetches staff list', async () => {
            const result = await tasksApi.getActiveStaff();

            expect(result).toHaveLength(3);
            expect(result[0]).toEqual({ id: 10, text: 'John Smith' });
        });

        it('handles errors', async () => {
            server.use(
                http.get('*/task/GetStaff', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(tasksApi.getActiveStaff()).rejects.toMatchObject({
                status: 500,
            });
        });
    });

    describe('getEventTypes', () => {
        it('fetches event type list', async () => {
            const result = await tasksApi.getEventTypes();

            expect(result).toHaveLength(3);
            expect(result[0]).toEqual({ id: 1, text: 'Follow Up' });
        });
    });

    describe('getDeliveryJourney', () => {
        it('fetches and transforms delivery journey with Dayjs dates', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/job/GetDeliveryJourney', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockDeliveryJourneyDtos);
                })
            );

            const result = await tasksApi.getDeliveryJourney(100);

            expect(capturedUrl).toContain('jobId=100');
            expect(result).toHaveLength(3);
            expect(dayjs.isDayjs(result[0].date)).toBe(true);
            expect(result[0].title).toBe('Job Created');
            expect(result[2].status).toBe('current');
        });

        it('includes formatted date strings', async () => {
            const result = await tasksApi.getDeliveryJourney(100);

            expect(result[0]._dateStr).toBeDefined();
            expect(typeof result[0]._dateStr).toBe('string');
        });

        it('returns empty array when response is null', async () => {
            server.use(
                http.get('*/job/GetDeliveryJourney', () => {
                    return HttpResponse.json(null);
                })
            );

            const result = await tasksApi.getDeliveryJourney(100);

            expect(result).toHaveLength(0);
        });

        it('handles errors', async () => {
            server.use(
                http.get('*/job/GetDeliveryJourney', () => {
                    return HttpResponse.json({ message: 'Job not found' }, { status: 404 });
                })
            );

            await expect(tasksApi.getDeliveryJourney(999)).rejects.toMatchObject({
                status: 404,
            });
        });
    });
});
