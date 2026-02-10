/**
 * Additional Services API Handlers
 *
 * MSW handlers for additional services API endpoints.
 */

import { http, HttpResponse } from 'msw';
import type { AdditionalService } from '../../../components/dialogs/additional-services-dialog/types';

// Mock data
export const mockAdditionalServices: AdditionalService[] = [
    {
        itemId: 1,
        clientId: 50,
        name: 'Tail Lift',
        description: 'Tail lift required for heavy items',
        perItem: false,
        rate: 25.0,
        onlyVan: true,
        selected: false,
    },
    {
        itemId: 2,
        clientId: 50,
        name: 'Signature Required',
        description: 'Signature on delivery',
        perItem: false,
        rate: 5.0,
        onlyVan: false,
        selected: true,
    },
    {
        itemId: 3,
        clientId: 50,
        name: 'Packaging',
        description: 'Custom packaging per item',
        perItem: true,
        rate: 3.5,
        onlyVan: false,
        selected: false,
    },
];

export const additionalServicesHandlers = [
    // Check if client has items available
    http.get('*/job/HasClientItemsAvailable', ({ request }) => {
        const url = new URL(request.url);
        const clientId = url.searchParams.get('clientId');
        const speedId = url.searchParams.get('speedId');

        if (!clientId || !speedId) {
            return new HttpResponse('Missing required parameters', { status: 400 });
        }

        return HttpResponse.json(true);
    }),

    // Get all client items
    http.get('*/job/GetAllClientItems', ({ request }) => {
        const url = new URL(request.url);
        const clientId = url.searchParams.get('clientId');
        const speedId = url.searchParams.get('speedId');
        const jobId = url.searchParams.get('jobId');

        if (!clientId || !speedId || !jobId) {
            return new HttpResponse('Missing required parameters', { status: 400 });
        }

        return HttpResponse.json({
            items: mockAdditionalServices,
            total: mockAdditionalServices.length,
        });
    }),

    // Calculate PPD exclusive amount
    http.get('*/job/PPDExclusiveAmount', ({ request }) => {
        const url = new URL(request.url);
        const clientId = url.searchParams.get('clientId');
        const amount = url.searchParams.get('amount');

        if (!clientId || !amount) {
            return new HttpResponse('Missing required parameters', { status: 400 });
        }

        // Return amount minus 15% GST
        const exclusiveAmount = parseFloat(amount) / 1.15;
        return HttpResponse.json(Math.round(exclusiveAmount * 100) / 100);
    }),

    // Add client items to job (body + jobId query param)
    http.post('*/job/AddClientItemsToJob', async ({ request }) => {
        if (request.headers.get('X-Requested-With') !== 'XMLHttpRequest') {
            return new HttpResponse('Missing CSRF header', { status: 400 });
        }

        const url = new URL(request.url);
        const jobId = url.searchParams.get('jobId');

        if (!jobId) {
            return new HttpResponse('Missing jobId parameter', { status: 400 });
        }

        const body = await request.json();
        if (!body || typeof body !== 'object') {
            return new HttpResponse('Invalid request body', { status: 400 });
        }

        return new HttpResponse(null, { status: 200 });
    }),
];
