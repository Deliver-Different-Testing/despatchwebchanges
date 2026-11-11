/**
 * Price Detail Report export URL builder.
 *
 * Mirrors getPodJobsDownloadUrl exactly — same repeated-id ASP.NET param style, same
 * tenant-timezone (wall-clock) dates via formatDateForApiWithTzs. Returns a relative
 * URL intended for window.open() so the browser performs a native, cookie-authenticated
 * download; the server-side Content-Disposition supplies the filename.
 */

import {buildJobSearchExportParams, type JobSearchExportArgs} from './exportUrls';

export function getPriceDetailReportDownloadUrl(...args: JobSearchExportArgs): string {
    return `/Job/PriceDetailReportDownload?${buildJobSearchExportParams(...args).toString()}`;
}
