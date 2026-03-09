/**
 * Accessorial Charges API Integration Tests
 *
 * Tests the accessorialChargesApi service using MSW to intercept real HTTP requests.
 * Verifies correct endpoint URLs, request parameters, and response handling.
 */

import { server } from '../../__testUtils__/msw/server';
import { http, HttpResponse } from 'msw';
import { accessorialChargesApi } from '../accessorialChargesApi';
import { mockAvailableCharges, mockAppliedCharges, mockJobAmount } from '../../__testUtils__/msw/handlers';

describe('accessorialChargesApi integration', () => {
    describe('getAvailableCharges', () => {
        it('fetches available charges with correct parameters', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/AccessorialCharge/GetAvailable', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockAvailableCharges);
                })
            );

            const result = await accessorialChargesApi.getAvailableCharges(10, 500);

            expect(capturedUrl).toContain('accessorialChargeGroupId=10');
            expect(capturedUrl).toContain('jobId=500');
            expect(result).toHaveLength(3);
        });

        it('returns charge details correctly', async () => {
            const result = await accessorialChargesApi.getAvailableCharges(10, 500);

            expect(result[0]).toMatchObject({
                accessorialChargeId: 1,
                name: 'Tail Lift',
                chargeType: 'flat',
                baseRate: 25.00,
            });
        });

        it('handles server errors', async () => {
            server.use(
                http.get('*/AccessorialCharge/GetAvailable', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(
                accessorialChargesApi.getAvailableCharges(10, 500)
            ).rejects.toMatchObject({ status: 500 });
        });
    });

    describe('getAppliedCharges', () => {
        it('fetches applied charges with correct parameters', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/AccessorialCharge/GetApplied', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockAppliedCharges);
                })
            );

            const result = await accessorialChargesApi.getAppliedCharges(500);

            expect(capturedUrl).toContain('jobId=500');
            expect(result).toHaveLength(1);
        });

        it('returns applied charge details correctly', async () => {
            const result = await accessorialChargesApi.getAppliedCharges(500);

            expect(result[0]).toMatchObject({
                jobAccessorialChargeId: 101,
                name: 'Fuel Surcharge',
                chargeType: 'percentage',
                calculatedAmount: 10.80,
            });
        });

        it('handles empty results', async () => {
            server.use(
                http.get('*/AccessorialCharge/GetApplied', () => {
                    return HttpResponse.json([]);
                })
            );

            const result = await accessorialChargesApi.getAppliedCharges(500);

            expect(result).toHaveLength(0);
        });
    });

    describe('getJobAmount', () => {
        it('fetches job amount with correct parameters', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/AccessorialCharge/JobAmount', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockJobAmount);
                })
            );

            const result = await accessorialChargesApi.getJobAmount(500);

            expect(capturedUrl).toContain('jobId=500');
            expect(result).toBe(mockJobAmount);
        });

        it('handles server errors', async () => {
            server.use(
                http.get('*/AccessorialCharge/JobAmount', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(
                accessorialChargesApi.getJobAmount(500)
            ).rejects.toMatchObject({ status: 500 });
        });
    });

    describe('addCharges', () => {
        it('sends charges array in body and jobId as query parameter', async () => {
            let capturedUrl = '';
            let capturedBody: unknown = null;

            server.use(
                http.post('*/AccessorialCharge/Add', async ({ request }) => {
                    capturedUrl = request.url;
                    capturedBody = await request.json();
                    return HttpResponse.json({ success: true });
                })
            );

            const charges = [
                { accessorialChargeId: 1, itemCount: 1 },
                { accessorialChargeId: 2, inputValue: 2.5, itemCount: 1 },
            ];
            await accessorialChargesApi.addCharges(500, charges);

            expect(capturedUrl).toContain('jobId=500');
            expect(capturedBody).toEqual(charges);
        });

        it('sends CSRF header', async () => {
            let capturedCsrfHeader: string | null = null;

            server.use(
                http.post('*/AccessorialCharge/Add', ({ request }) => {
                    capturedCsrfHeader = request.headers.get('X-Requested-With');
                    return HttpResponse.json({ success: true });
                })
            );

            await accessorialChargesApi.addCharges(500, [{ accessorialChargeId: 1, itemCount: 1 }]);

            expect(capturedCsrfHeader).toBe('XMLHttpRequest');
        });

        it('handles errors', async () => {
            server.use(
                http.post('*/AccessorialCharge/Add', () => {
                    return HttpResponse.json({ message: 'Job not found' }, { status: 404 });
                })
            );

            await expect(
                accessorialChargesApi.addCharges(999, [])
            ).rejects.toMatchObject({ status: 404 });
        });
    });

    describe('updateCharge', () => {
        it('sends update data in body and charge ID as query parameter', async () => {
            let capturedUrl = '';
            let capturedBody: unknown = null;

            server.use(
                http.put('*/AccessorialCharge/Update', async ({ request }) => {
                    capturedUrl = request.url;
                    capturedBody = await request.json();
                    return HttpResponse.json({ ...mockAppliedCharges[0] });
                })
            );

            const updateData = { inputValue: 2.5, itemCount: 1, notes: 'test note' };
            await accessorialChargesApi.updateCharge(101, updateData);

            expect(capturedUrl).toContain('jobAccessorialChargeId=101');
            expect(capturedBody).toMatchObject(updateData);
        });

        it('returns updated charge', async () => {
            server.use(
                http.put('*/AccessorialCharge/Update', async () => {
                    return HttpResponse.json({ ...mockAppliedCharges[0], inputValue: 2.5 });
                })
            );

            const result = await accessorialChargesApi.updateCharge(101, { inputValue: 2.5, itemCount: 1 });

            expect(result.inputValue).toBe(2.5);
        });

        it('handles errors', async () => {
            server.use(
                http.put('*/AccessorialCharge/Update', () => {
                    return HttpResponse.json({ message: 'Charge not found' }, { status: 404 });
                })
            );

            await expect(
                accessorialChargesApi.updateCharge(999, { itemCount: 1 })
            ).rejects.toMatchObject({ status: 404 });
        });
    });

    describe('deleteCharge', () => {
        it('sends charge ID as query parameter', async () => {
            let capturedUrl = '';

            server.use(
                http.delete('*/AccessorialCharge/Delete', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json({ success: true });
                })
            );

            await accessorialChargesApi.deleteCharge(101);

            expect(capturedUrl).toContain('jobAccessorialChargeId=101');
        });

        it('handles errors', async () => {
            server.use(
                http.delete('*/AccessorialCharge/Delete', () => {
                    return HttpResponse.json({ message: 'Charge not found' }, { status: 404 });
                })
            );

            await expect(
                accessorialChargesApi.deleteCharge(999)
            ).rejects.toMatchObject({ status: 404 });
        });
    });
});
