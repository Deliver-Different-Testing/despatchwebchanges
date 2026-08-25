/**
 * Bulk Price API Handlers
 *
 * MSW handlers for bulk price upload API endpoints.
 */

import { http, HttpResponse } from 'msw';
import {rejectWithoutCsrf} from './requestGuards';
import type { BulkPricePreviewResponse } from '../../../components/dialogs/bulk-price-upload-dialog';

// Mock data
export const mockBulkPricePreviewResponse: BulkPricePreviewResponse = {
    rows: [
        {
            jobId: 100,
            jobNo: 'JOB-001',
            field: 'basePrice',
            oldAmount: 50.0,
            newAmount: 55.0,
            isPrebook: false,
        },
        {
            jobId: 200,
            jobNo: 'JOB-002',
            field: 'basePrice',
            oldAmount: 75.0,
            newAmount: 80.0,
            isPrebook: false,
        },
        {
            jobId: 300,
            jobNo: 'PRE-001',
            field: 'basePrice',
            oldAmount: 40.0,
            newAmount: 45.0,
            isPrebook: true,
        },
    ],
    totalJobs: 3,
    skippedJobs: 0,
    totalOldAmount: 165.0,
    totalNewAmount: 180.0,
};

export const bulkPriceHandlers = [
    // Apply bulk price update (FormData upload with pricingMode query param)
    http.post('*/job/ApplyBulkPriceUpdate', async ({ request }) => {
        const rejected = rejectWithoutCsrf(request);
        if (rejected) return rejected;

        const url = new URL(request.url);
        const pricingMode = url.searchParams.get('pricingMode');

        if (!pricingMode) {
            return new HttpResponse('Missing pricingMode parameter', { status: 400 });
        }

        // Verify FormData was sent
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
            return new HttpResponse('Missing file in form data', { status: 400 });
        }

        return HttpResponse.json(mockBulkPricePreviewResponse);
    }),
];
