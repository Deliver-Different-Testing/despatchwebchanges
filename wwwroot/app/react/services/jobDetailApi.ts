/**
 * Job Detail API Service
 *
 * HTTP client methods for job detail CRUD operations.
 * Replaces the AngularJS DispatchCoreService methods used by job-details.component.ts.
 */

import {apiClient, downloadBlob} from './apiClient';
import type {RequestOptions} from './apiClient';
import type {
    IJobGroupDto,
    ISuggestion,
    InternalStatus,
    IAddressViewModel,
    IParcelDimensions,
} from '../../interfaces/job.interface';
import type {Is3PhotoInfo} from '../../interfaces/aws.interfaces';
import type {UpdatePodDetailsRequest} from '../../interfaces/requests.interfaces';
import type {JobFile} from '../components/dialogs/job-file-upload-dialog/types';
import {formatDateForApi} from '../utils/dateUtils';
import {assertValidS3Key, assertValidDownloadFileName} from '../utils/fileValidation';
import type {Dayjs} from 'dayjs';
import dayjs from 'dayjs';

// ── Job Detail Fetching ─────────────────────────────────────────────

export function getJobDetail(jobId: number, options?: RequestOptions): Promise<IJobGroupDto> {
    return apiClient.get<IJobGroupDto>('job/Detail', {jobId}, options);
}

export function getRecurringJobDetail(jobId: number, options?: RequestOptions): Promise<IJobGroupDto> {
    return apiClient.get<IJobGroupDto>('job/RecurringJobDetail', {jobId}, options);
}

export function getBulkJobDetail(bulkJobId: number, options?: RequestOptions): Promise<IJobGroupDto> {
    return apiClient.get<IJobGroupDto>('/Job/BulkDetail', {bulkJobId}, options);
}

// ── Job Updates ─────────────────────────────────────────────────────

/**
 * Response shape from /Job/UpdateJob and /Job/UpdateNote. For non-partner jobs the
 * backend returns an empty 200 (all fields undefined). For partner jobs it returns
 * one of:
 *   - `{ applied: true, requestId }` — Auto field synced on both sides via change request.
 *   - `{ pending: true, requestId }` — Manual field queued for the partner's approval (202).
 *   - 400 with `{ message }` — field not supported on partner jobs in this version.
 */
export interface JobUpdateResponse {
    applied?: boolean;
    pending?: boolean;
    requestId?: number;
    message?: string;
}

export function updateJobDetail(
    jobId: number,
    field: string,
    value: unknown,
    isRecurring: boolean,
    timezone?: string
): Promise<JobUpdateResponse> {
    let processedValue = value;
    if (value instanceof Date || dayjs.isDayjs(value as Dayjs)) {
        processedValue = formatDateForApi(value as Date | Dayjs, timezone);
    }

    const url = isRecurring ? 'job/UpdateRecurringJob' : 'job/UpdateJob';
    return apiClient.post<JobUpdateResponse>(url, null, {
        params: {jobId, field, value: processedValue, isRecurring},
    });
}

/**
 * Atomically save a recurring booking's route airports + saved flight number.
 * The push-to-live flight auto-assign only picks up bookings with both airports
 * set, so the "add flight" flow writes all three together via this dedicated
 * endpoint rather than three UpdateRecurringJob calls.
 */
export function saveRecurringFlight(
    jobId: number,
    fromAirportId: number,
    toAirportId: number,
    flightNumber: string
): Promise<void> {
    return apiClient.post<void>('job/SaveRecurringFlight', null, {
        params: {jobId, fromAirportId, toAirportId, flightNumber},
    });
}

export function updateBulkJobDetail(
    bulkJobId: number,
    field: string,
    value: unknown,
    timezone?: string
): Promise<void> {
    let processedValue = value;
    if (value instanceof Date || dayjs.isDayjs(value as Dayjs)) {
        processedValue = formatDateForApi(value as Date | Dayjs, timezone);
    }

    return apiClient.post('job/UpdateBulkJob', null, {
        params: {bulkJobId, field, value: processedValue},
    });
}

// ── Address Updates ─────────────────────────────────────────────────

