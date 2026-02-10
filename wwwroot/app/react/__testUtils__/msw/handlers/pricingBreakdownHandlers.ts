/**
 * Pricing Breakdown API Handlers
 *
 * MSW handlers for pricing breakdown API endpoints.
 */

import { http, HttpResponse } from 'msw';
import type { PriceBreakdown } from '../../../services/pricingBreakdownApi';

// Mock data
export const mockPriceBreakdowns: PriceBreakdown[] = [
    {
        chargeId: 1,
        name: 'Base Rate',
        amount: 50.0,
        jobId: 100,
        costAmount: 35.0,
    },
    {
        chargeId: 2,
        name: 'Fuel Surcharge',
        amount: 7.5,
        jobId: 100,
        costAmount: 5.0,
    },
    {
        chargeId: 3,
        name: 'Weekend Premium',
        amount: 15.0,
        jobId: 100,
        costAmount: 10.0,
    },
];

export const pricingBreakdownHandlers = [
    // Get pricing breakdown
    http.get('*/job/GetPricingBreakdown', ({ request }) => {
        const url = new URL(request.url);
        const jobId = url.searchParams.get('jobId');

        if (!jobId) {
            return new HttpResponse('Missing jobId parameter', { status: 400 });
        }

        return HttpResponse.json(mockPriceBreakdowns);
    }),

    // Add price component (returns new chargeId)
    http.post('*/job/AddPriceComponent', async ({ request }) => {
        if (request.headers.get('X-Requested-With') !== 'XMLHttpRequest') {
            return new HttpResponse('Missing CSRF header', { status: 400 });
        }

        const body = await request.json();
        if (!body || typeof body !== 'object') {
            return new HttpResponse('Invalid request body', { status: 400 });
        }

        // Return new chargeId
        return HttpResponse.json(42);
    }),

    // Update price component
    http.post('*/job/UpdatePriceComponent', async ({ request }) => {
        if (request.headers.get('X-Requested-With') !== 'XMLHttpRequest') {
            return new HttpResponse('Missing CSRF header', { status: 400 });
        }

        const body = await request.json();
        if (!body || typeof body !== 'object') {
            return new HttpResponse('Invalid request body', { status: 400 });
        }

        return new HttpResponse(null, { status: 200 });
    }),

    // Delete price component
    http.post('*/job/DeletePriceComponent', async ({ request }) => {
        if (request.headers.get('X-Requested-With') !== 'XMLHttpRequest') {
            return new HttpResponse('Missing CSRF header', { status: 400 });
        }

        const body = await request.json();
        if (!body || typeof body !== 'object') {
            return new HttpResponse('Invalid request body', { status: 400 });
        }

        return new HttpResponse(null, { status: 200 });
    }),
];
