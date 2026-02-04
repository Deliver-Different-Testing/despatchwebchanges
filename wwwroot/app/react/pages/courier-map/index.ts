/**
 * CourierMapPage Component
 *
 * Exports for the CourierMapPage React component and AngularJS integration.
 */

export { CourierMapPage } from './CourierMapPage';
export { CourierMapReactComponent } from './courier-map-react.module';
export { useCourierMap } from './useCourierMap';
export { CourierMarkerManager } from './CourierMarkerManager';
export { DriversPanel } from './components/DriversPanel';
export { DriverListItem } from './components/DriverListItem';
export { MapControls } from './components/MapControls';
export type {
    CourierMapPageProps,
    CourierMarker,
    DriversPanelProps,
    DriverListItemProps,
    MapControlsProps,
    UseCourierMapReturn,
    RegionalBounds,
} from './CourierMapPage.types';
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
} from './CourierMapPage.types';