function getAddressEndpoint(prebook: boolean, addressType: 'pickup' | 'delivery'): string {
    const prefix = prebook ? 'Booking' : '';
    const suffix = addressType === 'pickup' ? 'PickupAddress' : 'DeliveryAddress';
    return `job/Update${prefix}${suffix}`;
}

export function updatePickupAddress(
    jobId: number,
    prebook: boolean,
    address: IAddressViewModel
): Promise<JobUpdateResponse> {
    return apiClient.post<JobUpdateResponse>(getAddressEndpoint(prebook, 'pickup'), {jobId, address});
}

export function updateDeliveryAddress(
    jobId: number,
    prebook: boolean,
    address: IAddressViewModel
): Promise<JobUpdateResponse> {
    return apiClient.post<JobUpdateResponse>(getAddressEndpoint(prebook, 'delivery'), {jobId, address});
}

// ── Pricing ─────────────────────────────────────────────────────────

export interface JobRatePreview {
    rate: number;
    description: string | null;
}

export function previewJobRate(jobId: number): Promise<JobRatePreview> {
    return apiClient.get<JobRatePreview>('job/RecalculateJobRate', {jobId});
}

export function applyJobRate(jobId: number, isPrebook: boolean): Promise<void> {
    return apiClient.post('job/ApplyRecalculatedJobRate', null, {
        params: {jobId, isPrebook},
    });
}

// ── POD Operations ──────────────────────────────────────────────────

export function updatePodDetails(data: UpdatePodDetailsRequest): Promise<void> {
    return apiClient.post('job/UpdatePODDetails', data);
}

export function updateJobReadStatus(jobId: number, hasBeenRead: boolean): Promise<void> {
    return apiClient.post('job/UpdateJobReadStatus', null, {
        params: {jobId, hasBeenRead},
    });
}

export function sendPod(jobId: number, toEmail: string): Promise<unknown> {
    return apiClient.get('job/SendPOD', {jobId, toEmail});
}

// ── Photos ──────────────────────────────────────────────────────────

export function getJobDeliveryPhotos(
    jobId: number,
    year: number,
    month: number,
    options?: RequestOptions
): Promise<Is3PhotoInfo[]> {
    return apiClient.get<Is3PhotoInfo[]>('/Job/GetJobDeliveryPhotosAndSignature', {jobId, year, month}, options);
}

export function getJobPickupPhotos(
    jobId: number,
    year: number,
    month: number,
    options?: RequestOptions
): Promise<Is3PhotoInfo[]> {
    return apiClient.get<Is3PhotoInfo[]>('/Job/GetJobPickupPhotos', {jobId, year, month}, options);
}

// ── Reference Data Lists ────────────────────────────────────────────

export function getInternalStatusList(options?: RequestOptions): Promise<InternalStatus[]> {
    return apiClient.get<InternalStatus[]>('job/InternalStatusList', undefined, options);
}

export function getStatusList(options?: RequestOptions): Promise<ISuggestion[]> {
    return apiClient.get<ISuggestion[]>('job/StatusList', undefined, options);
}

export function getSpeedList(options?: RequestOptions): Promise<ISuggestion[]> {
    return apiClient.get<ISuggestion[]>('job/SpeedList', undefined, options);
}

export function getVehicleSizes(options?: RequestOptions): Promise<ISuggestion[]> {
    return apiClient.get<ISuggestion[]>('courier/GetVehicleSizes', undefined, options);
}

export function getLeaveList(options?: RequestOptions): Promise<ISuggestion[]> {
    return apiClient.get<ISuggestion[]>('job/LeaveList', undefined, options);
}

export function getContactList(clientId: number, options?: RequestOptions): Promise<ISuggestion[]> {
    return apiClient.get<ISuggestion[]>('job/ContactList', {clientId}, options);
}

export function getActiveStaff(options?: RequestOptions): Promise<ISuggestion[]> {
    return apiClient.get<ISuggestion[]>('task/GetStaff', undefined, options);
}

export function getUndeliverableList(options?: RequestOptions): Promise<ISuggestion[]> {
    return apiClient.get<ISuggestion[]>('job/UndeliverableList', undefined, options);
}

// ── Job Dispatch Operations ─────────────────────────────────────────

