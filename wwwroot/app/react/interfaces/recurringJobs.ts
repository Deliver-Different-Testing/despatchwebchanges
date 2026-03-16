/**
 * Recurring Jobs Interfaces
 *
 * TypeScript interfaces for the React Recurring Jobs page.
 */

import {AddressViewModel} from './address';
import type {ShowToastFn} from '../services/toastService';

/**
 * Query parameters for fetching recurring jobs list
 */
export interface RecurringJobQuery {
    order: string;
    orderDirection: 'asc' | 'desc';
    limit: number;
    page: number;
    searchText?: string;
    active: boolean;
    // Filters
    speedId?: number;
    time?: string;
    courierId?: number;
    daysOfWeek?: number;
}

/**
 * Days of week bitmask values
 */
export const DAYS_OF_WEEK_BITS = {
    Monday: 1,
    Tuesday: 2,
    Wednesday: 4,
    Thursday: 8,
    Friday: 16,
    Saturday: 32,
    Sunday: 64,
} as const;

export type DayOfWeekKey = keyof typeof DAYS_OF_WEEK_BITS;

/**
 * Speed option for filter dropdown
 */
export interface SpeedOption {
    id: number;
    text: string;
}

/**
 * Recurring job list item model (transformed from DTO)
 */
export interface PrebookListModel {
    id: number;
    booked: Date;
    nextDueTime?: Date;
    client: string;
    jobNo: string;
    clientId: number | null;
    courier: string;
    speed: string;
    customJobName?: string;
    pickupAddress: AddressViewModel;
    deliveryAddress: AddressViewModel;
}

/**
 * Recurring job list item DTO (from backend)
 */
export interface PrebookListModelDto {
    id: number;
    booked: string;
    nextDueTime?: string;
    client: string;
    jobNo: string;
    clientId: number | null;
    courier: string;
    speed: string;
    customJobName?: string;
    pickupAddress: AddressViewModel;
    deliveryAddress: AddressViewModel;
}

/**
 * Paginated response for recurring jobs
 */
export interface PaginatedRecurringJobsResponse {
    items: PrebookListModel[];
    total: number;
    page: number;
    pages: number;
}

/**
 * DTO version of paginated response
 */
export interface PaginatedRecurringJobsResponseDto {
    items: PrebookListModelDto[];
    total: number;
    page: number;
    pages: number;
}

/**
 * Table column definition for recurring jobs
 */
export interface RecurringJobColumn {
    key: string;
    label: string;
    sortable: boolean;
    sortKey?: string;
    width?: string;
    align?: 'left' | 'center' | 'right';
}

/**
 * Sort state for data table
 */
export interface RecurringJobSort {
    column: string;
    direction: 'asc' | 'desc';
}

/**
 * Context menu state
 */
export interface RecurringJobContextMenu {
    mouseX: number;
    mouseY: number;
    job: PrebookListModel;
}

/**
 * Transform DTO to model
 */
export function transformPrebookDto(dto: PrebookListModelDto): PrebookListModel {
    return {
        ...dto,
        booked: new Date(dto.booked),
        nextDueTime: dto.nextDueTime ? new Date(dto.nextDueTime) : undefined,
    };
}

/**
 * Transform paginated response DTO to model
 */
export function transformPaginatedResponse(
    dto: PaginatedRecurringJobsResponseDto
): PaginatedRecurringJobsResponse {
    return {
        ...dto,
        items: dto.items.map(transformPrebookDto),
    };
}

export interface MountRecurringJobsConfig {
    showToast: ShowToastFn;
    isUsCustomer?: boolean;
    onAddStop?: (job: PrebookListModel, isPickup: boolean) => void;
    onJobSelect?: (jobId: number | null) => void;
}

export interface RecurringJobsPageProps {
    showToast: ShowToastFn;
    isUsCustomer?: boolean;
    onAddStop?: (job: PrebookListModel, isPickup: boolean) => void;
    onJobSelect?: (jobId: number | null) => void;
    setRefreshCallback?: (callback: () => void) => void;
}

/**
 * Legacy type aliases for backward compatibility with AngularJS services.
 * These map to the React versions of the interfaces.
 */
export type IPrebookListModel = PrebookListModel;
export type IPrebookListModelDto = PrebookListModelDto;
export type IRecurringJobQuery = RecurringJobQuery;