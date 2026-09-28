/**
 * CourierMapPage Type Definitions
 *
 * Type definitions for the CourierMapPage React component.
 */

// Re-export from courier interface for convenience
import React from "react";
import type { MantineTheme } from '@mantine/core';

export type { IAvailableCourierPosition } from '../../../interfaces/courier.interface';
export type { CourierMapDisplaySettings } from './CourierMapDisplaySettings';

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

/** Fill / border / text colors for one status pill marker */
export interface MarkerColor {
    bg: string;
    border: string;
    text: string;
}

/**
 * Fallback color definitions for status-based map markers.
 *
 * The live map derives its colors from the active Mantine theme via
 * {@link getMarkerColors} so the markers stay in step with the driver list
 * (which colors rows from the same palette). This constant is only the
 * default used when no theme-derived palette is supplied.
 */
export const MARKER_COLORS: Record<DriverStatus, MarkerColor> = {
    overdue: { bg: '#dc2626', border: '#991b1b', text: '#ffffff' },
    active:  { bg: '#2563eb', border: '#1e40af', text: '#ffffff' },
    idle:    { bg: '#475569', border: '#334155', text: '#ffffff' },
};

/**
 * Builds the status → marker-color map from the active theme palette so that
 * map markers and the driver-list rows use identical colors:
 *   - overdue → error, active → primary, idle → success
 *
 * Reads concrete hex values off the ramps rather than `var(--mantine-color-*)`:
 * these strings are interpolated into the SVG that HERE renders for each marker,
 * where a CSS custom property has no guaranteed cascade to resolve against.
 *
 * Ramp indices mirror the theme: index 5 is the named colour (`primaryShade.light`)
 * and 7 is the darker edge — the equivalents of MUI's `.main` / `.dark`.
 */
const MAIN_SHADE = 5;
const DARK_SHADE = 7;

/** How much darker the border is than a custom single-color bg (fraction of each RGB channel). */
const CUSTOM_BORDER_DARKEN_AMOUNT = 0.2;

/**
 * Darkens a hex color by a fixed fraction of each RGB channel. Used to derive a marker's
 * border from a user-chosen custom bg color, so custom flags keep the same bg+darker-edge
 * look as the built-in status/brand colors instead of a flat, borderless fill.
 */
export function darkenHex(hex: string, amount: number): string {
    const clean = hex.replace('#', '');
    const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
    const num = parseInt(full, 16);
    const channel = (shift: number) => Math.max(0, ((num >> shift) & 0xff) * (1 - amount));
    const toHex = (v: number) => Math.round(v).toString(16).padStart(2, '0');
    return `#${toHex(channel(16))}${toHex(channel(8))}${toHex(channel(0))}`;
}

/**
 * 'status' (default) keeps the red/brand/green split above. 'single' collapses every
 * status to one flat color — for the courier-map display setting that trades status
 * at-a-glance for a flatter, reference-screenshot look. Defaults to a fixed blue
 * (independent of tenant brand) unless the caller supplies a user-chosen customColor.
 */
export function getMarkerColors(
    theme: MantineTheme,
    colorMode: 'status' | 'single' = 'status',
    customColor?: { bg: string; text: string },
): Record<DriverStatus, MarkerColor> {
    const ramp = (name: string) => theme.colors[name] ?? theme.colors.gray;
    const brand = ramp(theme.primaryColor);
    const brandColor: MarkerColor = { bg: brand[MAIN_SHADE], border: brand[DARK_SHADE], text: '#ffffff' };

    if (colorMode === 'single') {
        const singleColor: MarkerColor = customColor
            ? { bg: customColor.bg, border: darkenHex(customColor.bg, CUSTOM_BORDER_DARKEN_AMOUNT), text: customColor.text }
            : { bg: ramp('blue')[MAIN_SHADE], border: ramp('blue')[DARK_SHADE], text: '#ffffff' };
        return { overdue: singleColor, active: singleColor, idle: singleColor };
    }

    return {
        overdue: { bg: ramp('red')[MAIN_SHADE],   border: ramp('red')[DARK_SHADE],   text: '#ffffff' },
        active:  brandColor,
        idle:    { bg: ramp('green')[MAIN_SHADE], border: ramp('green')[DARK_SHADE], text: '#ffffff' },
    };
}

/**
 * Whether a courier matches a driver-search term (by name or code). Shared between the
 * drivers-panel list filter and the map's marker set so the two never disagree about who
 * currently matches a search.
 */
export function matchesCourierSearch(
    driver: import('../../../interfaces/courier.interface').IAvailableCourierPosition,
    term: string,
): boolean {
    const trimmed = term.toLowerCase().trim();
    if (!trimmed) return true;

    const name = (driver.courierName || '').toLowerCase();
    const code = (driver.code || '').toLowerCase();
    return name.includes(trimmed) || code.includes(trimmed);
}

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
    isSelected: boolean;
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
 * Available fleet selection option
 */
export interface FleetSelectorOption {
    id: number;
    text: string;
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
    /** Whether panel is hidden */
    isPanelHidden: boolean;
    /** Callback to toggle panel visibility */
    onTogglePanel: () => void;
    /** All fleets available to select from */
    fleetOptions: FleetSelectorOption[];
    /** Whether fleet options are still loading */
    isFleetOptionsLoading: boolean;
    /** Currently selected fleet IDs ([] = all fleets) */
    selectedFleetIds: number[];
    /** Callback when fleet selection changes */
    onSelectedFleetIdsChange: (ids: number[]) => void;
    /** The currently selected driver's courierId, or null if none is selected */
    selectedDriverId: number | null;
}

/**
 * Props for the DriverListItem component
 */
export interface DriverListItemProps {
    /** Driver data */
    driver: import('../../../interfaces/courier.interface').IAvailableCourierPosition;
    /** Callback when clicked */
    onClick: () => void;
    /** Whether this driver is the currently selected one */
    isSelected: boolean;
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
    /** Current display settings, shown/edited via the display-settings popover */
    displaySettings: import('./CourierMapDisplaySettings').CourierMapDisplaySettings;
    /** Callback when the user changes a display setting or picks a preset */
    onDisplaySettingsChange: (settings: import('./CourierMapDisplaySettings').CourierMapDisplaySettings) => void;
}

/**
 * Return type for useCourierMap hook
 */
export interface UseCourierMapReturn {
    /** Reference to attach to the map container div */
    mapContainerRef: React.RefObject<HTMLDivElement | null>;
    /** Whether the map is initialized */
    isInitialized: boolean;
    /** The underlying HERE map instance (null until initialized) */
    map: any | null;
    /** The HERE platform instance (null until initialized) */
    platform: any | null;
    /** The HERE default layers (null until initialized) */
    defaultLayers: any | null;
    /** Update courier markers on the map */
    updateCouriers: (couriers: import('../../../interfaces/courier.interface').IAvailableCourierPosition[]) => void;
    /** Center map on a specific courier */
    centerOnCourier: (driver: import('../../../interfaces/courier.interface').IAvailableCourierPosition) => void;
    /** Highlight (or clear, with null) the selected driver's flag on the map */
    setSelectedDriver: (courierId: number | null) => void;
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
