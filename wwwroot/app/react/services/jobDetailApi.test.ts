/** @jest-environment node */
/**
 * Job Detail API Service Tests
 *
 * Unit tests verifying correct apiClient call signatures, URL routing,
 * date processing, input validation, and FormData construction.
 */

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
    sendPod,
    sendPodReport,
    getJobDeliveryPhotos,
    getJobPickupPhotos,
    getInternalStatusList,
    getStatusList,
    getSpeedList,
    getVehicleSizes,
    getLeaveList,
    getContactList,
    getActiveStaff,
    getUndeliverableList,
    restoreJobs,
    allocateJob,
    getCourierById,
    updatePackages,
    updateBulkJobPackages,
    downloadFile,
    getPodReportUrl,
    getPodSpreadsheetUrl,
    autocompleteSearch,
    getAttachedFiles,
    uploadJobFile,
    uploadJobDeliveryPhotoOrSignature,
    deleteJobFile,
    deleteJobDeliveryPhotoOrSignature,
} from './jobDetailApi';
import {apiClient, downloadBlob} from './apiClient';
import {formatDateForApi} from '../utils/dateUtils';
import {createMockApiError} from '../__testUtils__';
import dayjs from 'dayjs';

jest.mock('./apiClient', () => ({
    apiClient: {
        get: jest.fn(),
        post: jest.fn(),
        delete: jest.fn(),
        uploadFormData: jest.fn(),
        postForBlob: jest.fn(),
    },
    downloadBlob: jest.fn(),
}));

