/**
 * Recurring Jobs API Service
 *
 * API client for recurring jobs operations.
 * Used by the React Recurring Jobs page.
 */

import {apiClient, RequestOptions, downloadBlob} from './apiClient';
import {parseDateFromApi, getTenantTimezone} from '../utils/dateUtils';
import {
    CreateCreateAheadBackfillRequest,
    CreateCreateAheadBackfillResult,
    InsertRecurringToLiveRequest,
    InsertRecurringToLiveResult,
    PaginatedRecurringJobsResponse,
    PaginatedRecurringJobsResponseDto,
    PreviewCreateAheadBackfillRequest,
    PreviewCreateAheadBackfillResult,
    RecurringJobQuery,
    RecurringMode,
    RouteOption,
    SpeedOption,
    transformPaginatedResponse,
} from '../interfaces';
import type {
    RecurringJourney,
    RecurringJourneyDto,
    RecurringJourneyRunDto,
    RecurringJourneyRun,
} from '../components/common/recurring-delivery-journey/RecurringDeliveryJourney.types';

function transformRecurringJourneyRun(dto: RecurringJourneyRunDto): RecurringJourneyRun {
    return {
        ...dto,
        // parseDateFromApi (not bare dayjs) preserves the backend's wall-clock + offset
        // as-is; bare dayjs() would re-project the instant into the browser's timezone
        // and shift the displayed service/POD time.
        serviceDate: parseDateFromApi(dto.serviceDate),
        pod: dto.pod
            ? {time: parseDateFromApi(dto.pod.time), signedBy: dto.pod.signedBy}
            : null,
    };
}

function transformRecurringJourney(dto: RecurringJourneyDto): RecurringJourney {
    return {
        breakdown: dto.breakdown,
        runs: (dto.runs || []).map(transformRecurringJourneyRun),
    };
}

export const recurringJobsApi = {
    /**
     * Fetch paginated list of recurring jobs
     * @param query - Query parameters for filtering, sorting, and pagination
     * @param options - Request options (signal, timeout)
     * @returns Paginated response with transformed job models
     */
    getPreBookJobs: async (query: RecurringJobQuery, options?: RequestOptions): Promise<PaginatedRecurringJobsResponse> => {
        const response = await apiClient.post<PaginatedRecurringJobsResponseDto>(
            'job/PreBookJobs',
            query,
            options
        );
        return transformPaginatedResponse(response);
    },

    /**
     * Fetch list of available speeds for filtering
     * @param options - Request options (signal, timeout)
     * @returns Array of speed options
     */
    getSpeedList: async (options?: RequestOptions): Promise<SpeedOption[]> => {
        return await apiClient.get<SpeedOption[]>('job/SpeedList', undefined, options);
    },

    /**
     * Fetch list of active Recurring Routes for the route filter dropdown.
     * @param options - Request options (signal, timeout)
     * @returns Array of route options
     */
    getRouteList: async (options?: RequestOptions): Promise<RouteOption[]> => {
        return await apiClient.get<RouteOption[]>('job/RouteList', undefined, options);
    },

    /**
     * Export recurring jobs to CSV
     * Downloads the file directly via blob
     * @param query - Query parameters to filter exported jobs
     */
    exportToCsv: async (query: RecurringJobQuery): Promise<void> => {
        const response = await apiClient.postForBlob('job/RecurringJobsExportCsv', query);
        // Honor the three-state mode for the download filename suffix
        // when present, falling back to the legacy active/inactive label.
        const modeLabel = query.recurringMode !== undefined
            ? RecurringMode[query.recurringMode].toLowerCase()
            : (query.active ? 'active' : 'inactive');
        downloadBlob(response, `recurring-jobs-${modeLabel}.csv`);
    },

    /**
     * Manual-mode operator push of a recurring booking into live tucJob.
     * Source booking stays on RecurringMode = Manual after the call.
     */
    insertToLive: async (request: InsertRecurringToLiveRequest): Promise<InsertRecurringToLiveResult> => {
        return await apiClient.post<InsertRecurringToLiveResult>('job/InsertRecurringToLive', request);
    },

    /**
     * Preview interim service dates that would be materialised if the operator
     * raises RecurringInitialDays from `oldValue` to `newValue` on a template.
     * Read-only — safe to call as the operator adjusts the value in the dialog.
     */
    previewCreateAheadBackfill: async (
        request: PreviewCreateAheadBackfillRequest
    ): Promise<PreviewCreateAheadBackfillResult> => {
        return await apiClient.post<PreviewCreateAheadBackfillResult>(
            'job/PreviewCreateAheadBackfill', request
        );
    },

    /**
     * Materialise the operator-confirmed subset of dates from the preview
     * candidate list. Each date rotates a fresh ucbkJobNumber family via the
     * same SP path uspPrebookSet uses nightly, so double-click yields
     * jobsCreated=0 on the second call (dup guard against family + date).
     */
    createCreateAheadBackfill: async (
        request: CreateCreateAheadBackfillRequest
    ): Promise<CreateCreateAheadBackfillResult> => {
        return await apiClient.post<CreateCreateAheadBackfillResult>(
            'job/CreateCreateAheadBackfill', request
        );
    },

    /**
     * Fetch the recurring log entries (one per spawned live job) plus
     * breakdown counts for a recurring booking.
     */
    getDeliveryJourney: async (bookingId: number, options?: RequestOptions): Promise<RecurringJourney> => {
        const response = await apiClient.get<RecurringJourneyDto>(
            'job/GetRecurringJobDeliveryJourney',
            {bookingId, timeZone: getTenantTimezone()},
            options,
        );
        return transformRecurringJourney(response);
    },
};

export default recurringJobsApi;
