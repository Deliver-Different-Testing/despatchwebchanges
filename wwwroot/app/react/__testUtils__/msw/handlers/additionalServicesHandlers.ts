/**
 * Additional Services API Handlers
 *
 * MSW handlers for additional services API endpoints.
 */

import { http, HttpResponse } from 'msw';
import type { AdditionalService, PaginatedResponse } from '../../../components/dialogs/additional-services-dialog';

// Mock data

export const mockAdditionalServices: AdditionalService[] = [
    {
        itemId: 1,
        clientId: 42,
        name: 'Express Handling',
        description: 'Priority handling for time-sensitive items',
        perItem: false,
        rate: 15.00,
        onlyVan: false,
        selected: false,
    },
    {
        itemId: 2,
        clientId: 42,
        name: 'Tail Lift Required',
        description: 'Vehicle must have tail lift',
        perItem: true,
        rate: 25.00,
        onlyVan: true,
        selected: false,
    },
    {
        itemId: 3,
        clientId: 42,
        name: 'Dangerous Goods',
        description: 'Dangerous goods handling surcharge',
        perItem: false,
        rate: 50.00,
        onlyVan: false,
        selected: true,
    },
];

export const mockPaginatedServices: PaginatedResponse<AdditionalService> = {
    items: mockAdditionalServices,
    total: 3,
};

export const mockPpdExclusiveAmount = 90.91;

export const additionalServicesHandlers = [
    // Check if client has services available
    http.get('*/job/HasClientItemsAvailable', ({ request }) => {
        const url = new URL(request.url);
        const clientId = url.searchParams.get('clientId');
        const speedId = url.searchParams.get('speedId');

        if (!clientId || !speedId) {
            return new HttpResponse('Missing required parameters', { status: 400 });
        }

        return HttpResponse.json(true);
    }),

    // Get all client items (services)
    http.get('*/job/GetAllClientItems', ({ request }) => {
        const url = new URL(request.url);
        const clientId = url.searchParams.get('clientId');
        const speedId = url.searchParams.get('speedId');
        const jobId = url.searchParams.get('jobId');

        if (!clientId || !speedId || !jobId) {
            return new HttpResponse('Missing required parameters', { status: 400 });
        }

        return HttpResponse.json(mockPaginatedServices);
    }),

    // Calculate PPD exclusive amount
    http.get('*/job/PPDExclusiveAmount', ({ request }) => {
        const url = new URL(request.url);
        const clientId = url.searchParams.get('clientId');
        const amount = url.searchParams.get('amount');

        if (!clientId || !amount) {
            return new HttpResponse('Missing required parameters', { status: 400 });
        }

        return HttpResponse.json(mockPpdExclusiveAmount);
    }),

    // Add services to job
    http.post('*/job/AddClientItemsToJob', async ({ request }) => {
        const url = new URL(request.url);
        const jobId = url.searchParams.get('jobId');

        if (!jobId) {
            return new HttpResponse('Missing jobId parameter', { status: 400 });
        }

        const body = await request.json() as Record<string, unknown>;
        if (!body || !Array.isArray(body.serviceIds)) {
            return new HttpResponse('Invalid request body', { status: 400 });
        }

        return HttpResponse.json({ success: true });
    }),
];
