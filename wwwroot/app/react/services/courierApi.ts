/**
 * Courier API Service
 *
 * React-native API service for courier-related operations.
 */

import {apiClient, RequestOptions} from './apiClient';
import {CourierSuggestion, TimeZoneOption} from '../interfaces';
import type {IAvailableCourierPosition, ITruckCourierStatus} from '../../interfaces/courier.interface';
import type {IClearListViewModel} from '../../interfaces/job.interface';
import type {ClearListEnvelopeData} from '../components/common/dispatch-map/DispatchMap.types';
import type {FleetOption} from '../interfaces/driverManagement';
import type {IDriverWorkOverview} from '../components/common/current-work-all-drivers';
import {formatDateForApiWithTzs} from '../utils/dateUtils';
import type {Dayjs} from 'dayjs';

/**
 * Search for active couriers
 */
export async function searchActiveCouriers(searchText: string, options?: RequestOptions): Promise<CourierSuggestion[]> {
    return apiClient.get<CourierSuggestion[]>('courier/AllActiveSearch', {
        searchTerm: searchText,
    }, options);
}

/**
 * Search for active couriers with extended filtering (dgOnly, loggedInOnly)
 */
export async function searchActiveCouriersExtended(
    searchText: string,
    options?: { dgOnly?: boolean; loggedInOnly?: boolean } & RequestOptions
): Promise<CourierSuggestion[]> {
    const params: Record<string, any> = { searchTerm: searchText };
    if (options?.dgOnly) params.dgOnly = true;
    if (options?.loggedInOnly) params.loggedInOnly = true;
    return apiClient.get<CourierSuggestion[]>('courier/AllActiveSearch', params, options);
}

/**
 * Get timezone options
 */
export async function getTimeZoneOptions(options?: RequestOptions): Promise<TimeZoneOption[]> {
    return apiClient.get<TimeZoneOption[]>('job/GetTimeZoneOptions', undefined, options);
}

/**
 * Get the "all drivers" work overview (driver + job count) for the Current Work
 * panel. Mirrors the V1 DispatchCoreService.getDriverWorkOverview.
 */
export async function fetchDriverWorkOverview(options?: RequestOptions): Promise<IDriverWorkOverview[]> {
    return apiClient.get<IDriverWorkOverview[]>('courier/GetDriverWorkOverview', undefined, options);
}

/**
 * Get a courier's truck loading status (pallet/weight capacity). Mirrors V1
 * DispatchCoreService.truckCourierStatus (`GET courier/TruckCourierStatus`).
 */
export async function fetchTruckCourierStatus(
    courierId: number,
    options?: RequestOptions,
): Promise<ITruckCourierStatus> {
    return apiClient.get<ITruckCourierStatus>('courier/TruckCourierStatus', {courierId}, options);
}

/**
 * Get the driver-locations clear list for the given dispatch views and date
 * range. Mirrors the V1 DispatchCoreService.getDriverLocations (`GET courier`).
 */
export async function fetchDriverLocations(
    params: {despatchViewIds: number[]; startDate?: Dayjs; endDate?: Dayjs},
    options?: RequestOptions,
): Promise<IClearListViewModel> {
    return apiClient.get<IClearListViewModel>('courier', {
        despatchViewIds: params.despatchViewIds,
        startDate: params.startDate ? formatDateForApiWithTzs(params.startDate) : undefined,
        endDate: params.endDate ? formatDateForApiWithTzs(params.endDate) : undefined,
    }, options);
}

/**
 * Get available courier locations within bounds
 */
export async function getAvailableCourierLocations(
    minLng: number,
    minLat: number,
    maxLng: number,
    maxLat: number,
    courierFleetIds?: number[],
    options?: RequestOptions
): Promise<IAvailableCourierPosition[]> {
    const params: Record<string, unknown> = {minLng, minLat, maxLng, maxLat};
    if (courierFleetIds && courierFleetIds.length > 0) {
        params.courierFleetIds = courierFleetIds;
    }
    return apiClient.get<IAvailableCourierPosition[]>('courier/AvailableCourierLocation', params, options);
}

/**
 * Get all courier fleets as id/text options for selectors
 */
export async function getAllFleetOptions(options?: RequestOptions): Promise<FleetOption[]> {
    return apiClient.get<FleetOption[]>('courier/GetAllFleetOptions', undefined, options);
}

/**
 * Get envelope (bounding box) for a clear list area
 */
export async function getClearListEnvelope(clearListId: number, options?: RequestOptions): Promise<ClearListEnvelopeData> {
    return apiClient.get<ClearListEnvelopeData>('courier/ClearListEnvelope', {
        clearListId,
    }, options);
}

export const courierApi = {
    searchActiveCouriers,
    searchActiveCouriersExtended,
    getTimeZoneOptions,
    getAvailableCourierLocations,
    getClearListEnvelope,
    getAllFleetOptions,
};

export default courierApi;
