/**
 * Split Job API Handlers
 *
 * MSW handlers for split job API endpoints.
 */

import { http, HttpResponse } from 'msw';
import {rejectWithoutCsrf} from './requestGuards';

export const splitJobHandlers = [
    // Split a job
    http.post('*/job/splitJob', async ({ request }) => {
        const rejected = rejectWithoutCsrf(request);
        if (rejected) return rejected;

        const body = await request.json();
        if (!body || typeof body !== 'object') {
            return new HttpResponse('Invalid request body', { status: 400 });
        }

        const { jobId, meetingPointAddress } = body as { jobId?: number; meetingPointAddress?: unknown };
        if (typeof jobId !== 'number' || !meetingPointAddress) {
            return new HttpResponse('Invalid parameters', { status: 400 });
        }

        return new HttpResponse(null, { status: 200 });
    }),

    // Preview how the price divides across the legs (read-only)
    http.post('*/job/PreviewSplitPricing', async ({ request }) => {
        const rejected = rejectWithoutCsrf(request);
        if (rejected) return rejected;

        const body = await request.json();
        const { jobId, meetingPointAddress } = (body ?? {}) as {
            jobId?: number;
            meetingPointAddress?: unknown;
        };

        if (typeof jobId !== 'number' || !meetingPointAddress) {
            return new HttpResponse('Invalid parameters', { status: 400 });
        }

        return HttpResponse.json({
            basis: 'RoadMiles',
            distanceUnit: 'mi',
            parentTotalRevenue: 89,
            parentTotalCost: 50,
            isSynthesised: false,
            parentLines: [
                { pricingBreakdownId: 1, name: 'Base', revenue: 64, cost: 32, isAccessorial: false },
                { pricingBreakdownId: 2, name: 'Base Fuel', revenue: 16, cost: 12, isAccessorial: false },
                { pricingBreakdownId: 3, name: 'Congestion', revenue: 9, cost: 6, isAccessorial: true },
            ],
            legs: [
                {
                    sequence: 1,
                    letterSuffix: 'A',
                    jobNumber: 'KT1314VA',
                    distance: 5.6,
                    sharePercent: 70,
                    totalRevenue: 62.3,
                    totalCost: 35,
                    lines: [
                        { pricingBreakdownId: 1, name: 'Base Part A', revenue: 44.8, cost: 22.4 },
                        { pricingBreakdownId: 2, name: 'Base Fuel Part A', revenue: 11.2, cost: 8.4 },
                        { pricingBreakdownId: 3, name: 'Congestion Part A', revenue: 6.3, cost: 4.2 },
                    ],
                },
                {
                    sequence: 2,
                    letterSuffix: 'B',
                    jobNumber: 'KT1314VB',
                    distance: 2.4,
                    sharePercent: 30,
                    totalRevenue: 26.7,
                    totalCost: 15,
                    lines: [
                        { pricingBreakdownId: 1, name: 'Base Part B', revenue: 19.2, cost: 9.6 },
                        { pricingBreakdownId: 2, name: 'Base Fuel Part B', revenue: 4.8, cost: 3.6 },
                        { pricingBreakdownId: 3, name: 'Congestion Part B', revenue: 2.7, cost: 1.8 },
                    ],
                },
            ],
        });
    }),

    // Restore split jobs (uses repeated query params, null body)
    http.post('*/job/RestoreSplitJobs', ({ request }) => {
        const rejected = rejectWithoutCsrf(request);
        if (rejected) return rejected;

        const url = new URL(request.url);
        const jobIds = url.searchParams.getAll('jobIds');

        if (!jobIds || jobIds.length === 0) {
            return new HttpResponse('Missing jobIds parameter', { status: 400 });
        }

        return new HttpResponse(null, { status: 200 });
    }),

    // Un-split a job (query param, null body)
    http.post('*/job/UnSplitJob', ({ request }) => {
        const rejected = rejectWithoutCsrf(request);
        if (rejected) return rejected;

        const url = new URL(request.url);
        const jobId = url.searchParams.get('jobId');

        if (!jobId) {
            return new HttpResponse('Missing jobId parameter', { status: 400 });
        }

        return HttpResponse.json('Split successfully reversed');
    }),
];
