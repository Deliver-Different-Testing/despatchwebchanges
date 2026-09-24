/**
 * CourierMapDisplaySettings
 *
 * Per-user display preferences for the courier map (marker label, job count,
 * color mode, base view). Persisted via StaffPreference under the
 * `CourierMapDisplaySettings` key — see `wwwroot/app/react/services/preferencesApi.ts`.
 */

import type {MarkerLabelMode} from '../../components/common/here-map/courierFlagSvg';

export type {MarkerLabelMode};
export type MarkerColorMode = 'status' | 'single';
export type MapViewMode = 'roadmap' | 'satellite' | 'terrain';

export interface CourierMapDisplaySettings {
    markerLabel: MarkerLabelMode;
    showJobCount: boolean;
    colorMode: MarkerColorMode;
    mapView: MapViewMode;
    trafficEnabled: boolean;
    /** Custom flag fill color for colorMode 'single'. Unset falls back to the default blue. */
    singleColor?: string;
    /** Custom flag text color for colorMode 'single'. Unset falls back to white. */
    singleTextColor?: string;
}

/** New default: matches the requested satellite + traffic + numbered-marker look. */
export const LIVE_TEMPLATE: CourierMapDisplaySettings = {
    markerLabel: 'number',
    showJobCount: false,
    colorMode: 'single',
    mapView: 'satellite',
    trafficEnabled: true,
};

/** Today's existing look, kept as a one-click preset for anyone who prefers it. */
export const CLASSIC_TEMPLATE: CourierMapDisplaySettings = {
    markerLabel: 'name',
    showJobCount: true,
    colorMode: 'status',
    mapView: 'roadmap',
    trafficEnabled: false,
};

/** Whether `settings` equals a template field-for-field — drives the preset chip highlight. */
export function matchesTemplate(
    settings: CourierMapDisplaySettings,
    template: CourierMapDisplaySettings,
): boolean {
    return (
        settings.markerLabel === template.markerLabel &&
        settings.showJobCount === template.showJobCount &&
        settings.colorMode === template.colorMode &&
        settings.mapView === template.mapView &&
        settings.trafficEnabled === template.trafficEnabled
    );
}
