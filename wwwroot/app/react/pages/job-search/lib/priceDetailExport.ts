/**
 * Price Detail Report export URL builder.
 *
 * Mirrors getPodJobsDownloadUrl exactly — same repeated-id ASP.NET param style, same
 * tenant-timezone (wall-clock) dates via formatDateForApiWithTzs. Returns a relative
 * URL intended for window.open() so the browser performs a native, cookie-authenticated
 * download; the server-side Content-Disposition supplies the filename.
 */

import {Dayjs} from 'dayjs';
import {formatDateForApiWithTzs} from '../../../utils/dateUtils';

function appendIds(params: URLSearchParams, key: string, ids?: number[]): void {
    ids?.forEach(id => params.append(key, id.toString()));
}

export function getPriceDetailReportDownloadUrl(
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
    return `/Job/PriceDetailReportDownload?${params.toString()}`;
}