export function restoreJobs(jobIds: number[]): Promise<void> {
    return apiClient.post('job/RestoreJobs', {jobIds});
}

export function allocateJob(courierId: number, jobIds: number[]): Promise<void> {
    return apiClient.post('job/Allocate', {courierId, jobIds});
}

export function getCourierById(courierId: number): Promise<{ id: string; name: string }> {
    return apiClient.get('courier/GetCourier', {courierId});
}

// ── Package Operations ──────────────────────────────────────────────

export function updatePackages(jobId: number, parcels: IParcelDimensions[]): Promise<unknown> {
    return apiClient.post('job/UpdateJobPackages', {jobId, parcels});
}

export function updateBulkJobPackages(bulkJobId: number, parcels: IParcelDimensions[]): Promise<unknown> {
    return apiClient.post('job/UpdateBulkJobPackages', {bulkJobId, parcels});
}

// ── File Downloads ──────────────────────────────────────────────────

export async function downloadFile(s3Key: string, fileName: string): Promise<void> {
    assertValidS3Key(s3Key);
    assertValidDownloadFileName(fileName);

    const response = await apiClient.postForBlob('/job/DownloadFile', null, {
        params: {key: s3Key},
    });

    downloadBlob(response, fileName);
}

// ── URL Helpers ─────────────────────────────────────────────────────

export function getPodReportUrl(jobId: number): string {
    return `/job/PodReport?jobId=${jobId}`;
}

export function getPodSpreadsheetUrl(jobId: number): string {
    return `/job/PodSpreadsheet?jobId=${jobId}`;
}

export function getOverlayDocumentUrl(jobId: number, documentType: string): string {
    return `/job/OverlayDocument?jobId=${jobId}&documentType=${encodeURIComponent(documentType)}`;
}

// ── PDF Overlay Documents ───────────────────────────────────────────

/** An overlay document offered in the job export menu (from the Configurator template catalogue). */
export interface OverlayDocument {
    documentType: string;
    displayName: string;
    /** True when a template resolves for this job's client; false renders the menu item disabled. */
    available: boolean;
}

export function getJobOverlayDocuments(jobId: number): Promise<OverlayDocument[]> {
    return apiClient.get<OverlayDocument[]>('/job/OverlayDocuments', {jobId});
}

// ── Autocomplete Search ─────────────────────────────────────────────

export function autocompleteSearch(searchTerm: string, url: string): Promise<ISuggestion[]> {
    return apiClient.get<ISuggestion[]>(url, {searchTerm});
}

// ── File Upload Operations ──────────────────────────────────────────

export function getAttachedFiles(jobId: number): Promise<JobFile[]> {
    return apiClient.get<JobFile[]>('/job/getAttachedFiles', {jobId});
}

export async function uploadJobFile(
    jobId: number,
    file: File,
    onProgress?: (percent: number) => void,
): Promise<void> {
    const formData = new FormData();
    formData.append('jobId', jobId.toString());
    formData.append('file', file);
    formData.append('isPOD', 'false');
    if (file.type) {
        formData.append('contentType', file.type);
    }

    await apiClient.uploadFormData('/job/uploadFile', formData, {onProgress});
}

export async function uploadJobDeliveryPhotoOrSignature(
    jobId: number,
    file: File,
    podDescription?: string,
    onProgress?: (percent: number) => void,
): Promise<void> {
    const formData = new FormData();
    formData.append('jobId', jobId.toString());
    formData.append('file', file);
    formData.append('isPOD', 'true');
    if (file.type) {
        formData.append('contentType', file.type);
    }
    if (podDescription) {
        formData.append('podDescription', podDescription);
    }

    await apiClient.uploadFormData('/job/uploadJobDeliveryPhotoOrSignature', formData, {onProgress});
}

export function deleteJobFile(jobId: number, s3Key: string): Promise<void> {
    return apiClient.delete('/job/DeleteFile', {params: {jobId, key: s3Key}});
}

export function deleteJobDeliveryPhotoOrSignature(jobId: number, s3Key: string): Promise<void> {
    return apiClient.delete('/job/DeleteJobDeliveryPhotoOrSignature', {params: {jobId, key: s3Key}});
}
