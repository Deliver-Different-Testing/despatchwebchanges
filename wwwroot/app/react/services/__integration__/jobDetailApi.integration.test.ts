/** @jest-environment jest-fixed-jsdom */
/**
 * Job Detail API Integration Tests
 *
 * Tests the jobDetailApi service using MSW to intercept real HTTP requests.
 * Verifies correct endpoint URLs, request parameters, and response handling.
 */

import { server } from '../../__testUtils__/msw/setupIntegration';
import { http, HttpResponse } from 'msw';
import {
    getJobDetail,
    getRecurringJobDetail,
    getBulkJobDetail,
    updateJobDetail,
    updateBulkJobDetail,
    updatePickupAddress,
    updateDeliveryAddress,
    updatePodDetails,
    updateJobReadStatus,
    getJobDeliveryPhotos,
    getJobPickupPhotos,
    getStatusList,
    getSpeedList,
    getLeaveList,
    getContactList,
    restoreJobs,
    allocateJob,
    getCourierById,
    downloadFile,
    getPodReportUrl,
    getPodSpreadsheetUrl,
    autocompleteSearch,
} from '../jobDetailApi';

const mockJobDetail = {
    jobId: 123,
    jobNumber: 'JOB-123',
    status: 'Active',
    clientName: 'Test Client',
};

const mockPhotos = [
    { key: 'photo1.jpg', url: 'https://s3.example.com/photo1.jpg' },
    { key: 'photo2.jpg', url: 'https://s3.example.com/photo2.jpg' },
];

const mockSuggestions = [
    { id: 1, text: 'Option A' },
    { id: 2, text: 'Option B' },
];

