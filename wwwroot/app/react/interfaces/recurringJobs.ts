/**
 * Recurring Jobs Interfaces
 *
 * TypeScript interfaces for the React Recurring Jobs page.
 */

import {AddressViewModel} from './address';
import type {Dayjs} from 'dayjs';
import {parseDateFromApi} from '../utils/dateUtils';
import type {ShowToastFn} from '../services/toastService';

/**
 * Three-state recurring operational mode.
 * Backed by tucJobBooking.RecurringMode (tinyint). Numeric values are
 * wire-format — must match DespatchWeb.Enums.RecurringMode ordinals.
 */
export enum RecurringMode {
    Inactive = 0,
    Active = 1,
    Manual = 2,
}

/**
 * Query parameters for fetching recurring jobs list
 */
export interface RecurringJobQuery {
    order: string;
    orderDirection: 'asc' | 'desc';
    limit: number;
    page: number;
    searchText?: string;
    // Legacy two-state filter kept for backwards compat. New code should
    // send recurringMode; the backend uses recurringMode when present.
    active: boolean;
    recurringMode?: RecurringMode;
    // Filters
    speedId?: number;
    time?: string;
    courierId?: number;
    daysOfWeek?: number;
    routeId?: number;
}

/**
 * Scope picker for the Manual-mode "Insert to live" action. Wire-format
 * ordinals — must match DespatchWeb.Enums.InsertToLiveScope.
 * Group is the default and the only single-booking scope (Group resolves
 * standalone bookings as families of one).
 */
export enum InsertToLiveScope {
    Group = 1,
    Route = 2,
}

export interface InsertRecurringToLiveRequest {
    jobId: number;
    // Calendar date in `YYYY-MM-DD` format. Backend binds to DateOnly —
    // do NOT send a UTC ISO instant (`toISOString()`) because that
    // rolls east-of-UTC tenants onto the previous calendar day.
    insertDate: string;
    scope: InsertToLiveScope;
}

export interface InsertRecurringToLiveResult {
    bookingsMaterialised: number;
    jobsInserted: number;
    jobsRepriced: number;
    insertedJobIds: number[];
    parentBookingIds: number[];
    // Saved-flight auto-assignment outcome on push-to-live.
    flightsAutoAssigned: number;
    flightsUnmatched: number;
}

/** ------------------------------------------------------------------
 *  CreateAheadDays backfill flow (Kevin 2026-07-16, Dane sign-off).
 *  Raised RecurringInitialDays leaves a gap of days that would have
 *  been materialised had the higher offset been in force yesterday.
 *  The preview endpoint returns which service dates fall in that gap
 *  (matching pattern / not already live / not holiday). The create
 *  endpoint materialises the operator-confirmed subset.
 *  ------------------------------------------------------------------ */

export interface PreviewCreateAheadBackfillRequest {
    jobId: number;
    oldValue: number;
    newValue: number;
}

export interface CreateAheadBackfillCandidate {
    // Calendar date only (YYYY-MM-DD). Backend serialises DateOnly directly.
    serviceDate: string;
    // Convenience label for the UI, e.g. "Mon 21 Jul".
    displayLabel: string;
}

export interface CreateAheadBackfillSkippedDate {
    serviceDate: string;
    reason: string;
}

export interface PreviewCreateAheadBackfillResult {
    candidates: CreateAheadBackfillCandidate[];
    alreadyExistingDates: string[];
    skippedDates: CreateAheadBackfillSkippedDate[];
}

export interface CreateCreateAheadBackfillRequest {
    jobId: number;
    // YYYY-MM-DD calendar dates the operator confirmed from the preview list.
    dates: string[];
}

export interface CreateCreateAheadBackfillDateError {
    serviceDate: string;
    message: string;
}

export interface CreateCreateAheadBackfillResult {
    jobsCreated: number;
    duplicatesSkipped: number;
    createdDates: string[];
    errors: CreateCreateAheadBackfillDateError[];
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
 * Recurring Route option for filter dropdown.
 * Same shape as SpeedOption — driven by Suggestion DTO on the backend.
 */
export interface RouteOption {
    id: number;
    text: string;
}

/**
 * Recurring job list item model (transformed from DTO)
 */
export interface PrebookListModel {
    id: number;
    booked: Dayjs;
    nextDueTime?: Dayjs;
    client: string;
    jobNo: string;
    clientId: number | null;
    courier: string;
    speed: string;
    customJobName?: string;
    pickupAddress: AddressViewModel;
    deliveryAddress: AddressViewModel;
    routeId?: number | null;
    routeName?: string | null;
    // Optional on the TS side so legacy mocks/fixtures that pre-date the
    // RecurringMode rollout keep compiling — production responses always
    // populate this from the backend. Treat absence as "unknown mode" at
    // the UI (kebab menu's Insert-to-live action only appears when the
    // value is explicitly Manual).
    recurringMode?: RecurringMode;
    rawBaseAmount?: number | null;
    fuelSurchargeAmount?: number | null;
    ucbkAmount?: number | null;
    // True when BookingParentID points to a different ucbkID (i.e. this
    // row is a child of a family). Standalones and parents both flag as
    // false. Drives the Insert-to-live menu item visibility — children
    // can't be pushed in isolation; only the parent can.
    isChild?: boolean;
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
    routeId?: number | null;
    routeName?: string | null;
    recurringMode?: RecurringMode;
    rawBaseAmount?: number | null;
    fuelSurchargeAmount?: number | null;
    ucbkAmount?: number | null;
    isChild?: boolean;
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
        booked: parseDateFromApi(dto.booked),
        nextDueTime: dto.nextDueTime ? parseDateFromApi(dto.nextDueTime) : undefined,
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
}

export interface RecurringJobsPageProps {
    showToast: ShowToastFn;
    isUsCustomer?: boolean;
    onAddStop?: (job: PrebookListModel, isPickup: boolean) => void;
    setRefreshCallback?: (callback: () => void) => void;
}

/**
 * Legacy type aliases for backward compatibility with AngularJS services.
 * These map to the React versions of the interfaces.
 */
export type IPrebookListModel = PrebookListModel;
export type IPrebookListModelDto = PrebookListModelDto;
export type IRecurringJobQuery = RecurringJobQuery;