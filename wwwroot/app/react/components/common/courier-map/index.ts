/**
 * CourierMap Component
 *
 * Exports for the CourierMap React component and AngularJS integration.
 */

export { CourierMap } from './CourierMap';
export { CourierMapReactComponent } from './courier-map-react.module';
export { useCourierMap } from './useCourierMap';
export { CourierMarkerManager } from './CourierMarkerManager';
export { DriversPanel } from './DriversPanel';
export { DriverListItem } from './DriverListItem';
export { MapControls } from './MapControls';
export type {
    CourierMapProps,
    CourierMarker,
    DriversPanelProps,
    DriverListItemProps,
    MapControlsProps,
    UseCourierMapReturn,
    RegionalBounds,
} from './CourierMap.types';
export {
    US_BOUNDS,
    NZ_BOUNDS,
    POSITION_THRESHOLD,
    ICON_CACHE_LIMIT,
    MARKER_LABEL_MAX_LENGTH,
    REFRESH_INTERVAL_MS,
    SEARCH_DEBOUNCE_MS,
    DEFAULT_ZOOM,
    DRIVER_FOCUS_ZOOM,
    OVERVIEW_ZOOM,
    AVATAR_COLORS,
} from './CourierMap.types';