describe('jobDetailApi integration', () => {
    // ── Job Detail Fetching ─────────────────────────────────────────

    describe('getJobDetail', () => {
        it('fetches job detail with correct jobId parameter', async () => {
            let capturedUrl = '';
            server.use(
                http.get('*/job/Detail', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockJobDetail);
                })
            );

            const result = await getJobDetail(123);

            expect(capturedUrl).toContain('jobId=123');
            expect(result).toMatchObject({ jobId: 123, jobNumber: 'JOB-123' });
        });

        it('handles not found error', async () => {
            server.use(
                http.get('*/job/Detail', () => {
                    return HttpResponse.json({ message: 'Job not found' }, { status: 404 });
                })
            );

            await expect(getJobDetail(999)).rejects.toMatchObject({ status: 404 });
        });
    });

    describe('getRecurringJobDetail', () => {
        it('fetches recurring job detail with correct jobId parameter', async () => {
            let capturedUrl = '';
            server.use(
                http.get('*/job/RecurringJobDetail', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockJobDetail);
                })
            );

            const result = await getRecurringJobDetail(456);

            expect(capturedUrl).toContain('jobId=456');
            expect(result).toMatchObject({ jobId: 123 });
        });

        it('handles server error', async () => {
            server.use(
                http.get('*/job/RecurringJobDetail', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(getRecurringJobDetail(456)).rejects.toMatchObject({ status: 500 });
        });
    });

    describe('getBulkJobDetail', () => {
        it('fetches bulk job detail with correct bulkJobId parameter', async () => {
            let capturedUrl = '';
            server.use(
                http.get('*/Job/BulkDetail', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockJobDetail);
                })
            );

            const result = await getBulkJobDetail(789);

            expect(capturedUrl).toContain('bulkJobId=789');
            expect(result).toMatchObject({ jobId: 123 });
        });

        it('handles not found error', async () => {
            server.use(
                http.get('*/Job/BulkDetail', () => {
                    return HttpResponse.json({ message: 'Bulk job not found' }, { status: 404 });
                })
            );

            await expect(getBulkJobDetail(999)).rejects.toMatchObject({ status: 404 });
        });
    });

    // ── Job Updates ─────────────────────────────────────────────────

    describe('updateJobDetail', () => {
        it('posts to UpdateJob for non-recurring jobs with correct params', async () => {
            let capturedUrl = '';
            let capturedCsrfHeader: string | null = null;
            server.use(
                http.post('*/job/UpdateJob', async ({ request }) => {
                    capturedUrl = request.url;
                    capturedCsrfHeader = request.headers.get('X-Requested-With');
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await updateJobDetail(123, 'status', 'Completed', false);

            expect(capturedUrl).toContain('jobId=123');
            expect(capturedUrl).toContain('field=status');
            expect(capturedUrl).toContain('value=Completed');
            expect(capturedCsrfHeader).toBe('XMLHttpRequest');
        });

        it('posts to UpdateRecurringJob for recurring jobs', async () => {
            let capturedUrl = '';
            server.use(
                http.post('*/job/UpdateRecurringJob', async ({ request }) => {
                    capturedUrl = request.url;
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await updateJobDetail(456, 'notes', 'Updated notes', true);

            expect(capturedUrl).toContain('jobId=456');
            expect(capturedUrl).toContain('field=notes');
            expect(capturedUrl).toContain('isRecurring=true');
        });

        it('handles validation error', async () => {
            server.use(
                http.post('*/job/UpdateJob', () => {
                    return HttpResponse.json({ message: 'Invalid field' }, { status: 400 });
                })
            );

            await expect(updateJobDetail(123, 'badField', 'x', false)).rejects.toMatchObject({ status: 400 });
        });
    });

    describe('updateBulkJobDetail', () => {
        it('posts to UpdateBulkJob with correct params and CSRF header', async () => {
            let capturedUrl = '';
            let capturedCsrfHeader: string | null = null;
            server.use(
                http.post('*/job/UpdateBulkJob', async ({ request }) => {
                    capturedUrl = request.url;
                    capturedCsrfHeader = request.headers.get('X-Requested-With');
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await updateBulkJobDetail(500, 'status', 'Active');

            expect(capturedUrl).toContain('bulkJobId=500');
            expect(capturedUrl).toContain('field=status');
            expect(capturedUrl).toContain('value=Active');
            expect(capturedCsrfHeader).toBe('XMLHttpRequest');
        });

        it('handles server error', async () => {
            server.use(
                http.post('*/job/UpdateBulkJob', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(updateBulkJobDetail(500, 'status', 'Active')).rejects.toMatchObject({ status: 500 });
        });
    });

    // ── Address Updates ─────────────────────────────────────────────

    describe('updatePickupAddress', () => {
        const mockAddress = { address1: '123 Main St', city: 'Auckland', postCode: '1010' };

        it('posts to UpdatePickupAddress for non-prebook jobs', async () => {
            let capturedBody: unknown = null;
            server.use(
                http.post('*/job/UpdatePickupAddress', async ({ request }) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await updatePickupAddress(123, false, mockAddress as any);

            expect(capturedBody).toMatchObject({ jobId: 123, address: mockAddress });
        });

        it('posts to UpdateBookingPickupAddress for prebook jobs', async () => {
            let wasHit = false;
            server.use(
                http.post('*/job/UpdateBookingPickupAddress', async ({ request }) => {
                    wasHit = true;
                    await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await updatePickupAddress(123, true, mockAddress as any);

            expect(wasHit).toBe(true);
        });

        it('sends CSRF header', async () => {
            let capturedCsrfHeader: string | null = null;
            server.use(
                http.post('*/job/UpdatePickupAddress', async ({ request }) => {
                    capturedCsrfHeader = request.headers.get('X-Requested-With');
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await updatePickupAddress(123, false, mockAddress as any);

            expect(capturedCsrfHeader).toBe('XMLHttpRequest');
        });

        it('handles error', async () => {
            server.use(
                http.post('*/job/UpdatePickupAddress', () => {
                    return HttpResponse.json({ message: 'Invalid address' }, { status: 400 });
                })
            );

            await expect(updatePickupAddress(123, false, mockAddress as any)).rejects.toMatchObject({ status: 400 });
        });
    });

    describe('updateDeliveryAddress', () => {
        const mockAddress = { address1: '456 Queen St', city: 'Wellington', postCode: '6011' };

        it('posts to UpdateDeliveryAddress for non-prebook jobs', async () => {
            let capturedBody: unknown = null;
            server.use(
                http.post('*/job/UpdateDeliveryAddress', async ({ request }) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await updateDeliveryAddress(123, false, mockAddress as any);

            expect(capturedBody).toMatchObject({ jobId: 123, address: mockAddress });
        });

        it('posts to UpdateBookingDeliveryAddress for prebook jobs', async () => {
            let wasHit = false;
            server.use(
                http.post('*/job/UpdateBookingDeliveryAddress', async ({ request }) => {
                    wasHit = true;
                    await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await updateDeliveryAddress(123, true, mockAddress as any);

            expect(wasHit).toBe(true);
        });

        it('handles error', async () => {
            server.use(
                http.post('*/job/UpdateDeliveryAddress', () => {
                    return HttpResponse.json({ message: 'Address validation failed' }, { status: 400 });
                })
            );

            await expect(updateDeliveryAddress(123, false, mockAddress as any)).rejects.toMatchObject({ status: 400 });
        });
    });

    // ── POD Operations ──────────────────────────────────────────────

    describe('updatePodDetails', () => {
        it('posts POD details with CSRF header', async () => {
            let capturedBody: unknown = null;
            let capturedCsrfHeader: string | null = null;
            server.use(
                http.post('*/job/UpdatePODDetails', async ({ request }) => {
                    capturedCsrfHeader = request.headers.get('X-Requested-With');
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            const podData = { jobId: 123, podName: 'John Doe', podTime: '2026-03-24T10:00:00' };
            await updatePodDetails(podData as any);

            expect(capturedCsrfHeader).toBe('XMLHttpRequest');
            expect(capturedBody).toMatchObject(podData);
        });

        it('handles validation error', async () => {
            server.use(
                http.post('*/job/UpdatePODDetails', () => {
                    return HttpResponse.json({ message: 'POD name required' }, { status: 400 });
                })
            );

            await expect(updatePodDetails({} as any)).rejects.toMatchObject({ status: 400 });
        });
    });

    describe('updateJobReadStatus', () => {
        it('posts read status with correct params', async () => {
            let capturedUrl = '';
            let capturedCsrfHeader: string | null = null;
            server.use(
                http.post('*/job/UpdateJobReadStatus', async ({ request }) => {
                    capturedUrl = request.url;
                    capturedCsrfHeader = request.headers.get('X-Requested-With');
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await updateJobReadStatus(123, true);

            expect(capturedUrl).toContain('jobId=123');
            expect(capturedUrl).toContain('hasBeenRead=true');
            expect(capturedCsrfHeader).toBe('XMLHttpRequest');
        });

        it('handles error', async () => {
            server.use(
                http.post('*/job/UpdateJobReadStatus', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(updateJobReadStatus(123, true)).rejects.toMatchObject({ status: 500 });
        });
    });

    // ── Photos ──────────────────────────────────────────────────────

    describe('getJobDeliveryPhotos', () => {
        it('fetches delivery photos with correct parameters', async () => {
            let capturedUrl = '';
            server.use(
                http.get('*/Job/GetJobDeliveryPhotosAndSignature', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockPhotos);
                })
            );

            const result = await getJobDeliveryPhotos(123, 2026, 3);

            expect(capturedUrl).toContain('jobId=123');
            expect(capturedUrl).toContain('year=2026');
            expect(capturedUrl).toContain('month=3');
            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({ key: 'photo1.jpg' });
        });

        it('returns empty array when no photos', async () => {
            server.use(
                http.get('*/Job/GetJobDeliveryPhotosAndSignature', () => {
                    return HttpResponse.json([]);
                })
            );

            const result = await getJobDeliveryPhotos(123, 2026, 3);
            expect(result).toHaveLength(0);
        });

        it('handles error', async () => {
            server.use(
                http.get('*/Job/GetJobDeliveryPhotosAndSignature', () => {
                    return HttpResponse.json({ message: 'Not found' }, { status: 404 });
                })
            );

            await expect(getJobDeliveryPhotos(999, 2026, 3)).rejects.toMatchObject({ status: 404 });
        });
    });

    describe('getJobPickupPhotos', () => {
        it('fetches pickup photos with correct parameters', async () => {
            let capturedUrl = '';
            server.use(
                http.get('*/Job/GetJobPickupPhotos', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockPhotos);
                })
            );

            const result = await getJobPickupPhotos(123, 2026, 3);

            expect(capturedUrl).toContain('jobId=123');
            expect(capturedUrl).toContain('year=2026');
            expect(capturedUrl).toContain('month=3');
            expect(result).toHaveLength(2);
        });

        it('handles error', async () => {
            server.use(
                http.get('*/Job/GetJobPickupPhotos', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(getJobPickupPhotos(999, 2026, 3)).rejects.toMatchObject({ status: 500 });
        });
    });

    // ── Reference Data Lists ────────────────────────────────────────

    describe('getStatusList', () => {
        it('fetches status list', async () => {
            server.use(
                http.get('*/job/StatusList', () => {
                    return HttpResponse.json(mockSuggestions);
                })
            );

            const result = await getStatusList();

            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({ id: 1, text: 'Option A' });
        });

        it('handles server error', async () => {
            server.use(
                http.get('*/job/StatusList', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(getStatusList()).rejects.toMatchObject({ status: 500 });
        });
    });

    describe('getSpeedList', () => {
        it('fetches speed list', async () => {
            server.use(
                http.get('*/job/SpeedList', () => {
                    return HttpResponse.json(mockSuggestions);
                })
            );

            const result = await getSpeedList();

            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({ id: 1, text: 'Option A' });
        });

        it('handles server error', async () => {
            server.use(
                http.get('*/job/SpeedList', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(getSpeedList()).rejects.toMatchObject({ status: 500 });
        });
    });

    describe('getLeaveList', () => {
        it('fetches leave list', async () => {
            server.use(
                http.get('*/job/LeaveList', () => {
                    return HttpResponse.json(mockSuggestions);
                })
            );

            const result = await getLeaveList();

            expect(result).toHaveLength(2);
        });

        it('handles server error', async () => {
            server.use(
                http.get('*/job/LeaveList', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(getLeaveList()).rejects.toMatchObject({ status: 500 });
        });
    });

    describe('getContactList', () => {
        it('fetches contacts with correct clientId parameter', async () => {
            let capturedUrl = '';
            server.use(
                http.get('*/job/ContactList', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockSuggestions);
                })
            );

            const result = await getContactList(42);

            expect(capturedUrl).toContain('clientId=42');
            expect(result).toHaveLength(2);
        });

        it('handles not found error', async () => {
            server.use(
                http.get('*/job/ContactList', () => {
                    return HttpResponse.json({ message: 'Client not found' }, { status: 404 });
                })
            );

            await expect(getContactList(999)).rejects.toMatchObject({ status: 404 });
        });
    });

    // ── Job Dispatch Operations ─────────────────────────────────────

    describe('restoreJobs', () => {
        it('sends job IDs in request body with CSRF header', async () => {
            let capturedBody: unknown = null;
            let capturedCsrfHeader: string | null = null;
            server.use(
                http.post('*/job/RestoreJobs', async ({ request }) => {
                    capturedCsrfHeader = request.headers.get('X-Requested-With');
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await restoreJobs([1, 2, 3]);

            expect(capturedCsrfHeader).toBe('XMLHttpRequest');
            expect(capturedBody).toMatchObject({ jobIds: [1, 2, 3] });
        });

        it('handles permission error', async () => {
            server.use(
                http.post('*/job/RestoreJobs', () => {
                    return HttpResponse.json({ message: 'Permission denied' }, { status: 403 });
                })
            );

            await expect(restoreJobs([1])).rejects.toMatchObject({ status: 403 });
        });
    });

    describe('allocateJob', () => {
        it('sends courier and job IDs with CSRF header', async () => {
            let capturedBody: unknown = null;
            let capturedCsrfHeader: string | null = null;
            server.use(
                http.post('*/job/Allocate', async ({ request }) => {
                    capturedCsrfHeader = request.headers.get('X-Requested-With');
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await allocateJob(42, [100, 101]);

            expect(capturedCsrfHeader).toBe('XMLHttpRequest');
            expect(capturedBody).toMatchObject({ courierId: 42, jobIds: [100, 101] });
        });

        it('handles allocation error', async () => {
            server.use(
                http.post('*/job/Allocate', () => {
                    return HttpResponse.json({ message: 'Courier is offline' }, { status: 400 });
                })
            );

            await expect(allocateJob(42, [100])).rejects.toMatchObject({ status: 400 });
        });
    });

    describe('getCourierById', () => {
        it('fetches courier with correct courierId parameter', async () => {
            let capturedUrl = '';
            const mockCourier = { id: '42', name: 'John Driver' };
            server.use(
                http.get('*/courier/GetCourier', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockCourier);
                })
            );

            const result = await getCourierById(42);

            expect(capturedUrl).toContain('courierId=42');
            expect(result).toMatchObject({ id: '42', name: 'John Driver' });
        });

        it('handles not found error', async () => {
            server.use(
                http.get('*/courier/GetCourier', () => {
                    return HttpResponse.json({ message: 'Courier not found' }, { status: 404 });
                })
            );

            await expect(getCourierById(999)).rejects.toMatchObject({ status: 404 });
        });
    });

    // ── File Downloads ──────────────────────────────────────────────

    describe('downloadFile', () => {
        it('rejects invalid s3Key with path traversal', async () => {
            await expect(downloadFile('../etc/passwd', 'file.pdf')).rejects.toThrow('Invalid file key');
        });

        it('rejects s3Key with null bytes', async () => {
            await expect(downloadFile('key\0evil', 'file.pdf')).rejects.toThrow('Invalid file key');
        });

        it('rejects empty s3Key', async () => {
            await expect(downloadFile('', 'file.pdf')).rejects.toThrow('Invalid file key');
        });

        it('rejects invalid fileName with path traversal', async () => {
            await expect(downloadFile('valid-key', '../evil.pdf')).rejects.toThrow('Invalid file name');
        });

        it('rejects fileName with forward slashes', async () => {
            await expect(downloadFile('valid-key', 'path/file.pdf')).rejects.toThrow('Invalid file name');
        });

        it('rejects fileName with backslashes', async () => {
            await expect(downloadFile('valid-key', 'path\\file.pdf')).rejects.toThrow('Invalid file name');
        });

        it('rejects empty fileName', async () => {
            await expect(downloadFile('valid-key', '')).rejects.toThrow('Invalid file name');
        });
    });

    // ── URL Helpers ─────────────────────────────────────────────────

    describe('getPodReportUrl', () => {
        it('returns correct URL with jobId', () => {
            expect(getPodReportUrl(123)).toBe('/job/PodReport?jobId=123');
        });

        it('handles different job IDs', () => {
            expect(getPodReportUrl(999)).toBe('/job/PodReport?jobId=999');
        });
    });

    describe('getPodSpreadsheetUrl', () => {
        it('returns correct URL with jobId', () => {
            expect(getPodSpreadsheetUrl(123)).toBe('/job/PodSpreadsheet?jobId=123');
        });

        it('handles different job IDs', () => {
            expect(getPodSpreadsheetUrl(999)).toBe('/job/PodSpreadsheet?jobId=999');
        });
    });

    // ── Autocomplete Search ─────────────────────────────────────────

    describe('autocompleteSearch', () => {
        it('calls correct endpoint with searchTerm parameter', async () => {
            let capturedUrl = '';
            server.use(
                http.get('*/courier/Search', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockSuggestions);
                })
            );

            const result = await autocompleteSearch('test', 'courier/Search');

            expect(capturedUrl).toContain('searchTerm=test');
            expect(result).toHaveLength(2);
        });

        it('works with different endpoint URLs', async () => {
            let capturedUrl = '';
            server.use(
                http.get('*/client/Search', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockSuggestions);
                })
            );

            await autocompleteSearch('acme', 'client/Search');

            expect(capturedUrl).toContain('searchTerm=acme');
        });

        it('returns empty array when no matches', async () => {
            server.use(
                http.get('*/courier/Search', () => {
                    return HttpResponse.json([]);
                })
            );

            const result = await autocompleteSearch('zzz', 'courier/Search');
            expect(result).toHaveLength(0);
        });

        it('handles server error', async () => {
            server.use(
                http.get('*/courier/Search', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(autocompleteSearch('test', 'courier/Search')).rejects.toMatchObject({ status: 500 });
        });
    });
});
