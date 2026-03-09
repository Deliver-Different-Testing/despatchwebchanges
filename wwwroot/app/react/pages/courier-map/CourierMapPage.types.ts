/**
 * CourierMapPage Type Definitions
 *
 * Type definitions for the CourierMapPage React component.
 */

// Re-export from courier interface for convenience
import React from "react";

export type { IAvailableCourierPosition } from '../../../interfaces/courier.interface';

/**
 * Driver status based on workload
 */
export type DriverStatus = 'overdue' | 'active' | 'idle';

/**
 * Determines a driver's status from their job data
 */
export function getDriverStatus(driver: import('../../../interfaces/courier.interface').IAvailableCourierPosition): DriverStatus {
    if (driver.overDueJobs > 0) return 'overdue';
    if (driver.totalJobs > 0) return 'active';
    return 'idle';
}

/**
 * Color definitions for status-based map markers
 */
export const MARKER_COLORS: Record<DriverStatus, { bg: string; border: string; text: string }> = {
    overdue: { bg: '#dc2626', border: '#991b1b', text: '#ffffff' },
    active:  { bg: '#2563eb', border: '#1e40af', text: '#ffffff' },
    idle:    { bg: '#475569', border: '#334155', text: '#ffffff' },
};

/**
 * Internal marker tracking state
 */
export interface CourierMarker {
    courierId: number;
    marker: any;
    name: string;
    status: DriverStatus;
    lat: number;
    lng: number;
}

/**
 * Regional bounds for courier queries
 */
export interface RegionalBounds {
    minLng: number;
    maxLng: number;
    minLat: number;
    maxLat: number;
}

/**
 * Props for the main CourierMapPage component
 */
export interface CourierMapPageProps {
    /** Whether this is a US customer (affects bounds and labels) */
    isUsCustomer: boolean;
    /** Map center coordinates */
    mapCenter: { lat: number; lng: number };
}

/**
 * Props for the DriversPanel component
 */
export interface DriversPanelProps {
    /** List of drivers to display */
    drivers: import('../../../interfaces/courier.interface').IAvailableCourierPosition[];
    /** Total count of active drivers */
    totalActiveDrivers: number;
    /** Whether data is currently loading */
    isLoading: boolean;
    /** Current search input value */
    searchInputValue: string;
    /** Debounced search term for filtering */
    searchTerm: string;
    /** Callback when search term changes */
    onSearchChange: (term: string) => void;
    /** Callback when a driver is clicked */
    onDriverClick: (driver: import('../../../interfaces/courier.interface').IAvailableCourierPosition) => void;
    /** Callback when refresh button is clicked */
    onRefresh: () => void;
    /** Whether panel is hidden */
    isPanelHidden: boolean;
    /** Callback to toggle panel visibility */
    onTogglePanel: () => void;
}

/**
 * Props for the DriverListItem component
 */
export interface DriverListItemProps {
    /** Driver data */
    driver: import('../../../interfaces/courier.interface').IAvailableCourierPosition;
    /** Callback when clicked */
    onClick: () => void;
}

/**
 * Props for the MapControls component
 */
export interface MapControlsProps {
    /** Callback for fit-all/return-to-overview button */
    onFitAll: () => void;
    /** Callback for refresh button */
    onRefresh: () => void;
    /** Whether data is loading (shows spinner on refresh button) */
    isLoading: boolean;
}

/**
 * Return type for useCourierMap hook
 */
export interface UseCourierMapReturn {
    /** Reference to attach to the map container div */
    mapContainerRef: React.RefObject<HTMLDivElement | null>;
    /** Whether the map is initialized */
    isInitialized: boolean;
    /** Update courier markers on the map */
    updateCouriers: (couriers: import('../../../interfaces/courier.interface').IAvailableCourierPosition[]) => void;
    /** Center map on a specific courier */
    centerOnCourier: (driver: import('../../../interfaces/courier.interface').IAvailableCourierPosition) => void;
    /** Fit all couriers in view / return to overview */
    returnToOverview: () => void;
}

// Constants

/**
 * Regional bounds for country-wide courier queries
 */
export const US_BOUNDS: RegionalBounds = {
    minLng: -125,
    maxLng: -65,
    minLat: 24,
    maxLat: 50,
};

export const NZ_BOUNDS: RegionalBounds = {
    minLng: 165,
    maxLng: 180,
    minLat: -47,
    maxLat: -34,
};

/**
 * Minimum distance change (in degrees) to trigger marker position update
 * Approximately 11 meters at the equator
 */
export const POSITION_THRESHOLD = 0.0001;

/**
 * Maximum number of icons to cache to prevent memory issues
 */
export const ICON_CACHE_LIMIT = 200;

/**
 * Maximum characters for marker label before truncation
 */
export const MARKER_LABEL_MAX_LENGTH = 12;

/**
 * Auto-refresh interval in milliseconds (30 seconds)
 */
export const REFRESH_INTERVAL_MS = 30000;

/**
 * Search debounce delay in milliseconds
 */
export const SEARCH_DEBOUNCE_MS = 150;

/**
 * Default zoom levels by region
 */
export const DEFAULT_ZOOM = {
    US: 4,
    NZ: 10,
} as const;

/**
 * Zoom level to use when centering on a single driver
 */
export const DRIVER_FOCUS_ZOOM = 12;

/**
 * Country overview zoom levels (for fit-all button)
 */
export const OVERVIEW_ZOOM = {
    US: 4,
    NZ: 7,
} as const;

/**
 * Colors for driver avatars (10-color rotation)
 */
export const AVATAR_COLORS = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#8b5cf6', // violet
    '#f59e0b', // amber
    '#ef4444', // red
    '#06b6d4', // cyan
    '#ec4899', // pink
    '#84cc16', // lime
    '#6366f1', // indigo
    '#14b8a6', // teal
] as const;
