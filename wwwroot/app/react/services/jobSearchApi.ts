/**
 * Job Search API Service
 *
 * React-side API functions for fetching job lists from all pages.
 * Replaces the AngularJS service layer for data fetching, using the
 * existing apiClient and transformDispatchJobDTO for DTO mapping.
 */

import {apiClient, RequestOptions} from './apiClient';
import {transformDispatchJobDTO} from '../../functions/dtoMappings';
import {formatDateForApiWithTzs} from '../utils/dateUtils';
import type {IJobSearchResultDto} from '../../interfaces/job.interface';
import type {JobListSearchParams, JobSearchResult} from '../interfaces/dispatchJob';

// ── Helpers ──────────────────────────────────────────────────────────

function transformResult(dto: IJobSearchResultDto): JobSearchResult {
    return {
        jobs: dto.jobs.map(transformDispatchJobDTO) as any,
        totalCount: dto.totalCount,
        hasMore: dto.hasMore,
    };
}

function formatDate(date: unknown): string | undefined {
    if (!date) return undefined;
    return formatDateForApiWithTzs(date as any);
}

// ── POD Search (Job Search page) ─────────────────────────────────────

export async function fetchPodJobs(
    params: JobListSearchParams,
    options?: RequestOptions,
): Promise<JobSearchResult> {
    const dto = await apiClient.get<IJobSearchResultDto>('/Job/PODSearch', {
        courierIds: params.courierIds,
        clientIds: params.clientIds,
        speedIds: params.speedIds,
        wild: params.wild,
        job: params.job,
        jobId: params.jobId,
        page: params.page ?? 0,
        pageSize: params.pageSize ?? 50,
        fromDate: formatDate(params.startDate),
        toDate: formatDate(params.endDate),
        sortColumn: params.sortColumn ?? params.order,
        sortDirection: params.sortDirection ?? params.orderDirection,
    }, options);

    return transformResult(dto);
}

// ── Bulk Search (Job Search page) ────────────────────────────────────

export async function fetchBulkJobs(
    params: JobListSearchParams,
    options?: RequestOptions,
): Promise<JobSearchResult> {
    const dto = await apiClient.get<IJobSearchResultDto>('/Job/BulkSearch', {
        courierIds: params.courierIds,
        clientIds: params.clientIds,
        speedIds: params.speedIds,
        job: params.job,
        wild: params.wild,
        bulkJobId: params.bulkJobId,
        page: params.page ?? 0,
        pageSize: params.pageSize ?? 50,
        fromDate: formatDate(params.startDate),
        toDate: formatDate(params.endDate),
    }, options);

    return transformResult(dto);
}

// ── Dispatch Jobs (Home page) ────────────────────────────────────────

export async function fetchDispatchJobs(
    params: JobListSearchParams,
    options?: RequestOptions,
): Promise<JobSearchResult> {
    const dto = await apiClient.get<IJobSearchResultDto>('/job', {
        startDate: formatDate(params.startDate),
        endDate: formatDate(params.endDate),
        useTime: params.useTime,
        order: params.order ?? 'time',
        orderDirection: params.orderDirection ?? 'asc',
        isInternal: params.isInternal,
        page: params.page ?? 0,
        pageSize: params.pageSize ?? 50,
        searchText: params.searchText ?? '',
        statusFilter: params.statusFilter,
        despatchViewIds: params.despatchViewIds,
    }, options);

    return transformResult(dto);
}

// ── Clear List Jobs (Home page) ──────────────────────────────────────

export async function fetchClearListJobs(
    params: JobListSearchParams,
    options?: RequestOptions,
): Promise<JobSearchResult> {
    const dto = await apiClient.get<IJobSearchResultDto>('/job/GetJobsByClearListEnvelope', {
        startDate: formatDate(params.startDate),
        endDate: formatDate(params.endDate),
        useTime: params.useTime,
        order: params.order ?? 'time',
        orderDirection: params.orderDirection ?? 'asc',
        isInternal: params.isInternal,
        page: params.page ?? 0,
        pageSize: params.pageSize ?? 50,
        searchText: params.searchText ?? '',
        statusFilter: params.statusFilter,
        despatchViewIds: params.despatchViewIds,
        selectedClearListId: params.selectedClearListId,
    }, options);

    return transformResult(dto);
}

// ── Nationwide Jobs (Domestic page) ──────────────────────────────────

async function fetchNationwideJobs(
    endpoint: string,
    params: JobListSearchParams,
    options?: RequestOptions,
): Promise<JobSearchResult> {
    const dto = await apiClient.get<IJobSearchResultDto>(`/nationwidejob/${endpoint}`, {
        order: params.order ?? 'time',
        orderDirection: params.orderDirection ?? 'asc',
        startDate: formatDate(params.startDate),
        dateCutoff: formatDate(params.endDate),
        isInternal: params.isInternal,
        despatchViewIds: params.despatchViewIds,
        page: params.page ?? 0,
        pageSize: params.pageSize ?? 50,
        searchText: params.searchText ?? '',
        useTime: params.useTime,
    }, options);

    return transformResult(dto);
}

export async function fetchNationwideJobsNew(
    params: JobListSearchParams,
    options?: RequestOptions,
): Promise<JobSearchResult> {
    return fetchNationwideJobs('nationwideJobListNew', params, options);
}

export async function fetchNationwideJobsPod(
    params: JobListSearchParams,
    options?: RequestOptions,
): Promise<JobSearchResult> {
    return fetchNationwideJobs('NationwideJobListPod', params, options);
}

export async function fetchNationwideJobsReprice(
    params: JobListSearchParams,
    options?: RequestOptions,
): Promise<JobSearchResult> {
    return fetchNationwideJobs('nationwideJobListReprice', params, options);
}
