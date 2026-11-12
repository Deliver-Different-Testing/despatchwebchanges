/**
 * Pricing Breakdown API Handlers
 *
 * MSW handlers for pricing breakdown API endpoints.
 */

import { http, HttpResponse } from 'msw';
import {csrfJsonPostHandler} from './csrfJsonPostHandler';
import {PriceBreakdown} from "../../../../types/priceBreakdown";


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
    csrfJsonPostHandler('*/job/AddPriceComponent', () => HttpResponse.json(42)),

    // Update price component
    csrfJsonPostHandler('*/job/UpdatePriceComponent'),

    // Delete price component
    csrfJsonPostHandler('*/job/DeletePriceComponent'),
];
