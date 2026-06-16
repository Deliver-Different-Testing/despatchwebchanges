/**
 * Recurring Jobs API Handlers
 *
 * MSW handlers for recurring jobs API endpoints.
 */

import { http, HttpResponse } from 'msw';
import type { PaginatedRecurringJobsResponseDto, SpeedOption } from '../../../interfaces';

// Mock data
export const mockSpeedOptions: SpeedOption[] = [
    { id: 1, text: '1 Hour' },
    { id: 2, text: '2 Hour' },
    { id: 3, text: 'Same Day' },
    { id: 4, text: 'Overnight' },
];

export const mockPaginatedRecurringJobsResponse: PaginatedRecurringJobsResponseDto = {
    items: [
        {
            id: 1,
            booked: '2024-01-10T08:00:00Z',
            nextDueTime: '2024-01-22T09:00:00Z',
            client: 'ABC Ltd',
            jobNo: 'PRE-001',
            clientId: 50,
            courier: 'John Smith',
            speed: '1 Hour',
            customJobName: 'Daily pickup',
            pickupAddress: {
                addressLine1: 'ABC Office',
                addressLine2: '',
                addressLine3: '10',
                addressLine4: 'Main Street',
                addressLine5: 'Auckland',
                addressLine6: '',
                addressLine7: '1010',
                addressLine8: '',
                fullAddress: '10 Main Street, Auckland',
            },
            deliveryAddress: {
                addressLine1: 'XYZ Warehouse',
                addressLine2: '',
                addressLine3: '20',
                addressLine4: 'High Street',
                addressLine5: 'Auckland',
                addressLine6: '',
                addressLine7: '1020',
                addressLine8: '',
                fullAddress: '20 High Street, Auckland',
            },
        },
    ],
    total: 1,
    page: 1,
    pages: 1,
};

export const recurringJobsHandlers = [
    // Get paginated prebook jobs
    http.post('*/job/PreBookJobs', async ({ request }) => {
        if (request.headers.get('X-Requested-With') !== 'XMLHttpRequest') {
            return new HttpResponse('Missing CSRF header', { status: 400 });
        }

        const body = await request.json();
        if (!body || typeof body !== 'object') {
            return new HttpResponse('Invalid request body', { status: 400 });
        }

        return HttpResponse.json(mockPaginatedRecurringJobsResponse);
    }),

    // Get speed list
    http.get('*/job/SpeedList', () => {
        return HttpResponse.json(mockSpeedOptions);
    }),

    // Export recurring jobs to CSV
    http.post('*/job/RecurringJobsExportCsv', async ({ request }) => {
        if (request.headers.get('X-Requested-With') !== 'XMLHttpRequest') {
            return new HttpResponse('Missing CSRF header', { status: 400 });
        }

        const csvContent = 'JobNo,Client,Speed\nPRE-001,ABC Ltd,1 Hour\n';
        return new HttpResponse(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': 'attachment; filename="recurring-jobs-active.csv"',
            },
        });
    }),
];
