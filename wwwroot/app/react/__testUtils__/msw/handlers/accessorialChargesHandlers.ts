/**
 * Accessorial Charges API Handlers
 *
 * MSW handlers for accessorial charge API endpoints.
 */

import { http, HttpResponse } from 'msw';
import type { AccessorialChargeDto, JobAccessorialChargeDto } from '../../../components/dialogs/accessorial-charges-dialog/types';

// Mock data

export const mockAvailableCharges: AccessorialChargeDto[] = [
    {
        accessorialChargeId: 1,
        name: 'Tail Lift',
        description: 'Tail lift required for heavy items',
        chargeType: 'flat',
        baseRate: 25.00,
        calculationOrder: 1,
        alreadyApplied: false,
    },
    {
        accessorialChargeId: 2,
        name: 'Waiting Time',
        description: 'Charged per hour waited',
        chargeType: 'hourly',
        unitTypeId: 1,
        unitTypeName: 'Hour',
        ratePerUnit: 45.00,
        freeAllowance: 15,
        freeAllowanceUnitTypeId: 2,
        freeAllowanceUnitTypeName: 'Minute',
        calculationOrder: 2,
        alreadyApplied: false,
    },
    {
        accessorialChargeId: 3,
        name: 'Fuel Surcharge',
        description: 'Percentage of freight amount',
        chargeType: 'percentage',
        percentageRate: 8.5,
        calculationOrder: 10,
        alreadyApplied: true,
    },
];

export const mockAppliedCharges: JobAccessorialChargeDto[] = [
    {
        jobAccessorialChargeId: 101,
        jobId: 500,
        accessorialChargeId: 3,
        name: 'Fuel Surcharge',
        chargeType: 'percentage',
        percentageRate: 8.5,
        inputValue: 127.00,
        itemCount: 1,
        calculatedAmount: 10.80,
        calculationOrder: 10,
        addedAtStage: 'dispatch',
    },
];

export const mockJobAmount = 137.80;

export const accessorialChargesHandlers = [
    // Get available charges
    http.get('*/AccessorialCharge/GetAvailable', ({ request }) => {
        const url = new URL(request.url);
        const groupId = url.searchParams.get('accessorialChargeGroupId');
        const jobId = url.searchParams.get('jobId');

        if (!groupId || !jobId) {
            return new HttpResponse('Missing required parameters', { status: 400 });
        }

        return HttpResponse.json(mockAvailableCharges);
    }),

    // Get applied charges
    http.get('*/AccessorialCharge/GetApplied', ({ request }) => {
        const url = new URL(request.url);
        const jobId = url.searchParams.get('jobId');

        if (!jobId) {
            return new HttpResponse('Missing required parameters', { status: 400 });
        }

        return HttpResponse.json(mockAppliedCharges);
    }),

    // Get job amount
    http.get('*/AccessorialCharge/JobAmount', ({ request }) => {
        const url = new URL(request.url);
        const jobId = url.searchParams.get('jobId');

        if (!jobId) {
            return new HttpResponse('Missing required parameters', { status: 400 });
        }

        return HttpResponse.json(mockJobAmount);
    }),

    // Add charges to job
    http.post('*/AccessorialCharge/Add', async ({ request }) => {
        const url = new URL(request.url);
        const jobId = url.searchParams.get('jobId');

        if (!jobId) {
            return new HttpResponse('Missing jobId parameter', { status: 400 });
        }

        const body = await request.json();
        if (!Array.isArray(body)) {
            return new HttpResponse('Invalid request body', { status: 400 });
        }

        return HttpResponse.json({ success: true });
    }),

    // Update charge
    http.put('*/AccessorialCharge/Update', async ({ request }) => {
        const url = new URL(request.url);
        const chargeId = url.searchParams.get('jobAccessorialChargeId');

        if (!chargeId) {
            return new HttpResponse('Missing jobAccessorialChargeId parameter', { status: 400 });
        }

        const body = await request.json() as any;
        return HttpResponse.json({
            ...mockAppliedCharges[0],
            jobAccessorialChargeId: parseInt(chargeId),
            inputValue: body.inputValue,
        });
    }),

    // Delete charge
    http.delete('*/AccessorialCharge/Delete', ({ request }) => {
        const url = new URL(request.url);
        const chargeId = url.searchParams.get('jobAccessorialChargeId');

        if (!chargeId) {
            return new HttpResponse('Missing jobAccessorialChargeId parameter', { status: 400 });
        }

        return HttpResponse.json({ success: true });
    }),
];
