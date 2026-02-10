/**
 * Recurring Jobs API Integration Tests
 *
 * Tests the recurringJobsApi service using MSW to intercept real HTTP requests.
 * Verifies correct endpoint URLs, request parameters, response handling,
 * and CSV export functionality.
 */

import { server } from '../../__testUtils__/msw/setupIntegration';
import { http, HttpResponse } from 'msw';
import { recurringJobsApi } from '../recurringJobsApi';
import { mockPaginatedRecurringJobsResponse, mockSpeedOptions } from '../../__testUtils__/msw/handlers';
import type { RecurringJobQuery } from '../../interfaces';

const baseQuery: RecurringJobQuery = {
    order: 'booked',
    orderDirection: 'desc',
    limit: 25,
    page: 1,
    active: true,
};

describe('recurringJobsApi integration', () => {
    describe('getPreBookJobs', () => {
        it('fetches paginated jobs with correct body', async () => {
            let capturedBody: unknown = null;

            server.use(
                http.post('*/job/PreBookJobs', async ({ request }) => {
                    capturedBody = await request.json();
                    return HttpResponse.json(mockPaginatedRecurringJobsResponse);
                })
            );

            const result = await recurringJobsApi.getPreBookJobs(baseQuery);

            expect(capturedBody).toMatchObject({
                order: 'booked',
                orderDirection: 'desc',
                limit: 25,
                page: 1,
                active: true,
            });
            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(result.page).toBe(1);
        });

        it('transforms date strings to Date objects', async () => {
            const result = await recurringJobsApi.getPreBookJobs(baseQuery);

            expect(result.items[0].booked).toBeInstanceOf(Date);
            expect(result.items[0].nextDueTime).toBeInstanceOf(Date);
        });

        it('includes job details in response', async () => {
            const result = await recurringJobsApi.getPreBookJobs(baseQuery);

            expect(result.items[0]).toMatchObject({
                client: 'ABC Ltd',
                jobNo: 'PRE-001',
                speed: '1 Hour',
            });
        });

        it('handles server errors', async () => {
            server.use(
                http.post('*/job/PreBookJobs', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(recurringJobsApi.getPreBookJobs(baseQuery)).rejects.toMatchObject({
                status: 500,
            });
        });
    });

    describe('getSpeedList', () => {
        it('fetches speed options', async () => {
            const result = await recurringJobsApi.getSpeedList();

            expect(result).toHaveLength(4);
            expect(result[0]).toEqual({ id: 1, text: '1 Hour' });
        });

        it('handles errors', async () => {
            server.use(
                http.get('*/job/SpeedList', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(recurringJobsApi.getSpeedList()).rejects.toMatchObject({
                status: 500,
            });
        });
    });

    describe('voidPrebookJob', () => {
        it('voids a job with correct parameter', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/job/VoidPrebookJob', ({ request }) => {
                    capturedUrl = request.url;
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await recurringJobsApi.voidPrebookJob(123);

            expect(capturedUrl).toContain('jobId=123');
        });

        it('handles not found error', async () => {
            server.use(
                http.get('*/job/VoidPrebookJob', () => {
                    return HttpResponse.json({ message: 'Job not found' }, { status: 404 });
                })
            );

            await expect(recurringJobsApi.voidPrebookJob(999)).rejects.toMatchObject({
                status: 404,
            });
        });
    });

    describe('exportToCsv', () => {
        it('sends query and triggers download', async () => {
            let capturedBody: unknown = null;

            // Mock DOM methods for download
            const createElementSpy = jest.spyOn(document, 'createElement');
            const appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
            const removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
            const createObjectURLSpy = jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
            const revokeObjectURLSpy = jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

            server.use(
                http.post('*/job/RecurringJobsExportCsv', async ({ request }) => {
                    capturedBody = await request.json();
                    return new HttpResponse('JobNo,Client\nPRE-001,ABC', {
                        status: 200,
                        headers: {
                            'Content-Type': 'text/csv',
                            'Content-Disposition': 'attachment; filename="export.csv"',
                        },
                    });
                })
            );

            await recurringJobsApi.exportToCsv(baseQuery);

            expect(capturedBody).toMatchObject({ active: true });
            expect(createObjectURLSpy).toHaveBeenCalled();

            createElementSpy.mockRestore();
            appendChildSpy.mockRestore();
            removeChildSpy.mockRestore();
            createObjectURLSpy.mockRestore();
            revokeObjectURLSpy.mockRestore();
        });
    });
});