jest.mock('../utils/dateUtils', () => ({
    formatDateForApi: jest.fn(() => '2026-03-31T00:00:00-05:00'),
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockDownloadBlob = downloadBlob as jest.Mock;
const mockFormatDateForApi = formatDateForApi as jest.Mock;

describe('jobDetailApi', () => {
    // ── Job Detail Fetching ─────────────────────────────────────────

    describe('Job Detail Fetching', () => {
        it('getJobDetail calls correct URL with jobId param', async () => {
            const mockResponse = {jobId: 42, jobNumber: 'JOB-42'};
            mockApiClient.get.mockResolvedValueOnce(mockResponse);

            const result = await getJobDetail(42);

            expect(mockApiClient.get).toHaveBeenCalledWith('job/Detail', {jobId: 42}, undefined);
            expect(result).toEqual(mockResponse);
        });

        it('getRecurringJobDetail calls correct URL with jobId param', async () => {
            const mockResponse = {jobId: 42};
            mockApiClient.get.mockResolvedValueOnce(mockResponse);

            const result = await getRecurringJobDetail(42);

            expect(mockApiClient.get).toHaveBeenCalledWith('job/RecurringJobDetail', {jobId: 42}, undefined);
            expect(result).toEqual(mockResponse);
        });

        it('getBulkJobDetail calls correct URL with bulkJobId param', async () => {
            const mockResponse = {jobId: 42};
            mockApiClient.get.mockResolvedValueOnce(mockResponse);

            const result = await getBulkJobDetail(42);

            expect(mockApiClient.get).toHaveBeenCalledWith('/Job/BulkDetail', {bulkJobId: 42}, undefined);
            expect(result).toEqual(mockResponse);
        });
    });

    // ── Job Updates ─────────────────────────────────────────────────

    describe('updateJobDetail', () => {
        it('routes to UpdateJob for non-recurring jobs with string value', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await updateJobDetail(123, 'status', 'Completed', false);

            expect(mockApiClient.post).toHaveBeenCalledWith('job/UpdateJob', null, {
                params: {jobId: 123, field: 'status', value: 'Completed', isRecurring: false},
            });
        });

        it('routes to UpdateRecurringJob for recurring jobs', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await updateJobDetail(456, 'notes', 'Updated', true);

            expect(mockApiClient.post).toHaveBeenCalledWith('job/UpdateRecurringJob', null, {
                params: {jobId: 456, field: 'notes', value: 'Updated', isRecurring: true},
            });
        });

        it('processes Date values through formatDateForApi', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);
            const testDate = new Date(2026, 2, 31);

            await updateJobDetail(123, 'dueDate', testDate, false, 'America/New_York');

            expect(mockFormatDateForApi).toHaveBeenCalledWith(testDate, 'America/New_York');
            expect(mockApiClient.post).toHaveBeenCalledWith('job/UpdateJob', null, {
                params: {jobId: 123, field: 'dueDate', value: '2026-03-31T00:00:00-05:00', isRecurring: false},
            });
        });

        it('processes Dayjs values through formatDateForApi', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);
            const testDate = dayjs('2026-03-31');

            await updateJobDetail(123, 'dueDate', testDate, false);

            expect(mockFormatDateForApi).toHaveBeenCalledWith(testDate, undefined);
        });
    });

    describe('updateBulkJobDetail', () => {
        it('calls correct URL with bulkJobId params', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await updateBulkJobDetail(500, 'status', 'Active');

            expect(mockApiClient.post).toHaveBeenCalledWith('job/UpdateBulkJob', null, {
                params: {bulkJobId: 500, field: 'status', value: 'Active'},
            });
        });

        it('processes Date values through formatDateForApi', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);
            const testDate = new Date(2026, 2, 31);

            await updateBulkJobDetail(500, 'dueDate', testDate, 'Pacific/Auckland');

            expect(mockFormatDateForApi).toHaveBeenCalledWith(testDate, 'Pacific/Auckland');
            expect(mockApiClient.post).toHaveBeenCalledWith('job/UpdateBulkJob', null, {
                params: {bulkJobId: 500, field: 'dueDate', value: '2026-03-31T00:00:00-05:00'},
            });
        });

        it('processes Dayjs values through formatDateForApi', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);
            const testDate = dayjs('2026-03-31');

            await updateBulkJobDetail(500, 'dueDate', testDate);

            expect(mockFormatDateForApi).toHaveBeenCalledWith(testDate, undefined);
        });
    });

    // ── Address Updates ─────────────────────────────────────────────

    describe('Address Updates', () => {
        const mockAddress = {address1: '123 Main St', city: 'Auckland', postCode: '1010'};

        it.each([
            ['updatePickupAddress non-prebook', updatePickupAddress, false, 'job/UpdatePickupAddress'],
            ['updatePickupAddress prebook', updatePickupAddress, true, 'job/UpdateBookingPickupAddress'],
            ['updateDeliveryAddress non-prebook', updateDeliveryAddress, false, 'job/UpdateDeliveryAddress'],
            ['updateDeliveryAddress prebook', updateDeliveryAddress, true, 'job/UpdateBookingDeliveryAddress'],
        ] as const)('%s calls correct endpoint', async (_, fn, prebook, expectedUrl) => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await fn(123, prebook, mockAddress as any);

            expect(mockApiClient.post).toHaveBeenCalledWith(expectedUrl, {jobId: 123, address: mockAddress});
        });
    });

    // ── POD Operations ──────────────────────────────────────────────

    describe('POD Operations', () => {
        it('updatePodDetails posts data to correct URL', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);
            const podData = {jobId: 123, podName: 'John Doe'};

            await updatePodDetails(podData as any);

            expect(mockApiClient.post).toHaveBeenCalledWith('job/UpdatePODDetails', podData);
        });

        it('updateJobReadStatus posts with null body and params', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await updateJobReadStatus(123, true);

            expect(mockApiClient.post).toHaveBeenCalledWith('job/UpdateJobReadStatus', null, {
                params: {jobId: 123, hasBeenRead: true},
            });
        });

        it('sendPod calls GET with jobId and toEmail params', async () => {
            mockApiClient.get.mockResolvedValueOnce({success: true});

            const result = await sendPod(123, 'test@example.com');

            expect(mockApiClient.get).toHaveBeenCalledWith('job/SendPOD', {jobId: 123, toEmail: 'test@example.com'});
            expect(result).toEqual({success: true});
        });

        it('sendPodReport POSTs the request with a budget longer than the 30s client default', async () => {
            // Rendering the POD inline (S3 photos + image conversion) routinely outlives 30s.
            mockApiClient.post.mockResolvedValueOnce(undefined);
            const request = {jobId: 123, recipients: ['ops@acme.test'], subject: 'POD', body: 'Body'};

            await sendPodReport(request);

            expect(mockApiClient.post).toHaveBeenCalledWith('job/SendPodReport', request, {timeout: 180000});
        });

        it('sendPodReport surfaces the server error message rather than a generic failure', async () => {
            mockApiClient.post.mockRejectedValueOnce(
                createMockApiError({message: 'The POD report could not be queued for sending.'}));

            await expect(sendPodReport({jobId: 123, recipients: [], subject: '', body: ''}))
                .rejects.toMatchObject({message: 'The POD report could not be queued for sending.'});
        });
    });

    // ── Photos ──────────────────────────────────────────────────────

    describe('Photos', () => {
        it('getJobDeliveryPhotos calls correct URL with year/month params', async () => {
            const mockPhotos = [{key: 'photo1.jpg'}];
            mockApiClient.get.mockResolvedValueOnce(mockPhotos);

            const result = await getJobDeliveryPhotos(123, 2026, 3);

            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/Job/GetJobDeliveryPhotosAndSignature',
                {jobId: 123, year: 2026, month: 3},
                undefined,
            );
            expect(result).toEqual(mockPhotos);
        });

        it('getJobPickupPhotos calls correct URL with year/month params', async () => {
            const mockPhotos = [{key: 'photo1.jpg'}];
            mockApiClient.get.mockResolvedValueOnce(mockPhotos);

            const result = await getJobPickupPhotos(123, 2026, 3);

            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/Job/GetJobPickupPhotos',
                {jobId: 123, year: 2026, month: 3},
                undefined,
            );
            expect(result).toEqual(mockPhotos);
        });
    });

    // ── Reference Data Lists ────────────────────────────────────────

    describe('Reference Data Lists', () => {
        it.each([
            ['getInternalStatusList', getInternalStatusList, 'job/InternalStatusList'],
            ['getStatusList', getStatusList, 'job/StatusList'],
            ['getSpeedList', getSpeedList, 'job/SpeedList'],
            ['getVehicleSizes', getVehicleSizes, 'courier/GetVehicleSizes'],
            ['getLeaveList', getLeaveList, 'job/LeaveList'],
            ['getActiveStaff', getActiveStaff, 'task/GetStaff'],
            ['getUndeliverableList', getUndeliverableList, 'job/UndeliverableList'],
        ])('%s calls correct URL', async (_, fn, expectedUrl) => {
            const mockData = [{id: 1, text: 'Option A'}];
            mockApiClient.get.mockResolvedValueOnce(mockData);

            const result = await fn();

            expect(mockApiClient.get).toHaveBeenCalledWith(expectedUrl, undefined, undefined);
            expect(result).toEqual(mockData);
        });

        it('getContactList calls correct URL with clientId param', async () => {
            const mockContacts = [{id: 1, text: 'Jane Doe'}];
            mockApiClient.get.mockResolvedValueOnce(mockContacts);

            const result = await getContactList(42);

            expect(mockApiClient.get).toHaveBeenCalledWith('job/ContactList', {clientId: 42}, undefined);
            expect(result).toEqual(mockContacts);
        });
    });

    // ── Job Dispatch + Package Operations ───────────────────────────

    describe('Job Dispatch Operations', () => {
        it('restoreJobs posts jobIds', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await restoreJobs([1, 2, 3]);

            expect(mockApiClient.post).toHaveBeenCalledWith('job/RestoreJobs', {jobIds: [1, 2, 3], removeCapturedImages: false});
        });

        it('allocateJob posts courierId and jobIds', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await allocateJob(42, [100, 101]);

            expect(mockApiClient.post).toHaveBeenCalledWith('job/Allocate', {courierId: 42, jobIds: [100, 101]});
        });

        it('getCourierById calls correct URL with courierId param', async () => {
            const mockCourier = {id: '42', name: 'John Driver'};
            mockApiClient.get.mockResolvedValueOnce(mockCourier);

            const result = await getCourierById(42);

            expect(mockApiClient.get).toHaveBeenCalledWith('courier/GetCourier', {courierId: 42});
            expect(result).toEqual(mockCourier);
        });
    });

    describe('Package Operations', () => {
        it('updatePackages posts jobId and parcels', async () => {
            const parcels = [{length: 10, width: 20, height: 30, weight: 5}];
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await updatePackages(123, parcels as any);

            expect(mockApiClient.post).toHaveBeenCalledWith('job/UpdateJobPackages', {jobId: 123, parcels});
        });

        it('updateBulkJobPackages posts bulkJobId and parcels', async () => {
            const parcels = [{length: 10, width: 20, height: 30, weight: 5}];
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await updateBulkJobPackages(789, parcels as any);

            expect(mockApiClient.post).toHaveBeenCalledWith('job/UpdateBulkJobPackages', {bulkJobId: 789, parcels});
        });
    });

    // ── File Downloads ──────────────────────────────────────────────

    describe('downloadFile', () => {
        it.each([
            ['empty s3Key', '', 'valid.pdf', 'Invalid file key'],
            ['s3Key with path traversal', '../etc/passwd', 'valid.pdf', 'Invalid file key'],
            ['s3Key with null byte', 'key\0evil', 'valid.pdf', 'Invalid file key'],
            ['empty fileName', 'valid-key', '', 'Invalid file name'],
            ['fileName with path traversal', 'valid-key', '../evil.pdf', 'Invalid file name'],
            ['fileName with null byte', 'valid-key', 'file\0.pdf', 'Invalid file name'],
            ['fileName with forward slash', 'valid-key', 'path/file.pdf', 'Invalid file name'],
            ['fileName with backslash', 'valid-key', 'path\\file.pdf', 'Invalid file name'],
        ])('rejects %s', async (_, s3Key, fileName, expectedError) => {
            await expect(downloadFile(s3Key, fileName)).rejects.toThrow(expectedError);
            expect(mockApiClient.postForBlob).not.toHaveBeenCalled();
        });

        it('calls postForBlob and downloadBlob for valid inputs', async () => {
            const mockBlobResponse = {data: new Blob(['content']), headers: {}};
            mockApiClient.postForBlob.mockResolvedValueOnce(mockBlobResponse);

            await downloadFile('uploads/invoice.pdf', 'invoice.pdf');

            expect(mockApiClient.postForBlob).toHaveBeenCalledWith('/job/DownloadFile', null, {
                params: {key: 'uploads/invoice.pdf'},
            });
            expect(mockDownloadBlob).toHaveBeenCalledWith(mockBlobResponse, 'invoice.pdf');
        });
    });

    // ── URL Helpers ─────────────────────────────────────────────────

    describe('URL Helpers', () => {
        it('generates correct POD report and spreadsheet URLs', () => {
            expect(getPodReportUrl(42)).toBe('/job/PodReport?jobId=42');
            expect(getPodReportUrl(999)).toBe('/job/PodReport?jobId=999');
            expect(getPodSpreadsheetUrl(42)).toBe('/job/PodSpreadsheet?jobId=42');
            expect(getPodSpreadsheetUrl(999)).toBe('/job/PodSpreadsheet?jobId=999');
        });
    });

    // ── Autocomplete ────────────────────────────────────────────────

    describe('autocompleteSearch', () => {
        it('passes searchTerm and URL to apiClient.get', async () => {
            const mockResults = [{id: 1, text: 'Result'}];
            mockApiClient.get.mockResolvedValueOnce(mockResults);

            const result = await autocompleteSearch('test', 'courier/Search');

            expect(mockApiClient.get).toHaveBeenCalledWith('courier/Search', {searchTerm: 'test'});
            expect(result).toEqual(mockResults);
        });
    });

    // ── File Upload Operations ──────────────────────────────────────

    describe('File Upload Operations', () => {
        it('getAttachedFiles calls correct URL with jobId param', async () => {
            const mockFiles = [{fileName: 'report.pdf', isPOD: false}];
            mockApiClient.get.mockResolvedValueOnce(mockFiles);

            const result = await getAttachedFiles(123);

            expect(mockApiClient.get).toHaveBeenCalledWith('/job/getAttachedFiles', {jobId: 123});
            expect(result).toEqual(mockFiles);
        });

        it('uploadJobFile builds FormData with correct fields', async () => {
            mockApiClient.uploadFormData.mockResolvedValueOnce(undefined);
            const file = new File(['test content'], 'report.pdf', {type: 'application/pdf'});
            const onProgress = jest.fn();

            await uploadJobFile(123, file, onProgress);

            const [url, formData, options] = mockApiClient.uploadFormData.mock.calls[0];
            expect(url).toBe('/job/uploadFile');
            expect((formData as FormData).get('jobId')).toBe('123');
            expect((formData as FormData).get('isPOD')).toBe('false');
            expect((formData as FormData).get('contentType')).toBe('application/pdf');
            expect((formData as FormData).get('file')).toBeInstanceOf(File);
            expect(options).toEqual({onProgress});
        });

        it('uploadJobFile omits contentType when file.type is empty', async () => {
            mockApiClient.uploadFormData.mockResolvedValueOnce(undefined);
            const file = new File(['data'], 'noext', {type: ''});

            await uploadJobFile(123, file);

            const formData = mockApiClient.uploadFormData.mock.calls[0][1] as FormData;
            expect(formData.get('contentType')).toBeNull();
        });

        it('uploadJobDeliveryPhotoOrSignature builds FormData with podDescription', async () => {
            mockApiClient.uploadFormData.mockResolvedValueOnce(undefined);
            const file = new File(['image'], 'photo.jpg', {type: 'image/jpeg'});

            await uploadJobDeliveryPhotoOrSignature(123, file, 'Left at front door');

            const formData = mockApiClient.uploadFormData.mock.calls[0][1] as FormData;
            expect(mockApiClient.uploadFormData.mock.calls[0][0]).toBe('/job/uploadJobDeliveryPhotoOrSignature');
            expect(formData.get('jobId')).toBe('123');
            expect(formData.get('isPOD')).toBe('true');
            expect(formData.get('podDescription')).toBe('Left at front door');
            expect(formData.get('contentType')).toBe('image/jpeg');
        });

        it('uploadJobDeliveryPhotoOrSignature omits podDescription when not provided', async () => {
            mockApiClient.uploadFormData.mockResolvedValueOnce(undefined);
            const file = new File(['image'], 'photo.jpg', {type: 'image/jpeg'});

            await uploadJobDeliveryPhotoOrSignature(123, file);

            const formData = mockApiClient.uploadFormData.mock.calls[0][1] as FormData;
            expect(formData.get('podDescription')).toBeNull();
        });

        it('deleteJobFile calls delete with correct params', async () => {
            mockApiClient.delete.mockResolvedValueOnce(undefined);

            await deleteJobFile(123, 'jobs/123/invoice.pdf');

            expect(mockApiClient.delete).toHaveBeenCalledWith('/job/DeleteFile', {
                params: {jobId: 123, key: 'jobs/123/invoice.pdf'},
            });
        });

        it('deleteJobDeliveryPhotoOrSignature calls delete with correct params', async () => {
            mockApiClient.delete.mockResolvedValueOnce(undefined);

            await deleteJobDeliveryPhotoOrSignature(123, 'pods/123/photo.jpg');

            expect(mockApiClient.delete).toHaveBeenCalledWith('/job/DeleteJobDeliveryPhotoOrSignature', {
                params: {jobId: 123, key: 'pods/123/photo.jpg'},
            });
        });
    });

    // ── Error Propagation ───────────────────────────────────────────

    describe('Error propagation', () => {
        it.each([
            ['getJobDetail', () => getJobDetail(1), mockApiClient.get],
            ['getRecurringJobDetail', () => getRecurringJobDetail(1), mockApiClient.get],
            ['getBulkJobDetail', () => getBulkJobDetail(1), mockApiClient.get],
            ['sendPod', () => sendPod(1, 'a@b.com'), mockApiClient.get],
            ['getJobDeliveryPhotos', () => getJobDeliveryPhotos(1, 2026, 3), mockApiClient.get],
            ['getJobPickupPhotos', () => getJobPickupPhotos(1, 2026, 3), mockApiClient.get],
            ['getInternalStatusList', () => getInternalStatusList(), mockApiClient.get],
            ['getStatusList', () => getStatusList(), mockApiClient.get],
            ['getSpeedList', () => getSpeedList(), mockApiClient.get],
            ['getVehicleSizes', () => getVehicleSizes(), mockApiClient.get],
            ['getLeaveList', () => getLeaveList(), mockApiClient.get],
            ['getContactList', () => getContactList(1), mockApiClient.get],
            ['getActiveStaff', () => getActiveStaff(), mockApiClient.get],
            ['getUndeliverableList', () => getUndeliverableList(), mockApiClient.get],
            ['getCourierById', () => getCourierById(1), mockApiClient.get],
            ['getAttachedFiles', () => getAttachedFiles(1), mockApiClient.get],
            ['autocompleteSearch', () => autocompleteSearch('t', 'url'), mockApiClient.get],
            ['updateJobDetail', () => updateJobDetail(1, 'f', 'v', false), mockApiClient.post],
            ['updateBulkJobDetail', () => updateBulkJobDetail(1, 'f', 'v'), mockApiClient.post],
            ['updatePickupAddress', () => updatePickupAddress(1, false, {} as any), mockApiClient.post],
            ['updateDeliveryAddress', () => updateDeliveryAddress(1, false, {} as any), mockApiClient.post],
            ['updatePodDetails', () => updatePodDetails({} as any), mockApiClient.post],
            ['updateJobReadStatus', () => updateJobReadStatus(1, true), mockApiClient.post],
            ['restoreJobs', () => restoreJobs([1]), mockApiClient.post],
            ['allocateJob', () => allocateJob(1, [1]), mockApiClient.post],
            ['updatePackages', () => updatePackages(1, []), mockApiClient.post],
            ['updateBulkJobPackages', () => updateBulkJobPackages(1, []), mockApiClient.post],
            ['deleteJobFile', () => deleteJobFile(1, 'key'), mockApiClient.delete],
            ['deleteJobDeliveryPhotoOrSignature', () => deleteJobDeliveryPhotoOrSignature(1, 'key'), mockApiClient.delete],
            ['uploadJobFile', () => uploadJobFile(1, new File([''], 'f')), mockApiClient.uploadFormData],
            ['uploadJobDeliveryPhotoOrSignature', () => uploadJobDeliveryPhotoOrSignature(1, new File([''], 'f')), mockApiClient.uploadFormData],
        ])('%s propagates errors from apiClient', async (_, apiCall, mockFn) => {
            const error = createMockApiError();
            mockFn.mockRejectedValueOnce(error);
            await expect(apiCall()).rejects.toEqual(error);
        });

        it('downloadFile propagates postForBlob errors for valid inputs', async () => {
            const error = createMockApiError();
            mockApiClient.postForBlob.mockRejectedValueOnce(error);
            await expect(downloadFile('valid-key', 'valid.pdf')).rejects.toEqual(error);
        });
    });
});
