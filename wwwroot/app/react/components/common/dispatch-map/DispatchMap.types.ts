/**
 * DispatchMap Type Definitions
 *
 * Type definitions for the DispatchMap React component.
 */

import type { IDispatchMapItem } from '../../../../interfaces/job.interface';
import type { IAvailableCourierPosition } from '../../../../interfaces/courier.interface';

// Re-export for convenience
export type { IDispatchMapItem, IAvailableCourierPosition };

/**
 * Props for the main DispatchMap component
 */
export interface DispatchMapProps {
    /** List of jobs to display on the map */
    jobs?: IDispatchMapItem[];
    /** Currently selected job (highlighted differently) */
    currentJob?: IDispatchMapItem;
    /** Map center coordinates */
    mapCenter?: { lat: number; lng: number };
    /** Initial map zoom level */
    mapZoom?: number;
    /** Callback when a job marker is clicked */
    onMarkerClick?: (job: IDispatchMapItem) => void;
    /** Whether to show courier markers */
    showAvailableCouriers?: boolean;
    /** Clear list ID for zooming to envelope */
    clearListId?: number;
    /** Callback when envelope data is updated */
    onEnvelopeUpdate?: (data: ClearListEnvelopeData) => void;
}

/**
 * Clear list envelope data for zooming to an area
 */
export interface ClearListEnvelopeData {
    minimumLatitude: number;
    maximumLatitude: number;
    minimumLongitude: number;
    maximumLongitude: number;
}

/**
 * Map control button state
 */
export interface MapControlState {
    autoZoomEnabled: boolean;
    couriersOnlyEnabled: boolean;
    urgentArmyOnlyEnabled: boolean;
    couriersLargeViewEnabled: boolean;
}

/**
 * Props for MapControlButtons component
 */
export interface MapControlButtonsProps {
    controlState: MapControlState;
    onToggleAutoZoom: () => void;
    onToggleCouriersOnly: () => void;
    onToggleUrgentArmyOnly: () => void;
    onToggleCouriersLargeView: () => void;
}

/**
 * Internal job marker tracking
 */
export interface JobMarkerData {
    marker: any; // H.map.Marker
    jobId: number;
    type: 'pickup' | 'delivery';
    isCurrentJob: boolean;
}

/**
 * Internal courier marker tracking
 */
export interface CourierMarkerData {
    marker: any; // H.map.Marker
    courierId: number;
    lat: number;
    lng: number;
    name: string;
}

/**
 * Hook return type for useDispatchMap
 */
export interface UseDispatchMapReturn {
    mapContainerRef: React.RefObject<HTMLDivElement>;
    isMapReady: boolean;
    isLoading: boolean;
    controlState: MapControlState;
    toggleAutoZoom: () => void;
    toggleCouriersOnly: () => void;
    toggleUrgentArmyOnly: () => void;
    toggleCouriersLargeView: () => void;
}

// Constants

/**
 * Refresh interval for courier positions (15 seconds)
 */
export const COURIER_REFRESH_INTERVAL_MS = 15000;

/**
 * Maximum jobs to display to prevent performance issues
 */
export const MAX_JOBS_TO_DISPLAY = 1000;

/**
 * Batch size for marker processing
 */
export const MARKER_BATCH_SIZE = 200;

/**
 * Default map zoom level
 */
export const DEFAULT_MAP_ZOOM = 12;

/**
 * Maximum zoom level after auto-fit
 */
export const MAX_AUTO_ZOOM = 16;

/**
 * Marker icon colors
 */
export const MARKER_COLORS = {
    PICKUP: '#4CAF50',
    DELIVERY: '#F44336',
    OTHER_PICKUP: '#3F51B5',
    OTHER_DELIVERY: '#FF5722',
    COURIER_FLAG: '#1E88E5',
    COURIER_FLAG_LARGE: '#1565C0',
} as const;

/**
 * Courier label colors based on status
 */
export const COURIER_LABEL_COLORS = {
    NO_JOBS: { bg: '#E3F2FD', text: '#1565C0', border: '#1976D2' },    // Light blue - neutral
    HAS_JOBS: { bg: '#E8F5E9', text: '#2E7D32', border: '#388E3C' },   // Soft green - active
    OVERDUE: { bg: '#D32F2F', text: '#FFFFFF', border: '#B71C1C' },    // Red - urgent
} as const;

/**
 * LocalStorage keys for user preferences
 */
export const PREFERENCE_KEYS = {
    AUTO_ZOOM: 'mapZoom',
    COURIERS_ONLY: 'mapCouriersOnly',
    URGENT_ARMY_ONLY: 'mapUrgentArmyOnly',
    COURIERS_LARGE_VIEW: 'mapCouriersLargeView',
} as const;

/**
 * Icon cache limit to prevent memory issues
 */
export const ICON_CACHE_LIMIT = 200;

/**
 * Position threshold (degrees) - don't update if moved less than this
 */
export const POSITION_THRESHOLD = 0.0001;

/**
 * SVG path for marker pin
 */
export const MARKER_PIN_PATH =
    'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z';

/**
 * SVG path for flag marker
 */
export const FLAG_MARKER_PATH = 'M2,2 L2,24 L6,24 L6,20 L6,12 L30,12 L26,7 L30,2 Z';
