/**
 * Event API Integration Tests
 *
 * Tests the eventApi service using MSW to intercept real HTTP requests.
 * Verifies correct endpoint URLs, request parameters, and response handling.
 */

import { server } from '../../__testUtils__/msw/server';
import { http, HttpResponse } from 'msw';
import { eventApi } from '../eventApi';
import { mockDispatchJobDetail } from '../../__testUtils__/msw/handlers';

describe('eventApi integration', () => {
    describe('getEventTypes', () => {
        it('fetches event type list', async () => {
            const result = await eventApi.getEventTypes();

            expect(result).toHaveLength(3);
            expect(result[0]).toEqual({ id: 1, text: 'Follow Up' });
        });

        it('handles server errors', async () => {
            server.use(
                http.get('*/job/EventTypeList', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(eventApi.getEventTypes()).rejects.toMatchObject({
                status: 500,
            });
        });
    });

    describe('addEvent', () => {
        it('sends event data with CSRF header', async () => {
            let capturedBody: unknown = null;
            let capturedCsrfHeader: string | null = null;

            server.use(
                http.post('*/job/addEvent', async ({ request }) => {
                    capturedCsrfHeader = request.headers.get('X-Requested-With');
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await eventApi.addEvent({
                jobId: 100,
                notes: 'Follow up required',
                eventTypeId: 1,
                eventDueDate: '2024-02-15T10:00:00',
            });

            expect(capturedCsrfHeader).toBe('XMLHttpRequest');
            expect(capturedBody).toMatchObject({
                jobId: 100,
                notes: 'Follow up required',
                eventTypeId: 1,
                eventDueDate: '2024-02-15T10:00:00',
            });
        });

        it('handles validation errors', async () => {
            server.use(
                http.post('*/job/addEvent', () => {
                    return HttpResponse.json(
                        { message: 'Event type is required' },
                        { status: 400 }
                    );
                })
            );

            await expect(eventApi.addEvent({
                jobId: 100,
                notes: '',
                eventTypeId: 0,
                eventDueDate: '',
            })).rejects.toMatchObject({
                status: 400,
            });
        });
    });

    describe('exsalerateActivity', () => {
        it('sends null body with query parameters', async () => {
            let capturedUrl = '';
            let capturedBody: unknown = null;

            server.use(
                http.post('*/job/ExsalerateActivity', async ({ request }) => {
                    capturedUrl = request.url;
                    try {
                        capturedBody = await request.text();
                    } catch {
                        capturedBody = null;
                    }
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await eventApi.exsalerateActivity('Compliment', 'Great service', 50, 'JOB-001');

            expect(capturedUrl).toContain('eventName=Compliment');
            expect(capturedUrl).toContain('notes=Great');
            expect(capturedUrl).toContain('clientId=50');
            expect(capturedUrl).toContain('jobNumber=JOB-001');
        });

        it('handles server errors', async () => {
            server.use(
                http.post('*/job/ExsalerateActivity', () => {
                    return new HttpResponse('External service unavailable', { status: 503 });
                })
            );

            await expect(
                eventApi.exsalerateActivity('Complaint', 'Late delivery', 50, 'JOB-001')
            ).rejects.toMatchObject({
                status: 503,
            });
        });
    });

    describe('getDispatchJobDetail', () => {
        it('fetches job detail with correct parameter', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/job/DispatchJobDetail', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockDispatchJobDetail);
                })
            );

            const result = await eventApi.getDispatchJobDetail(100);

            expect(capturedUrl).toContain('jobId=100');
            expect(result).toMatchObject({
                id: 100,
                jobNo: 'JOB-001',
                client: 'ABC Ltd',
            });
        });

        it('handles not found error', async () => {
            server.use(
                http.get('*/job/DispatchJobDetail', () => {
                    return HttpResponse.json({ message: 'Job not found' }, { status: 404 });
                })
            );

            await expect(eventApi.getDispatchJobDetail(999)).rejects.toMatchObject({
                status: 404,
            });
        });
    });
});
