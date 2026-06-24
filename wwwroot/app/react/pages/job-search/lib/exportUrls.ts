/**
 * Job Search export URL builders.
 *
 * Framework-agnostic ports of the V1 `JobSearchService.getPodJobsDownloadUrl`
 * and `getClientJobsReportDownloadUrl` (see
 * `wwwroot/app/components/jobSearch/jobSearch.service.ts`). Shared so the
 * AngularJS V1 service and the React V2 page build the exact same URLs —
 * correct endpoint names, tenant-timezone (wall-clock) dates, and the full
 * parameter set (`speedIds`/`jobId` included).
 *
 * These return relative URLs intended to be opened with `window.open(url)`
 * so the browser performs a native, cookie-authenticated download.
 */

import {Dayjs} from 'dayjs';
import {formatDateForApiWithTzs} from '../../../utils/dateUtils';

/** Append each id under the same key (ASP.NET repeated-param style): key=1&key=2. */
function appendIds(params: URLSearchParams, key: string, ids?: number[]): void {
    ids?.forEach(id => params.append(key, id.toString()));
}

export function getPodJobsDownloadUrl(
    fromDate: Dayjs,
    toDate: Dayjs,
    courierIds?: number[],
    clientIds?: number[],
    speedIds?: number[],
    wild?: string,
    job?: string,
    jobId?: number,
): string {
    const params = new URLSearchParams();
    params.append('fromDate', formatDateForApiWithTzs(fromDate));
    params.append('toDate', formatDateForApiWithTzs(toDate));
    appendIds(params, 'courierIds', courierIds);
    appendIds(params, 'clientIds', clientIds);
    appendIds(params, 'speedIds', speedIds);
    if (wild) params.append('wild', wild);
    if (job) params.append('job', job);
    if (jobId) params.append('jobId', jobId.toString());
    return `/Job/PodSearchDownload?${params.toString()}`;
}

export function getClientJobsReportDownloadUrl(
    fromDate: Dayjs,
    toDate: Dayjs,
    clientIds?: number[],
): string {
    const params = new URLSearchParams();
    params.append('startDate', formatDateForApiWithTzs(fromDate));
    params.append('endDate', formatDateForApiWithTzs(toDate));
    appendIds(params, 'clientIds', clientIds);
    return `/Job/ClientJobsReportDownload?${params.toString()}`;
}
