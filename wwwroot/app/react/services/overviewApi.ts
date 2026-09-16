/**
 * Overview API Service
 *
 * Axios-based API service replacing the AngularJS OverviewService.
 */

import {apiClient} from './apiClient';
import {formatDateForApiWithTzs, formatLongDateTime, parseDateFromApi} from '../utils/dateUtils';
import type {
    OverviewQueryParams,
    OverviewStatsViewModel,
    PaginatedResponse,
    OverviewTableParentJob,
    ISuggestion,
    MapConfig,
    IOpenJobResponseDto,
    IOpenJobResponse,
} from '../pages/overview/OverviewPage.interfaces';
import {RequestOptions} from "./requestOptions";

async function getAllJobs(
    params: OverviewQueryParams,
    options?: RequestOptions,
): Promise<PaginatedResponse<OverviewTableParentJob>> {
    return apiClient.get<PaginatedResponse<OverviewTableParentJob>>(
        '/overview',
        {
            statusGroup: params.statusGroup,
            page: params.page,
            limit: params.limit,
            search: params.search || undefined,
            startDate: params.startDate ? formatDateForApiWithTzs(params.startDate) : undefined,
            endDate: params.endDate ? formatDateForApiWithTzs(params.endDate) : undefined,
            orderBy: params.orderBy || 'jobName',
            orderDirection: params.orderDirection,
            regions: params.regions,
            speeds: params.speeds,
            couriers: params.couriers,
            despatchViewIds: params.despatchViewIds,
        } as Record<string, unknown>,
        options,
    );
}

async function getAllRegions(options?: RequestOptions): Promise<ISuggestion[]> {
    return apiClient.get<ISuggestion[]>('/overview/GetAllRegions', undefined, options);
}

async function getAllSpeeds(options?: RequestOptions): Promise<ISuggestion[]> {
    return apiClient.get<ISuggestion[]>('/overview/GetAllSpeeds', undefined, options);
}

async function getStats(options?: RequestOptions): Promise<OverviewStatsViewModel> {
    return apiClient.get<OverviewStatsViewModel>('/overview/GetStats', undefined, options);
}

async function getParentJobMap(jobId: number, options?: RequestOptions): Promise<MapConfig> {
    return apiClient.get<MapConfig>('/overview/GetParentJobMap', {jobId} as Record<string, unknown>, options);
}

async function getOpenJobs(
    params: Pick<OverviewQueryParams, 'startDate' | 'endDate' | 'regions' | 'speeds' | 'couriers' | 'despatchViewIds'>,
    options?: RequestOptions,
): Promise<IOpenJobResponse[]> {
    const dtos = await apiClient.get<IOpenJobResponseDto[]>(
        '/overview/GetOpenJobs',
        {
            startDate: params.startDate ? formatDateForApiWithTzs(params.startDate) : undefined,
            endDate: params.endDate ? formatDateForApiWithTzs(params.endDate) : undefined,
            regions: params.regions,
            speeds: params.speeds,
            couriers: params.couriers,
            despatchViewIds: params.despatchViewIds,
        } as Record<string, unknown>,
        options,
    );

    return dtos.map((dto) => ({
        ...dto,
        _pickUpTimeStr: dto.pickupTime ? formatLongDateTime(parseDateFromApi(dto.pickupTime)) : undefined,
        _deliveryTimeStr: dto.deliveryTime ? formatLongDateTime(parseDateFromApi(dto.deliveryTime)) : undefined,
    }));
}

async function searchCouriers(
    searchText: string,
    options?: RequestOptions,
): Promise<ISuggestion[]> {
    return apiClient.get<ISuggestion[]>(
        '/courier/AllActiveSearch',
        {search: searchText} as Record<string, unknown>,
        options,
    );
}

export const overviewApi = {
    getAllJobs,
    getAllRegions,
    getAllSpeeds,
    getStats,
    getParentJobMap,
    getOpenJobs,
    searchCouriers,
};

export default overviewApi;
