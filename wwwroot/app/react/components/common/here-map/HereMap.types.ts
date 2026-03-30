/**
 * HereMap Type Definitions
 *
 * Type definitions for the HereMap React component.
 * Re-exports existing interfaces and adds new ones for the React implementation.
 */

// Re-export existing interfaces
export type {
    HereMapCredentials,
    HereMapConfig,
    IHereMapJob,
    IHereMapChildJob,
    CourierLocation,
    JobLocation,
} from '../../../../interfaces/hereMapCredentials.interfaces';

import type {
    CourierLocation,
    HereMapConfig,
    HereMapCredentials,
    IHereMapJob,
} from '../../../../interfaces/hereMapCredentials.interfaces';

// Component Props
export interface HereMapProps {
    /** Container element ID for the map */
    mapId: string;
    /** HERE Maps API credentials */
    credentials?: HereMapCredentials;
    /** Map configuration including job, courier location, zoom, etc. */
    config?: HereMapConfig;
    /** Callback when map is ready */
    onMapReady?: (params: { map: any; platform: any }) => void;
}

// Internal state types
export interface MapInstance {
    map: any;
    behavior: any;
    ui: any;
}

export interface MarkerState {
    fromMarker: any | null;
    toMarker: any | null;
    courierMarker: any | null;
    extraMarkers: any[];
}

export interface RouteState {
    routeLine: any | null;
    extraRouteLines: any[];
}

export interface Point {
    lat: number;
    lng: number;
}

export interface Bounds {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
}

// Hook return type
export interface UseHereMapReturn {
    mapInstance: MapInstance | null;
    platform: any | null;
    isInitialized: boolean;
    refreshMap: () => void;
    clearMap: () => void;
    showJobOnMap: (job: IHereMapJob, courierLocation?: CourierLocation) => void;
    centerMapOnIndex: (index: number) => void;
    autoZoomMapToShowAllPoints: () => void;
}

// Constants
export const MAP_CONSTANTS = {
    MAP_ZOOM_LEVEL: 15,
    AUTO_ZOOM_DELAY: 2000,
    RESIZE_DELAY: 100,
    ZOOM_ADJUSTMENT_DELAY: 300,
    DEFAULT_PADDING: 0.1,
    SINGLE_POINT_ZOOM: 12,
    CURVE_STEPS: 30,
    DEFAULT_CURVATURE: 0.5,
    BOUNDING_BOX_EXPAND_FACTOR: 0.25,
} as const;

export const US_MAP_CENTER = {lat: 39.8097343, lng: -98.5556199};
export const NZ_MAP_CENTER = {lat: -41.2865, lng: 174.7762};

export function getDefaultMapCenter(): { lat: number; lng: number } {
    return window.serverConfig?.isUSCustomer ? US_MAP_CENTER : NZ_MAP_CENTER;
}

export const DEFAULT_MAP_CONFIG: HereMapConfig = {
    zoom: 5,
    center: US_MAP_CENTER,
};

export const MARKER_ICONS = {
    FROM: 'https://img.icons8.com/ios-filled/50/39e75f/marker.png',
    TO: 'https://img.icons8.com/ios-filled/50/ff6863/marker.png',
    EXTRA: 'https://img.icons8.com/ios-filled/50/000000/marker.png',
} as const;

export const SVG_TEMPLATES = {
    PLANE: '<svg xmlns="http://www.w3.org/2000/svg" width="70" height="70" viewBox="0 0 24 24" {{TRANSFORM}} fill="lightblue" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-plane"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M16 10h4a2 2 0 0 1 0 4h-4l-4 7h-3l2 -7h-4l-2 2h-3l2 -4l-2 -4h3l2 2h4l-2 -7h3z" /></svg>',
    CAR: '<svg xmlns="http://www.w3.org/2000/svg" width="70" height="70" viewBox="0 0 24 24" {{TRANSFORM}} fill="lightblue" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-car"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M5 17h-2v-6l2 -5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0h-6m-6 -6h15m-6 0v-5" /></svg>',
} as const;

export interface UseHereMapOptions {
    mapId: string;
    credentials?: HereMapCredentials;
    config?: HereMapConfig;
    onMapReady?: (params: { map: any; platform: any }) => void;
}
