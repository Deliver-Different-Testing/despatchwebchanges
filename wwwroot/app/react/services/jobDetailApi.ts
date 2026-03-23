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
import {formatDateForApi} from '../utils/dateUtils';
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

export function updateJobDetail(
    jobId: number,
    field: string,
    value: unknown,
    isRecurring: boolean,
    timezone?: string
): Promise<unknown> {
    let processedValue = value;
    if (value instanceof Date || dayjs.isDayjs(value as Dayjs)) {
        processedValue = formatDateForApi(value as Date | Dayjs, timezone);
    }

    const url = isRecurring ? 'job/UpdateRecurringJob' : 'job/UpdateJob';
    return apiClient.post(url, null, {
        params: {jobId, field, value: processedValue, isRecurring},
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
): Promise<void> {
    return apiClient.post(getAddressEndpoint(prebook, 'pickup'), {jobId, address});
}

export function updateDeliveryAddress(
    jobId: number,
    prebook: boolean,
    address: IAddressViewModel
): Promise<void> {
    return apiClient.post(getAddressEndpoint(prebook, 'delivery'), {jobId, address});
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

// ── Job Dispatch Operations ─────────────────────────────────────────

export function restoreJobs(jobIds: number[]): Promise<void> {
    return apiClient.post('job/RestoreJobs', {jobIds});
}

export function allocateJob(courierId: number, jobIds: number[]): Promise<void> {
    return apiClient.post('job/Allocate', {courierId, jobIds});
}

export function getCourierById(courierId: number): Promise<{id: string; name: string}> {
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
    if (!s3Key || s3Key.includes('..') || s3Key.includes('\0')) {
        throw new Error('Invalid file key');
    }
    if (!fileName || fileName.includes('..') || fileName.includes('\0') || fileName.includes('/') || fileName.includes('\\')) {
        throw new Error('Invalid file name');
    }

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

// ── Autocomplete Search ─────────────────────────────────────────────

export function autocompleteSearch(searchTerm: string, url: string): Promise<ISuggestion[]> {
    return apiClient.get<ISuggestion[]>(url, {searchTerm});
}
