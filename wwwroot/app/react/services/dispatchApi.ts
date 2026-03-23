/**
 * Dispatch API Service
 *
 * API functions for the dispatch dashboard, replacing the AngularJS
 * dispatch-core.service.ts calls. Uses the shared apiClient and
 * follows the same patterns as other React API services.
 */

import {apiClient, RequestOptions} from './apiClient';
import {formatDateForApiWithTzs} from '../utils/dateUtils';
import {transformDispatchJobDTO} from '../../functions/dtoMappings';
import type {IClearListViewModel} from '../../interfaces/job.interface';
import type {IJobSearchResultDto} from '../../interfaces/job.interface';
import type {JobSearchResult, JobListSearchParams} from '../interfaces/dispatchJob';
import type {IDriverWorkOverview} from '../components/common/current-work-all-drivers/CurrentWorkAllDrivers.types';
import type {IEditAddressDialogViewModel} from '../../interfaces/job.interface';

// ── Interfaces ──────────────────────────────────────────────────────

export interface DfrntPageViewModel {
    id: number;
    name: string;
    selected: boolean;
    centerLatitude?: number;
    centerLongitude?: number;
}

export interface IPotentialCourier {
    courierId: number;
    name: string;
    distance: number;
}

// ── Helpers ─────────────────────────────────────────────────────────

function formatDate(date: unknown): string | undefined {
    if (!date) return undefined;
    return formatDateForApiWithTzs(date as any);
}

function transformResult(dto: IJobSearchResultDto): JobSearchResult {
    return {
        jobs: dto.jobs.map(transformDispatchJobDTO) as any,
        totalCount: dto.totalCount,
        hasMore: dto.hasMore,
    };
}

// ── Driver Locations ────────────────────────────────────────────────

/**
 * Fetch driver locations for the given dispatch view IDs and optional date range.
 */
export async function getDriverLocations(
    despatchViewIds: (string | number)[],
    startDate?: unknown,
    endDate?: unknown,
    options?: RequestOptions,
): Promise<IClearListViewModel> {
    return apiClient.get<IClearListViewModel>('courier', {
        despatchViewIds,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
    }, options);
}

// ── Driver Work Overview ────────────────────────────────────────────

/**
 * Fetch an overview of current work across all drivers.
 */
export async function getDriverWorkOverview(
    options?: RequestOptions,
): Promise<IDriverWorkOverview[]> {
    return apiClient.get<IDriverWorkOverview[]>('courier/DriverWorkOverview', undefined, options);
}

// ── Current Jobs for a Courier ──────────────────────────────────────

/**
 * Fetch current jobs assigned to a specific courier within a date range.
 */
export async function getJobsCurrent(
    courierId: number,
    startDate: unknown,
    endDate: unknown,
    options?: RequestOptions,
): Promise<JobSearchResult> {
    const dto = await apiClient.get<IJobSearchResultDto>('job/GetJobsCurrent', {
        courierId,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
    }, options);

    return transformResult(dto);
}

// ── Current Work Jobs (FetchConfig-compatible) ──────────────────────

/**
 * Fetch current work jobs for a courier. Conforms to FetchConfig.fetchFn
 * signature so it can be used with JobListPanel's React Query integration.
 *
 * Requires `courierIds[0]` in params to identify the courier.
 * Uses a full-day date range (epoch → tomorrow) to show all assigned work.
 */
export function createCurrentWorkFetchFn(courierId: number) {
    return async (params: JobListSearchParams, options?: RequestOptions): Promise<JobSearchResult> => {
        return getJobsCurrent(
            courierId,
            params.startDate ?? new Date(0),
            params.endDate ?? new Date(Date.now() + 86400000),
            options,
        );
    };
}

// ── Page Views (Dispatch Views) ─────────────────────────────────────

/**
 * Fetch available dispatch page views.
 */
export async function getPageViews(
    options?: RequestOptions,
): Promise<DfrntPageViewModel[]> {
    return apiClient.get<DfrntPageViewModel[]>('DispatchView', undefined, options);
}

// ── Potential Couriers ──────────────────────────────────────────────

/**
 * Fetch potential couriers that could be assigned to a given job.
 */
export async function getPotentialCouriers(
    jobId: number,
    options?: RequestOptions,
): Promise<IPotentialCourier[]> {
    return apiClient.get<IPotentialCourier[]>('courier/PotentialCouriers', {
        jobId,
    }, options);
}

// ── Exact Courier Match ─────────────────────────────────────────────

export interface CourierSuggestion {
    id: number;
    text: string;
}

/**
 * Find a courier by exact code match.
 */
export async function getExactCourierMatch(
    courierCode: string,
    options?: RequestOptions,
): Promise<CourierSuggestion> {
    return apiClient.get<CourierSuggestion>('courier/GetExactCourierByCode', {
        courierCode,
    }, options);
}

// ── Unread Message Count ────────────────────────────────────────────

/**
 * Get count of unread messages for the current staff member.
 */
export async function getUnreadMessageCount(
    options?: RequestOptions,
): Promise<number> {
    const conversations = await apiClient.get<Array<{ unreadCount?: number }>>('messages/GetRecentList', undefined, options);
    return (conversations || []).reduce((sum, c) => sum + (c.unreadCount || 0), 0);
}

// ── Truck Courier Status ─────────────────────────────────────────────

export interface ITruckCourierStatus {
    courierId: number;
    courierCode: string;
    firstName: string;
    maxPallets?: number;
    maxPayLoad?: number;
    currentPallets?: number;
    currentWeight?: number;
    availablePalletCapacity?: number;
    availablePallets?: number;
    lastUpdated: string;
}

/**
 * Fetch truck loading status for a courier.
 */
export async function getTruckCourierStatus(
    courierId: number,
    options?: RequestOptions,
): Promise<ITruckCourierStatus> {
    return apiClient.get<ITruckCourierStatus>('courier/TruckCourierStatus', {
        courierId,
    }, options);
}

// ── Add Stop to Job ─────────────────────────────────────────────────

/**
 * Add a stop (pickup or delivery) to an existing job.
 * Returns the new job ID created by the stop.
 */
export async function addStopToJob(
    jobId: number,
    pickUpAddress?: IEditAddressDialogViewModel,
    deliveryAddress?: IEditAddressDialogViewModel,
    options?: RequestOptions,
): Promise<number> {
    return apiClient.post<number>('job/AddStopToJob', {
        jobId,
        pickUpAddress,
        deliveryAddress,
    }, options);
}

// ── Aggregate Export ────────────────────────────────────────────────

export const dispatchApi = {
    getDriverLocations,
    getDriverWorkOverview,
    getJobsCurrent,
    getPageViews,
    getPotentialCouriers,
    getExactCourierMatch,
    getUnreadMessageCount,
    getTruckCourierStatus,
    addStopToJob,
};

export default dispatchApi;
