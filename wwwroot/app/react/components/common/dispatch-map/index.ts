/**
 * DispatchMap Component
 *
 * Exports for the DispatchMap React component and AngularJS integration.
 */

export { DispatchMap } from './DispatchMap';
export { DispatchMapReactComponent } from './dispatch-map-react.module';
export { useHereMap } from './useHereMap';
export { useMapPreferences } from './useMapPreferences';
export { JobMarkerManager } from './JobMarkerManager';
export { DispatchCourierMarkerManager } from './DispatchCourierMarkerManager';
export { MapControlButtons } from './MapControlButtons';
export type {
    DispatchMapProps,
    IDispatchMapItem,
    IAvailableCourierPosition,
    MapControlState,
    MapControlButtonsProps,
    JobMarkerData,
    CourierMarkerData,
    ClearListEnvelopeData,
    UseDispatchMapReturn,
} from './DispatchMap.types';
export {
    COURIER_REFRESH_INTERVAL_MS,
    MAX_JOBS_TO_DISPLAY,
    MARKER_BATCH_SIZE,
    DEFAULT_MAP_ZOOM,
    MAX_AUTO_ZOOM,
    MARKER_COLORS,
    COURIER_LABEL_COLORS,
    PREFERENCE_KEYS,
    ICON_CACHE_LIMIT,
    POSITION_THRESHOLD,
    MARKER_PIN_PATH,
    FLAG_MARKER_PATH,
} from './DispatchMap.types';
